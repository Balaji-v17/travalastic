import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import { recordEvent } from '../services/audit.js';

/**
 * Validates admin configuration.
 * Must have ADMIN_JWT_SECRET and it must differ from traveler JWT_SECRET.
 *
 * @throws {Error} if misconfigured
 */
export function validateAdminConfig() {
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  const travelerSecret = process.env.JWT_SECRET;

  if (!adminSecret || !adminSecret.trim()) {
    throw new Error('ADMIN_JWT_SECRET is required but not configured.');
  }

  if (adminSecret.trim().length < 32) {
    throw new Error('ADMIN_JWT_SECRET must be at least 32 characters long.');
  }

  if (travelerSecret && adminSecret.trim() === travelerSecret.trim()) {
    throw new Error('ADMIN_JWT_SECRET must differ from traveler JWT_SECRET.');
  }
}

/**
 * Retrieves the validated admin JWT secret.
 *
 * @returns {string}
 */
export function getAdminJwtSecret() {
  validateAdminConfig();
  return process.env.ADMIN_JWT_SECRET.trim();
}

/**
 * Middleware: requireAdmin
 *
 * Verifies JWT:
 * 1. Checks Authorization: Bearer <token>
 * 2. Verifies using ADMIN_JWT_SECRET and audience 'admin'
 * 3. Enforces token expiration
 * 4. LOADS the admin from database on EVERY request
 * 5. Rejects (401) if missing or active === false (immediate deactivation effect)
 * 6. Attaches req.admin and req.adminId
 */
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'Authorization header is required (format: Bearer <token>)',
    });
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Invalid authorization format. Format must be: Bearer <token>',
    });
  }

  const token = parts[1];
  let secret;
  try {
    secret = getAdminJwtSecret();
  } catch (configErr) {
    return res.status(500).json({ error: 'Admin authentication is misconfigured' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret, { audience: 'admin' });
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Admin token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid admin authentication token' });
  }

  if (!decoded || decoded.aud !== 'admin') {
    return res.status(401).json({ error: 'Invalid admin token audience' });
  }

  const adminId = decoded.sub || decoded.id;
  if (!adminId) {
    return res.status(401).json({ error: 'Invalid admin token subject' });
  }

  try {
    const admin = await AdminUser.findById(adminId);
    if (!admin || admin.active !== true) {
      return res.status(401).json({ error: 'Admin account not found or inactive' });
    }

    // Check token revocation timestamp (iat earlier than tokensValidAfter)
    if (admin.tokensValidAfter) {
      const validAfterSeconds = Math.floor(new Date(admin.tokensValidAfter).getTime() / 1000);
      if (typeof decoded.iat === 'number' && decoded.iat < validAfterSeconds) {
        return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
      }
    }

    // Attach admin details
    req.admin = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword ?? false,
      userRecord: admin,
    };
    req.adminId = admin._id.toString();

    // Forced password change guard: allow only GET /admin/auth/me and POST /admin/auth/change-password
    if (admin.mustChangePassword === true) {
      const fullPath = (req.baseUrl + req.path).replace(/\/+$/, '') || req.path;
      const isAllowedMe = req.method === 'GET' && (fullPath === '/admin/auth/me' || req.path === '/auth/me');
      const isAllowedChangePwd = req.method === 'POST' && (fullPath === '/admin/auth/change-password' || req.path === '/auth/change-password');

      if (!isAllowedMe && !isAllowedChangePwd) {
        return res.status(403).json({
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'Password change required before accessing administrative resources',
        });
      }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Admin authentication failed' });
  }
}

/**
 * Middleware factory: requireRole(...allowedRoles)
 *
 * Checks allowed roles strictly from the database record (req.admin.role),
 * never trusting the role claim in the token alone.
 * Returns 403 when the role is not allowed.
 *
 * @param {...string} allowedRoles
 * @returns {express.RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      const routePath = req.originalUrl || req.baseUrl + req.path || req.path || 'unknown_route';
      try {
        await recordEvent(req, {
          action: 'admin.access_denied',
          targetType: 'Route',
          targetId: routePath,
          summary: `Access denied to ${routePath} for role ${req.admin.role}`,
          actorId: req.admin.id,
          actorEmail: req.admin.email,
          actorRole: req.admin.role,
        });
      } catch (auditErr) {
        console.error('Failed to record access_denied audit event:', auditErr.message);
      }

      return res.status(403).json({
        error: `Forbidden: requires ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
