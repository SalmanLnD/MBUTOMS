# Changelog

All notable changes to MBU TOMS are documented here.

## [2.0.1] - 2026-08-13

Previous release: **1.1.2** (2026-07-16)

### UI and experience

- Refreshed interface with cleaner layout and easier navigation
- Dark mode with theme toggle in the top bar
- Improved text readability in dark mode across dashboard, profile, timetable, and reports
- Collapsible filter panels on mobile for easier browsing on phones
- Modern styled dropdowns across the app
- Clearer timetable cells and softer visual styling

### Classes and students (trainer view)

- Trainers and evaluators see only classes and students assigned to their timetable
- School name shown on each class row
- Filter classes by school, department, section, and semester

### Monthly test reports

- New Monthly Test Reports tab for entering and reviewing student test marks
- Subject-wise and class-wise pass summaries (50% pass threshold)
- Present/Absent (P/A) mark entry; absent students excluded from pass rate
- Download reports to Excel
- Smoother mark entry on mobile and improved mark validation

### Trainer attendance

- Monthly attendance grid with OIF, mock hours, class hours, and food allowance
- Leave count and RRD (Replacement Required Days) shown in month summary
- Sundays default to week off; manual hours for non-campus OIF numbers
- Correct hours before trainer joining date (no pre-join timetable defaults)
- Google Sheet sync keeps formatting; empty food allowance shown as none

### Leaves and replacements

- View replacement status on live venue board (trainer on leave / external cover)
- Replacement suggestions skip trainers already covering another slot that day

### Performance module (Feedback, Observations, PLP)

- Performance area split into Feedback, Observations, and PLP tabs
- Submit and view feedback forms
- Record class and demo observations with half-step ratings
- PLP scoring on 21–20 cycle with demo and class observation components
- PLP final can be set to 0 for break or long leave
- Export PLP to Google Sheets (one tab per cycle)
- Notification when an observation comment is added

### Topic tracker and venues

- Venues Live tab shows where each trainer is currently scheduled
- Topic tracker: update daily slots, view class-wise coverage, sync to Google Sheet
- Auto-filled class counts and block filter in topic tracker

### Profile

- View your CAMU ERP ID and password on your trainer profile

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
