import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import adminRouter from '../src/routes/admin.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';

const ADMIN_JWT_SECRET = 'test_admin_mgmt_secret_998877_min_32_chars';
const TRAVELER_JWT_SECRET = 'test_traveler_secret_112233';

let testIpCounter = 1;
function dispatch(appInstance, { method, url, headers = {}, body = '', ip = null }) {
  const requestIp = ip || `127.0.2.${testIpCounter++}`;
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
    req.socket = { remoteAddress: requestIp };
    req.ip = requestIp;

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

describe('Admin Panel Piece A4a: Admin Account Management & Forced Password Change', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let editorId;
  let editorToken;
  let inMemoryAdmins;
  let inMemoryAuditLogs;
  let adminCounter = 0;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    editorId = new mongoose.Types.ObjectId().toString();

    const superAdminHash = await bcrypt.hash('SuperAdminPassword123!', 10);
    const editorHash = await bcrypt.hash('EditorPassword123!', 10);

    inMemoryAdmins = new Map();
    inMemoryAuditLogs = [];

    const superAdminDoc = {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'superadmin@travalastic.com',
      passwordHash: superAdminHash,
      role: 'super_admin',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      passwordChangedAt: null,
      createdBy: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastLoginAt: null,
      save: async function () {
        inMemoryAdmins.set(this._id.toString(), this);
        return this;
      },
      toSafeObject: function () {
        return {
          id: this._id.toString(),
          _id: this._id.toString(),
          email: this.email,
          role: this.role,
          active: this.active,
          mustChangePassword: this.mustChangePassword ?? false,
          createdAt: this.createdAt,
          lastLoginAt: this.lastLoginAt,
        };
      },
    };
    inMemoryAdmins.set(superAdminId, superAdminDoc);

    const editorDoc = {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: editorHash,
      role: 'content_editor',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      passwordChangedAt: null,
      createdBy: superAdminDoc,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      lastLoginAt: null,
      save: async function () {
        inMemoryAdmins.set(this._id.toString(), this);
        return this;
      },
      toSafeObject: function () {
        return {
          id: this._id.toString(),
          _id: this._id.toString(),
          email: this.email,
          role: this.role,
          active: this.active,
          mustChangePassword: this.mustChangePassword ?? false,
          createdAt: this.createdAt,
          lastLoginAt: this.lastLoginAt,
        };
      },
    };
    inMemoryAdmins.set(editorId, editorDoc);

    superAdminToken = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    editorToken = jwt.sign(
      { sub: editorId, role: 'content_editor' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    // Mock AdminUser methods
    AdminUser.findOne = ({ email }) => {
      const clean = email?.toLowerCase();
      for (const doc of inMemoryAdmins.values()) {
        if (doc.email.toLowerCase() === clean) {
          return Promise.resolve(doc);
        }
      }
      return Promise.resolve(null);
    };

    AdminUser.findById = (id) => {
      const match = inMemoryAdmins.get(id?.toString());
      return Promise.resolve(match || null);
    };

    AdminUser.find = () => {
      const docs = Array.from(inMemoryAdmins.values());
      const queryObj = {
        sort: () => queryObj,
        populate: () => queryObj,
        lean: () =>
          Promise.resolve(
            docs.map((d) => ({
              _id: d._id,
              email: d.email,
              role: d.role,
              active: d.active,
              mustChangePassword: d.mustChangePassword,
              createdAt: d.createdAt,
              lastLoginAt: d.lastLoginAt,
              createdBy: d.createdBy
                ? { _id: d.createdBy._id, email: d.createdBy.email }
                : null,
            }))
          ),
      };
      return queryObj;
    };

    AdminUser.countDocuments = (filter = {}) => {
      let count = 0;
      for (const doc of inMemoryAdmins.values()) {
        let match = true;
        if (filter.role && doc.role !== filter.role) match = false;
        if (filter.active !== undefined && doc.active !== filter.active) match = false;
        if (match) count++;
      }
      return Promise.resolve(count);
    };

    AdminUser.create = async function (docs) {
      const items = Array.isArray(docs) ? docs : [docs];
      const created = [];
      for (const item of items) {
        const id = item._id || new mongoose.Types.ObjectId();
        const doc = {
          _id: id,
          id: id.toString(),
          email: item.email,
          passwordHash: item.passwordHash,
          role: item.role,
          active: item.active !== undefined ? item.active : true,
          mustChangePassword: item.mustChangePassword !== undefined ? item.mustChangePassword : false,
          tokensValidAfter: item.tokensValidAfter || null,
          passwordChangedAt: item.passwordChangedAt || null,
          createdBy: item.createdBy || null,
          createdAt: item.createdAt || new Date(),
          lastLoginAt: null,
          save: async function () {
            inMemoryAdmins.set(this._id.toString(), this);
            return this;
          },
        };
        inMemoryAdmins.set(id.toString(), doc);
        created.push(doc);
      }
      return Array.isArray(docs) ? created : created[0];
    };

    // Mock AuditLog.create
    AuditLog.create = async function (docs) {
      const items = Array.isArray(docs) ? docs : [docs];
      const created = [];
      for (const item of items) {
        const doc = {
          _id: new mongoose.Types.ObjectId(),
          at: item.at || new Date(),
          actorId: String(item.actorId),
          actorEmail: String(item.actorEmail),
          actorRole: String(item.actorRole),
          action: String(item.action),
          targetType: item.targetType || null,
          targetId: item.targetId || null,
          summary: String(item.summary || '').slice(0, 200),
          changes: item.changes || [],
        };
        inMemoryAuditLogs.push(doc);
        created.push(doc);
      }
      return Array.isArray(docs) ? created : created[0];
    };

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
  });

  async function createHelperAdmin(role = 'content_editor') {
    adminCounter++;
    const email = `helper_admin_${adminCounter}@travalastic.com`;
    const createRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/admins',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: { email, role },
    });
    assert.equal(createRes.status, 201);
    const tempPassword = createRes.body.temporaryPassword;
    const adminId = createRes.body.admin.id;

    // Login with temp password
    const loginRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/auth/login',
      body: { email, password: tempPassword },
    });
    assert.equal(loginRes.status, 200);

    return {
      adminId,
      email,
      tempPassword,
      token: loginRes.body.token,
    };
  }

  describe('1. GET /admin/admins', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/admins',
      });
      assert.equal(res.status, 401);
    });

    it('rejects content_editor with 403 and records admin.access_denied', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res.status, 403);
      assert.match(res.body.error, /Forbidden/i);

      const deniedLog = inMemoryAuditLogs.find((l) => l.action === 'admin.access_denied');
      assert.ok(deniedLog);
      assert.equal(deniedLog.actorEmail, 'editor@travalastic.com');
    });

    it('returns admin list for super_admin without passwordHash', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.equal(res.body.items.length, 2);

      for (const item of res.body.items) {
        assert.ok(item.id);
        assert.ok(item.email);
        assert.ok(item.role);
        assert.equal(typeof item.active, 'boolean');
        assert.equal(typeof item.mustChangePassword, 'boolean');
        assert.ok(item.createdAt);
        assert.equal(item.passwordHash, undefined);
        assert.equal(item.password, undefined);
      }
    });
  });

  describe('2. POST /admin/admins', () => {
    it('rejects non-super-admin with 403', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { email: 'newsupport@travalastic.com', role: 'support_agent' },
      });
      assert.equal(res.status, 403);
    });

    it('rejects invalid or missing email with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { email: 'notanemail', role: 'support_agent' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /email/i);
    });

    it('rejects invalid role with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { email: 'newperson@travalastic.com', role: 'viewer' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /role/i);
    });

    it('rejects duplicate email with 409', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { email: 'editor@travalastic.com', role: 'content_editor' },
      });
      assert.equal(res.status, 409);
      assert.match(res.body.error, /already exists/i);
    });

    it('creates admin, returns temporary password ONCE with Cache-Control: no-store, audits as admin.create', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { email: 'NewSupport@travalastic.com', role: 'support_agent' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.ok(res.body.admin);
      assert.equal(res.body.admin.email, 'newsupport@travalastic.com');
      assert.equal(res.body.admin.role, 'support_agent');
      assert.equal(res.body.admin.active, true);
      assert.equal(res.body.admin.mustChangePassword, true);
      assert.equal(res.body.admin.passwordHash, undefined);

      const tempPwd = res.body.temporaryPassword;
      assert.ok(tempPwd);
      assert.ok(tempPwd.length >= 16);

      // Verify DB record stores bcrypt hash, not plaintext password
      const createdInDb = inMemoryAdmins.get(res.body.admin.id);
      assert.ok(createdInDb);
      assert.notEqual(createdInDb.passwordHash, tempPwd);
      const isMatch = await bcrypt.compare(tempPwd, createdInDb.passwordHash);
      assert.equal(isMatch, true);
      assert.equal(createdInDb.createdBy, superAdminId);

      // Verify audit log has admin.create and DOES NOT contain password
      const createLog = inMemoryAuditLogs.find((l) => l.action === 'admin.create');
      assert.ok(createLog);
      assert.equal(createLog.targetType, 'AdminUser');
      assert.equal(createLog.targetId, res.body.admin.id);
      assert.match(createLog.summary, /newsupport@travalastic\.com/);
      assert.equal(JSON.stringify(createLog).includes(tempPwd), false);
    });
  });

  describe('3. PATCH /admin/admins/:id', () => {
    it('returns 400 for invalid ObjectId format', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: '/admin/admins/not-valid-id',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'support_agent' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /invalid.*id/i);
    });

    it('returns 404 for unknown admin id', async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${unknownId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'support_agent' },
      });
      assert.equal(res.status, 404);
    });

    it('rejects empty body with 400', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${editorId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: {},
      });
      assert.equal(res.status, 400);
    });

    it('rejects unknown fields with 400', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${editorId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'support_agent', email: 'hacked@example.com' },
      });
      assert.equal(res.status, 400);
    });

    it('blocks self-role-change with 400', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${superAdminId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'content_editor' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot change your own role/i);
    });

    it('blocks self-deactivation with 400', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${superAdminId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { active: false },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot deactivate your own account/i);
    });

    it('blocks demoting or deactivating the last active super admin with 409', async () => {
      const targetSuperId = new mongoose.Types.ObjectId().toString();
      const targetSuperDoc = {
        _id: new mongoose.Types.ObjectId(targetSuperId),
        email: 'target_super@travalastic.com',
        role: 'super_admin',
        active: true,
        save: async function () { return this; },
      };
      inMemoryAdmins.set(targetSuperId, targetSuperDoc);

      const origCount = AdminUser.countDocuments;
      AdminUser.countDocuments = () => Promise.resolve(1);

      try {
        // Demoting target super admin -> 409
        const demoteRes = await dispatch(app, {
          method: 'PATCH',
          url: `/admin/admins/${targetSuperId}`,
          headers: { Authorization: `Bearer ${superAdminToken}` },
          body: { role: 'content_editor' },
        });
        assert.equal(demoteRes.status, 409);
        assert.match(demoteRes.body.error, /last active super admin/i);

        // Deactivating target super admin -> 409
        const deactRes = await dispatch(app, {
          method: 'PATCH',
          url: `/admin/admins/${targetSuperId}`,
          headers: { Authorization: `Bearer ${superAdminToken}` },
          body: { active: false },
        });
        assert.equal(deactRes.status, 409);
        assert.match(deactRes.body.error, /last active super admin/i);
      } finally {
        AdminUser.countDocuments = origCount;
      }
    });

    it('updates role and active, audits as admin.update with before/after changes, and sets tokensValidAfter on deactivation', async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/admins/${editorId}`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { role: 'support_agent', active: false },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.admin.role, 'support_agent');
      assert.equal(res.body.admin.active, false);

      const targetInDb = inMemoryAdmins.get(editorId);
      assert.equal(targetInDb.role, 'support_agent');
      assert.equal(targetInDb.active, false);
      assert.ok(targetInDb.tokensValidAfter instanceof Date);

      const updateLog = inMemoryAuditLogs.find((l) => l.action === 'admin.update');
      assert.ok(updateLog);
      assert.equal(updateLog.targetId, editorId);
      assert.ok(Array.isArray(updateLog.changes));
      const roleChange = updateLog.changes.find((c) => c.field === 'role');
      assert.equal(roleChange?.before, 'content_editor');
      assert.equal(roleChange?.after, 'support_agent');
      const activeChange = updateLog.changes.find((c) => c.field === 'active');
      assert.equal(activeChange?.before, true);
      assert.equal(activeChange?.after, false);
    });
  });

  describe('4. POST /admin/admins/:id/reset-password', () => {
    it('returns 400 for invalid ObjectId format', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/admins/invalid-id/reset-password',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 for unknown admin id', async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();
      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/admins/${unknownId}/reset-password`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 404);
    });

    it('blocks self-reset with 400', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/admins/${superAdminId}/reset-password`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot reset your own password/i);
    });

    it('resets password, sets mustChangePassword=true and tokensValidAfter=now, and returns temporary password ONCE with Cache-Control: no-store', async () => {
      const oldEditorHash = inMemoryAdmins.get(editorId).passwordHash;

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/admins/${editorId}/reset-password`,
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.ok(res.body.temporaryPassword);
      assert.ok(res.body.temporaryPassword.length >= 16);

      const targetInDb = inMemoryAdmins.get(editorId);
      assert.notEqual(targetInDb.passwordHash, oldEditorHash);
      assert.equal(targetInDb.mustChangePassword, true);
      assert.ok(targetInDb.tokensValidAfter instanceof Date);

      // Verify audit log has admin.reset_password and does not leak password
      const resetLog = inMemoryAuditLogs.find((l) => l.action === 'admin.reset_password');
      assert.ok(resetLog);
      assert.equal(resetLog.targetId, editorId);
      assert.equal(JSON.stringify(resetLog).includes(res.body.temporaryPassword), false);

      // Verify editor's old token is now revoked (401)
      const accessRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/ping',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(accessRes.status, 401);
      assert.match(accessRes.body.error, /revoked/i);
    });
  });

  describe('5. Forced password change at first login & POST /admin/auth/change-password', () => {
    it('blocks administrative routes with 403 PASSWORD_CHANGE_REQUIRED when mustChangePassword is true', async () => {
      const helper = await createHelperAdmin();

      const pingRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/ping',
        headers: { Authorization: `Bearer ${helper.token}` },
      });
      assert.equal(pingRes.status, 403);
      assert.equal(pingRes.body.code, 'PASSWORD_CHANGE_REQUIRED');

      const auditRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit',
        headers: { Authorization: `Bearer ${helper.token}` },
      });
      assert.equal(auditRes.status, 403);
      assert.equal(auditRes.body.code, 'PASSWORD_CHANGE_REQUIRED');
    });

    it('allows GET /admin/auth/me when mustChangePassword is true', async () => {
      const helper = await createHelperAdmin();

      const meRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/auth/me',
        headers: { Authorization: `Bearer ${helper.token}` },
      });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.email, helper.email);
      assert.equal(meRes.body.mustChangePassword, true);
    });

    it('rejects change-password if newPassword < 12 characters', async () => {
      const helper = await createHelperAdmin();

      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/change-password',
        headers: { Authorization: `Bearer ${helper.token}` },
        body: { currentPassword: helper.tempPassword, newPassword: 'Short1!' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /12 characters/i);
    });

    it('rejects change-password if newPassword is same as currentPassword', async () => {
      const helper = await createHelperAdmin();

      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/change-password',
        headers: { Authorization: `Bearer ${helper.token}` },
        body: { currentPassword: helper.tempPassword, newPassword: helper.tempPassword },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /different/i);
    });

    it('rejects change-password if newPassword contains email local part before @', async () => {
      const helper = await createHelperAdmin();
      const localPart = helper.email.split('@')[0];

      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/change-password',
        headers: { Authorization: `Bearer ${helper.token}` },
        body: { currentPassword: helper.tempPassword, newPassword: `Password_${localPart}_2026!` },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /parts of your email/i);
    });

    it('rejects change-password if currentPassword is incorrect', async () => {
      const helper = await createHelperAdmin();

      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/change-password',
        headers: { Authorization: `Bearer ${helper.token}` },
        body: { currentPassword: 'WrongPassword999!', newPassword: 'ValidNewPassword123!' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /incorrect/i);
    });

    it('successfully changes password: old token rejected, new token works, and mustChangePassword cleared', async () => {
      const helper = await createHelperAdmin();
      const validNewPassword = 'SuperStrongNewPassword2026!';

      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/change-password',
        headers: { Authorization: `Bearer ${helper.token}` },
        body: { currentPassword: helper.tempPassword, newPassword: validNewPassword },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      const newToken = res.body.token;
      assert.ok(newToken);

      // Verify audit log has admin.password_changed and no password leakage
      const pwdLog = inMemoryAuditLogs.find((l) => l.action === 'admin.password_changed');
      assert.ok(pwdLog);
      assert.equal(pwdLog.targetId, helper.adminId);
      assert.equal(JSON.stringify(pwdLog).includes(validNewPassword), false);

      // Verify old token is now revoked (401)
      const oldTokenRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/ping',
        headers: { Authorization: `Bearer ${helper.token}` },
      });
      assert.equal(oldTokenRes.status, 401);

      // Verify new token works on regular routes
      const pingRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/ping',
        headers: { Authorization: `Bearer ${newToken}` },
      });
      assert.equal(pingRes.status, 200);
      assert.equal(pingRes.body.ok, true);

      // Verify GET /me returns mustChangePassword: false
      const meRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/auth/me',
        headers: { Authorization: `Bearer ${newToken}` },
      });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.mustChangePassword, false);
    });
  });

  describe('6. Rate limiting and rollback', () => {
    it('enforces adminManagementLimiter (30 req / min) on administrative routes', async () => {
      const dedicatedAdminId = new mongoose.Types.ObjectId().toString();
      const dedicatedToken = jwt.sign(
        { sub: dedicatedAdminId, role: 'super_admin' },
        ADMIN_JWT_SECRET,
        { audience: 'admin', expiresIn: '8h' }
      );
      inMemoryAdmins.set(dedicatedAdminId, {
        _id: new mongoose.Types.ObjectId(dedicatedAdminId),
        email: 'ratelimit@travalastic.com',
        role: 'super_admin',
        active: true,
        mustChangePassword: false,
        tokensValidAfter: null,
      });

      // Send 30 requests -> all 200
      for (let i = 0; i < 30; i++) {
        const res = await dispatch(app, {
          method: 'GET',
          url: '/admin/admins',
          headers: { Authorization: `Bearer ${dedicatedToken}` },
        });
        assert.equal(res.status, 200);
      }

      // 31st request -> 429
      const blockedRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/admins',
        headers: { Authorization: `Bearer ${dedicatedToken}` },
      });
      assert.equal(blockedRes.status, 429);
      assert.match(blockedRes.body.error, /too many administrative requests/i);
    });

    it('rolls back and does not persist audit log when mutation fails in runAudited', async () => {
      const origCreate = AdminUser.create;
      AdminUser.create = () => {
        throw new Error('Simulated DB failure during admin creation');
      };

      const auditCountBefore = inMemoryAuditLogs.length;

      try {
        const res = await dispatch(app, {
          method: 'POST',
          url: '/admin/admins',
          headers: { Authorization: `Bearer ${superAdminToken}` },
          body: { email: 'failadmin@travalastic.com', role: 'support_agent' },
        });

        assert.equal(res.status, 500);

        // Verify no successful admin.create log was added
        const createLogs = inMemoryAuditLogs.filter((l) => l.action === 'admin.create');
        assert.equal(createLogs.length, 0);
      } finally {
        AdminUser.create = origCreate;
      }
    });
  });
});

