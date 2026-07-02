import Venue from '../models/Venue.js';

const buildVenueQuery = (query) => {
  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { building: searchRegex },
      { floor: searchRegex },
    ];
  }
  return filter;
};

export const getVenues = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = buildVenueQuery(req.query);
  const sortField = ['name', 'building', 'capacity', 'createdAt'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'name';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

  const [venues, total] = await Promise.all([
    Venue.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
    Venue.countDocuments(filter),
  ]);

  res.json({
    venues,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getVenueById = async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return res.status(404).json({ message: 'Venue not found' });
  res.json(venue);
};

export const createVenue = async (req, res) => {
  const existing = await Venue.findOne({
    name: req.body.name,
    building: req.body.building,
  });
  if (existing) {
    return res.status(400).json({ message: 'Venue with this name and building already exists' });
  }

  const venue = await Venue.create(req.body);
  res.status(201).json(venue);
};

export const updateVenue = async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return res.status(404).json({ message: 'Venue not found' });

  if (req.body.name || req.body.building) {
    const conflict = await Venue.findOne({
      _id: { $ne: req.params.id },
      name: req.body.name || venue.name,
      building: req.body.building || venue.building,
    });
    if (conflict) {
      return res.status(400).json({ message: 'Venue with this name and building already exists' });
    }
  }

  Object.assign(venue, req.body);
  await venue.save();
  res.json(venue);
};

export const deleteVenue = async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return res.status(404).json({ message: 'Venue not found' });
  await venue.deleteOne();
  res.json({ message: 'Venue removed' });
};
