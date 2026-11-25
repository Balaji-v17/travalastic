import test, { describe, it, beforeEach, afterEach } from 'node:test';
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
import Expense from '../src/models/Expense.js';
import Conversation from '../src/models/Conversation.js';
import Disruption from '../src/models/Disruption.js';
import graph from '../src/services/agents/graph.js';
import {
  tripStatus,
  tripHasBooking,
  getLocalDateString,
  normalizeDateString,
} from '../src/services/tripStatus.js';

describe('Trip Status Pure Functions', () => {
  const fixedToday = '2026-11-23';

  describe('tripHasBooking', () => {
    it('returns false for null, empty or booking-less trips', () => {
      assert.equal(tripHasBooking(null), false);
      assert.equal(tripHasBooking({}), false);
      assert.equal(tripHasBooking({ bookings: [] }), false);
      assert.equal(tripHasBooking({ bookingsCount: 0 }), false);
      assert.equal(tripHasBooking({ hasBooking: false }), false);
    });

    it('returns true when hasBooking is true or bookings array has items or bookingsCount > 0', () => {
      assert.equal(tripHasBooking({ hasBooking: true }), true);
      assert.equal(tripHasBooking({ bookings: ['booking-1'] }), true);
      assert.equal(tripHasBooking({ bookingsCount: 1 }), true);
    });
  });

  describe('normalizeDateString & getLocalDateString', () => {
    it('normalizes YYYY-MM-DD strings without timezone offsets', () => {
      assert.equal(normalizeDateString('2026-12-07'), '2026-12-07');
      assert.equal(normalizeDateString('  2026-05-04T00:00:00.000Z '), '2026-05-04');
      assert.equal(normalizeDateString(null), '');
      assert.equal(normalizeDateString(''), '');
    });

    it('getLocalDateString returns local YYYY-MM-DD representation', () => {
      const d = new Date(2026, 10, 23); // Nov 23, 2026 local
      assert.equal(getLocalDateString(d), '2026-11-23');
    });
  });

  describe('tripStatus state machine', () => {
    // Reference date: fixedToday = '2026-11-23'

    it('planning: no confirmed booking AND end date >= today', () => {
      // Future trip
      assert.equal(
        tripStatus({ startDate: '2026-12-01', endDate: '2026-12-05', hasBooking: false }, fixedToday),
        'planning'
      );
      // Trip ending today
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-23', hasBooking: false }, fixedToday),
        'planning'
      );
      // Trip missing end date defaults to planning
      assert.equal(
        tripStatus({ startDate: '2026-12-01', hasBooking: false }, fixedToday),
        'planning'
      );
    });

    it('past: no confirmed booking AND end date < today (NEVER completed)', () => {
      // Ended yesterday
      assert.equal(
        tripStatus({ startDate: '2026-11-18', endDate: '2026-11-22', hasBooking: false }, fixedToday),
        'past'
      );
      // Ended months ago (e.g. Jog Falls, Tokyo)
      assert.equal(
        tripStatus({ startDate: '2026-08-10', endDate: '2026-08-13', bookings: [] }, fixedToday),
        'past'
      );
    });

    it('upcoming: at least one confirmed booking AND start date > today', () => {
      assert.equal(
        tripStatus({ startDate: '2026-11-24', endDate: '2026-11-30', hasBooking: true }, fixedToday),
        'upcoming'
      );
      assert.equal(
        tripStatus({ startDate: '2027-01-10', endDate: '2027-01-15', bookingsCount: 1 }, fixedToday),
        'upcoming'
      );
    });

    it('in-progress: at least one confirmed booking AND start <= today <= end', () => {
      // Starts today
      assert.equal(
        tripStatus({ startDate: '2026-11-23', endDate: '2026-11-28', hasBooking: true }, fixedToday),
        'in-progress'
      );
      // Middle of trip
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-25', hasBooking: true }, fixedToday),
        'in-progress'
      );
      // Last day today
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-23', hasBooking: true }, fixedToday),
        'in-progress'
      );
    });

    it('completed: at least one confirmed booking AND end date < today', () => {
      assert.equal(
        tripStatus({ startDate: '2026-11-15', endDate: '2026-11-20', hasBooking: true }, fixedToday),
        'completed'
      );
    });
  });
});

describe('Itinerary Duplicate Checking & Deletion Routes', () => {
  const jwtSecret = 'test_jwt_secret_duplicates_and_deletion';
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  let userAToken;
  let userBToken;
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
  let origItineraryFind;
  let origItineraryFindOne;
  let origItineraryFindOneAndUpdate;
  let origItineraryUpdateOne;
  let origItineraryFindById;
  let origItineraryDeleteOne;
  let origConversationDeleteMany;
  let origExpenseDeleteMany;
  let origDisruptionDeleteMany;
  let origBookingUpdateMany;
  let origBookingCountDocuments;
  let origTripBookingUpdateMany;
  let origTripBookingCountDocuments;
  let origGraphInvoke;

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    userAToken = jwt.sign({ userId: userAId.toString() }, jwtSecret);
    userBToken = jwt.sign({ userId: userBId.toString() }, jwtSecret);

    app = express();
    app.use(express.json());
    app.use(['/itinerary', '/itineraries'], itineraryRouter);

    origUserFindById = User.findById;
    origItineraryFind = Itinerary.find;
    origItineraryFindOne = Itinerary.findOne;
    origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
    origItineraryUpdateOne = Itinerary.updateOne;
    origItineraryFindById = Itinerary.findById;
    origItineraryDeleteOne = Itinerary.deleteOne;
    origConversationDeleteMany = Conversation.deleteMany;
    origExpenseDeleteMany = Expense.deleteMany;
    origDisruptionDeleteMany = Disruption.deleteMany;
    origBookingUpdateMany = Booking.updateMany;
    origBookingCountDocuments = Booking.countDocuments;
    origTripBookingUpdateMany = mongoose.model('TripBooking').updateMany;
    origTripBookingCountDocuments = mongoose.model('TripBooking').countDocuments;
    origGraphInvoke = graph.invoke;

    User.findById = (id) => ({
      select: () => ({
        lean: async () => ({ _id: id }),
        exec: async () => ({ _id: id, email: 'test@example.com' }),
      }),
      lean: async () => ({ _id: id }),
      exec: async () => ({ _id: id, email: 'test@example.com' }),
    });
  });

  afterEach(() => {
    User.findById = origUserFindById;
    Itinerary.find = origItineraryFind;
    Itinerary.findOne = origItineraryFindOne;
    Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
    Itinerary.updateOne = origItineraryUpdateOne;
    Itinerary.findById = origItineraryFindById;
    Itinerary.deleteOne = origItineraryDeleteOne;
    Conversation.deleteMany = origConversationDeleteMany;
    Expense.deleteMany = origExpenseDeleteMany;
    Disruption.deleteMany = origDisruptionDeleteMany;
    Booking.updateMany = origBookingUpdateMany;
    Booking.countDocuments = origBookingCountDocuments;
    mongoose.model('TripBooking').updateMany = origTripBookingUpdateMany;
    mongoose.model('TripBooking').countDocuments = origTripBookingCountDocuments;
    graph.invoke = origGraphInvoke;
  });

  describe('POST /itinerary/check-duplicate', () => {
    it('detects existing trip with same destination and dates (case and spacing insensitive)', async () => {
      const existingTripId = new mongoose.Types.ObjectId();
      Itinerary.find = (filter) => ({
        sort: () => ({
          lean: async () => [
            {
              _id: existingTripId,
              userId: userAId,
              destination: 'Varkala, Kerala',
              startDate: '2026-12-07',
              endDate: '2026-12-10',
            },
          ],
        }),
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/check-duplicate',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          destination: '   varkala, kerala   ',
          startDate: '2026-12-07',
          endDate: '2026-12-10',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.duplicate, true);
      assert.equal(res.body.existingTripId, existingTripId.toString());
    });

    it('returns duplicate: false when dates differ', async () => {
      Itinerary.find = (filter) => ({
        sort: () => ({
          lean: async () => [
            {
              _id: new mongoose.Types.ObjectId(),
              userId: userAId,
              destination: 'Goa',
              startDate: '2026-11-25',
              endDate: '2026-11-28',
            },
          ],
        }),
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/check-duplicate',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          destination: 'Goa',
          startDate: '2026-12-01',
          endDate: '2026-12-04',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.duplicate, false);
    });

    it('returns early 409 from /itinerary/generate before model call when duplicate exists', async () => {
      const existingTripId = new mongoose.Types.ObjectId();
      Itinerary.find = (filter) => ({
        sort: () => ({
          lean: async () => [
            {
              _id: existingTripId,
              userId: userAId,
              destination: 'Kedarnath',
              startDate: '2027-05-04',
              endDate: '2027-05-07',
            },
          ],
        }),
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/generate',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          rawRequest: 'Plan a 3-day trip to Kedarnath from 2027-05-04 to 2027-05-07.',
        },
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.duplicate, true);
      assert.equal(res.body.existingTripId, existingTripId.toString());
      assert.match(res.body.error, /already have a trip/i);
    });

    it('replaces existing trip in-place when onDuplicate: "replace", snapshots for undo, and allows undo restoration', async () => {
      const existingTripId = new mongoose.Types.ObjectId();
      const initialDays = [
        {
          dayNumber: 1,
          theme: 'Old Varkala Day 1',
          activities: [{ id: 'a1', title: 'Old cliff walk', done: true }],
        },
      ];
      const newDays = [
        {
          dayNumber: 1,
          theme: 'New Varkala Day 1',
          activities: [{ id: 'b1', title: 'New beach visit', done: false }],
        },
      ];

      const tripDoc = {
        _id: existingTripId,
        userId: userAId,
        destination: 'Varkala',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        pace: 'balanced',
        days: JSON.parse(JSON.stringify(initialDays)),
        editHistory: [],
        save: async function () { return this; },
        toObject: function () { return { ...this }; },
      };

      Itinerary.find = () => ({
        sort: () => ({
          lean: async () => [
            {
              _id: existingTripId,
              userId: userAId,
              destination: 'Varkala',
              startDate: '2026-12-10',
              endDate: '2026-12-14',
            },
          ],
        }),
      });

      Booking.countDocuments = async () => 0;
      mongoose.model('TripBooking').countDocuments = async () => 0;

      Itinerary.findOne = (query) => {
        if (query._id?.toString() === existingTripId.toString() && query.userId?.toString() === userAId.toString()) {
          return Promise.resolve(tripDoc);
        }
        return Promise.resolve(null);
      };

      Itinerary.findOneAndUpdate = async (query, update) => {
        if (update.$set?.days) {
          tripDoc.days = update.$set.days;
        }
        if (update.$push?.editHistory?.$each) {
          tripDoc.editHistory.push(...update.$push.editHistory.$each);
        }
        if (update.$pop?.editHistory) {
          tripDoc.editHistory.pop();
        }
        return tripDoc;
      };

      Itinerary.updateOne = async (query, update) => {
        if (update.$set) {
          Object.assign(tripDoc, update.$set);
        }
        return { modifiedCount: 1 };
      };

      Itinerary.findById = (id) => {
        if (id?.toString() === existingTripId.toString()) {
          return Promise.resolve(tripDoc);
        }
        return Promise.resolve(null);
      };

      graph.invoke = async () => ({
        destination: 'Varkala',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        budgetTier: 'mid',
        interests: ['beach'],
        itinerary: newDays,
        grounding: { candidateCount: 1, sources: ['places'], limited: false },
      });

      // 1. Send generate request with onDuplicate: 'replace'
      const res = await dispatch(app, {
        method: 'POST',
        url: '/itinerary/generate',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          rawRequest: 'Plan a 4-day trip to Varkala from 2026-12-10 to 2026-12-14.',
          onDuplicate: 'replace',
          replaceTripId: existingTripId.toString(),
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.replaced, true);
      assert.equal(res.body.itineraryId.toString(), existingTripId.toString());
      assert.equal(res.body.itinerary[0].theme, 'New Varkala Day 1');
      assert.ok(res.body.undo);
      assert.equal(res.body.undo.count, 1);
      assert.ok(res.body.undo.lastEditId);

      // Verify the snapshot in editHistory has tag 'replace' and preserved the previous days
      assert.equal(tripDoc.editHistory.length, 1);
      assert.equal(tripDoc.editHistory[0].tag, 'replace');
      assert.equal(tripDoc.editHistory[0].previousDays[0].theme, 'Old Varkala Day 1');
      assert.equal(tripDoc.editHistory[0].previousDays[0].activities[0].done, true);

      // 2. Call POST /itineraries/:id/undo with expectedEditId
      const undoRes = await dispatch(app, {
        method: 'POST',
        url: `/itineraries/${existingTripId}/undo`,
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { expectedEditId: res.body.undo.lastEditId },
      });

      assert.equal(undoRes.status, 200);
      // Days should be reverted back to initialDays
      assert.equal(undoRes.body.itinerary[0].theme, 'Old Varkala Day 1');
      assert.equal(undoRes.body.itinerary[0].activities[0].done, true);
      assert.equal(undoRes.body.undo.count, 0);
    });
  });

  describe('DELETE /itineraries/:id', () => {
    it('returns 404 when user B attempts to delete user A trip (ownership check)', async () => {
      const tripId = new mongoose.Types.ObjectId();

      // Trip belongs to user A
      Itinerary.findOne = (query) => {
        if (query.userId?.toString() === userAId.toString() && query._id?.toString() === tripId.toString()) {
          return Promise.resolve({ _id: tripId, userId: userAId });
        }
        return Promise.resolve(null);
      };

      // User B attempts deletion
      const res = await dispatch(app, {
        method: 'DELETE',
        url: `/itineraries/${tripId}`,
        headers: { Authorization: `Bearer ${userBToken}` },
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Itinerary not found');
    });

    it('successfully deletes user A trip and cleans up child resources and detaches bookings', async () => {
      const tripId = new mongoose.Types.ObjectId();

      Itinerary.findOne = (query) => {
        if (query.userId?.toString() === userAId.toString() && query._id?.toString() === tripId.toString()) {
          return Promise.resolve({ _id: tripId, userId: userAId });
        }
        return Promise.resolve(null);
      };

      let conversationsCleaned = false;
      let expensesCleaned = false;
      let disruptionsCleaned = false;
      let bookingsDetached = false;
      let tripBookingsDetached = false;
      let itineraryDeleted = false;

      Conversation.deleteMany = async (filter) => {
        if (filter.itineraryId?.toString() === tripId.toString()) {
          conversationsCleaned = true;
        }
        return { deletedCount: 2 };
      };

      Expense.deleteMany = async (filter) => {
        if (filter.itineraryId?.toString() === tripId.toString()) {
          expensesCleaned = true;
        }
        return { deletedCount: 3 };
      };

      Disruption.deleteMany = async (filter) => {
        if (filter.itineraryId?.toString() === tripId.toString()) {
          disruptionsCleaned = true;
        }
        return { deletedCount: 1 };
      };

      Booking.updateMany = async (filter, update) => {
        if (filter.itineraryId?.toString() === tripId.toString() && update.$set?.itineraryId === null) {
          bookingsDetached = true;
        }
        return { modifiedCount: 1 };
      };

      mongoose.model('TripBooking').updateMany = async (filter, update) => {
        if (filter.tripId?.toString() === tripId.toString() && update.$set?.tripId === null) {
          tripBookingsDetached = true;
        }
        return { modifiedCount: 1 };
      };

      Itinerary.deleteOne = async (filter) => {
        if (filter._id?.toString() === tripId.toString()) {
          itineraryDeleted = true;
        }
        return { deletedCount: 1 };
      };

      const res = await dispatch(app, {
        method: 'DELETE',
        url: `/itineraries/${tripId}`,
        headers: { Authorization: `Bearer ${userAToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Itinerary deleted successfully');
      assert.equal(res.body.deletedId, tripId.toString());

      assert.equal(conversationsCleaned, true, 'Conversations must be deleted');
      assert.equal(expensesCleaned, true, 'Expenses must be deleted');
      assert.equal(disruptionsCleaned, true, 'Disruptions must be deleted');
      assert.equal(bookingsDetached, true, 'Bookings must be detached with itineraryId: null');
      assert.equal(tripBookingsDetached, true, 'Recorded TripBookings must be detached with tripId: null');
      assert.equal(itineraryDeleted, true, 'Itinerary document must be deleted');
    });
  });
});
