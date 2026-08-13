# Changelog

All notable changes to MBU TOMS are documented here.

## [2.0.1] - 2026-08-13

Previous release: **1.1.2** (2026-07-16)

### UI and experience

- Claymorphism / bento spatial UI redesign across admin and trainer pages
- Dark mode with persistent theme toggle in the top bar
- Semantic theme color variables for readable text in light and dark modes
- Collapsible filter panels on mobile across major list pages
- Styled single- and multi-select dropdowns replacing native selects app-wide
- Softer card shadows and improved timetable cell contrast
- Fixed styled-select chevron alignment in production builds

### Students and classes

- Student bulk upload from Excel/CSV with template download
- Chunked bulk import with progress bar (fixes production timeouts and CORS)
- School filter on Classes and Students tabs; school shown on each class row
- Passed-out year and semester on student list and bulk upload
- Semester-aware student counts (fixes III-sem uploads inflating V-sem classes)
- Trainers/evaluators see only timetable-allocated classes and students

### Monthly test reports

- Replaced student attendance tab with Monthly Test Reports for trainers
- Subject-wise and class-wise summaries with pass threshold (50%)
- P/A attendance in mark entry; absentees excluded from pass rates
- Excel export and Google Sheets sync with per-month tabs
- Mark entry scroll stability, whole-number validation, and decimal rounding fixes

### Trainer attendance

- Leave count and RRD (Replacement Required Days) in month totals
- Sunday defaults to W.O; manual class hours for non-campus OIF numbers
- Pre-join attendance defaults (0 hours before trainer joining date)
- Cancelled-session approval queue deducts trainer attendance hours
- Google Sheet sync: master tab formatting preserved; food allowance exports as none
- External replacement trainers supported in replacement workflow

### Leaves and replacements

- Trainer resignation and permanent replacement workflows
- Cancel replacement restores original trainer on the affected slot
- Remove/cancel replacement option on the replacement register
- Assign replacements for completed leave days and past slot dates
- Deduped replacement schedule entries (fixes triple-counted class hours)
- Replacement suggestions exclude trainers already covering overlapping slots
- Live venues show trainers on leave as unavailable and external cover trainers

### Performance module

- Restructured into Feedback, Observations, PLP, and Compliance tabs
- Evaluator role with PLP/compliance scoring
- PLP tracked on 21–20 cycle with demo and class observations
- Half-step observation ratings; PLP final can be 0 for break/long leave
- PLP Google Sheet export: one tab per cycle with formatted headers
- Observation notifications with class slot details; coordinator/evaluator access fixes
- PLP and Compliance limited to full-access staff; Feedback available to coordinators

### Topic tracker and venues

- Venues Live tab with trainer-wise current venue from schedule
- Topic tracker Google Sheet: master tab plus one tab per trainer
- Auto-filled class counts; block filter; external live trainer listing
- III-sem venue updates for assigned trainers

### Trainer profile and access

- CAMU ERP credentials on trainer profile (user sees own password)
- Session bound to app version — users re-login after deploy to load latest UI

### Backend and deployment

- Optimized read APIs; removed obsolete one-off maintenance scripts
- Coordinator/evaluator role sync on serverless cold starts
- GitHub Actions CI plus Vercel production deploy on push to `main`

---

## [1.1.2] - 2026-07-16

- Version bump and maintenance release

## [1.1.0] - 2026-07-15

- Session tokens bound to deployed app version
- Forced re-login prompt when app version changes (`APP_VERSION_UPDATED`)
