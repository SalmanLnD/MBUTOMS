import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { toLeaveDateKey } from '../utils/leaveDateRange.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const col = mongoose.connection.collection('topic_tracker_entries');
const entries = await col.find({}).toArray();

const groups = new Map();
for (const entry of entries) {
  const dayKey = toLeaveDateKey(entry.date);
  const key = `${String(entry.schedule)}::${dayKey}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(entry);
}

let normalized = 0;
let removed = 0;

for (const [groupKey, list] of groups.entries()) {
  const dayKey = groupKey.split('::')[1];
  const canonicalDate = new Date(`${dayKey}T00:00:00.000Z`);

  list.sort((a, b) => {
    const closedDiff = Number(b.trackerStatus === 'closed') - Number(a.trackerStatus === 'closed');
    if (closedDiff) return closedDiff;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  const keeper = list[0];
  const duplicates = list.slice(1);

  if (keeper.date.toISOString() !== canonicalDate.toISOString()) {
    await col.updateOne({ _id: keeper._id }, { $set: { date: canonicalDate } });
    normalized += 1;
  }

  if (duplicates.length) {
    await col.deleteMany({ _id: { $in: duplicates.map((entry) => entry._id) } });
    removed += duplicates.length;
  }
}

console.log(JSON.stringify({
  totalEntriesBefore: entries.length,
  groups: groups.size,
  datesNormalized: normalized,
  duplicatesRemoved: removed,
  totalEntriesAfter: await col.countDocuments(),
}));

await mongoose.disconnect();
