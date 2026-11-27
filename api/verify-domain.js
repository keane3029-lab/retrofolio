// vercel serverless function. free tier, no blaze needed.
const dns = require('node:dns').promises;
const admin = require('firebase-admin');

const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/;

// starts firebase admin on first use. a missing or broken service account gives null, not a crash at load.
function getDb() {
  if (admin.apps.length === 0) {
    try {
      const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
      admin.initializeApp({ credential: admin.credential.cert(account) });
    } catch (err) {
      return null;
    }
  }
  return admin.firestore();
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'post only' });

  const db = getDb();
  if (!db) return res.status(500).json({ error: 'server is not set up yet' });

  // 1. who is calling
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch (err) {
    return res.status(401).json({ error: 'sign in first' });
  }

  // 2. the domain record must belong to this user
  const domain = String((req.body && req.body.domain) || '').toLowerCase();
  if (DOMAIN_RE.test(domain) === false) return res.status(400).json({ error: 'bad domain' });
  const ref = db.doc('domains/' + domain);
  const snap = await ref.get();
  if (snap.exists === false) return res.status(404).json({ error: 'bind the domain first' });
  const data = snap.data();
  if (data.ownerUid !== uid) return res.status(403).json({ error: 'not your domain' });
  // the domain can only point at a site this user owns
  const site = await db.doc('sites/' + data.slug).get();
  if (site.exists === false || site.data().ownerUid !== uid) return res.status(403).json({ error: 'not your site' });

  // 3. check the txt record for the ownership token
  let records = [];
  try {
    records = (await dns.resolveTxt(domain)).map((chunks) => chunks.join(''));
  } catch (err) {
    records = [];
  }
  if (records.includes('retrofolio-verify=' + data.token) === false) {
    return res.status(200).json({ verified: false });
  }

  // 4. only the server can flip this
  await ref.update({ verified: true, verifiedAt: new Date() });
  return res.status(200).json({ verified: true });
};
