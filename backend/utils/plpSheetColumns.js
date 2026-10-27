export const compactPlpSheetRows = (rows, header) => [
  [header[0], header[1], header[2], header[4], header[5], header[6], header[8],
    'Actual final', 'Final PLP rating', 'Leave Dates on training dates, RRD(Dates)'],
  ...rows.map((row) => [
    row.employeeId || '', row.name || '', row.feedbackRating ?? '', row.classObservationRating ?? '',
    row.demoObservationRating ?? '', row.attendanceScore ?? '', row.complianceScore ?? '',
    row.calculatedRaw ?? '', row.finalPlpRating ?? '',
    (row.replacementRequiredDates || []).map((date) => {
      const [year, month, day] = date.split('-');
      return `${day}-${month}-${year}`;
    }).join(', '),
  ]),
];
