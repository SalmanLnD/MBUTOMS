// A successful write invalidates derived, process-local reports immediately.
let revision = 0;
export const getDataRevision = () => revision;
export const invalidateDerivedData = () => { revision += 1; };

export const invalidateAfterWrite = (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.once('finish', () => {
      if (res.statusCode < 400) invalidateDerivedData();
    });
  }
  next();
};
