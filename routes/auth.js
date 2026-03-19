import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireBabcockEmail } from '../middleware/emailDomain.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/auth/register
router.post('/register', requireBabcockEmail, async (req, res) => {
  try {
    const { firstname, lastname, email, password, gender, role, category, roomId, hallId } = req.body;

    if (await User.findOne({ email: email.toLowerCase() })) {
      logger.warn(`Registration blocked – email already exists: ${email}`);
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstname, lastname, email, passwordHash, gender,
      role: role || 'student', category, roomId, hallId,
    });

    logger.ok(`User registered: ${user.email} (role: ${user.role}, id: ${user._id})`);

    const token = jwt.sign(
      { id: user._id, role: user.role, gender: user.gender, hallId: user.hallId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id, firstname: user.firstname, lastname: user.lastname,
        email: user.email, role: user.role, gender: user.gender,
      },
    });
  } catch (err) {
    logger.error('POST /auth/register failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user) {
      logger.warn(`Login failed – unknown email: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      logger.warn(`Login failed – wrong password for: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    logger.ok(`User logged in: ${user.email} (role: ${user.role}, id: ${user._id})`);

    const token = jwt.sign(
      { id: user._id, role: user.role, gender: user.gender, hallId: user.hallId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id, firstname: user.firstname, lastname: user.lastname,
        email: user.email, role: user.role, gender: user.gender,
        hallId: user.hallId, roomId: user.roomId,
      },
    });
  } catch (err) {
    logger.error('POST /auth/login failed:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
