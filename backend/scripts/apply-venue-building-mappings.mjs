import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Venue from '../models/Venue.js';
import {
  getVenueLocationFields,
  resolveVenueLocation,
} from '../utils/venueBuildingMappings.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const venues = await Venue.find().sort({ name: 1 });

let updated = 0;
let unmapped = 0;

for (const venue of venues) {
  const location = getVenueLocationFields(venue.name);
  if (!location) {
    unmapped += 1;
    continue;
  }

  const changed =
    venue.building !== location.building
    || (venue.floor || '') !== (location.floor || '');

  if (!changed) continue;

  venue.building = location.building;
  venue.floor = location.floor;
  await venue.save();
  updated += 1;
}

console.log(`Venue location mapping complete: ${updated} updated, ${unmapped} unmapped (of ${venues.length} total).`);

const samples = ['122', '221', '1702', '2603', '4220', '513', '333'];
samples.forEach((name) => {
  const loc = resolveVenueLocation(name);
  console.log(`${name}: ${loc ? `${loc.building}${loc.floor ? ` · ${loc.floor}` : ''}` : 'unmapped'}`);
});

await mongoose.disconnect();
