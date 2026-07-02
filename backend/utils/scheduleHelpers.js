/**
 * Build full Date from a calendar date and HH:mm time string (local timezone).
 */
export const combineDateAndTime = (dateInput, timeStr) => {
  const base = new Date(dateInput);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    0,
    0
  );
};

/**
 * Normalize a date to local midnight for storage.
 */
export const normalizeDate = (dateInput) => {
  const base = new Date(dateInput);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
};

/**
 * Check if two time ranges overlap.
 */
export const timesOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

/**
 * Find conflicting schedules for trainer or venue.
 */
export const findConflicts = async (Schedule, { trainer, venue, startDateTime, endDateTime, excludeId }) => {
  const baseQuery = {
    status: { $ne: 'cancelled' },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  };
  if (excludeId) baseQuery._id = { $ne: excludeId };

  const [trainerConflict, venueConflict] = await Promise.all([
    Schedule.findOne({ ...baseQuery, trainer })
      .populate('subject', 'name code')
      .populate('trainer', 'name')
      .populate('venue', 'name'),
    Schedule.findOne({ ...baseQuery, venue })
      .populate('subject', 'name code')
      .populate('trainer', 'name')
      .populate('venue', 'name'),
  ]);

  return { trainerConflict, venueConflict };
};

export const formatConflictMessage = (trainerConflict, venueConflict) => {
  const messages = [];
  if (trainerConflict) {
    messages.push(
      `Trainer "${trainerConflict.trainer?.name}" already has "${trainerConflict.subject?.name}" at ${trainerConflict.startTime}-${trainerConflict.endTime} in ${trainerConflict.venue?.name}`
    );
  }
  if (venueConflict) {
    messages.push(
      `Venue "${venueConflict.venue?.name}" is already booked for "${venueConflict.subject?.name}" with ${venueConflict.trainer?.name} at ${venueConflict.startTime}-${venueConflict.endTime}`
    );
  }
  return messages.join('. ');
};
