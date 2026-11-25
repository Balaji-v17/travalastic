import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

import flightsRouter, { MAX_FLIGHT_PASSENGERS } from '../src/routes/flights.js';
import hotelsRouter, { MAX_HOTEL_GUESTS, MAX_HOTEL_ROOMS } from '../src/routes/hotels.js';
import CuratedHotel from '../src/models/CuratedHotel.js';

let ipCounter = 1;
function dispatch(app, { method, url, headers = {}, body = null }) {
  const ip = `127.0.8.${ipCounter++}`;
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
    let resBody = '';

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => { delete resHeaders[k.toLowerCase()]; };
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resBody = JSON.stringify(data);
      resolve({ status: statusCode, body: data });
      res.emit('finish');
      return res;
    };
    res.send = (data) => {
      resBody = data;
      let parsed = data;
      try { parsed = JSON.parse(data); } catch {}
      resolve({ status: statusCode, body: parsed });
      res.emit('finish');
      return res;
    };
    res.end = (data) => {
      if (data) resBody += data;
      let parsed = resBody;
      try { parsed = JSON.parse(resBody); } catch {}
      resolve({ status: statusCode, body: parsed });
      res.emit('finish');
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' } });
    });
  });
}

describe('Flight & Hotel Count Validation Limits', () => {
  let app;
  let origFind;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/flights', flightsRouter);
    app.use('/hotels', hotelsRouter);
    origFind = CuratedHotel.find;
    CuratedHotel.find = () => ({ lean: async () => [] });
  });

  afterEach(() => {
    CuratedHotel.find = origFind;
  });

  it('rejects over-cap or non-positive passenger counts on POST /flights/search with 400', async () => {
    assert.equal(MAX_FLIGHT_PASSENGERS, 9);

    for (const invalidCount of [0, -1, 10, 99]) {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/flights/search',
        body: {
          origin: 'DEL',
          destination: 'BOM',
          departureDate: '2099-12-15',
          passengers: invalidCount,
        },
      });
      assert.equal(res.status, 400, `Expected 400 for passengers=${invalidCount}`);
    }
  });

  it('rejects >9 passengers on POST /flights/book with 400', async () => {
    const passengers = Array.from({ length: 10 }, (_, idx) => ({
      givenName: `Traveler${idx}`,
      familyName: 'Test',
      dateOfBirth: '1990-01-01',
    }));

    const res = await dispatch(app, {
      method: 'POST',
      url: '/flights/book',
      body: {
        offerId: 'off_test_123',
        passengers,
      },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /9 passengers/);
  });

  it('rejects invalid guests/rooms on GET /hotels/search and appends group_adults & no_rooms when valid', async () => {
    assert.equal(MAX_HOTEL_GUESTS, 9);
    assert.equal(MAX_HOTEL_ROOMS, 5);

    const badGuests = await dispatch(app, {
      method: 'GET',
      url: '/hotels/search?destination=Tokyo&guests=10&rooms=1',
    });
    assert.equal(badGuests.status, 400);

    const badRooms = await dispatch(app, {
      method: 'GET',
      url: '/hotels/search?destination=Tokyo&guests=5&rooms=6',
    });
    assert.equal(badRooms.status, 400);

    const roomsExceedGuests = await dispatch(app, {
      method: 'GET',
      url: '/hotels/search?destination=Tokyo&guests=2&rooms=3',
    });
    assert.equal(roomsExceedGuests.status, 400);

    const okRes = await dispatch(app, {
      method: 'GET',
      url: '/hotels/search?destination=Tokyo&checkinDate=2026-12-01&checkoutDate=2026-12-05&guests=9&rooms=3',
    });
    assert.equal(okRes.status, 200);
    assert.match(okRes.body.bookingComSearchUrl, /group_adults=9/);
    assert.match(okRes.body.bookingComSearchUrl, /no_rooms=3/);
  });
});

