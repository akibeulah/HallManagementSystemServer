import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.warn(`requireAuth – missing token on ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    logger.warn(`requireAuth – invalid/expired token on ${req.method} ${req.originalUrl}: ${err.message}`);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
