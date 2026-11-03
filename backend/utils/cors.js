const DEFAULT_ORIGINS = [
  'https://mbutoms.onrender.com',
  'https://mbutoms.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

export const getAllowedOrigins = () =>
  (process.env.CLIENT_URL || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
};

export const applyCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (!origin || !isOriginAllowed(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
};

export const corsOriginCallback = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, origin || true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
};
