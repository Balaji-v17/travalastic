import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import itineraryRouter from '../src/routes/itinerary.js';
import User from '../src/models/User.js';
import Itinerary from '../src/models/Itinerary.js';
import Booking from '../src/models/Booking.js';
import { computeBaseHash } from '../src/services/journeyAdjust.js';

describe('JourneyAdjust End-to-End & Route Verification', () => {
  const jwtSecret = 'test_jwt_secret_adjust_e2e';
  const testUserId = new mongoose.Types.ObjectId();
  let validToken;
  let app;

  function dispatch(appInstance, { method, url, headers = {}, body = '' }) {
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
      req.socket = { remoteAddress: '127.0.0.1' };
      req.ip = '127.0.0.1';

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

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    validToken = jwt.sign({ userId: testUserId.toString() }, jwtSecret);

    app = express();
    app.use(express.json());
    app.use(['/itinerary', '/itineraries'], itineraryRouter);

    Booking.countDocuments = () => Promise.resolve(0);

    User.findById = (id) => ({
      select: () => ({
        lean: async () => ({ _id: id }),
      }),
    });
  });

  it('Verifies Goa itinerary: Slow pace preview lists removals; Apply caps at 2 places/day; Undo restores earlier plan', async () => {
    const itinId = new mongoose.Types.ObjectId();
    const originalDays = [
      {
        dayNumber: 1,
        activities: [
          { id: 'p1', title: 'Fort Aguada', kind: 'place', location: { lat: 15.492, lon: 73.773 }, source: 'curated' },
          { id: 'p2', title: 'Sinquerim Beach', kind: 'place', location: { lat: 15.498, lon: 73.769 }, source: 'osm' },
          { id: 'p3', title: 'Candolim Beach', kind: 'place', location: { lat: 15.517, lon: 73.763 }, source: 'osm' },
        ],
      },
    ];

    let currentItinDoc = {
      _id: itinId,
      userId: testUserId,
      destination: 'Goa',
      pace: 'balanced',
      days: JSON.parse(JSON.stringify(originalDays)),
      editHistory: [],
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          destination: this.destination,
          pace: this.pace,
          days: this.days,
          editHistory: this.editHistory,
        };
      },
      save: async function() { return this; },
    };

    Itinerary.findOne = () => Promise.resolve(currentItinDoc);
    Itinerary.findOneAndUpdate = (query, update) => {
      if (update.$set?.days) {
        currentItinDoc.days = update.$set.days;
      }
      if (update.$set?.pace) {
        currentItinDoc.pace = update.$set.pace;
      }
      if (update.$push?.editHistory) {
        const entry = update.$push.editHistory.$each[0];
        currentItinDoc.editHistory.push(entry);
      }
      if (update.$pop?.editHistory) {
        currentItinDoc.editHistory.pop();
      }
      return Promise.resolve(currentItinDoc);
    };
    Itinerary.updateOne = (query, update) => {
      if (update.$set?.pace) {
        currentItinDoc.pace = update.$set.pace;
      }
      return Promise.resolve({ modifiedCount: 1 });
    };

    // 1. Preview Slow Pace
    const prevRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/preview`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { action: 'slow_pace' },
    });

    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.body.changes.length, 1);
    assert.equal(prevRes.body.changes[0].type, 'removed');
    assert.equal(prevRes.body.changes[0].before, 'Candolim Beach');
    assert.ok(prevRes.body.baseHash);

    // 2. Apply Slow Pace
    const applyRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/apply`,
      headers: { authorization: `Bearer ${validToken}` },
      body: {
        action: 'slow_pace',
        baseHash: prevRes.body.baseHash,
      },
    });

    assert.equal(applyRes.status, 200);
    assert.equal(applyRes.body.pace, 'relaxed');
    const day1Places = applyRes.body.itinerary[0].activities.filter((a) => a.kind === 'place');
    assert.equal(day1Places.length, 2, 'Must have at most 2 places per day');
    assert.ok(day1Places.some((p) => p.title === 'Fort Aguada'));
    assert.ok(day1Places.some((p) => p.title === 'Sinquerim Beach'));

    // 3. Undo restores the earlier plan exactly
    const undoRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/undo`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { expectedEditId: applyRes.body.editId },
    });

    assert.equal(undoRes.status, 200);
    const restoredPlaces = undoRes.body.itinerary[0].activities.filter((a) => a.kind === 'place');
    assert.equal(restoredPlaces.length, 3, 'Undo must restore all 3 original places');
    assert.equal(undoRes.body.pace, 'balanced', 'Undo must restore previous pace');
  });

  it('Verifies Reduce transit: preview shows km before/after; apply reorders without adding or removing places', async () => {
    const itinId = new mongoose.Types.ObjectId();
    const originalDays = [
      {
        dayNumber: 1,
        activities: [
          { id: 'p1', title: 'Stop 1 (Origin)', kind: 'place', timeOfDay: 'Morning', location: { lat: 15.0, lon: 73.0 } },
          { id: 'p2', title: 'Stop 2 (Far)', kind: 'place', timeOfDay: 'Afternoon', location: { lat: 15.0, lon: 73.3 } },
          { id: 'p3', title: 'Stop 3 (Near)', kind: 'place', timeOfDay: 'Evening', location: { lat: 15.0, lon: 73.1 } },
        ],
      },
    ];

    let currentItinDoc = {
      _id: itinId,
      userId: testUserId,
      destination: 'Goa',
      pace: 'balanced',
      days: JSON.parse(JSON.stringify(originalDays)),
      editHistory: [],
      toObject() { return { ...this }; },
    };

    Itinerary.findOne = () => Promise.resolve(currentItinDoc);
    Itinerary.findOneAndUpdate = (query, update) => {
      if (update.$set?.days) currentItinDoc.days = update.$set.days;
      return Promise.resolve(currentItinDoc);
    };

    const prevRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/preview`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { action: 'reduce_transit' },
    });

    assert.equal(prevRes.status, 200);
    assert.ok(prevRes.body.metrics);
    assert.ok(prevRes.body.metrics.beforeKm > prevRes.body.metrics.afterKm);
    assert.equal(prevRes.body.metrics.label, 'straight-line distance, not driving time');

    const applyRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/apply`,
      headers: { authorization: `Bearer ${validToken}` },
      body: {
        action: 'reduce_transit',
        baseHash: prevRes.body.baseHash,
      },
    });

    assert.equal(applyRes.status, 200);
    assert.equal(applyRes.body.itinerary[0].activities.length, 3, 'Must not add or remove places');
    const reorderedTitles = applyRes.body.itinerary[0].activities.map((a) => a.title);
    assert.deepEqual(reorderedTitles, ['Stop 1 (Origin)', 'Stop 3 (Near)', 'Stop 2 (Far)']);
  });

  it('Verifies done activity protection: marked done item is never removed during slow_pace', async () => {
    const itinId = new mongoose.Types.ObjectId();
    const daysWithDone = [
      {
        dayNumber: 1,
        activities: [
          { id: 'p1', title: 'First Undone', kind: 'place', done: false, source: 'osm' },
          { id: 'p2', title: 'Second Undone', kind: 'place', done: false, source: 'osm' },
          { id: 'p3', title: 'Third Done in Today View', kind: 'place', done: true, source: 'osm' },
        ],
      },
    ];

    let currentItinDoc = {
      _id: itinId,
      userId: testUserId,
      destination: 'Goa',
      days: JSON.parse(JSON.stringify(daysWithDone)),
      editHistory: [],
      toObject() { return { ...this }; },
    };

    Itinerary.findOne = () => Promise.resolve(currentItinDoc);
    Itinerary.findOneAndUpdate = (query, update) => {
      if (update.$set?.days) currentItinDoc.days = update.$set.days;
      return Promise.resolve(currentItinDoc);
    };

    const prevRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/preview`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { action: 'slow_pace' },
    });

    assert.equal(prevRes.status, 200);
    // The removed item must be Second Undone (or First Undone), NEVER Third Done
    const removedName = prevRes.body.changes[0].before;
    assert.notEqual(removedName, 'Third Done in Today View');

    const applyRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/apply`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { action: 'slow_pace', baseHash: prevRes.body.baseHash },
    });

    assert.equal(applyRes.status, 200);
    const remaining = applyRes.body.itinerary[0].activities;
    assert.ok(remaining.some((a) => a.title === 'Third Done in Today View' && a.done === true));
  });

  it('Verifies concurrent modification detection: apply with stale baseHash returns 409 and UI prompt', async () => {
    const itinId = new mongoose.Types.ObjectId();
    const mockItin = {
      _id: itinId,
      userId: testUserId,
      destination: 'Goa',
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'p1', title: 'Fort Aguada', kind: 'place' },
            { id: 'p2', title: 'Baga Beach', kind: 'place' },
          ],
        },
      ],
      editHistory: [],
      toObject() { return { ...this }; },
    };

    Itinerary.findOne = () => Promise.resolve(mockItin);

    // Initial preview
    const prevRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/preview`,
      headers: { authorization: `Bearer ${validToken}` },
      body: { action: 'slow_pace' },
    });
    const originalHash = prevRes.body.baseHash;

    // Simulate trip modified in another tab
    mockItin.days[0].activities.push({ id: 'p3', title: 'Anjuna Flea Market', kind: 'place' });

    // Apply with the old preview hash
    const applyRes = await dispatch(app, {
      method: 'POST',
      url: `/itineraries/${itinId}/adjust/apply`,
      headers: { authorization: `Bearer ${validToken}` },
      body: {
        action: 'slow_pace',
        baseHash: originalHash,
      },
    });

    assert.equal(applyRes.status, 409);
    assert.equal(applyRes.body.error, 'Your trip changed, preview again');
  });
});
