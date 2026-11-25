import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import {
  normalizeDestinationKey,
  getCoverForDestination,
  getCoverCacheStats,
  clearCoverCacheForTests,
} from '../src/services/coverImageService.js';
import { getPhotoForDestination } from '../src/services/pexelsService.js';
import itineraryRouter, { coverService } from '../src/routes/itinerary.js';
import Itinerary from '../src/models/Itinerary.js';
import User from '../src/models/User.js';
import graph from '../src/services/agents/graph.js';

let ipCounter = 1;
function dispatch(app, { method, url, headers = {}, body = null }) {
  const ip = `127.0.9.${ipCounter++}`;
  return new Promise((resolve) => {
    const raw = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8') : Buffer.alloc(0);
    const req = Readable.from(raw.length > 0 ? [raw] : []);
    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(raw.length),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };
    req.ip = ip;
    req.socket = { remoteAddress: ip };

    let statusCode = 200;
    const resHeaders = {};
    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => { delete resHeaders[k.toLowerCase()]; };
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resolve({ status: statusCode, body: data });
      res.emit('finish');
      return res;
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' } });
    });
  });
}

describe('Trip Cover Service, Pexels Rate Limit/Backoff & Itinerary Routes', () => {
  beforeEach(() => {
    clearCoverCacheForTests();
  });

  it('normalizes cache keys and serves 6 Kedarnath trips with 1 provider lookup', async () => {
    assert.equal(normalizeDestinationKey('  KedarNath  '), 'kedarnath');

    let calls = 0;
    const mockLookup = async (query) => {
      calls++;
      assert.equal(query, 'Kedarnath travel landscape');
      return {
        photoUrl: 'https://images.pexels.com/photos/999001/pexels-photo-999001.jpeg',
        thumbUrl: 'https://images.pexels.com/photos/999001/pexels-photo-999001.jpeg',
        photographerName: 'Himalaya Lens',
        photographerUrl: 'https://www.pexels.com/@himalaya',
        sourceUrl: 'https://www.pexels.com/photo/999001/',
      };
    };

    const variants = [
      'Kedarnath',
      ' kedarnath ',
      'KEDARNATH',
      'Kedarnath',
      '  Kedarnath',
      'kedarnath ',
    ];
    const results = await Promise.all(
      variants.map((v) =>
        getCoverForDestination(v, {
          lookupFn: mockLookup,
          curatedLookupFn: () => null,
        })
      )
    );

    assert.equal(calls, 1);
    const stats = getCoverCacheStats();
    assert.equal(stats.providerLookups, 1);
    assert.equal(stats.hits, 5);
    for (const r of results) {
      assert.equal(r.photographer, 'Himalaya Lens');
      assert.equal(r.source, 'pexels');
    }
  });

  it('returns null when lookup echoes query or returns no real photo and caches negative result', async () => {
    let calls = 0;
    const echoedLookup = async () => {
      calls++;
      return {
        photoUrl: 'https://images.pexels.com/photos/1/fake.jpeg',
        echoed: true,
      };
    };

    const first = await getCoverForDestination('UnknownPlace', {
      lookupFn: echoedLookup,
      curatedLookupFn: () => null,
      now: 1000,
    });
    assert.equal(first, null);

    // Cached miss prevents hammering for subsequent call within miss TTL
    const second = await getCoverForDestination('unknownplace', {
      lookupFn: echoedLookup,
      curatedLookupFn: () => null,
      now: 2000,
    });
    assert.equal(second, null);
    assert.equal(calls, 1);
  });

  it('handles HTTP 429 with bounded exponential backoff in getPhotoForDestination', async () => {
    const origKey = process.env.PEXELS_API_KEY;
    const origFetch = globalThis.fetch;
    process.env.PEXELS_API_KEY = 'test-pexels-key';

    let fetchCount = 0;
    const delays = [];

    globalThis.fetch = async () => {
      fetchCount++;
      if (fetchCount < 3) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: () => null },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          photos: [
            {
              url: 'https://www.pexels.com/photo/777/',
              photographer: 'Varkala Shots',
              photographer_url: 'https://www.pexels.com/@varkala',
              src: {
                large2x: 'https://images.pexels.com/photos/777/varkala.jpeg',
                medium: 'https://images.pexels.com/photos/777/varkala-m.jpeg',
              },
            },
          ],
        }),
      };
    };

    try {
      const photo = await getPhotoForDestination('Varkala travel landscape', {
        fallback: false,
        maxRetries: 2,
        baseBackoffMs: 50,
        sleepFn: async (ms) => { delays.push(ms); },
      });

      assert.equal(fetchCount, 3);
      assert.deepEqual(delays, [50, 100]);
      assert.equal(photo.photographerName, 'Varkala Shots');
      assert.equal(photo.sourceUrl, 'https://www.pexels.com/photo/777/');
    } finally {
      globalThis.fetch = origFetch;
      if (origKey === undefined) delete process.env.PEXELS_API_KEY;
      else process.env.PEXELS_API_KEY = origKey;
    }
  });

  it('serves curated destinations (Goa) with 0 external fetch calls and valid sourceUrl', async () => {
    clearCoverCacheForTests();
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls++;
      throw new Error('Should not hit network for curated Goa');
    };
    try {
      const cover = await getCoverForDestination('Goa');
      assert.equal(fetchCalls, 0);
      assert.ok(cover?.url?.startsWith('https://images.pexels.com/'));
      assert.ok(cover?.photographer);
      assert.ok(cover?.sourceUrl?.startsWith('https://www.pexels.com/photo/'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  describe('Route integration: /itinerary/generate & /itineraries/:id/cover', () => {
    let app;
    let userAId;
    let userBId;
    let tokenA;
    let tokenB;
    let origGraphInvoke;
    let origFindOne;
    let origCreate;
    let origCoverFn;
    let origUserFindById;

    beforeEach(() => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-cover';
      userAId = new mongoose.Types.ObjectId();
      userBId = new mongoose.Types.ObjectId();
      tokenA = jwt.sign({ userId: userAId.toString() }, process.env.JWT_SECRET);
      tokenB = jwt.sign({ userId: userBId.toString() }, process.env.JWT_SECRET);

      app = express();
      app.use(express.json());
      app.use(['/itinerary', '/itineraries'], itineraryRouter);

      origGraphInvoke = graph.invoke;
      origFindOne = Itinerary.findOne;
      origCreate = Itinerary.create;
      origCoverFn = coverService.getCoverForDestination;
      origUserFindById = User.findById;

      User.findById = (id) => ({
        select: () => ({
          lean: async () => ({ _id: id }),
        }),
      });
    });

    afterEach(() => {
      graph.invoke = origGraphInvoke;
      Itinerary.findOne = origFindOne;
      Itinerary.create = origCreate;
      coverService.getCoverForDestination = origCoverFn;
      User.findById = origUserFindById;
    });

    it('POST /itinerary/generate attaches coverImage returned by coverService', async () => {
      graph.invoke = async () => ({
        destination: 'Goa',
        startDate: '2027-02-10',
        endDate: '2027-02-13',
        budgetTier: 'mid',
        interests: ['beach'],
        itinerary: [],
      });
      Itinerary.findOne = async () => null;
      const stubCover = {
        url: 'https://images.pexels.com/photos/100/goa.jpeg',
        thumbUrl: 'https://images.pexels.com/photos/100/goa.jpeg',
        photographer: 'Goa Shooter',
        photographerUrl: 'https://www.pexels.com/@goa',
        sourceUrl: 'https://www.pexels.com/photo/100/',
        source: 'pexels',
        fetchedAt: new Date(),
      };
      coverService.getCoverForDestination = async () => stubCover;

      const createdId = new mongoose.Types.ObjectId();
      let createdDoc = null;
      Itinerary.create = async (payload) => {
        createdDoc = payload;
        return { _id: createdId, ...payload };
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/generate',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: { rawRequest: '3 days in Goa' },
      });

      assert.equal(res.status, 200);
      assert.equal(String(res.body.itineraryId), createdId.toString());
      assert.equal(res.body.coverImage?.photographer, 'Goa Shooter');
      assert.equal(createdDoc?.coverImage?.url, stubCover.url);
    });

    it('POST /itinerary/generate succeeds even when cover lookup throws', async () => {
      graph.invoke = async () => ({
        destination: 'Varkala',
        startDate: '2027-01-10',
        endDate: '2027-01-13',
        budgetTier: 'mid',
        interests: ['beach'],
        itinerary: [],
      });
      Itinerary.findOne = async () => null; // duplicate check
      coverService.getCoverForDestination = async () => {
        throw new Error('Simulated Pexels outage');
      };

      const createdId = new mongoose.Types.ObjectId();
      let createdDoc = null;
      Itinerary.create = async (payload) => {
        createdDoc = payload;
        return { _id: createdId, ...payload };
      };

      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/generate',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: { rawRequest: '3 days in Varkala' },
      });

      assert.equal(res.status, 200);
      assert.equal(String(res.body.itineraryId), createdId.toString());
      assert.equal(res.body.coverImage, null);
      assert.ok(createdDoc);
    });

    it('POST /itineraries/:id/cover enforces ownership (User B gets 404) and persists missing cover for User A', async () => {
      const tripId = new mongoose.Types.ObjectId();
      let savedCount = 0;
      const tripDoc = {
        _id: tripId,
        userId: userAId,
        destination: 'Kedarnath',
        coverImage: null,
        save: async () => { savedCount++; },
      };

      Itinerary.findOne = async (query) => {
        if (
          String(query._id) === tripId.toString() &&
          String(query.userId) === userAId.toString()
        ) {
          return tripDoc;
        }
        return null;
      };

      let lookupCalls = 0;
      coverService.getCoverForDestination = async () => {
        lookupCalls++;
        return {
          url: 'https://images.pexels.com/photos/555/kedarnath.jpeg',
          thumbUrl: 'https://images.pexels.com/photos/555/kedarnath.jpeg',
          photographer: 'Mountain Eye',
          photographerUrl: 'https://www.pexels.com/@mountain',
          sourceUrl: 'https://www.pexels.com/photo/555/',
          source: 'pexels',
          fetchedAt: new Date(),
        };
      };

      // User B rejected with 404
      const resB = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${tripId.toString()}/cover`,
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 404);
      assert.equal(lookupCalls, 0);

      // User A resolves & persists cover
      const resA1 = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${tripId.toString()}/cover`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resA1.status, 200);
      assert.equal(resA1.body.coverImage.photographer, 'Mountain Eye');
      assert.equal(savedCount, 1);
      assert.equal(lookupCalls, 1);

      // Subsequent call returns already-saved cover without calling lookup again
      const resA2 = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${tripId.toString()}/cover`,
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resA2.status, 200);
      assert.equal(resA2.body.cached, true);
      assert.equal(lookupCalls, 1);
    });
  });
});
