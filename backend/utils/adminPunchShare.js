import mongoose from 'mongoose';
import WhatsappPunchShare from '../models/WhatsappPunchShare.js';

export const MANAGERS_ATTENDANCE_GROUP = 'FACE Prep | Attendance tracking | Training Managers';

export const buildAdminPunchShareCaption = ({ name, oifNumber, capturedAt }) => {
  const when = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(capturedAt));
  return [
    'Admin punch-in',
    name || 'Admin',
    oifNumber ? `OIF ${oifNumber}` : '',
    when,
  ].filter(Boolean).join('\n');
};

export const enqueueAdminPunchShare = async ({ role, name, oifNumber, capturedAt, driveFileId }) => {
  if (role !== 'admin' || mongoose.connection.readyState !== 1 || !driveFileId) return null;
  return WhatsappPunchShare.create({
    driveFileId,
    groupName: MANAGERS_ATTENDANCE_GROUP,
    caption: buildAdminPunchShareCaption({ name, oifNumber, capturedAt }),
    status: 'pending',
  });
};
