# Academic year and semester migration plan

Status: proposed for review; no application or database changes applied.

## 1. Required behavior

- Hierarchy: academic year (initially **2026-2027**) → academic term (**Odd** or **Even**) → teaching data. Student semester numbers I–VIII are a different concept.
- Initial published term: **2026-2027 / Odd**. Preserve all existing teaching data there, subject to the migration audit below.
- Admin can privately switch the viewed year/term without changing anyone else's view or promoting students.
- A separate admin publication action establishes the current term for everyone. Trainer screens retain their existing layout and automatically load that published term.
- Preserve previous-term students, classes, assignments, calendars, marks and tracker history.
- Keep trainer directory, punch-in, venues, leave, performance and replacement operations shared across terms.
- Department changes, including bulk upload, retain student identity, marks, attendance and other history.

## 2. Existing-code findings

- `backend/models/Semester.js` is a numbered student semester tied to an academic year. Do not redefine it as Odd/Even.
- `Student.js` stores one current branch/section/semester, with globally unique roll number; it cannot represent historical enrolments.
- `ClassGroup.js` has a department/section/semester unique index; `Subject.js` has globally unique code. Both need partition-aware uniqueness. Class uniqueness must also include passing year to avoid cohort collisions.
- `StudentMonthlyTestReport.js` already links reports to student IDs. `studentBulkImport.js` updates students by roll number using `$set`; it does not directly delete reports. However, `studentTestReportController.js` fetches reports by department/section/semester, which can hide existing marks after transfers. This is an evidenced failure path, not proof that every reported loss has that cause.
- `studentTestReportExport.js` contains fixed August–October 2026 summary columns; report date utilities also have a fixed tracking start. These need term-based periods.
- `frontend/src/components/Topbar.jsx` has a fixed Google Drive Academic Calendars link.
- `backend/config/db.js` uses one global Mongoose connection and automatic reference/sync jobs. `seedReferenceData.js` defaults to 2025-2026 and resets semester active flags. Startup behavior must not overwrite publication or archived data.

## 3. Data ownership

| Shared operational database | Semester partition |
| --- | --- |
| AcademicYear, AcademicTerm registry and publication state | Subject offerings and trainer-subject/coordinator/evaluator assignments |
| User/authentication, Trainer directory and employment details | Classes and student enrolment snapshots |
| Stable Student identity and roll number | Monthly test reports, marks and term-specific student records |
| Schools, departments, venues and shared reference catalogs | Topic tracker and teaching timetable/schedules |
| Punch-in, leave, comp-off, performance, replacements | Academic calendar configuration and term-specific sheet integrations |
| Audit log, migration/publication jobs, storage registry | Teaching cancellations and term-specific teaching evidence |

Timetable schedules must follow the selected term because they depend on its subjects/classes. Replacement and performance screens remain shared; their references to teaching records carry the originating term ID and immutable descriptive snapshots. Do not redirect old operational records to new subjects or schedules. The implementation audit will classify attendance/feedback and other mixed records by purpose: operational records stay shared, teaching detail is partitioned or carries explicit term provenance.

Trainer identities remain shared. Move their term-specific subject lists and any subject-based authorization out of global Trainer/User arrays into term assignments. Login role remains shared; access to a particular offering is evaluated in its term.

## 4. Schema and storage boundary

Introduce:

- `AcademicTerm`: year ID, `odd|even`, stable key such as `2026-2027-odd`, dates, predecessor ID, lifecycle, readiness and calendar configuration. Unique `(academicYearId, parity)`.
- Singleton publication state: `currentTermId`, monotonic `revision`, publisher and timestamp. This is the only authority for the published current term; avoid independent active flags.
- Shared `Student` identity with stable `_id`, roll number and basic profile. Existing IDs must survive migration.
- `StudentEnrollment`: term ID, student ID, department, section, numbered semester, passing year, status and promotion provenance. Unique `(termId, studentId)`.
- Term storage registry: term ID → storage key/connection alias and migration state. Actual URIs live in environment/secret configuration, never in browser state or API responses.
- Publication/migration job records with idempotency keys, checkpoints, counts and audit results.

Initially keep term collections in the existing MongoDB database with mandatory `termId` fields and compound indexes. All term data access goes through `getTermRepositories(termContext)` and a connection/model factory. No unscoped default-model imports in term controllers, jobs, exports, seeds or integrations. Repository methods enforce term filters for reads, aggregates, updates, deletes, counts and bulk writes; validators also check referenced records belong to that term.

Preserve partition-local ObjectIds during copying. Use scalar shared IDs across databases and explicit shared lookups; do not depend on cross-database `populate`, `$lookup`, foreign-key assumptions or cross-database transactions. Shared operational references use `(termId, recordId)` plus snapshots. Historical enrolment placement comes from enrolments, not the mutable shared student profile.

Index examples: subject `(termId, code)`; class `(termId, department, section, py, currentSemester)`; enrolment `(termId, studentId)`; report `(termId, month, studentId, subjectId)`; tracker `(termId, scheduleId, date)`. Add matching compound filter indexes after checking actual query plans. Build replacement indexes and validate duplicates before removing old global unique indexes.

## 5. UI

Admin header on academic screens:

`Viewing: [2026-2027 ▼] [Odd ▼]   Published current: 2026-2027 / Odd`

- Selecting a year/term changes only this admin's academic workspace. Persist the choice per user and browser tab (session storage), with an explicit **Return to current semester** button.
- Historical view shows an **Archived semester · read only** banner. Draft view shows **Draft · visible only to admins**. Shared operational screens state that they cover all semesters and ignore the academic selector.
- Put **Manage academic years & semesters** in admin settings. It lists Odd/Even rows, dates, calendar, preparation status, storage status and current badge. Separate actions: **View**, **Prepare next semester**, **Publish as current**. Selection never publishes.
- Preparation preview shows promotion counts, invalid records, students completing a program, assignments/classes to copy and items requiring setup. Existing target data is preserved and conflicts are explicit.
- Publication review shows source/target, promotion summary, calendar and readiness checks, with explicit confirmation. Disable duplicate submission; display recoverable job status after reconnect/reload.
- Trainer navigation and layout stay unchanged. Resolve current term on login, navigation, window focus and a small publication-state poll while active. If it changes during editing, preserve unsaved input locally and require reload before submitting; server rejects stale writes. Clear old data immediately when switching, cancel in-flight requests and key all caches by term/revision.
- Keep the existing Academic Calendars button under Timetable; source its link from the viewed term. Admin settings allow one default link and optionally labeled links per school/program, using the existing browser-link behavior. Missing configuration shows an explicit empty state, never another term's calendar.

Only admins get private historical/draft selection initially. Trainers follow the published term; URL/header manipulation does not grant historical or draft access. Public timetable follows published state too.

## 6. Promotion and publication

Normal sequence: `2026-2027 Odd → 2026-2027 Even → 2027-2028 Odd`.

1. Prepare a target draft using a fixed predecessor and preparation job. Create target enrolments by stable student ID: I→II, III→IV, V→VI, VII→VIII for Odd→Even; II→III, IV→V, VI→VII for Even→next Odd.
2. Never mutate the source enrolments or copy marks into the target. A new term starts with empty marks and tracker entries; past marks remain available in history. Student identity carries forward.
3. Use program duration/completion metadata to graduate final-semester students. Support shorter programs; do not assume every student has eight semesters. Block ambiguous completion rules and invalid semester/parity combinations with an actionable preview.
4. Skip inactive/withdrawn/graduated students by default. New admissions are added explicitly; no automatic I-semester admissions are invented. Preserve passing year and department/section unless admin deliberately maps them.
5. Preview and prepare promoted classes. Subjects, syllabus, trainer assignments and schedules may be copied as explicit templates; require review of semester mapping, dates, references and collisions. Calendars must be configured/reviewed. Do not blindly promote schedule labels or carry topic completion into the target.
6. Prepared enrolments become active only when the target is published. Before publication, reconcile source changes since preparation and flag target edits/conflicts; publication readiness is invalidated when relevant data changes.
7. Publish only the immediate next term after readiness validation. Acquire an idempotent publication job/lease, seal the prepared target manifest, then atomically compare-and-swap the shared current-term pointer/revision. Until that final pointer change, everyone continues using the source.
8. A retry resumes preparation or returns the completed publication; it never increments semesters twice. Concurrent admins get a conflict on an outdated revision. Archived terms cannot be republished through the ordinary Publish action. A later corrective rollback is an audited pointer operation, not another promotion.

Require server-validated expected current term/revision on academic writes. Reject stale submissions with a clear reload message. Revalidate publication at write commit; serialize or fence publication against in-flight academic writes so an old-term write cannot slip through the cutover. After future database separation, this protocol must not depend on distributed transactions.

## 7. Department transfer fix (independent first slice)

- Reproduce bulk transfer with marked reports and inspect DB records to distinguish hidden reports from deletion. Preserve `_id` and roll-number identity for both manual edits and upload updates; never delete/reinsert to transfer a student.
- Validate bulk input before writing: duplicate/conflicting roll numbers, explicit field presence, invalid department/section and unauthorized changes. Omitted fields must not clear existing information or reset status.
- Read a selected class roster from its enrolments, then retrieve each student's marks by stable `(termId, month, studentId, subjectId)`, without filtering them out by the student's previous department/section. Keep authorization against the current permitted roster and subject.
- Preserve assessment-time department/section metadata for historical reporting. Transfers do not silently rewrite that history. A student history view includes prior subjects/marks even when the new department teaches different subjects; those marks remain attached to the original subject and are not reassigned to a different subject.
- Make exports and sheets use the same identity-based read rules. Define report mode explicitly: current roster versus assessment-time grouping, avoiding double counting. Audit the transfer with before/after placement.
- Restore genuinely deleted data only from a verified backup; do not fabricate missing marks. Include a diagnostic report of unmatched historical references.

## 8. Migration and rollout

1. **Inventory/dry run:** enumerate all model callers, endpoints, jobs, seeds, AI tools, caches, downloads, Google Sheets integrations and mixed operational references. Report counts, duplicates, orphaned IDs, semester labels, year inconsistencies, report months and program durations. Do not use the legacy seed's active year as truth.
2. **Back up and rehearse:** take verified MongoDB backup and rehearse against a restored copy. Record collection counts, checksums and representative marks/operational totals. Keep the unrelated HRMS plan untouched.
3. **Deploy foundation behind a flag:** registry, repository boundary, shared identities, term context and migration scripts. Keep public behavior unchanged. Explicit migration commands support dry run, apply, verification and resumable checkpoints; never run this backfill automatically at application startup.
4. **Initial backfill:** during a controlled academic-write freeze, create 2026-2027 Odd and shared publication state, backfill existing students into enrolments, tag teaching records and materialize term assignments. Preserve all IDs. Existing data is assigned to the initial term only after the inventory confirms it; quarantine ambiguous years/dates rather than silently relabeling them. Normalize year display to 2026-2027 without destroying source metadata.
5. **Repair indexes and references:** validate term-local uniqueness, replace global indexes, verify assignment permissions and operational links. Make all reference seeds and sync tasks explicit-term and safe for archives; stop startup routines from resetting current state.
6. **Verify and cut over:** compare counts/checksums, sample marks before/after department moves, trainer timetable/assignment parity, topic tracker totals, calendars, exports and shared operational totals. Enable term reads only after verification succeeds; then unfreeze writes on the new application version. Avoid a period with old unscoped writers running alongside the new version.
7. **Prepare Even in staging:** simulate publication, retries, concurrency and return-to-history. Only then expose management/publication UI in production. Initial Odd publication does not promote anyone.

Rollback before new writes: disable feature and restore the tested pre-cutover deployment/data/index state. After new-term writes exist, stop writes and use a forward repair or audited pointer correction; never blindly restore a backup over new data. Retain backups and migration manifests through acceptance.

## 9. Later move to separate database URIs

Freeze writes for the chosen partition, copy its collections retaining IDs and term tags, verify counts/checksums/indexes and all external references, then switch its registry connection alias atomically. Invalidate connection/read caches and resume. Keep source read-only for rollback until accepted. Only one location accepts writes at a time; use a routing revision/fence to reject stale workers. Shared identity and operational collections remain in the shared DB. Migrate archives first to exercise routing with lower write risk.

## 10. Ordered implementation and acceptance

1. Regression test and fix department-transfer marks visibility, including manual edits, upload, different-subject history and exports.
2. Implement registry/schema/repository boundary and migration dry-run tooling.
3. Backfill rehearsal and invariant verification; migrate all dependent APIs, auth checks, jobs, sheets and exports.
4. Add admin private view selector, term calendars and unchanged trainer current-term behavior.
5. Implement draft preparation, promotion preview, idempotent publication and stale-write protection.
6. Run backend tests, frontend checks/build and browser journeys; review authorization, term leaks, data preservation and rollback evidence.
7. Present final diff, migration rehearsal results and any limitations for review; push only after the requested final review.

Acceptance cases: III becomes IV exactly once on publishing Even; viewing Odd later still shows III and its original marks/tracker; personal viewing has no global effect; an already-open trainer session adopts the published term safely; stale writes fail; cross-term IDs fail; ordinary trainer requests cannot select drafts/archives; shared punch-in/leave/performance/replacements and venues retain their prior totals; new subjects/marks never appear in another term; transfer retains original marks including zero/absence/remarks; retries and simultaneous publishing cannot duplicate enrolments; shorter-program completion works; calendars and report periods match the selected term; a partition can be routed to a second test database without changing product behavior.

## Review assumptions

- Historical terms are read-only by default; exceptional correction needs a separate audited admin workflow.
- Next-term data can be prepared before publication, but only publication activates the promoted roster for trainers.
- Program-specific graduation metadata must be supplied or verified before affected cohorts can be promoted.
- Semester dates and calendar links are admin-configured; do not infer them from today's date.
