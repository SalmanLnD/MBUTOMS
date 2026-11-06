# Page responsiveness and request safety

Status: implementation and automated local verification complete; user review
is pending. Results are in `PERFORMANCE_VERIFICATION.md`. A separate workspace
process included most of this batch in commit
`02bfd3a` on `origin/main` while verification was running. This chat did not push
that commit. Remaining changes will wait for the user's review before any push.

## Baseline and acceptance gates

- Compare the committed frontend with this working version using the same
  Playwright fixture: 60 trainers × 30 attendance days, 1366 × 900 viewport, three
  fresh-browser trials. Measure time to rendered grid, mounted inputs/rows, edit
  to two animation frames, and number of grid requests.
- Budget: three focused performance change groups, at most two after-comparison
  runs with three measured trials each, up to 20 minutes of benchmark runtime,
  local synthetic data only, and no external spend, production writes, new hosted
  resources, or data cleanup.
- Gates: no duplicate writes on double-click/Enter; preserve form drafts on
  failure; release loading states on error; keep independent attendance saves
  independent and serialize writes to the same cell; reject overlapping active
  leaves at the server, including concurrent submissions.
- Re-run frontend tests, relevant backend tests, production build, route/dialog
  browser checks and slow-response interaction tests. Local fixture timings do
  not measure production database latency, Render cold starts, or mobile CPUs.

## Plan before performance edits

| Priority | Evidence / target | Change | Correctness check |
| --- | --- | --- | --- |
| 1 | Attendance mounts every trainer × every day; a global pending Set changes every row's props | Render ten trainers per page (search still covers all); pass row-specific pending keys so unaffected memoized rows stay stable | All rows reachable with pagination/search; complete month and totals retained |
| 1 | Attendance blur saves even unchanged values; grid requests have no in-flight coalescing or stale-month guard | Skip unchanged cell writes, coalesce identical reads, scope cache to current session, ignore old-month responses | Changed values save; queued values survive; rapid month changes show selected month |
| 2 | Trainers, performance, and classes route bundles eagerly import inactive heavy tabs; performance query-tab starts by mounting default feedback | Lazy-load inactive heavy tabs under local Suspense; initialize performance tab from URL | Direct tab links do not fetch another tab; every tab still opens |
| Shared | Many mutation buttons have no immediate pending feedback; asynchronous callbacks drop promises | Shared AsyncButton/AsyncForm, dialog close lock, per-resource pending state, backend leave conflict transaction | Delayed-response browser tests including success, error, keyboard, and external submit buttons |

## Route audit coverage

| Page / area | Existing behavior and planned treatment |
| --- | --- |
| Dashboard | Independent stat request; routes already lazy. Preserve chart/data rules; test navigation and load. |
| Trainers / directory / profile | Directory search debounced, fetch aborts and pagination present. Defer inactive attendance/logs/comp-off tabs; profile actions use pending controls. |
| Trainer attendance | Primary measured target above; preserve date rules, full-screen mode, totals and per-cell queue. |
| Trainer schedule | Route lazy, scoped schedule load; protect refresh/action buttons and verify route. |
| Classes / students / test reports | Reference requests already parallel. Defer test-report bundle; retain paginated student search/import and protected submit controls. |
| Subjects | Debounced, paginated, abortable list; protect topic/resource saves and deletion. |
| Timetable | Board/reference requests already parallel and grid memoized. Preserve those; protect save/cancel/import/sheet actions. |
| Venues | Room data fetched only on room tab; preserve live-tab polling behavior; protect modal actions. |
| Leaves | Add immediate form and row feedback plus transactional backend duplicate protection. No automatic live deletion of existing duplicates. |
| Replacements | Block competing assignments to the same selection; ignore stale suggestions after selection/close; show pending feedback. |
| Tickets | Protect create/update forms and confirmation; await post-save list refresh using the intended page. |
| Topic tracker | Protect submits/sheet sync; await refresh; retain per-session pending sets. |
| Performance / feedback / observations / compliance / PLP | Defer inactive tabs; fix URL-tab initial fetch; isolate per-row pending state. Historical PLP rules unchanged. |
| Photo punch | Preserve explicit GPS/camera state machine and existing busy guards; verify no duplicate capture/submit. |
| Public feedback / sign-in / password reset | Protect submissions and preserve session-cookie validation; verify public route and session flows. |
| Shared navigation / notifications / devices / assistant | Keep synchronous navigation interactive; async operations expose loading; dialog Escape/backdrop cannot dismiss active submission. |

## User verification before push

Review the local preview: apply leave once under delay, retry a rejected request,
edit attendance and move between trainer pages/months, search for a trainer beyond
the first page, open direct PLP/attendance links, and exercise an import/sync
confirmation. Ask for approval after automated checks finish. Push only after
that approval.

## Rollback

All changes are source changes in the current working tree. Attendance pagination,
request optimizations, and lazy tabs are independently reversible. No production
configuration or records need reverting for this local batch.
