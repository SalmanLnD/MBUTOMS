import Venue from '../models/Venue.js';
import { buildVenueUpsertFields } from './venueBuildingMappings.js';

export const upsertVenueByNumber = async (venueNumber, options = {}) => {
  const fields = buildVenueUpsertFields(venueNumber, options);
  return Venue.findOneAndUpdate(
    { name: fields.name },
    fields,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};
