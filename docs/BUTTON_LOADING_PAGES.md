# Page action loading audit

Date: 4 November 2026. Scope: every page in `frontend/src/pages`, excluding
`Leaves.jsx` (covered by the leave submission fix). Component-owned dialogs,
tables, sheets, confirmations, navigation and autosaves are audited separately.

## Shared state and action sequence

- `AuthContext.applySession` writes cached user data and React user state;
  logout clears both. Login forms await the session verification before routing.
- `ActionCountsContext.refreshActionCounts` dispatches a counts reload; it does
  not reset page forms or release their pending action.
- `LoginModalContext.closeLoginModal` clears its modal/redirect state only.
- Assistant open/close and usage state are independent of page submissions.
- Page save handlers own their API mutation, success state and awaited list
  reload. A failure displays the existing error and leaves input available for
  correction after the shared action lock releases.

Promise-returning page actions now pass through `AsyncButton` or `AsyncForm`.
The shared controls provide synchronous re-entry protection and pending UI;
forms also cover keyboard submission. Synchronous tab/filter/modal-open
buttons retain their normal behavior. Mutations in confirmation dialogs use
the shared protected `ConfirmModal`, and row icons use `ActionIconButton`.

## Inventory

| Page | Shared buttons / forms | API touchpoints and result |
| --- | --- | --- |
| ClassesStudents | 6 / 0 | Class/student delete confirmations; add/edit/import callbacks now await student/class/department reloads. Tab, sort, filter and open-dialog buttons are synchronous. |
| Dashboard | 0 / 0 | Read-only initial stats loading already displays `LoadingSpinner`; no page buttons initiate writes. |
| Login | 1 / 1 | Login submit keeps existing signing-in text; shared form locks click and Enter until verified login completes. |
| Performance | 1 / 0 | Tab changes only; writes live in component-owned tabs. |
| PhotoPunch | 6 / 0 | Camera/location, capture, submit and retake return their full promise. Existing page-wide `busy` state remains; shared buttons also prevent same-tick re-entry. |
| PublicFeedbackForm | 1 / 1 | Submit validates answers and awaits posting before success screen; keyboard and mouse duplicates blocked while pending. |
| Replacements | 15 / 0 | Bulk trainer lookup, suggestion lookup, bulk assignment, internal/external assignment and cancel confirmations. Refreshes are awaited. Internal/external assignment additionally share a synchronous ref lock. |
| Subjects | 12 / 0 | Delete confirmation and resource-link mutation return promises. Save callback awaits reload; topic save applies the returned subject synchronously. Resource opening is ordinary external navigation. |
| Tickets | 9 / 2 | Create and status-update forms had no pending UI. Shared forms now lock fields and submit buttons; successful changes await reload. Creation explicitly reloads page 1. |
| Timetable | 4 / 0 | Toolbar actions open component-owned dialogs. Existing save callbacks await timetable reload. |
| TopicTracker | 10 / 0 | Retry returns overview request promise. Spreadsheet-close overview refresh and sheet-link status refresh now return promises instead of detached work. Request generation already protects overview reads. |
| TrainerProfile | 0 / 0 | Back link is navigation; actions are owned by `TrainerDetailsPanel`. |
| Trainers | 10 / 0 | Password-reset/delete confirmations await API; delete and edit-save callbacks now await list refresh. Tabs, sorting and dialog opening are synchronous. |
| TrainerSchedule | 2 / 0 | View toggles only; initial schedule/profile/subject reads already show a page spinner. |
| Venues | 3 / 0 | Delete confirmation and add/edit completion now await venue refresh. Tabs and view-dialog opening are synchronous. |

Total page migrations: 80 buttons and 4 forms across 13 files. No native
`button` or `form` tags remain in this audited page scope; visual controls still
render as native HTML through the shared components.

## Additional races corrected

1. **Replacement assignments on different controls:** individual Assign buttons
   could target the same slot concurrently, and an external assignment could
   race an internal one. `assignmentInFlight` locks immediately, `assigning`
   disables all choices and the external-name input, and close is ignored until
   the mutation settles. Success resets the modal and awaits the register reload.
2. **Out-of-order replacement suggestions:** a late response could overwrite
   the suggestions for a later-selected slot, or repopulate a closed dialog.
   Each lookup captures a request generation; reset/close invalidates it, and
   only the latest generation updates suggestions, errors and loading state.
3. **Detached post-save refreshes:** several mutation handlers completed before
   their register reload. Their returned promises now include the reload (or
   parallel independent reloads) so callers can retain pending state correctly.
4. **Ticket page reset:** create previously set page 1 but immediately fetched
   the old closure's page. Its explicit reload uses page 1, matching the effect
   triggered by pagination state.

## Validation and limits

Static audit checked each page's `onClick`, `onSubmit`, `onConfirm`, `onSaved`,
`onImported`, `onLinked`, `onClose` completion callback and API handler. Existing
per-action errors and success messages remain. Delayed API browser verification
of the shared controls and backend leave concurrency checks are tracked with
the overall fix's verification results.
The page audit alone does not claim server-side idempotency for every endpoint,
or automatic repair of existing duplicate leave records.
