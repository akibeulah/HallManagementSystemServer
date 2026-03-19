import { Router } from 'express';
import Hall from '../models/Hall.js';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/halls — admin gets all halls; others filtered by gender
router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { gender: req.user.gender };
    const halls = await Hall.find(filter);
    logger.info(`Halls fetched – ${halls.length} records [user:${req.user.id} role:${req.user.role}]`);
    res.json(halls);
  } catch (err) {
    logger.error('GET /halls failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/halls/:id/rooms
router.get('/:id/rooms', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find({ hallId: req.params.id });
    logger.info(`Rooms fetched – ${rooms.length} records for hall:${req.params.id} [user:${req.user.id}]`);
    res.json(rooms);
  } catch (err) {
    logger.error(`GET /halls/${req.params.id}/rooms failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/halls — admin creates hall
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const hall = await Hall.create(req.body);
    logger.ok(`Hall created: "${hall.name}" (id:${hall._id}) [admin:${req.user.id}]`);
    res.status(201).json(hall);
  } catch (err) {
    logger.error('POST /halls failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/halls/:id — admin updates hall
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const hall = await Hall.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!hall) {
      logger.warn(`PATCH /halls/${req.params.id} – hall not found`);
      return res.status(404).json({ message: 'Hall not found' });
    }
    logger.ok(`Hall:${req.params.id} updated – "${hall.name}" [admin:${req.user.id}]`);
    res.json(hall);
  } catch (err) {
    logger.error(`PATCH /halls/${req.params.id} failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/halls/:id — admin deletes hall and all its rooms
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { deletedCount } = await Room.deleteMany({ hallId: req.params.id });
    const hall = await Hall.findByIdAndDelete(req.params.id);
    if (hall) {
      logger.ok(`Hall deleted: "${hall.name}" (id:${req.params.id}) + ${deletedCount} rooms [admin:${req.user.id}]`);
    } else {
      logger.warn(`DELETE /halls/${req.params.id} – hall not found`);
    }
    res.status(204).end();
  } catch (err) {
    logger.error(`DELETE /halls/${req.params.id} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/halls/:id/rooms — admin adds room to hall
router.post('/:id/rooms', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const room = await Room.create({ ...req.body, hallId: req.params.id });
    logger.ok(`Room created: "${room.roomNumber}" in hall:${req.params.id} (id:${room._id}) [admin:${req.user.id}]`);
    res.status(201).json(room);
  } catch (err) {
    logger.error(`POST /halls/${req.params.id}/rooms failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/halls/:id/rooms/:roomId — admin updates room
router.patch('/:id/rooms/:roomId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.roomId, req.body, { new: true, runValidators: true });
    if (!room) {
      logger.warn(`PATCH /halls/${req.params.id}/rooms/${req.params.roomId} – room not found`);
      return res.status(404).json({ message: 'Room not found' });
    }
    logger.ok(`Room:${req.params.roomId} updated to "${room.roomNumber}" in hall:${req.params.id} [admin:${req.user.id}]`);
    res.json(room);
  } catch (err) {
    logger.error(`PATCH /halls/${req.params.id}/rooms/${req.params.roomId} failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/halls/:id/rooms/:roomId — admin deletes room
router.delete('/:id/rooms/:roomId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.roomId);
    if (room) {
      logger.ok(`Room:${req.params.roomId} ("${room.roomNumber}") deleted from hall:${req.params.id} [admin:${req.user.id}]`);
    } else {
      logger.warn(`DELETE /halls/${req.params.id}/rooms/${req.params.roomId} – room not found`);
    }
    res.status(204).end();
  } catch (err) {
    logger.error(`DELETE /halls/${req.params.id}/rooms/${req.params.roomId} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
