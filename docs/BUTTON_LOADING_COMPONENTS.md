# Component action loading audit

Date: 4 November 2026. Shared dialogs, page components and autosaves were traced
from event handler through API promise, local state changes and completion.

Shared contracts: AsyncButton synchronously locks its own promise-returning
handler; AsyncForm also protects Enter/programmatic submissions and disables
fields until completion. Modal shares pending state across footer/header/body
and blocks backdrop/Escape/close while active. ConfirmModal and ActionIconButton
use the shared button. Synchronous navigation/dropdown controls remain ordinary
native button behavior. Async errors release locks; drafts remain available.

## Corrections beyond shared controls

- Attendance saves use a keyed queue: the same trainer/date stays ordered, while
  independent cells can save concurrently. Each affected cell shows Saving.
  Newer draft values are preserved when an older save completes. Session/month
  checks stop stale results changing another view. No-op blurs do not send writes.
- Observation, PLP-final and topic-tracker saves use per-row pending sets instead
  of one shared saving ID. Finishing one row no longer unlocks another. Editors
  and cycle controls are disabled where changing them would discard active work.
- Sheet link/unlink/export/copy, trainer/student/class/venue forms, official
  holidays, feedback forms, device settings, notification changes, timetable
  slots, special classes, cancellations and assistant submit handlers return
  their asynchronous completion. Parent refresh callbacks are awaited.
- External footer buttons with form=id remain supported; browser checks cover
  shared form submit and the pending dialog close lock.
- Existing explicit busy/saving states remain for operation-specific feedback.

## Shared-control inventory

Counts refer to JSX touchpoints, including list-rendered controls. API-bearing
components are listed; native read-only/navigation/presentation components were
checked for hidden writes and did not need a mechanical replacement.

| Component | Async buttons | Async forms |
| --- | --- | --- |
| ActionIconButton.jsx | 1 | 0 |
| AddSlotReplacementModal.jsx | 2 | 1 |
| AiAssistant.jsx | 6 | 1 |
| AsyncButton.jsx | 0 | 0 |
| AsyncForm.jsx | 0 | 0 |
| ClassCancellationModal.jsx | 6 | 1 |
| ClassFormModal.jsx | 2 | 1 |
| ComplianceFormModal.jsx | 2 | 1 |
| ComplianceTab.jsx | 1 | 0 |
| CompOffsTab.jsx | 13 | 0 |
| ConfirmModal.jsx | 2 | 0 |
| DeviceSettings.jsx | 7 | 0 |
| FeedbackFormTab.jsx | 7 | 0 |
| FeedbackResponsesTab.jsx | 1 | 0 |
| FeedbackSection.jsx | 1 | 0 |
| FeedbackSheetSetupModal.jsx | 5 | 1 |
| LateMisconductTab.jsx | 3 | 0 |
| LoginModal.jsx | 2 | 1 |
| NotificationBell.jsx | 7 | 0 |
| ObservationsTab.jsx | 4 | 0 |
| OfficialHolidayModal.jsx | 1 | 1 |
| PlpSheetSetupModal.jsx | 4 | 1 |
| PlpTab.jsx | 4 | 0 |
| ResetPasswordModal.jsx | 1 | 1 |
| ScheduleFormModal.jsx | 2 | 1 |
| SessionExpiredModal.jsx | 1 | 0 |
| SpecialClassModal.jsx | 7 | 1 |
| StudentBulkUploadModal.jsx | 3 | 1 |
| StudentFormModal.jsx | 2 | 1 |
| StudentMonthlyTestReportsTab.jsx | 10 | 0 |
| StudentTestReportSheetSetupModal.jsx | 4 | 1 |
| SubjectFormModal.jsx | 6 | 1 |
| SubjectResourceLinkModal.jsx | 2 | 1 |
| SubjectTopicsModal.jsx | 6 | 1 |
| TimetableSheetSetupModal.jsx | 5 | 1 |
| TimetableSlotModal.jsx | 5 | 1 |
| Topbar.jsx | 6 | 0 |
| TopicTrackerCancellationsTab.jsx | 3 | 0 |
| TopicTrackerClassSummaryTab.jsx | 1 | 0 |
| TopicTrackerPendingBacklogTab.jsx | 5 | 0 |
| TopicTrackerSheetSetupModal.jsx | 5 | 1 |
| TopicTrackerSpreadsheet.jsx | 4 | 0 |
| TrainerAttendanceSheetSetupModal.jsx | 4 | 1 |
| TrainerAttendanceTab.jsx | 8 | 0 |
| TrainerAvailabilityPanel.jsx | 4 | 0 |
| TrainerDetailsPanel.jsx | 5 | 0 |
| TrainerFormModal.jsx | 2 | 1 |
| TrainerPunchInLogsTab.jsx | 1 | 0 |
| TrainerRoleTransferModal.jsx | 2 | 1 |
| VenueFormModal.jsx | 2 | 1 |
| VenueLiveTab.jsx | 2 | 0 |

## Verification limits

Delayed-response browser scenarios and route/dialog sweeps are recorded in the
performance verification report. This audit adds client re-entry protection;
server duplicate protection is specifically implemented for full-day leave
creation and two-range partial-cancel splitting. It does not claim every backend
endpoint is universally idempotent. Existing live duplicate records are not
automatically deleted.
