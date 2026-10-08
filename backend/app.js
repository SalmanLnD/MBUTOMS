import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import { corsOriginCallback } from './utils/cors.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import trainerRoutes from './routes/trainerRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import replacementRoutes from './routes/replacementRoutes.js';
import classRoutes from './routes/classRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import sheetsRoutes from './routes/sheetsRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import observationRoutes from './routes/observationRoutes.js';
import plpRoutes from './routes/plpRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import topicTrackerRoutes from './routes/topicTrackerRoutes.js';
import studentTestReportRoutes from './routes/studentTestReportRoutes.js';
import compOffRoutes from './routes/compOffRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import photoPunchRoutes from './routes/photoPunchRoutes.js';
import { APP_VERSION } from './utils/sessionVersion.js';
import { guardDemoToken } from './utils/demoAccess.js';
import announcementRoutes from './routes/announcementRoutes.js';

dotenv.config();
const app = express();
// Render terminates HTTPS upstream. Trust only private/loopback proxy hops,
// stopping at the nearest public address instead of trusting arbitrary client headers.
if (process.env.RENDER === 'true') app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(guardDemoToken);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TOMS API is running', version: APP_VERSION });
});

app.use(async (req, res, next) => {
  try {
    await connectDB({ runStartup: false, readOnly: Boolean(req.hasDemoToken) });
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/photo-punch', photoPunchRoutes);
app.use('/api/replacements', replacementRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/plp', plpRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/topic-tracker', topicTrackerRoutes);
app.use('/api/student-test-reports', studentTestReportRoutes);
app.use('/api/comp-offs', compOffRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
