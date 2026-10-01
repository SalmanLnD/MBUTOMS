# Sallu — TOMS Assistant (V1)

This implementation adds `POST /api/ai/chat`
using the official `@google/genai` SDK and defaults to `gemini-3.1-flash-lite`.
Sallu has a shared vector avatar in the chat header, replies, and navigation.
While a request runs, user-supplied humorous status lines rotate every three seconds
and the chat avatar holds a finger to its lips. Replies trigger a one-second mouth
animation. Avatar motion respects the device's reduced-motion setting.
The frontend has a compact, modeless chat panel, closed initially and opened from
the desktop sidebar or mobile **All pages** menu. It has a close button and three
suggested questions. Closing preserves the current session's messages; signing out,
switching accounts, or entering trainer view removes them. There is no persistent
conversation store. The UI keeps at most 40 messages in memory.

Since v2.2.1, every signed-in role can use Sallu: admin, manager, campus manager,
subject coordinator, evaluator, and trainer. Impersonation and pending password-reset
sessions are denied. Access to individual tools/data retains the existing role rules;
opening the assistant does not grant management permissions.

## Manual setup

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Add the following to your **local** `backend/.env` (already ignored by Git):

   ```dotenv
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-3.1-flash-lite
   AI_GEMINI_FREE_TIER_CONFIRMED=true
   AI_GEMINI_FREE_RPM=15
   AI_GEMINI_FREE_TPM=250000
   AI_GEMINI_FREE_RPD=500
   ```

   Never paste the key into chat, a frontend file, or a `VITE_*` variable.
3. Check that the local backend's existing `MONGODB_URI` points to the database
   you intend to use for local development. The normal server startup can run
   existing TOMS migrations; do not start it against production for this test.
   The quota integration audit uses a uniquely named temporary collection and does
   not start the app, seed data, or run migrations.
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
and set `GEMINI_MODEL=gemini-3.1-flash-lite` plus the four quota settings above.
The values shown were supplied by the project owner, who confirmed Free tier.
Use the actual AI Studio quotas when deploying to another project. Keep this
Gemini project on Free tier; application limits do not make paid-tier usage free.
The local `.env` is excluded from Git; hosting credentials are configured separately.
The configured key was verified against `gemini-3.1-flash-lite`, including real
function-calling round trips. A read-only check using the stored timetable confirmed
Salman's 28 September–4 October 2026 total of four hours, with 2 October excluded
for Gandhi Jayanthi. Automated tests use fixtures and do not contact Gemini or MongoDB.

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
- Timetable/hour tools accept one `date`, an inclusive `from`/`to` range, or
  `period=today|this_week|last_week`. Weeks run Monday–Sunday in Asia/Kolkata.
  The backend sums all requested days and returns the range, daily hours, and dated
  contributing/excluded classes. Missing calculations return unavailable, not zero.
  This assistant adapter does not change attendance or RTET calculation rules.
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
- Each account gets five questions per Pacific calendar day and two per rolling
  minute. One active request per account and four active requests overall use
  MongoDB leases, expiring after 90 seconds if a process dies.
- Gemini calls are reserved atomically before every provider round, including
  failed requests. The shared budgets are 12 calls/minute, 200,000 input tokens/minute,
  and 400 calls/day: 80% of the confirmed 15 RPM / 250,000 TPM / 500 RPD quotas.
  Input text tokens use a conservative UTF-8 byte upper bound including history,
  schemas and signatures. Provider retries are disabled; no model fallback is used.
- Counters survive restarts and are shared by all backend instances using this
  database. Quota records contain counts/timestamps/leases, never prompts or answers.
  Atomic reservations may conservatively consume an allowance if a later step fails.
  Questions admitted for processing count, including failed answers and manual retries.
- Missing/invalid/unconfirmed free-tier settings or unavailable quota storage stop
  outbound requests. Known shared daily exhaustion rejects questions before charging
  the personal allowance. A dedicated Gemini project avoids untracked usage by other
  applications sharing the same Google project.
- Daily resets follow midnight America/Los_Angeles, including daylight saving.
  The frontend displays the next reset in IST, personal remaining questions, and
  an admin-only shared usage summary via authenticated `GET /api/ai/usage`.
  A v2.2.1 welcome notice appears once per account/browser after signing in to the
  new backend version. Versioned JWT validation expires v2.2.0 sessions.
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
node scripts/check-ai-quota.mjs
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
