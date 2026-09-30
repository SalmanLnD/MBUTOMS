// Synthetic data only. The responsive check never connects to the production API.
export const user = { _id: 'admin-test', name: 'Campus Operations Manager', email: 'test@example.invalid', role: 'admin', sessionVersion: 1 };
const pagination = { page: 1, limit: 50, total: 20, pages: 1 };
const subject = { _id: 'subject-test', name: 'Industrial Data Structures and Algorithms', code: '22LG101703', semester: { name: 'Semester 3', number: 3 }, department: 'Computer Science', school: 'School of Computing' };
const trainers = Array.from({ length: 20 }, (_, i) => ({ _id: `trainer-${i}`, employeeId: `${131880+i}`, name: i === 0 ? 'M Sai Priya' : `Trainer ${i + 1} with a longer directory name`, email: `trainer${i}@example.invalid`, phone: '9000000000', department: 'Computer Science', subjects: [subject], skills: ['Training'], status: 'active', joiningDate: '2026-01-01', weeklyWorkloadHours: 24, experience: 3 }));
const venue = { _id: 'venue-test', name: '610A', building: 'M Block East', floor: '1st Floor', displayBuilding: 'M Block East', displayFloor: '1st Floor', capacity: 60 };
const defaults = { pagination, subjects: [], trainers: [], classes: [], students: [], leaves: [], tickets: [], replacements: [], rows: [], items: [], entries: [], sessions: [], schedules: [], specialClasses: [], holidays: [], compOffs: [], forms: [], responses: [], records: [], cancellations: [], notifications: [], unreadCount: 0, reference: [], configured: false, dates: [], days: [], departments: [], summary: {}, job: null };
export function fixture(path, search = new URLSearchParams()) {
  if (path.endsWith('/apps-script/setup')) return { steps: ['Create a spreadsheet.', 'Paste the script and save.', 'Run the initial sync.'], note: 'Synthetic setup for layout testing.', exportUrl: 'https://example.invalid/api/export', apiKey: 'synthetic-layout-test-key', script: '// Synthetic layout test\n' + 'function refresh() { /* sample content */ }\n'.repeat(16) };
  if (path === '/auth/me') return user;
  if (path === '/auth/impersonation-targets') return { targets: [] };
  if (path === '/dashboard/stats') return { cards: { totalTrainers: 20, totalStudents: 2400, todaysClasses: 34, todaysLeaves: 3, activeVenues: 22, pendingReplacements: 2 }, attendanceSummary: { present: 15, absent: 1, late: 1, leave: 3 }, topTrainersByFeedback: trainers.slice(0,5).map(t => ({ name: t.name, averageRating: 4.2, responseCount: 35 })) };
  if (path === '/trainers/departments/list') return [];
  if (path.endsWith('/list') || path === '/classes') return [];
  if (path.startsWith('/schedules/trainer/')) return { schedules: [], totalHours: 0 };
  if (path === '/trainers') return { trainers, pagination };
  if (/^\/trainers\/trainer-\d+$/.test(path)) return trainers.find(t => path.endsWith(t._id));
  if (path === '/subjects') return { subjects: [subject], pagination: { ...pagination, total: 1 } };
  if (path === '/venues') return { venues: [venue], pagination: { ...pagination, total: 1 } };
  if (path === '/tickets') return { tickets: [{ _id: 'ticket-test', ticketId: 'TKT1001', trainer: trainers[0], type: 'other', status: 'open', createdAt: '2026-09-30T04:00:00Z', description: 'A long ticket description for checking modal reading and scrolling. '.repeat(12), updates: [{ _id: 'update-test', status: 'open', comment: 'A sample status update.', createdAt: '2026-09-30T04:30:00Z', updatedBy: user }] }], pagination };
  if (path === '/leaves') return { leaves: [{ _id: 'leave-test', trainer: trainers[0], startDate: '2026-09-30', endDate: '2026-10-02', reason: 'Synthetic approved leave for layout checks.', status: 'approved', affectedClassCount: 3 }], pagination };
  if (path === '/replacements/all') return { replacements: [{ leave: { _id: 'leave-test', trainer: trainers[1], startDate: '2026-09-30', endDate: '2026-09-30' }, schedule: { _id: 'schedule-test', startTime: '09:00', endTime: '10:50', department: 'CSE', section: 'A3', subject, venue }, replacement: { ...trainers[0], trainerId: trainers[0]._id }, timelineStatus: 'current', canChange: true, affectedDates: ['2026-09-30'] }], pagination };
  if (path === '/topic-tracker/overview') return { subjects: [{ subjectId: subject._id, subjectName: subject.name, trainers: [{ trainerId: trainers[0]._id, trainerName: trainers[0].name, allottedSlots: 2, pendingSlots: 1 }] }] };
  if (path === '/topic-tracker/sessions') return { day: 'Wednesday', sessions: [{ scheduleId: 'schedule-test', date: '2026-09-30', trainerName: trainers[0].name, branchYearSection: 'CSE A3 III', roomNo: venue.name, courseName: subject.name, slot: 'S1', sessionStartTime: '09:00', sessionEndTime: '10:50', sessionStatus: 'completed', topicModuleCovered: 'Arrays', topicModulesCovered: ['Arrays'], availableTopics: ['Arrays','Trees'], durationHrs: 1.8, attendancePercent: 90, trackerStatus: 'pending' }] };
  if (path === '/schedules/timetable-board' || path === '/schedules/public-timetable') return { trainers, subjects: [subject], schedulesByTrainer: Object.fromEntries(trainers.map(t => [t.employeeId, [{ _id: `schedule-${t._id}`, trainer: t, trainerCode: t.employeeId, subject, subjectCode: subject.code, day: 'Monday', slot: 'S1', startTime: '09:00', endTime: '10:50', department: 'CSE', section: 'A3', venue, startDate: '2026-01-01', endDate: '2026-12-31' }]])) };
  if (path === '/schedules/live-venues') return { date: '2026-09-30', day: 'Wednesday', currentTime: '09:30', isLive: true, trainers: trainers.map((t,i) => ({ trainerId: t._id, employeeId: t.employeeId, name: t.name, status: i % 3 === 0 ? 'in_class' : 'free', venue, schedule: { ...subject, subjectCode: subject.code, department: 'CSE', section: 'A3', slot: 'S1', startTime: '09:00', endTime: '10:50' } })) };
  if (path === '/attendance/trainer-grid') {
    const month = search.get('month') || '2026-09';
    const dates = Array.from({ length: 30 }, (_,i) => ({ key: `${month}-${String(i+1).padStart(2,'0')}`, day: i+1, label: String(i+1), dayName: 'Mon', isFuture: true }));
    return { month, dates, workingDays: 30, rows: trainers.map(trainer => ({ trainer, days: {}, totals: {} })) };
  }
  if (path === '/feedback/summary') return { overallAverage: 4.2, overallCount: 100, currentMonth: { label: 'September', count: 20, average: 4.1 }, trainerSummaries: [], recentMonths: [] };
  if (path.includes('/feedback/public/')) return { title: 'Training feedback', description: 'Share your experience of the training session.', fields: [{ id: 'name', label: 'Your name', type: 'text', required: true, order: 0 }, { id: 'comments', label: 'Comments', type: 'textarea', order: 1 }] };
  return { ...defaults };
}
