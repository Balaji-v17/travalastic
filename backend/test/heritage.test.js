import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

import {
  cleanHeritageText,
  normalizeHeritageState,
  isGenericHeritageName,
  isWithinIndiaBbox,
  transformHeritageRow,
  resolveHeritageGroupsAndDuplicates,
  resolveRepeatedEntityUids,
  findCuratedOverlap,
  applyCuratedOverlapFlags,
  recomputeHeritageFlags,
  getBlockingPublishFlags,
  HERITAGE_SOURCE,
} from '../src/utils/heritageProcessor.js';
import { tryEmbedPublishedPlace } from '../src/utils/placeEmbedding.js';
import { parseHeritageCsv, seedHeritage } from '../scripts/seedHeritage.js';
import { parseTouristPlaceCsvRow } from '../scripts/importTouristPlaces.js';
import { embedTouristPlaces } from '../scripts/embedTouristPlaces.js';
import destinationsRouter, { destinationResponseCache } from '../src/routes/destinations.js';
import { retrieveCandidates } from '../src/services/candidateRetrieval.js';
import adminPlacesRouter, { mapPlaceResponse } from '../src/routes/adminPlaces.js';
import TouristPlace from '../src/models/TouristPlace.js';
import City from '../src/models/City.js';
import Region from '../src/models/Region.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';
import { embeddingCache } from '../src/services/embeddingService.js';

const ADMIN_JWT_SECRET = 'heritage-test-admin-secret-at-least-32-chars!!';

function dispatch(app, { method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const rawBody = body ? JSON.stringify(body) : null;
    const req = Readable.from(rawBody ? [rawBody] : []);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
    };
    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }
    req.body = body || undefined;
    req.ip = '127.0.0.1';
    req.socket = { remoteAddress: '127.0.0.1' };

    let statusCode = 200;
    const resHeaders = {};
    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => { delete resHeaders[k.toLowerCase()]; };
    res.set = (k, v) => { resHeaders[String(k).toLowerCase()] = v; };
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resolve({ status: statusCode, body: data, headers: resHeaders });
      res.emit('finish');
      return res;
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' }, headers: resHeaders });
    });
  });
}

describe('Heritage CSV parsing, cleaning, state mapping, bbox & generic name flags', () => {
  it('parses broken U+FFFD text, strips control chars, and flags broken_text', () => {
    const csv = [
      'entity_uid,site_name,description,location,state,district,asi_circle,protected_by,longitude,latitude,geometry,source',
      'asi:TEST01,"Temple\t\u0007 of \uFFFD Shiva","  Built in\n12th century  ",Hampi,Karnataka,Bellary,Hampi Circle,BLR01,76.46,15.33,"",Bhuvan ASI Monuments (via ramSeraph/indian_facilities)',
    ].join('\n');

    const rows = parseHeritageCsv(csv);
    assert.equal(rows.length, 1);

    const res = transformHeritageRow(rows[0]);
    assert.equal(res.valid, true);
    assert.equal(res.doc.name, 'Temple of \uFFFD Shiva');
    assert.equal(res.doc.significance, 'Built in 12th century');
    assert.ok(res.doc.reviewFlags.includes('broken_text'));
    assert.equal(cleanHeritageText('  Hello\u0001\t World  '), 'Hello World');
  });

  it('normalizes heritage state spellings and leaves empty state null with state_unmapped', () => {
    assert.deepEqual(normalizeHeritageState('Chhatisgarh'), { state: 'Chhattisgarh', unmapped: false });
    assert.deepEqual(normalizeHeritageState('DADAR & NAGAR HAVELI'), { state: 'Dadra and Nagar Haveli', unmapped: false });
    assert.deepEqual(normalizeHeritageState('DAMAN & DIU'), { state: 'Daman and Diu', unmapped: false });
    assert.deepEqual(normalizeHeritageState('Jammu & Kashmir'), { state: 'Jammu and Kashmir', unmapped: false });
    assert.deepEqual(normalizeHeritageState('ORISSA'), { state: 'Odisha', unmapped: false });
    assert.deepEqual(normalizeHeritageState(''), { state: null, unmapped: true });

    const rowNoState = transformHeritageRow({
      entity_uid: 'soi:123',
      site_name: 'Old Stepwell',
      description: '',
      location: 'Hampi',
      state: '',
      district: '',
      asi_circle: '',
      protected_by: '',
      longitude: '76.46',
      latitude: '15.33',
      source: 'Survey of India Monuments',
    });
    assert.equal(rowNoState.valid, true);
    assert.equal(rowNoState.doc.state, null);
    assert.equal(rowNoState.doc.city, 'Hampi');
    assert.ok(rowNoState.doc.reviewFlags.includes('state_unmapped'));
    assert.ok(rowNoState.doc.reviewFlags.includes('no_description'));
  });

  it('flags coordinates outside India bounding box and detects generic 1-2 word names', () => {
    assert.equal(isWithinIndiaBbox(26.444844, 98.161812), false); // Nagaland asi:GUWNL071
    assert.equal(isWithinIndiaBbox(15.33, 76.46), true);

    const outRow = transformHeritageRow({
      entity_uid: 'asi:GUWNL071',
      site_name: 'Fort',
      description: '',
      location: 'Kohima',
      state: 'Nagaland',
      district: 'Kohima',
      asi_circle: 'Guwahati Circle',
      protected_by: 'GUW071',
      longitude: '98.161812',
      latitude: '26.444844',
      source: 'Bhuvan ASI Monuments',
    });
    assert.ok(outRow.doc.reviewFlags.includes('coords_outside_india'));
    assert.ok(outRow.doc.reviewFlags.includes('generic_name'));
    assert.equal(outRow.doc.heritage.coordsApprox, true);
    assert.equal(outRow.doc.entranceFeeINR, null);
    assert.equal(outRow.doc.googleRating, null);
    assert.equal(outRow.doc.timeNeededHours, null);

    assert.equal(isGenericHeritageName('Fort'), true);
    assert.equal(isGenericHeritageName('Ancient Caves'), false);
    assert.equal(isGenericHeritageName('Stone Pillar'), false);
    assert.equal(isGenericHeritageName('Mound'), true);
    assert.equal(isGenericHeritageName('Virupaksha Temple Complex'), false);
  });

  it('groups duplicates by (name, district, state), prefers ASI over SOI, merges sourceIds, and preserves cross-district records', () => {
    const rSoi = transformHeritageRow({
      entity_uid: 'soi:100',
      site_name: 'Golconda Fort',
      description: 'SOI description',
      location: 'Hyderabad',
      state: 'Telangana',
      district: 'Hyderabad',
      longitude: '78.401',
      latitude: '17.383',
      source: 'Survey of India Monuments',
    });
    const rAsi = transformHeritageRow({
      entity_uid: 'asi:HYDTG01',
      site_name: 'Golconda fort',
      description: '',
      location: 'Hyderabad',
      state: 'Telangana',
      district: 'Hyderabad',
      longitude: '78.401',
      latitude: '17.383',
      source: 'Bhuvan ASI Monuments',
    });
    const rOtherDist = transformHeritageRow({
      entity_uid: 'soi:200',
      site_name: 'Golconda Fort',
      description: '',
      location: 'Somewhere',
      state: 'Telangana',
      district: 'Rangareddy',
      longitude: '78.401',
      latitude: '17.383',
      source: 'Survey of India Monuments',
    });

    const docs = resolveHeritageGroupsAndDuplicates([rSoi, rAsi, rOtherDist]);
    assert.equal(docs.length, 3);

    const asiDoc = docs.find((d) => d.sourceId === 'asi:HYDTG01');
    const soiDup = docs.find((d) => d.sourceId === 'soi:100');
    const otherDist = docs.find((d) => d.sourceId === 'soi:200');

    assert.equal(asiDoc.hiddenReason, 'pending_review');
    assert.deepEqual(asiDoc.heritage.mergedSourceIds, ['soi:100']);

    assert.equal(soiDup.hidden, true);
    assert.equal(soiDup.hiddenReason, 'duplicate');
    assert.ok(soiDup.reviewFlags.includes('possible_duplicate'));

    assert.equal(otherDist.hiddenReason, 'pending_review');
    assert.deepEqual(otherDist.heritage.mergedSourceIds, []);
  });
});

describe('Heritage importer idempotency & embedding hidden guard', () => {
  it('runs seedHeritage twice with stable counts, calls syncIndexes(), and makes zero embedding calls', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-heritage-test-'));
    const csvPath = path.join(tmpDir, 'heritage.csv');
    fs.writeFileSync(
      csvPath,
      [
        'entity_uid,site_name,description,location,state,district,asi_circle,protected_by,longitude,latitude,geometry,source',
        'asi:HMP01,Virupaksha Temple Complex,Ancient temple complex,Hampi,Karnataka,Bellary,Hampi Circle,HMP01,76.458,15.335,"",Bhuvan ASI Monuments',
        'soi:HMP99,Virupaksha Temple Complex,SOI copy,Hampi,Karnataka,Bellary,,,76.458,15.335,"",Survey of India Monuments',
      ].join('\n'),
      'utf8'
    );

    const store = new Map();
    let syncIndexesCalls = 0;
    const MockTouristPlace = {
      collection: { name: 'touristplaces' },
      async bulkWrite(ops) {
        let upsertedCount = 0;
        let matchedCount = 0;
        for (const op of ops) {
          const key = op.updateOne.filter.sourceId;
          const doc = op.updateOne.update.$setOnInsert;
          if (!store.has(key)) {
            store.set(key, doc);
            upsertedCount++;
          } else {
            matchedCount++;
          }
        }
        return { upsertedCount, modifiedCount: 0, matchedCount };
      },
      async syncIndexes() {
        syncIndexesCalls++;
      },
      async countDocuments(filter = {}) {
        if (filter.source === HERITAGE_SOURCE) {
          return Array.from(store.values()).filter((d) => d.source === HERITAGE_SOURCE).length;
        }
        if (filter.hidden?.$ne === true) {
          return Array.from(store.values()).filter((d) => d.hidden !== true).length;
        }
        return store.size;
      },
    };

    const quietLogger = { log: () => {}, warn: () => {}, error: () => {} };

    try {
      const run1 = await seedHeritage({
        csvPath,
        connect: false,
        closeConnection: false,
        TouristPlaceModel: MockTouristPlace,
        logger: quietLogger,
      });
      assert.equal(run1.inserted, 2);
      assert.equal(run1.unchanged, 0);
      assert.equal(run1.pendingReview, 1);
      assert.equal(run1.duplicate, 1);
      assert.equal(syncIndexesCalls, 1);
      assert.equal(await MockTouristPlace.countDocuments({ hidden: { $ne: true } }), 0);

      const run2 = await seedHeritage({
        csvPath,
        connect: false,
        closeConnection: false,
        TouristPlaceModel: MockTouristPlace,
        logger: quietLogger,
      });
      assert.equal(run2.inserted, 0);
      assert.equal(run2.unchanged, 2);
      assert.equal(syncIndexesCalls, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('embedTouristPlaces skips hidden records without an embedding and does not call embedding API', async () => {
    const hiddenDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Hidden Heritage Monument',
      city: 'Bellary',
      state: 'Karnataka',
      type: 'Heritage monument',
      hidden: true,
      hiddenReason: 'pending_review',
      embedding: undefined,
      embeddingStale: true,
    };
    const visibleDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Visible Heritage Monument',
      city: 'Bellary',
      state: 'Karnataka',
      type: 'Heritage monument',
      hidden: false,
      embedding: undefined,
      embeddingStale: true,
    };

    let capturedQuery = null;
    const embeddedIds = [];
    const embedCalls = [];

    const MockModel = {
      async countDocuments() { return 2; },
      async find(q) {
        capturedQuery = q;
        return [hiddenDoc, visibleDoc].filter((d) => !(q.hidden?.$ne === true && d.hidden === true));
      },
      async updateOne(filter) {
        embeddedIds.push(filter._id.toString());
      },
    };

    const result = await embedTouristPlaces({
      TouristPlaceModel: MockModel,
      embedFn: async (text) => {
        embedCalls.push(text);
        return new Array(768).fill(0.01);
      },
      connect: false,
      closeConnection: false,
      throttleMs: 0,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });

    assert.deepEqual(capturedQuery.hidden, { $ne: true });
    assert.equal(result.embeddedCount, 1);
    assert.equal(embedCalls.length, 1);
    assert.ok(embedCalls[0].includes('Visible Heritage Monument'));
    assert.deepEqual(embeddedIds, [visibleDoc._id.toString()]);
  });
});

describe('Public queries exclude hidden heritage records & grounding skips heritage without valid coords', () => {
  let app;
  let origFind;
  let origFindOne;
  let origCityFindOne;
  let origRegionFindOne;
  let origAggregate;
  let origFetch;
  let capturedFindFilters;
  let capturedAggPipelines;
  let capturedFindOneFilter;

  beforeEach(() => {
    destinationResponseCache.clear();
    embeddingCache.set('Hidden Fort, top tourist places, attractions and sightseeing highlights', {
      embedding: new Array(768).fill(0.01),
      expiresAt: Date.now() + 60_000,
    });
    capturedFindFilters = [];
    capturedAggPipelines = [];
    capturedFindOneFilter = null;

    app = express();
    app.use('/destinations', destinationsRouter);

    origFind = TouristPlace.find;
    origFindOne = TouristPlace.findOne;
    origCityFindOne = City.findOne;
    origRegionFindOne = Region.findOne;
    origAggregate = TouristPlace.aggregate;
    origFetch = globalThis.fetch;

    const docs = [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Hidden Fort',
        city: 'Hampi',
        state: 'Karnataka',
        type: 'Heritage monument',
        hidden: true,
        hiddenReason: 'pending_review',
        latitude: 15.335,
        longitude: 76.46,
        source: HERITAGE_SOURCE,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Published Heritage Without Coords',
        city: 'Hampi',
        state: 'Karnataka',
        type: 'Heritage monument',
        hidden: false,
        latitude: null,
        longitude: null,
        source: HERITAGE_SOURCE,
      },
    ];

    TouristPlace.find = (filter = {}) => {
      capturedFindFilters.push(filter);
      const filtered = docs.filter((d) => {
        if (filter.hidden?.$ne === true && d.hidden === true) return false;
        return true;
      });
      return {
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => filtered,
            }),
          }),
        }),
      };
    };

    TouristPlace.findOne = (filter = {}) => {
      capturedFindOneFilter = filter;
      return {
        select: () => ({
          lean: async () => null,
        }),
      };
    };
    City.findOne = () => ({ select: () => ({ lean: async () => ({ sourceId: '1' }) }) });
    Region.findOne = () => ({ select: () => ({ lean: async () => null }) });

    TouristPlace.aggregate = async (pipeline) => {
      capturedAggPipelines.push(pipeline);
      return [];
    };

    globalThis.fetch = async (url) => {
      if (String(url).includes('nominatim')) {
        return { ok: true, json: async () => [{ latitude: 15.33, longitude: 76.46, lat: '15.33', lon: '76.46' }] };
      }
      return { ok: true, json: async () => ({ elements: [] }) };
    };
  });

  afterEach(() => {
    TouristPlace.find = origFind;
    TouristPlace.findOne = origFindOne;
    City.findOne = origCityFindOne;
    Region.findOne = origRegionFindOne;
    TouristPlace.aggregate = origAggregate;
    globalThis.fetch = origFetch;
    embeddingCache.clear();
    destinationResponseCache.clear();
  });

  it('GET /destinations/search excludes hidden in Tier 1 regex and Tier 2 $vectorSearch', async () => {
    const res = await dispatch(app, {
      method: 'GET',
      url: '/destinations/search?q=Hidden+Fort&fallback=0',
    });
    assert.equal(res.status, 200);
    assert.ok(capturedFindFilters.some((f) => f.hidden?.$ne === true));
    assert.ok(capturedAggPipelines.some((p) => p.some((stage) => stage.$match?.hidden?.$ne === true)));
    assert.equal(res.body.results.some((r) => r.name === 'Hidden Fort'), false);
  });

  it('GET /destinations/check excludes hidden records', async () => {
    await dispatch(app, { method: 'GET', url: '/destinations/check?q=Hampi' });
    assert.deepEqual(capturedFindOneFilter?.hidden, { $ne: true });
  });

  it('retrieveCandidates (grounding) excludes hidden records and never places a heritage pin without valid coords', async () => {
    const candidates = await retrieveCandidates('Hampi');
    assert.ok(capturedFindFilters.some((f) => f.hidden?.$ne === true));
    assert.equal(candidates.some((c) => c.name === 'Hidden Fort'), false);
    assert.equal(candidates.some((c) => c.name === 'Published Heritage Without Coords'), false);
  });
});

describe('Admin heritage review, publish/reject, flags, concurrency, null fees, and role guards', () => {
  let app;
  let editorToken;
  let supportToken;
  let inMemoryPlaces;
  let inMemoryAuditLogs;
  let origAdminFindById;
  let origPlaceFind;
  let origPlaceFindById;
  let origPlaceSave;
  let origAuditCreate;

  beforeEach(() => {
    process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
    inMemoryPlaces = new Map();
    inMemoryAuditLogs = [];

    const editorId = new mongoose.Types.ObjectId();
    const supportId = new mongoose.Types.ObjectId();

    editorToken = jwt.sign(
      { sub: editorId.toString(), email: 'editor@test.com', role: 'content_editor' },
      ADMIN_JWT_SECRET,
      { expiresIn: '1h', audience: 'admin' }
    );
    supportToken = jwt.sign(
      { sub: supportId.toString(), email: 'support@test.com', role: 'support_agent' },
      ADMIN_JWT_SECRET,
      { expiresIn: '1h', audience: 'admin' }
    );

    origAdminFindById = AdminUser.findById;
    origPlaceFind = TouristPlace.find;
    origPlaceFindById = TouristPlace.findById;
    origPlaceSave = TouristPlace.prototype.save;
    origAuditCreate = AuditLog.create;

    AdminUser.findById = async (id) => {
      if (id.toString() === editorId.toString()) {
        return { _id: editorId, email: 'editor@test.com', role: 'content_editor', active: true, mustChangePassword: false };
      }
      if (id.toString() === supportId.toString()) {
        return { _id: supportId, email: 'support@test.com', role: 'support_agent', active: true, mustChangePassword: false };
      }
      return null;
    };

    AuditLog.create = async (entry) => {
      const doc = Array.isArray(entry) ? entry[0] : entry;
      inMemoryAuditLogs.push(doc);
      return doc;
    };

    TouristPlace.findById = (id) => {
      const doc = inMemoryPlaces.get(id?.toString()) || null;
      return Promise.resolve(doc);
    };

    TouristPlace.find = (filter = {}) => {
      let rows = Array.from(inMemoryPlaces.values());
      if (filter._id?.$in) {
        const idSet = new Set(filter._id.$in.map((x) => x.toString()));
        rows = rows.filter((r) => idSet.has(r._id.toString()));
      }
      if (filter._id?.$ne) {
        const exId = filter._id.$ne.toString();
        rows = rows.filter((r) => r._id.toString() !== exId);
      }
      if (filter.source?.$ne) {
        rows = rows.filter((r) => r.source !== filter.source.$ne);
      }
      const chain = {
        select: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        populate: () => chain,
        lean: async () => rows.map((r) => r.toObject()),
        then: (res, rej) => Promise.resolve(rows).then(res, rej),
      };
      return chain;
    };

    TouristPlace.prototype.save = async function () {
      this.updatedAt = new Date();
      inMemoryPlaces.set(this._id.toString(), this);
      return this;
    };

    app = express();
    app.use(express.json());
    app.use('/admin/places', adminPlacesRouter);
  });

  afterEach(() => {
    AdminUser.findById = origAdminFindById;
    TouristPlace.find = origPlaceFind;
    TouristPlace.findById = origPlaceFindById;
    TouristPlace.prototype.save = origPlaceSave;
    AuditLog.create = origAuditCreate;
  });

  it('mapPlaceResponse preserves null for entranceFeeINR, googleRating, and timeNeededHours', () => {
    const mapped = mapPlaceResponse({
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Monument',
      city: 'Bellary',
      state: 'Karnataka',
      type: HERITAGE_SOURCE,
      entranceFeeINR: null,
      googleRating: null,
      timeNeededHours: null,
    });
    assert.equal(mapped.entranceFeeINR, null);
    assert.equal(mapped.googleRating, null);
    assert.equal(mapped.timeNeededHours, null);
  });

  it('denies support_agent on publish and bulk-action with 403', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res1 = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${id}/publish`,
      headers: { Authorization: `Bearer ${supportToken}` },
    });
    assert.equal(res1.status, 403);

    const res2 = await dispatch(app, {
      method: 'POST',
      url: '/admin/places/bulk-action',
      headers: { Authorization: `Bearer ${supportToken}` },
      body: { action: 'publish', ids: [id] },
    });
    assert.equal(res2.status, 403);
  });

  it('blocks publish while unresolved flags exist, allows after edit, writes audit log, and checks version concurrency', async () => {
    const place = new TouristPlace({
      sourceId: 'asi:TESTFLAG',
      name: 'Fort',
      city: 'Mirjan',
      state: 'Karnataka',
      type: 'Heritage monument',
      latitude: 26.4448,
      longitude: 98.1618,
      hidden: true,
      hiddenReason: 'pending_review',
      isCurated: false,
      source: 'asi-soi-heritage',
      reviewFlags: ['coords_outside_india', 'generic_name'],
    });
    inMemoryPlaces.set(place._id.toString(), place);

    // 1. Blocked publish while flags unresolved
    const blockedRes = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${place._id}/publish`,
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    assert.equal(blockedRes.status, 400);
    assert.ok(blockedRes.body.blockingFlags.includes('coords_outside_india'));
    assert.ok(blockedRes.body.blockingFlags.includes('generic_name'));

    // 2. Stale expectedVersion returns 409
    const conflictRes = await dispatch(app, {
      method: 'PATCH',
      url: `/admin/places/${place._id}`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { name: 'Mirjan Fort', expectedVersion: 99 },
    });
    assert.equal(conflictRes.status, 409);

    // 3. Edit name and coords into India -> flags clear & version increments
    const editRes = await dispatch(app, {
      method: 'PATCH',
      url: `/admin/places/${place._id}`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: {
        name: 'Mirjan Fort',
        latitude: 14.4889,
        longitude: 74.4176,
        expectedVersion: 0,
      },
    });
    assert.equal(editRes.status, 200);
    assert.deepEqual(getBlockingPublishFlags(editRes.body), []);

    // 4. Publish succeeds (even without GEMINI_API_KEY, leaves embeddingStale: true) and writes audit log
    const pubRes = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${place._id}/publish`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { expectedVersion: editRes.body.version },
    });
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.body.hidden, false);
    assert.equal(pubRes.body.hiddenReason, null);
    assert.equal(pubRes.body.isCurated, true);
    assert.equal(pubRes.body.embeddingStale, true);
    assert.ok(inMemoryAuditLogs.some((l) => l.action === 'place.publish'));
  });

  it('tryEmbedPublishedPlace failure does not throw and leaves embeddingStale: true', async () => {
    const place = new TouristPlace({
      name: 'Virupaksha Temple',
      city: 'Bellary',
      state: 'Karnataka',
      type: 'Heritage monument',
      hidden: false,
      embeddingStale: true,
    });
    const res = await tryEmbedPublishedPlace(place, {
      embedFn: async () => { throw new Error('Gemini unavailable'); },
    });
    assert.equal(res.embedded, false);
    assert.equal(place.embeddingStale, true);
  });

  it('enforces bulk action max 50 limit and audits bulk publish/reject', async () => {
    const tooMany = Array.from({ length: 51 }, () => new mongoose.Types.ObjectId().toString());
    const limitRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/places/bulk-action',
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { action: 'reject', ids: tooMany },
    });
    assert.equal(limitRes.status, 400);
    assert.match(limitRes.body.error, /50/);

    const p1 = new TouristPlace({
      sourceId: 'asi:B1',
      name: 'Virupaksha Temple Complex',
      city: 'Bellary',
      state: 'Karnataka',
      type: 'Heritage monument',
      latitude: 15.335,
      longitude: 76.458,
      hidden: true,
      hiddenReason: 'pending_review',
      source: 'asi-soi-heritage',
      reviewFlags: [],
    });
    inMemoryPlaces.set(p1._id.toString(), p1);

    const bulkRes = await dispatch(app, {
      method: 'POST',
      url: '/admin/places/bulk-action',
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { action: 'reject', ids: [p1._id.toString()] },
    });
    assert.equal(bulkRes.status, 200);
    assert.equal(bulkRes.body.succeededCount, 1);
    assert.equal(bulkRes.body.succeeded[0].hiddenReason, 'rejected');
    assert.ok(inMemoryAuditLogs.some((l) => l.action === 'place.bulk_reject'));
  });

  it('recomputeHeritageFlags clears resolved flags accurately', () => {
    const flags = recomputeHeritageFlags({
      name: 'Fort, Mirjan',
      city: 'Uttar Kannada',
      state: 'Karnataka',
      significance: 'Historic fort in Karnataka',
      latitude: 14.4889,
      longitude: 74.4176,
      reviewFlags: ['coords_outside_india', 'generic_name', 'broken_text', 'no_description', 'state_unmapped'],
    });
    assert.deepEqual(flags, []);
  });

  it('importTouristPlaces preserves null for missing or non-numeric entranceFeeINR and preserves explicit 0', () => {
    const missingFee = parseTouristPlaceCsvRow({
      Name: 'Calangute Beach',
      City: 'Goa',
      State: 'Goa',
      'Entrance Fee in INR': '',
    });
    assert.equal(missingFee.entranceFeeINR, null);

    const invalidFee = parseTouristPlaceCsvRow({
      Name: 'Free Shrine',
      City: 'Udupi',
      State: 'Karnataka',
      'Entrance Fee in INR': 'N/A',
    });
    assert.equal(invalidFee.entranceFeeINR, null);

    const freeZero = parseTouristPlaceCsvRow({
      Name: 'Public Beach',
      City: 'Varkala',
      State: 'Kerala',
      'Entrance Fee in INR': '0',
    });
    assert.equal(freeZero.entranceFeeINR, 0);
  });

  it('requires confirmCuratedOverlap on publish for matches_curated and supports skip-curated', async () => {
    const curated = new TouristPlace({
      name: 'Ajanta Caves',
      city: 'Aurangabad',
      state: 'Maharashtra',
      type: 'Caves',
      source: 'kaggle',
      isCurated: true,
      hidden: false,
    });
    const heritage = new TouristPlace({
      sourceId: 'asi:AURMH056',
      name: 'Ajanta Caves',
      city: 'Aurangabad',
      state: 'Maharashtra',
      type: 'Heritage monument',
      significance: 'Rock-cut Buddhist caves',
      latitude: 20.5519,
      longitude: 75.7033,
      hidden: true,
      hiddenReason: 'pending_review',
      source: HERITAGE_SOURCE,
      reviewFlags: ['matches_curated'],
      heritage: {
        protectedBy: 'ASI',
        coordsApprox: true,
        matchedCuratedPlace: {
          placeId: curated._id.toString(),
          name: curated.name,
          city: curated.city,
          state: curated.state,
          reason: 'same_state_name',
          distanceMeters: null,
        },
      },
    });
    inMemoryPlaces.set(curated._id.toString(), curated);
    inMemoryPlaces.set(heritage._id.toString(), heritage);

    // Without confirmCuratedOverlap, publish returns 400
    const blockedRes = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${heritage._id}/publish`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { expectedVersion: heritage.__v },
    });
    assert.equal(blockedRes.status, 400);
    assert.equal(blockedRes.body.code, 'CURATED_OVERLAP_CONFIRMATION_REQUIRED');
    assert.equal(blockedRes.body.matchedCuratedPlace.name, 'Ajanta Caves');

    // Skip - already curated sets hiddenReason: 'already_curated'
    const skipRes = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${heritage._id}/skip-curated`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { expectedVersion: heritage.__v },
    });
    assert.equal(skipRes.status, 200);
    assert.equal(skipRes.body.hidden, true);
    assert.equal(skipRes.body.hiddenReason, 'already_curated');
    assert.ok(inMemoryAuditLogs.some((l) => l.action === 'place.skip_curated'));

    // With confirmCuratedOverlap: true, publish succeeds
    const okRes = await dispatch(app, {
      method: 'POST',
      url: `/admin/places/${heritage._id}/publish`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: { expectedVersion: skipRes.body.version, confirmCuratedOverlap: true },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.hidden, false);
    assert.equal(okRes.body.hiddenReason, null);
  });

  it('allows Quick Edit rename of asi:AGRUP028_13 to Taj Mahal without 409 while keeping flags accurate', async () => {
    const existingCuratedTaj = new TouristPlace({
      name: 'Taj Mahal',
      city: 'Agra',
      state: 'Uttar Pradesh',
      type: 'Monument',
      source: 'kaggle',
      isCurated: true,
      hidden: false,
    });
    const heritageTaj = new TouristPlace({
      sourceId: 'asi:AGRUP028_13',
      name: 'Taj and grounds including the masjid on the west side, the pavillion on the east ..',
      city: 'Agra',
      state: 'Uttar Pradesh',
      type: 'Heritage monument',
      significance: 'Taj and grounds including the masjid on the west side, the pavillion on the east ..',
      latitude: 27.173377,
      longitude: 78.041896,
      hidden: true,
      hiddenReason: 'pending_review',
      source: HERITAGE_SOURCE,
      reviewFlags: [],
      heritage: {
        protectedBy: '023',
        asiCircle: 'Agra Circle',
        location: 'Tajganj',
        coordsApprox: true,
        mergedSourceIds: [],
        extraCoords: [],
        matchedCuratedPlace: null,
      },
    });
    inMemoryPlaces.set(existingCuratedTaj._id.toString(), existingCuratedTaj);
    inMemoryPlaces.set(heritageTaj._id.toString(), heritageTaj);

    const res = await dispatch(app, {
      method: 'PATCH',
      url: `/admin/places/${heritageTaj._id}`,
      headers: { Authorization: `Bearer ${editorToken}` },
      body: {
        name: 'Taj Mahal',
        expectedVersion: heritageTaj.__v,
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Taj Mahal');
    assert.equal(res.body.reviewFlags.includes('generic_name'), false);
    assert.equal(res.body.reviewFlags.includes('matches_curated'), true);
    assert.equal(res.body.heritage.matchedCuratedPlace.name, 'Taj Mahal');
  });
});

describe('Repeated entity_uid resolution & curated overlap matching', () => {
  it('skips exact repeats, merges coords-only into extraCoords, and splits distinct repeats into #2/#3', () => {
    const base = {
      entity_uid: 'asi:TEST01',
      site_name: 'Old Stepwell',
      description: 'Historic baori',
      district: 'Jaipur',
      location: 'Amber',
      state: 'Rajasthan',
      protected_by: 'JPR_1',
      asi_circle: 'Jaipur Circle',
      latitude: '26.9855',
      longitude: '75.8513',
      source: 'ASI',
    };

    const rows = [
      base,
      // 1. Exact duplicate -> skipped
      { ...base },
      // 2. Coordinate-only difference -> stored in heritage.extraCoords
      { ...base, latitude: '26.9862', longitude: '75.8520' },
      // 3. Different site_name -> becomes asi:TEST01#2
      { ...base, site_name: 'New Stepwell Shrine', latitude: '26.9890', longitude: '75.8550' },
      // 4. Different location -> becomes asi:TEST01#3
      { ...base, location: 'Sanganer', latitude: '26.8200', longitude: '75.7900' },
    ];

    const transformed = rows.map(transformHeritageRow).filter((r) => r.valid);
    const { candidates, stats } = resolveRepeatedEntityUids(transformed);

    assert.equal(stats.skippedExactRepeats, 1);
    assert.equal(stats.coordinateOnlyRepeats, 1);
    assert.equal(stats.addedDistinctRepeats, 2);
    assert.equal(candidates.length, 3);

    assert.equal(candidates[0].doc.sourceId, 'asi:TEST01');
    assert.equal(candidates[0].doc.latitude, 26.9855);
    assert.equal(candidates[0].doc.longitude, 75.8513);
    assert.deepEqual(candidates[0].doc.heritage.extraCoords, [{ lat: 26.9862, lng: 75.852 }]);

    assert.equal(candidates[1].doc.sourceId, 'asi:TEST01#2');
    assert.equal(candidates[1].doc.name, 'New Stepwell Shrine');
    assert.equal(candidates[1].doc.hiddenReason, 'pending_review');

    assert.equal(candidates[2].doc.sourceId, 'asi:TEST01#3');
    assert.equal(candidates[2].doc.heritage.location, 'Sanganer');
  });

  it('matches curated overlaps by same state + near-identical name or <= 500m, avoiding cross-state false positives', () => {
    const curatedPlaces = [
      {
        _id: 'cur-shan',
        name: 'Shaniwar Wada',
        city: 'Pune',
        state: 'Maharashtra',
        latitude: null,
        longitude: null,
      },
      {
        _id: 'cur-jantar-jaipur',
        name: 'Jantar Mantar',
        city: 'Jaipur',
        state: 'Rajasthan',
        latitude: 26.9247,
        longitude: 75.8246,
      },
      {
        _id: 'cur-near',
        name: 'Hampi Ruins',
        city: 'Hampi',
        state: 'OtherState',
        latitude: 15.335,
        longitude: 76.46,
      },
    ];

    // Same-state near-identical ("Old citadel known as Shanwar Wada" -> "Shaniwar Wada")
    const mhMatch = findCuratedOverlap(
      { name: 'Old citadel known as Shanwar Wada', state: 'Maharashtra', latitude: 18.5194, longitude: 73.8554 },
      curatedPlaces
    );
    assert.ok(mhMatch);
    assert.equal(mhMatch.placeId, 'cur-shan');
    assert.equal(mhMatch.reason, 'same_state_name');

    // False positive guard: same name ("Jantar Mantar") in DIFFERENT state ("Delhi" vs "Rajasthan") & > 500 m
    const falsePos = findCuratedOverlap(
      { name: 'Jantar Mantar', state: 'Delhi', latitude: 28.6271, longitude: 77.2166 },
      curatedPlaces
    );
    assert.equal(falsePos, null);

    // Distance <= 500 m + similar name matches even across differing state label
    const distMatch = findCuratedOverlap(
      { name: 'Virupaksha Temple at Hampi', state: 'Karnataka', latitude: 15.3354, longitude: 76.4604 },
      curatedPlaces
    );
    assert.ok(distMatch);
    assert.equal(distMatch.placeId, 'cur-near');
    assert.equal(distMatch.reason, 'within_500m_similar_name');
    assert.ok(distMatch.distanceMeters <= 500);

    // applyCuratedOverlapFlags adds/removes flag cleanly
    const docs = [
      { name: 'Old citadel known as Shanwar Wada', state: 'Maharashtra', latitude: 18.5194, longitude: 73.8554, reviewFlags: [], heritage: {} },
      { name: 'Jantar Mantar', state: 'Delhi', latitude: 28.6271, longitude: 77.2166, reviewFlags: ['matches_curated'], heritage: {} },
    ];
    const matched = applyCuratedOverlapFlags(docs, curatedPlaces);
    assert.equal(matched, 1);
    assert.ok(docs[0].reviewFlags.includes('matches_curated'));
    assert.equal(docs[1].reviewFlags.includes('matches_curated'), false);
  });
});
