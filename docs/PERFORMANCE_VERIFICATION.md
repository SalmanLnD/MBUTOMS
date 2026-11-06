# Performance and pending-action verification

Date: 4 November 2026. Implementation and local automated verification are
complete; user acceptance is pending. These checks did not change production data.

## Attendance measurement

Compared frontend commit `2c874cd` with the updated working frontend using the
same synthetic 60-trainer × 30-day fixture, 1366 × 900 viewport, installed Chrome,
one warm-up navigation and three fresh-browser measured trials per version.
Runs were sequential; baseline/current Vite dependency caches were isolated.

| Metric | Baseline | Updated | Change |
| --- | ---: | ---: | ---: |
| Median navigation-to-rendered-grid | 4,841 ms | 2,938 ms | 39% lower |
| Median input event to two animation frames | 86.6 ms | 41.0 ms | 53% lower |
| Mounted trainer rows | 60 | 10 | All trainers remain reachable through pages/search |
| Mounted attendance inputs | 5,400 | 900 | 83% fewer |
| Initial grid requests | 2 | 1 | Identical concurrent reads coalesced |

Ready-time trials: baseline 4,901 / 4,831 / 4,841 ms; updated 3,107 / 2,938 /
2,881 ms. Raw ignored reports are `frontend/.tmp/performance-baseline-final.json`
and `frontend/.tmp/performance-current-final.json`.

These are local development fixture measurements, not production API latency,
database throughput, mobile INP, or guaranteed real-world load times. Final
draft-retention guards were separately verified functionally; this timing
fixture has no failed drafts and uses their no-op path.

## Accepted changes

- Render ten attendance trainers per page, with selectable 20/50 and roster-wide
  search. Pass row-specific pending keys so unrelated memoized rows stay stable.
- Share identical in-flight grid reads; bound caches and scope them by account/
  session. Ignore old-month and retired-session responses. Skip unchanged-cell
  writes. Queue same-cell writes while independent cells save concurrently.
- Wait for pending saves before refreshing. Preserve failed drafts separately
  from canonical server data and recompute affected totals; retry still compares
  against persisted values. Retire pending work after unmount/account changes.
- Load inactive attendance/logs/comp-off, performance and test-report tabs on
  selection. Direct PLP links do not first fetch the hidden feedback tab.
- Shared buttons/forms lock synchronously, show pending state, and protect
  keyboard submission, external submit buttons and dialog close routes.
- Serialize same-trainer full-day leave creation in a transaction before the
  active-overlap check. Atomically claim/cancel the source and insert both ranges
  for a two-range partial cancellation, preventing duplicate split records.

Raw production route-file sizes illustrate deferred code, not total transfer
size or another speed benchmark. Shared/dynamic chunks load when needed.

| Raw route chunk | Baseline | Updated |
| --- | ---: | ---: |
| Trainers | 65,044 bytes | about 10,510 bytes |
| Classes/students | 54,962 bytes | about 27,513 bytes |
| Performance | 43,683 bytes | about 2,577 bytes |

## Verification

| Check | Result |
| --- | --- |
| Complete backend suite | PASS — 370 tests, 27 suites, no failures; includes concurrently committed Pharmacy/B.Sc tests |
| Frontend unit suite | PASS — 28 tests, including queue order/recovery, invalidation races, blank attendance defaults and failed-draft merging |
| Pending-action browser checks | PASS — 5 scenarios covering repeated click/Enter/programmatic submit, errors/retry, external submit, close locks, independent actions and real leave conflict/retry |
| Attendance browser checks | PASS — 4 scenarios covering pagination/search, one initial read, no-op/duplicate blurs, independent saves, draft retention through refresh/retry, stale month and direct PLP |
| Nested dialog/dropdown Escape | PASS — 390 × 844 and 568 × 320 |
| Responsive route sweep | PASS — 98 checks, 14 routes, seven viewport sizes |
| Dialog reachability/close | PASS — 105 unique scenarios across mobile/desktop/landscape, including 3 targeted test-harness rechecks |
| Production build | PASS — latest build; development review fixtures are not production entries |
| JavaScript syntax / diff whitespace | PASS |
| Type checking / ESLint | Not configured in this JavaScript project |
| React / JavaScript / backend review | PASS after resolving reported findings |
| Manual sample preview smoke | PASS — attendance and leave load without API interception, database or production connection |
| Live functional acceptance | NOT PERFORMED — user verification requested before further push |

The full dialog run passed 102 cases; three desktop class/student/import checks
assumed desktop filters start open. The test now checks `aria-expanded`; all three
targeted reruns passed. A stale singular “Special class” locator was aligned with
the existing “Special classes” accessible label. Navigation now waits for DOM
content instead of unrelated full page completion. Consolidated local evidence:
`frontend/.tmp/verification-dialogs.json`.

Backend transaction concurrency tests use a transaction/snapshot retry model and
mocked models, not a live MongoDB load test. Existing live duplicate leaves were
not automatically deleted. Button locking does not imply universal server-side
idempotency for every endpoint.

## Reproduce

From `frontend`, install Playwright in a disposable directory if necessary:

```powershell
npm install --prefix .tmp/browser-check --no-package-lock --no-save playwright
$env:PLAYWRIGHT_MODULE_PATH = (Resolve-Path '.tmp/browser-check/node_modules/playwright/index.mjs').Path
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:RESPONSIVE_BASE_URL = 'http://127.0.0.1:5176'
```

Start Vite on localhost port 5176, then run these suites sequentially:

```powershell
npm test
npm run build
npm run test:pending-actions
npm run test:attendance-actions
npm run test:modal-stack
npm run test:responsive
npm run test:page-dialogs
npm run test:performance
```

Run backend tests from `backend` with `npm test`. Heavy browser suites should run
sequentially to avoid resource contention. A focused dialog recheck can set
`PAGE_DIALOG_CASES` (zero-based comma-separated indexes) and `PAGE_DIALOG_WIDTHS`.

## User review and publication state

Open `http://127.0.0.1:5178/trainers?tab=attendance` and
`http://127.0.0.1:5178/leaves` while the sample preview runs. Try trainer pages,
search, a changed/unchanged attendance field, and repeated leave clicks during
the deliberate 1.5-second save delay. Sample edits live only in memory and
disappear when the sample API restarts.

A separate process included and pushed most earlier changes in `02bfd3a` while
this chat was verifying them. This chat did not initiate that push. Remaining
working changes, review tools/reports and HRMS plan await user verification.
