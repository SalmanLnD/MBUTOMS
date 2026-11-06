// Local, disposable sample API for user verification. No database or external API access.
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture, user } from './responsive-fixtures.mjs';
import { attendancePerformanceFixture } from './performance-fixtures.mjs';

const origin = 'http://127.0.0.1:5178';
const leaves = [];
const attendance = new Map();
const monthKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
const respond = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};
const server = createServer(async (req, res) => {
  if (req.headers.origin && req.headers.origin !== origin) return respond(res, 403, { message: 'Local review origin only' });
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TOMS-Request');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    const url = new URL(req.url, 'http://127.0.0.1:5001');
    const path = url.pathname.replace(/^\/api/, '');
    if (req.method === 'GET') {
      if (path === '/auth/me') return respond(res, 200, { ...user, name: 'Local review — sample data' });
      if (path === '/attendance/trainer-grid') {
        const data = attendancePerformanceFixture(url.searchParams.get('month') || monthKey());
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        data.dates = data.dates.map(date => ({ ...date, isFuture: date.key > today }));
        for (const row of data.rows) for (const date of data.dates) {
          const saved = attendance.get(`${row.trainer._id}|${date.key}`);
          if (saved) row.days[date.key] = { ...row.days[date.key], ...saved };
        }
        return respond(res, 200, data);
      }
      if (path === '/leaves') return respond(res, 200, { leaves, pagination: { page: 1, limit: 10, pages: Math.max(1, Math.ceil(leaves.length / 10)), total: leaves.length } });
      return respond(res, 200, fixture(path, url.searchParams));
    }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 100_000) return respond(res, 413, { message: 'Review request too large' });
    }
    const payload = JSON.parse(body || '{}');
    if (path === '/leaves' && req.method === 'POST') {
      // A visible delay reproduces the original repeat-click temptation safely.
      await delay(1500);
      if (leaves.some(leave => leave.trainer._id === payload.trainer && leave.startDate <= payload.endDate && leave.endDate >= payload.startDate)) {
        return respond(res, 409, { message: 'An active leave already exists for this trainer in this date range (sample data).' });
      }
      const trainer = fixture('/trainers').trainers.find(trainer => trainer._id === payload.trainer);
      if (!trainer) return respond(res, 400, { message: 'Select a sample trainer' });
      const leave = { ...payload, _id: `sample-leave-${leaves.length + 1}`, trainer, status: 'pending', affectedClassCount: 0 };
      leaves.unshift(leave);
      return respond(res, 201, leave);
    }
    if (path === '/attendance/trainer-daily' && req.method === 'PUT') {
      await delay(1200);
      attendance.set(`${payload.trainer}|${payload.date}`, payload);
      return respond(res, 200, { ...payload, classHoursEditable: true });
    }
    return respond(res, 403, { message: 'This disposable preview supports only leave creation and attendance editing. Other writes are disabled.' });
  } catch { return respond(res, 400, { message: 'Invalid local review request' }); }
});
server.listen(5001, '127.0.0.1', () => console.log(`Sample API: http://127.0.0.1:5001/api (memory only). Start Vite on ${origin} with VITE_API_URL=http://127.0.0.1:5001/api.`));
