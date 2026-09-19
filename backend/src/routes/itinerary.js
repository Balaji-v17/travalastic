import express from 'express';
import mongoose from 'mongoose';
import graph from '../services/agents/graph.js';
import authenticate from '../middleware/authenticate.js';
import Itinerary, { findUserItinerary } from '../models/Itinerary.js';

const router = express.Router();

/**
 * POST /itinerary/generate
 * Protected by JWT authenticate middleware.
 * Accepts { rawRequest: string }, invokes the LangGraph planner graph,
 * persists the itinerary in MongoDB associated with req.userId,
 * and returns { itineraryId, itinerary }.
 */
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { rawRequest } = req.body || {};

    if (!rawRequest || typeof rawRequest !== 'string' || !rawRequest.trim()) {
      return res.status(400).json({ error: 'rawRequest string is required in request body' });
    }

    const finalState = await graph.invoke({ rawRequest: rawRequest.trim() });

    const newItinerary = await Itinerary.create({
      userId: req.userId,
      rawRequest: rawRequest.trim(),
      destination: finalState.destination,
      startDate: finalState.startDate,
      endDate: finalState.endDate,
      budgetTier: finalState.budgetTier,
      interests: finalState.interests,
      days: finalState.itinerary || [],
    });

    return res.status(200).json({
      itineraryId: newItinerary._id,
      itinerary: finalState.itinerary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itinerary/mine
 * Protected by JWT authenticate middleware.
 * Returns the requesting user's itineraries, sorted by createdAt descending,
 * limited to the 5 most recent.
 */
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const itineraries = await Itinerary.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json(itineraries);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itinerary/:itineraryId
 * Protected by JWT authenticate middleware.
 * If the itinerary doesn't exist OR doesn't belong to req.userId,
 * returns a generic 404 to avoid leaking existence across users.
 */
router.get('/:itineraryId', authenticate, async (req, res, next) => {
  try {
    const { itineraryId } = req.params;

    const itinerary = await findUserItinerary(itineraryId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const doc = itinerary.toObject();

    return res.status(200).json({
      ...doc,
      itineraryId: doc._id,
      itinerary: doc.days,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
