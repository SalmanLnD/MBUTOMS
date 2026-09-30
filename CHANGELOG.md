# Changelog

All notable changes to MBU TOMS are documented here.

## [2.2.0] - 2026-09-30

Previous package release: **2.1.0** (`35d714b`). Frontend and backend versions are both **2.2.0**.

### Mobile-first interface

- Introduced a restrained navy and slate theme, clearer typography, simpler controls, and consistent dark-mode styling throughout the website.
- Added labeled mobile navigation and improved dashboard, trainer directory, and live-venue layouts for phones.
- Fixed page scrolling, content overlap, wide-table scrolling, and action visibility across phone, laptop, and large-screen layouts.
- Made dialogs fit the available viewport with scrollable content and accessible actions; improved dropdown positioning, keyboard focus, and nested-dialog handling.

### Live venues and replacements

- Corrected live trainer occupancy to include active replacement assignments, so the covering trainer appears in class and the original trainer's leave is respected.
- Isolated live-view date checks from shared attendance and RTET calculations, and corrected replacement availability and date sorting.
- Archived expired external replacement trainers from active screens while retaining historical records.
- Kept approved replacements editable after their leave dates end.

### Timetable and class management

- Added one-time and recurring special classes with editable details and searchable trainer, subject, class, and venue selectors.
- Allowed special classes to be excluded from RTET while still contributing to trainer workload and attendance.
- Added school selection when creating or editing classes and venue details in Google Sheets timetable exports.
- Updated coordinator observation access and corrected specific trainer/class venue assignments.

### Attendance, reports, and topic tracker

- Improved attendance cache invalidation after saves and excluded cancelled classes from class-hour calculations.
- Corrected RRD eligibility when leave days have no remaining classes; additional monthly RRD approvals default to E-Leave.
- Restored missing topic-tracker scheduled sessions and class summaries, refined hour calculations, and made topics optional for cancelled sessions.
- Improved RTET subject hours, date-column alignment, refresh error handling, and attendance-sheet date formatting.

### WhatsApp bridge and maintenance

- Improved recovery of missed punch messages, phone resolution, reconnection handling, and remote QR relinking.
- Removed unused debug scripts, one-time venue seed scripts, and unused attendance imports.
- Added frontend viewport and browser regression checks covering pages, dialogs, dropdowns, and stacked modals.

### Validation and upgrade behavior

- The interface change passed 98 screen checks, 148 modal checks, and 105 page-to-dialog checks, plus nested-dialog keyboard checks.
- Frontend unit tests, the frontend production build, and all 191 backend tests passed during release verification.
- Backend sessions include the package version. After deploying 2.2.0, users with older sessions must sign in again.

---

## [2.1.0] - 2026-09-12

### Complete interface redesign

- Reworked the TOMS visual system with a new color palette, surfaces, typography, navigation, controls, tables, calendars, forms, modals, and responsive layouts
- Made trainer timetables substantially more compact, removed unnecessary empty space, and kept each timetable within the available screen width
- Improved mobile layouts across dashboard, trainers, subjects, timetable, venues, classes and students, leaves, tickets, topic tracker, performance, and replacements
- Standardized pagination, filters, dropdowns, content padding, table density, tab navigation, and responsive action toolbars
- Preserved the TOMS name, existing content, workflows, and role-based functionality throughout the redesign

### Attendance, timetable, and RTET reliability

- Restored RTET subject-hour exports and preserved the date-column alignment required by linked-sheet formulas, beginning with 12 July
- Corrected trainer class-hour calculations so cancellations, holidays, approved leave, replacements, joining dates, and subject date ranges are applied consistently
- Prevented cancelled or replaced timetable slots from remaining in the original trainer's attendance hours
- Added reliable handling for historical IST and UTC date storage across attendance, leave, replacement, and topic-tracker reports

### Reports and operations

- Improved report caching, invalidation, concurrency limits, error handling, and request diagnostics
- Added safer Google Sheets export behavior so failed refreshes preserve existing data and report visible errors
- Improved topic-tracker backlog and class-summary loading, including subject expiry and historical closed-entry handling
- Added maintenance and report-profiling tools plus expanded project documentation

### Quality

- Added regression coverage for report reliability, RTET export dates, attendance-sheet synchronization, cancellations, replacements, and trainer class hours
- Verified the release with a successful frontend production build and all 135 backend tests passing

_Release signature: GPT-6 Astra × GPT-5.6 Sol_

---

## [2.0.1] - 2026-08-13

Previous release: **1.1.2** (2026-07-16)

### UI and experience (trainers & subject coordinators)

- Refreshed interface with cleaner layout and easier navigation
- Dark mode with theme toggle in the top bar
- Improved text readability in dark mode across dashboard, profile, timetable, and reports
- Collapsible filter panels on mobile for easier browsing on phones
- Modern styled dropdowns across the app
- Clearer timetable cells and softer visual styling

### Trainers

- **My Profile** — view your CAMU ERP ID and password on your profile page
- **Attendance** — monthly grid with OIF, mock hours, class hours, and food allowance; leave count and RRD in month summary; Sundays default to week off; correct hours before your joining date
- **Classes & Students** — see only classes and students on your timetable; school name on each class row; filter by school, department, section, and semester
- **Monthly Test Reports** — enter and review student test marks; subject-wise and class-wise pass summaries (50% threshold); P/A mark entry; download to Excel; smoother mark entry on mobile
- **Topic Tracker** — update daily slots, view class-wise coverage, sync to Google Sheet; auto-filled class counts and block filter
- **Venues Live** — see where trainers are currently scheduled and who is on leave
- **Notifications** — alert when a comment is added on your demo or class observation

### Subject coordinators

- **Subject Trainers** — browse trainers assigned to your subjects
- **Subjects** — full subject details for your allocated subjects
- **Classes & Students** — view classes and students under your subject scope; monthly test reports for those classes
- **Performance — Feedback** — summary, response logs, and monthly feedback forms for your subjects
- **Performance — Observations** — record demo and class observations with half-step ratings for trainers in your scope
- **Topic Tracker** — overview of topic coverage across trainers in your subjects; open your own tracker when linked to a trainer profile
- **Venues Live** — current venue and leave status for trainers on your timetable

### Performance and reliability

- Performance optimization for faster page loads and smoother navigation
- Database optimization for quicker lists, reports, and timetable views
- App prompts re-login after update to ensure you are on the latest version

---

## [1.1.2] - 2026-07-16

- Version bump and maintenance release

## [1.1.0] - 2026-07-15

- App update notification when a new version is deployed
- Sign in again after update to load the latest interface
