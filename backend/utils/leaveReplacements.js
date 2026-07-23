/**
 * Keep one replacement entry per schedule id (latest wins).
 * Duplicate rows inflate class-handling hours and board slots.
 */
export const dedupeReplacementsBySchedule = (replacements = []) => {
  const bySchedule = new Map();

  (replacements || []).forEach((entry) => {
    const scheduleId = entry?.schedule?._id?.toString?.()
      || entry?.schedule?.toString?.()
      || '';
    if (!scheduleId) return;

    const existing = bySchedule.get(scheduleId);
    if (!existing) {
      bySchedule.set(scheduleId, entry);
      return;
    }

    const existingAt = new Date(existing.assignedAt || 0).getTime();
    const nextAt = new Date(entry.assignedAt || 0).getTime();
    if (nextAt >= existingAt) {
      bySchedule.set(scheduleId, entry);
    }
  });

  return [...bySchedule.values()];
};
