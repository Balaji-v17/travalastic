import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import authenticate from '../middleware/authenticate.js';
import Booking from '../models/Booking.js';
import TripBooking from '../models/TripBooking.js';
import Itinerary from '../models/Itinerary.js';
import {
  validateTripBookingInput,
  normalizeKindFilter,
  buildMergedBookingsResponse,
  normalizeRecordedBookingItem,
} from '../services/tripBookingService.js';

const router = express.Router();

const bookingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => (req.userId ? req.userId.toString() : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many booking requests. Please try again in a few minutes.' },
});

/**
 * Verifies that tripId (if present) belongs to req.userId.
 * Returns false if not found or owned by another user.
 */
async function verifyTripOwnership(tripId, userId) {
  if (!tripId) return true;
  const owned = await Itinerary.findOne({ _id: tripId, userId }).select('_id').lean();
  return Boolean(owned);
}

/**
 * GET /bookings/mine
 * Auth-protected endpoint returning the requesting user's flight bookings,
 * sorted by date descending (most recent first).
 */
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /bookings/all
 * Auth-protected endpoint merging Duffel flight orders and user-recorded bookings
 * into a unified list sorted by startAt ascending, filterable by kind & when, paginated.
 */
router.get('/all', authenticate, bookingsLimiter, async (req, res, next) => {
  try {
    const rawKind = req.query.kind ? String(req.query.kind) : 'all';
    const normalizedKind = normalizeKindFilter(rawKind);
    if (!normalizedKind) {
      return res.status(400).json({ error: 'Invalid kind filter' });
    }

    const rawWhen = req.query.when ? String(req.query.when).trim().toLowerCase() : 'all';
    if (!['all', 'upcoming', 'past', 'cancelled'].includes(rawWhen)) {
      return res.status(400).json({ error: 'when must be one of: all, upcoming, past, cancelled' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

    const [duffelBookings, recordedBookings] = await Promise.all([
      Booking.find({ userId: req.userId }).lean(),
      TripBooking.find({ userId: req.userId }).lean(),
    ]);

    const result = buildMergedBookingsResponse({
      duffelBookings: duffelBookings || [],
      recordedBookings: recordedBookings || [],
      kind: normalizedKind,
      when: rawWhen,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /bookings/recorded
 * Lists only the requesting user's recorded (non-flight) bookings.
 */
router.get('/recorded', authenticate, bookingsLimiter, async (req, res, next) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.tripId) {
      const tripIdStr = String(req.query.tripId).trim();
      if (!mongoose.Types.ObjectId.isValid(tripIdStr)) {
        return res.status(400).json({ error: 'Invalid tripId' });
      }
      filter.tripId = tripIdStr;
    }

    const docs = await TripBooking.find(filter).sort({ startAt: 1, createdAt: -1 }).lean();
    return res.status(200).json((docs || []).map(normalizeRecordedBookingItem));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /bookings/recorded
 * Creates a new user-recorded booking. Validates plain text, dates, amount, and trip ownership.
 */
router.post('/recorded', authenticate, bookingsLimiter, async (req, res, next) => {
  try {
    const validation = validateTripBookingInput(req.body, null);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message, errors: validation.errors });
    }

    const data = validation.data;
    if (data.tripId) {
      const ownsTrip = await verifyTripOwnership(data.tripId, req.userId);
      if (!ownsTrip) {
        return res.status(404).json({ error: 'Linked trip not found' });
      }
    }

    const created = await TripBooking.create({
      userId: req.userId,
      kind: data.kind,
      title: data.title,
      provider: data.provider,
      startAt: data.startAt,
      endAt: data.endAt || '',
      reference: data.reference || '',
      amount: data.amount || '',
      currency: data.currency || '',
      status: data.status || 'booked',
      notes: data.notes || '',
      tripId: data.tripId || null,
    });

    return res.status(201).json(normalizeRecordedBookingItem(created));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /bookings/recorded/:id
 * Updates a user-recorded booking owned by req.userId.
 */
router.patch('/recorded/:id', authenticate, bookingsLimiter, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const existing = await TripBooking.findOne({ _id: targetId, userId: req.userId });
    if (!existing) {
      return res.status(404).json({ error: 'Recorded booking not found' });
    }

    const validation = validateTripBookingInput(req.body, existing);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message, errors: validation.errors });
    }

    const updates = validation.data;
    if (updates.tripId) {
      const ownsTrip = await verifyTripOwnership(updates.tripId, req.userId);
      if (!ownsTrip) {
        return res.status(404).json({ error: 'Linked trip not found' });
      }
    }

    Object.assign(existing, updates);
    const saved = await existing.save();

    return res.status(200).json(normalizeRecordedBookingItem(saved));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /bookings/recorded/:id
 * Deletes a user-recorded booking owned by req.userId.
 */
router.delete('/recorded/:id', authenticate, bookingsLimiter, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const deleted = await TripBooking.findOneAndDelete({ _id: targetId, userId: req.userId });
    if (!deleted) {
      return res.status(404).json({ error: 'Recorded booking not found' });
    }

    return res.status(200).json({ deleted: true, id: String(deleted._id) });
  } catch (error) {
    next(error);
  }
});

export default router;
export { router };
