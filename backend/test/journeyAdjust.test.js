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
import {
  haversineKm,
  computeBaseHash,
  createRng,
  slowPace,
  reduceTransit,
  surpriseMe,
} from '../src/services/journeyAdjust.js';

describe('JourneyAdjust Pure Rules Engine', () => {
  describe('haversineKm & computeBaseHash', () => {
    it('calculates haversine distance accurately', () => {
      // Distance between Panaji, Goa (15.4989, 73.8278) and Margao, Goa (15.2832, 73.9862) is ~29-30 km
      const dist = haversineKm(15.4989, 73.8278, 15.2832, 73.9862);
      assert.ok(dist >= 28 && dist <= 31, `Expected dist ~29.5km, got ${dist}`);
    });

    it('returns 0 for identical or invalid coordinates', () => {
      assert.equal(haversineKm(15.5, 73.8, 15.5, 73.8), 0);
      assert.equal(haversineKm(null, 73.8, 15.5, 73.8), 0);
    });

    it('computes deterministic baseHash and changes upon modification', () => {
      const itin = {
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'a1', title: 'Fort Aguada', suggestedTime: 'Morning', kind: 'place', done: false },
              { id: 'a2', title: 'Lunch', suggestedTime: 'Afternoon', kind: 'meal', done: false },
            ],
          },
        ],
      };

      const hash1 = computeBaseHash(itin);
      const hash2 = computeBaseHash(itin);
      assert.equal(hash1, hash2, 'baseHash must be deterministic');

      // Modifying done flag alters hash
      const modifiedItin = {
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'a1', title: 'Fort Aguada', suggestedTime: 'Morning', kind: 'place', done: true },
              { id: 'a2', title: 'Lunch', suggestedTime: 'Afternoon', kind: 'meal', done: false },
            ],
          },
        ],
      };
      const hash3 = computeBaseHash(modifiedItin);
      assert.notEqual(hash1, hash3, 'Marking activity done must alter baseHash');
    });
  });

  describe('Rule 1: slow_pace', () => {
    it('caps place activities at 2 per day, keeping curated before OSM, then earlier in the day', () => {
      const days = [
        {
          dayNumber: 1,
          activities: [
            { id: 'osm-1', title: 'OSM Viewpoint', kind: 'place', source: 'osm', placeRef: 'osm-1' },
            { id: 'meal-1', title: 'Local Lunch', kind: 'meal' },
            { id: '6523abcde123456789012345', title: 'Curated Temple', kind: 'place', source: 'curated', placeRef: '6523abcde123456789012345' },
            { id: 'osm-2', title: 'OSM Beach', kind: 'place', source: 'osm', placeRef: 'osm-2' },
          ],
        },
      ];

      const result = slowPace(days);
      assert.equal(result.newPace, 'relaxed');
      const placesRemaining = result.days[0].activities.filter((a) => a.kind === 'place');
      assert.equal(placesRemaining.length, 2, 'Must cap at 2 place activities');

      // Curated Temple must be kept
      assert.ok(placesRemaining.some((p) => p.title === 'Curated Temple'));
      // Between the 2 OSM places, the earlier one (OSM Viewpoint) must be kept
      assert.ok(placesRemaining.some((p) => p.title === 'OSM Viewpoint'));
      // OSM Beach was removed
      assert.ok(!placesRemaining.some((p) => p.title === 'OSM Beach'));

      // Meal was untouched
      const meals = result.days[0].activities.filter((a) => a.kind === 'meal');
      assert.equal(meals.length, 1);
      assert.equal(meals[0].title, 'Local Lunch');

      // Change record
      assert.equal(result.changes.length, 1);
      assert.equal(result.changes[0].type, 'removed');
      assert.equal(result.changes[0].before, 'OSM Beach');
      assert.equal(result.changes[0].reason, 'To slow the pace');
    });

    it('never removes done items even if > 2 are already marked done', () => {
      const days = [
        {
          dayNumber: 1,
          activities: [
            { id: 'p1', title: 'Done Place 1', kind: 'place', done: true },
            { id: 'p2', title: 'Done Place 2', kind: 'place', done: true },
            { id: 'p3', title: 'Done Place 3', kind: 'place', status: 'booked' },
            { id: 'p4', title: 'Undone Place 4', kind: 'place', done: false },
          ],
        },
      ];

      const result = slowPace(days);
      const dayPlaces = result.days[0].activities.filter((a) => a.kind === 'place');
      // All 3 done places are preserved; only undone place 4 was removed
      assert.equal(dayPlaces.length, 3);
      assert.ok(dayPlaces.some((p) => p.title === 'Done Place 1'));
      assert.ok(dayPlaces.some((p) => p.title === 'Done Place 2'));
      assert.ok(dayPlaces.some((p) => p.title === 'Done Place 3'));
      assert.ok(!dayPlaces.some((p) => p.title === 'Undone Place 4'));
    });
  });

  describe('Rule 2: reduce_transit', () => {
    it('on a 4-stop line returns a shorter-or-equal straight-line total than the input (property check with haversine)', () => {
      // Collinear points along latitude 15.0:
      // A at lon 73.0 (start)
      // B at lon 73.3 (far)
      // C at lon 73.1 (near)
      // D at lon 73.2 (mid)
      // Input order A -> B -> C -> D causes zigzagging:
      // A(73.0) -> B(73.3) [0.3 deg] -> C(73.1) [0.2 deg] -> D(73.2) [0.1 deg] = 0.6 deg total
      // Nearest-neighbour order starting at A: A -> C -> D -> B = 0.3 deg total
      const days = [
        {
          dayNumber: 1,
          activities: [
            {
              id: 'a',
              title: 'Stop A',
              kind: 'place',
              timeOfDay: 'Morning',
              suggestedTime: 'Morning',
              location: { lat: 15.0, lon: 73.0 },
            },
            {
              id: 'b',
              title: 'Stop B',
              kind: 'place',
              timeOfDay: 'Afternoon',
              suggestedTime: 'Afternoon',
              location: { lat: 15.0, lon: 73.3 },
            },
            {
              id: 'c',
              title: 'Stop C',
              kind: 'place',
              timeOfDay: 'Evening',
              suggestedTime: 'Evening',
              location: { lat: 15.0, lon: 73.1 },
            },
            {
              id: 'd',
              title: 'Stop D',
              kind: 'place',
              timeOfDay: 'Night',
              suggestedTime: 'Night',
              location: { lat: 15.0, lon: 73.2 },
            },
          ],
        },
      ];

      const result = reduceTransit(days);
      assert.ok(result.metrics.afterKm <= result.metrics.beforeKm, 'afterKm must be <= beforeKm');
      assert.ok(result.metrics.afterKm < result.metrics.beforeKm, 'Zigzagging must be reduced');

      // The new sequence of titles should be Stop A, Stop C, Stop D, Stop B
      const orderedTitles = result.days[0].activities.map((a) => a.title);
      assert.deepEqual(orderedTitles, ['Stop A', 'Stop C', 'Stop D', 'Stop B']);

      // Time slots must stay in original sequence
      const slots = result.days[0].activities.map((a) => a.timeOfDay);
      assert.deepEqual(slots, ['Morning', 'Afternoon', 'Evening', 'Night']);
    });

    it('returns 422 if fewer than 2 located places exist on every day', () => {
      const days = [
        {
          dayNumber: 1,
          activities: [
            { id: '1', title: 'Place 1', kind: 'place', location: { lat: 15.0, lon: 73.0 } },
            { id: '2', title: 'No Coords Place', kind: 'place', location: null },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { id: '3', title: 'Lunch', kind: 'meal' },
          ],
        },
      ];

      assert.throws(
        () => reduceTransit(days),
        (err) => err.statusCode === 422 && err.message === 'Needs places with saved locations'
      );
    });
  });

  describe('Rule 3: surprise_me', () => {
    const mockCandidates = [
      { id: 'c1', name: 'Aguada Fort', lat: 15.492, lon: 73.773, type: 'Historic Fort' },
      { id: 'c2', name: 'Chapora Fort', lat: 15.606, lon: 73.738, type: 'Historic Fort', note: 'Scenic ocean views' },
      { id: 'c3', name: 'Dudhsagar Waterfalls', lat: 15.314, lon: 74.314, type: 'Waterfall' },
      { id: 'c4', name: 'Anjuna Flea Market', lat: 15.580, lon: 73.743, type: 'Market' },
    ];

    it('adds ONE unused candidate to the day with the fewest place activities, and is stable for a given seed', () => {
      const days = [
        {
          dayNumber: 1,
          activities: [
            { id: 'p1', title: 'Aguada Fort', kind: 'place', placeRef: 'c1', location: { lat: 15.492, lon: 73.773 } },
            { id: 'p2', title: 'Baga Beach', kind: 'place', location: { lat: 15.555, lon: 73.751 } },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            // Day 2 has 0 place activities (only a meal)
            { id: 'm1', title: 'Breakfast', kind: 'meal', timeOfDay: 'Morning' },
          ],
        },
      ];

      const seed = 42;
      const res1 = surpriseMe(days, mockCandidates, seed);
      const res2 = surpriseMe(days, mockCandidates, seed);

      // Stability with seed
      assert.equal(res1.seed, res2.seed);
      assert.deepEqual(res1.changes, res2.changes);

      // Target day must be Day 2 (fewest place activities)
      assert.equal(res1.changes[0].day, 2);
      assert.equal(res1.changes[0].type, 'added');
      assert.equal(res1.changes[0].reason, 'Surprise pick');

      // Candidate must be unused (c2, c3, or c4, never c1 Aguada Fort which is already in Day 1)
      const addedName = res1.changes[0].after;
      assert.notEqual(addedName, 'Aguada Fort');
      assert.ok(['Chapora Fort', 'Dudhsagar Waterfalls', 'Anjuna Flea Market'].includes(addedName));

      // Day 2 now has the added place activity
      const day2Places = res1.days[1].activities.filter((a) => a.kind === 'place');
      assert.equal(day2Places.length, 1);
      assert.equal(day2Places[0].title, addedName);
      assert.equal(day2Places[0].note, 'Surprise pick');
      assert.equal(day2Places[0].cost, 0, 'No costs invented');
    });

    it('returns 422 if no unused candidate exists', () => {
      const days = [
        {
          dayNumber: 1,
          activities: [
            { id: 'p1', title: 'Aguada Fort', kind: 'place', placeRef: 'c1' },
            { id: 'p2', title: 'Chapora Fort', kind: 'place', placeRef: 'c2' },
          ],
        },
      ];
      const onlyUsedCandidates = [
        { id: 'c1', name: 'Aguada Fort', lat: 15.492, lon: 73.773 },
        { id: 'c2', name: 'Chapora Fort', lat: 15.606, lon: 73.738 },
      ];

      assert.throws(
        () => surpriseMe(days, onlyUsedCandidates, 123),
        (err) => err.statusCode === 422 && err.message === 'No more verified places to suggest'
      );
    });
  });

  describe('Route Endpoints: /itineraries/:id/adjust/preview & apply', () => {
    const jwtSecret = 'test_jwt_secret_adjust';
    const testUserId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    let validToken;
    let otherUserToken;
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

    let origUserFindById;
    let origItineraryFindOne;

    beforeEach(() => {
      process.env.JWT_SECRET = jwtSecret;
      validToken = jwt.sign({ userId: testUserId.toString() }, jwtSecret);
      otherUserToken = jwt.sign({ userId: otherUserId.toString() }, jwtSecret);

      app = express();
      app.use(express.json());
      app.use(['/itinerary', '/itineraries'], itineraryRouter);

      origUserFindById = User.findById;
      origItineraryFindOne = Itinerary.findOne;

      // Mock user authentication
      User.findById = (id) => ({
        select: () => ({
          lean: async () => ({ _id: id }),
        }),
      });
    });

    it('rejects apply with 409 if baseHash is stale (concurrent modification)', async () => {
      const itinId = new mongoose.Types.ObjectId();
      const mockItin = {
        _id: itinId,
        userId: testUserId,
        destination: 'Goa',
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'a1', title: 'Fort Aguada', suggestedTime: 'Morning', kind: 'place' },
            ],
          },
        ],
        editHistory: [],
      };

      Itinerary.findOne = ({ _id, userId }) => {
        if (_id.toString() === itinId.toString() && userId.toString() === testUserId.toString()) {
          return Promise.resolve(mockItin);
        }
        return Promise.resolve(null);
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${itinId}/adjust/apply`,
        headers: { authorization: `Bearer ${validToken}` },
        body: {
          action: 'slow_pace',
          baseHash: 'stale_hash_12345',
        },
      });

      assert.equal(res.status, 409);
      assert.ok(res.body.error.includes('Your trip changed, preview again'));
    });

    it('rejects apply with 404/403 when called with a different user token', async () => {
      const itinId = new mongoose.Types.ObjectId();
      const mockItin = {
        _id: itinId,
        userId: testUserId, // Belongs to testUserId, NOT otherUserId
        destination: 'Goa',
        days: [
          {
            dayNumber: 1,
            activities: [{ id: 'a1', title: 'Fort Aguada', kind: 'place' }],
          },
        ],
      };

      Itinerary.findOne = ({ _id, userId }) => {
        if (_id.toString() === itinId.toString() && userId.toString() === testUserId.toString()) {
          return Promise.resolve(mockItin);
        }
        // Different user does not find the document
        return Promise.resolve(null);
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${itinId}/adjust/apply`,
        headers: { authorization: `Bearer ${otherUserToken}` },
        body: {
          action: 'slow_pace',
          baseHash: computeBaseHash(mockItin),
        },
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Itinerary not found');
    });

    it('preview endpoint returns baseHash, seed, changes, summary', async () => {
      const itinId = new mongoose.Types.ObjectId();
      const mockItin = {
        _id: itinId,
        userId: testUserId,
        destination: 'Goa',
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'a1', title: 'Fort Aguada', kind: 'place' },
              { id: 'a2', title: 'Baga Beach', kind: 'place' },
              { id: 'a3', title: 'Anjuna Flea Market', kind: 'place' },
            ],
          },
        ],
      };

      Itinerary.findOne = ({ _id, userId }) => {
        if (_id.toString() === itinId.toString() && userId.toString() === testUserId.toString()) {
          return Promise.resolve(mockItin);
        }
        return Promise.resolve(null);
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${itinId}/adjust/preview`,
        headers: { authorization: `Bearer ${validToken}` },
        body: {
          action: 'slow_pace',
        },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.baseHash);
      assert.equal(res.body.changes.length, 1);
      assert.equal(res.body.changes[0].type, 'removed');
      assert.ok(res.body.summary);
    });
  });
});
