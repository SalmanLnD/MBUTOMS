import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';

dotenv.config();

/** employeeId → CAMU ERP ID + password (from campus roster update). */
const CAMU_UPDATES = [
  { employeeId: '135269', camuErpId: 'adjfaculty-cdc051@mbu.asia', camuPassword: 'MbuFace@123' },
  { employeeId: '135400', camuErpId: 'adjfaculty-cdc052@mbu.asia', camuPassword: 'MbuFace$2026' },
  { employeeId: '135401', camuErpId: 'adjfaculty-cdc053@mbu.asia', camuPassword: 'MBUFACE@2026' },
  { employeeId: '135314', camuErpId: 'adjfaculty-cdc054@mbu.asia', camuPassword: 'FaceMbu@2026' },
  { employeeId: '135895', camuErpId: 'adjfaculty-cdc055@mbu.asia', camuPassword: 'Mbuface@2026' },
  { employeeId: '135890', camuErpId: 'adjfaculty-cdc056@mbu.asia', camuPassword: 'mbu1619@' },
  { employeeId: '135301', camuErpId: 'adjfaculty-cdc057@mbu.asia', camuPassword: 'MbuFace@123' },
  { employeeId: '801777', camuErpId: 'adjfaculty-cdc065@mbu.asia', camuPassword: 'MbuFace@222' },
  { employeeId: '801754', camuErpId: 'adjfaculty-cdc066@mbu.asia', camuPassword: 'FaceMbu@2026' },
  { employeeId: '135130', camuErpId: 'adjfaculty-cdc072@mbu.asia', camuPassword: 'Mbuface@123' },
  { employeeId: '135621', camuErpId: 'adjfaculty-cdc073@mbu.asia', camuPassword: 'Mbuface@2026' },
  { employeeId: '136047', camuErpId: 'adjfaculty-cdc074@mbu.asia', camuPassword: 'Demo@123' },
  { employeeId: '135517', camuErpId: 'adjfaculty-cdc075@mbu.asia', camuPassword: 'MbuFace@123' },
  { employeeId: '801406', camuErpId: 'adjfaculty-cdc076@mbu.asia', camuPassword: 'Harini@123' },
  { employeeId: '135402', camuErpId: 'adjfaculty-cdc077@mbu.asia', camuPassword: 'FaceMbu@2026' },
  { employeeId: '131886', camuErpId: 'adjfaculty-cdc083@mbu.asia', camuPassword: 'Mbuface@2026' },
  { employeeId: '135887', camuErpId: 'adjfaculty-cdc084@mbu.asia', camuPassword: 'Faceprep@1' },
  { employeeId: '131665', camuErpId: 'adjfaculty-cdc086@mbu.asia', camuPassword: 'FaceMbu@2026' },
];

await mongoose.connect(process.env.MONGODB_URI);

let updated = 0;
let missing = 0;

for (const entry of CAMU_UPDATES) {
  const trainer = await Trainer.findOne({ employeeId: entry.employeeId }).select('name employeeId');
  if (!trainer) {
    console.warn(`NOT FOUND: ${entry.employeeId}`);
    missing += 1;
    continue;
  }

  await Trainer.updateOne(
    { _id: trainer._id },
    {
      $set: {
        camuErpId: entry.camuErpId,
        camuPassword: entry.camuPassword,
      },
    }
  );
  console.log(`Updated ${entry.employeeId} (${trainer.name}) → ${entry.camuErpId}`);
  updated += 1;
}

console.log(`\nDone. Updated ${updated}, missing ${missing}.`);
await mongoose.disconnect();
