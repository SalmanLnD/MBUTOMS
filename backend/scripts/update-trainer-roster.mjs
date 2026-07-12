import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Trainer from '../models/Trainer.js';

dotenv.config();

const CAMU_PASSWORD = '#DEMO@123';

/** Finalized trainers: update email, phone, CAMU ERP ID, and password. */
const FINALIZED_ROSTER = [
  { employeeId: '135269', email: 'sharmila.murugesan@faceprep.in', phone: '6382785465', camuErpId: 'adjfaculty-cdc051@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135400', email: 'kommalapati.divya@faceprep.in', phone: '6302960070', camuErpId: 'adjfaculty-cdc052@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135401', email: 'vyshnavi.velugu@faceprep.in', phone: '7780385699', camuErpId: 'adjfaculty-cdc053@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135314', email: 'lavanya.palla@faceprep.in', phone: '8340014025', camuErpId: 'adjfaculty-cdc054@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135895', email: 'vasanth.raj@faceprep.in', phone: '9940740100', camuErpId: 'adjfaculty-cdc055@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135890', email: 'mangalagiri.jahnavi@faceprep.in', phone: '7995751975', camuErpId: 'adjfaculty-cdc056@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135301', email: 'navya.mallidi@faceprep.in', phone: '7382534114', camuErpId: 'adjfaculty-cdc057@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '131886', email: 'sai.priya@faceprep.in', phone: '7330911610', camuErpId: 'adjfaculty-cdc064@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135130', email: 'ravi.rao@faceprep.in', phone: '6302535289', camuErpId: 'adjfaculty-cdc072@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135621', email: 'nagasai.kamesh@faceprep.in', phone: '7989060918', camuErpId: 'adjfaculty-cdc073@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '136047', email: 'akuthota.praharsha@faceprep.in', phone: '9182000134', camuErpId: 'adjfaculty-cdc074@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135517', email: 'thanneru.laxmipriya@faceprep.in', phone: '9347490672', camuErpId: 'adjfaculty-cdc075@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '801406', email: 'harinisree.krishnamoorthi@faceprep.in', phone: '9345662275', camuErpId: 'adjfaculty-cdc076@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135402', email: 'barath.muthukumaran@faceprep.in', phone: '8591374136', camuErpId: 'adjfaculty-cdc077@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '135887', email: 'suraydeo.rana@faceprep.in', phone: '7979974981', camuErpId: 'adjfaculty-cdc084@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '136316', email: 'sumitkumar.gupta@faceprep.in', phone: '6306859275', camuErpId: 'adjfaculty-cdc058@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '801741', email: 'meghasree.srinivasan@faceprep.in', phone: '9176497147', camuErpId: 'adjfaculty-cdc060@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '801711', email: 'shaik.rahamthulla@faceprep.in', phone: '8978115263', camuErpId: 'adjfaculty-cdc061@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '801754', email: 'mahendra.urumu@faceprep.in', phone: '9014597169', camuErpId: 'adjfaculty-cdc062@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: '801777', email: 'aswini.murugan@faceprep.in', phone: '7339162641', camuErpId: 'adjfaculty-cdc065@mbu.asia', camuPassword: CAMU_PASSWORD },
];

/** Placeholder trainers: CAMU credentials only. */
const PLACEHOLDER_ROSTER = [
  { employeeId: 'PSTP-T9', camuErpId: 'adjfaculty-cdc066@mbu.asia', camuPassword: CAMU_PASSWORD },
  { employeeId: 'PSTJ1', camuErpId: 'adjfaculty-cdc083@mbu.asia', camuPassword: CAMU_PASSWORD },
];

const applyUpdate = async (entry, fields) => {
  const trainer = await Trainer.findOne({ employeeId: entry.employeeId });
  if (!trainer) {
    console.warn(`NOT FOUND: ${entry.employeeId}`);
    return false;
  }

  const update = {};
  fields.forEach((field) => {
    if (entry[field] !== undefined) {
      update[field] = entry[field];
    }
  });

  await Trainer.updateOne({ _id: trainer._id }, { $set: update });
  console.log(`Updated ${entry.employeeId} (${trainer.name}): ${Object.keys(update).join(', ')}`);
  return true;
};

await mongoose.connect(process.env.MONGODB_URI);

let updated = 0;
let missing = 0;

for (const entry of FINALIZED_ROSTER) {
  const ok = await applyUpdate(entry, ['email', 'phone', 'camuErpId', 'camuPassword']);
  if (ok) updated += 1;
  else missing += 1;
}

for (const entry of PLACEHOLDER_ROSTER) {
  const ok = await applyUpdate(entry, ['camuErpId', 'camuPassword']);
  if (ok) updated += 1;
  else missing += 1;
}

console.log(`\nDone. Updated ${updated} trainer(s), ${missing} not found.`);
await mongoose.disconnect();
