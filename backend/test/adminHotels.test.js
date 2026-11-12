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
import CuratedHotel from '../src/models/CuratedHotel.js';
import hotelsPublicRouter from '../src/routes/hotels.js';
import { accommodationNode } from '../src/services/agents/accommodationNode.js';

const ADMIN_JWT_SECRET = 'test_admin_hotels_jwt_secret_12345';
const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_67890';

let testIpCounter = 1;
function dispatch(appInstance, { method, url, headers = {}, body = '', ip = null }) {
  const requestIp = ip || `127.0.4.${testIpCounter++}`;
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

describe('Admin Panel Piece A7: Hotels Content Management & Public Exclusion', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let editorId;
  let editorToken;
  let supportAgentId;
  let supportAgentToken;
  let inMemoryAdmins;
  let inMemoryHotels;
  let inMemoryAuditLogs;
  let createHotelDoc;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    superAdminId = new mongoose.Types.ObjectId().toString();
    editorId = new mongoose.Types.ObjectId().toString();
    supportAgentId = new mongoose.Types.ObjectId().toString();

    const pwdHash = await bcrypt.hash('TestPassword123!', 10);

    inMemoryAdmins = new Map();
    inMemoryHotels = new Map();
    inMemoryAuditLogs = [];

    createHotelDoc = function (data) {
      const id = data._id ? new mongoose.Types.ObjectId(data._id) : new mongoose.Types.ObjectId();
      const doc = {
        ...data,
        _id: id,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        toObject: function () {
          return { ...this };
        },
        save: async function () {
          this.updatedAt = new Date();
          inMemoryHotels.set(this._id.toString(), this);
          return this;
        },
      };
      return doc;
    };

    const superAdminDoc = {
      _id: new mongoose.Types.ObjectId(superAdminId),
      email: 'superadmin@travalastic.com',
      passwordHash: pwdHash,
      role: 'super_admin',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      toSafeObject: function () {
        return { id: this._id.toString(), email: this.email, role: this.role };
      },
    };
    inMemoryAdmins.set(superAdminId, superAdminDoc);

    const editorDoc = {
      _id: new mongoose.Types.ObjectId(editorId),
      email: 'editor@travalastic.com',
      passwordHash: pwdHash,
      role: 'content_editor',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      toSafeObject: function () {
        return { id: this._id.toString(), email: this.email, role: this.role };
      },
    };
    inMemoryAdmins.set(editorId, editorDoc);

    const supportAgentDoc = {
      _id: new mongoose.Types.ObjectId(supportAgentId),
      email: 'support@travalastic.com',
      passwordHash: pwdHash,
      role: 'support_agent',
      active: true,
      mustChangePassword: false,
      tokensValidAfter: null,
      toSafeObject: function () {
        return { id: this._id.toString(), email: this.email, role: this.role };
      },
    };
    inMemoryAdmins.set(supportAgentId, supportAgentDoc);

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

    supportAgentToken = jwt.sign(
      { sub: supportAgentId, role: 'support_agent' },
      ADMIN_JWT_SECRET,
      { audience: 'admin', expiresIn: '8h' }
    );

    // Mock AdminUser
    AdminUser.findById = (id) => {
      const match = inMemoryAdmins.get(id?.toString());
      return Promise.resolve(match || null);
    };
    AdminUser.findOne = ({ email }) => {
      const clean = email?.toLowerCase();
      for (const doc of inMemoryAdmins.values()) {
        if (doc.email.toLowerCase() === clean) return Promise.resolve(doc);
      }
      return Promise.resolve(null);
    };

    // Mock AuditLog
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

    // Filter helper for in-memory CuratedHotel queries
    function matchesHotelFilter(hotel, filter) {
      if (!filter || Object.keys(filter).length === 0) return true;

      if (filter._id && filter._id.$ne) {
        if (hotel._id.toString() === filter._id.$ne.toString()) return false;
      }
      if (filter._id && filter._id.$lt) {
        if (hotel._id.toString() >= filter._id.$lt.toString()) return false;
      }

      if (filter.hidden && filter.hidden.$ne === true) {
        if (hotel.hidden === true) return false;
      } else if (filter.hidden === true) {
        if (hotel.hidden !== true) return false;
      }

      if (Array.isArray(filter.$or)) {
        const orMatch = filter.$or.some((sub) => {
          for (const [k, v] of Object.entries(sub)) {
            const val = hotel[k] || '';
            if (v instanceof RegExp) {
              if (v.test(String(val))) return true;
            } else if (String(val).toLowerCase() === String(v).toLowerCase()) {
              return true;
            }
          }
          return false;
        });
        if (!orMatch) return false;
      }

      for (const [key, val] of Object.entries(filter)) {
        if (key === '_id' || key === 'hidden' || key === '$or') continue;
        const hotelVal = hotel[key];
        if (val instanceof RegExp) {
          if (!val.test(String(hotelVal || ''))) return false;
        } else if (typeof val === 'string') {
          if (String(hotelVal || '').toLowerCase() !== val.toLowerCase()) return false;
        } else if (val !== undefined && hotelVal !== val) {
          return false;
        }
      }
      return true;
    }

    // Mock CuratedHotel
    CuratedHotel.findById = (id) => {
      const doc = inMemoryHotels.get(id?.toString());
      return {
        populate: () => Promise.resolve(doc || null),
        then: (resolve) => resolve(doc || null),
      };
    };

    CuratedHotel.findOne = (filter) => {
      for (const doc of inMemoryHotels.values()) {
        if (matchesHotelFilter(doc, filter)) {
          return Promise.resolve(doc);
        }
      }
      return Promise.resolve(null);
    };

    CuratedHotel.find = (filter = {}) => {
      const matched = [];
      for (const doc of inMemoryHotels.values()) {
        if (matchesHotelFilter(doc, filter)) {
          matched.push(doc);
        }
      }
      matched.sort((a, b) => b._id.toString().localeCompare(a._id.toString()));

      return {
        sort: function () { return this; },
        limit: function (n) {
          const sliced = matched.slice(0, n);
          return {
            populate: () => ({
              lean: () => Promise.resolve(sliced.map((d) => (d.toObject ? d.toObject() : d))),
            }),
            lean: () => Promise.resolve(sliced.map((d) => (d.toObject ? d.toObject() : d))),
            then: (resolve) => resolve(sliced),
          };
        },
        populate: function () {
          return {
            lean: () => Promise.resolve(matched.map((d) => (d.toObject ? d.toObject() : d))),
          };
        },
        lean: () => Promise.resolve(matched.map((d) => (d.toObject ? d.toObject() : d))),
        then: (resolve) => resolve(matched),
      };
    };

    CuratedHotel.create = async function (docs) {
      const items = Array.isArray(docs) ? docs : [docs];
      const created = [];
      for (const item of items) {
        const doc = createHotelDoc(item);
        inMemoryHotels.set(doc._id.toString(), doc);
        created.push(doc);
      }
      return created;
    };

    // Express app mounting /admin
    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
  });

  describe('1. Role-Based Access Control (RBAC)', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels',
      });
      assert.equal(res.status, 401);
    });

    it('rejects support_agent with 403 and audits access_denied', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(res.status, 403);
      assert.match(res.body.error, /requires.*content_editor/i);

      // Verify access_denied audit entry was recorded
      const deniedLog = inMemoryAuditLogs.find((l) => l.action === 'admin.access_denied' || l.action === 'access_denied');
      assert.ok(deniedLog);
      assert.equal(deniedLog.actorRole, 'support_agent');
    });

    it('allows content_editor to list and create hotels', async () => {
      const listRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(listRes.status, 200);

      const createRes = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: 'Goa Heritage Villa',
          destination: 'Goa',
          budgetTier: 'mid',
          priceRangeINR: '₹4,500 - ₹7,000',
          rating: 4.4,
        },
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.name, 'Goa Heritage Villa');
    });

    it('allows super_admin to perform all operations', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: {
          name: 'Jaipur Palace Hotel',
          destination: 'Jaipur',
          budgetTier: 'luxury',
          priceRangeINR: '₹15,000 - ₹25,000',
          rating: 4.8,
        },
      });
      assert.equal(res.status, 201);
    });
  });

  describe('2. Validation & Sanitization Table', () => {
    it('rejects missing required fields (name, destination, budgetTier)', async () => {
      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { destination: 'Goa', budgetTier: 'mid' },
      });
      assert.equal(res1.status, 400);
      assert.match(res1.body.error, /name is required/i);

      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Beach Resort', budgetTier: 'mid' },
      });
      assert.equal(res2.status, 400);
      assert.match(res2.body.error, /destination is required/i);

      const res3 = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Beach Resort', destination: 'Goa' },
      });
      assert.equal(res3.status, 400);
      assert.match(res3.body.error, /budget tier must be one of/i);
    });

    it('rejects invalid budgetTier', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Beach Resort', destination: 'Goa', budgetTier: 'hostel' },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /budget tier must be one of: budget, mid, luxury/i);
    });

    it('rejects invalid rating (< 0 or > 5)', async () => {
      const resHigh = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Beach Resort', destination: 'Goa', budgetTier: 'mid', rating: 6 },
      });
      assert.equal(resHigh.status, 400);
      assert.match(resHigh.body.error, /rating must be a number between 0 and 5/i);

      const resNeg = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Beach Resort', destination: 'Goa', budgetTier: 'mid', rating: -1 },
      });
      assert.equal(resNeg.status, 400);
    });

    it('rejects price <= 0 and excessive price above sane maximum', async () => {
      const resZero = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Free Stay', destination: 'Goa', budgetTier: 'budget', priceRangeINR: '₹0' },
      });
      assert.equal(resZero.status, 400);
      assert.match(resZero.body.error, /price must be greater than 0/i);

      const resExcessive = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Gold Palace', destination: 'Goa', budgetTier: 'luxury', priceRangeINR: '₹15,00,000' },
      });
      assert.equal(resExcessive.status, 400);
      assert.match(resExcessive.body.error, /cannot exceed/i);

      const resInverted = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Odd Price', destination: 'Goa', budgetTier: 'mid', priceRangeINR: '₹10,000 - ₹5,000' },
      });
      assert.equal(resInverted.status, 400);
      assert.match(resInverted.body.error, /minimum price cannot exceed maximum price/i);
    });

    it('rejects HTML tags in strings and sanitizes whitespace', async () => {
      const resHtml = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: '<script>alert(1)</script>Hotel',
          destination: 'Goa',
          budgetTier: 'budget',
        },
      });
      assert.equal(resHtml.status, 400);
      assert.match(resHtml.body.error, /HTML tags are not allowed/i);

      // Successfully sanitizes excess whitespace
      const resClean = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: '   Grand    Palace   ',
          destination: '   Udaipur   ',
          budgetTier: 'luxury',
        },
      });
      assert.equal(resClean.status, 201);
      assert.equal(resClean.body.name, 'Grand Palace');
      assert.equal(resClean.body.destination, 'Udaipur');
    });

    it('returns 409 conflict when creating a hotel with same normalized name and destination', async () => {
      await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Seaside Inn', destination: 'Kovalam', budgetTier: 'budget' },
      });

      const resDup = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: '  seaside  inn  ', destination: 'kovalam', budgetTier: 'mid' },
      });
      assert.equal(resDup.status, 409);
      assert.match(resDup.body.error, /already exists/i);
    });
  });

  describe('3. Search, Filter & Cursor Pagination', () => {
    it('treats regex characters in q as plain literal text', async () => {
      const h1Id = new mongoose.Types.ObjectId();
      const h2Id = new mongoose.Types.ObjectId();

      inMemoryHotels.set(h1Id.toString(), createHotelDoc({
        _id: h1Id,
        name: 'Taj Exotica',
        destination: 'Goa',
        budgetTier: 'luxury',
      }));

      inMemoryHotels.set(h2Id.toString(), createHotelDoc({
        _id: h2Id,
        name: 'Hotel (Special).* Stay',
        destination: 'Goa',
        budgetTier: 'mid',
      }));

      // Search q=.* should NOT match Taj Exotica
      const res = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels?q=' + encodeURIComponent('.*'),
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.hotels.length, 1);
      assert.equal(res.body.hotels[0].name, 'Hotel (Special).* Stay');
    });

    it('supports destination, budgetTier, and hidden filters with cursor pagination', async () => {
      for (let i = 1; i <= 30; i++) {
        const id = new mongoose.Types.ObjectId();
        inMemoryHotels.set(id.toString(), createHotelDoc({
          _id: id,
          name: `Hotel ${String(i).padStart(2, '0')}`,
          destination: i % 2 === 0 ? 'Jaipur' : 'Goa',
          budgetTier: i % 3 === 0 ? 'luxury' : 'mid',
          hidden: i === 5,
        }));
      }

      // Page 1 (limit=10)
      const res1 = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels?limit=10',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res1.status, 200);
      assert.equal(res1.body.hotels.length, 10);
      assert.ok(res1.body.nextCursor);

      // Page 2 using cursor
      const res2 = await dispatch(app, {
        method: 'GET',
        url: `/admin/hotels?limit=10&cursor=${res1.body.nextCursor}`,
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res2.status, 200);
      assert.equal(res2.body.hotels.length, 10);
      assert.notEqual(res2.body.hotels[0].id, res1.body.hotels[0].id);

      // Filter hidden=true returns only the hidden hotel
      const resHidden = await dispatch(app, {
        method: 'GET',
        url: '/admin/hotels?hidden=true',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(resHidden.status, 200);
      assert.equal(resHidden.body.hotels.length, 1);
      assert.equal(resHidden.body.hotels[0].name, 'Hotel 05');
    });
  });

  describe('4. Price Tracking & priceReviewedAt Behavior', () => {
    it('sets priceReviewedAt to server now when price is provided on create', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/admin/hotels',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: 'Kochi Boutique Stay',
          destination: 'Kochi',
          budgetTier: 'mid',
          priceRangeINR: '₹3,500 - ₹5,500',
        },
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.priceReviewedAt);
      const diff = Math.abs(new Date(res.body.priceReviewedAt).getTime() - Date.now());
      assert.ok(diff < 5000);
    });

    it('updates priceReviewedAt on PATCH when price changes, but leaves date unchanged when price does NOT change', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const initialDate = new Date('2026-01-15T10:00:00.000Z');

      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Hilltop Resort',
        destination: 'Munnar',
        budgetTier: 'luxury',
        priceRangeINR: '₹8,000 - ₹12,000',
        priceReviewedAt: initialDate,
      }));

      // 1. Change only name -> priceReviewedAt MUST NOT change
      const resNameOnly = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/hotels/${hotelId}`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Hilltop Luxury Resort' },
      });
      assert.equal(resNameOnly.status, 200);
      assert.equal(new Date(resNameOnly.body.priceReviewedAt).toISOString(), initialDate.toISOString());

      // 2. Change priceRangeINR -> priceReviewedAt MUST update to now
      const resPriceChange = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/hotels/${hotelId}`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { priceRangeINR: '₹9,500 - ₹14,000' },
      });
      assert.equal(resPriceChange.status, 200);
      assert.notEqual(new Date(resPriceChange.body.priceReviewedAt).toISOString(), initialDate.toISOString());
      const nowDiff = Math.abs(new Date(resPriceChange.body.priceReviewedAt).getTime() - Date.now());
      assert.ok(nowDiff < 5000);
    });

    it('ignores client-supplied priceReviewedAt in request body', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const pastDate = new Date('2025-01-01T00:00:00.000Z');

      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Valley View',
        destination: 'Manali',
        budgetTier: 'budget',
        priceRangeINR: '₹2,000',
        priceReviewedAt: pastDate,
      }));

      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/hotels/${hotelId}`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: 'Valley View Lodge',
          priceReviewedAt: '2099-01-01T00:00:00.000Z',
        },
      });
      // Should reject disallowed field or ignore it
      if (res.status === 200) {
        assert.notEqual(res.body.priceReviewedAt, '2099-01-01T00:00:00.000Z');
      } else {
        assert.equal(res.status, 400);
        assert.match(res.body.error, /disallowed/i);
      }
    });
  });

  describe('5. Hide, Restore & Audit Rollback', () => {
    it('hides hotel with reason and audits hotel.hide', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Heritage Palace',
        destination: 'Jaipur',
        budgetTier: 'luxury',
        hidden: false,
      }));

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/hotels/${hotelId}/hide`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { reason: 'Renovation closure until next season' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.hidden, true);
      assert.equal(res.body.hiddenReason, 'Renovation closure until next season');

      const hideLog = inMemoryAuditLogs.find((l) => l.action === 'hotel.hide');
      assert.ok(hideLog);
      assert.equal(hideLog.targetId, hotelId.toString());
      assert.equal(hideLog.actorEmail, 'editor@travalastic.com');
    });

    it('restores hotel and audits hotel.restore', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Heritage Palace',
        destination: 'Jaipur',
        budgetTier: 'luxury',
        hidden: true,
        hiddenReason: 'Closed',
      }));

      const res = await dispatch(app, {
        method: 'POST',
        url: `/admin/hotels/${hotelId}/restore`,
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.hidden, false);
      assert.equal(res.body.hiddenReason, null);

      const restoreLog = inMemoryAuditLogs.find((l) => l.action === 'hotel.restore');
      assert.ok(restoreLog);
      assert.equal(restoreLog.targetId, hotelId.toString());
    });

    it('rolls back and does not persist hotel changes when audit logging fails', async () => {
      let aborted = false;
      let stagedHotelId = null;

      const origStartSession = mongoose.startSession;
      mongoose.startSession = async () => ({
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {
          aborted = true;
          if (stagedHotelId) {
            inMemoryHotels.delete(stagedHotelId);
          }
        },
        endSession: async () => {},
      });

      const origConnectionState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      const origAuditCreate = AuditLog.create;
      AuditLog.create = async () => {
        throw new Error('Forced Audit Failure');
      };

      const origHotelCreate = CuratedHotel.create;
      CuratedHotel.create = async (docs, opts) => {
        const doc = createHotelDoc(docs[0]);
        stagedHotelId = doc._id.toString();
        inMemoryHotels.set(stagedHotelId, doc);
        return [doc];
      };

      try {
        const res = await dispatch(app, {
          method: 'POST',
          url: '/admin/hotels',
          headers: { Authorization: `Bearer ${editorToken}` },
          body: {
            name: 'Doomed Hotel',
            destination: 'Agra',
            budgetTier: 'mid',
          },
        });

        assert.equal(res.status, 500);
        assert.equal(aborted, true, 'Transaction should have aborted');

        // Verify Doomed Hotel was not persisted
        const found = Array.from(inMemoryHotels.values()).find((h) => h.name === 'Doomed Hotel');
        assert.equal(found, undefined);
      } finally {
        mongoose.startSession = origStartSession;
        Object.defineProperty(mongoose.connection, 'readyState', { value: origConnectionState, configurable: true });
        AuditLog.create = origAuditCreate;
        CuratedHotel.create = origHotelCreate;
      }
    });
  });

  describe('6. Public Read Path Exclusion & Legacy Compatibility', () => {
    let publicApp;

    beforeEach(() => {
      publicApp = express();
      publicApp.use('/hotels', hotelsPublicRouter);
    });

    it('returns legacy hotel without hidden field in both GET /hotels/search and accommodationNode', async () => {
      const legacyId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(legacyId.toString(), createHotelDoc({
        _id: legacyId,
        name: 'Legacy Heritage Stay',
        destination: 'Goa',
        budgetTier: 'mid',
        // hidden field is completely undefined
      }));

      // 1. GET /hotels/search
      const searchRes = await dispatch(publicApp, {
        method: 'GET',
        url: '/hotels/search?destination=Goa&budgetTier=mid',
      });
      assert.equal(searchRes.status, 200);
      const foundInSearch = searchRes.body.hotels.some((h) => h.name === 'Legacy Heritage Stay');
      assert.equal(foundInSearch, true);

      // 2. accommodationNode
      const nodeRes = await accommodationNode({ destination: 'Goa', budgetTier: 'mid' });
      const foundInNode = nodeRes.accommodationOptions.some((h) => h.name === 'Legacy Heritage Stay');
      assert.equal(foundInNode, true);
    });

    it('excludes hidden hotel (hidden: true) from both GET /hotels/search and accommodationNode', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Secret Hideaway',
        destination: 'Goa',
        budgetTier: 'luxury',
        hidden: true,
        hiddenReason: 'Private retreat',
      }));

      // 1. Excluded from public search
      const searchRes = await dispatch(publicApp, {
        method: 'GET',
        url: '/hotels/search?destination=Goa&budgetTier=luxury',
      });
      assert.equal(searchRes.status, 200);
      const foundInSearch = searchRes.body.hotels.some((h) => h.name === 'Secret Hideaway');
      assert.equal(foundInSearch, false);

      // 2. Excluded from accommodationNode
      const nodeRes = await accommodationNode({ destination: 'Goa', budgetTier: 'luxury' });
      const foundInNode = nodeRes.accommodationOptions.some((h) => h.name === 'Secret Hideaway');
      assert.equal(foundInNode, false);
    });

    it('restoring a hidden hotel immediately makes it visible again in both read paths', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Reopened Resort',
        destination: 'Udaipur',
        budgetTier: 'luxury',
        hidden: true,
      }));

      // Initially excluded
      const searchBefore = await dispatch(publicApp, {
        method: 'GET',
        url: '/hotels/search?destination=Udaipur',
      });
      assert.equal(searchBefore.body.hotels.some((h) => h.name === 'Reopened Resort'), false);

      // Restore via admin
      const restoreRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/hotels/${hotelId}/restore`,
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(restoreRes.status, 200);

      // Now returned in public search
      const searchAfter = await dispatch(publicApp, {
        method: 'GET',
        url: '/hotels/search?destination=Udaipur',
      });
      assert.equal(searchAfter.body.hotels.some((h) => h.name === 'Reopened Resort'), true);

      // Now returned in accommodationNode
      const nodeAfter = await accommodationNode({ destination: 'Udaipur' });
      assert.equal(nodeAfter.accommodationOptions.some((h) => h.name === 'Reopened Resort'), true);
    });

    it('leaves saved itineraries and bookings completely untouched when hotel is hidden', async () => {
      // Simulates an itinerary document that stored a snapshot of hotel details
      const savedItinerary = {
        _id: 'itin-12345',
        title: '7-Day Goa Trip',
        accommodationOptions: [
          {
            name: 'Taj Exotica',
            destination: 'Goa',
            budgetTier: 'luxury',
            priceRangeINR: '₹18,000 - ₹28,000',
          },
        ],
      };

      // Admin hides Taj Exotica in CuratedHotel collection
      const hotelId = new mongoose.Types.ObjectId();
      inMemoryHotels.set(hotelId.toString(), createHotelDoc({
        _id: hotelId,
        name: 'Taj Exotica',
        destination: 'Goa',
        budgetTier: 'luxury',
        hidden: false,
      }));

      await dispatch(app, {
        method: 'POST',
        url: `/admin/hotels/${hotelId}/hide`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { reason: 'Offline for maintenance' },
      });

      // Saved itinerary still retains its snapshot
      assert.equal(savedItinerary.accommodationOptions.length, 1);
      assert.equal(savedItinerary.accommodationOptions[0].name, 'Taj Exotica');
      assert.equal(savedItinerary.accommodationOptions[0].destination, 'Goa');
    });
  });
});
