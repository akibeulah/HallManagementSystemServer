import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash')
      .populate('hallId', 'name campus gender')
      .populate('roomId', 'roomNumber');
    if (!user) {
      logger.warn(`GET /users/me – user not found: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    logger.error('GET /users/me failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/officers — admin gets list of maintenance officers
router.get('/officers', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const filter = { role: 'maintenance_officer' };
    if (req.query.category) filter.category = req.query.category;
    const officers = await User.find(filter).select('-passwordHash');
    logger.info(`Officers fetched – ${officers.length} results${req.query.category ? ` (category:${req.query.category})` : ''} [admin:${req.user.id}]`);
    res.json(officers);
  } catch (err) {
    logger.error('GET /users/officers failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users — admin lists all users
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash')
      .populate('hallId', 'name')
      .populate('roomId', 'roomNumber');
    logger.info(`All users fetched – ${users.length} records [admin:${req.user.id}]`);
    res.json(users);
  } catch (err) {
    logger.error('GET /users failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id — admin views single user
router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash')
      .populate('hallId', 'name campus gender')
      .populate('roomId', 'roomNumber');
    if (!user) {
      logger.warn(`GET /users/${req.params.id} – not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.info(`User:${req.params.id} fetched by admin:${req.user.id}`);
    res.json(user);
  } catch (err) {
    logger.error(`GET /users/${req.params.id} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users — admin creates a user
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { firstname, lastname, email, password, gender, role, category, hallId, roomId } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const userData = { firstname, lastname, email, passwordHash, gender, role };
    if (role === 'maintenance_officer' && category) userData.category = category;
    if (role === 'student' && hallId) userData.hallId = hallId;
    if (role === 'student' && roomId) userData.roomId = roomId;
    const user = await User.create(userData);
    logger.ok(`User created: ${user.email} (role:${user.role}, id:${user._id}) [admin:${req.user.id}]`);
    const out = user.toObject();
    delete out.passwordHash;
    res.status(201).json(out);
  } catch (err) {
    logger.error('POST /users failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/users/:id — admin updates a user
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { password, ...fields } = req.body;
    if (password) fields.passwordHash = await bcrypt.hash(password, 12);
    if (fields.role && fields.role !== 'maintenance_officer') fields.category = undefined;
    if (fields.role && fields.role !== 'student') { fields.hallId = undefined; fields.roomId = undefined; }
    Object.keys(fields).forEach((k) => { if (fields[k] === undefined || fields[k] === '') delete fields[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
      .select('-passwordHash')
      .populate('hallId', 'name')
      .populate('roomId', 'roomNumber');
    if (!user) {
      logger.warn(`PATCH /users/${req.params.id} – user not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.ok(`User:${req.params.id} updated by admin:${req.user.id} – fields: ${Object.keys(fields).join(', ')}`);
    res.json(user);
  } catch (err) {
    logger.error(`PATCH /users/${req.params.id} failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/users/:id — admin deletes a user
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      logger.warn(`Admin:${req.user.id} attempted to delete their own account – blocked`);
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (user) {
      logger.ok(`User deleted: ${user.email} (id:${req.params.id}) [admin:${req.user.id}]`);
    } else {
      logger.warn(`DELETE /users/${req.params.id} – user not found`);
    }
    res.status(204).end();
  } catch (err) {
    logger.error(`DELETE /users/${req.params.id} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
