/**
 * Enigoal — Admin Routes
 *
 * GET /api/admin/stats          dashboard overview
 * GET /api/admin/activity-logs  recent activity
 */

const router      = require('express').Router();
const Scheme      = require('../models/Scheme');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [schemesByCat, totalSchemes, totalUsers, recentLogs] = await Promise.all([
      Scheme.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Scheme.countDocuments(),
      User.countDocuments({ isActive: true }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const byCat = {};
    for (const s of schemesByCat) byCat[s._id] = s.count;

    const dashboardStats = [
      { label: 'Total Schemes',  value: totalSchemes,            color: 'bg-blue-600',   icon: '🗂️' },
      { label: 'Grant',          value: byCat['GRANT']             || 0, color: 'bg-green-600',  icon: '🎁' },
      { label: 'Equity',         value: byCat['EQUITY']            || 0, color: 'bg-purple-600', icon: '📈' },
      { label: 'Loan Only',      value: byCat['LOAN ONLY']         || 0, color: 'bg-orange-500', icon: '🏦' },
      { label: 'Loan Subsidy',   value: byCat['LOAN SUBSIDY']      || 0, color: 'bg-amber-500',  icon: '💰' },
      { label: 'Debt + Equity',  value: byCat['DEBT EQUITY']       || 0, color: 'bg-sky-600',    icon: '⚖️' },
      { label: 'Certifications', value: byCat['CERTGEM']           || 0, color: 'bg-red-500',    icon: '🏅' },
      { label: 'Grant+Debt+Eq',  value: byCat['GRANT-DEBT-EQUITY'] || 0, color: 'bg-teal-600',   icon: '✨' },
    ];

    res.json({
      success: true,
      data: {
        totalSchemes,
        totalUsers,
        dashboardStats,
        schemesByCategory: byCat,
        recentLogs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/activity-logs ─────────────────────────────────
router.get('/activity-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs  = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, total: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
