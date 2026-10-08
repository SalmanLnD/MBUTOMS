import { randomUUID } from 'node:crypto';

export const driveConfigured = (env = process.env) => Boolean(env.PUNCH_GOOGLE_CLIENT_ID && env.PUNCH_GOOGLE_CLIENT_SECRET && env.PUNCH_GOOGLE_REFRESH_TOKEN);
export const uploadPunchPhoto = async ({ buffer, name, day }, env = process.env) => {
  if (!driveConfigured(env)) throw new Error('University Google Drive is not connected.');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: env.PUNCH_GOOGLE_CLIENT_ID, client_secret: env.PUNCH_GOOGLE_CLIENT_SECRET,
      refresh_token: env.PUNCH_GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error('University Google Drive authorization failed.');
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const folder = async (label, parent) => {
    const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${label}'${parent ? ` and '${parent}' in parents` : " and 'root' in parents"}`;
    const result = await fetch(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw new Error('Unable to find the punch photo folder.');
    const data = await result.json(); if (data.files?.[0]) return data.files[0].id;
    const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: label, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }) });
    if (!created.ok) throw new Error('Unable to create the punch photo folder.');
    return (await created.json()).id;
  };
  const root = env.PUNCH_DRIVE_ROOT_FOLDER_ID || await folder('toms punch ins');
  if (!/^[\w-]+$/.test(root)) throw new Error('Invalid Drive folder configuration.');
  const parent = await folder(day, root);
  const boundary = `toms-${randomUUID()}`;
  const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`), buffer, Buffer.from(`\r\n--${boundary}--`)]);
  const result = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST', signal: AbortSignal.timeout(30000), headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!result.ok) throw new Error('Photo upload failed. Attendance has not been marked.');
  return result.json();
};
