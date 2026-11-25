# RetroFolio: notes for Claude

RetroFolio is a no-code retro OS portfolio builder. Users make a portfolio at `/studio` and publish it at `/handle`. The home page is `/`.

## Stack
- plain HTML, CSS, and JS: `index.html`, `studio.html`, `style.css`, `script.js`
- Firebase auth and Firestore. Project id: `retrofolio-46409`
- Vercel hosting. Serverless routes live in `api/`, e.g. `api/verify-domain.js`
- `functions/` was removed on purpose. Cloud Functions need Blaze, and the project stays on the free plan.

## Deploy and git rules
- `main` is what Vercel deploys. A push to `main` goes live, so edit a clone, never the live site directly.
- Commit and push on your own when you judge a change is ready. Before the first push in a session, ask Keane for the full repo link ending in `.git`.
- Work in a clone, then push to `main`. Don't branch unless Keane asks.

## Firestore rules
- `firestore.rules` in the repo does NOT change the live rules. Keane has to paste the file into the Firebase console and publish. Say this every time a rules change ships.
- Current collections: `views/{slug}`, `likes/{slug}`, `guestbook/{slug}/entries`.

## Secrets
- Never commit keys. `.env*` is in both `.gitignore` and `.vercelignore`.
- Production secrets live only in Vercel env vars, e.g. `FIREBASE_SERVICE_ACCOUNT` and, once added, `GEMINI_API_KEY`.
- Local dev uses `.env.local`.
- Never return a secret from an API route, including in error messages.

## Security
- CSP is set in `vercel.json` and also in the meta tags of `index.html`, `studio.html`, and the standalone export. A new external host, such as a media or embed domain, has to be added in every place it's needed.
- Only the owner of a site can read its view, like, and guestbook data.

## Keane's preferences
- Keane works from a phone (Termux), so keep commands and file reads short.
- Keane only wants to pay for the free tier. Don't add anything that needs Blaze.
