/** Synthetic monthly grid shared by local benchmarks and the manual review preview. */
export const attendancePerformanceFixture = (month, trainerCount = 60) => {
  const dates = Array.from({ length: 30 }, (_, i) => ({
    key: `${month}-${String(i + 1).padStart(2, '0')}`, day: i + 1, label: String(i + 1), dayName: 'Mon', isFuture: false,
  }));
  return {
    month, workingDays: 30, dates,
    rows: Array.from({ length: trainerCount }, (_, i) => ({
      trainer: { _id: `perf-trainer-${i}`, name: `Performance trainer ${i + 1}`, employeeId: String(150000 + i) },
      days: Object.fromEntries(dates.map(date => [date.key, { attendanceType: 'oif', oifNumber: '12345', mockPrepHours: 0, classHandlingHours: 2, foodAllowance: '', classHoursEditable: true }])),
      totals: { mockPrepHours: 0, classHandlingHours: 60, oifDays: 30, leaveDays: 0, replacementRequiredDays: 0 },
    })),
  };
};
