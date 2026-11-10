# Academic semester verification

Initial semester dates confirmed by the administrator: 2026-07-12 through 2026-12-06, academic year 2026-2027, Odd.

## Executed checks

- Backend full test suite: passed (integration test skips unless an explicit disposable MongoDB URI is supplied).
- Frontend unit suite: 32 passed.
- Frontend production build: passed.
- Focused migration, assignments, cache, operational-history and student-transfer checks with disposable local MongoDB: 22 passed.
- Browser fixture checks: personal selection without publication, promotion preview/preparation/publication, current calendar, preservation of unsaved portal inputs, trainer layout and permissions passed.
- Existing database read-only migration inventory: 5,013 students, 14,438 test reports, 80 classes, 272 schedules, 6 subjects, 3,516 tracker records, 138 cancellations. No duplicate student roll numbers, orphaned reports or even-semester active students found. Subject year label `2026-27` requires normalization to the registry's `2026-2027` display.
- Backend review findings resolved: unrelated operational writes no longer take the academic lease; academic writes wait briefly for a lease; interrupted preparation recovers checksum-validated snapshots and removes obsolete generated records; readiness is recorded only after cleanup and completed preparation; publication validates completed preparation. Integration also exposed and verified correction of the hydration callback passed to Express.
- UI review findings resolved: explicit reconciliation action, missing-semester empty state, aborted-result guard and persistent retry on analysis failure.

## Remaining target acceptance

Production migration has not been applied and the feature has not been enabled. A production-sized backup/restore rehearsal completed on November 10, 2026: 38 collections and 40,271 documents were backed up as canonical EJSON, reread from source for consistency, restored to a fresh local MongoDB, and checksum verified. The initial migration completed on that restored database. Verification confirmed all original records unchanged, eight partition collections, migrated teaching-role assignments and only the expected term-specific sheet settings additions. The durable cutover backup should be taken again during the production academic-write freeze; this rehearsal snapshot was captured while the application remained online.

The rehearsal backup and manifest are outside the repository at `C:/Users/ms266/AppData/Local/Temp/toms-academic-backup-4D4jw2`. This folder contains private application data and must not be committed. The local rehearsal database is `academic_rehearsal_20261110_a` on port 27119. The initial validator reported expected settings additions as differences; the corrected standalone verifier subsequently passed all checks.

Follow ACADEMIC_TERM_ROLLOUT.md, review calendar and program durations, then verify checksums and shared operational totals before enabling the feature.

No dedicated lint/typecheck scripts are configured in this JavaScript repository. Coverage percentage was not measured.
