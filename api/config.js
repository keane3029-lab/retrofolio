// vercel serverless function. hands the studio its firebase web api key from the FIREBASE_API_KEY env var.
// the key is public by design (it identifies the project), but it lives in vercel env vars, not in script.js.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'get only' });

  const apiKey = process.env.FIREBASE_API_KEY;
  // never echo env names or values in errors
  if (!apiKey) return res.status(500).json({ error: 'firebase is not set up yet' });
  return res.status(200).json({ apiKey });
};
