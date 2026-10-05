# Demo workspace

The `demo` account has the same operational reads and Sallu tools as an admin. Its identity remains `demo` in MongoDB; effective admin privileges are granted only after authenticated server checks. Normal admins, managers and trainers retain their existing behavior.

Demo edits use a local Axios adapter before any upload/network dispatch. Saved patches persist in that browser's local storage under the owning demo account, including across reloads and trainer preview. The live server response is used as a baseline; local CRUD, attendance cells, mark entries, tracker entries, observations, PLP overrides and sheet links are overlaid on it. Reset demo changes clears these patches. Other devices, accounts and real users never receive them. Derived server reports and Sallu continue to read live data, not the demo's local edits.

The API rejects demo POST/PUT/PATCH/DELETE business requests independently of frontend controls. Authentication/session transitions and the read-only AI chat are the only allowed POST actions. Demo trainer preview tokens carry the owning demo ID and session version, so they cannot become real trainer write sessions. Revoking/deactivating the owner invalidates previews. A global signed-token guard also covers public/key-authenticated mutation routes and the bridge's GET job-claim endpoint. Demo sheet setup uses an inert `DEMO_LOCAL_ONLY` key, and demo reads do not seed comp-offs or backfill feedback forms or tracker approvals. Sallu's normal quota accounting still applies; application records are never edited by AI.

The trainer details view masks the trailing half of every displayed field for demo users, preserving the first half. `adjfaculty-cdc086` appears as `adjfacultxxxxxxxx`. Real admins see the original fields. CAMU credentials are additionally masked in all demo API responses, including nested trainer references, so directory data cannot reveal them through edit forms or browser network inspection. IDs and underlying dates/numbers remain usable for local controls. This is a demonstration account with broad live viewing access, not an anonymized copy of all app data.

External integrations (WhatsApp jobs, push subscriptions, password changes and file uploads) cannot change the server from a demo. Sheet linking and sync controls simulate local state; unsupported upload actions explicitly report that nothing was sent. Local edits do not recompute every cross-page report or perform real transfers/integrations.

## Create credentials

From `backend`, run `node scripts/create-demo-user.mjs`. It creates only the demo account, without startup syncs or index migrations, and records the generated password in ignored `.env.demo-user`. It refuses to replace a real account or silently rotate an existing demo password. Optional environment variables: `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`. Never commit the credentials file. Deploy both frontend and backend before using the role on the hosted app.

## Checks

Backend: `node --test tests/unit/demoAccess.test.js tests/unit/patchSessions.test.js tests/unit/aiRoutes.test.js`.
Frontend: `npm test`, `npm run build`, and `node scripts/check-demo-workspace.mjs` with the normal local Playwright/Chrome environment.
