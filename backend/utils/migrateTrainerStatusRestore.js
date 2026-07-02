import mongoose from 'mongoose';

export const migrateTrainerStatusRestore = async () => {
  const collection = mongoose.connection.collection('trainers');

  const result = await collection.updateMany(
    { $or: [{ status: { $exists: false } }, { status: { $nin: ['active', 'unavailable'] } }] },
    { $set: { status: 'active' } }
  );

  return { restoredCount: result.modifiedCount };
};
