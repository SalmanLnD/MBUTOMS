# Changelog

All notable changes to MBU TOMS are documented here.

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
