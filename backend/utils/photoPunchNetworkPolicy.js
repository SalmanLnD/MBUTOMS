// Explicit local trial exception; forwarded/deployed traffic must still pass reputation checks.
export const allowsLocalPunchTrial = (req, env = process.env) =>
  env.PUNCH_LOCAL_TRIAL_ALLOW_UNVERIFIED_NETWORK === 'true'
  && env.NODE_ENV !== 'production'
  && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)
  && ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname)
  && !req.headers['x-forwarded-for']
  && !req.headers.forwarded;
