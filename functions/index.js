// npm i firebase-functions firebase-admin  (needs the blaze plan)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dns = require('node:dns').promises;

initializeApp();

exports.verifyDomain = onCall(async (req) => {
  if (req.auth == null) throw new HttpsError('unauthenticated', 'sign in first');
  const domain = String((req.data && req.data.domain) || '').toLowerCase();
  const ref = getFirestore().doc('domains/' + domain);
  const snap = await ref.get();
  if (snap.exists === false) throw new HttpsError('not-found', 'bind the domain first');

  const data = snap.data();
  if (data.ownerUid !== req.auth.uid) throw new HttpsError('permission-denied', 'not your domain');

  let records = [];
  try {
    records = (await dns.resolveTxt(domain)).map((chunks) => chunks.join(''));
  } catch (err) {
    records = [];
  }

  const found = records.includes('retrofolio-verify=' + data.token);
  if (found === false) return { verified: false };

  await ref.update({ verified: true, verifiedAt: new Date() });
  return { verified: true };
});
