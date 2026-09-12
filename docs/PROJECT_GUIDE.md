# MBUTOMS project guide

Reviewed for the 2026-09-12 release (package version 2.1.0).

## Review scope and baseline

This is a source-level onboarding review of the application structure, route surface, models, principal workflows, authentication, integrations, deployment configuration, and existing tests. It is not a claim that every line or every live user journey has been verified. Production services, MongoDB contents, external Sheets, and the WhatsApp session were not exercised. The historical Word architecture document and source workbook were not validated against current data.

- Frontend: `npm run build` passed, transforming 250 modules. The initial attempt encountered EPERM while replacing `dist/assets`; the permitted retry succeeded.
- Backend: `npm test` ran 128 tests: 126 passed, 2 failed, no skipped tests.
- Local Node version: v24.10.0; repository CI uses Node 20.
- No application logic was changed. This guide records findings for subsequent work.
- Repository root is `training-management-system`, inside the outer `E:\MBU_FACE` workspace.

## Architecture

| Layer | Implementation | Main entry points |
|---|---|---|
| Browser application | React 18, Vite 5, React Router 6, Axios, Bootstrap, Chart.js, FullCalendar, React Virtuoso | `frontend/src/main.jsx`, `App.jsx` |
| HTTP API | Express 4, ES modules, express-validator, JWT, bcryptjs | `backend/server.js`, `app.js`, `routes/` |
| Persistence | Mongoose 8 / MongoDB; models, indexes and business utilities | `backend/models/`, `config/db.js`, `utils/` |
| Reports | ExcelJS exports and Google Apps Script polling protected export endpoints | `backend/services/*SheetsService.js`, `templates/*.gs` |
| Punch-in bridge | whatsapp-web.js, optional Tesseract OCR, Axios, persistent browser session | `whatsapp-bridge/index.js` |
| Deployment | Render frontend/API, documented EC2 + PM2 bridge, external Atlas database; additional Vercel workflow | `render.yaml`, `.github/workflows/`, `DEPLOYMENT.md` |

Typical request path: React page/component -> feature service -> shared Axios client -> Express router -> authentication/authorization/validation -> controller -> utilities and Mongoose -> JSON -> component state. Many business rules live in `backend/utils`, rather than in a separate service layer. Sheet services primarily handle integration configuration and exports.

## Frontend structure

`main.jsx` composes BrowserRouter, AuthProvider, ThemeProvider, LoginModalProvider and toast notifications. Bootstrap loads before the application theme styles. `App.jsx` lazy-loads pages. `MainLayout` supplies the sidebar, topbar, mobile navigation and password-reset modal. The timetable has optional authentication; `/f/:slug` is public feedback.

State is mostly local React state plus context for authentication/theme/modal/page title. Feature services encapsulate API calls. Larger grids use memoization, request cancellation, batching or virtualization. Attendance also has a module-level response cache. Changes to login/impersonation need to account for caches, not just context.

Shared UI foundations: `components/Modal.jsx`, styled selects, pagination, filter panels, `styles/theme.css`, `styles/global.css`, `styles/clay-bento.css`, and layout/mobile styles. Existing cleanup utilities manage modal overlays/body locks during navigation and hot reload.

## Main modules and change locations

| Feature | UI | Backend and related rules |
|---|---|---|
| Authentication / impersonation | AuthContext, LoginModal, ResetPasswordModal, ProtectedRoute | authController, middleware/auth, User, sessionVersion, roles |
| Trainers / employment / handover | Trainers, TrainerDetailsPanel, TrainerFormModal, TrainerRoleTransferModal | trainerController, trainerTransferController, Trainer, trainerUserSync, trainerPermanentTransfer |
| Subjects / resources / topic catalogs | Subjects, SubjectFormModal, SubjectTopicsModal | subjectController, Subject, subjectStartDate, subjectSlotTimings, topic catalogs |
| Timetable / live venues | Timetable, TrainerSchedule, TrainerTimetableGrid, VenueLiveTab | scheduleController, Schedule, trainerMappings, trainerScheduleView, timetableBoard, liveTrainerVenues |
| Attendance / punch logs / holidays | TrainerAttendanceTab, TrainerAttendanceRow, TrainerPunchInLogsTab | trainerAttendanceController, TrainerDailyAttendance, trainerClassHoursBatch, attendanceOifRules, officialHolidays |
| Leave / comp-off | Leaves, CompOffsTab | leaveController, compOffController, Leave, CompOff, leaveDateRange, leaveRangeSplit, leaveScope |
| Temporary replacements | Replacements, AddSlotReplacementModal, TrainerAvailabilityPanel | replacementController, trainerAvailability, replacementSlotConflicts, leaveReplacements |
| Classes / students / import | ClassesStudents, StudentBulkUploadModal | classController, studentController, ClassGroup, Student, studentBulkImport, trainerClassAccess |
| Monthly test reports | StudentMonthlyTestReportsTab | studentTestReportController, StudentMonthlyTestReport, studentTestReportExport/constants |
| Topic coverage / backlog / cancellations | TopicTracker, TopicTrackerSpreadsheet and related tabs | topicTrackerController, TopicTrackerEntry, topicTrackerSessions, classCancellationController |
| Performance / feedback / observations / PLP | Performance, FeedbackSection, ObservationsTab, ComplianceTab, PlpTab | feedbackController, observationController, complianceController, plpController, plpScoring, plpCycles |
| Tickets / notifications | Tickets, NotificationBell | ticketController, notificationController, Ticket, Notification, feature notification utilities |
| Google Sheets | feature SheetSetupModal components | corresponding Sheets controller/service, export-auth middleware, Apps Script template |

## Data relationships and invariants

- `User` is the login/access identity; `Trainer` is the operational/personnel identity. They are linked but are separate documents. Users can also carry coordinator/evaluator subject scopes.
- Schedules recur by weekday and start/end time. They refer to trainers by `trainerCode`, not a Trainer ObjectId. `employeeId` and legacy `scheduleTrainerCodes` must be resolved consistently using trainer mapping utilities.
- Schedule subjects and venues are references; class identity commonly uses department + section + semester strings. ClassGroup has a unique compound identity; student access expands combined departments and normalizes semester labels.
- Trainer/subject eligibility is represented on both Trainer.subjects and Subject.trainerEligible. Use synchronization helpers when changing assignments.
- `TrainerDailyAttendance` is unique by trainer/date. The older `Attendance` model is separate and supports trainer/student records.
- Leave stores affected schedules and embedded replacement assignments. Temporary replacements overlay the base timetable; permanent handover changes ownership/links.
- TopicTrackerEntry is unique by schedule/date and holds session, topic, attendance and review state. An approved cancellation can create a ClassCancellation and change computed attendance hours.
- StudentMonthlyTestReport is unique by month/student/subject. It stores class/subject snapshot fields along with marks and P/A attendance.
- AppSetting stores integration links/export keys and other configurable values.
- Operational date handling is IST-sensitive. Historical leave rows contain both IST-midnight and UTC-midnight representations; use existing date-window helpers when querying ranges.

## Cross-feature workflows

### Attendance

The monthly grid combines the trainer roster, joining/exit dates, daily punch/manual logs, recurring schedule hours, approved leave, replacements, holidays, cancellations and OIF rules. It computes class hours across all semesters even when the displayed grid defaults to semester III. Backend grid cache TTL is 150 seconds; frontend grid TTL is 60 seconds. Sheet exports have a separate cache.

### Leave and replacement

Leave creation resolves affected schedule occurrences. Full-day leave and slot-only replacement requests have distinct scope rules. Cancellation/holidays reduce effective occurrences. Replacement candidates are checked for owned and replacement slot conflicts and leave; suggestions prioritize eligibility, lower workload and higher performance. Partial cancellation may split a leave into retained ranges. Changes can affect notifications, attendance and coverage reports.

### Topic tracker

Sessions derive from schedules and dates. Updates check session edit rights, approved topic catalogs, session status and existing closed entries. Replacements can be authorized to edit their covered session. Cancellation review links topic tracking to ClassCancellation, which changes attendance hours.

### Performance

Feedback forms can be published for public responses; staff see summaries and response logs. Observations are scoped by evaluator permissions. PLP combines feedback, class observation, demo observation, attendance and compliance with default weights 30/25/20/15/10. Cycles run from the 21st through the following 20th. The displayed final score rounds to half points and clamps to 3.5–4.5; missing components count as zero in the raw weighted calculation.

### WhatsApp

The bridge reads configured group images, extracts OIF from captions or optional OCR, resolves sender/time, and calls the secret-protected punch webhook. It keeps processed IDs on disk, guards in-flight IDs, reconnects/watchdogs, and polls queued catch-up jobs. The API maps phone numbers to trainers and upserts daily attendance. An existing first punch time is retained, while subsequent messages can update OIF metadata. Do not start the bridge just to inspect its code: startup activates external processing.

### Sheets

The API generates Apps Script from repository templates with export URL/key substitutions. Apps Script runs on Google servers and pulls exports; linking a spreadsheet saves metadata in MongoDB. Export endpoints use feature-specific keys instead of a browser JWT. A public API URL is required for this flow.

## Authentication and access

JWT verification checks app version, user active status and session version. The frontend persists the token/user in localStorage and revalidates on focus and periodically. App version changes intentionally expire sessions. Impersonation stores the originating identity in the token and blocks some administrative routes.

Roles are admin, manager, campus_manager, subject_coordinator, evaluator and trainer. `authorize` aliases several roles, including campus_manager and subject_coordinator; `authorizeExact` does not. Controller scope checks are therefore as important as route middleware. Full-access arrays and exact-role checks intentionally differ for attendance editing, PLP, leave approval and other operations. Do not infer permission from a navigation item alone.

## Findings to carry into future work

These findings are based on local source and offline verification, not live exploit testing. No fixes were applied.

1. **Failing OIF business-rule tests.** `attendanceOifRules.test.js` expects bare `CA26421` to behave as internal training: no OIF day, no manual class hours, zero class handling. `isItOif` recognizes only strings beginning with `IT`; only mock-hour calculation special-cases bare CA26421. This explains both failed tests. Confirm the intended business rule before changing code or expectations.
2. **Legacy attendance record access is broad.** `routes/attendanceRoutes.js` allows trainer-role POST/PUT requests; `attendanceController.js` accepts target identities and updates a record by ID without checking ownership/class scope. GET also lacks user scope. This differs from the newer daily grid/controller and warrants a focused access-control fix.
3. **Unprotected debug route.** `app.js` registers `/api/debug/class-hours` without `protect` or authorization. It accepts a trainer ID/date and queries calculated hours. Remove it or apply explicit access restrictions.
4. **Attendance cache scope can collide.** Backend `buildAttendanceGridCacheKey` uses `all` for trainer-like users lacking a linked trainer, while the subsequent query would return no trainers. If a matching full-access cache entry is warm, the cache lookup happens before that filtering. Frontend attendance cache keys also omit account/session identity, and AuthContext does not clear that cache on session transitions. Both need explicit role/session scoping and regression coverage.
5. **Subject end-date behavior is inconsistent.** `activeSchedulesForDate.filterSchedulesActiveOnDate` checks start dates only, whereas `trainerClassHoursBatch` checks both start and end. The former feeds dashboard and class cancellation options, so expired subjects can remain active in those views.
6. **Startup performs mutations even with RUN_STARTUP_SYNC=false.** `runEssentialStartup` invokes migrations, reference seeding, role sync, holiday initialization and `removeAllPedhData`. The latter deletes matching schedules/attendance/placeholder trainer-related data. The flag only disables the additional full startup block. Even `connectDB({runStartup:false})` can perform role sync once.
7. **Automatic request retries include writes.** `frontend/src/services/api.js` retries transient/network failures up to three times without restricting the HTTP method. A successful create with a lost response can be replayed; create endpoints such as legacy attendance have no request-level idempotency key.
8. **Relocation status/schema mismatch.** Transfer logic writes `employmentStatus: 'relocated'`, but Trainer's enum contains only active/resigned. Update operations without validators can store the value; later document validation can reject it.
9. **Coordinator access differs from release-note wording.** `trainerClassAccess.canViewAllClasses` explicitly grants coordinators all-class access. Classes/students/test reports use these helpers, whereas CHANGELOG describes subject-scoped access. Resolve the intended policy before changing it.
10. **CI does not run the backend test suite.** `ci.yml` builds the frontend but only syntax-checks `server.js` for the backend. The two known test failures therefore are not caught by that workflow. No frontend test/lint script is declared.

Additional maintenance considerations: cache invalidation differs between grid and export paths; schedule CRUD does not explicitly invalidate the attendance grid; key business constants/catalogs and academic windows are embedded in code; large controllers and React components concentrate several responsibilities; permanent handover performs multiple related writes without a transaction in the reviewed function; the bridge manifest follows an upstream GitHub main branch. README still lists already-implemented features as upcoming. Deployment documentation/configuration should be treated as intended setup, not proof of live hosting state.

## Working approach

For a feature change, trace page -> frontend service -> API route/middleware -> controller -> utilities/models, then identify downstream attendance, replacement, topic tracker, export and notification effects. Reuse existing date, role and trainer-code helpers. Verify ordinary trainers, coordinators/evaluators and full-access users separately where permission behavior changes.

Use `npm test` from backend and `npm run build` from frontend as the current offline baseline. Target the relevant unit tests while retaining awareness of the two pre-existing failures. Database integrity/import/seed scripts require a reviewed target database; do not assume scripts named verify are read-only. Browser journeys, database integration and external automations still need a dedicated test environment for full end-to-end validation.
