import { logger } from '../utils/logger.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(
        `requireRole – forbidden: user:${req.user?.id} has role "${req.user?.role}", ` +
        `needs one of [${roles.join(', ')}] on ${req.method} ${req.originalUrl}`
      );
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
}
