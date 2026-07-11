/**
 * Campus room-number → building / floor rules.
 * Room names in TOMS are usually numeric strings (e.g. "1702", "123A").
 */

export const VENUE_MAPPING_REFERENCE = [
  {
    rooms: '122–133',
    building: 'M Block West',
    floor: 'Ground Floor',
    notes: 'West wing, ground level',
  },
  {
    rooms: '221–233',
    building: 'M Block West',
    floor: '1st Floor',
    notes: 'West wing, first floor',
  },
  {
    rooms: '101–106',
    building: 'M Block East',
    floor: 'Ground Floor',
    notes: 'East wing, ground level',
  },
  {
    rooms: '201–208',
    building: 'M Block East',
    floor: '1st Floor',
    notes: 'East wing, first floor',
  },
  {
    rooms: '301–308',
    building: 'M Block East',
    floor: '2nd Floor',
    notes: 'East wing, second floor',
  },
  {
    rooms: '322–333',
    building: 'M Block West',
    floor: '2nd Floor',
    notes: 'West wing, second floor',
  },
  {
    rooms: '501–599',
    building: 'MNS Block',
    floor: '1st Floor',
    notes: '500 series',
  },
  {
    rooms: '600–699',
    building: 'MNS Block',
    floor: '2nd Floor',
    notes: '600 series',
  },
  {
    rooms: '700–799',
    building: 'MNS Block',
    floor: '3rd Floor',
    notes: '700 series',
  },
  {
    rooms: '800–822',
    building: 'MNS Block',
    floor: '4th Floor',
    notes: '800 series',
  },
  {
    rooms: '1700–2000',
    building: 'Diploma Block',
    floor: '',
    notes: 'Diploma block rooms',
  },
  {
    rooms: '2100–2455',
    building: 'Civil Block',
    floor: '',
    notes: 'Civil block rooms',
  },
  {
    rooms: '2501–2805',
    building: 'Mechanical Block',
    floor: '',
    notes: 'Mechanical block rooms',
  },
  {
    rooms: '4100–4400',
    building: 'NAB Block',
    floor: '',
    notes: 'NAB block rooms',
  },
];

const IN_RANGE = (value, min, max) => value >= min && value <= max;

export const parseVenueNumber = (name) => {
  const match = String(name || '').trim().match(/^(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveVenueLocation = (venueNumberOrName) => {
  const roomNumber = typeof venueNumberOrName === 'number'
    ? venueNumberOrName
    : parseVenueNumber(venueNumberOrName);

  if (roomNumber == null) return null;

  if (IN_RANGE(roomNumber, 122, 133)) {
    return { building: 'M Block West', floor: 'Ground Floor', block: 'M Block West' };
  }
  if (IN_RANGE(roomNumber, 221, 233)) {
    return { building: 'M Block West', floor: '1st Floor', block: 'M Block West' };
  }
  if (IN_RANGE(roomNumber, 101, 106)) {
    return { building: 'M Block East', floor: 'Ground Floor', block: 'M Block East' };
  }
  if (IN_RANGE(roomNumber, 201, 208)) {
    return { building: 'M Block East', floor: '1st Floor', block: 'M Block East' };
  }
  if (IN_RANGE(roomNumber, 301, 308)) {
    return { building: 'M Block East', floor: '2nd Floor', block: 'M Block East' };
  }
  if (IN_RANGE(roomNumber, 322, 333)) {
    return { building: 'M Block West', floor: '2nd Floor', block: 'M Block West' };
  }
  if (IN_RANGE(roomNumber, 501, 599)) {
    return { building: 'MNS Block', floor: '1st Floor', block: 'MNS Block' };
  }
  if (IN_RANGE(roomNumber, 600, 699)) {
    return { building: 'MNS Block', floor: '2nd Floor', block: 'MNS Block' };
  }
  if (IN_RANGE(roomNumber, 700, 799)) {
    return { building: 'MNS Block', floor: '3rd Floor', block: 'MNS Block' };
  }
  if (IN_RANGE(roomNumber, 800, 822)) {
    return { building: 'MNS Block', floor: '4th Floor', block: 'MNS Block' };
  }
  if (IN_RANGE(roomNumber, 1700, 2000)) {
    return { building: 'Diploma Block', floor: '', block: 'Diploma Block' };
  }
  if (IN_RANGE(roomNumber, 2100, 2455)) {
    return { building: 'Civil Block', floor: '', block: 'Civil Block' };
  }
  if (IN_RANGE(roomNumber, 2501, 2805)) {
    return { building: 'Mechanical Block', floor: '', block: 'Mechanical Block' };
  }
  if (IN_RANGE(roomNumber, 4100, 4400)) {
    return { building: 'NAB Block', floor: '', block: 'NAB Block' };
  }

  return null;
};

export const getVenueLocationFields = (venueNumberOrName) => {
  const location = resolveVenueLocation(venueNumberOrName);
  if (!location) return null;
  return {
    building: location.building,
    floor: location.floor,
  };
};

export const enrichVenueRecord = (venue) => {
  const plain = venue?.toObject ? venue.toObject() : { ...venue };
  const mapped = resolveVenueLocation(plain.name);
  const displayBuilding = mapped?.building || plain.building || '';
  const displayFloor = mapped?.floor || plain.floor || '';

  return {
    ...plain,
    mappedLocation: mapped,
    displayBuilding,
    displayFloor,
    locationSummary: [displayBuilding, displayFloor].filter(Boolean).join(' · ') || displayBuilding || '—',
  };
};

export const buildVenueUpsertFields = (venueNumber, {
  capacity = 60,
  type = 'classroom',
  isActive = true,
} = {}) => {
  const name = String(venueNumber);
  const location = getVenueLocationFields(name);

  return {
    name,
    building: location?.building || 'Unmapped',
    floor: location?.floor || '',
    capacity,
    type,
    isActive,
  };
};
