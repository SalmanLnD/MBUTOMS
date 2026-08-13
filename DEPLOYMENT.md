# MBUTOMS Deployment

Live URLs:

| App | URL |
|-----|-----|
| Frontend | https://mbutoms.vercel.app |
| API | https://mbutoms-api.onrender.com |
| Health | https://mbutoms-api.onrender.com/api/health |

| App | Platform | Directory |
|-----|----------|-----------|
| React frontend | **Vercel** | `frontend/` |
| Express API | **Render** (Node web service) | `backend/` |
| WhatsApp bridge | **AWS EC2** | `whatsapp-bridge/` |
| Database | **MongoDB Atlas** | external |

## 1. MongoDB Atlas

1. Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Allow network access (`0.0.0.0/0` for Vercel serverless).
3. Copy the connection string into `MONGODB_URI`.

## 2. Backend (Render)

`render.yaml` defines the `mbutoms-api` web service (`rootDir: backend`, health `/api/health`). Auto-deploy is on for pushes to `main`.

### Dashboard / Blueprint setup

1. Create the service from `render.yaml` (or the Render CLI).
2. Set **Root Directory** to `backend`.
3. Add environment variables:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://mbutoms.vercel.app,http://localhost:5173,http://localhost:5174` |
| `API_PUBLIC_URL` | `https://mbutoms-api.onrender.com` |
| `NODE_ENV` | `production` |
| `RUN_STARTUP_SYNC` | `false` |
| `WHATSAPP_WEBHOOK_SECRET` | long random string (only if using the WhatsApp punch-in bridge) |

4. Deploy. Health check: `https://mbutoms-api.onrender.com/api/health`

## WhatsApp punch-in automation

Trainers post a punch-in image with an OIF number in a WhatsApp group; the
attendance is recorded automatically in MBUTOMS.

- **Endpoint:** `POST /api/webhooks/whatsapp-punch`
- **Auth:** `x-webhook-secret` header must equal `WHATSAPP_WEBHOOK_SECRET`.
- **Body:** `{ "phone": "919876543210", "oifNumber": "OIF-12345", "punchInAt": "2026-07-08T09:05:00+05:30", "imageUrl": "https://..." }`
- **Behaviour:** matches a trainer by the last 10 digits of `phone`, then upserts
  that trainer's `TrainerDailyAttendance` for the day with the OIF and punch-in time.

The group-reading half runs as a separate always-on service in
[`whatsapp-bridge/`](./whatsapp-bridge/README.md) (it cannot run on Vercel).
Set the same secret value in both the backend `WHATSAPP_WEBHOOK_SECRET` and the
bridge `WEBHOOK_SECRET`.

### GitHub Actions (auto-deploy on push to `main`)

Every push to `main` runs `.github/workflows/vercel-production.yml` and deploys the **frontend** to Vercel. Render auto-deploys the API from the same `main` push.

Add this repository secret in GitHub (**Settings → Secrets and variables → Actions**):

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |

`VERCEL_ORG_ID` and the frontend `VERCEL_PROJECT_ID` are already set in the workflow file. You do **not** need those as GitHub secrets.

If deploys still fail with authentication errors, regenerate `VERCEL_TOKEN` and update the GitHub secret.

### Optional: Vercel Git integration

You can also connect the Vercel frontend project to `SalmanLnD/MBUTOMS` in the Vercel dashboard (**Project → Settings → Git**) with root directory `frontend`. GitHub Actions remains the source of truth for frontend production deploys. The API deploys from Render's GitHub integration.

## 3. Frontend (Vercel)

1. Import repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`.
3. Environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://mbutoms-api.onrender.com/api` |

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

- The API runs as a persistent Node process on Render (`backend/server.js`). Free instances sleep after idle time; the first request may be slow.
- Heavy startup sync (IDSA/PEDH seed) is skipped in production by default (`RUN_STARTUP_SYNC=false`). Run locally against Atlas once if needed.
- The old Vercel API project is no longer used by the frontend.
