import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import ComplaintHistory from '../models/ComplaintHistory.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { generateAISuggestion } from '../services/aiService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/complaints
router.get('/', requireAuth, requireRole('maintenance_officer', 'admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'maintenance_officer') {
      // Officers only see complaints explicitly assigned to them
      filter.assignedTo = req.user.id;
    }
    const complaints = await Complaint.find(filter)
      .populate('userId',     'firstname lastname')
      .populate('roomId',     'roomNumber')
      .populate('assignedTo', 'firstname lastname')
      .populate('itemIds',    'name type condition')
      .sort({ createdAt: -1 });

    logger.info(`Complaints fetched – ${complaints.length} records [user:${req.user.id} role:${req.user.role}]`);
    res.json(complaints);
  } catch (err) {
    logger.error('GET /complaints failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/complaints/ai-preview — student gets AI diagnostics before submitting
router.post('/ai-preview', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { category, message } = req.body;
    if (!category || !message) {
      return res.status(400).json({ message: 'category and message are required' });
    }
    logger.info(`AI preview requested by student:${req.user.id} (${category})`);
    const suggestion = await generateAISuggestion(category, message);
    if (!suggestion) {
      logger.warn(`AI preview returned null for student:${req.user.id} – AI may not be configured`);
      return res.json({ suggestion: null });
    }
    logger.ok(`AI preview returned ${suggestion.length} chars for student:${req.user.id}`);
    res.json({ suggestion });
  } catch (err) {
    logger.error(`POST /complaints/ai-preview failed for student:${req.user.id}:`, err.message);
    res.status(500).json({ message: 'AI preview failed', suggestion: null });
  }
});

// GET /api/complaints/mine — student's own complaints
router.get('/mine', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.id })
      .populate('assignedTo', 'firstname lastname category')
      .populate('roomId',     'roomNumber')
      .populate('itemIds',    'name type condition')
      .sort({ createdAt: -1 });
    logger.info(`Student complaints fetched – ${complaints.length} records [user:${req.user.id}]`);
    res.json(complaints);
  } catch (err) {
    logger.error('GET /complaints/mine failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/complaints
router.post('/', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { message, category, itemId, itemIds, otherItem, priority } = req.body;

    const complaint = await Complaint.create({
      message, category, itemId, itemIds: itemIds || [], otherItem, priority,
      roomId: req.user.roomId || req.body.roomId,
      userId: req.user.id,
      status: 'logged',
    });

    logger.ok(`New complaint created – id:${complaint._id} category:${category} priority:${priority} [student:${req.user.id}]`);

    // AI suggestion — async, non-blocking
    logger.info(`Triggering AI suggestion for complaint:${complaint._id} (${category})`);
    generateAISuggestion(category, message)
      .then(async (suggestion) => {
        if (suggestion) {
          await Complaint.findByIdAndUpdate(complaint._id, {
            aiSuggestion: suggestion,
            aiGeneratedAt: new Date(),
          });
          logger.ok(`AI suggestion saved for complaint:${complaint._id}`);
        } else {
          logger.warn(`AI suggestion returned null for complaint:${complaint._id}`);
        }
      })
      .catch((err) => {
        logger.error(`AI suggestion failed for complaint:${complaint._id}:`, err.message);
      });

    res.status(201).json(complaint);
  } catch (err) {
    logger.error('POST /complaints failed:', err);
    res.status(400).json({ message: err.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId',     'firstname lastname email')
      .populate('roomId',     'roomNumber')
      .populate('assignedTo', 'firstname lastname category')
      .populate('assignedBy', 'firstname lastname')
      .populate('itemIds',    'name type condition');

    if (!complaint) {
      logger.warn(`Complaint not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Not found' });
    }

    // Auto-mark as 'seen' when officer opens complaint
    if (req.user.role === 'maintenance_officer' && complaint.status === 'logged') {
      const old = complaint.status;
      complaint.status = 'seen';
      await complaint.save();
      await ComplaintHistory.create({
        complaintId: complaint._id,
        changedBy: req.user.id,
        oldStatus: old,
        newStatus: 'seen',
      });
      logger.ok(`Complaint:${complaint._id} auto-marked seen by officer:${req.user.id}`);
    }

    logger.info(`Complaint:${req.params.id} fetched by user:${req.user.id} (${req.user.role})`);
    res.json(complaint);
  } catch (err) {
    logger.error(`GET /complaints/${req.params.id} failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/complaints/:id/status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('maintenance_officer', 'admin'),
  async (req, res) => {
    try {
      const { status, notes, assignedTo } = req.body;
      const complaint = await Complaint.findById(req.params.id);
      if (!complaint) {
        logger.warn(`Status update failed – complaint not found: ${req.params.id}`);
        return res.status(404).json({ message: 'Not found' });
      }

      // Officers may only update complaints assigned to them
      if (
        req.user.role === 'maintenance_officer' &&
        String(complaint.assignedTo) !== String(req.user.id)
      ) {
        logger.warn(`Officer:${req.user.id} tried to update unassigned complaint:${req.params.id}`);
        return res.status(403).json({ message: 'You can only update complaints assigned to you' });
      }

      const oldStatus = complaint.status;
      complaint.status = status;
      if (assignedTo) complaint.assignedTo = assignedTo;
      if (req.user.role === 'admin' && assignedTo) complaint.assignedBy = req.user.id;
      if (status === 'done') complaint.resolvedAt = new Date();
      await complaint.save();

      await ComplaintHistory.create({
        complaintId: complaint._id,
        changedBy: req.user.id,
        oldStatus,
        newStatus: status,
        notes,
      });

      logger.ok(
        `Complaint:${complaint._id} status changed: ${oldStatus} → ${status}` +
        `${assignedTo ? ` (assigned to:${assignedTo})` : ''}` +
        ` [by user:${req.user.id}]`
      );

      res.json(complaint);
    } catch (err) {
      logger.error(`PATCH /complaints/${req.params.id}/status failed:`, err);
      res.status(400).json({ message: err.message });
    }
  }
);

// GET /api/complaints/:id/history
router.get('/:id/history', requireAuth, requireRole('maintenance_officer', 'admin'), async (req, res) => {
  try {
    const history = await ComplaintHistory.find({ complaintId: req.params.id })
      .populate('changedBy', 'firstname lastname role')
      .sort({ createdAt: 1 });

    logger.info(`Complaint history fetched – ${history.length} entries for complaint:${req.params.id}`);
    res.json(history);
  } catch (err) {
    logger.error(`GET /complaints/${req.params.id}/history failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/complaints/:id/comments — officer, admin, or student (own complaint) adds a comment
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      logger.warn(`POST /complaints/${req.params.id}/comments – complaint not found`);
      return res.status(404).json({ message: 'Not found' });
    }

    const role = req.user.role;

    // Students may only comment on their own complaints
    if (role === 'student' && String(complaint.userId) !== String(req.user.id)) {
      logger.warn(`Student:${req.user.id} tried to comment on someone else's complaint:${req.params.id}`);
      return res.status(403).json({ message: 'You can only comment on your own complaints' });
    }

    // Officers can only comment on complaints assigned to them
    if (role === 'maintenance_officer' && String(complaint.assignedTo) !== String(req.user.id)) {
      logger.warn(`Officer:${req.user.id} tried to comment on unassigned complaint:${req.params.id}`);
      return res.status(403).json({ message: 'You can only comment on complaints assigned to you' });
    }

    const entry = await ComplaintHistory.create({
      complaintId: complaint._id,
      changedBy: req.user.id,
      type: 'comment',
      notes: text.trim(),
    });

    const populated = await entry.populate('changedBy', 'firstname lastname role');
    logger.ok(`Comment added to complaint:${req.params.id} by ${role}:${req.user.id}`);
    res.status(201).json(populated);
  } catch (err) {
    logger.error(`POST /complaints/${req.params.id}/comments failed:`, err);
    res.status(400).json({ message: err.message });
  }
});

// POST /api/complaints/:id/contest — student contests a done complaint → needs_review
router.post('/:id/contest', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      logger.warn(`Contest failed – complaint not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Not found' });
    }
    if (String(complaint.userId) !== String(req.user.id)) {
      logger.warn(`Student:${req.user.id} tried to contest complaint they don't own: ${req.params.id}`);
      return res.status(403).json({ message: 'You can only contest your own complaints' });
    }
    if (complaint.status !== 'done') {
      return res.status(400).json({ message: 'Only completed complaints can be contested' });
    }

    const { reason } = req.body;
    complaint.status = 'needs_review';
    await complaint.save();

    await ComplaintHistory.create({
      complaintId: complaint._id,
      changedBy: req.user.id,
      type: 'status_change',
      oldStatus: 'done',
      newStatus: 'needs_review',
      notes: reason ? `Student contested: ${reason}` : 'Student contested completion',
    });

    logger.ok(`Complaint:${req.params.id} contested by student:${req.user.id} → needs_review`);
    res.json({ message: 'Complaint marked for review', status: 'needs_review' });
  } catch (err) {
    logger.error(`POST /complaints/${req.params.id}/contest failed:`, err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/complaints/:id/assign — admin assigns or reassigns without changing status
router.patch(
  '/:id/assign',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { assignedTo } = req.body;
      const complaint = await Complaint.findById(req.params.id);
      if (!complaint) {
        logger.warn(`PATCH /complaints/${req.params.id}/assign – complaint not found`);
        return res.status(404).json({ message: 'Not found' });
      }

      const prev = complaint.assignedTo;
      complaint.assignedTo = assignedTo || null;
      complaint.assignedBy = req.user.id;
      await complaint.save();

      await ComplaintHistory.create({
        complaintId: complaint._id,
        changedBy: req.user.id,
        type: 'status_change',
        oldStatus: complaint.status,
        newStatus: complaint.status,
        notes: assignedTo
          ? `Assigned to officer (id:${assignedTo})`
          : `Unassigned (was id:${prev})`,
      });

      const populated = await Complaint.findById(complaint._id)
        .populate('userId',     'firstname lastname email')
        .populate('roomId',     'roomNumber')
        .populate('assignedTo', 'firstname lastname category')
        .populate('assignedBy', 'firstname lastname');

      logger.ok(
        `Complaint:${req.params.id} assigned to ${assignedTo || 'nobody'} [admin:${req.user.id}]`
      );
      res.json(populated);
    } catch (err) {
      logger.error(`PATCH /complaints/${req.params.id}/assign failed:`, err);
      res.status(400).json({ message: err.message });
    }
  }
);

export default router;
