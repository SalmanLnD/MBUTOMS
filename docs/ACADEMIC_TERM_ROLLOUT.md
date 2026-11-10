# Academic term rollout

The feature is disabled unless `ACADEMIC_TERMS_ENABLED=true`. Never enable it against an unmigrated database. No migration runs at application startup.

Confirmed initial term: **2026–2027 Odd, July 12–December 6, 2026**. The reviewed initial migration arguments are `--start-date=2026-07-12 --end-date=2026-12-06`.

## Storage decision

Each semester uses namespaced collections (`term_<termObjectId>_students`, `term_<termObjectId>_subjects`, and the other teaching collections). This deliberately improves on the initial field-only proposal: MongoDB cannot store the same student `_id` twice in one collection. Namespaces let historical and promoted enrollment snapshots retain the same stable student identity and all existing report references. Every snapshot also carries `termId`. Shared `student_identities` reserves roll numbers and IDs across partitions. Global trainer identities, operational records and reference catalogs remain shared.

`getTermRepositories(term)` binds immutable models to a partition connection. Async request context selects those models; requests never mutate a shared model's collection pointer. The `storageKey` resolves a server environment alias `ACADEMIC_DB_<ALIAS>`; the default `shared` uses the existing MongoDB connection. URIs are never returned to the browser. A separate database must contain only the term namespace; shared model references explicitly resolve through the shared connection.

## Rehearsal and production cutover

1. Take a verified MongoDB backup and restore it to an isolated rehearsal database. Freeze academic writes for the actual production migration, including integrations and old application workers.
2. From `backend`, run `node scripts/migrate-academic-terms.js`. This is read-only inventory and reports counts, source checksums, year labels, report months, cohort parity, duplicate roll numbers and orphaned marks. Review mixed-year records manually; do not infer truth from legacy active flags.
3. Resolve audit findings. Confirm all existing teaching data belongs to 2026-2027 Odd. Supply reviewed semester dates, then run `node scripts/migrate-academic-terms.js --apply --confirm-initial-term --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD`. An optional `--calendar-url=https://...` replaces the existing academic-calendar folder. This copies documents without changing IDs, builds partition indexes, verifies checksums/counts, materializes stable identities and teaching-role assignments, and publishes the initial term last. Legacy collections remain untouched.
4. If copying fails before publication, keep the feature disabled and rerun the same command after fixing the reported problem. A published migration refuses overwrite. Never point an old unscoped writer at a migrated production deployment.
5. Enable `ACADEMIC_TERMS_ENABLED=true` on the reviewed deployment. Verify original marks, schedules, topic tracker totals and all shared operational totals, then unfreeze writes. Reconfigure semester sheet integrations so export URLs include their semester identity.
6. Create the Even draft. Configure dates, calendar and program semester counts by department. Preview and prepare promotion. Preparation copies students/classes only; subjects, trainer assignments and timetable must be explicitly configured for the new term. Marks and topic completion start empty.
7. If the source roster changes, preview again and explicitly reconcile preparation. Only generated destination snapshots that remain unedited can be refreshed; conflicting manual target edits are reported and require review. Publication validates the source manifest again.
8. Publish the reviewed draft. The pointer/revision changes once; historical source snapshots remain unchanged. Verify an already open trainer session reloads and stale academic writes are rejected.

## Later URI migration

Freeze writes to one term. Copy its namespaced collections preserving IDs and indexes. Verify counts/checksums and referenced shared IDs. Set the secure environment alias, then update the registry `storageKey` and increment `routingRevision` under the same publication/write fence. Restart workers to discard old routes. Only one location accepts writes. Retain the old namespace read-only until acceptance. Rehearse this with an archived term before changing an active term.

## Rollback

Before new writes, disable the feature and return to the verified legacy deployment/collections. Once new term writes exist, freeze and forward-repair; do not restore an old backup over new student/mark data. Keep backups and the `academictermjobs` audit manifests through acceptance.
