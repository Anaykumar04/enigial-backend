/**
 * Enigoal — Auth Routes
 */

const router      = require('express').Router();
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');
const rateLimit   = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticate } = require('../middleware/auth');

// Rate limiter: max 10 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// ── POST /api/auth/login ─────────────────────────────────────────
router.post('/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email, isActive: true }).select('+password');
      if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

      // Compare using bcrypt directly — no dependency on model method
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      await ActivityLog.create({
        user: user._id, userEmail: user.email,
        action: 'LOGIN',
        description: `${user.name} logged in`,
      });

      res.json({
        success: true,
        token,
        user: { id: user._id, email: user.email, role: user.role, name: user.name },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, email: req.user.email, role: req.user.role, name: req.user.name },
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  await ActivityLog.create({
    user: req.user._id, userEmail: req.user.email,
    action: 'LOGOUT',
    description: `${req.user.name} logged out`,
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;