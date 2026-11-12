import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import AdminUser from '../models/AdminUser.js';
import AuditLog from '../models/AuditLog.js';
import {
  requireAdmin,
  requireRole,
  validateAdminConfig,
  getAdminJwtSecret,
} from '../middleware/adminAuth.js';
import { recordEvent, runAudited } from '../services/audit.js';
import adminPlacesRouter from './adminPlaces.js';
import adminHotelsRouter from './adminHotels.js';
import adminStylesRouter from './adminStyles.js';
import adminSupportRouter from './adminSupport.js';

const router = express.Router();

// Mount places, hotels, styles and support management routers
router.use('/places', adminPlacesRouter);
router.use('/hotels', adminHotelsRouter);
router.use('/styles', adminStylesRouter);
router.use('/support', adminSupportRouter);

// Pre-computed valid bcrypt salt+hash for dummy compare (timing-attack prevention)
const DUMMY_BCRYPT_HASH = '$2b$10$e8GjJbVwM6G5N6T6J9D1Ou0vTfF9qC1jZ6aK5k7vL8m9nP0qR1s2u';

// Rate limit: max 5 failed attempts per 15 minutes per IP
const ipLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown_ip',
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many failed login attempts. Please try again later.' },
});

// Rate limit: max 5 failed attempts per 15 minutes per email
const emailLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.admin?.email || req.body?.email;
    return typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase()
      : req.ip || req.socket?.remoteAddress || 'unknown_email';
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many failed login attempts. Please try again later.' },
});

// Rate limit: max 30 administrative requests per minute per admin
const adminManagementLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many administrative requests. Please slow down.' },
});

// Generates an unambiguous random temporary password (>= 16 chars)
export function generateTemporaryPassword() {
  const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz!@#$%^&*';
  const bytes = crypto.randomBytes(18);
  let password = '';
  for (let i = 0; i < 18; i++) {
    password += UNAMBIGUOUS_CHARS[bytes[i] % UNAMBIGUOUS_CHARS.length];
  }
  return password;
}

/**
 * POST /admin/auth/login
 * Body: { email, password }
 * Protected by dual failure rate limiters (per-IP and per-email).
 * Timing-safe against enumeration (dummy bcrypt compare for missing/inactive accounts).
 * Never logs passwords, tokens, or request bodies.
 */
router.post(
  '/auth/login',
  ipLoginLimiter,
  emailLoginLimiter,
  async (req, res) => {
    const { email, password } = req.body || {};

    if (
      !email ||
      !password ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password.trim()
    ) {
      await bcrypt.compare('dummy_input_for_timing', DUMMY_BCRYPT_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const admin = await AdminUser.findOne({ email: normalizedEmail });

      if (!admin) {
        // Non-existent user: run dummy compare to match timing
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check active state & compare password
      const isMatch = await bcrypt.compare(password, admin.passwordHash || DUMMY_BCRYPT_HASH);

      if (!isMatch || admin.active !== true) {
        // Email matches existing admin: record login_failed event
        try {
          await recordEvent(req, {
            action: 'admin.login_failed',
            targetType: 'AdminUser',
            targetId: admin._id.toString(),
            summary: `Failed login attempt for: ${admin.email}`,
            actorId: admin._id.toString(),
            actorEmail: admin.email,
            actorRole: admin.role,
          });
        } catch (auditErr) {
          console.error('Failed to record login_failed audit event:', auditErr.message);
        }

        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update lastLoginAt
      admin.lastLoginAt = new Date();
      await admin.save();

      // Record successful admin.login event
      try {
        await recordEvent(req, {
          action: 'admin.login',
          targetType: 'AdminUser',
          targetId: admin._id.toString(),
          summary: `Admin login successful: ${admin.email}`,
          actorId: admin._id.toString(),
          actorEmail: admin.email,
          actorRole: admin.role,
        });
      } catch (auditErr) {
        console.error('Failed to record login audit event:', auditErr.message);
      }

      const sessionHours = parseInt(process.env.ADMIN_SESSION_HOURS || '8', 10) || 8;
      const secret = getAdminJwtSecret();
      const nowSec = Math.floor(Date.now() / 1000);
      const validAfterSec = admin.tokensValidAfter
        ? Math.floor(new Date(admin.tokensValidAfter).getTime() / 1000)
        : 0;

      const tokenPayload = {
        sub: admin._id.toString(),
        role: admin.role,
      };
      if (validAfterSec > nowSec) {
        tokenPayload.iat = validAfterSec;
      }

      const token = jwt.sign(tokenPayload, secret, {
        audience: 'admin',
        expiresIn: `${sessionHours}h`,
      });

      return res.status(200).json({
        token,
        admin: {
          id: admin._id.toString(),
          email: admin.email,
          role: admin.role,
          mustChangePassword: admin.mustChangePassword ?? false,
        },
      });
    } catch (err) {
      console.error('Admin login error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /admin/auth/me
 * Returns id, email, role, mustChangePassword for a valid admin token.
 */
router.get('/auth/me', requireAdmin, (req, res) => {
  return res.status(200).json({
    id: req.admin.id || req.admin._id?.toString(),
    email: req.admin.email,
    role: req.admin.role,
    mustChangePassword: req.admin.mustChangePassword ?? false,
  });
});

/**
 * GET /admin/ping
 * Protected by requireAdmin, returns { ok: true, role }.
 * Unavailable in production (returns 404).
 */
router.get('/ping', requireAdmin, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(200).json({
    ok: true,
    role: req.admin.role,
  });
});

/**
 * GET /admin/audit
 * Read-only audit log viewer for super_admin.
 * Query filters: actor (email), action, targetType, targetId, from, to, limit (default 50, max 100), cursor.
 * Returns { items, nextCursor }.
 */
router.get('/audit', requireAdmin, requireRole('super_admin'), async (req, res) => {
  const { actor, action, targetType, targetId, from, to, limit, cursor } = req.query;

  const query = {};

  if (actor && typeof actor === 'string' && actor.trim()) {
    query.actorEmail = actor.trim().toLowerCase();
  }

  if (action && typeof action === 'string' && action.trim()) {
    query.action = action.trim();
  }

  if (targetType && typeof targetType === 'string' && targetType.trim()) {
    query.targetType = targetType.trim();
  }

  if (targetId && typeof targetId === 'string' && targetId.trim()) {
    query.targetId = targetId.trim();
  }

  if (from !== undefined) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json({ error: 'Invalid "from" date parameter' });
    }
    query.at = query.at || {};
    query.at.$gte = fromDate;
  }

  if (to !== undefined) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid "to" date parameter' });
    }
    query.at = query.at || {};
    query.at.$lte = toDate;
  }

  let limitNum = 50;
  if (limit !== undefined) {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed < 1) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    limitNum = Math.min(100, parsed);
  }

  if (cursor !== undefined && cursor !== '') {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      return res.status(400).json({ error: 'Invalid cursor parameter' });
    }
    const cursorObjId = new mongoose.Types.ObjectId(cursor);
    try {
      const cursorDoc = await AuditLog.findById(cursorObjId).select('at').lean();
      if (cursorDoc && cursorDoc.at) {
        query.$or = [
          { at: { $lt: cursorDoc.at } },
          { at: cursorDoc.at, _id: { $lt: cursorObjId } },
        ];
      } else {
        query._id = { $lt: cursorObjId };
      }
    } catch (_) {
      query._id = { $lt: cursorObjId };
    }
  }

  try {
    const logs = await AuditLog.find(query)
      .sort({ at: -1, _id: -1 })
      .limit(limitNum + 1)
      .lean();

    let nextCursor = null;
    let items = logs;

    if (logs.length > limitNum) {
      items = logs.slice(0, limitNum);
      nextCursor = items[items.length - 1]._id.toString();
    }

    const formattedItems = items.map((doc) => ({
      id: doc._id.toString(),
      _id: doc._id.toString(),
      at: doc.at,
      actorId: doc.actorId,
      actorEmail: doc.actorEmail,
      actorRole: doc.actorRole,
      action: doc.action,
      targetType: doc.targetType,
      targetId: doc.targetId,
      summary: doc.summary,
      changes: doc.changes || [],
    }));

    return res.status(200).json({
      items: formattedItems,
      nextCursor,
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * POST /admin/auth/change-password
 * Body: { currentPassword, newPassword }
 * Protected by requireAdmin and ipLoginLimiter / emailLoginLimiter.
 * Sets mustChangePassword=false, passwordChangedAt=now, tokensValidAfter=now (truncated to whole seconds).
 * Returns a new token issued after that moment.
 * Audited as admin.password_changed.
 */
router.post(
  '/auth/change-password',
  requireAdmin,
  ipLoginLimiter,
  emailLoginLimiter,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (
      !currentPassword ||
      !newPassword ||
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword.trim() ||
      !newPassword.trim()
    ) {
      return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters long' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const emailLocalPart = req.admin.email.split('@')[0].toLowerCase();
    if (newPassword.toLowerCase().includes(emailLocalPart)) {
      return res.status(400).json({ error: 'New password must not contain parts of your email address' });
    }

    try {
      const admin = await AdminUser.findById(req.admin.id);
      if (!admin) {
        return res.status(404).json({ error: 'Admin account not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      const revokeTimestampSec = nowSec + 1;
      const now = new Date(revokeTimestampSec * 1000);

      await runAudited(
        req,
        {
          action: 'admin.password_changed',
          targetType: 'AdminUser',
          targetId: admin._id.toString(),
          summary: `Password changed for ${admin.email}`,
        },
        async (session) => {
          admin.passwordHash = newHash;
          admin.mustChangePassword = false;
          admin.passwordChangedAt = new Date();
          admin.tokensValidAfter = now;
          await admin.save(session ? { session } : {});
          return admin;
        }
      );

      const sessionHours = parseInt(process.env.ADMIN_SESSION_HOURS || '8', 10) || 8;
      const secret = getAdminJwtSecret();

      const token = jwt.sign(
        {
          sub: admin._id.toString(),
          role: admin.role,
          iat: revokeTimestampSec,
        },
        secret,
        {
          audience: 'admin',
          expiresIn: `${sessionHours}h`,
        }
      );

      return res.status(200).json({
        ok: true,
        token,
      });
    } catch (err) {
      console.error('Change password error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /admin/admins
 * Protected by requireAdmin, requireRole('super_admin'), adminManagementLimiter.
 * Lists all admin accounts, newest first.
 * Never returns passwordHash.
 */
router.get(
  '/admins',
  requireAdmin,
  requireRole('super_admin'),
  adminManagementLimiter,
  async (req, res) => {
    try {
      const admins = await AdminUser.find({})
        .sort({ createdAt: -1 })
        .populate('createdBy', 'email')
        .lean();

      const items = admins.map((admin) => ({
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        active: admin.active ?? true,
        mustChangePassword: admin.mustChangePassword ?? false,
        createdAt: admin.createdAt,
        lastLoginAt: admin.lastLoginAt,
        createdByEmail: admin.createdBy?.email || null,
      }));

      return res.status(200).json({ items });
    } catch (err) {
      console.error('Error listing admins:', err.message);
      return res.status(500).json({ error: 'Failed to list admin accounts' });
    }
  }
);

/**
 * POST /admin/admins
 * Body: { email, role }
 * Validates email format and role enum. 409 on duplicate.
 * Generates temporary password (>= 16 chars unambiguous), stores only bcrypt hash.
 * Sets mustChangePassword=true, createdBy=req.admin.id.
 * Returns temporaryPassword ONCE with Cache-Control: no-store.
 * Audited as admin.create via runAudited.
 */
router.post(
  '/admins',
  requireAdmin,
  requireRole('super_admin'),
  adminManagementLimiter,
  async (req, res) => {
    const { email, role } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const validRoles = ['super_admin', 'content_editor', 'support_agent'];
    if (!role || typeof role !== 'string' || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }

    try {
      const existing = await AdminUser.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ error: 'Admin with this email already exists' });
      }

      const tempPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const newAdminId = new mongoose.Types.ObjectId();

      const createdAdmin = await runAudited(
        req,
        {
          action: 'admin.create',
          targetType: 'AdminUser',
          targetId: newAdminId.toString(),
          summary: `Created admin account ${cleanEmail} with role ${role}`,
        },
        async (session) => {
          const docs = await AdminUser.create(
            [
              {
                _id: newAdminId,
                email: cleanEmail,
                passwordHash,
                role,
                active: true,
                mustChangePassword: true,
                createdBy: req.admin.id,
              },
            ],
            session ? { session } : {}
          );
          return Array.isArray(docs) ? docs[0] : docs;
        }
      );

      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({
        admin: {
          id: createdAdmin._id ? createdAdmin._id.toString() : createdAdmin.id,
          email: createdAdmin.email,
          role: createdAdmin.role,
          active: createdAdmin.active,
          mustChangePassword: createdAdmin.mustChangePassword,
          createdAt: createdAdmin.createdAt,
        },
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      if (err.statusCode === 500) {
        return res.status(500).json({ error: 'Failed to create admin account' });
      }
      console.error('Error creating admin:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /admin/admins/:id
 * Body: { role?, active? }
 * Guards:
 * - Cannot change own role or deactivate self
 * - Cannot demote or deactivate the last ACTIVE super_admin (409)
 * - Only 'role' and 'active' accepted (400 on unknown or empty fields)
 * - Deactivation sets tokensValidAfter=now
 * - Audited as admin.update with before/after of role and active
 */
router.patch(
  '/admins/:id',
  requireAdmin,
  requireRole('super_admin'),
  adminManagementLimiter,
  async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' });
    }

    const bodyKeys = Object.keys(req.body || {});
    const allowedKeys = ['role', 'active'];
    if (bodyKeys.length === 0 || bodyKeys.some((k) => !allowedKeys.includes(k))) {
      return res.status(400).json({
        error: 'Invalid or unknown fields provided. Only "role" and "active" are allowed.',
      });
    }

    const { role, active } = req.body;

    if (role !== undefined) {
      const validRoles = ['super_admin', 'content_editor', 'support_agent'];
      if (typeof role !== 'string' || !validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
      }
    }

    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Field "active" must be a boolean' });
    }

    try {
      const targetAdmin = await AdminUser.findById(id);
      if (!targetAdmin) {
        return res.status(404).json({ error: 'Admin account not found' });
      }

      // Self-protection guard
      if (targetAdmin._id.toString() === req.admin.id) {
        if (role !== undefined && role !== req.admin.role) {
          return res.status(400).json({ error: 'Cannot change your own role' });
        }
        if (active === false) {
          return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }
      }

      // Last active super admin protection
      if (targetAdmin.role === 'super_admin' && targetAdmin.active === true) {
        const isDemoting = role !== undefined && role !== 'super_admin';
        const isDeactivating = active === false;
        if (isDemoting || isDeactivating) {
          const activeSuperAdminCount = await AdminUser.countDocuments({
            role: 'super_admin',
            active: true,
          });
          if (activeSuperAdminCount <= 1) {
            return res.status(409).json({ error: 'Cannot demote or deactivate the last active super admin' });
          }
        }
      }

      const beforeState = { role: targetAdmin.role, active: targetAdmin.active };
      const afterState = {
        role: role !== undefined ? role : targetAdmin.role,
        active: active !== undefined ? active : targetAdmin.active,
      };

      const updatedAdmin = await runAudited(
        req,
        {
          action: 'admin.update',
          targetType: 'AdminUser',
          targetId: targetAdmin._id.toString(),
          summary: `Updated admin ${targetAdmin.email}`,
          allowedFields: ['role', 'active'],
          before: beforeState,
          after: afterState,
        },
        async (session) => {
          if (role !== undefined) {
            targetAdmin.role = role;
          }
          if (active !== undefined) {
            targetAdmin.active = active;
            if (active === false) {
              const nowSec = Math.floor(Date.now() / 1000);
              targetAdmin.tokensValidAfter = new Date((nowSec + 1) * 1000);
            }
          }
          await targetAdmin.save(session ? { session } : {});
          return targetAdmin;
        }
      );

      return res.status(200).json({
        admin: {
          id: updatedAdmin._id ? updatedAdmin._id.toString() : updatedAdmin.id,
          email: updatedAdmin.email,
          role: updatedAdmin.role,
          active: updatedAdmin.active,
          mustChangePassword: updatedAdmin.mustChangePassword ?? false,
          createdAt: updatedAdmin.createdAt,
          lastLoginAt: updatedAdmin.lastLoginAt,
        },
      });
    } catch (err) {
      if (err.statusCode === 500) {
        return res.status(500).json({ error: 'Failed to update admin account' });
      }
      console.error('Error updating admin:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /admin/admins/:id/reset-password
 * Protected by requireAdmin, requireRole('super_admin'), adminManagementLimiter.
 * Generates new temporary password (>= 16 chars unambiguous), returned once with Cache-Control: no-store.
 * Sets mustChangePassword=true, tokensValidAfter=now (signs that admin out everywhere).
 * Cannot be used on own account (returns 400).
 * Audited as admin.reset_password via runAudited.
 */
router.post(
  '/admins/:id/reset-password',
  requireAdmin,
  requireRole('super_admin'),
  adminManagementLimiter,
  async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' });
    }

    try {
      const targetAdmin = await AdminUser.findById(id);
      if (!targetAdmin) {
        return res.status(404).json({ error: 'Admin account not found' });
      }

      if (targetAdmin._id.toString() === req.admin.id) {
        return res.status(400).json({
          error: 'Cannot reset your own password. Use change-password instead.',
        });
      }

      const tempPassword = generateTemporaryPassword();
      const newHash = await bcrypt.hash(tempPassword, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      const revokeTimestampSec = nowSec + 1;
      const now = new Date(revokeTimestampSec * 1000);

      await runAudited(
        req,
        {
          action: 'admin.reset_password',
          targetType: 'AdminUser',
          targetId: targetAdmin._id.toString(),
          summary: `Reset password for admin ${targetAdmin.email}`,
        },
        async (session) => {
          targetAdmin.passwordHash = newHash;
          targetAdmin.mustChangePassword = true;
          targetAdmin.passwordChangedAt = new Date();
          targetAdmin.tokensValidAfter = now;
          await targetAdmin.save(session ? { session } : {});
          return targetAdmin;
        }
      );

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      if (err.statusCode === 500) {
        return res.status(500).json({ error: 'Failed to reset admin password' });
      }
      console.error('Error resetting password:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
export { router as adminRouter };
