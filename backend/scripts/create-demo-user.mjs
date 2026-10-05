import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import User from '../models/User.js';

dotenv.config();
const email = (process.env.DEMO_USER_EMAIL || 'demo@mbutoms.com').toLowerCase().trim();
const credentialFile = path.resolve('.env.demo-user');
try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'demo') throw new Error('This address belongs to a real account; refusing to change it.');
    const saved = dotenv.parse(await fs.readFile(credentialFile));
    if (saved.DEMO_USER_EMAIL !== email || !await existing.matchPassword(saved.DEMO_USER_PASSWORD)) throw new Error('Existing demo credentials differ. Refusing to rotate them automatically.');
    console.log(JSON.stringify({ created: false, email, role: existing.role, credentials: credentialFile }));
  } else {
    const password = process.env.DEMO_USER_PASSWORD || `TomsDemo!${randomBytes(9).toString('base64url')}`;
    await fs.writeFile(credentialFile, `DEMO_USER_EMAIL=${email}\nDEMO_USER_PASSWORD=${password}\n`, { flag: 'wx', mode: 0o600 });
    const user = await User.create({ name: 'TOMS Demo', email, password, role: 'demo', isActive: true, mustResetPassword: false, sessionVersion: 1 });
    if (!await user.matchPassword(password)) throw new Error('Created password verification failed');
    console.log(JSON.stringify({ created: true, email, role: user.role, credentials: credentialFile }));
  }
} catch (error) { console.error(error.message); process.exitCode=1; }
finally { await mongoose.disconnect(); }
