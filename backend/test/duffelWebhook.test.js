import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { verifyDuffelSignature } from '../src/services/disruptions/duffelSignature.js';
import { ingestScheduleChange, handleDuffelEvent } from '../src/services/disruptions/ingest.js';
import { duffel } from '../src/services/duffelClient.js';
import Disruption from '../src/models/Disruption.js';
import Booking from '../src/models/Booking.js';
import Itinerary from '../src/models/Itinerary.js';
import User from '../src/models/User.js';
import duffelWebhookRoute from '../src/routes/duffelWebhook.js';
import disruptionsRoute from '../src/routes/disruptions.js';

// Helper: computes HMAC-SHA256 signature for test requests
function createTestSignature(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const t = String(timestamp);
  const signed = `${t}.${rawBody}`;
  const hex = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex').toLowerCase();
  return {
    header: `t=${t},v1=${hex}`,
    timestamp: t,
    hex,
  };
}

// In-memory test dispatcher for Express apps
function dispatch(app, { method, url, headers = {}, body = '' }) {
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

    let statusCode = 200;
    const resHeaders = {};
    let resBody = '';

    const res = new EventEmitter();
    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
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

    app.handle(req, res);
  });
}

describe('Duffel Webhook & Disruption Pipeline', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // 1. Signature Verification Pure Function Tests
  // ────────────────────────────────────────────────────────────────────────────
  describe('verifyDuffelSignature pure function', () => {
    const secret = 'test_webhook_secret_abc123';
    const samplePayload = JSON.stringify({ type: 'order.airline_initiated_change_detected', id: 'wev_001' });

    it('accepts valid signature with matching HMAC', () => {
      const { header } = createTestSignature(secret, samplePayload);
      const res = verifyDuffelSignature({ rawBody: samplePayload, header, secret });
      assert.deepStrictEqual(res, { ok: true });
    });

    it('rejects wrong secret with bad_signature', () => {
      const { header } = createTestSignature('wrong_secret', samplePayload);
      const res = verifyDuffelSignature({ rawBody: samplePayload, header, secret });
      assert.deepStrictEqual(res, { ok: false, reason: 'bad_signature' });
    });

    it('rejects tampered body (one byte altered) with bad_signature', () => {
      const { header } = createTestSignature(secret, samplePayload);
      const tampered = samplePayload.replace('wev_001', 'wev_002');
      const res = verifyDuffelSignature({ rawBody: tampered, header, secret });
      assert.deepStrictEqual(res, { ok: false, reason: 'bad_signature' });
    });

    it('rejects missing header with missing_header', () => {
      const res = verifyDuffelSignature({ rawBody: samplePayload, header: null, secret });
      assert.deepStrictEqual(res, { ok: false, reason: 'missing_header' });

      const resEmpty = verifyDuffelSignature({ rawBody: samplePayload, header: '', secret });
      assert.deepStrictEqual(resEmpty, { ok: false, reason: 'missing_header' });
    });

    it('rejects missing secret with missing_secret', () => {
      const { header } = createTestSignature(secret, samplePayload);
      const res = verifyDuffelSignature({ rawBody: samplePayload, header, secret: '' });
      assert.deepStrictEqual(res, { ok: false, reason: 'missing_secret' });
    });

    it('rejects malformed headers (no t, no v1, junk string)', () => {
      // Missing t
      assert.deepStrictEqual(
        verifyDuffelSignature({ rawBody: samplePayload, header: 'v1=abc123', secret }),
        { ok: false, reason: 'malformed_header' }
      );
      // Missing v1
      assert.deepStrictEqual(
        verifyDuffelSignature({ rawBody: samplePayload, header: 't=1612345678', secret }),
        { ok: false, reason: 'malformed_header' }
      );
      // Non-numeric t
      assert.deepStrictEqual(
        verifyDuffelSignature({ rawBody: samplePayload, header: 't=notanumber,v1=abc123', secret }),
        { ok: false, reason: 'malformed_header' }
      );
      // Total junk
      assert.deepStrictEqual(
        verifyDuffelSignature({ rawBody: samplePayload, header: 'not a valid header at all', secret }),
        { ok: false, reason: 'malformed_header' }
      );
    });

    it('handles hex of the wrong length gracefully without throwing', () => {
      const header = 't=1612345678,v1=tooshort';
      const res = verifyDuffelSignature({ rawBody: samplePayload, header, secret });
      assert.deepStrictEqual(res, { ok: false, reason: 'bad_signature' });
    });

    it('normalizes uppercase hex so both cases pass', () => {
      const { header, timestamp, hex } = createTestSignature(secret, samplePayload);
      const upperHeader = `t=${timestamp},v1=${hex.toUpperCase()}`;
      const res = verifyDuffelSignature({ rawBody: samplePayload, header: upperHeader, secret });
      assert.deepStrictEqual(res, { ok: true });
    });

    it('accepts multiple v1 values when any one is valid', () => {
      const { timestamp, hex } = createTestSignature(secret, samplePayload);
      const multiHeader = `t=${timestamp},v1=deadbeef00000000000000000000000000000000000000000000000000000000,v1=${hex}`;
      const res = verifyDuffelSignature({ rawBody: samplePayload, header: multiHeader, secret });
      assert.deepStrictEqual(res, { ok: true });
    });

    it('rejects stale timestamp when tolerance is enabled', () => {
      const oldTime = 1600000000;
      const now = oldTime + 400; // 400s later
      const { header } = createTestSignature(secret, samplePayload, oldTime);

      const res = verifyDuffelSignature({
        rawBody: samplePayload,
        header,
        secret,
        toleranceSeconds: 300,
        now,
      });
      assert.deepStrictEqual(res, { ok: false, reason: 'stale_timestamp' });
    });

    it('accepts old timestamp when tolerance is disabled (toleranceSeconds = 0)', () => {
      const oldTime = 1600000000;
      const now = oldTime + 86400; // 1 day later
      const { header } = createTestSignature(secret, samplePayload, oldTime);

      const res = verifyDuffelSignature({
        rawBody: samplePayload,
        header,
        secret,
        toleranceSeconds: 0,
        now,
      });
      assert.deepStrictEqual(res, { ok: true });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Webhook Route & Ingestion Pipeline Tests
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /webhooks/duffel route & ingestion', () => {
    const testSecret = 'whsec_test_secret_998877';
    let app;
    let createdDisruptions = [];
    let duffelListCalls = 0;
    let duffelShouldFail = false;
    let mockChanges = [];
    let mockBooking = null;
    let mockItinerary = null;

    // Preserved references for cleanup
    let origDisruptionCreate;
    let origBookingFindOne;
    let origItineraryFindById;
    let origDuffelList;
    let origEnvSecret;
    let origEnvTol;

    beforeEach(() => {
      createdDisruptions = [];
      duffelListCalls = 0;
      duffelShouldFail = false;
      mockChanges = [];

      origEnvSecret = process.env.DUFFEL_WEBHOOK_SECRET;
      origEnvTol = process.env.DUFFEL_WEBHOOK_TOLERANCE_SECONDS;
      process.env.DUFFEL_WEBHOOK_SECRET = testSecret;
      process.env.DUFFEL_WEBHOOK_TOLERANCE_SECONDS = '0';

      origDisruptionCreate = Disruption.create;
      origBookingFindOne = Booking.findOne;
      origItineraryFindById = Itinerary.findById;
      origDuffelList = duffel.airlineInitiatedChanges.list;

      Disruption.create = async (doc) => {
        // Enforce unique compound index on { userId, dedupeKey }
        const exists = createdDisruptions.some(
          (d) => String(d.userId) === String(doc.userId) && d.dedupeKey === doc.dedupeKey
        );
        if (exists) {
          const err = new Error('E11000 duplicate key error');
          err.code = 11000;
          throw err;
        }
        const created = { _id: new mongoose.Types.ObjectId(), ...doc };
        createdDisruptions.push(created);
        return created;
      };

      Booking.findOne = async (query) => {
        if (mockBooking && mockBooking.orderId === query.orderId) {
          return mockBooking;
        }
        return null;
      };

      Itinerary.findById = async (id) => {
        if (mockItinerary && String(mockItinerary._id) === String(id)) {
          return mockItinerary;
        }
        return null;
      };

      duffel.airlineInitiatedChanges.list = async (orderId) => {
        duffelListCalls++;
        if (duffelShouldFail) {
          throw new Error('Duffel API connection error (timeout)');
        }
        return { data: mockChanges };
      };

      // Express test app with exact middleware chain from server.js
      app = express();
      app.use(
        '/webhooks/duffel',
        express.raw({ type: 'application/json', limit: '256kb' }),
        duffelWebhookRoute
      );
      app.use(express.json());
    });

    afterEach(() => {
      process.env.DUFFEL_WEBHOOK_SECRET = origEnvSecret;
      process.env.DUFFEL_WEBHOOK_TOLERANCE_SECONDS = origEnvTol;
      Disruption.create = origDisruptionCreate;
      Booking.findOne = origBookingFindOne;
      Itinerary.findById = origItineraryFindById;
      duffel.airlineInitiatedChanges.list = origDuffelList;
    });

    it('unsigned request returns 401 and writes NOTHING to the DB', async () => {
      const payload = JSON.stringify({ type: 'order.airline_initiated_change_detected' });
      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: {}, // No X-Duffel-Signature
        body: payload,
      });

      assert.strictEqual(res.status, 401);
      assert.deepStrictEqual(res.body, { error: 'Invalid signature' });
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('returns 503 when DUFFEL_WEBHOOK_SECRET is unset', async () => {
      delete process.env.DUFFEL_WEBHOOK_SECRET;
      const payload = JSON.stringify({ type: 'order.airline_initiated_change_detected' });
      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': 't=123,v1=abc' },
        body: payload,
      });

      assert.strictEqual(res.status, 503);
      assert.deepStrictEqual(res.body, { error: 'webhook not configured' });
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('valid signature with unknown event type returns 200 ignored and writes nothing', async () => {
      const payload = JSON.stringify({ type: 'order.created', id: 'wev_test_ping' });
      const { header } = createTestSignature(testSecret, payload);

      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { received: true, ignored: true });
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('valid event for unknown order returns 200 skipped (no_booking) and writes nothing', async () => {
      mockBooking = null; // No booking in DB
      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_001',
        idempotency_key: 'aic_001',
        data: { object: 'ord_unknown_999' },
      });
      const { header } = createTestSignature(testSecret, payload);

      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.skipped, 'no_booking');
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('valid event whose booking has no itineraryId returns 200 skipped (no_itinerary)', async () => {
      mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        orderId: 'ord_no_itin',
        itineraryId: null, // No linked itinerary
      };

      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_002',
        idempotency_key: 'aic_002',
        data: { object: 'ord_no_itin' },
      });
      const { header } = createTestSignature(testSecret, payload);

      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.skipped, 'no_itinerary');
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('sub-15-minute delay returns 200 skipped (not_actionable) and writes nothing', async () => {
      const userId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      mockItinerary = {
        _id: itineraryId,
        userId,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        days: [
          {
            dayNumber: 1,
            activities: [{ title: 'Hotel check-in', done: false }],
          },
        ],
      };

      mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        itineraryId,
        orderId: 'ord_sub15',
      };

      // 10-minute delay (sub-15 min)
      mockChanges = [
        {
          id: 'aic_sub15',
          removed: [{ slices: [], segments: [{ departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T14:00:00' }] }],
          added: [{ slices: [], segments: [{ departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T14:10:00' }] }],
        },
      ];

      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_sub15',
        idempotency_key: 'aic_sub15',
        data: { object: 'ord_sub15' },
      });
      const { header } = createTestSignature(testSecret, payload);

      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.skipped, 'not_actionable');
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('95-minute delay creates a Disruption with option 120 and status new', async () => {
      const userId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      mockItinerary = {
        _id: itineraryId,
        userId,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        days: [
          {
            dayNumber: 1,
            activities: [{ title: 'Sightseeing', done: false }],
          },
        ],
      };

      mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        itineraryId,
        orderId: 'ord_95min',
      };

      // 95-minute delay: 14:00 -> 15:35
      mockChanges = [
        {
          id: 'aic_95min',
          removed: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T14:00:00' }] }],
          added: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T15:35:00' }] }],
        },
      ];

      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_95min',
        idempotency_key: 'aic_95min',
        data: { object: 'ord_95min' },
      });
      const { header } = createTestSignature(testSecret, payload);

      const res = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(createdDisruptions.length, 1);

      const created = createdDisruptions[0];
      assert.strictEqual(created.status, 'new');
      assert.strictEqual(created.source, 'duffel_webhook');
      assert.strictEqual(created.details.delayMinutes, 95);
      assert.strictEqual(created.proposal.option, 120);
      assert.strictEqual(created.proposal.actionable, true);
      assert.strictEqual(created.dedupeKey, 'ord_95min:aic_95min');
    });

    it('duplicate delivery of same event creates exactly ONE Disruption', async () => {
      const userId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      mockItinerary = {
        _id: itineraryId,
        userId,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        days: [{ dayNumber: 1, activities: [{ title: 'Sightseeing', done: false }] }],
      };

      mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        itineraryId,
        orderId: 'ord_dedupe',
      };

      mockChanges = [
        {
          id: 'aic_dedupe',
          removed: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T14:00:00' }] }],
          added: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T15:00:00' }] }],
        },
      ];

      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_dup1',
        idempotency_key: 'aic_dedupe',
        data: { object: 'ord_dedupe' },
      });
      const { header } = createTestSignature(testSecret, payload);

      // Delivery 1: succeeds and creates 1 record
      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.success, true);
      assert.strictEqual(createdDisruptions.length, 1);

      // Delivery 2: returns 200 duplicate: true, exactly 1 record remains
      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.duplicate, true);
      assert.strictEqual(createdDisruptions.length, 1);
    });

    it('Duffel fetch error returns 500 and writes nothing; retry succeeds', async () => {
      const userId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      mockItinerary = {
        _id: itineraryId,
        userId,
        startDate: '2026-11-01',
        days: [{ dayNumber: 1, activities: [{ title: 'Sightseeing', done: false }] }],
      };

      mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        itineraryId,
        orderId: 'ord_retry',
      };

      mockChanges = [
        {
          id: 'aic_retry',
          removed: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T14:00:00' }] }],
          added: [{ segments: [{ origin: 'DEL', destination: 'BOM', departing_at: '2026-11-01T10:00:00', arriving_at: '2026-11-01T15:00:00' }] }],
        },
      ];

      const payload = JSON.stringify({
        type: 'order.airline_initiated_change_detected',
        id: 'wev_retry',
        idempotency_key: 'aic_retry',
        data: { object: 'ord_retry' },
      });
      const { header } = createTestSignature(testSecret, payload);

      // First attempt: Duffel API fails
      duffelShouldFail = true;
      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res1.status, 500);
      assert.strictEqual(createdDisruptions.length, 0);

      // Second attempt (retry): Duffel API recovers
      duffelShouldFail = false;
      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.success, true);
      assert.strictEqual(createdDisruptions.length, 1);
    });

    it('regression test: raw-body route works when global JSON parser is mounted after it', async () => {
      // Create a fresh app testing both /webhooks/duffel (raw) and a generic /api route (json)
      const testApp = express();
      testApp.use(
        '/webhooks/duffel',
        express.raw({ type: 'application/json', limit: '256kb' }),
        duffelWebhookRoute
      );
      testApp.use(express.json());
      testApp.post('/api/echo', (req, res) => res.json({ parsed: req.body }));

      const payload = JSON.stringify({ type: 'order.created', id: 'wev_ping' });
      const { header } = createTestSignature(testSecret, payload);

      // 1. Webhook route receives raw Buffer and verifies signature
      const webhookRes = await dispatch(testApp, {
        method: 'POST',
        url: '/webhooks/duffel',
        headers: { 'X-Duffel-Signature': header },
        body: payload,
      });
      assert.strictEqual(webhookRes.status, 200);

      // 2. Downstream routes receive parsed JSON normally
      const jsonRes = await dispatch(testApp, {
        method: 'POST',
        url: '/api/echo',
        body: { testKey: 'testVal' },
      });
      assert.strictEqual(jsonRes.status, 200);
      assert.deepStrictEqual(jsonRes.body, { parsed: { testKey: 'testVal' } });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Disruption Simulator Tests
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /disruptions/simulate endpoint', () => {
    let app;
    let createdDisruptions = [];
    let duffelListCalls = 0;
    let origEnvSimulator;
    let origEnvJwt;
    let origDisruptionCreate;
    let origItineraryFindById;
    let origUserFindById;
    let origDuffelList;

    const testUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const itineraryId = new mongoose.Types.ObjectId();
    const jwtSecret = 'test_jwt_secret_simulator';
    let validToken;

    beforeEach(() => {
      createdDisruptions = [];
      duffelListCalls = 0;

      origEnvSimulator = process.env.ENABLE_DISRUPTION_SIMULATOR;
      origEnvJwt = process.env.JWT_SECRET;
      process.env.ENABLE_DISRUPTION_SIMULATOR = 'true';
      process.env.JWT_SECRET = jwtSecret;

      validToken = jwt.sign({ userId: testUserId.toString() }, jwtSecret);

      origDisruptionCreate = Disruption.create;
      origItineraryFindById = Itinerary.findById;
      origUserFindById = User.findById;
      origDuffelList = duffel.airlineInitiatedChanges.list;

      Disruption.create = async (doc) => {
        const created = { _id: new mongoose.Types.ObjectId(), ...doc };
        createdDisruptions.push(created);
        return created;
      };

      Itinerary.findById = async (id) => {
        if (String(id) === String(itineraryId)) {
          return {
            _id: itineraryId,
            userId: testUserId,
            startDate: '2026-11-01',
            endDate: '2026-11-05',
            days: [
              { dayNumber: 1, activities: [{ title: 'Sightseeing', done: false }] },
              { dayNumber: 2, activities: [{ title: 'Museum', done: false }] },
            ],
          };
        }
        return null;
      };

      User.findById = () => ({
        select: () => ({
          lean: async () => ({ _id: testUserId }),
        }),
      });

      duffel.airlineInitiatedChanges.list = async () => {
        duffelListCalls++;
        return { data: [] };
      };

      app = express();
      app.use(express.json());
      app.use('/disruptions', disruptionsRoute);
    });

    afterEach(() => {
      process.env.ENABLE_DISRUPTION_SIMULATOR = origEnvSimulator;
      process.env.JWT_SECRET = origEnvJwt;
      Disruption.create = origDisruptionCreate;
      Itinerary.findById = origItineraryFindById;
      User.findById = origUserFindById;
      duffel.airlineInitiatedChanges.list = origDuffelList;
    });

    it('returns 404 when ENABLE_DISRUPTION_SIMULATOR is false/off', async () => {
      process.env.ENABLE_DISRUPTION_SIMULATOR = 'false';

      const res = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: { itineraryId: itineraryId.toString(), dayNumber: 1, delayMinutes: 60 },
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('when enabled, creates Disruption with source simulation and simulated true', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: { itineraryId: itineraryId.toString(), dayNumber: 2, delayMinutes: 120 },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.simulated, true);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(createdDisruptions.length, 1);

      const d = createdDisruptions[0];
      assert.strictEqual(d.source, 'simulation');
      assert.strictEqual(d.status, 'new');
      assert.strictEqual(d.bookingId, null);
      assert.strictEqual(d.details.delayMinutes, 120);
      assert.strictEqual(d.proposal.option, 120);
      assert.strictEqual(d.proposal.dayNumber, 2);
      assert.strictEqual(duffelListCalls, 0, 'Must NOT contact Duffel');
    });

    it('returns 404 when attempting to simulate on another user itinerary', async () => {
      // Mock itinerary belonging to someone else
      Itinerary.findById = async () => ({
        _id: itineraryId,
        userId: otherUserId,
        startDate: '2026-11-01',
        days: [{ dayNumber: 1, activities: [{ title: 'Sightseeing', done: false }] }],
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: { itineraryId: itineraryId.toString(), dayNumber: 1, delayMinutes: 60 },
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('validates delayMinutes: rejects 0 and 601 with 400', async () => {
      const res0 = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: { itineraryId: itineraryId.toString(), dayNumber: 1, delayMinutes: 0 },
      });
      assert.strictEqual(res0.status, 400);

      const res601 = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: { itineraryId: itineraryId.toString(), dayNumber: 1, delayMinutes: 601 },
      });
      assert.strictEqual(res601.status, 400);

      assert.strictEqual(createdDisruptions.length, 0);
    });

    it('two successive calls create two separate records due to nonce in dedupeKey', async () => {
      const body = { itineraryId: itineraryId.toString(), dayNumber: 1, delayMinutes: 45 };

      const res1 = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body,
      });
      assert.strictEqual(res1.status, 200);

      const res2 = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body,
      });
      assert.strictEqual(res2.status, 200);

      assert.strictEqual(createdDisruptions.length, 2);
      assert.notStrictEqual(createdDisruptions[0].dedupeKey, createdDisruptions[1].dedupeKey);
      assert.strictEqual(duffelListCalls, 0, 'No Duffel calls should be made');
    });
  });
});

