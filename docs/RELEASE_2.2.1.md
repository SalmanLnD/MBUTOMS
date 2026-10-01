# TOMS v2.2.1

## Changes since v2.2.0

- Added Sallu, a read-only Gemini assistant with a compact mobile/desktop chat,
  avatar, rotating loading messages, thinking pose, and one-second reply animation.
- Opened Sallu to all six signed-in roles while retaining existing data permissions.
  Impersonation and required password resets remain excluded.
- Corrected weekly workload answers: Monday–Sunday IST ranges are calculated and
  summed by the backend, with daily class/cancellation/holiday explanations.
  Salman's 28 September–4 October example returns four hours.
- Added persistent limits: five questions/day and two/minute per account, one active
  question/account, and four active questions across the service.
- Added a shared free API budget: 12 Gemini calls/minute, 200,000 input tokens/minute,
  and 400 Gemini calls/day. Every model round is counted; failed provider attempts
  retain their reservation. No automatic provider retries or paid-model fallback.
- Added remaining questions, reset time in IST, exhausted-budget messages, and an
  admin shared usage summary. Daily quotas reset at midnight Pacific time.
- Added a v2.2.1 sign-in notice explaining allowances. Both packages are v2.2.1;
  previous-version sessions must sign in again.

## Validation

- 217 backend regression tests, five frontend unit tests, and production frontend build passed.
- Real MongoDB audit of concurrent admission, durable counters, rolling limits,
  and shared provider budgets in a temporary collection removed after the audit.
- 28 browser scenarios cover every role, phone/desktop layouts, release notice,
  animations, quota states, close/reopen, retries, scrolling, and dark mode.

Existing attendance, RTET, replacements, and WhatsApp bridge rules are unchanged.
Google Free-tier status is confirmed by the project owner; the application cannot
independently prevent a later billing-tier change in Google Cloud.
