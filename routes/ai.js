import { Router } from 'express';
import AIConfig from '../models/AIConfig.js';
import { encrypt } from '../utils/encryption.js';
import { testAIConnection } from '../services/aiService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/admin/ai-config
router.get('/ai-config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const config = await AIConfig.findOne().select('-apiKey');
    logger.info(`AI config fetched [admin:${req.user.id}]`);
    res.json(config || {});
  } catch (err) {
    logger.error('GET /admin/ai-config failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/ai-config — save/update API key
router.post('/ai-config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { apiKey, model, isActive } = req.body;
    const encryptedKey = encrypt(apiKey);

    const existing = await AIConfig.findOne();
    if (existing) {
      existing.apiKey = encryptedKey;
      if (model) existing.model = model;
      if (isActive !== undefined) existing.isActive = isActive;
      existing.updatedBy = req.user.id;
      await existing.save();
      logger.ok(`AI config updated – model:${existing.model} active:${existing.isActive} [admin:${req.user.id}]`);
      return res.json({ message: 'AI config updated' });
    }

    const created = await AIConfig.create({
      apiKey: encryptedKey,
      model: model || 'claude-opus-4-6',
      isActive: isActive !== undefined ? isActive : true,
      updatedBy: req.user.id,
    });
    logger.ok(`AI config created – model:${created.model} active:${created.isActive} [admin:${req.user.id}]`);
    res.status(201).json({ message: 'AI config saved' });
  } catch (err) {
    logger.error('POST /admin/ai-config failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// POST /api/admin/ai-config/test
router.post('/ai-config/test', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    logger.info(`AI connection test initiated – model:${model} [admin:${req.user.id}]`);

    const response = await testAIConnection(apiKey, model);

    await AIConfig.findOneAndUpdate({}, { lastTestedAt: new Date() }, { upsert: false });

    logger.ok(`AI connection test succeeded [admin:${req.user.id}]`);
    res.json({ success: true, response });
  } catch (err) {
    logger.error(`AI connection test failed [admin:${req.user.id}]:`, err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
