import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { logger } from './utils/logger.js';

import authRoutes      from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import assetRoutes     from './routes/assets.js';
import hallRoutes      from './routes/halls.js';
import userRoutes      from './routes/users.js';
import aiRoutes        from './routes/ai.js';

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://hallmanagementsystemserver.onrender.com',
  'https://hallmanagementsystemclient.onrender.com',
];

app.use(cors({
  origin(origin, cb) {
    // Allow server-to-server / curl requests with no Origin header
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    logger.warn(`CORS blocked request from origin: ${origin}`);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// ── HTTP access log ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.http(req.method, req.originalUrl, res.statusCode, Date.now() - start, req.user?.id);
  });
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/assets',     assetRoutes);
app.use('/api/halls',      hallRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/admin',      aiRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 – ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`Unhandled exception on ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: 'Internal server error' });
});

// ── DB + server start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.ok('MongoDB connected');
    app.listen(PORT, () => logger.ok(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
