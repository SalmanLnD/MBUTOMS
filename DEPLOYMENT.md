# MBUTOMS Deployment

Live URLs:

| App | URL |
|-----|-----|
| Frontend | https://mbutoms.vercel.app |
| API | https://mbutoms-api.vercel.app |
| Health | https://mbutoms-api.vercel.app/api/health |

| App | Platform | Directory |
|-----|----------|-----------|
| React frontend | **Vercel** | `frontend/` |
| Express API | **Vercel** (serverless) | `backend/` |
| Database | **MongoDB Atlas** | external |

## 1. MongoDB Atlas

1. Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Allow network access (`0.0.0.0/0` for Vercel serverless).
3. Copy the connection string into `MONGODB_URI`.

## 2. Backend (Vercel)

### Dashboard setup

1. Go to [vercel.com/new](https://vercel.com/new) and import **SalmanLnD/MBUTOMS**.
2. Create a **second Vercel project** for the API (or use CLI below).
3. Set **Root Directory** to `backend`.
4. Framework preset: **Other** (uses `backend/vercel.json`).
5. Add environment variables:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://mbutoms.vercel.app,http://localhost:5173` |
| `API_PUBLIC_URL` | `https://mbutoms-api.vercel.app` |
| `VERCEL` | `1` (set automatically on Vercel) |
| `RUN_STARTUP_SYNC` | `false` (recommended on serverless; run sync locally once) |

6. Deploy. Health check: `https://YOUR-API.vercel.app/api/health`

### CLI deploy

```bash
cd backend
npm install -g vercel
vercel login
vercel link
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add CLIENT_URL
vercel --prod
```

### GitHub Actions (auto-deploy on push to `main`)

Every push to `main` runs `.github/workflows/vercel-production.yml` and deploys **both** the frontend and API.

Add this repository secret in GitHub (**Settings → Secrets and variables → Actions**):

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |

`VERCEL_ORG_ID` and both project IDs are already set in the workflow file. You do **not** need `VERCEL_PROJECT_ID` or `VERCEL_BACKEND_PROJECT_ID` secrets anymore.

If deploys still fail with authentication errors, regenerate `VERCEL_TOKEN` and update the GitHub secret.

### Optional: Vercel Git integration

You can also connect each Vercel project to `SalmanLnD/MBUTOMS` in the Vercel dashboard (**Project → Settings → Git**) with root directories `frontend` and `backend`. GitHub Actions remains the source of truth for production deploys in this repo.

## 3. Frontend (Vercel)

1. Import repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`.
3. Environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://mbutoms-api.vercel.app/api` |

4. Deploy.

## 4. Local development

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## 5. CORS

Set `CLIENT_URL` on the backend to your frontend Vercel URL (comma-separated for multiple origins).

## Notes

- Vercel uses a cached MongoDB connection per serverless instance (`backend/config/db.js`).
- Heavy startup sync (IDSA/PEDH seed) is skipped on Vercel by default. Run locally against Atlas once if needed: `npm run dev` with `RUN_STARTUP_SYNC` unset.
- Render deployment (`render.yaml`) remains available as an alternative for a always-on Node server.
