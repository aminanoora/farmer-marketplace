# 🚀 Deploying Krishi Market

The recommended setup runs the **backend on Railway** (long-running Express + MongoDB) and the **frontend on Vercel** (Next.js, which proxies `/api` to Railway). The alternative — everything on Vercel as a serverless function — is documented at the bottom.

| Layer | Host | What runs |
|-------|------|-----------|
| Backend (API) | **Railway** | Express server (`server/`) — `npm run build` → `node dist/index.js` |
| Frontend | **Vercel** | Next.js app (`client/`), proxies `/api/*` → Railway |
| Database | **MongoDB Atlas** | Free M0 cluster |
| Uploads | **Vercel Blob** | Product images as public URLs |

---

## 1. Create a MongoDB Atlas cluster (free)

1. Open the [MongoDB Atlas setup](https://www.mongodb.com/atlas) page and create an account if needed.
2. Create a new cluster (**M0 free tier**), then click **Connect → Connect your application**.
3. Copy the connection string and:
   - Replace `<password>` with your database user password
   - Replace the default database name (e.g. with `krishi_market`)
   - Keep `?retryWrites=true&w=majority` at the end
4. In **Network Access**, allow `0.0.0.0/0` (Railway egress IPs vary). The final string becomes `MONGODB_URI`.

---

## 2. Deploy the backend on Railway

1. Go to [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**, select this repo.
2. **Add a service** for the backend. The repo's `railway.toml` already sets:
   - **Build Command:** `npm run build --workspace=server` (compiles `server/src` → `dist`)
   - **Start Command:** `npm run start` (→ `node dist/index.js`)
   - **Healthcheck:** `/health`
3. Open the service → **Variables** tab and add:

   | Variable | Value |
   |----------|-------|
   | `MONGODB_URI` | your Atlas connection string (step 1) |
   | `JWT_SECRET` | a long random string — `openssl rand -hex 32` |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | the frontend URL, e.g. `https://krishi-market-client.vercel.app` |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (see step 4) — for image uploads |
   | `RESEND_API_KEY` | *(optional)* password-reset emails |

   > `PORT` is injected automatically by Railway — do not set it manually.

4. **Settings → Networking → Generate Domain** (e.g. `https://krishi-market-api.up.railway.app`). Note this URL.
5. Deploy and verify:
   - `https://<your-railway-url>/health` → `{ "status": "ok" }`
   - `https://<your-railway-url>/api/homepage` → JSON with categories/products

---

## 3. Configure the frontend on Vercel

Your existing Vercel project should already have the Next.js app deployed. Check/update its settings:

1. **Root Directory:** `client/`
2. **Framework Preset:** Next.js
3. **Node.js Version:** 24.x — the client requires `>= 24.15.0` (otherwise `npm ci` may fail with an engine error)
4. **Environment Variables:**

   | Variable | Value |
   |----------|-------|
   | `BACKEND_URL` | `https://<your-railway-url>` (no trailing slash) |
   | `NEXT_PUBLIC_API_URL` | **remove it if set** — leaving it unset makes the browser use the same-origin `/api` proxy, which avoids CORS entirely |

   > `BACKEND_URL` is read at **build time** (Next.js rewrites). Set it *before* building; changing it later requires a redeploy.

5. Deploy, then load the site — `/api/*` requests now proxy to your Railway backend.

> The build settings above are codified in **`client/vercel.json`** (`framework`, `nodeVersion`, `buildCommand`, `installCommand`) so any deploy or clone uses the same configuration. **Root Directory** (`client/`) remains a dashboard setting — it's what tells Vercel where to find that config file.

---

## 4. Image uploads (Vercel Blob)

Uploads go to **Vercel Blob** (no disk storage — images survive redeploys):

1. In the **Vercel client project**: **Storage → Blob → Create store**. Vercel adds `BLOB_READ_WRITE_TOKEN` to that project's env automatically.
2. Copy that token into the **Railway** service as `BLOB_READ_WRITE_TOKEN` (see step 2).
3. Local development: add the same token to your local `.env` so uploads work locally.

---

## 5. Seed the database

From your computer (with `MONGODB_URI` + `JWT_SECRET` in your local `.env`):

```bash
npm run seed
```

Test logins:
- Admin: `admin@gmail.com` / `admin#123`
- Farmer: `ramesh@farm.com` / `farmer123`
- Consumer: `priya@example.com` / `consumer123`

---

## 6. Verify end-to-end

1. Homepage shows categories, featured farmers and products ✅
2. Login as a farmer → **Add Product** with photos → image appears (stored on Vercel Blob) ✅
3. Login as admin → approve the product → it appears in the marketplace ✅
4. Place an order as the consumer ✅

---

## 🧪 One-command end-to-end verification

Run the full chain (health → data → login → image upload to Blob → approve → marketplace → cleanup) against any environment:

```bash
node scripts/verify-deployment.mjs                    # local (localhost:5000)
node scripts/verify-deployment.mjs https://<your-api-url>   # live (Railway/Vercel)
```

Every step prints ✅/❌ and the script exits non-zero on any failure. It creates a temporary test product and deletes it afterwards.

---

## ⚠️ Important notes

- **`BACKEND_URL` is build-time:** set it on Vercel *before* the production build. Same for any `NEXT_PUBLIC_*` vars.
- **Upload limit:** Vercel serverless caps proxied request bodies at **4.5 MB**; the app enforces a **4 MB total** across images per upload with a clear error. Compress photos if you hit it.
- **CORS:** with the same-origin `/api` proxy on Vercel, CORS isn't involved. `CLIENT_URL` on Railway is still used for password-reset links and as the CORS allowlist if you ever call the API cross-origin.
- **Env vars must be set before first deploy:** the server crashes at boot if `JWT_SECRET` or `MONGODB_URI` is missing (by design — it fails fast instead of running misconfigured).
- **Costs:** Railway trial/Hobby + Atlas M0 (free) + Vercel Hobby (free) + Vercel Blob free tier (1 GB). Fine for development and light production use.

---

## Alternative: everything on Vercel (serverless)

If you'd rather skip Railway entirely, the repo also supports a Vercel-only deployment — the Express app is exported as a serverless function:

- **`server/api/index.ts`** — the Vercel function entrypoint (exports the Express app)
- **`server/vercel.json`** — rewrites every request to the function

Setup for that path: create a second Vercel project with **Root Directory `server/`**, framework **Other**, set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `BLOB_READ_WRITE_TOKEN` (Blob store in that project), then point the client's `BACKEND_URL` at `https://<api-project>.vercel.app`. Upload limits are tighter on serverless (4.5 MB request body cap).
