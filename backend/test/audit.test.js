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
} from '../src/middleware/adminAuth.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';
import {
  buildChanges,
  runAudited,
  recordEvent,
  sanitizeAuditValue,
} from '../src/services/audit.js';

const ADMIN_JWT_SECRET = 'test_admin_audit_secret_67890_min_32_chars';
const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_12345';

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

describe('Admin Panel Piece A2: Audit Log, Immutability & Wiring', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let editorToken;
  let supportToken;
  let inMemoryAuditLogs;
  let inMemoryAdmins;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    const superAdminHash = await bcrypt.hash('SuperAdminPassword123!', 10);
    const editorId = new mongoose.Types.ObjectId().toString();
    const supportId = new mongoose.Types.ObjectId().toString();

    inMemoryAdmins = new Map();
    inMemoryAuditLogs = [];

    const superAdminDoc = {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'superadmin@travalastic.com',
      passwordHash: superAdminHash,
      role: 'super_admin',
      active: true,
      lastLoginAt: null,
      save: async function () {
        inMemoryAdmins.set(this.email, this);
        return this;
      },
    };
    inMemoryAdmins.set('superadmin@travalastic.com', superAdminDoc);

    const editorDoc = {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: 'dummy',
      role: 'content_editor',
      active: true,
      save: async function () { return this; },
    };
    inMemoryAdmins.set('editor@travalastic.com', editorDoc);

    const supportDoc = {
      _id: new mongoose.Types.ObjectId(supportId),
      email: 'support@travalastic.com',
      passwordHash: 'dummy',
      role: 'support_agent',
      active: true,
      save: async function () { return this; },
    };
    inMemoryAdmins.set('support@travalastic.com', supportDoc);

    // Tokens
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
    supportToken = jwt.sign(
      { sub: supportId, role: 'support_agent' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    // Mock AdminUser
    AdminUser.findOne = ({ email }) => {
      const match = inMemoryAdmins.get(email?.toLowerCase());
      return Promise.resolve(match || null);
    };
    AdminUser.findById = (id) => {
      for (const doc of inMemoryAdmins.values()) {
        if (doc._id.toString() === id.toString()) {
          return Promise.resolve(doc);
        }
      }
      return Promise.resolve(null);
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

    // Mock AuditLog.findById
    AuditLog.findById = (id) => {
      const found = inMemoryAuditLogs.find((d) => d._id.toString() === id.toString());
      return {
        select: () => ({
          lean: () => Promise.resolve(found || null),
        }),
      };
    };

    // Mock AuditLog.find with filter, sort, limit, lean
    AuditLog.find = (query = {}) => {
      let results = [...inMemoryAuditLogs];

      if (query.actorEmail) {
        results = results.filter((d) => d.actorEmail === query.actorEmail);
      }
      if (query.action) {
        results = results.filter((d) => d.action === query.action);
      }
      if (query.targetType) {
        results = results.filter((d) => d.targetType === query.targetType);
      }
      if (query.targetId) {
        results = results.filter((d) => d.targetId === query.targetId);
      }
      if (query.at?.$gte) {
        results = results.filter((d) => new Date(d.at) >= query.at.$gte);
      }
      if (query.at?.$lte) {
        results = results.filter((d) => new Date(d.at) <= query.at.$lte);
      }
      if (query._id?.$lt) {
        results = results.filter((d) => d._id.toString() < query._id.$lt.toString());
      }
      if (query.$or) {
        results = results.filter((d) => {
          return query.$or.some((clause) => {
            if (clause.at?.$lt) {
              return new Date(d.at) < new Date(clause.at.$lt);
            }
            if (clause.at && clause._id?.$lt) {
              return (
                new Date(d.at).getTime() === new Date(clause.at).getTime() &&
                d._id.toString() < clause._id.$lt.toString()
              );
            }
            return false;
          });
        });
      }

      const chain = {
        sort: (sortObj) => {
          results.sort((a, b) => {
            const timeDiff = new Date(b.at).getTime() - new Date(a.at).getTime();
            if (timeDiff !== 0) return timeDiff;
            return b._id.toString().localeCompare(a._id.toString());
          });
          return chain;
        },
        limit: (n) => {
          results = results.slice(0, n);
          return chain;
        },
        lean: () => Promise.resolve(results),
      };

      return chain;
    };

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
  });

  describe('1. buildChanges pure helper', () => {
    it('returns only changed fields among allowedFields; ignores unchanged and unlisted fields', () => {
      const before = { title: 'Old Title', desc: 'Same', secretNote: 'hidden', extra: 1 };
      const after = { title: 'New Title', desc: 'Same', secretNote: 'changed', extra: 2 };
      const allowed = ['title', 'desc'];

      const changes = buildChanges(before, after, allowed);

      assert.equal(changes.length, 1);
      assert.equal(changes[0].field, 'title');
      assert.equal(changes[0].before, 'Old Title');
      assert.equal(changes[0].after, 'New Title');
    });

    it('redacts sensitive fields (password, token, apiKey, secret, etc.) including nested keys', () => {
      const before = {
        password: 'PlainTextPassword1!',
        userToken: 'token-abc',
        config: { apiKey: 'key-123', normal: 'safe' },
      };
      const after = {
        password: 'PlainTextPassword2!',
        userToken: 'token-def',
        config: { apiKey: 'key-456', normal: 'updated' },
      };
      const allowed = ['password', 'userToken', 'config'];

      const changes = buildChanges(before, after, allowed);

      const pwdChange = changes.find((c) => c.field === 'password');
      assert.equal(pwdChange.before, '[redacted]');
      assert.equal(pwdChange.after, '[redacted]');

      const tokenChange = changes.find((c) => c.field === 'userToken');
      assert.equal(tokenChange.before, '[redacted]');
      assert.equal(tokenChange.after, '[redacted]');

      const configChange = changes.find((c) => c.field === 'config');
      assert.equal(configChange.before.apiKey, '[redacted]');
      assert.equal(configChange.after.apiKey, '[redacted]');
      assert.equal(configChange.before.normal, 'safe');
      assert.equal(configChange.after.normal, 'updated');
    });

    it('truncates strings exceeding 300 characters with "..." appended', () => {
      const longBefore = 'A'.repeat(500);
      const longAfter = 'B'.repeat(400);

      const changes = buildChanges({ note: longBefore }, { note: longAfter }, ['note']);

      assert.equal(changes.length, 1);
      assert.equal(changes[0].before.length, 303);
      assert.ok(changes[0].before.endsWith('...'));
      assert.equal(changes[0].after.length, 303);
      assert.ok(changes[0].after.endsWith('...'));
    });

    it('caps changes at max 20 entries even if more allowed fields changed', () => {
      const before = {};
      const after = {};
      const allowed = [];
      for (let i = 1; i <= 30; i++) {
        const key = `field_${i}`;
        allowed.push(key);
        before[key] = `val_${i}_old`;
        after[key] = `val_${i}_new`;
      }

      const changes = buildChanges(before, after, allowed);
      assert.equal(changes.length, 20);
    });
  });

  describe('2. Model immutability and append-only enforcement', () => {
    it('blocks update and delete operations on AuditLog model and documents by throwing', () => {
      const blockedOperations = [
        'updateOne',
        'updateMany',
        'findOneAndUpdate',
        'findOneAndDelete',
        'deleteOne',
        'deleteMany',
        'replaceOne',
      ];

      for (const op of blockedOperations) {
        assert.throws(
          () => {
            AuditLog[op]({}, {});
          },
          {
            message: new RegExp(`AuditLog is append-only: ${op} is prohibited`),
          },
          `AuditLog.${op} must throw prohibited error`
        );
      }

      // Existing document save attempt
      const existingDoc = new AuditLog({
        actorId: 'test',
        actorEmail: 'test@example.com',
        actorRole: 'super_admin',
        action: 'test',
        summary: 'test',
      });
      existingDoc.isNew = false;

      assert.rejects(
        async () => {
          await existingDoc.save();
        },
        {
          message: 'AuditLog is append-only: existing entries cannot be modified',
        }
      );
    });
  });

  describe('3. runAudited helper execution & rollback', () => {
    it('writes mutation and audit entry together inside transaction mode', async () => {
      let mutationRan = false;
      let sessionPassed = null;

      // Mock startSession to return transactional session mock
      const originalStartSession = mongoose.startSession;
      mongoose.startSession = async () => ({
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {},
        endSession: async () => {},
      });

      const originalConnectionState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      try {
        const fakeReq = {
          admin: { id: superAdminId, email: 'superadmin@travalastic.com', role: 'super_admin' },
        };

        const result = await runAudited(
          fakeReq,
          {
            action: 'destination.update',
            targetType: 'Destination',
            targetId: 'dest_123',
            summary: 'Updated destination metadata',
            allowedFields: ['name'],
            before: { name: 'Old Goa' },
            after: { name: 'New Goa' },
          },
          async (session) => {
            mutationRan = true;
            sessionPassed = session;
            return { success: true };
          }
        );

        assert.equal(result.success, true);
        assert.equal(mutationRan, true);
        assert.ok(sessionPassed);

        const auditEntry = inMemoryAuditLogs.find((l) => l.action === 'destination.update');
        assert.ok(auditEntry);
        assert.equal(auditEntry.summary, 'Updated destination metadata');
        assert.equal(auditEntry.changes[0].field, 'name');
        assert.equal(auditEntry.changes[0].before, 'Old Goa');
        assert.equal(auditEntry.changes[0].after, 'New Goa');
      } finally {
        mongoose.startSession = originalStartSession;
        Object.defineProperty(mongoose.connection, 'readyState', { value: originalConnectionState, configurable: true });
      }
    });

    it('rolls back mutation and throws 500 when mutation throws', async () => {
      let aborted = false;

      const originalStartSession = mongoose.startSession;
      mongoose.startSession = async () => ({
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => { aborted = true; },
        endSession: async () => {},
      });
      const originalConnectionState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      try {
        const fakeReq = {
          admin: { id: superAdminId, email: 'superadmin@travalastic.com', role: 'super_admin' },
        };

        await assert.rejects(
          async () => {
            await runAudited(
              fakeReq,
              {
                action: 'test.mutation_fail',
                summary: 'Should fail',
              },
              async () => {
                throw new Error('Database disk error during mutation');
              }
            );
          },
          {
            statusCode: 500,
            message: 'Audited operation failed and was rolled back',
          }
        );

        assert.equal(aborted, true, 'Transaction should have aborted');
      } finally {
        mongoose.startSession = originalStartSession;
        Object.defineProperty(mongoose.connection, 'readyState', { value: originalConnectionState, configurable: true });
      }
    });
  });

  describe('4. Login success / failure wiring', () => {
    it('records admin.login on success with actor id, email, role', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/login',
        body: {
          email: 'superadmin@travalastic.com',
          password: 'SuperAdminPassword123!',
        },
      });

      assert.equal(res.status, 200);

      const loginEvent = inMemoryAuditLogs.find((l) => l.action === 'admin.login');
      assert.ok(loginEvent, 'admin.login must be recorded');
      assert.equal(loginEvent.actorEmail, 'superadmin@travalastic.com');
      assert.equal(loginEvent.actorRole, 'super_admin');
      assert.equal(loginEvent.actorId, superAdminId);
      assert.equal(loginEvent.targetType, 'AdminUser');
    });

    it('records admin.login_failed ONLY when email matches existing admin; ignores unknown emails', async () => {
      // 1. Existing admin with wrong password
      const failedRealRes = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/login',
        body: {
          email: 'superadmin@travalastic.com',
          password: 'WrongPassword!',
        },
      });
      assert.equal(failedRealRes.status, 401);

      const failedEvent = inMemoryAuditLogs.find((l) => l.action === 'admin.login_failed');
      assert.ok(failedEvent, 'admin.login_failed must be recorded for existing admin');
      assert.equal(failedEvent.actorEmail, 'superadmin@travalastic.com');

      // 2. Non-existent email
      const previousLogCount = inMemoryAuditLogs.length;
      const failedUnknownRes = await dispatch(app, {
        method: 'POST',
        url: '/admin/auth/login',
        body: {
          email: 'unknown-intruder@example.com',
          password: 'AnyPassword!',
        },
      });
      assert.equal(failedUnknownRes.status, 401);

      assert.equal(
        inMemoryAuditLogs.length,
        previousLogCount,
        'No audit log must be recorded for unknown attempted emails'
      );
    });
  });

  describe('5. Access denial wiring (403)', () => {
    it('records admin.access_denied with route path and actor role when requireRole returns 403', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${editorToken}` },
      });

      assert.equal(res.status, 403);

      const deniedEvent = inMemoryAuditLogs.find((l) => l.action === 'admin.access_denied');
      assert.ok(deniedEvent, 'admin.access_denied must be recorded');
      assert.equal(deniedEvent.actorRole, 'content_editor');
      assert.equal(deniedEvent.targetType, 'Route');
      assert.ok(deniedEvent.targetId.includes('/admin/audit'));
    });
  });

  describe('6. GET /admin/audit role authorization', () => {
    it('returns 403 for support_agent and content_editor; returns 200 for super_admin', async () => {
      const supportRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${supportToken}` },
      });
      assert.equal(supportRes.status, 403);

      const editorRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(editorRes.status, 403);

      const superRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(superRes.status, 200);
      assert.ok(Array.isArray(superRes.body.items));
    });
  });

  describe('7. GET /admin/audit filtering, pagination, and validation', () => {
    beforeEach(async () => {
      inMemoryAuditLogs.length = 0;

      // Seed sample logs
      const baseDate = new Date('2026-11-01T10:00:00.000Z');
      for (let i = 1; i <= 25; i++) {
        await AuditLog.create({
          at: new Date(baseDate.getTime() + i * 3600000),
          actorId: i % 2 === 0 ? superAdminId : 'editor_id',
          actorEmail: i % 2 === 0 ? 'superadmin@travalastic.com' : 'editor@travalastic.com',
          actorRole: i % 2 === 0 ? 'super_admin' : 'content_editor',
          action: i % 3 === 0 ? 'place.update' : 'admin.login',
          targetType: i % 3 === 0 ? 'Place' : 'AdminUser',
          targetId: `target_${i}`,
          summary: `Summary item ${i}`,
        });
      }
    });

    it('filters by actor, action, targetType, and targetId', async () => {
      const resActor = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?actor=editor@travalastic.com',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(resActor.status, 200);
      assert.ok(resActor.body.items.length > 0);
      assert.ok(resActor.body.items.every((item) => item.actorEmail === 'editor@travalastic.com'));

      const resAction = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?action=place.update',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(resAction.status, 200);
      assert.ok(resAction.body.items.length > 0);
      assert.ok(resAction.body.items.every((item) => item.action === 'place.update'));
    });

    it('filters by from and to dates, and returns 400 for invalid dates', async () => {
      const validDateRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?from=2026-11-01T12:00:00Z&to=2026-11-01T16:00:00Z',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(validDateRes.status, 200);

      const invalidFromRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?from=not-a-valid-date',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(invalidFromRes.status, 400);

      const invalidToRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?to=invalid-date',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(invalidToRes.status, 400);
    });

    it('caps limit at 100 max', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?limit=250',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.items.length <= 100);
    });

    it('paginates correctly using cursor without duplicates', async () => {
      // Page 1 with limit=10
      const page1Res = await dispatch(app, {
        method: 'GET',
        url: '/admin/audit?limit=10',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(page1Res.status, 200);
      assert.equal(page1Res.body.items.length, 10);
      assert.ok(page1Res.body.nextCursor);

      // Page 2 using cursor
      const page2Res = await dispatch(app, {
        method: 'GET',
        url: `/admin/audit?limit=10&cursor=${page1Res.body.nextCursor}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(page2Res.status, 200);
      assert.equal(page2Res.body.items.length, 10);

      // Verify no duplicate IDs across pages
      const page1Ids = new Set(page1Res.body.items.map((i) => i.id));
      for (const item of page2Res.body.items) {
        assert.ok(!page1Ids.has(item.id), `ID ${item.id} must not appear on both pages`);
      }
    });
  });
});

