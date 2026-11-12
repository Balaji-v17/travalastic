import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import adminRouter from '../src/routes/admin.js';
import stylesPublicRouter, { invalidateStylePublicCache } from '../src/routes/styles.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';
import StyleCollection, { ALLOWED_STYLE_KEYS } from '../src/models/StyleCollection.js';
import { seedStyleCollections } from '../scripts/seedStyleCollections.js';
import { buildStyleUpdateSummary } from '../src/routes/adminStyles.js';

const ADMIN_JWT_SECRET = 'test_admin_styles_jwt_secret_12345';
const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_67890';

let testIpCounter = 1;
function dispatch(appInstance, { method, url, headers = {}, body = '', ip = null }) {
  const requestIp = ip || `127.0.8.${testIpCounter++}`;
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

describe('Admin Panel Piece A8a: Style Collections Management & Dynamic Picks', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let editorId;
  let editorToken;
  let supportAgentId;
  let supportAgentToken;
  let inMemoryAdmins;
  let inMemoryCollections;
  let inMemoryAuditLogs;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    editorId = new mongoose.Types.ObjectId().toString();
    supportAgentId = new mongoose.Types.ObjectId().toString();

    const pwdHash = await bcrypt.hash('TestPassword123!', 10);

    inMemoryAdmins = new Map();
    inMemoryCollections = new Map();
    inMemoryAuditLogs = [];
    invalidateStylePublicCache();

    const superAdminDoc = {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'super@travalastic.com',
      passwordHash: pwdHash,
      role: 'super_admin',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      save: async function () { return this; },
    };
    const editorDoc = {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: pwdHash,
      role: 'content_editor',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      save: async function () { return this; },
    };
    const supportAgentDoc = {
      _id: new mongoose.Types.ObjectId(supportAgentId),
      email: 'support@travalastic.com',
      passwordHash: pwdHash,
      role: 'support_agent',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      save: async function () { return this; },
    };

    inMemoryAdmins.set(superAdminId, superAdminDoc);
    inMemoryAdmins.set(editorId, editorDoc);
    inMemoryAdmins.set(supportAgentId, supportAgentDoc);

    superAdminToken = jwt.sign({ sub: superAdminId, role: 'super_admin' }, ADMIN_JWT_SECRET, {
      audience: 'admin',
      expiresIn: '8h',
    });
    editorToken = jwt.sign({ sub: editorId, role: 'content_editor' }, ADMIN_JWT_SECRET, {
      audience: 'admin',
      expiresIn: '8h',
    });
    supportAgentToken = jwt.sign({ sub: supportAgentId, role: 'support_agent' }, ADMIN_JWT_SECRET, {
      audience: 'admin',
      expiresIn: '8h',
    });

    AdminUser.findById = async (id) => inMemoryAdmins.get(id?.toString()) || null;
    AdminUser.findOne = async (q) => {
      for (const a of inMemoryAdmins.values()) {
        if (q.email && a.email === q.email) return a;
      }
      return null;
    };

    const makeCollectionDoc = (raw) => {
      const doc = {
        _id: raw._id || new mongoose.Types.ObjectId(),
        key: raw.key,
        picks: (raw.picks || []).map((p) => ({ ...p })),
        version: raw.version || 1,
        updatedBy: raw.updatedBy || null,
        updatedByEmail: raw.updatedByEmail || null,
        createdAt: raw.createdAt || new Date(),
        updatedAt: raw.updatedAt || new Date(),
        save: async function (opts = {}) {
          this.updatedAt = new Date();
          inMemoryCollections.set(this.key, this);
          return this;
        },
      };
      return doc;
    };

    StyleCollection.create = async (arr) => {
      const items = Array.isArray(arr) ? arr : [arr];
      const created = [];
      for (const item of items) {
        const doc = makeCollectionDoc(item);
        inMemoryCollections.set(doc.key, doc);
        created.push(doc);
      }
      return Array.isArray(arr) ? created : created[0];
    };

    StyleCollection.findOne = async (q) => {
      if (q.key) {
        return inMemoryCollections.get(q.key) || null;
      }
      return null;
    };

    StyleCollection.find = (q = {}) => {
      const all = Array.from(inMemoryCollections.values());
      return {
        sort: () => Promise.resolve(all),
        lean: () => Promise.resolve(all),
        then: (resolve, reject) => Promise.resolve(all).then(resolve, reject),
      };
    };

    AuditLog.create = async (arr) => {
      const items = Array.isArray(arr) ? arr : [arr];
      for (const it of items) {
        inMemoryAuditLogs.push({ ...it, _id: new mongoose.Types.ObjectId() });
      }
      return items;
    };

    // Initialize initial collections in memory
    for (const key of ALLOWED_STYLE_KEYS) {
      inMemoryCollections.set(
        key,
        makeCollectionDoc({
          key,
          picks: [{ name: 'Goa' }, { name: 'Munnar' }],
          version: 1,
        })
      );
    }

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
    app.use('/styles', stylesPublicRouter);
  });

  describe('1. Summary Builder Unit Tests', () => {
    it('generates correct summary for added and removed picks', () => {
      const summary = buildStyleUpdateSummary(['Goa', 'Munnar'], ['Munnar', 'Udaipur', 'Ooty']);
      assert.equal(summary, 'Added: Udaipur, Ooty. Removed: Goa.');
    });

    it('generates correct summary when picks are reordered', () => {
      const summary = buildStyleUpdateSummary(['Goa', 'Munnar', 'Ooty'], ['Ooty', 'Munnar', 'Goa']);
      assert.equal(summary, 'Reordered.');
    });

    it('generates correct summary for added, removed, and reordered', () => {
      const summary = buildStyleUpdateSummary(['Goa', 'Munnar', 'Ooty'], ['Ooty', 'Jaipur', 'Goa']);
      assert.equal(summary, 'Added: Jaipur. Removed: Munnar. Reordered.');
    });

    it('handles no changes gracefully', () => {
      const summary = buildStyleUpdateSummary(['Goa', 'Munnar'], ['Goa', 'Munnar']);
      assert.equal(summary, 'No changes to picks.');
    });
  });

  describe('2. Idempotent Seed Script Behavior', () => {
    it('creates all six collections when database is empty', async () => {
      inMemoryCollections.clear();
      const res = await seedStyleCollections({ connect: false, closeConnection: false });
      assert.equal(res.createdCount, 6);
      assert.equal(res.skippedCount, 0);
      assert.equal(inMemoryCollections.size, 6);
    });

    it('is idempotent on subsequent run and does not overwrite existing records', async () => {
      inMemoryCollections.clear();
      await seedStyleCollections({ connect: false, closeConnection: false });

      // Simulate editor editing honeymoons collection
      const edited = inMemoryCollections.get('honeymoons');
      edited.picks = [{ name: 'Paris' }, { name: 'Venice' }];
      edited.version = 4;

      const secondRun = await seedStyleCollections({ connect: false, closeConnection: false });
      assert.equal(secondRun.createdCount, 0);
      assert.equal(secondRun.skippedCount, 6);

      // Verify honeymoons was left untouched
      const afterSeed = inMemoryCollections.get('honeymoons');
      assert.equal(afterSeed.version, 4);
      assert.deepEqual(afterSeed.picks.map((p) => p.name), ['Paris', 'Venice']);
    });
  });

  describe('3. Public Route GET /styles/:key', () => {
    it('returns key, picks, and version without internal admin fields or ids', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/styles/honeymoons',
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=60');
      assert.equal(res.body.key, 'honeymoons');
      assert.equal(res.body.version, 1);
      assert.ok(Array.isArray(res.body.picks));
      assert.equal(res.body._id, undefined);
      assert.equal(res.body.updatedBy, undefined);
      assert.equal(res.body.updatedByEmail, undefined);
    });

    it('returns 404 for unknown or invalid style key', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/styles/unknown-style-key',
      });
      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found/i);
    });

    it('serves from 60-second in-memory cache and immediately invalidates upon admin PUT', async () => {
      const first = await dispatch(app, {
        method: 'GET',
        url: '/styles/adventure',
      });
      assert.equal(first.status, 200);

      // Admin updates adventure collection
      const putRes = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/adventure',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: 'Manali' }, { name: 'Leh' }, { name: 'Spiti' }],
        },
      });
      assert.equal(putRes.status, 200);

      // Next public read must immediately reflect the update (cache was invalidated)
      const afterPut = await dispatch(app, {
        method: 'GET',
        url: '/styles/adventure',
      });
      assert.equal(afterPut.status, 200);
      assert.equal(afterPut.body.version, 2);
      assert.equal(afterPut.body.picks.length, 3);
      assert.equal(afterPut.body.picks[0].name, 'Manali');
    });
  });

  describe('4. Role-Based Access Control (RBAC)', () => {
    it('rejects unauthenticated request to /admin/styles with 401', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles',
      });
      assert.equal(res.status, 401);
    });

    it('rejects support_agent with 403 and records admin.access_denied audit', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles',
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(res.status, 403);

      const deniedAudit = inMemoryAuditLogs.find((l) => l.action === 'admin.access_denied');
      assert.ok(deniedAudit);
      assert.equal(deniedAudit.actorEmail, 'support@travalastic.com');
    });

    it('allows content_editor to list collections and get single collection', async () => {
      const listRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles',
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.collections.length, 6);

      const singleRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles/honeymoons',
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(singleRes.status, 200);
      assert.equal(singleRes.body.key, 'honeymoons');
    });

    it('allows super_admin full access to admin styles endpoints', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
    });
  });

  describe('5. PUT /admin/styles/:key Validation & Error Table', () => {
    it('rejects unknown style key with 404', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/unsupported-key',
        headers: { authorization: `Bearer ${editorToken}` },
        body: { expectedVersion: 1, picks: [] },
      });
      assert.equal(res.status, 404);
    });

    it('rejects unknown body fields with 400', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/honeymoons',
        headers: { authorization: `Bearer ${editorToken}` },
        body: { expectedVersion: 1, picks: [], rogueField: 'danger' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Unknown field/i);
    });

    it('rejects non-integer expectedVersion with 400', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/honeymoons',
        headers: { authorization: `Bearer ${editorToken}` },
        body: { expectedVersion: 'one', picks: [] },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /expectedVersion must be an integer/i);
    });

    it('rejects array containing more than 12 picks with 400', async () => {
      const thirteenPicks = Array.from({ length: 13 }, (_, i) => ({ name: `Place ${i + 1}` }));
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/wellness',
        headers: { authorization: `Bearer ${editorToken}` },
        body: { expectedVersion: 1, picks: thirteenPicks },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /at most 12 picks/i);
    });

    it('rejects duplicate pick names in same collection with 400 (case and whitespace normalized)', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/family',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: 'Goa' }, { name: '   goa   ' }],
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /duplicate pick name/i);
    });

    it('rejects pick with empty or whitespace-only name with 400', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/family',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: '   ' }],
        },
      });
      assert.equal(res.status, 400);
    });

    it('rejects HTML tags in name or imageQuery with 400', async () => {
      const resHtmlName = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/family',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: '<script>alert(1)</script>' }],
        },
      });
      assert.equal(resHtmlName.status, 400);
      assert.match(resHtmlName.body.message, /HTML/i);

      const resHtmlQuery = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/family',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: 'Goa', imageQuery: '<img src=x onerror=alert(1)>' }],
        },
      });
      assert.equal(resHtmlQuery.status, 400);
      assert.match(resHtmlQuery.body.message, /HTML/i);
    });

    it('rejects version conflict with 409 and exact message', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/celebrations',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 99,
          picks: [{ name: 'Goa' }],
        },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.message, 'This collection changed. Reload and try again.');
    });
  });

  describe('6. PUT /admin/styles/:key Success & Audited Mutation', () => {
    it('successfully replaces picks, increments version, and creates audit log', async () => {
      const res = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/honeymoons',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [
            { name: 'Munnar' },
            { name: 'Udaipur', imageQuery: 'Lake Pichola' },
            { name: 'Ooty' },
          ],
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.version, 2);
      assert.equal(res.body.picks.length, 3);
      assert.equal(res.body.picks[1].imageQuery, 'Lake Pichola');
      assert.equal(res.body.updatedByEmail, 'editor@travalastic.com');

      // Verify audit entry
      const auditEntry = inMemoryAuditLogs.find((l) => l.action === 'style.update');
      assert.ok(auditEntry);
      assert.equal(auditEntry.targetId, 'honeymoons');
      assert.equal(auditEntry.actorEmail, 'editor@travalastic.com');
      assert.match(auditEntry.summary, /Added: Udaipur, Ooty\. Removed: Goa/);
    });

    it('rejects second attempt with stale expectedVersion with 409', async () => {
      // First update moves version from 1 -> 2
      const first = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/wellness',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: 'Rishikesh' }],
        },
      });
      assert.equal(first.status, 200);
      assert.equal(first.body.version, 2);

      // Attempting again with old expectedVersion 1 must fail with 409
      const second = await dispatch(app, {
        method: 'PUT',
        url: '/admin/styles/wellness',
        headers: { authorization: `Bearer ${editorToken}` },
        body: {
          expectedVersion: 1,
          picks: [{ name: 'Dharamshala' }],
        },
      });
      assert.equal(second.status, 409);
      assert.equal(second.body.message, 'This collection changed. Reload and try again.');
    });
  });

  describe('7. GET /admin/styles/preview-photo', () => {
    it('returns a photo for a real place', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles/preview-photo?query=Goa',
        headers: { authorization: `Bearer ${editorToken}` },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.photoUrl);
      assert.ok(res.body.photographerName);
    });

    it('returns 404 for unresolvable gibberish', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles/preview-photo?query=gibberishnonexistentplace999',
        headers: { authorization: `Bearer ${editorToken}` },
      });

      assert.equal(res.status, 404);
      assert.match(res.body.message, /No photo found/i);
    });

    it('rejects missing or empty query parameter with 400', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/styles/preview-photo?query=',
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res.status, 400);
    });

    it('rejects query exceeding 100 characters with 400', async () => {
      const longQuery = 'A'.repeat(101);
      const res = await dispatch(app, {
        method: 'GET',
        url: `/admin/styles/preview-photo?query=${longQuery}`,
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res.status, 400);
    });

    it('enforces rate limit of 20 requests/minute per admin', async () => {
      const dedicatedIp = '127.0.9.99';
      let lastStatus = 200;

      for (let i = 0; i < 21; i++) {
        const res = await dispatch(app, {
          method: 'GET',
          url: '/admin/styles/preview-photo?query=Goa',
          headers: { authorization: `Bearer ${superAdminToken}` },
          ip: dedicatedIp,
        });
        lastStatus = res.status;
      }

      assert.equal(lastStatus, 429);
    });
  });
});
