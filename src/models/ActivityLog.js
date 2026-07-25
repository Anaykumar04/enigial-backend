/**
 * Enigoal — Activity Log Model
 * Tracks admin actions: logins, scheme changes, user management
 */

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
    userEmail: String,  // denormalized so logs survive user deletion
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN', 'LOGOUT',
        'SCHEME_CREATED', 'SCHEME_UPDATED', 'SCHEME_DELETED',
        'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'PASSWORD_CHANGED',
      ],
    },
    description: String,
    meta: mongoose.Schema.Types.Mixed, // extra data (e.g. scheme name, user role)
  },
  {
    timestamps: true,
  }
);

// Auto-expire logs after 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);