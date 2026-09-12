// Slow-request diagnostics contain paths, never query strings/export keys.
export const requestMetrics = (req, res, next) => {
  const start = performance.now();
  const route = req.path;
  res.once('finish', () => {
    const durationMs = Math.round(performance.now() - start);
    if (durationMs >= 2000 || res.statusCode >= 500) {
      console.warn(JSON.stringify({ event: 'slow_request', method: req.method,
        path: route, status: res.statusCode, durationMs,
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        uptimeSeconds: Math.round(process.uptime()) }));
    }
  });
  next();
};
