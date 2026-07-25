/**
 * Enigoal — Users Routes (Admin only)
 */

const router      = require('express').Router();
const bcrypt      = require('bcryptjs');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// ── GET /api/users ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const normalized = users.map(u => ({ ...u, _id: u._id.toString() }));
    res.json({ success: true, total: normalized.length, data: normalized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { ...user, _id: user._id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/users ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !name.trim())            return res.status(400).json({ success: false, message: 'Name is required' });
  if (!email || !email.trim())          return res.status(400).json({ success: false, message: 'Email is required' });
  if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  if (!role || !['admin', 'user'].includes(role)) return res.status(400).json({ success: false, message: 'Role must be admin or user' });

  try {
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ success: false, message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name:          name.trim(),
      email:         email.toLowerCase().trim(),
      password:      hashed,
      plainPassword: password,   // store plain for admin visibility
      role,
    });

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'USER_CREATED',
      description: `Created user "${user.name}" (${user.email}) with role: ${user.role}`,
    });

    const userObj = user.toObject();
    res.status(201).json({ success: true, data: { ...userObj, _id: userObj._id.toString() } });
  } catch (err) {
    console.error('POST /api/users error:', err.message, 'code:', err.code);
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already in use' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, role } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
  if (!role || !['admin', 'user'].includes(role)) return res.status(400).json({ success: false, message: 'Role must be admin or user' });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin' && role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: 'Cannot demote the last admin' });
    }

    user.name = name.trim();
    user.role = role;
    await user.save();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'USER_UPDATED',
      description: `Updated user "${user.name}" (${user.email})`,
    });

    const userObj = user.toObject();
    res.json({ success: true, data: { ...userObj, _id: userObj._id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/users/:id/password ────────────────────────────────
router.patch('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password      = await bcrypt.hash(password, 10);
    user.plainPassword = password;   // update plain too
    await user.save();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'PASSWORD_CHANGED',
      description: `Changed password for "${user.name}" (${user.email})`,
    });

    const userObj = user.toObject();
    res.json({ success: true, message: 'Password updated successfully', data: { ...userObj, _id: userObj._id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/users/:id/plain-password ──────────────────────────
// Records the plain-text password for admin visibility only.
// Use this for existing users whose plainPassword was never stored.
// Does NOT change the actual bcrypt auth password.
router.patch('/:id/plain-password', async (req, res) => {
  const { plainPassword } = req.body;
  if (!plainPassword || !plainPassword.trim()) {
    return res.status(400).json({ success: false, message: 'plainPassword is required' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.plainPassword = plainPassword.trim();
    await user.save();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'PASSWORD_CHANGED',
      description: `Recorded plain password for "${user.name}" (${user.email})`,
    });

    const userObj = user.toObject();
    res.json({ success: true, data: { ...userObj, _id: userObj._id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/users/:id/status ──────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    if (user.role === 'admin' && !isActive) {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: 'Cannot deactivate the last admin' });
    }

    user.isActive = isActive;
    await user.save();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'USER_UPDATED',
      description: `${isActive ? 'Activated' : 'Deactivated'} user "${user.name}" (${user.email})`,
    });

    const userObj = user.toObject();
    res.json({ success: true, data: { ...userObj, _id: userObj._id.toString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: 'Cannot delete the last admin' });
    }

    await user.deleteOne();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'USER_DELETED',
      description: `Deleted user "${user.name}" (${user.email})`,
    });

    res.json({ success: true, message: `User "${user.name}" deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;