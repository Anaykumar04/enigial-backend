/**
 * Enigoal — Schemes Routes
 *
 * GET    /api/schemes              list + filter + paginate
 * GET    /api/schemes/stats        counts by category
 * GET    /api/schemes/categories   distinct categories
 * GET    /api/schemes/:id          single scheme
 * POST   /api/schemes              create  (admin)
 * PUT    /api/schemes/:id          update  (admin)
 * DELETE /api/schemes/:id          delete  (admin)
 */

const router      = require('express').Router();
const { body, validationResult } = require('express-validator');
const mongoose    = require('mongoose');
const Scheme      = require('../models/Scheme');
const ActivityLog = require('../models/ActivityLog');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All scheme routes require login
router.use(authenticate);

// ── GET /api/schemes/stats ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await Scheme.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const total = await Scheme.countDocuments();
    const result = [
      { category: 'ALL', count: total },
      ...stats.map(s => ({ category: s._id, count: s.count })),
    ];

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/schemes/categories ───────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const categories = await Scheme.distinct('category');
    res.json({ success: true, data: categories.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/schemes ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      category, search, status, sector,
      companyType, location, page = 1, limit = 200,
    } = req.query;

    const filter = {};
    const andClauses = [];

    // Escape user input before using in RegExp to prevent ReDoS
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (category && category !== 'ALL') filter.category = category;
    if (status)      filter.status = new RegExp(escapeRegex(status), 'i');
    if (location) {
      const loc = new RegExp(escapeRegex(location), 'i');
      andClauses.push({ $or: [{ location: loc }, { applicableFor: loc }] });
    }
    if (sector) {
      const sec = new RegExp(escapeRegex(sector), 'i');
      andClauses.push({ $or: [{ focusSectors: sec }, { industrySectors: sec }] });
    }
    if (companyType) filter.companyTypes = new RegExp(escapeRegex(companyType), 'i');
    if (search) {
      const q = new RegExp(escapeRegex(search), 'i');
      andClauses.push({ $or: [{ name: q }, { organization: q }, { tags: q }] });
    }
    if (andClauses.length > 0) filter.$and = andClauses;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Scheme.find(filter).sort({ legacyId: 1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Scheme.countDocuments(filter),
    ]);

    // Normalize _id → id for frontend compatibility
    const normalized = data.map(normalizeScheme);

    res.json({
      success: true,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.ceil(total / limitNum),
      data:       normalized,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/schemes/:id ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const scheme = await findScheme(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    res.json({ success: true, data: normalizeScheme(scheme.toObject ? scheme.toObject() : scheme) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/schemes ─────────────────────────────────────────────
router.post(
  '/',
  requireAdmin,
  [body('name').notEmpty().withMessage('Name is required'),
   body('category').notEmpty().withMessage('Category is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      // Auto-assign next legacyId
      const last = await Scheme.findOne().sort({ legacyId: -1 }).select('legacyId').lean();
      const legacyId = (last?.legacyId || 0) + 1;

      const scheme = await Scheme.create({
        ...sanitizeBody(req.body),
        legacyId,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      await ActivityLog.create({
        user: req.user._id, userEmail: req.user.email,
        action: 'SCHEME_CREATED',
        description: `Created scheme "${scheme.name}"`,
        meta: { schemeId: scheme._id, schemeName: scheme.name },
      });

      res.status(201).json({ success: true, data: normalizeScheme(scheme.toObject()) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── PUT /api/schemes/:id ─────────────────────────────────────────
router.put(
  '/:id',
  requireAdmin,
  [body('name').notEmpty().withMessage('Name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const scheme = await findScheme(req.params.id);
      if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });

      Object.assign(scheme, sanitizeBody(req.body));
      scheme.updatedBy = req.user._id;
      await scheme.save();

      await ActivityLog.create({
        user: req.user._id, userEmail: req.user.email,
        action: 'SCHEME_UPDATED',
        description: `Updated scheme "${scheme.name}"`,
        meta: { schemeId: scheme._id, schemeName: scheme.name },
      });

      res.json({ success: true, data: normalizeScheme(scheme.toObject()) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── DELETE /api/schemes/:id ───────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const scheme = await findScheme(req.params.id);
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });

    const name = scheme.name;
    await scheme.deleteOne();

    await ActivityLog.create({
      user: req.user._id, userEmail: req.user.email,
      action: 'SCHEME_DELETED',
      description: `Deleted scheme "${name}"`,
      meta: { schemeName: name },
    });

    res.json({ success: true, message: `Scheme "${name}" deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────

/** Find by MongoDB _id or legacyId (numeric) */
async function findScheme(idParam) {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    return Scheme.findById(idParam);
  }
  const num = parseInt(idParam);
  if (!isNaN(num)) return Scheme.findOne({ legacyId: num });
  return null;
}

/** Map MongoDB doc → frontend-friendly shape */
function normalizeScheme(s) {
  // FIX: use destructuring to truly omit _id and __v from the returned object
  // Setting them to undefined still includes the key, breaking frontend id comparisons
  const { _id, __v, ...rest } = s;
  return {
    ...rest,
    id: s.legacyId || _id,   // keep id for frontend
    _id: _id?.toString(),    // also expose _id as string for reliable lookups
  };
}

/** Strip fields that shouldn't be set by client */
function sanitizeBody(body) {
  const { _id, __v, legacyId, createdBy, updatedBy, createdAt, updatedAt, ...rest } = body;
  return {
    ...rest,
    benefits:    (rest.benefits    || []).filter(Boolean),
    eligibility: (rest.eligibility || []).filter(Boolean),
    tags:        (rest.tags        || []).filter(Boolean),
  };
}

module.exports = router;