import express from 'express';
import CuratedRoute from '../models/CuratedRoute.js';

const router = express.Router();

/**
 * GET /routes/search?mode=train|bus&origin=&destination=
 * Queries CuratedRoute for matching train/bus routes.
 * Returns curated results plus a single un-prefilled bookingLinkUrl:
 *  - mode=train: https://www.irctc.co.in/nget/train-search
 *  - mode=bus: https://www.redbus.in/
 */
router.get('/search', async (req, res, next) => {
  try {
    const { mode, origin, destination } = req.query;

    const filter = {};

    // Validate and apply mode filter
    let bookingLinkUrl = null;
    if (mode && typeof mode === 'string' && mode.trim()) {
      const cleanMode = mode.trim().toLowerCase();
      if (!['train', 'bus'].includes(cleanMode)) {
        return res.status(400).json({
          error: 'mode must be either "train" or "bus"',
        });
      }
      filter.mode = cleanMode;
      bookingLinkUrl =
        cleanMode === 'train'
          ? 'https://www.irctc.co.in/nget/train-search'
          : 'https://www.redbus.in/';
    }

    // Apply origin filter (case-insensitive)
    if (origin && typeof origin === 'string' && origin.trim()) {
      filter.origin = new RegExp(`^${origin.trim()}$`, 'i');
    }

    // Apply destination filter (case-insensitive)
    if (destination && typeof destination === 'string' && destination.trim()) {
      filter.destination = new RegExp(`^${destination.trim()}$`, 'i');
    }

    // Query curated routes from database
    const matchingRoutes = await CuratedRoute.find(filter).lean();

    // If mode was not explicitly supplied in query but all returned routes share a single mode:
    if (!bookingLinkUrl && matchingRoutes.length > 0) {
      const allTrain = matchingRoutes.every((r) => r.mode === 'train');
      const allBus = matchingRoutes.every((r) => r.mode === 'bus');
      if (allTrain) {
        bookingLinkUrl = 'https://www.irctc.co.in/nget/train-search';
      } else if (allBus) {
        bookingLinkUrl = 'https://www.redbus.in/';
      }
    }

    return res.status(200).json({
      routes: matchingRoutes || [],
      curatedRoutes: matchingRoutes || [],
      bookingLinkUrl,
    });
  } catch (error) {
    console.error('Error searching routes:', error);
    return res.status(500).json({
      error: error.message || 'Failed to search curated routes',
    });
  }
});

export default router;

