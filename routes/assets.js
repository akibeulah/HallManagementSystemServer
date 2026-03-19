import { Router } from 'express';
import Item from '../models/Item.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/assets/search — any authenticated user can search assets for a given hall
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { hallId, q } = req.query;
    if (!hallId) return res.status(400).json({ message: 'hallId query param is required' });

    // Students may only search their own hall
    if (req.user.role === 'student' && String(req.user.hallId) !== String(hallId)) {
      logger.warn(`Student:${req.user.id} tried to search assets for foreign hall:${hallId}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter = { hallId };
    if (q) filter.name = { $regex: q, $options: 'i' };

    const items = await Item.find(filter).limit(30).select('name type condition');
    logger.info(`Asset search – hall:${hallId} q:"${q || ''}" → ${items.length} results [user:${req.user.id}]`);
    res.json(items);
  } catch (err) {
    logger.error('GET /assets/search failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/assets
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.hallId) filter.hallId = req.query.hallId;
    const items = await Item.find(filter).populate('hallId', 'name campus');
    logger.info(`Assets fetched – ${items.length} records${req.query.hallId ? ` (hall:${req.query.hallId})` : ''} [admin:${req.user.id}]`);
    res.json(items);
  } catch (err) {
    logger.error('GET /assets failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/assets/due — items overdue for maintenance
router.get('/due', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const today = new Date();
    const items = await Item.find({ nextMaintenanceDue: { $lte: today } }).populate('hallId', 'name campus');
    if (items.length > 0) {
      logger.warn(`Overdue assets check – ${items.length} asset(s) past maintenance date [admin:${req.user.id}]`);
    } else {
      logger.info(`Overdue assets check – none overdue [admin:${req.user.id}]`);
    }
    res.json(items);
  } catch (err) {
    logger.error('GET /assets/due failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/assets
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await Item.create(req.body);
    logger.ok(`Asset created: "${item.name}" (type:${item.type}, hall:${item.hallId}, qty:${item.quantity}) [admin:${req.user.id}]`);
    res.status(201).json(item);
  } catch (err) {
    logger.error('POST /assets failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/assets/:id
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) {
      logger.warn(`PATCH /assets/${req.params.id} – asset not found`);
      return res.status(404).json({ message: 'Asset not found' });
    }
    logger.ok(`Asset:${req.params.id} updated – "${item.name}" condition:${item.condition} [admin:${req.user.id}]`);
    res.json(item);
  } catch (err) {
    logger.error(`PATCH /assets/${req.params.id} failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (item) {
      logger.ok(`Asset deleted: "${item.name}" (id:${req.params.id}) [admin:${req.user.id}]`);
    } else {
      logger.warn(`DELETE /assets/${req.params.id} – asset not found`);
    }
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    logger.error(`DELETE /assets/${req.params.id} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
