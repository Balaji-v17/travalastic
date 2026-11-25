import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

import destinationsRouter, {
  destinationResponseCache,
} from '../src/routes/destinations.js';
import TouristPlace from '../src/models/TouristPlace.js';

function dispatch(app, { method, url }) {
  return new Promise((resolve) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = url;
    req.headers = {};
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
      resolve({ status: statusCode, body: data });
      res.emit('finish');
      return res;
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' } });
    });
  });
}

describe('GET /destinations/search fallback=0 behavior', () => {
  let app;
  let origFind;
  let origAggregate;
  let origFetch;
  let fetchCalls;

  beforeEach(() => {
    destinationResponseCache.clear();
    fetchCalls = [];
    app = express();
    app.use('/destinations', destinationsRouter);

    origFind = TouristPlace.find;
    origAggregate = TouristPlace.aggregate;
    origFetch = globalThis.fetch;

    TouristPlace.find = () => ({
      select: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      }),
    });
    TouristPlace.aggregate = async () => [];

    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({ url: String(url), opts });
      if (String(url).includes('nominatim.openstreetmap.org')) {
        return {
          ok: true,
          json: async () => [
            {
              name: 'Atlantis',
              display_name: 'Atlantis, OpenStreetMap',
              lat: '15.49',
              lon: '73.82',
            },
          ],
        };
      }
      return { ok: true, json: async () => ({ elements: [] }) };
    };
  });

  afterEach(() => {
    TouristPlace.find = origFind;
    TouristPlace.aggregate = origAggregate;
    globalThis.fetch = origFetch;
    destinationResponseCache.clear();
  });

  it('never calls Nominatim or Overpass when fallback=0', async () => {
    const res = await dispatch(app, {
      method: 'GET',
      url: '/destinations/search?q=Goa&fallback=0',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.results, []);
    assert.equal(res.body.externalFallbackUsed, false);
    assert.equal(fetchCalls.length, 0);
  });

  it('calls Nominatim fallback only when fallback is enabled and returns externalFallbackUsed=true', async () => {
    // Wait: fallback=0 first must NOT poison subsequent fallback=1 call
    await dispatch(app, {
      method: 'GET',
      url: '/destinations/search?q=TestPlaceZero&fallback=0',
    });
    assert.equal(fetchCalls.length, 0);

    const res = await dispatch(app, {
      method: 'GET',
      url: '/destinations/search?q=TestPlaceZero&fallback=1',
    });
    assert.equal(res.status, 200);
    assert.ok(fetchCalls.some((c) => c.url.includes('nominatim.openstreetmap.org')));
    assert.equal(res.body.externalFallbackUsed, true);
    assert.ok(res.body.results.length > 0);
  });
});

