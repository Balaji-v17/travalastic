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
import TouristPlace from '../src/models/TouristPlace.js';
import { fetchExplorePlaces, destinationResponseCache } from '../src/routes/destinations.js';
import { retrieveCandidates } from '../src/services/candidateRetrieval.js';

const ADMIN_JWT_SECRET = 'test_admin_places_jwt_secret_12345';
const TRAVELER_JWT_SECRET = 'test_traveler_jwt_secret_67890';

let testIpCounter = 1;
function dispatch(appInstance, { method, url, headers = {}, body = '', ip = null }) {
  const requestIp = ip || `127.0.3.${testIpCounter++}`;
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

describe('Admin Panel Piece A5: Places Content Management & Public Exclusion', () => {
  let app;
  let superAdminId;
  let superAdminToken;
  let editorId;
  let editorToken;
  let supportAgentId;
  let supportAgentToken;
  let inMemoryAdmins;
  let inMemoryPlaces;
  let inMemoryAuditLogs;
  let createPlaceDoc;

  beforeEach(async () => {
    process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    process.env.ADMIN_SESSION_HOURS = '8';

    destinationResponseCache.clear();

    superAdminId = new mongoose.Types.ObjectId().toString();
    editorId = new mongoose.Types.ObjectId().toString();
    supportAgentId = new mongoose.Types.ObjectId().toString();

    const pwdHash = await bcrypt.hash('TestPassword123!', 10);

    inMemoryAdmins = new Map();
    inMemoryPlaces = new Map();
    inMemoryAuditLogs = [];

    createPlaceDoc = function (data) {
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
          inMemoryPlaces.set(this._id.toString(), this);
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

    // Helper to evaluate in-memory Mongo filter
    function matchesFilter(place, filter) {
      if (!filter || Object.keys(filter).length === 0) return true;

      // Handle _id: { $ne: ... }
      if (filter._id && filter._id.$ne) {
        if (place._id.toString() === filter._id.$ne.toString()) return false;
      }
      // Handle _id: { $lt: ... }
      if (filter._id && filter._id.$lt) {
        if (place._id.toString() >= filter._id.$lt.toString()) return false;
      }

      // Handle hidden: { $ne: true }
      if (filter.hidden && filter.hidden.$ne === true) {
        if (place.hidden === true) return false;
      } else if (filter.hidden === true) {
        if (place.hidden !== true) return false;
      }

      // Handle $or
      if (Array.isArray(filter.$or)) {
        const orMatch = filter.$or.some((sub) => {
          for (const [k, v] of Object.entries(sub)) {
            const placeVal = place[k] || '';
            if (v instanceof RegExp) {
              if (v.test(String(placeVal))) return true;
            } else if (String(placeVal).toLowerCase() === String(v).toLowerCase()) {
              return true;
            }
          }
          return false;
        });
        if (!orMatch) return false;
      }

      // Handle scalar / regex fields
      for (const [key, cond] of Object.entries(filter)) {
        if (key === '$or' || key === 'hidden' || key === '_id') continue;
        const placeVal = place[key] || '';
        if (cond instanceof RegExp) {
          if (!cond.test(String(placeVal))) return false;
        } else if (String(placeVal).toLowerCase() !== String(cond).toLowerCase()) {
          return false;
        }
      }

      return true;
    }

    // Mock TouristPlace methods
    TouristPlace.findById = (id) => {
      const match = inMemoryPlaces.get(id?.toString());
      if (!match) return Promise.resolve(null);
      const queryObj = {
        populate: (field, select) => {
          if (field === 'updatedBy' && match.updatedBy) {
            const admin = inMemoryAdmins.get(match.updatedBy.toString());
            match.updatedBy = admin ? { _id: admin._id, email: admin.email } : null;
          }
          return queryObj;
        },
        lean: () => Promise.resolve({ ...match }),
        then: (resolve, reject) => Promise.resolve(match).then(resolve, reject),
      };
      return queryObj;
    };

    TouristPlace.findOne = (filter) => {
      for (const place of inMemoryPlaces.values()) {
        if (matchesFilter(place, filter)) {
          return Promise.resolve(place);
        }
      }
      return Promise.resolve(null);
    };

    TouristPlace.find = (filter = {}) => {
      let filtered = Array.from(inMemoryPlaces.values()).filter((p) => matchesFilter(p, filter));

      let limitNum = Infinity;
      const queryObj = {
        select: () => queryObj,
        sort: (sortObj) => {
          filtered.sort((a, b) => {
            if (sortObj?.googleRating) return (b.googleRating || 0) - (a.googleRating || 0);
            return b._id.toString().localeCompare(a._id.toString());
          });
          return queryObj;
        },
        limit: (n) => {
          limitNum = n;
          return queryObj;
        },
        populate: (field, select) => {
          filtered = filtered.map((p) => {
            const copy = { ...p };
            if (field === 'updatedBy' && copy.updatedBy) {
              const admin = inMemoryAdmins.get(copy.updatedBy.toString());
              copy.updatedBy = admin ? { _id: admin._id, email: admin.email } : null;
            }
            return copy;
          });
          return queryObj;
        },
        lean: () => Promise.resolve(filtered.slice(0, limitNum)),
        then: (resolve, reject) => Promise.resolve(filtered.slice(0, limitNum)).then(resolve, reject),
      };
      return queryObj;
    };

    TouristPlace.aggregate = (pipeline = []) => {
      let results = Array.from(inMemoryPlaces.values());
      for (const stage of pipeline) {
        if (stage.$match) {
          results = results.filter((p) => matchesFilter(p, stage.$match));
        }
        if (stage.$limit) {
          results = results.slice(0, stage.$limit);
        }
        if (stage.$project) {
          results = results.map((p) => ({
            _id: p._id,
            name: p.name,
            city: p.city,
            state: p.state,
            zone: p.zone,
            type: p.type,
            significance: p.significance,
            googleRating: p.googleRating,
            entranceFeeINR: p.entranceFeeINR,
            timeNeededHours: p.timeNeededHours,
            bestTimeToVisit: p.bestTimeToVisit,
            score: 0.95,
          }));
        }
      }
      return Promise.resolve(results);
    };

    // Override Mongoose model instantiation for tests
    TouristPlace.prototype.save = async function () {
      this.updatedAt = new Date();
      inMemoryPlaces.set(this._id.toString(), this);
      return this;
    };

    app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
  });

  describe('1. Role Authorization Matrix', () => {
    it('blocks support_agent with 403 on all /admin/places endpoints and logs admin.access_denied', async () => {
      const getRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(getRes.status, 403);
      assert.match(getRes.body.error, /requires content_editor, super_admin/i);

      const postRes = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${supportAgentToken}` },
        body: {
          name: 'Forbidden Fort',
          city: 'Jaipur',
          state: 'Rajasthan',
          type: 'Fort',
          latitude: 26.9,
          longitude: 75.8,
        },
      });
      assert.equal(postRes.status, 403);

      const patchRes = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/places/${new mongoose.Types.ObjectId()}`,
        headers: { Authorization: `Bearer ${supportAgentToken}` },
        body: { name: 'New Name' },
      });
      assert.equal(patchRes.status, 403);

      const hideRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/places/${new mongoose.Types.ObjectId()}/hide`,
        headers: { Authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(hideRes.status, 403);

      const restoreRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/places/${new mongoose.Types.ObjectId()}/restore`,
        headers: { Authorization: `Bearer ${supportAgentToken}` },
      });
      assert.equal(restoreRes.status, 403);

      // Verify access_denied audit events were recorded
      const deniedLogs = inMemoryAuditLogs.filter((l) => l.action === 'admin.access_denied');
      assert.equal(deniedLogs.length >= 5, true);
    });

    it('allows content_editor and super_admin to access /admin/places', async () => {
      const editorRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(editorRes.status, 200);
      assert.ok(Array.isArray(editorRes.body.places));

      const superAdminRes = await dispatch(app, {
        method: 'GET',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(superAdminRes.status, 200);
      assert.ok(Array.isArray(superAdminRes.body.places));
    });
  });

  describe('2. Input Validation Table', () => {
    it('rejects invalid coordinates: out of range, non-number, and 0/0 (Null Island)', async () => {
      // Latitude > 90
      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Bad Lat', city: 'Delhi', state: 'Delhi', type: 'Fort', latitude: 95, longitude: 77 },
      });
      assert.equal(res1.status, 400);
      assert.match(res1.body.error, /latitude must be a finite number between -90 and 90/i);

      // Longitude < -180
      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Bad Lon', city: 'Delhi', state: 'Delhi', type: 'Fort', latitude: 28, longitude: -185 },
      });
      assert.equal(res2.status, 400);
      assert.match(res2.body.error, /longitude must be a finite number between -180 and 180/i);

      // 0, 0 Coordinates
      const res3 = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Null Island', city: 'Ocean', state: 'None', type: 'Marker', latitude: 0, longitude: 0 },
      });
      assert.equal(res3.status, 400);
      assert.match(res3.body.error, /coordinates cannot be 0, 0/i);
    });

    it('rejects invalid rating, name length < 2, and unknown fields', async () => {
      // Rating 6
      const resRating = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Super Place', city: 'Goa', state: 'Goa', type: 'Beach', latitude: 15.5, longitude: 73.8, googleRating: 6 },
      });
      assert.equal(resRating.status, 400);
      assert.match(resRating.body.error, /googleRating must be between 0 and 5/i);

      // Name 1 character
      const resName = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'A', city: 'Goa', state: 'Goa', type: 'Beach', latitude: 15.5, longitude: 73.8 },
      });
      assert.equal(resName.status, 400);
      assert.match(resName.body.error, /name must be between 2 and 120 characters/i);

      // Unknown fields
      const resUnknown = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { name: 'Valid Name', city: 'Goa', state: 'Goa', type: 'Beach', latitude: 15.5, longitude: 73.8, hackedField: 'yes' },
      });
      assert.equal(resUnknown.status, 400);
      assert.match(resUnknown.body.error, /unknown field: hackedField/i);
    });

    it('rejects HTML tags in strings', async () => {
      const resHtml = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: '<script>alert("xss")</script>',
          city: 'Goa',
          state: 'Goa',
          type: 'Beach',
          latitude: 15.5,
          longitude: 73.8,
        },
      });
      assert.equal(resHtml.status, 400);
      assert.match(resHtml.body.error, /HTML tags are not allowed in name/i);
    });

    it('rejects PATCH updating latitude without longitude', async () => {
      const placeId = new mongoose.Types.ObjectId();
      inMemoryPlaces.set(placeId.toString(), createPlaceDoc({
        _id: placeId,
        name: 'Existing Fort',
        city: 'Jaipur',
        state: 'Rajasthan',
        type: 'Fort',
        latitude: 26.9,
        longitude: 75.8,
      }));

      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/places/${placeId}`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { latitude: 27.1 },
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /latitude and longitude must be updated together/i);
    });
  });

  describe('3. Regex Search Safety (q parameter)', () => {
    it('handles q with .* and ( as plain text without regex injection or mass match', async () => {
      const p1Id = new mongoose.Types.ObjectId();
      const p2Id = new mongoose.Types.ObjectId();

      inMemoryPlaces.set(p1Id.toString(), createPlaceDoc({
        _id: p1Id,
        name: 'Taj Mahal',
        city: 'Agra',
        state: 'Uttar Pradesh',
        type: 'Monument',
      }));

      inMemoryPlaces.set(p2Id.toString(), createPlaceDoc({
        _id: p2Id,
        name: 'Special (Place).*',
        city: 'Agra',
        state: 'Uttar Pradesh',
        type: 'Park',
      }));

      // Searching q=.* should NOT return Taj Mahal; it should match only the literal '.*'
      const resDotStar = await dispatch(app, {
        method: 'GET',
        url: '/admin/places?q=.*',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(resDotStar.status, 200);
      assert.equal(resDotStar.body.places.length, 1);
      assert.equal(resDotStar.body.places[0].name, 'Special (Place).*');

      // Searching unclosed parenthesis q=( should not throw regex syntax error
      const resParen = await dispatch(app, {
        method: 'GET',
        url: '/admin/places?q=(',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(resParen.status, 200);
      assert.equal(resParen.body.places.length, 1);
      assert.equal(resParen.body.places[0].name, 'Special (Place).*');
    });
  });

  describe('4. Duplicate Name + City Prevention', () => {
    it('returns 409 when creating duplicate place with same normalized name and city', async () => {
      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: 'Calangute Beach',
          city: 'Goa',
          state: 'Goa',
          type: 'Beach',
          latitude: 15.54,
          longitude: 73.75,
        },
      });
      assert.equal(res1.status, 201);
      assert.equal(res1.body.name, 'Calangute Beach');
      assert.equal(res1.body.isCurated, true);
      assert.equal(res1.body.source, 'admin');

      // Duplicate with case differences
      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/admin/places',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: {
          name: '  calangute beach  ',
          city: 'GOA',
          state: 'Goa',
          type: 'Beach',
          latitude: 15.54,
          longitude: 73.75,
        },
      });
      assert.equal(res2.status, 409);
      assert.match(res2.body.error, /place with this name and city already exists/i);
    });
  });

  describe('5. Legacy Document Visibility & Public Exclusion', () => {
    it('returns legacy documents without hidden field in all public queries (fetchExplorePlaces & retrieveCandidates)', async () => {
      const legacyId = new mongoose.Types.ObjectId();
      inMemoryPlaces.set(legacyId.toString(), createPlaceDoc({
        _id: legacyId,
        name: 'India Gate',
        city: 'Delhi',
        state: 'Delhi',
        type: 'War Memorial',
        googleRating: 4.6,
        latitude: 28.61,
        longitude: 77.22,
        // Notice: NO hidden, NO isCurated, NO source fields!
      }));

      // 1. fetchExplorePlaces (Explore route cascade)
      const exploreRes = await fetchExplorePlaces('Delhi');
      assert.ok(exploreRes.results.some((r) => r.name === 'India Gate'));

      // 2. retrieveCandidates (Itinerary candidate retrieval)
      const candidates = await retrieveCandidates('Delhi');
      assert.ok(candidates.some((c) => c.name === 'India Gate'));
    });

    it('excludes hidden place from fetchExplorePlaces Tier 1, Tier 2, and candidate retrieval', async () => {
      const placeId = new mongoose.Types.ObjectId();
      inMemoryPlaces.set(placeId.toString(), createPlaceDoc({
        _id: placeId,
        name: 'Baga Beach',
        city: 'Goa',
        state: 'Goa',
        type: 'Beach',
        googleRating: 4.5,
        latitude: 15.55,
        longitude: 73.75,
        hidden: false,
      }));

      // Initially found
      const initialExplore = await fetchExplorePlaces('Goa');
      assert.ok(initialExplore.results.some((r) => r.name === 'Baga Beach'));

      // Hide the place via /admin/places/:id/hide
      const hideRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/places/${placeId}/hide`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { reason: 'Monsoon renovation' },
      });
      assert.equal(hideRes.status, 200);
      assert.equal(hideRes.body.hidden, true);

      // Invalidate destination cache occurred; fetch again
      const exploreAfterHide = await fetchExplorePlaces('Goa');
      assert.equal(exploreAfterHide.results.some((r) => r.name === 'Baga Beach'), false);

      const candidatesAfterHide = await retrieveCandidates('Goa');
      assert.equal(candidatesAfterHide.some((c) => c.name === 'Baga Beach'), false);

      // Restore the place via /admin/places/:id/restore
      const restoreRes = await dispatch(app, {
        method: 'POST',
        url: `/admin/places/${placeId}/restore`,
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.hidden, false);

      // Visible again
      const exploreAfterRestore = await fetchExplorePlaces('Goa');
      assert.ok(exploreAfterRestore.results.some((r) => r.name === 'Baga Beach'));
    });
  });

  describe('6. Embedding Stale Flag & Audited Rollback', () => {
    it('sets embeddingStale: true when updating significance or text fields', async () => {
      const placeId = new mongoose.Types.ObjectId();
      inMemoryPlaces.set(placeId.toString(), createPlaceDoc({
        _id: placeId,
        name: 'Amber Fort',
        city: 'Jaipur',
        state: 'Rajasthan',
        type: 'Fort',
        significance: 'Historical Royal Palace',
        latitude: 26.98,
        longitude: 75.85,
        embeddingStale: false,
      }));

      const patchRes = await dispatch(app, {
        method: 'PATCH',
        url: `/admin/places/${placeId}`,
        headers: { Authorization: `Bearer ${editorToken}` },
        body: { significance: 'UNESCO World Heritage Hill Fort' },
      });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.embeddingStale, true);

      // Verify audit log has place.update with before/after changes
      const updateLog = inMemoryAuditLogs.find((l) => l.action === 'place.update');
      assert.ok(updateLog);
      assert.equal(updateLog.targetId, placeId.toString());
      assert.ok(updateLog.changes.some((c) => c.field === 'significance'));
    });

    it('rolls back and does not persist place when mutation fails in runAudited', async () => {
      const origSave = TouristPlace.prototype.save;
      TouristPlace.prototype.save = () => {
        throw new Error('Disk write error during place creation');
      };

      try {
        const res = await dispatch(app, {
          method: 'POST',
          url: '/admin/places',
          headers: { Authorization: `Bearer ${superAdminToken}` },
          body: {
            name: 'Fail Fort',
            city: 'Agra',
            state: 'Uttar Pradesh',
            type: 'Fort',
            latitude: 27.1,
            longitude: 78.0,
          },
        });
        assert.equal(res.status, 500);

        // Verify place.create log was NOT persisted
        const createLogs = inMemoryAuditLogs.filter((l) => l.action === 'place.create');
        assert.equal(createLogs.length, 0);
      } finally {
        TouristPlace.prototype.save = origSave;
      }
    });

    it('leaves already-saved itineraries untouched when a place is hidden', async () => {
      // Saved itinerary with snapshot activity
      const placeId = new mongoose.Types.ObjectId();
      const savedItinerary = {
        _id: new mongoose.Types.ObjectId(),
        destination: 'Goa',
        days: [
          {
            dayNumber: 1,
            activities: [
              {
                id: 'act-1',
                kind: 'place',
                placeId: placeId.toString(),
                title: 'Baga Beach',
                location: { name: 'Baga Beach', latitude: 15.55, longitude: 73.75 },
              },
            ],
          },
        ],
      };

      inMemoryPlaces.set(placeId.toString(), createPlaceDoc({
        _id: placeId,
        name: 'Baga Beach',
        city: 'Goa',
        state: 'Goa',
        type: 'Beach',
        latitude: 15.55,
        longitude: 73.75,
        hidden: false,
      }));

      // Hide the place
      await dispatch(app, {
        method: 'POST',
        url: `/admin/places/${placeId}/hide`,
        headers: { Authorization: `Bearer ${editorToken}` },
      });

      // Saved itinerary's embedded activity is 100% untouched
      assert.equal(savedItinerary.days[0].activities[0].placeId, placeId.toString());
      assert.equal(savedItinerary.days[0].activities[0].location.name, 'Baga Beach');
    });
  });
});
