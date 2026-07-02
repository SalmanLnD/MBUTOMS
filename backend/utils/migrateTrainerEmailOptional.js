import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';

export const migrateTrainerEmailOptional = async () => {
  const collection = mongoose.connection.collection('trainers');

  const unsetResult = await collection.updateMany(
    { email: { $exists: true, $in: [null, ''] } },
    { $unset: { email: '' } }
  );

  const indexes = await collection.indexes();
  const emailIndex = indexes.find((index) => index.key?.email === 1);

  if (emailIndex && !emailIndex.sparse) {
    await collection.dropIndex(emailIndex.name);
  }

  await Trainer.syncIndexes();

  return { unsetCount: unsetResult.modifiedCount };
};
