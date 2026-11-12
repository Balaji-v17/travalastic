import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';

import User from '../models/User.js';
import AdminUser from '../models/AdminUser.js';
import { requireAdmin, requireRole, getAdminJwtSecret } from '../middleware/adminAuth.js';
import { recordEvent } from '../services/audit.js';
import { deleteUserAndData } from '../services/accountDeletion.js';

const router = express.Router();

const HTML_TAG_REGEX = /<[^>]*>/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit: 30 lookups / min per admin
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.admin?._id?.toString() || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many lookup requests. Please slow down.' },
});

// Rate limit: 30 previews / min per admin
const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.admin?._id?.toString() || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many preview requests. Please slow down.' },
});

// Rate limit: 5 deletions per hour per admin
const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.admin?._id?.toString() || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many account deletions. Please wait before attempting another deletion.' },
});

// All support endpoints require authenticated support_agent or super_admin
router.use(requireAdmin);
router.use(requireRole('support_agent', 'super_admin'));

/**
 * GET /admin/support/users?email=<exact>
 * Look up a traveler account by exact email.
 * Exact match only, trimmed and lowercased.
 * Returns at most one record with ONLY { id, email, createdAt, status }.
 * Never returns name, phone, passwordHash, or trip content.
 * Audited as support.user_lookup (or support.user_lookup_no_match) without email.
 */
router.get('/users', lookupLimiter, async (req, res) => {
  const rawEmail = req.query.email;

  if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
    return res.status(400).json({ error: 'Exact email query parameter is required' });
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();

  if (normalizedEmail.length > 254) {
    return res.status(400).json({ error: 'Email exceeds maximum allowed length of 254 characters' });
  }

  try {
    // Exact match only: string equality, no regex or wildcards
    const user = await User.findOne({ email: normalizedEmail }).lean();

    if (!user) {
      // Audit non-match without storing target email
      try {
        await recordEvent(req, {
          action: 'support.user_lookup_no_match',
          targetType: 'user',
          targetId: null,
          summary: 'Support user lookup yielded no matching account',
        });
      } catch (auditErr) {
        console.error('Failed to record user_lookup_no_match audit event:', auditErr.message);
      }

      return res.status(404).json({ error: 'User not found' });
    }

    // Found: audit lookup with user ID only (NO email in audit record)
    try {
      await recordEvent(req, {
        action: 'support.user_lookup',
        targetType: 'user',
        targetId: user._id.toString(),
        summary: 'Support user lookup performed',
      });
    } catch (auditErr) {
      console.error('Failed to record user_lookup audit event:', auditErr.message);
    }

    // Return ONLY the four permitted fields
    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      status: 'active',
    });
  } catch (err) {
    console.error('Support user lookup error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/support/users/:id/deletion-preview
 * Runs shared deletion service in DRY-RUN mode.
 * Returns counts and labels only (never content) and a 5-minute signed previewToken.
 * Audited as support.deletion_preview without email.
 */
router.post('/users/:id/deletion-preview', previewLimiter, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // Reject if target is an Admin account (admins cannot be targeted)
    const isAdmin = await AdminUser.findById(id).lean();
    if (isAdmin) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Dry-run deletion using shared service
    const counts = await deleteUserAndData(user._id, { dryRun: true });

    // Generate short-lived (5 min) preview token bound to admin, traveler, and specific purpose
    const adminId = req.admin?.id || req.admin?._id?.toString();
    const previewToken = jwt.sign(
      {
        adminId,
        userId: user._id.toString(),
        purpose: 'support_deletion_preview',
      },
      getAdminJwtSecret(),
      { expiresIn: '5m' }
    );

    // Audit preview without email
    try {
      await recordEvent(req, {
        action: 'support.deletion_preview',
        targetType: 'user',
        targetId: user._id.toString(),
        summary: 'Support generated deletion preview for user',
      });
    } catch (auditErr) {
      console.error('Failed to record deletion_preview audit event:', auditErr.message);
    }

    return res.status(200).json({
      willRemove: [
        { item: 'Itineraries', count: counts.itineraries || 0 },
        { item: 'Conversations', count: counts.conversations || 0 },
        { item: 'Expenses', count: counts.expenses || 0 },
        { item: 'Bookings', count: counts.bookings || 0 },
        { item: 'Packing Templates', count: counts.packingTemplates || 0 },
        { item: 'Disruptions', count: counts.disruptions || 0 },
        { item: 'User Account', count: counts.users || 1 },
      ],
      willRetain: [
        {
          item: 'Audit Logs',
          reason: 'Tamper-evident operational audit trail required for regulatory compliance and accountability',
        },
        {
          item: 'Shared Catalogs',
          reason: 'Curated platform places, hotels, routes, and style collections shared across all users',
        },
      ],
      previewToken,
    });
  } catch (err) {
    console.error('Support deletion preview error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/support/users/:id/delete
 * Body: { confirmEmail, reason, previewToken }
 * Requires valid previewToken bound to this admin and user.
 * Requires confirmEmail matching user account email (case-insensitive).
 * Requires plain text reason (5-200 chars).
 * Audits support.user_delete_started BEFORE deletion and support.user_delete_completed AFTER.
 * Calls deleteUserAndData (the same shared service as in-app deletion).
 * Old traveler tokens are immediately rejected by authenticate middleware because user doc is gone.
 */
router.post('/users/:id/delete', deleteLimiter, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const { confirmEmail, reason, previewToken } = req.body || {};

  // 1. Verify preview token
  if (!previewToken || typeof previewToken !== 'string') {
    return res.status(400).json({ error: 'Preview token is required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(previewToken, getAdminJwtSecret());
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired preview token' });
  }

  const currentAdminId = req.admin?.id || req.admin?._id?.toString();
  if (
    decoded.purpose !== 'support_deletion_preview' ||
    decoded.adminId !== currentAdminId ||
    decoded.userId !== id
  ) {
    return res.status(400).json({ error: 'Invalid preview token for this user and admin' });
  }

  // 2. Validate reason (plain text, 5-200 chars, no HTML tags)
  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({ error: 'Reason is required' });
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 5 || cleanReason.length > 200) {
    return res.status(400).json({ error: 'Reason must be between 5 and 200 characters' });
  }

  if (HTML_TAG_REGEX.test(cleanReason)) {
    return res.status(400).json({ error: 'Reason cannot contain HTML tags' });
  }

  try {
    // 3. Ensure admin accounts cannot be targeted
    const isAdmin = await AdminUser.findById(id).lean();
    if (isAdmin) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 4. Load target user document
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 5. Verify confirmEmail equals account email (case-insensitive)
    if (
      !confirmEmail ||
      typeof confirmEmail !== 'string' ||
      confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      return res.status(400).json({ error: 'The email does not match.' });
    }

    // 6. Record audit entry BEFORE deletion starts (persists even if deletion crashes)
    try {
      await recordEvent(req, {
        action: 'support.user_delete_started',
        targetType: 'user',
        targetId: user._id.toString(),
        summary: `Support user deletion started. Reason: ${cleanReason}`.slice(0, 200),
      });
    } catch (auditErr) {
      console.error('Failed to record pre-deletion audit record:', auditErr.message);
      return res.status(500).json({ error: 'Failed to record audit trail prior to deletion' });
    }

    // 7. Execute deletion through the shared deletion service
    try {
      const deletedCounts = await deleteUserAndData(user._id);

      // Record audit completion
      try {
        await recordEvent(req, {
          action: 'support.user_delete_completed',
          targetType: 'user',
          targetId: user._id.toString(),
          summary: `Support user deletion completed. Reason: ${cleanReason}`.slice(0, 200),
        });
      } catch (postAuditErr) {
        console.error('Failed to record completion audit event:', postAuditErr.message);
      }

      return res.status(200).json({
        deleted: true,
        userId: user._id.toString(),
        deletedCounts,
      });
    } catch (delErr) {
      // Record audit failure
      try {
        await recordEvent(req, {
          action: 'support.user_delete_failed',
          targetType: 'user',
          targetId: user._id.toString(),
          summary: `Support user deletion failed. Reason: ${cleanReason}`.slice(0, 200),
        });
      } catch (failAuditErr) {
        console.error('Failed to record failure audit event:', failAuditErr.message);
      }

      return res.status(500).json({ error: 'Account deletion failed' });
    }
  } catch (err) {
    console.error('Support account delete error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
