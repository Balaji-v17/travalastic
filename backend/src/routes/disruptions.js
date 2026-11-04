import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import authenticate from '../middleware/authenticate.js';
import Itinerary from '../models/Itinerary.js';
import Disruption from '../models/Disruption.js';
import { ingestScheduleChange } from '../services/disruptions/ingest.js';
import { buildDedupeKey } from '../services/disruptions/analysis.js';
import {
  generateProposal,
  checkAndExpireDisruption,
} from '../services/disruptions/proposal.js';
import {
  approveDisruption,
  dismissDisruption,
  undoDisruption,
} from '../services/disruptions/lifecycle.js';

// Startup warning when the disruption simulator is enabled
if (process.env.ENABLE_DISRUPTION_SIMULATOR === 'true') {
  console.warn('⚠️ Disruption simulator is ENABLED - for testing/demo only');
}

/**
 * Per-user rate limiter for disruption proposal generation:
 * 10 requests per user per hour; returns 429 upon excess.
 */
export const proposalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => (req.userId ? req.userId.toString() : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many proposal requests. Please try again after an hour.' },
});

const router = express.Router();

/**
 * GET /disruptions?status=
 * List the user's disruptions, newest first, maximum 50.
 * JWT-authenticated and ownership-checked.
 * Evaluates lazy expiry for past trips.
 *
 * Response items include:
 * - id, type, source, simulated, status, details, dayNumber, itineraryId, detectedAt, hasProposal
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const rawDisruptions = await Disruption.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const disruptions = await Promise.all(
      rawDisruptions.map((d) => checkAndExpireDisruption(d))
    );

    const filtered = req.query.status
      ? disruptions.filter((d) => d.status === req.query.status)
      : disruptions;

    const items = filtered.map((d) => {
      const hasProposal = Boolean(d.proposal && d.proposal.kind);
      return {
        id: d._id.toString(),
        type: d.type,
        source: d.source,
        simulated: d.source === 'simulation',
        status: d.status,
        details: d.details,
        dayNumber: d.proposal?.dayNumber || null,
        itineraryId: d.itineraryId,
        detectedAt: d.detectedAt,
        hasProposal,
      };
    });

    return res.status(200).json(items);
  } catch (err) {
    next(err);
  }
});

/**
 * Disruption simulation endpoint for demos and testing.
 *
 * Route: POST /disruptions/simulate
 * Authentication: JWT (authenticate middleware)
 * Enabled only when ENABLE_DISRUPTION_SIMULATOR === "true"
 */
router.post(
  '/simulate',
  (req, res, next) => {
    // 1. Feature flag check: respond 404 as if route does not exist when disabled
    if (process.env.ENABLE_DISRUPTION_SIMULATOR !== 'true') {
      return res.status(404).json({ error: { message: `Not Found - ${req.originalUrl}` } });
    }
    next();
  },
  authenticate,
  async (req, res, next) => {
    try {
      const { itineraryId, dayNumber, delayMinutes } = req.body || {};

      // 2. Validate delayMinutes (integer between 1 and 600)
      if (
        delayMinutes == null ||
        typeof delayMinutes !== 'number' ||
        !Number.isInteger(delayMinutes) ||
        delayMinutes < 1 ||
        delayMinutes > 600
      ) {
        return res.status(400).json({
          error: 'delayMinutes must be an integer between 1 and 600',
        });
      }

      // 3. Validate dayNumber (integer)
      if (
        dayNumber == null ||
        typeof dayNumber !== 'number' ||
        !Number.isInteger(dayNumber) ||
        dayNumber < 1
      ) {
        return res.status(400).json({
          error: 'dayNumber must be a positive integer',
        });
      }

      // 4. Validate itinerary ownership
      if (!itineraryId) {
        return res.status(400).json({ error: 'itineraryId is required' });
      }

      let itinerary;
      try {
        itinerary = await Itinerary.findById(itineraryId);
      } catch (err) {
        return res.status(404).json({ error: { message: 'Itinerary not found' } });
      }

      if (!itinerary || String(itinerary.userId) !== String(req.userId)) {
        return res.status(404).json({ error: { message: 'Itinerary not found' } });
      }

      // Verify dayNumber exists within the itinerary
      const days = Array.isArray(itinerary.days) ? itinerary.days : [];
      const dayExists = days.some((d) => d?.dayNumber === dayNumber);
      if (!dayExists) {
        return res.status(400).json({
          error: `dayNumber ${dayNumber} does not exist in the itinerary`,
        });
      }

      // 5. Build synthetic old and new flight segments
      const startDateStr = itinerary.startDate || new Date().toISOString().slice(0, 10);
      const [startY, startM, startD] = startDateStr.split('-').map(Number);
      const targetDateObj = new Date(Date.UTC(startY, startM - 1, startD + (dayNumber - 1)));
      const targetDateStr = targetDateObj.toISOString().slice(0, 10);

      const oldArrival = `${targetDateStr}T14:00:00`;
      const oldDeparture = `${targetDateStr}T10:00:00`;

      const oldArrivalMs = Date.parse(`${oldArrival}Z`);
      const newArrivalMs = oldArrivalMs + delayMinutes * 60 * 1000;
      const newArrival = new Date(newArrivalMs).toISOString().slice(0, 19);

      const oldSegments = [
        {
          origin: 'DEL',
          destination: 'BOM',
          departing_at: oldDeparture,
          arriving_at: oldArrival,
        },
      ];

      const newSegments = [
        {
          origin: 'DEL',
          destination: 'BOM',
          departing_at: oldDeparture,
          arriving_at: newArrival,
        },
      ];

      // 6. DedupeKey with random nonce so repeated demo runs always succeed
      const nonce = crypto.randomBytes(4).toString('hex');
      const dedupeKey = buildDedupeKey(
        'sim',
        `${itinerary._id}_d${dayNumber}_${Date.now()}_${nonce}`
      );

      // 7. Ingest through shared disruption engine with source: "simulation"
      const result = await ingestScheduleChange({
        userId: req.userId,
        itineraryId: itinerary._id,
        bookingId: null,
        oldSegments,
        newSegments,
        source: 'simulation',
        dedupeKey,
      });

      return res.status(200).json({
        simulated: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /disruptions/:id
 * Full disruption record including the proposal.
 * Validates ObjectId format (returns 400 on malformed id).
 * Checks ownership (returns 404 if missing or belongs to another user).
 * Evaluates lazy expiry.
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid disruption ID' });
    }

    let disruption = await Disruption.findOne({ _id: id, userId: req.userId });
    if (!disruption) {
      return res.status(404).json({ error: 'Disruption not found' });
    }

    disruption = await checkAndExpireDisruption(disruption);

    return res.status(200).json(disruption);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /disruptions/:id/proposal
 * Runs generateProposal for the disruption.
 * Rate limited to 10 requests per hour per user (returns 429 on excess).
 * Supports ?regenerate=true or { regenerate: true } in request body.
 */
router.post('/:id/proposal', authenticate, proposalLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid disruption ID' });
    }

    const regenerate = req.query.regenerate === 'true' || req.body?.regenerate === true;

    const result = await generateProposal({
      disruptionId: id,
      userId: req.userId,
      regenerate,
    });

    return res.status(200).json({
      success: true,
      proposal: result.proposal,
      ...result.proposal,
      status: result.disruption?.status || 'proposed',
      cached: Boolean(result.cached),
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /disruptions/:id/approve
 * Approves a stored proposal.
 * Body: { baseHash: string }
 * Applies stored proposal changes to itinerary via atomic snapshot-and-write.
 * Sets status to 'approved', records appliedEditId and approvedAt.
 */
router.post('/:id/approve', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { baseHash } = req.body || {};

    const result = await approveDisruption({
      disruptionId: id,
      userId: req.userId,
      baseHash,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.error || err.message,
        ...(err.error && err.message !== err.error ? { message: err.message } : {}),
      });
    }
    next(err);
  }
});

/**
 * POST /disruptions/:id/dismiss
 * Dismisses a stored disruption proposal.
 * Allowed for statuses 'new' or 'proposed'.
 * Sets status to 'dismissed' and records dismissedAt.
 * Never touches the itinerary.
 */
router.post('/:id/dismiss', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await dismissDisruption({
      disruptionId: id,
      userId: req.userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.error || err.message,
        ...(err.error && err.message !== err.error ? { message: err.message } : {}),
      });
    }
    next(err);
  }
});

/**
 * POST /disruptions/:id/undo
 * Reverts an approved disruption if it is the latest snapshot in editHistory.
 * Restores affected day using applySnapshot and sets status to 'reverted'.
 */
router.post('/:id/undo', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await undoDisruption({
      disruptionId: id,
      userId: req.userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.error || err.message,
        ...(err.message ? { message: err.message } : {}),
      });
    }
    next(err);
  }
});

export default router;
