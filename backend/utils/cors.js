const DEFAULT_ORIGINS = ['http://localhost:5173'];

export const getAllowedOrigins = () =>
  (process.env.CLIENT_URL || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/[\w-]+\.onrender\.com$/.test(origin)) return true;
  return false;
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
