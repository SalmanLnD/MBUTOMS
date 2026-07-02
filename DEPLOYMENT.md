# MBUTOMS Deployment

This project is a split deployment:

| App | Platform | Directory |
|-----|----------|-----------|
| React frontend | **Vercel** | `frontend/` |
| Express API | **Render** (or Railway/Fly) | `backend/` |
| Database | **MongoDB Atlas** | external |

## 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Copy the connection string into `MONGODB_URI`.

## 2. Backend (Render)

1. Push this repo to GitHub (`MBUTOMS`).
2. In Render, create a **Web Service** from the repo.
3. Set **Root Directory** to `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Environment variables:

| Variable | Example |
|----------|---------|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://mbutoms.vercel.app` |
| `PORT` | `10000` |

Or import `render.yaml` as a Render Blueprint.

Note: add a health route if missing — Render uses `/api/health`.

## 3. Frontend (Vercel)

### Option A — Vercel dashboard (recommended)

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (auto-detected).
4. Environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR-RENDER-API.onrender.com/api` |

5. Deploy.

`frontend/vercel.json` handles SPA routing.

### Option B — GitHub Actions

Add these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Pushes to `main` run `.github/workflows/vercel-deploy.yml`.

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

Frontend proxies `/api` to `http://localhost:5000` in dev (`vite.config.js`).

## 5. CORS

Set `CLIENT_URL` on the backend to your Vercel URL (comma-separated for multiple origins).
