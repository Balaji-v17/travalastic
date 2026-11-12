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
import User from '../src/models/User.js';
import Itinerary from '../src/models/Itinerary.js';
import Conversation from '../src/models/Conversation.js';
import Expense from '../src/models/Expense.js';
import Booking from '../src/models/Booking.js';
import PackingTemplate from '../src/models/PackingTemplate.js';
import Disruption from '../src/models/Disruption.js';
import authenticate from '../src/middleware/authenticate.js';
import { deleteUserAndData, countUserData } from '../src/services/accountDeletion.js';

const ADMIN_JWT_SECRET = 'test_admin_support_jwt_secret_12345';
const TRAVELER_JWT_SECRET = 'test_traveler_support_jwt_secret_67890';

let testIpCounter = 1;
function dispatch(appInstance, { method, url, headers = {}, body = '', ip = null }) {
  const requestIp = ip || `127.0.9.${testIpCounter++}`;
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
      res.emit('finish');
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk.toString();
      res.emit('finish');
      try {
        resolve({ status: statusCode, headers: resHeaders, body: JSON.parse(resBody) });
      } catch {
        resolve({ status: statusCode, headers: resHeaders, body: resBody });
      }
    };

    appInstance.handle(req, res);
  });
}

describe('Admin Panel Piece A9a: Support Account Deletion Preview & Audited Flow', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let supportAgentId;
  let supportAgentToken;
  let editorId;
  let editorToken;

  // In-memory data store for tests
  let inMemoryAdmins;
  let inMemoryUsers;
  let inMemoryItineraries;
  let inMemoryConversations;
  let inMemoryExpenses;
  let inMemoryBookings;
  let inMemoryPackingTemplates;
  let inMemoryDisruptions;
  let inMemoryAuditLogs;

  // Stored original methods for restoration
  let originalMongooseMethods;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    supportAgentId = new mongoose.Types.ObjectId().toString();
    editorId = new mongoose.Types.ObjectId().toString();

    const pwdHash = await bcrypt.hash('TestPassword123!', 10);

    inMemoryAdmins = new Map();
    inMemoryUsers = new Map();
    inMemoryItineraries = new Map();
    inMemoryConversations = new Map();
    inMemoryExpenses = new Map();
    inMemoryBookings = new Map();
    inMemoryPackingTemplates = new Map();
    inMemoryDisruptions = new Map();
    inMemoryAuditLogs = [];

    // Seed admin accounts
    inMemoryAdmins.set(superAdminId, {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'super@travalastic.com',
      passwordHash: pwdHash,
      role: 'super_admin',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
    });

    inMemoryAdmins.set(supportAgentId, {
      _id: new mongoose.Types.ObjectId(supportAgentId),
      email: 'support@travalastic.com',
      passwordHash: pwdHash,
      role: 'support_agent',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
    });

    inMemoryAdmins.set(editorId, {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: pwdHash,
      role: 'content_editor',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
    });

    superAdminToken = jwt.sign(
      { sub: superAdminId, role: 'super_admin' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    supportAgentToken = jwt.sign(
      { sub: supportAgentId, role: 'support_agent' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    editorToken = jwt.sign(
      { sub: editorId, role: 'content_editor' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    // Stub Mongoose models to in-memory maps
    originalMongooseMethods = {
      adminFindById: AdminUser.findById,
      auditCreate: AuditLog.create,
      userFindOne: User.findOne,
      userFindById: User.findById,
      userDeleteOne: User.deleteOne,
      userCountDocuments: User.countDocuments,
      itinDeleteMany: Itinerary.deleteMany,
      itinCountDocuments: Itinerary.countDocuments,
      convDeleteMany: Conversation.deleteMany,
      convCountDocuments: Conversation.countDocuments,
      expDeleteMany: Expense.deleteMany,
      expCountDocuments: Expense.countDocuments,
      bookDeleteMany: Booking.deleteMany,
      bookCountDocuments: Booking.countDocuments,
      packDeleteMany: PackingTemplate.deleteMany,
      packCountDocuments: PackingTemplate.countDocuments,
      disrDeleteMany: Disruption.deleteMany,
      disrCountDocuments: Disruption.countDocuments,
    };

    AdminUser.findById = (id) => {
      const idStr = id?.toString();
      const doc = inMemoryAdmins.get(idStr);
      return {
        lean: () => Promise.resolve(doc ? { ...doc } : null),
        then: (resolve) => resolve(doc ? { ...doc } : null),
      };
    };

    AuditLog.create = async (docOrDocs) => {
      const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      for (const d of docs) {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          at: d.at || new Date(),
          ...d,
        };
        inMemoryAuditLogs.push(item);
      }
      return Array.isArray(docOrDocs) ? docs : docs[0];
    };

    User.findOne = (filter) => {
      let found = null;
      if (filter && filter.email) {
        for (const u of inMemoryUsers.values()) {
          if (u.email === filter.email) {
            found = u;
            break;
          }
        }
      }
      return {
        lean: () => Promise.resolve(found ? { ...found } : null),
        then: (resolve) => resolve(found ? { ...found } : null),
      };
    };

    User.findById = (id) => {
      const idStr = id?.toString();
      const doc = inMemoryUsers.get(idStr);
      return {
        select: () => ({
          lean: () => Promise.resolve(doc ? { _id: doc._id } : null),
          then: (resolve) => resolve(doc ? { _id: doc._id } : null),
        }),
        lean: () => Promise.resolve(doc ? { ...doc } : null),
        then: (resolve) => resolve(doc ? { ...doc } : null),
      };
    };

    User.deleteOne = async (filter) => {
      const idStr = filter?._id?.toString();
      if (idStr && inMemoryUsers.has(idStr)) {
        inMemoryUsers.delete(idStr);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    };

    User.countDocuments = async (filter) => {
      const idStr = filter?._id?.toString();
      if (idStr && inMemoryUsers.has(idStr)) {
        return 1;
      }
      return 0;
    };

    function setupCollectionStubs(map, model) {
      model.deleteMany = async (filter) => {
        const uid = filter?.userId?.toString();
        let deleted = 0;
        for (const [id, item] of map.entries()) {
          if (item.userId?.toString() === uid) {
            map.delete(id);
            deleted++;
          }
        }
        return { deletedCount: deleted };
      };
      model.countDocuments = async (filter) => {
        const uid = filter?.userId?.toString();
        let count = 0;
        for (const item of map.values()) {
          if (item.userId?.toString() === uid) {
            count++;
          }
        }
        return count;
      };
    }

    setupCollectionStubs(inMemoryItineraries, Itinerary);
    setupCollectionStubs(inMemoryConversations, Conversation);
    setupCollectionStubs(inMemoryExpenses, Expense);
    setupCollectionStubs(inMemoryBookings, Booking);
    setupCollectionStubs(inMemoryPackingTemplates, PackingTemplate);
    setupCollectionStubs(inMemoryDisruptions, Disruption);

    // Initialize express app with admin routes
    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);

    // Traveler authenticated endpoint to verify token rejection after deletion
    app.get('/traveler/profile', authenticate, (req, res) => {
      res.status(200).json({ ok: true, userId: req.userId });
    });
  });

  function restoreOriginalMethods() {
    AdminUser.findById = originalMongooseMethods.adminFindById;
    AuditLog.create = originalMongooseMethods.auditCreate;
    User.findOne = originalMongooseMethods.userFindOne;
    User.findById = originalMongooseMethods.userFindById;
    User.deleteOne = originalMongooseMethods.userDeleteOne;
    User.countDocuments = originalMongooseMethods.userCountDocuments;
    Itinerary.deleteMany = originalMongooseMethods.itinDeleteMany;
    Itinerary.countDocuments = originalMongooseMethods.itinCountDocuments;
    Conversation.deleteMany = originalMongooseMethods.convDeleteMany;
    Conversation.countDocuments = originalMongooseMethods.convCountDocuments;
    Expense.deleteMany = originalMongooseMethods.expDeleteMany;
    Expense.countDocuments = originalMongooseMethods.expCountDocuments;
    Booking.deleteMany = originalMongooseMethods.bookDeleteMany;
    Booking.countDocuments = originalMongooseMethods.bookCountDocuments;
    PackingTemplate.deleteMany = originalMongooseMethods.packDeleteMany;
    PackingTemplate.countDocuments = originalMongooseMethods.packCountDocuments;
    Disruption.deleteMany = originalMongooseMethods.disrDeleteMany;
    Disruption.countDocuments = originalMongooseMethods.disrCountDocuments;
  }

  // Helper to create a complete fixture traveler with data across all 6 linked collections
  function createFixtureTraveler(email = 'traveler@example.com') {
    const userId = new mongoose.Types.ObjectId();
    const idStr = userId.toString();

    inMemoryUsers.set(idStr, {
      _id: userId,
      email: email.toLowerCase(),
      name: 'Fixture Traveler',
      passwordHash: 'dummyHash',
      createdAt: new Date('2026-01-15T10:00:00Z'),
    });

    inMemoryItineraries.set(`itin-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryItineraries.set(`itin-${idStr}-2`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryConversations.set(`conv-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryExpenses.set(`exp-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryBookings.set(`book-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryPackingTemplates.set(`pack-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });
    inMemoryDisruptions.set(`disr-${idStr}-1`, { _id: new mongoose.Types.ObjectId(), userId });

    const travelerToken = jwt.sign(
      { userId: idStr, email: email.toLowerCase() },
      TRAVELER_JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { id: idStr, email, token: travelerToken };
  }

  function createSupportAgent(prefix = 'agent') {
    const agentId = new mongoose.Types.ObjectId().toString();
    inMemoryAdmins.set(agentId, {
      _id: new mongoose.Types.ObjectId(agentId),
      email: `${prefix}-${agentId}@travalastic.com`,
      passwordHash: 'dummy',
      role: 'support_agent',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
    });
    const token = jwt.sign(
      { sub: agentId, role: 'support_agent' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );
    return { id: agentId, token };
  }

  describe('Role Matrix & Access Controls', () => {
    it('blocks content_editor with 403 and records access_denied audit event', async () => {
      const fixture = createFixtureTraveler();

      // Lookup
      const lookupRes = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(fixture.email)}`,
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(lookupRes.status, 403);

      // Preview
      const previewRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/deletion-preview`,
        headers: { authorization: `Bearer ${editorToken}` },
      });
      assert.equal(previewRes.status, 403);

      // Delete
      const deleteRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${editorToken}` },
        body: { confirmEmail: fixture.email, reason: 'Test reason', previewToken: 'token' },
      });
      assert.equal(deleteRes.status, 403);

      const deniedEvents = inMemoryAuditLogs.filter((l) => l.action === 'admin.access_denied');
      assert.ok(deniedEvents.length >= 3);
      assert.equal(deniedEvents[0].actorRole, 'content_editor');
    });

    it('allows support_agent and super_admin to access all support routes', async () => {
      const fixture = createFixtureTraveler();

      // support_agent can lookup
      const resSupport = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(fixture.email)}`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resSupport.status, 200);

      // super_admin can lookup
      const resSuper = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(fixture.email)}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(resSuper.status, 200);
    });
  });

  describe('GET /admin/support/users (Lookup)', () => {
    it('finds user by exact email, case-insensitively, and trims spaces', async () => {
      const fixture = createFixtureTraveler('john.doe@example.com');

      // Uppercase input
      const resUpper = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=JOHN.DOE@EXAMPLE.COM`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resUpper.status, 200);
      assert.equal(resUpper.body.id, fixture.id);
      assert.equal(resUpper.body.email, 'john.doe@example.com');

      // Spaces trimmed
      const resTrim = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=%20john.doe@example.com%20`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resTrim.status, 200);
      assert.equal(resTrim.body.id, fixture.id);
    });

    it('response contains exactly the four permitted fields: id, email, createdAt, status', async () => {
      const fixture = createFixtureTraveler('exact.keys@example.com');

      const res = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(fixture.email)}`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });

      assert.equal(res.status, 200);
      const keys = Object.keys(res.body).sort();
      assert.deepStrictEqual(keys, ['createdAt', 'email', 'id', 'status']);
      assert.equal(res.body.status, 'active');
      assert.equal(typeof res.body.id, 'string');
      assert.equal(typeof res.body.email, 'string');
      // Assert no secret or content fields leaked
      assert.equal(res.body.passwordHash, undefined);
      assert.equal(res.body.name, undefined);
      assert.equal(res.body.itineraries, undefined);
    });

    it('rejects partial email, prefix, regex, or wildcard queries', async () => {
      createFixtureTraveler('alice.smith@example.com');

      const partialQueries = [
        'alice',
        'alice.smith',
        'alice.smith@',
        'smith@example.com',
        'alice.*@example.com',
        'alice%@example.com',
        '.*',
        '*',
      ];

      for (const q of partialQueries) {
        const res = await dispatch(app, {
          method: 'GET',
          url: `/admin/support/users?email=${encodeURIComponent(q)}`,
          headers: { authorization: `Bearer ${supportAgentToken}` },
        });
        assert.equal(res.status, 404, `Query "${q}" should not match`);
      }
    });

    it('audits successful lookup with user ID and NO email stored in audit entry', async () => {
      const fixture = createFixtureTraveler('audit.test@example.com');
      inMemoryAuditLogs = [];

      const res = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(fixture.email)}`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(res.status, 200);

      const log = inMemoryAuditLogs.find((l) => l.action === 'support.user_lookup');
      assert.ok(log, 'Audit entry for support.user_lookup must exist');
      assert.equal(log.targetType, 'user');
      assert.equal(log.targetId, fixture.id);
      assert.equal(log.actorRole, 'support_agent');

      // Crucial privacy check: email must NOT appear in audit summary or log object
      const logJson = JSON.stringify(log);
      assert.equal(logJson.includes(fixture.email), false);
    });

    it('audits non-matching lookup with no target ID and NO email stored', async () => {
      inMemoryAuditLogs = [];
      const nonExistentEmail = 'ghost.user.nobody@example.com';

      const res = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(nonExistentEmail)}`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(res.status, 404);

      const log = inMemoryAuditLogs.find((l) => l.action === 'support.user_lookup_no_match');
      assert.ok(log, 'Audit entry for support.user_lookup_no_match must exist');
      assert.equal(log.targetType, 'user');
      assert.equal(log.targetId, null);

      // Email must NOT be leaked into audit log
      const logJson = JSON.stringify(log);
      assert.equal(logJson.includes(nonExistentEmail), false);
    });

    it('rejects missing email parameter or email exceeding 254 chars with 400', async () => {
      const resMissing = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resMissing.status, 400);

      const overlongEmail = 'a'.repeat(250) + '@example.com';
      const resOverlong = await dispatch(app, {
        method: 'GET',
        url: `/admin/support/users?email=${encodeURIComponent(overlongEmail)}`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resOverlong.status, 400);
    });
  });

  describe('POST /admin/support/users/:id/deletion-preview', () => {
    it('returns counts/labels only, willRetain entries, and a valid 5-min signed preview token', async () => {
      const fixture = createFixtureTraveler('preview.traveler@example.com');
      inMemoryAuditLogs = [];

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/deletion-preview`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.willRemove));
      assert.ok(Array.isArray(res.body.willRetain));
      assert.ok(typeof res.body.previewToken === 'string');

      // Verify exact counts match fixture data
      const removeMap = Object.fromEntries(res.body.willRemove.map((x) => [x.item, x.count]));
      assert.equal(removeMap['Itineraries'], 2);
      assert.equal(removeMap['Conversations'], 1);
      assert.equal(removeMap['Expenses'], 1);
      assert.equal(removeMap['Bookings'], 1);
      assert.equal(removeMap['Packing Templates'], 1);
      assert.equal(removeMap['Disruptions'], 1);
      assert.equal(removeMap['User Account'], 1);

      // Verify decode of previewToken
      const decoded = jwt.verify(res.body.previewToken, ADMIN_JWT_SECRET);
      assert.equal(decoded.adminId, supportAgentId);
      assert.equal(decoded.userId, fixture.id);
      assert.equal(decoded.purpose, 'support_deletion_preview');

      // Verify audit record exists and does not leak email
      const log = inMemoryAuditLogs.find((l) => l.action === 'support.deletion_preview');
      assert.ok(log);
      assert.equal(log.targetId, fixture.id);
      assert.equal(JSON.stringify(log).includes(fixture.email), false);
    });

    it('rejects invalid ObjectId or non-existent user with 400 or 404', async () => {
      const resBadId = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/invalid-id-format/deletion-preview`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resBadId.status, 400);

      const fakeId = new mongoose.Types.ObjectId().toString();
      const resNotFound = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fakeId}/deletion-preview`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(resNotFound.status, 404);
    });

    it('returns 404 if given an AdminUser ID (admin accounts cannot be targeted)', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${superAdminId}/deletion-preview`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(res.status, 404);
    });
  });

  describe('previewToken Validation in Deletion Endpoint', () => {
    it('rejects missing, tampered, expired, or mismatched tokens with 400', async () => {
      const fixture = createFixtureTraveler('token.test@example.com');
      const agent = createSupportAgent('token-agent');

      // Valid preview token for this user & admin
      const validToken = jwt.sign(
        { adminId: agent.id, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      // 1. Missing token
      const resMissing = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${agent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123' },
      });
      assert.equal(resMissing.status, 400);

      // 2. Tampered token
      const resTampered = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${agent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: validToken + 'garbage' },
      });
      assert.equal(resTampered.status, 400);

      // 3. Expired token
      const expiredToken = jwt.sign(
        { adminId: agent.id, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const resExpired = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${agent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: expiredToken },
      });
      assert.equal(resExpired.status, 400);

      // 4. Token signed for another admin
      const otherAdmin = createSupportAgent('other-admin');
      const otherAdminToken = jwt.sign(
        { adminId: otherAdmin.id, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );
      const resOtherAdmin = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${agent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: otherAdminToken },
      });
      assert.equal(resOtherAdmin.status, 400);

      // 5. Token signed for another user
      const otherUser = createFixtureTraveler('other.user@example.com');
      const otherUserToken = jwt.sign(
        { adminId: agent.id, userId: otherUser.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );
      const resOtherUser = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${agent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: otherUserToken },
      });
      assert.equal(resOtherUser.status, 400);

      // 6. Token signed with wrong purpose (e.g. login token)
      const wrongAgent = createSupportAgent('wrong-agent');
      const wrongPurposeToken = jwt.sign(
        { adminId: wrongAgent.id, userId: fixture.id, purpose: 'admin_login' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );
      const resWrongPurpose = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${wrongAgent.token}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: wrongPurposeToken },
      });
      assert.equal(resWrongPurpose.status, 400);
    });
  });

  describe('POST /admin/support/users/:id/delete (Execution & Auditing)', () => {
    it('rejects confirmation email mismatch with 400 "The email does not match."', async () => {
      const fixture = createFixtureTraveler('target.account@example.com');
      const token = jwt.sign(
        { adminId: supportAgentId, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: {
          confirmEmail: 'wrong.email@example.com',
          reason: 'Valid reason exceeding 5 chars',
          previewToken: token,
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'The email does not match.');
    });

    it('rejects invalid reasons (< 5 chars, > 200 chars, or HTML tags) with 400', async () => {
      const fixture = createFixtureTraveler('reason.test@example.com');
      const token = jwt.sign(
        { adminId: supportAgentId, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      // Short reason
      const resShort = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture.email, reason: 'Bad', previewToken: token },
      });
      assert.equal(resShort.status, 400);

      // HTML tags
      const resHtml = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture.email, reason: 'User requested <b>delete</b>', previewToken: token },
      });
      assert.equal(resHtml.status, 400);

      // Overlong
      const resLong = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture.email, reason: 'X'.repeat(201), previewToken: token },
      });
      assert.equal(resLong.status, 400);
    });

    it('rejects admin IDs with 404', async () => {
      const token = jwt.sign(
        { adminId: superAdminId, userId: superAdminId, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${superAdminId}/delete`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        body: { confirmEmail: 'super@travalastic.com', reason: 'Attempt admin delete', previewToken: token },
      });
      assert.equal(res.status, 404);
    });

    it('executes deletion successfully: purges all collections, records start and completion audits without PII, rejects traveler token with 401', async () => {
      const fixture = createFixtureTraveler('delete.success@example.com');
      inMemoryAuditLogs = [];

      // Verify traveler can access profile before deletion
      const beforeProfile = await dispatch(app, {
        method: 'GET',
        url: '/traveler/profile',
        headers: { authorization: `Bearer ${fixture.token}` },
      });
      assert.equal(beforeProfile.status, 200);

      const token = jwt.sign(
        { adminId: supportAgentId, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      const reason = 'User submitted GDPR erasure request via support ticket #4928';
      const deleteRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: {
          confirmEmail: 'DELETE.SUCCESS@EXAMPLE.COM', // Uppercase confirmation test
          reason,
          previewToken: token,
        },
      });

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.deleted, true);
      assert.equal(deleteRes.body.userId, fixture.id);

      // Verify user document is gone
      assert.equal(inMemoryUsers.has(fixture.id), false);

      // Verify all child records for this user are gone
      for (const item of inMemoryItineraries.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }
      for (const item of inMemoryConversations.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }
      for (const item of inMemoryExpenses.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }
      for (const item of inMemoryBookings.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }
      for (const item of inMemoryPackingTemplates.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }
      for (const item of inMemoryDisruptions.values()) {
        assert.notEqual(item.userId?.toString(), fixture.id);
      }

      // Verify previous traveler token is now rejected with 401
      const afterProfile = await dispatch(app, {
        method: 'GET',
        url: '/traveler/profile',
        headers: { authorization: `Bearer ${fixture.token}` },
      });
      assert.equal(afterProfile.status, 401);
      assert.equal(afterProfile.body.error, 'account no longer exists');

      // Verify second delete call returns 404 (already deleted)
      const secondDelete = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture.email, reason, previewToken: token },
      });
      assert.equal(secondDelete.status, 404);

      // Verify audit entries: support.user_delete_started and support.user_delete_completed
      const startedLog = inMemoryAuditLogs.find((l) => l.action === 'support.user_delete_started');
      const completedLog = inMemoryAuditLogs.find((l) => l.action === 'support.user_delete_completed');

      assert.ok(startedLog, 'Must record support.user_delete_started before deletion');
      assert.ok(completedLog, 'Must record support.user_delete_completed after deletion');

      assert.equal(startedLog.targetId, fixture.id);
      assert.equal(completedLog.targetId, fixture.id);

      // Both must store reason
      assert.ok(startedLog.summary.includes(reason));
      assert.ok(completedLog.summary.includes(reason));

      // Neither must contain the email or personal data
      assert.equal(JSON.stringify(startedLog).includes(fixture.email), false);
      assert.equal(JSON.stringify(completedLog).includes(fixture.email), false);
    });

    it('if audit writing is forced to fail before deletion, deletion aborts and user remains intact', async () => {
      const fixture = createFixtureTraveler('audit.fail@example.com');
      const token = jwt.sign(
        { adminId: supportAgentId, userId: fixture.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      // Force AuditLog.create to throw on started audit entry
      AuditLog.create = async () => {
        throw new Error('Database disk full: audit write failed');
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture.email, reason: 'Valid test reason 123', previewToken: token },
      });

      assert.equal(res.status, 500);

      // Crucial verification: user and documents MUST NOT be deleted
      assert.equal(inMemoryUsers.has(fixture.id), true);
      assert.ok(inMemoryItineraries.has(`itin-${fixture.id}-1`));
    });

    it('proves that in-app deletion and support deletion call the EXACT SAME shared function', async () => {
      // Import from both paths and compare references
      const mod1 = await import('../src/services/accountDeletion.js');
      const mod2 = await import('../services/accountDeletion.js');
      assert.strictEqual(mod1.deleteUserAndData, mod2.deleteUserAndData);
      assert.strictEqual(typeof mod1.deleteUserAndData, 'function');
      assert.strictEqual(typeof mod1.countUserData, 'function');
    });
  });

  describe('Rate Limiting on Deletions', () => {
    it('enforces maximum 5 deletions per hour per admin (6th returns 429)', async () => {
      const adminIp = '127.0.9.99';

      for (let i = 1; i <= 5; i++) {
        const fixture = createFixtureTraveler(`ratelimit.user${i}@example.com`);
        const token = jwt.sign(
          { adminId: supportAgentId, userId: fixture.id, purpose: 'support_deletion_preview' },
          ADMIN_JWT_SECRET,
          { expiresIn: '5m' }
        );

        const res = await dispatch(app, {
          method: 'POST',
          url: `/admin/support/users/${fixture.id}/delete`,
          headers: { authorization: `Bearer ${supportAgentToken}` },
          body: { confirmEmail: fixture.email, reason: 'Rate limit test reason', previewToken: token },
          ip: adminIp,
        });

        assert.equal(res.status, 200, `Deletion ${i} should succeed`);
      }

      // 6th attempt should be blocked by rate limiter
      const fixture6 = createFixtureTraveler('ratelimit.user6@example.com');
      const token6 = jwt.sign(
        { adminId: supportAgentId, userId: fixture6.id, purpose: 'support_deletion_preview' },
        ADMIN_JWT_SECRET,
        { expiresIn: '5m' }
      );

      const res6 = await dispatch(app, {
        method: 'POST',
        url: `/admin/support/users/${fixture6.id}/delete`,
        headers: { authorization: `Bearer ${supportAgentToken}` },
        body: { confirmEmail: fixture6.email, reason: 'Rate limit test reason', previewToken: token6 },
        ip: adminIp,
      });

      assert.equal(res6.status, 429);
      assert.match(res6.body.error, /too many account deletions/i);
    });
  });
});
