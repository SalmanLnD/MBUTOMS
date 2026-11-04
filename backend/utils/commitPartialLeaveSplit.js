/** Preserve both retained ranges and cancel the original leave as one change. */
export const commitPartialLeaveSplit = async ({ Leave, Trainer, source, records }) => {
  // Capture the original source before starting a transaction. A retry must not
  // replace another request's result after that source has already changed.
  const sourceFilter = {
    _id: source._id,
    status: source.status,
    startDate: source.startDate,
    endDate: source.endDate,
    __v: source.__v ?? { $exists: false },
    ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
  };
  const cancellation = {
    status: 'cancelled',
    replacements: [],
    affectedSchedules: [],
    replacementNeeded: false,
    bulkReplacement: {
      groupId: '', fromDate: null, toDate: null, replacementTrainer: null,
      assignedAt: null, assignedBy: null,
    },
  };
  const createdRecords = await Leave.db.transaction(async (session) => {
    // Use the same serialization point as new leave creation, so a new request
    // cannot slip into a gap while the original is replaced by retained ranges.
    const trainer = await Trainer.updateOne(
      { _id: source.trainer?._id || source.trainer },
      { $inc: { __v: 1 } },
      { session, timestamps: false },
    );
    if (!trainer.matchedCount) {
      const error = new Error('Trainer not found');
      error.statusCode = 404;
      throw error;
    }
    const cancelled = await Leave.updateOne(
      sourceFilter,
      { $set: cancellation, $inc: { __v: 1 } },
      { session, runValidators: true },
    );
    if (!cancelled.matchedCount) {
      const error = new Error('This leave changed while your request was processing. Refresh the leave list before trying again.');
      error.statusCode = 409;
      throw error;
    }
    return Leave.create(records, { session });
  });
  return { createdRecords, cancellation };
};
