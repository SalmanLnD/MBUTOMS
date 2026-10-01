# TOMS Assistant (V1)

This implementation adds `POST /api/ai/chat`
using the official `@google/genai` SDK and defaults to `gemini-3.1-flash-lite`.
The frontend has a compact, modeless chat panel, closed initially and opened from
the desktop sidebar or mobile **All pages** menu. It has a close button and three
suggested questions. Closing preserves the current session's messages; signing out,
switching accounts, or entering trainer view removes them. There is no persistent
conversation store. The UI keeps at most 40 messages in memory.

Access is limited to exact `admin` and `subject_coordinator` roles in both the API
and frontend. Managers, campus managers, trainers, evaluators, and impersonation
sessions are denied. Existing role aliases do not widen this restriction.

## Manual setup

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Add the following to your **local** `backend/.env` (already ignored by Git):

   ```dotenv
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-3.1-flash-lite
   ```

   Never paste the key into chat, a frontend file, or a `VITE_*` variable.
3. Check that the local backend's existing `MONGODB_URI` points to the database
   you intend to use for local development. The normal server startup can run
   existing TOMS migrations; do not start it against production for this test.
   This implementation does not copy production data or change any deployed service.
4. Start the existing backend with `npm run dev` in `backend`. Sign in to that
   local backend using a development account and its normal TOMS authentication.
5. Call the endpoint with the resulting Bearer token. For example, in PowerShell:

   ```powershell
   $tomsToken = Read-Host 'Local TOMS token'
   Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/ai/chat' `
     -Headers @{ Authorization = "Bearer $tomsToken" } `
     -ContentType 'application/json' `
     -Body '{"message":"How many class-handling hours do I have today, and why?"}'
   Remove-Variable tomsToken
   ```

   The configured backend port may differ. Response: `{ "message": "...", "toolCalls": [] }`.

Without a configured key, authenticated requests return a clean 503 response.
For deployment, set `GEMINI_API_KEY` in the backend hosting service's environment
and set `GEMINI_MODEL=gemini-3.1-flash-lite`. The local `.env` is excluded from Git
and pushing the code does not copy its key to the hosting service.
The configured key was verified against `gemini-3.1-flash-lite`, including a real
function-calling round trip with synthetic tool results. No live TOMS database
records were sent for that smoke test. Real local-data answers still need a smoke
test in a development database. Automated tests use fixtures and do not contact
Gemini or MongoDB.

## Tools and permissions

- My timetable, official class-handling hours, and my attendance use the effective
  authenticated account's linked trainer. Private attendance accepts no trainer selector.
- Other-trainer timetable requests require existing management role authorization;
  subject coordinators additionally use the existing trainer-access helper.
- Live venues follow the existing authenticated live-venue screen's visibility.
- Leaves follow the existing leave controller's permissions. Unlinked trainer-like
  accounts cannot query leaves. Reasons and other private free text are omitted.
- Replacement register and special-class tools require the same management roles
  as their existing routes. Impersonation disables those management tools.
- Class counts and topic tracker reuse existing class/controller permission rules;
  no student records are returned. Evaluators retain existing trainer-like access.
- Unknown names and classes are never guessed; ambiguous trainer names return choices
  with employee IDs, requiring a follow-up question.

The replacement register's existing GET handler can save deduplicated records.
The assistant therefore uses a separate **read-only adapter** over existing models
and replacement/date/cancellation helpers, rather than invoking that mutating handler.

## Calculation and limits

- Official hours come from `computeClassHandlingHoursBatch`, with an optional
  `includeDetails` result. Existing callers still receive the original numeric map.
  Explanation fields preserve the existing attendance deduplication identity.
- Details identify regular/special classes, cancellation exclusions, replacement
  coverage, incoming campus replacements, subject-date exclusions, holidays, and
  joining-date exclusions. External replacements receive no campus trainer hours.
- `includeInRtet=false` is shown independently from workload hours. The assistant
  does not compute an RTET total or treat scheduled workload as proof of attendance.
- All operational dates default to the current Asia/Kolkata day. Ranges are inclusive
  and limited to 31 days. Attendance uses the existing screen's semester III default;
  timetable/hour tools allow a semester or all semesters when omitted.
- Each request accepts only `message`, up to 2,000 characters. V1 is single-turn;
  clarifications must include enough context because previous chat history is not stored.
- Maximum three tool rounds, eight total tool calls, four calls per round, 1,200 output
  tokens, a 20-second provider timeout, and a 45-second overall response deadline.
- Per process: ten requests per account per minute, one active request per account,
  and four active requests overall. These are local in-memory limits, not distributed limits.
- Results are bounded and explicitly mark truncation. Leaves search the latest 50
  authorized records, special classes use the existing 500-schedule cap, and other
  lists/summaries have smaller limits. Incomplete results must not be presented as
  complete period totals or proof that no older record exists.
- Provider errors, tool exceptions, credentials, private punch photos/phones/raw
  WhatsApp data, and model thoughts are not exposed by the API. No prompt or provider
  error logging is added. Only approved fixed tools can execute; no arbitrary queries,
  code execution, URLs, shell access, or filesystem access are exposed.

## Verification

```powershell
cd backend
node --test tests/unit/ai*.test.js
npm test
node --check app.js
```

In `frontend`, use `npm test` and `npm run build`. With local Vite running and
Playwright configured as described in `frontend/scripts/README.md`, run
`node scripts/check-ai-assistant.mjs` for role, viewport, close/reopen, scrolling,
error, and retry checks. These UI checks intercept API requests with synthetic data.

## Files in this implementation

New:

- `backend/ai/aiController.js`
- `backend/ai/aiService.js`
- `backend/ai/aiPrompt.js`
- `backend/ai/aiTools.js`
- `backend/routes/aiRoutes.js`
- `backend/tests/unit/aiHours.test.js`
- `backend/tests/unit/aiRoutes.test.js`
- `backend/tests/unit/aiService.test.js`
- `docs/AI_ASSISTANT.md`
- `frontend/src/components/AiAssistant.jsx`
- `frontend/src/context/AiAssistantContext.jsx`
- `frontend/src/services/aiService.js`
- `frontend/src/styles/ai-assistant.css`
- `frontend/src/utils/aiAssistantAccess.js`
- `frontend/src/utils/aiAssistantAccess.test.js`
- `frontend/scripts/check-ai-assistant.mjs`

Modified:

- `backend/app.js`
- `backend/package.json` (SDK dependency only; version stays 2.2.0)
- `backend/package-lock.json`
- `backend/.env.example`
- `backend/utils/trainerClassHoursBatch.js` (optional explanation result)
- `backend/utils/managerEditNotifications.js` (exclude read-only AI POSTs from edit notifications)
- `frontend/src/App.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/MobileNavigation.jsx`
- `frontend/src/styles/sidebar.css`
- `frontend/src/styles/mobile-nav.css`

Existing untracked files are unrelated and remain untouched.
