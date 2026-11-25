import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import bookingsRouter from '../src/routes/bookings.js';
import Booking from '../src/models/Booking.js';
import TripBooking from '../src/models/TripBooking.js';
import Itinerary from '../src/models/Itinerary.js';
import User from '../src/models/User.js';
import { validateTripBookingInput, buildMergedBookingsResponse } from '../src/services/tripBookingService.js';
import { tripHasBooking as backendTripHasBooking, tripStatus as backendTripStatus } from '../src/services/tripStatus.js';
import { tripHasBooking as webTripHasBooking, tripStatus as webTripStatus } from '../../web/src/lib/tripStatus.ts';
import { countUserData, deleteUserAndData } from '../src/services/accountDeletion.js';
import Conversation from '../src/models/Conversation.js';
import Expense from '../src/models/Expense.js';
import PackingTemplate from '../src/models/PackingTemplate.js';
import Disruption from '../src/models/Disruption.js';

let ipCounter = 1;
function dispatch(app, { method, url, headers = {}, body = null }) {
  const ip = `127.0.5.${ipCounter++}`;
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

    app.handle(req, res);
  });
}

describe('TripBooking Validation, Ownership, Merged List, Status Parity & Deletion', () => {
  describe('validateTripBookingInput validation table', () => {
    const baseValid = {
      kind: 'hotel',
      title: 'Sea Breeze Villa',
      provider: 'Booking.com',
      startAt: '2026-12-10',
      endAt: '2026-12-14',
      reference: 'BK-9941',
      amount: '12500.50',
      currency: 'inr',
      status: 'booked',
      notes: 'Sea view room',
    };

    it('accepts valid hotel payload and normalizes currency', () => {
      const res = validateTripBookingInput(baseValid);
      assert.equal(res.ok, true);
      assert.equal(res.data.amount, '12500.50');
      assert.equal(typeof res.data.amount, 'string');
      assert.equal(res.data.currency, 'INR');
    });

    it('rejects bad dates, timezone offsets, and end before start', () => {
      const badCases = [
        { ...baseValid, startAt: '2026-02-30' },
        { ...baseValid, startAt: 'not-a-date' },
        { ...baseValid, startAt: '2026-12-10T10:00:00Z' },
        { ...baseValid, startAt: '2026-12-10T25:00' },
        { ...baseValid, endAt: '2026-12-09' },
        { ...baseValid, startAt: '2026-12-10T16:00', endAt: '2026-12-10T14:00' },
      ];
      for (const c of badCases) {
        const res = validateTripBookingInput(c);
        assert.equal(res.ok, false, `Expected failure for startAt=${c.startAt}, endAt=${c.endAt}`);
      }
    });

    it('rejects invalid amounts ("12.345", "abc", float number) and accepts decimal strings', () => {
      assert.equal(validateTripBookingInput({ ...baseValid, amount: '12.345' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: 'abc' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: '-50' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: 125.5 }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: '999999999.99' }).ok, true);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: '500' }).ok, true);
      assert.equal(validateTripBookingInput({ ...baseValid, amount: '' }).ok, true);
    });

    it('rejects HTML tags or angle brackets in text fields', () => {
      assert.equal(validateTripBookingInput({ ...baseValid, title: '<b>Hotel</b>' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, provider: '<script>x</script>' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, reference: 'REF<1>' }).ok, false);
      assert.equal(validateTripBookingInput({ ...baseValid, notes: 'Note > check' }).ok, false);
    });
  });

  describe('Routes: /bookings/recorded CRUD, ownership, foreign tripId, and /bookings/all', () => {
    const jwtSecret = 'test_bookings_secret_key';
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();
    const userATripId = new mongoose.Types.ObjectId();
    const userBTripId = new mongoose.Types.ObjectId();
    let tokenA;
    let tokenB;
    let app;

    let storeRecorded;
    let storeDuffel;
    let origUserFindById;
    let origItinFindOne;
    let origTripBookingCreate;
    let origTripBookingFind;
    let origTripBookingFindOne;
    let origTripBookingFindOneAndDelete;
    let origBookingFind;

    beforeEach(() => {
      process.env.JWT_SECRET = jwtSecret;
      tokenA = jwt.sign({ userId: userAId.toString() }, jwtSecret);
      tokenB = jwt.sign({ userId: userBId.toString() }, jwtSecret);

      storeRecorded = [];
      storeDuffel = [];

      origUserFindById = User.findById;
      origItinFindOne = Itinerary.findOne;
      origTripBookingCreate = TripBooking.create;
      origTripBookingFind = TripBooking.find;
      origTripBookingFindOne = TripBooking.findOne;
      origTripBookingFindOneAndDelete = TripBooking.findOneAndDelete;
      origBookingFind = Booking.find;

      User.findById = (id) => ({
        select: () => ({
          lean: async () => ({ _id: id }),
        }),
      });

      Itinerary.findOne = (filter) => ({
        select: () => ({
          lean: async () => {
            if (String(filter._id) === String(userATripId) && String(filter.userId) === String(userAId)) {
              return { _id: userATripId, userId: userAId };
            }
            if (String(filter._id) === String(userBTripId) && String(filter.userId) === String(userBId)) {
              return { _id: userBTripId, userId: userBId };
            }
            return null;
          },
        }),
      });

      TripBooking.create = async (doc) => {
        const saved = {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...doc,
          save: async function () {
            this.updatedAt = new Date();
            return this;
          },
        };
        storeRecorded.push(saved);
        return saved;
      };

      TripBooking.find = (filter) => ({
        sort: () => ({
          lean: async () => storeRecorded.filter((d) => String(d.userId) === String(filter.userId) && (!filter.tripId || String(d.tripId) === String(filter.tripId))),
        }),
        lean: async () => storeRecorded.filter((d) => String(d.userId) === String(filter.userId)),
      });

      TripBooking.findOne = async (filter) => {
        return storeRecorded.find((d) => String(d._id) === String(filter._id) && String(d.userId) === String(filter.userId)) || null;
      };

      TripBooking.findOneAndDelete = async (filter) => {
        const idx = storeRecorded.findIndex((d) => String(d._id) === String(filter._id) && String(d.userId) === String(filter.userId));
        if (idx === -1) return null;
        const [removed] = storeRecorded.splice(idx, 1);
        return removed;
      };

      Booking.find = (filter) => ({
        sort: async () => storeDuffel.filter((b) => String(b.userId) === String(filter.userId)),
        lean: async () => storeDuffel.filter((b) => String(b.userId) === String(filter.userId)),
      });

      app = express();
      app.use(express.json());
      app.use('/bookings', bookingsRouter);
    });

    afterEach(() => {
      User.findById = origUserFindById;
      Itinerary.findOne = origItinFindOne;
      TripBooking.create = origTripBookingCreate;
      TripBooking.find = origTripBookingFind;
      TripBooking.findOne = origTripBookingFindOne;
      TripBooking.findOneAndDelete = origTripBookingFindOneAndDelete;
      Booking.find = origBookingFind;
    });

    it('rejects foreign tripId with 404', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/bookings/recorded',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: {
          kind: 'hotel',
          title: 'Taj Stay',
          provider: 'Booking.com',
          startAt: '2027-01-10',
          tripId: userBTripId.toString(),
        },
      });
      assert.equal(res.status, 404);
      assert.equal(storeRecorded.length, 0);
    });

    it('enforces strict ownership: user B cannot read, edit, or delete user A recorded booking', async () => {
      const logs = [];
      const origLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      try {
        const createRes = await dispatch(app, {
          method: 'POST',
          url: '/bookings/recorded',
          headers: { Authorization: `Bearer ${tokenA}` },
          body: {
            kind: 'train',
            title: 'Konkan Kanya Express',
            provider: 'IRCTC',
            startAt: '2027-02-01T23:05',
            reference: 'PNR-8821901',
            amount: '1450.00',
            currency: 'INR',
            notes: 'Secret coach notes',
            tripId: userATripId.toString(),
          },
        });
        assert.equal(createRes.status, 201);
        const createdId = createRes.body.id;

        // User B list -> empty
        const bList = await dispatch(app, {
          method: 'GET',
          url: '/bookings/recorded',
          headers: { Authorization: `Bearer ${tokenB}` },
        });
        assert.equal(bList.status, 200);
        assert.equal(bList.body.length, 0);

        // User B patch -> 404
        const bPatch = await dispatch(app, {
          method: 'PATCH',
          url: `/bookings/recorded/${createdId}`,
          headers: { Authorization: `Bearer ${tokenB}` },
          body: { title: 'Hacked' },
        });
        assert.equal(bPatch.status, 404);

        // User B delete -> 404
        const bDel = await dispatch(app, {
          method: 'DELETE',
          url: `/bookings/recorded/${createdId}`,
          headers: { Authorization: `Bearer ${tokenB}` },
        });
        assert.equal(bDel.status, 404);
        assert.equal(storeRecorded.length, 1);

        // User A cancels booking -> 200
        const aPatch = await dispatch(app, {
          method: 'PATCH',
          url: `/bookings/recorded/${createdId}`,
          headers: { Authorization: `Bearer ${tokenA}` },
          body: { status: 'cancelled' },
        });
        assert.equal(aPatch.status, 200);
        assert.equal(aPatch.body.status, 'cancelled');

        // Confirm no booking details leaked to logs
        const allLogs = logs.join('\n');
        assert.equal(allLogs.includes('PNR-8821901'), false);
        assert.equal(allLogs.includes('Secret coach notes'), false);
      } finally {
        console.log = origLog;
      }
    });

    it('GET /bookings/all merges Duffel flights & recorded items, sorts by startAt, filters kind & when, and paginates', async () => {
      storeDuffel.push({
        _id: new mongoose.Types.ObjectId(),
        userId: userAId,
        itineraryId: userATripId,
        bookingReference: 'PNR-FLT1',
        orderId: 'ord_1',
        airline: 'IndiGo',
        origin: 'BLR',
        destination: 'GOI',
        status: 'confirmed',
        totalAmount: '5400.00',
        currency: 'INR',
        slices: [{ segments: [{ departing_at: '2099-05-10T09:30:00', arriving_at: '2099-05-10T10:45:00' }] }],
        createdAt: new Date('2026-11-01T10:00:00Z'),
      });

      storeRecorded.push(
        {
          _id: new mongoose.Types.ObjectId(),
          userId: userAId,
          kind: 'hotel',
          title: 'Palolem Beach Hut',
          provider: 'Booking.com',
          startAt: '2099-05-10',
          endAt: '2099-05-14',
          status: 'booked',
          reference: 'HTL-1',
          amount: '8000',
          currency: 'INR',
          tripId: userATripId,
          createdAt: new Date('2026-11-02T10:00:00Z'),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: userAId,
          kind: 'bus',
          title: 'Overnight Sleeper',
          provider: 'RedBus',
          startAt: '2020-01-10T21:00',
          endAt: '2020-01-11T07:00',
          status: 'booked',
          reference: 'RB-22',
          createdAt: new Date('2026-11-03T10:00:00Z'),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: userAId,
          kind: 'cab',
          title: 'Airport Transfer',
          provider: 'Uber',
          startAt: '2099-05-10T11:15',
          status: 'cancelled',
          createdAt: new Date('2026-11-04T10:00:00Z'),
        }
      );

      // All sorted by startAt ascending: 2020 bus first, then 2099 items
      const allRes = await dispatch(app, {
        method: 'GET',
        url: '/bookings/all',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(allRes.status, 200);
      assert.equal(allRes.body.total, 4);
      assert.equal(allRes.body.items[0].kind, 'bus');
      assert.equal(allRes.body.items[0].source, 'recorded');
      assert.equal(allRes.body.counts.byKind.flight, 1);
      assert.equal(allRes.body.counts.byKind.hotel, 1);
      assert.equal(allRes.body.counts.byKind.bus, 1);
      assert.equal(allRes.body.counts.byKind.cab, 1);

      // Filter by kind=flight
      const fltRes = await dispatch(app, {
        method: 'GET',
        url: '/bookings/all?kind=flight',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(fltRes.status, 200);
      assert.equal(fltRes.body.items.length, 1);
      assert.equal(fltRes.body.items[0].source, 'duffel');
      assert.equal(fltRes.body.items[0].reference, 'PNR-FLT1');

      // Filter by when=cancelled
      const canRes = await dispatch(app, {
        method: 'GET',
        url: '/bookings/all?when=cancelled',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(canRes.status, 200);
      assert.equal(canRes.body.items.length, 1);
      assert.equal(canRes.body.items[0].kind, 'cab');

      // Filter by when=upcoming -> excludes past bus & cancelled cab
      const upcRes = await dispatch(app, {
        method: 'GET',
        url: '/bookings/all?when=upcoming',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(upcRes.status, 200);
      assert.equal(upcRes.body.items.length, 2);

      // Pagination limit=2, page=2
      const page2Res = await dispatch(app, {
        method: 'GET',
        url: '/bookings/all?page=2&limit=2',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(page2Res.status, 200);
      assert.equal(page2Res.body.items.length, 2);
      assert.equal(page2Res.body.totalPages, 2);
    });
  });

  describe('tripHasBooking parity between backend and web', () => {
    it('backend and web implementations agree on all shared fixtures', () => {
      const fixtures = [
        { name: 'null trip', input: null, expected: false },
        { name: 'empty object', input: {}, expected: false },
        { name: 'empty arrays', input: { bookings: [], recordedBookings: [], bookingsCount: 0, recordedBookingsCount: 0 }, expected: false },
        { name: 'cancelled flight booking only', input: { bookings: [{ status: 'cancelled' }] }, expected: false },
        { name: 'cancelled recorded booking only', input: { recordedBookings: [{ kind: 'hotel', status: 'cancelled' }] }, expected: false },
        { name: 'active recorded booking', input: { recordedBookings: [{ kind: 'hotel', status: 'booked' }] }, expected: true },
        { name: 'cancelled + active recorded booking', input: { recordedBookings: [{ status: 'cancelled' }, { status: 'booked' }] }, expected: true },
        { name: 'recordedBookingsCount > 0', input: { recordedBookingsCount: 1 }, expected: true },
        { name: 'flight string ID', input: { bookings: ['bk_123'] }, expected: true },
        { name: 'confirmed flight booking object', input: { bookings: [{ status: 'confirmed' }] }, expected: true },
      ];

      for (const f of fixtures) {
        const bVal = backendTripHasBooking(f.input);
        const wVal = webTripHasBooking(f.input);
        assert.equal(bVal, f.expected, `Backend tripHasBooking failed for "${f.name}"`);
        assert.equal(wVal, f.expected, `Web tripHasBooking failed for "${f.name}"`);
        assert.equal(bVal, wVal, `Backend and web disagreed on "${f.name}"`);
      }
    });

    it('future trip flips from planning -> upcoming when recorded booking is linked and reverts when cancelled', () => {
      const baseTrip = { startDate: '2099-06-01', endDate: '2099-06-05' };
      assert.equal(backendTripStatus(baseTrip, '2026-11-25'), 'planning');
      assert.equal(webTripStatus(baseTrip, '2026-11-25'), 'planning');

      const withRecorded = { ...baseTrip, recordedBookings: [{ kind: 'hotel', status: 'booked' }] };
      assert.equal(backendTripStatus(withRecorded, '2026-11-25'), 'upcoming');
      assert.equal(webTripStatus(withRecorded, '2026-11-25'), 'upcoming');

      const withCancelled = { ...baseTrip, recordedBookings: [{ kind: 'hotel', status: 'cancelled' }] };
      assert.equal(backendTripStatus(withCancelled, '2026-11-25'), 'planning');
      assert.equal(webTripStatus(withCancelled, '2026-11-25'), 'planning');
    });
  });

  describe('accountDeletion - TripBooking purge verification', () => {
    it('counts tripBookings in dry-run preview and permanently deletes them when deleting account', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      const otherUserId = new mongoose.Types.ObjectId();

      const fakeTripBookings = [
        { _id: new mongoose.Types.ObjectId(), userId: targetUserId, kind: 'hotel' },
        { _id: new mongoose.Types.ObjectId(), userId: targetUserId, kind: 'train' },
        { _id: new mongoose.Types.ObjectId(), userId: otherUserId, kind: 'cab' },
      ];

      const modelsToStub = [Itinerary, Conversation, Expense, Booking, PackingTemplate, Disruption];
      const backups = modelsToStub.map((m) => ({ m, count: m.countDocuments, del: m.deleteMany }));
      const origUserCount = User.countDocuments;
      const origUserDel = User.deleteOne;
      const origTBCount = TripBooking.countDocuments;
      const origTBDel = TripBooking.deleteMany;

      try {
        for (const m of modelsToStub) {
          m.countDocuments = async () => 0;
          m.deleteMany = async () => ({ deletedCount: 0 });
        }
        User.countDocuments = async () => 1;
        User.deleteOne = async () => ({ deletedCount: 1 });

        TripBooking.countDocuments = async (filter) =>
          fakeTripBookings.filter((d) => String(d.userId) === String(filter.userId)).length;
        TripBooking.deleteMany = async (filter) => {
          let deleted = 0;
          for (let i = fakeTripBookings.length - 1; i >= 0; i--) {
            if (String(fakeTripBookings[i].userId) === String(filter.userId)) {
              fakeTripBookings.splice(i, 1);
              deleted++;
            }
          }
          return { deletedCount: deleted };
        };

        const previewCounts = await countUserData(targetUserId);
        assert.equal(previewCounts.tripBookings, 2);

        const delResult = await deleteUserAndData(targetUserId);
        assert.equal(delResult.tripBookings, 2);
        assert.equal(fakeTripBookings.length, 1);
        assert.equal(String(fakeTripBookings[0].userId), String(otherUserId));
      } finally {
        for (const b of backups) {
          b.m.countDocuments = b.count;
          b.m.deleteMany = b.del;
        }
        User.countDocuments = origUserCount;
        User.deleteOne = origUserDel;
        TripBooking.countDocuments = origTBCount;
        TripBooking.deleteMany = origTBDel;
      }
    });
  });
});

