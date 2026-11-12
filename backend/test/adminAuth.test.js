import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import adminRouter from '../src/routes/admin.js';
import {
  requireAdmin,
  requireRole,
  validateAdminConfig,
  getAdminJwtSecret,
} from '../src/middleware/adminAuth.js';
import authenticate from '../src/middleware/authenticate.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';
import User from '../src/models/User.js';
import { createSuperAdminRecord } from '../scripts/createSuperAdmin.js';

const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_12345';
const ADMIN_JWT_SECRET = 'test_admin_jwt_secret_67890_min_32_chars';

function dispatch(appInstance, { method, url, headers = {}, body = '', ip = '127.0.0.1' }) {
  return new Promise((resolve) => {
    const rawBuffer = Buffer.isBuffer(body)
      ? body
      : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');

    const req = Readable.from(rawBuffer.length > 0 ? [rawBuffer] : []);
    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(rawBuffer.length),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };
    req.socket = { remoteAddress: ip };
    req.ip = ip;

    let statusCode = 200;
    const resHeaders = {};
    let resBody = '';

    const res = new EventEmitter();
    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => {
      delete resHeaders[k.toLowerCase()];
    };
    res.status = (code) => {
      statusCode = code;
      return res;
    };
    res.json = (data) => {
      resHeaders['content-type'] = 'application/json';
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk.toString();
      try {
        resolve({ status: statusCode, headers: resHeaders, body: JSON.parse(resBody) });
      } catch {
        resolve({ status: statusCode, headers: resHeaders, body: resBody });
      }
    };

    appInstance.handle(req, res);
  });
}

describe('Admin Panel Piece A1: Authentication & Authorization', () => {
  let app;
  let superAdminId;
  let superAdminPasswordHash;
  let mockAdmins;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    superAdminPasswordHash = await bcrypt.hash('CorrectAdminPassword123!', 10);

    mockAdmins = new Map();

    const superAdminDoc = {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'admin@travalastic.com',
      passwordHash: superAdminPasswordHash,
      role: 'super_admin',
      active: true,
      createdBy: null,
      createdAt: new Date(),
      lastLoginAt: null,
      save: async function () {
        mockAdmins.set(this.email, this);
        return this;
      },
      toSafeObject: function () {
        return {
          id: this._id.toString(),
          _id: this._id.toString(),
          email: this.email,
          role: this.role,
          active: this.active,
          createdAt: this.createdAt,
          lastLoginAt: this.lastLoginAt,
        };
      },
    };
    mockAdmins.set('admin@travalastic.com', superAdminDoc);

    // Mock AdminUser queries
    AdminUser.findOne = ({ email }) => {
      const match = mockAdmins.get(email?.toLowerCase());
      return Promise.resolve(match || null);
    };

    AdminUser.findById = (id) => {
      for (const doc of mockAdmins.values()) {
        if (doc._id.toString() === id.toString()) {
          return Promise.resolve(doc);
        }
      }
      return Promise.resolve(null);
    };

    AdminUser.create = async (data) => {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role,
        active: data.active !== undefined ? data.active : true,
        createdBy: data.createdBy || null,
        createdAt: new Date(),
        lastLoginAt: null,
        save: async function () {
          mockAdmins.set(this.email, this);
          return this;
        },
        toSafeObject: function () {
          return {
            id: this._id.toString(),
            _id: this._id.toString(),
            email: this.email,
            role: this.role,
            active: this.active,
            createdAt: this.createdAt,
            lastLoginAt: this.lastLoginAt,
          };
        },
      };
      mockAdmins.set(doc.email, doc);
      return doc;
    };

    AuditLog.create = async () => ({});

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
  });

  it('1. Login success -> returns token and safe admin object without passwordHash', async () => {
    const res = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      ip: '10.0.1.1',
      body: {
        email: 'admin@travalastic.com',
        password: 'CorrectAdminPassword123!',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'Should return a JWT token');
    assert.equal(res.body.admin.email, 'admin@travalastic.com');
    assert.equal(res.body.admin.role, 'super_admin');
    assert.equal(res.body.admin.id, superAdminId);
    assert.equal(res.body.admin.passwordHash, undefined, 'passwordHash must never be returned');

    // Verify token claims
    const decoded = jwt.verify(res.body.token, ADMIN_JWT_SECRET, { audience: 'admin' });
    assert.equal(decoded.sub, superAdminId);
    assert.equal(decoded.role, 'super_admin');
    assert.equal(decoded.aud, 'admin');

    // Verify lastLoginAt updated in DB
    const adminInDb = mockAdmins.get('admin@travalastic.com');
    assert.ok(adminInDb.lastLoginAt instanceof Date);
  });

  it('2. Wrong password vs unknown email -> identical 401 bodies', async () => {
    const wrongPasswordRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      ip: '10.0.2.1',
      body: {
        email: 'admin@travalastic.com',
        password: 'WrongPassword12345!',
      },
    });

    const unknownEmailRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      ip: '10.0.2.2',
      body: {
        email: 'unknown-admin@travalastic.com',
        password: 'WrongPassword12345!',
      },
    });

    assert.equal(wrongPasswordRes.status, 401);
    assert.equal(unknownEmailRes.status, 401);
    assert.deepEqual(
      wrongPasswordRes.body,
      { error: 'Invalid email or password' },
      'Must return generic error'
    );
    assert.deepEqual(
      unknownEmailRes.body,
      { error: 'Invalid email or password' },
      'Must return identical generic error'
    );
    assert.deepEqual(wrongPasswordRes.body, unknownEmailRes.body);
  });

  it('3. Inactive admin -> login rejected with 401; existing token rejected on subsequent call with 401', async () => {
    // Create inactive admin
    const inactivePasswordHash = await bcrypt.hash('InactiveSecret123!', 10);
    const inactiveId = new mongoose.Types.ObjectId().toString();
    const inactiveDoc = {
      _id: new mongoose.Types.ObjectId(inactiveId),
      email: 'inactive@travalastic.com',
      passwordHash: inactivePasswordHash,
      role: 'content_editor',
      active: false,
      createdBy: null,
      save: async function () { return this; },
    };
    mockAdmins.set('inactive@travalastic.com', inactiveDoc);

    // 1) Login attempt should be rejected with identical 401
    const loginRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      ip: '10.0.3.1',
      body: {
        email: 'inactive@travalastic.com',
        password: 'InactiveSecret123!',
      },
    });
    assert.equal(loginRes.status, 401);
    assert.deepEqual(loginRes.body, { error: 'Invalid email or password' });

    // 2) An already-issued token for a user who was subsequently deactivated
    const validLookingToken = jwt.sign(
      { sub: inactiveId, role: 'content_editor' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    const pingRes = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${validLookingToken}` },
    });
    assert.equal(pingRes.status, 401);
    assert.equal(pingRes.body.error, 'Admin account not found or inactive');
  });

  it('4. 6th failed login within 15 min -> 429', async () => {
    const testIp = '198.51.100.99';
    const testEmail = 'bruteforce@travalastic.com';

    // 5 failed attempts return 401
    for (let i = 1; i <= 5; i++) {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/login',
        ip: testIp,
        body: {
          email: testEmail,
          password: `IncorrectTry${i}!`,
        },
      });
      assert.equal(res.status, 401, `Attempt ${i} should return 401`);
    }

    // 6th failed attempt must return 429
    const sixthRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      ip: testIp,
      body: {
        email: testEmail,
        password: 'IncorrectTry6!',
      },
    });
    assert.equal(sixthRes.status, 429);
    assert.equal(
      sixthRes.body.error,
      'Too many failed login attempts. Please try again later.'
    );
  });

  it('5. Token missing aud, wrong aud, wrong secret, or expired -> 401', async () => {
    // a) Missing aud
    const tokenNoAud = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { expiresIn: '8h' }
    );
    const resNoAud = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${tokenNoAud}` },
    });
    assert.equal(resNoAud.status, 401);

    // b) Wrong aud
    const tokenWrongAud = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'traveler', expiresIn: '8h' }
    );
    const resWrongAud = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${tokenWrongAud}` },
    });
    assert.equal(resWrongAud.status, 401);

    // c) Wrong secret
    const tokenWrongSecret = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      'completely_different_secret_key',
      { audience: 'admin', expiresIn: '8h' }
    );
    const resWrongSecret = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${tokenWrongSecret}` },
    });
    assert.equal(resWrongSecret.status, 401);

    // d) Expired token
    const tokenExpired = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '-1s' }
    );
    const resExpired = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${tokenExpired}` },
    });
    assert.equal(resExpired.status, 401);
    assert.equal(resExpired.body.error, 'Admin token has expired. Please log in again.');
  });

  it('6. Traveler token on /admin/ping -> 401', async () => {
    // Traveler token signed with TRAVELER_JWT_SECRET
    const travelerToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), email: 'traveler@gmail.com' },
      TRAVELER_JWT_SECRET,
      { expiresIn: '7d' }
    );

    const res = await dispatch(app, {
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${travelerToken}` },
    });

    assert.equal(res.status, 401);
  });

  it('7. Admin token on traveler route -> 401', async () => {
    // Admin token signed with ADMIN_JWT_SECRET
    const adminToken = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    // Traveler route protected by authenticate middleware
    const travelerApp = express();
    travelerApp.use(express.json());
    travelerApp.get('/traveler/protected', authenticate, (req, res) => {
      res.json({ ok: true, userId: req.userId });
    });

    const res = await dispatch(travelerApp, {
      method: 'GET',
      url: '/traveler/protected',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid authentication token');
  });

  it('8. requireRole("super_admin") blocks content_editor with 403', async () => {
    // Create content editor
    const editorId = new mongoose.Types.ObjectId().toString();
    const editorDoc = {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: 'dummy',
      role: 'content_editor',
      active: true,
      save: async function () { return this; },
    };
    mockAdmins.set('editor@travalastic.com', editorDoc);

    const editorToken = jwt.sign(
      { sub: editorId, role: 'content_editor' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    const superAdminToken = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    const roleApp = express();
    roleApp.use(express.json());
    roleApp.get(
      '/admin/super-only',
      requireAdmin,
      requireRole('super_admin'),
      (req, res) => res.json({ ok: true, admin: req.admin.email })
    );

    // Content editor should be blocked with 403
    const blockedRes = await dispatch(roleApp, {
      method: 'GET',
      url: '/admin/super-only',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.body.error, 'Forbidden: requires super_admin');

    // Super admin should be allowed with 200
    const allowedRes = await dispatch(roleApp, {
      method: 'GET',
      url: '/admin/super-only',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(allowedRes.status, 200);
    assert.equal(allowedRes.body.ok, true);
  });

  it('9. AdminUser.toSafeObject() / GET /me never returns passwordHash', async () => {
    const adminDoc = mockAdmins.get('admin@travalastic.com');
    const safeObj = adminDoc.toSafeObject();

    assert.equal(safeObj.passwordHash, undefined);
    assert.equal(safeObj.email, 'admin@travalastic.com');
    assert.equal(safeObj.role, 'super_admin');

    const token = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    const res = await dispatch(app, {
      method: 'GET',
      url: '/admin/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, superAdminId);
    assert.equal(res.body.email, 'admin@travalastic.com');
    assert.equal(res.body.role, 'super_admin');
    assert.equal(res.body.passwordHash, undefined, 'GET /me must never return passwordHash');
  });

  it('10. createSuperAdminRecord rejects duplicate email and <12 char password', async () => {
    // Short password (< 12 chars)
    await assert.rejects(
      async () => {
        await createSuperAdminRecord({
          email: 'newadmin@travalastic.com',
          password: 'short-pass',
        });
      },
      {
        message: 'Password must be at least 12 characters long',
      }
    );

    // Duplicate email
    await assert.rejects(
      async () => {
        await createSuperAdminRecord({
          email: 'admin@travalastic.com',
          password: 'LongEnoughPassword123!',
        });
      },
      {
        message: 'Admin with email "admin@travalastic.com" already exists',
      }
    );

    // Valid creation
    const created = await createSuperAdminRecord({
      email: 'brandnewadmin@travalastic.com',
      password: 'BrandNewValidPassword123!',
    });
    assert.equal(created.email, 'brandnewadmin@travalastic.com');
    assert.equal(created.role, 'super_admin');
    assert.equal(created.passwordHash, undefined);
  });

  it('11. validateAdminConfig throws if missing, shorter than 32 chars, or equal to traveler secret', () => {
    // Missing
    delete process.env.ADMIN_JWT_SECRET;
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET is required but not configured.',
    });

    // Shorter than 32 characters
    process.env.ADMIN_JWT_SECRET = 'short_secret_under_32_chars';
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET must be at least 32 characters long.',
    });

    // Equal to traveler secret (both >= 32 chars)
    process.env.JWT_SECRET = 'identical_shared_secret_key_at_least_32_characters';
    process.env.ADMIN_JWT_SECRET = 'identical_shared_secret_key_at_least_32_characters';
    assert.throws(() => validateAdminConfig(), {
      message: 'ADMIN_JWT_SECRET must differ from traveler JWT_SECRET.',
    });

    // Valid (>= 32 chars)
    process.env.ADMIN_JWT_SECRET = 'unique_admin_secret_key_999_at_least_32_characters';
    assert.doesNotThrow(() => validateAdminConfig());
    assert.equal(getAdminJwtSecret(), 'unique_admin_secret_key_999_at_least_32_characters');
  });
});

