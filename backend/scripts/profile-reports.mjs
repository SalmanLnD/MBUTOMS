import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { buildTopicTrackerPendingBacklog } from '../utils/topicTrackerSessions.js';
import { buildTrainerAttendanceExportPayload } from '../utils/trainerAttendanceExport.js';
import { toAttendanceDateKey } from '../utils/attendanceTracking.js';

dotenv.config();
try {
  await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false, maxPoolSize: 3, serverSelectionTimeoutMS: 10_000 });
  const start = performance.now();
  const backlog = await buildTopicTrackerPendingBacklog({ user: { role: 'admin' } });
  console.log(JSON.stringify({ report: 'pending-backlog', durationMs: Math.round(performance.now() - start),
    pending: backlog.totalPending, fullPayloadBytes: Buffer.byteLength(JSON.stringify(backlog)),
    pagePayloadBytes: Buffer.byteLength(JSON.stringify({ ...backlog, items: backlog.items.slice(0,25) })),
    rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024) }));
  if (process.argv.includes('--attendance')) {
    const exportStart = performance.now();
    await buildTrainerAttendanceExportPayload();
    console.log(JSON.stringify({ report: 'attendance-export', durationMs: Math.round(performance.now() - exportStart), rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024) }));
  }
  const values = Array.from({ length: 3000 }, (_, i) => new Date(Date.UTC(2026, 6, 1 + i % 60)));
  const baselineStart = performance.now();
  const before = values.map(date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date));
  const baselineMs = performance.now() - baselineStart;
  const optimizedStart = performance.now();
  const after = values.map(toAttendanceDateKey);
  const optimizedMs = performance.now() - optimizedStart;
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Date output mismatch');
  console.log(JSON.stringify({ benchmark: '3000 IST date conversions', baselineMs: Math.round(baselineMs), optimizedMs: Math.round(optimizedMs) }));
} catch (error) {
  console.error(`Profile failed (${error.code || error.name})`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
