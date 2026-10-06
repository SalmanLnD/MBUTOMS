import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';
import { startScheduledNotifications } from './services/scheduledNotifications.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB({ runStartup: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TOMS server running on port ${PORT}`);
      startScheduledNotifications();
    });
  })
  .catch((error) => {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  });
