/**
 * Enigoal — Scheme Model
 */

const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema(
  {
    // Keep a numeric legacyId so the frontend id references still work
    legacyId: {
      type:   Number,
      unique: true,
      sparse: true,
    },
    name: {
      type:     String,
      required: [true, 'Scheme name is required'],
      trim:     true,
    },
    category: {
      type:     String,
      required: [true, 'Category is required'],
      enum:     ['GRANT', 'GRANT-DEBT-EQUITY', 'DEBT EQUITY', 'EQUITY', 'LOAN ONLY', 'LOAN SUBSIDY', 'CERTGEM', 'DASHBOARD'],
      trim:     true,
    },
    status: {
      type:    String,
      default: 'Active',
      trim:    true,
    },
    organization: {
      type:  String,
      trim:  true,
      default: '',
    },
    type: {
      type:    String,
      default: 'Government Scheme',
      trim:    true,
    },
    lastDate: {
      type:    String,
      default: 'Rolling basis',
    },
    minCharge: {
      type:    String,
      default: '',
    },
    applicableFor: {
      type:    String,
      default: 'Pan India',
    },
    location: {
      type:    String,
      default: 'Pan India',
    },
    portalLink: {
      type:    String,
      default: '',
    },
    maxFunding: {
      type:    String,
      default: '',
    },
    tags: {
      type:    [String],
      default: [],
    },
    benefits: {
      type:    [String],
      default: [],
    },
    eligibility: {
      type:    [String],
      default: [],
    },
    focusSectors: {
      type:    [String],
      default: [],
    },
    industrySectors: {
      type:    [String],
      default: [],
    },
    companyTypes: {
      type:    [String],
      default: [],
    },
    isNew: {
      type:    Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  {
    timestamps: true,
  }
);

// Text index for full-text search
schemeSchema.index({ name: 'text', organization: 'text', tags: 'text' });

// Regular indexes for common filters
schemeSchema.index({ category: 1 });
schemeSchema.index({ status: 1 });
schemeSchema.index({ location: 1 });

module.exports = mongoose.models.Scheme || mongoose.model('Scheme', schemeSchema);