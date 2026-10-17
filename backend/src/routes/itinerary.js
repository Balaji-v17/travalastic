import express from 'express';
import mongoose from 'mongoose';
import graph from '../services/agents/graph.js';
import authenticate from '../middleware/authenticate.js';
import Itinerary, { findUserItinerary } from '../models/Itinerary.js';
import Booking from '../models/Booking.js';
import Expense from '../models/Expense.js';
import { generatePackingList } from '../services/packingListService.js';
import { calculateExpenseSplits } from '../services/expenseSplitting.js';
import { searchPlaces } from '../services/placesService.js';
import { rateLimit } from 'express-rate-limit';
import {
  fetch3HourForecast,
  computeRainBuckets,
  matchesSuggestedTimeBucket,
  classifyActivitiesOutdoor,
} from '../services/weatherAlerts.js';
import {
  applySnapshot,
  formatUndo,
  saveItineraryEditSnapshot,
} from '../services/undoService.js';
import {
  generateRescheduleProposal,
  normalizeProposal,
  applyReschedule,
  ALLOWED_DELAYS,
  DROP_MIN_DELAY_MINUTES,
} from '../services/rescheduleService.js';
import { applyOrder } from '../services/reorderService.js';
import { toInr } from '../services/fxRates.js';
import PackingTemplate from '../models/PackingTemplate.js';
import { mergeTemplateItems } from '../services/packingTemplateService.js';

const reschedulePreviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => (req.userId ? req.userId.toString() : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many reschedule previews requested. Please try again after an hour.' },
});

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
 * limited to the 5 most recent (or ?limit=N), with bookingsCount on each itinerary.
 */
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    let query = Itinerary.find({ userId: req.userId }).sort({ createdAt: -1 });
    if (limit && !isNaN(limit)) {
      query = query.limit(limit);
    }
    const itineraries = await query.exec();

    if (!itineraries || itineraries.length === 0) {
      return res.status(200).json([]);
    }

    const itineraryIds = itineraries.map((it) => it._id);

    const counts = await Booking.aggregate([
      {
        $match: {
          itineraryId: { $in: itineraryIds },
        },
      },
      {
        $group: {
          _id: '$itineraryId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map();
    counts.forEach((c) => {
      if (c._id) {
        countMap.set(c._id.toString(), c.count);
      }
    });

    const results = itineraries.map((it) => {
      const doc = typeof it.toObject === 'function' ? it.toObject() : { ...it };
      delete doc.editHistory;
      let computedBudgetEstimate = doc.budgetEstimate;
      if (!computedBudgetEstimate && Array.isArray(doc.days)) {
        const daySum = doc.days.reduce((acc, d) => acc + (d.estimatedCostINR || 0), 0);
        if (daySum > 0) {
          computedBudgetEstimate = daySum;
        }
      }
      if (!computedBudgetEstimate) {
        const tier = (doc.budgetTier || 'mid').toLowerCase();
        const dailyRates = { budget: 1500, mid: 4000, luxury: 10000 };
        const rate = dailyRates[tier] || 4000;
        const numDays = Array.isArray(doc.days) && doc.days.length > 0 ? doc.days.length : 1;
        computedBudgetEstimate = numDays * rate;
      }
      return {
        ...doc,
        budgetEstimate: computedBudgetEstimate,
        bookingsCount: countMap.get(doc._id.toString()) || 0,
        undo: formatUndo(it.editHistory),
      };
    });

    return res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /itinerary/:id/packing-list (and /itinerary/:itineraryId/packing-list)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary.
 *
 * If packingList already exists on the document and no { regenerate: true }
 * flag is passed, returns the cached version without invoking the LLM.
 * Otherwise, generates an activity-aware packing list via Groq (or fallback),
 * saves it to the itinerary document, and returns it.
 */
router.post(['/:id/packing-list', '/:itineraryId/packing-list'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { regenerate } = req.body || {};

    // Return cached version if already exists and no regenerate: true passed
    if (!regenerate && Array.isArray(itinerary.packingList) && itinerary.packingList.length > 0) {
      return res.status(200).json({
        packingList: itinerary.packingList,
        customItems: itinerary.packingCustomItems || [],
        checked: itinerary.packingChecked || [],
      });
    }

    const packingList = await generatePackingList(itinerary);

    itinerary.packingList = packingList;

    // On regenerate: replace packingList only, keep packingCustomItems untouched,
    // and drop only the "ai::" keys from packingChecked whose item no longer exists in the new list.
    if (Array.isArray(itinerary.packingChecked)) {
      const validAiKeys = new Set();
      for (const cat of packingList) {
        if (Array.isArray(cat.items)) {
          for (const item of cat.items) {
            validAiKeys.add(`ai::${cat.category}::${item}`);
          }
        }
      }
      itinerary.packingChecked = itinerary.packingChecked.filter((key) => {
        if (key.startsWith('ai::')) {
          return validAiKeys.has(key);
        }
        return true;
      });
    }

    await itinerary.save();

    return res.status(200).json({
      packingList: itinerary.packingList,
      customItems: itinerary.packingCustomItems || [],
      checked: itinerary.packingChecked || [],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /itinerary/:id/packing/custom (and /:itineraryId/packing/custom)
 * Auth-protected, ownership-checked.
 * Body: { text: string, category?: string }
 * Max 80 chars, max 50 custom items per trip.
 * Returns the updated custom item list.
 */
router.post(['/:id/packing/custom', '/:itineraryId/packing/custom'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { text, category } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim() || text.trim().length > 80) {
      return res.status(400).json({ error: 'Item text is required and must be at most 80 characters' });
    }

    if ((itinerary.packingCustomItems || []).length >= 50) {
      return res.status(400).json({ error: 'Maximum limit of 50 custom packing items per trip reached' });
    }

    const trimmedCategory = (category && typeof category === 'string' && category.trim())
      ? category.trim()
      : 'My items';

    itinerary.packingCustomItems.push({
      text: text.trim(),
      category: trimmedCategory,
    });

    await itinerary.save();

    return res.status(201).json(itinerary.packingCustomItems);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /itinerary/:id/packing/custom/:itemId (and /:itineraryId/packing/custom/:itemId)
 * Auth-protected, ownership-checked.
 * Removes the custom item and removes its "custom::<itemId>" key from packingChecked.
 */
router.delete(['/:id/packing/custom/:itemId', '/:itineraryId/packing/custom/:itemId'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { itemId } = req.params;
    const item = itinerary.packingCustomItems.id(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Custom packing item not found' });
    }

    itinerary.packingCustomItems.pull({ _id: itemId });

    const customKey = `custom::${itemId}`;
    itinerary.packingChecked = (itinerary.packingChecked || []).filter((k) => k !== customKey);

    await itinerary.save();

    return res.status(200).json({
      success: true,
      customItems: itinerary.packingCustomItems,
      checked: itinerary.packingChecked,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /itinerary/:id/packing/apply-template (and /:itineraryId/packing/apply-template)
 * Auth-protected, ownership-checked on itinerary and template (generic 404).
 * Body: { templateId: string, dryRun?: boolean }
 * Computes which template items to add:
 * - skips any whose trimmed, case-insensitive text exists in AI packing list or custom items
 * - adds the rest as custom items (keeping category) until 50-custom-item cap
 * Returns { added, skippedDuplicates, skippedOverCap }
 * If dryRun is true, writes nothing.
 */
router.post(
  ['/:id/packing/apply-template', '/:itineraryId/packing/apply-template'],
  authenticate,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const { templateId, dryRun } = req.body || {};
      if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
        return res.status(404).json({ error: 'Packing template not found' });
      }

      const template = await PackingTemplate.findOne({
        _id: templateId,
        userId: req.userId,
      });

      if (!template) {
        return res.status(404).json({ error: 'Packing template not found' });
      }

      // Extract existing texts from AI list and custom items
      const existingTexts = [];
      if (Array.isArray(itinerary.packingList)) {
        for (const cat of itinerary.packingList) {
          if (Array.isArray(cat?.items)) {
            for (const item of cat.items) {
              if (typeof item === 'string') {
                existingTexts.push(item);
              }
            }
          }
        }
      }

      if (Array.isArray(itinerary.packingCustomItems)) {
        for (const c of itinerary.packingCustomItems) {
          if (c?.text && typeof c.text === 'string') {
            existingTexts.push(c.text);
          }
        }
      }

      const currentCustomCount = Array.isArray(itinerary.packingCustomItems)
        ? itinerary.packingCustomItems.length
        : 0;
      const slotsLeft = Math.max(0, 50 - currentCustomCount);

      const { added, skippedDuplicates, skippedOverCap, itemsToAdd } =
        mergeTemplateItems(existingTexts, template.items, slotsLeft);

      if (!dryRun) {
        if (!Array.isArray(itinerary.packingCustomItems)) {
          itinerary.packingCustomItems = [];
        }
        for (const item of itemsToAdd) {
          itinerary.packingCustomItems.push(item);
        }
        await itinerary.save();
      }

      return res.status(200).json({
        added,
        skippedDuplicates,
        skippedOverCap,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /itinerary/:id/packing/checked (and /:itineraryId/packing/checked)
 * Auth-protected, ownership-checked.
 * Body: { key: string, checked: boolean }
 * Atomic toggle via $addToSet / $pull. Key max 200 chars, cap packingChecked at 500 entries.
 */
router.patch(['/:id/packing/checked', '/:itineraryId/packing/checked'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { key, checked } = req.body || {};

    if (!key || typeof key !== 'string' || !key.trim() || key.trim().length > 200) {
      return res.status(400).json({ error: 'key must be a non-empty string of at most 200 characters' });
    }

    if (typeof checked !== 'boolean') {
      return res.status(400).json({ error: 'checked must be a boolean' });
    }

    const trimmedKey = key.trim();

    if (checked) {
      // Check limit before adding new entry
      const currentChecked = itinerary.packingChecked || [];
      if (currentChecked.length >= 500 && !currentChecked.includes(trimmedKey)) {
        return res.status(400).json({ error: 'Maximum limit of 500 checked items reached' });
      }

      const updated = await Itinerary.findOneAndUpdate(
        { _id: itinerary._id, userId: req.userId },
        { $addToSet: { packingChecked: trimmedKey } },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        checked: updated.packingChecked || [],
      });
    } else {
      const updated = await Itinerary.findOneAndUpdate(
        { _id: itinerary._id, userId: req.userId },
        { $pull: { packingChecked: trimmedKey } },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        checked: updated.packingChecked || [],
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itinerary/:id/bookings (and /itinerary/:itineraryId/bookings)
 * Auth-protected, ownership-checked via findUserItinerary.
 * Returns flight bookings linked to this itinerary with route,
 * departure time, and status in full detail.
 */
router.get('/:id/bookings', authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const bookings = await Booking.find({
      itineraryId: itinerary._id,
    }).sort({ departureTime: 1, createdAt: -1 });

    const formatted = bookings.map((b) => {
      const doc = typeof b.toObject === 'function' ? b.toObject() : { ...b };
      const route = doc.origin && doc.destination
        ? `${doc.origin} → ${doc.destination}`
        : doc.slices?.[0]?.origin?.iata_code && doc.slices?.[0]?.destination?.iata_code
        ? `${doc.slices[0].origin.iata_code} → ${doc.slices[0].destination.iata_code}`
        : '';
      return {
        ...doc,
        bookingId: doc._id,
        route: route || doc.route || 'Flight Route',
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /itinerary/:id/travelers (and /itinerary/:itineraryId/travelers)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary (missing/not-yours returns 404).
 * Body: { name } (trimmed, 1-30 chars, case-insensitive unique in trip, not "me" or "you", max 10 travelers).
 */
router.post(['/:id/travelers', '/:itineraryId/travelers'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { name } = req.body || {};
    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Traveler name is required' });
    }

    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 30) {
      return res.status(400).json({ error: 'Traveler name must be between 1 and 30 characters' });
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'me' || lower === 'you') {
      return res.status(400).json({ error: 'Traveler name cannot be "me" or "you"' });
    }

    if ((itinerary.travelers || []).length >= 10) {
      return res.status(400).json({ error: 'Maximum of 10 travelers allowed per trip' });
    }

    const isDuplicate = (itinerary.travelers || []).some(
      (t) => t.name.toLowerCase() === lower
    );
    if (isDuplicate) {
      return res.status(400).json({ error: 'A traveler with this name already exists' });
    }

    itinerary.travelers.push({ name: trimmed });
    await itinerary.save();

    const createdTraveler = itinerary.travelers[itinerary.travelers.length - 1];

    return res.status(201).json({
      traveler: createdTraveler,
      travelers: itinerary.travelers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /itinerary/:id/travelers/:travelerId (and /itinerary/:itineraryId/travelers/:travelerId)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary.
 * Body: { name } (trimmed, 1-30 chars, case-insensitive unique in trip, not "me" or "you").
 */
router.patch(
  ['/:id/travelers/:travelerId', '/:itineraryId/travelers/:travelerId'],
  authenticate,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const { travelerId } = req.params;
      const traveler = itinerary.travelers.id(travelerId);
      if (!traveler) {
        return res.status(404).json({ error: 'Traveler not found' });
      }

      const { name } = req.body || {};
      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'Traveler name is required' });
      }

      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 30) {
        return res.status(400).json({ error: 'Traveler name must be between 1 and 30 characters' });
      }

      const lower = trimmed.toLowerCase();
      if (lower === 'me' || lower === 'you') {
        return res.status(400).json({ error: 'Traveler name cannot be "me" or "you"' });
      }

      const isDuplicate = (itinerary.travelers || []).some(
        (t) => t._id.toString() !== travelerId && t.name.toLowerCase() === lower
      );
      if (isDuplicate) {
        return res.status(400).json({ error: 'A traveler with this name already exists' });
      }

      traveler.name = trimmed;
      await itinerary.save();

      return res.status(200).json({
        traveler,
        travelers: itinerary.travelers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /itinerary/:id/travelers/:travelerId (and /itinerary/:itineraryId/travelers/:travelerId)
 * Protected by JWT authenticate middleware.
 * Returns 409 if any expense references that traveler (paidBy or splitAmong). Do not cascade.
 */
router.delete(
  ['/:id/travelers/:travelerId', '/:itineraryId/travelers/:travelerId'],
  authenticate,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const { travelerId } = req.params;
      const traveler = itinerary.travelers.id(travelerId);
      if (!traveler) {
        return res.status(404).json({ error: 'Traveler not found' });
      }

      // Check if any expense in this itinerary references the traveler
      const referenced = await Expense.findOne({
        itineraryId: itinerary._id,
        $or: [{ paidBy: travelerId }, { splitAmong: travelerId }],
      });

      if (referenced) {
        return res.status(409).json({
          error: 'Cannot delete traveler because they are referenced in one or more expenses.',
        });
      }

      itinerary.travelers.pull({ _id: travelerId });
      await itinerary.save();

      return res.status(200).json({
        success: true,
        message: 'Traveler deleted successfully',
        travelers: itinerary.travelers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /itinerary/:id/expenses (and /itinerary/:itineraryId/expenses)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary.
 * Accepts { description, amountINR, category, paidBy?, splitAmong? }.
 * Validates inputs and creates an Expense record.
 */
router.post(['/:id/expenses', '/:itineraryId/expenses'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const {
      description,
      amountINR,
      originalAmount,
      originalCurrency,
      fxRate,
      fxRateDate,
      fxRateSource,
      category,
      paidBy,
      splitAmong,
    } = req.body || {};

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const isForeign =
      originalCurrency !== undefined &&
      originalCurrency !== null &&
      String(originalCurrency).trim().toUpperCase() !== 'INR';

    let finalAmountINR;
    let normalizedCurrency = 'INR';
    let parsedOriginalAmount = null;
    let parsedFxRate = null;
    let validFxRateDate = null;
    let validFxRateSource = null;

    if (!isForeign) {
      const parsedAmount = Number(amountINR);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amountINR must be a positive number' });
      }
      finalAmountINR = parsedAmount;
    } else {
      if (
        typeof originalCurrency !== 'string' ||
        !/^[A-Z]{3}$/.test(originalCurrency.trim().toUpperCase())
      ) {
        return res.status(400).json({ error: 'originalCurrency must be a 3-letter currency code' });
      }
      normalizedCurrency = originalCurrency.trim().toUpperCase();

      parsedOriginalAmount = Number(originalAmount);
      if (
        isNaN(parsedOriginalAmount) ||
        !Number.isFinite(parsedOriginalAmount) ||
        parsedOriginalAmount <= 0
      ) {
        return res.status(400).json({ error: 'originalAmount must be a positive number' });
      }

      const strAmount = String(originalAmount).trim();
      if (strAmount.includes('.')) {
        const decimals = strAmount.split('.')[1];
        if (decimals && decimals.length > 2) {
          return res.status(400).json({ error: 'originalAmount must have at most 2 decimal places' });
        }
      }

      parsedFxRate = Number(fxRate);
      if (
        isNaN(parsedFxRate) ||
        !Number.isFinite(parsedFxRate) ||
        parsedFxRate <= 0.000001 ||
        parsedFxRate >= 1000000
      ) {
        return res.status(400).json({
          error: 'fxRate must be a finite number between 0.000001 and 1000000',
        });
      }

      if (!fxRateDate || typeof fxRateDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fxRateDate.trim())) {
        return res.status(400).json({ error: 'fxRateDate must be in YYYY-MM-DD format' });
      }
      validFxRateDate = fxRateDate.trim();

      if (!fxRateSource || (fxRateSource !== 'ecb' && fxRateSource !== 'manual')) {
        return res.status(400).json({ error: "fxRateSource must be 'ecb' or 'manual'" });
      }
      validFxRateSource = fxRateSource;

      // Server computes amountINR and ignores any client-sent amountINR
      finalAmountINR = toInr(parsedOriginalAmount, parsedFxRate);
    }

    const validCategories = ['Food', 'Transport', 'Accommodation', 'Activities', 'Shopping', 'Other'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({
        error: `Category must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Valid participants are 'me' and each traveler's string _id
    const validParticipantIds = new Set([
      'me',
      ...(itinerary.travelers || []).map((t) => t._id.toString()),
    ]);

    let resolvedPaidBy = 'me';
    if (paidBy !== undefined && paidBy !== null) {
      if (typeof paidBy !== 'string' || !paidBy.trim()) {
        return res.status(400).json({ error: 'paidBy must be a valid participant ID' });
      }
      resolvedPaidBy = paidBy.trim();
      if (!validParticipantIds.has(resolvedPaidBy)) {
        return res.status(400).json({ error: `Invalid paidBy participant ID: ${resolvedPaidBy}` });
      }
    }

    let resolvedSplitAmong = [];
    if (splitAmong !== undefined && splitAmong !== null) {
      if (!Array.isArray(splitAmong)) {
        return res.status(400).json({ error: 'splitAmong must be an array of participant IDs' });
      }
      const seen = new Set();
      for (const item of splitAmong) {
        if (typeof item !== 'string' || !item.trim()) {
          return res.status(400).json({ error: 'Each splitAmong item must be a valid participant ID string' });
        }
        const participantId = item.trim();
        if (!validParticipantIds.has(participantId)) {
          return res.status(400).json({ error: `Invalid participant ID in splitAmong: ${participantId}` });
        }
        if (seen.has(participantId)) {
          return res.status(400).json({ error: `Duplicate participant ID in splitAmong: ${participantId}` });
        }
        seen.add(participantId);
      }
      resolvedSplitAmong = Array.from(seen);
    }

    const expenseData = {
      itineraryId: itinerary._id,
      userId: req.userId,
      description: description.trim(),
      amountINR: finalAmountINR,
      category,
      paidBy: resolvedPaidBy,
      splitAmong: resolvedSplitAmong,
    };

    if (isForeign) {
      expenseData.originalAmount = parsedOriginalAmount;
      expenseData.originalCurrency = normalizedCurrency;
      expenseData.fxRate = parsedFxRate;
      expenseData.fxRateDate = validFxRateDate;
      expenseData.fxRateSource = validFxRateSource;
    }

    const expense = await Expense.create(expenseData);

    return res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itinerary/:id/expenses (and /itinerary/:itineraryId/expenses)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary.
 * Returns { travelers, expenses, totals: { groupTotalPaise, yourSharePaise }, balances, settlements, totalSpent }.
 */
router.get(['/:id/expenses', '/:itineraryId/expenses'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const expenses = await Expense.find({
      itineraryId: itinerary._id,
    }).sort({ createdAt: -1 });

    const totalSpent = expenses.reduce((sum, item) => sum + (Number(item.amountINR) || 0), 0);
    const { totals, balances, settlements } = calculateExpenseSplits(
      expenses,
      itinerary.travelers || []
    );

    return res.status(200).json({
      travelers: itinerary.travelers || [],
      expenses,
      totals,
      balances,
      settlements,
      totalSpent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /itinerary/:id/expenses/:expenseId
 * Fallback route for deleting an expense within itinerary scope.
 */
router.delete(['/:id/expenses/:expenseId', '/:itineraryId/expenses/:expenseId'], authenticate, async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    if (expense.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this expense' });
    }
    await Expense.findByIdAndDelete(expenseId);
    return res.status(200).json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /itinerary/:id/activities/done (and /:itineraryId/activities/done)
 * Protected by JWT authenticate middleware.
 * Accepts: { dayNumber: number, index: number, expectedTitle: string, done: boolean }
 * Ownership-checked via findUserItinerary (generic 404).
 * Validates parameters: dayNumber within trip, index 0-49, expectedTitle string, done boolean (400).
 * One atomic conditional update checking activity at dayNumber and index still has expectedTitle.
 * Returns 409 "This activity changed. Please refresh." if mismatch or concurrent edit.
 * Returns the updated day.
 */
router.patch(['/:id/activities/done', '/:itineraryId/activities/done'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { dayNumber, index, expectedTitle, done } = req.body || {};

    if (
      typeof dayNumber !== 'number' ||
      !Number.isInteger(dayNumber) ||
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 49 ||
      typeof expectedTitle !== 'string' ||
      typeof done !== 'boolean'
    ) {
      return res.status(400).json({
        error:
          'Invalid parameters: dayNumber, index (0-49), expectedTitle (string), and done (boolean) required',
      });
    }

    const targetDay = Array.isArray(itinerary.days)
      ? itinerary.days.find((d) => d.dayNumber === dayNumber)
      : null;

    if (!targetDay) {
      return res.status(400).json({ error: 'dayNumber is not within this trip' });
    }

    const titleVariants = Array.from(new Set([expectedTitle, expectedTitle.trim()].filter(Boolean)));

    // One atomic conditional update matching only if the activity at that day and index still has expectedTitle
    const query = {
      _id: itinerary._id,
      userId: req.userId,
      days: {
        $elemMatch: {
          dayNumber,
          $or: [
            { [`activities.${index}.title`]: { $in: titleVariants } },
            { [`activities.${index}.name`]: { $in: titleVariants } },
          ],
        },
      },
    };

    const update = {
      $set: {
        [`days.$.activities.${index}.done`]: done,
      },
    };

    const updatedItinerary = await Itinerary.findOneAndUpdate(query, update, { new: true });

    if (!updatedItinerary) {
      return res.status(409).json({ error: 'This activity changed. Please refresh.' });
    }

    const updatedDay = updatedItinerary.days.find((d) => d.dayNumber === dayNumber);
    const dayObj =
      updatedDay && typeof updatedDay.toObject === 'function'
        ? updatedDay.toObject()
        : updatedDay;

    return res.status(200).json(dayObj);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /itinerary/:id/days/:dayNumber/order (and /:itineraryId/days/:dayNumber/order)
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary (generic 404).
 * Accepts: { order: number[], expectedTitles: string[] }
 * Validates:
 * - dayNumber is within the trip (400)
 * - order is an exact permutation of 0..n-1 where n is the activity count (400)
 * - every done activity stays at its own index (order[i] === i for each done i) (400)
 * - expectedTitles matches current titles (409 "This day changed. Please reopen it.")
 * Applies with one conditional write so concurrent modification triggers 409.
 * Does NOT touch costs, accommodation, or any other day.
 * Does NOT create an undo snapshot.
 * Returns the updated day.
 */
router.put(
  ['/:id/days/:dayNumber/order', '/:itineraryId/days/:dayNumber/order'],
  authenticate,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const dayNumber = parseInt(req.params.dayNumber, 10);
      if (isNaN(dayNumber)) {
        return res.status(400).json({ error: 'dayNumber must be an integer' });
      }

      const targetDay = Array.isArray(itinerary.days)
        ? itinerary.days.find((d) => d.dayNumber === dayNumber)
        : null;

      if (!targetDay) {
        return res.status(400).json({ error: 'dayNumber is not within this trip' });
      }

      const activities = targetDay.activities || [];
      const n = activities.length;
      const { order, expectedTitles } = req.body || {};

      if (!Array.isArray(order) || order.length !== n) {
        return res.status(400).json({
          error: `order must be an array of length ${n}`,
        });
      }

      if (!Array.isArray(expectedTitles) || expectedTitles.length !== n) {
        return res.status(400).json({
          error: `expectedTitles must be an array of length ${n}`,
        });
      }

      // Validate permutation & done activity stability via pure applyOrder
      let reorderedActivities;
      try {
        reorderedActivities = applyOrder(activities, order);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      // Validate expectedTitles matches current titles
      for (let i = 0; i < n; i++) {
        const currentTitle = activities[i]?.title || activities[i]?.name || '';
        if (expectedTitles[i] !== currentTitle) {
          return res.status(409).json({ error: 'This day changed. Please reopen it.' });
        }
      }

      // Conditional atomic write: match day and every current activity title at each index
      const elemMatchQuery = { dayNumber };
      for (let i = 0; i < n; i++) {
        const titleVariants = Array.from(
          new Set([expectedTitles[i], expectedTitles[i].trim()].filter(Boolean))
        );
        elemMatchQuery[`activities.${i}.title`] = { $in: titleVariants };
      }

      const query = {
        _id: itinerary._id,
        userId: req.userId,
        days: {
          $elemMatch: elemMatchQuery,
        },
      };

      const update = {
        $set: {
          'days.$.activities': reorderedActivities,
        },
      };

      const updatedItinerary = await Itinerary.findOneAndUpdate(query, update, { new: true });

      if (!updatedItinerary) {
        return res.status(409).json({ error: 'This day changed. Please reopen it.' });
      }

      const updatedDay = updatedItinerary.days.find((d) => d.dayNumber === dayNumber);
      const dayObj =
        updatedDay && typeof updatedDay.toObject === 'function'
          ? updatedDay.toObject()
          : updatedDay;

      return res.status(200).json(dayObj);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /itinerary/:id/reschedule/preview (and /:itineraryId/reschedule/preview)
 * Protected by JWT authenticate middleware.
 * Accepts: { dayNumber: number, delayMinutes: number }
 * Rate-limited to ~10 previews per user per hour.
 * Ownership-checked via findUserItinerary (generic 404).
 * Validates delayMinutes is one of 30, 60, 120, 180 (400 otherwise).
 * Validates dayNumber is within the trip (400 otherwise).
 * Considers ONLY activities that are not done; if none, returns 400 "Nothing left to reschedule".
 * Returns { dayNumber, delayMinutes, summary, items: [{ index, title, action, currentBucket, newBucket, reason }] }.
 * Stores nothing.
 */
router.post(
  ['/:id/reschedule/preview', '/:itineraryId/reschedule/preview'],
  authenticate,
  reschedulePreviewLimiter,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const { dayNumber, delayMinutes } = req.body || {};

      if (
        typeof delayMinutes !== 'number' ||
        !ALLOWED_DELAYS.includes(delayMinutes)
      ) {
        return res.status(400).json({
          error: `delayMinutes must be one of: ${ALLOWED_DELAYS.join(', ')}`,
        });
      }

      if (typeof dayNumber !== 'number' || !Number.isInteger(dayNumber)) {
        return res.status(400).json({ error: 'dayNumber must be an integer' });
      }

      const day = Array.isArray(itinerary.days)
        ? itinerary.days.find((d) => d.dayNumber === dayNumber)
        : null;

      if (!day) {
        return res.status(400).json({ error: 'dayNumber is not within this trip' });
      }

      const activities = Array.isArray(day.activities) ? day.activities : [];
      const notDoneActivities = activities.filter(
        (a) => typeof a === 'string' || a?.done !== true
      );

      if (notDoneActivities.length === 0) {
        return res.status(400).json({ error: 'Nothing left to reschedule' });
      }

      const proposal = await generateRescheduleProposal({
        destination: itinerary.destination || '',
        dayNumber,
        delayMinutes,
        day,
      });

      return res.status(200).json(proposal);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /itinerary/:id/reschedule/apply (and /:itineraryId/reschedule/apply)
 * Protected by JWT authenticate middleware.
 * Accepts: { dayNumber: number, items: Array<Object> }
 * Ownership-checked via findUserItinerary (generic 404).
 * Re-runs validation against CURRENT day:
 * - Every item's title must match the activity currently at that index
 * - No referenced activity may be done
 * - Returns 409 "Your day changed. Please try again." on mismatch
 * Deterministically applies with NO LLM call:
 * - moved activities get their new suggestedTime bucket
 * - dropped activities are removed
 * - done activities stay in their current positions
 * - remaining activities fill other positions, ordered by bucket (Morning, Afternoon, Evening, Night)
 *   keeping relative order within a bucket
 * Don't recompute any cost.
 * Saves through shared atomic snapshot-and-write routine so Undo works.
 * Returns { updatedDay, editId }.
 */
router.post(
  ['/:id/reschedule/apply', '/:itineraryId/reschedule/apply'],
  authenticate,
  async (req, res, next) => {
    try {
      const targetId = req.params.id || req.params.itineraryId;
      const itinerary = await findUserItinerary(targetId, req.userId);

      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }

      const { dayNumber, items } = req.body || {};

      if (typeof dayNumber !== 'number' || !Number.isInteger(dayNumber)) {
        return res.status(400).json({ error: 'dayNumber must be an integer' });
      }

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items must be an array' });
      }

      const existingDays = Array.isArray(itinerary.days) ? itinerary.days : [];
      const day = existingDays.find((d) => d.dayNumber === dayNumber);

      if (!day) {
        return res.status(400).json({ error: 'dayNumber is not within this trip' });
      }

      const activities = Array.isArray(day.activities) ? day.activities : [];

      // Re-run validation against CURRENT day
      for (const item of items) {
        if (!item || typeof item.index !== 'number' || !Number.isInteger(item.index)) {
          return res.status(409).json({ error: 'Your day changed. Please try again.' });
        }
        if (item.index < 0 || item.index >= activities.length) {
          return res.status(409).json({ error: 'Your day changed. Please try again.' });
        }
        const act = activities[item.index];
        const isDone = typeof act !== 'string' && act?.done === true;
        if (isDone) {
          return res.status(409).json({ error: 'Your day changed. Please try again.' });
        }
        const currentTitle = typeof act === 'string' ? act : (act?.title || act?.name || '');
        const expectedTitle = typeof item.title === 'string' ? item.title : '';
        if (currentTitle.trim() !== expectedTitle.trim()) {
          return res.status(409).json({ error: 'Your day changed. Please try again.' });
        }
      }

      // Normalize proposal items against current day
      const normalizedItems = normalizeProposal(day, 120, items);

      // Apply deterministically with NO LLM call
      const updatedDay = applyReschedule(day, normalizedItems);

      // Merge back into full days array, leaving untouched days intact
      const newDays = existingDays.map((d) =>
        d.dayNumber === dayNumber ? updatedDay : d
      );

      // Save through the same atomic snapshot-and-write routine that chat edits use
      const previousDays = [
        typeof day.toObject === 'function' ? day.toObject() : JSON.parse(JSON.stringify(day)),
      ];

      const { editId } = await saveItineraryEditSnapshot({
        itineraryId: itinerary._id,
        userId: req.userId,
        newDays,
        modifiedDayNumbers: [dayNumber],
        previousDays,
      });

      const dayObj =
        typeof updatedDay.toObject === 'function'
          ? updatedDay.toObject()
          : updatedDay;

      return res.status(200).json({
        updatedDay: dayObj,
        editId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /itinerary/:id/today-alerts (and /:itineraryId/today-alerts)
 * Query: ?date=YYYY-MM-DD
 * Protected by JWT authenticate middleware.
 * Ownership-checked via findUserItinerary (generic 404).
 * Returns 400 if date is outside trip's dates.
 * Returns { rain: [{ bucket, probabilityPercent }], flagged: [{ title, bucket }] }
 * If forecast fails, returns 200 with { rain: [], flagged: [], unavailable: true }.
 */
router.get(['/:id/today-alerts', '/:itineraryId/today-alerts'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const { date } = req.query;
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date query parameter (YYYY-MM-DD) is required' });
    }

    // Date range check
    let currentDayNumber = null;
    if (itinerary.startDate) {
      const startMs = new Date(itinerary.startDate + 'T00:00:00Z').getTime();
      const targetMs = new Date(date + 'T00:00:00Z').getTime();
      const diffDays = Math.floor((targetMs - startMs) / (1000 * 60 * 60 * 24));
      currentDayNumber = diffDays + 1;

      if (itinerary.endDate) {
        const endMs = new Date(itinerary.endDate + 'T00:00:00Z').getTime();
        if (targetMs < startMs || targetMs > endMs) {
          return res.status(400).json({ error: 'Date is outside the trip dates' });
        }
      } else if (targetMs < startMs) {
        return res.status(400).json({ error: 'Date is outside the trip dates' });
      }

      const totalDays = Array.isArray(itinerary.days) ? itinerary.days.length : 0;
      if (totalDays > 0 && (currentDayNumber < 1 || currentDayNumber > totalDays)) {
        return res.status(400).json({ error: 'Date is outside the trip dates' });
      }
    } else {
      currentDayNumber = 1;
    }

    // Destination coordinates
    let lat = itinerary.destinationCoordinates?.lat;
    let lon = itinerary.destinationCoordinates?.lon;

    if (lat == null || lon == null) {
      if (!itinerary.destination) {
        return res.status(200).json({ rain: [], flagged: [], unavailable: true });
      }
      try {
        const places = await searchPlaces(itinerary.destination);
        if (places && places.length > 0 && places[0].latitude != null && places[0].longitude != null) {
          lat = places[0].latitude;
          lon = places[0].longitude;
          itinerary.destinationCoordinates = { lat, lon };
          await itinerary.save();
        }
      } catch (geoErr) {
        console.warn('Geocoding destination failed:', geoErr.message);
      }
    }

    if (lat == null || lon == null) {
      return res.status(200).json({ rain: [], flagged: [], unavailable: true });
    }

    // Fetch 3-hour forecast
    let forecastData;
    try {
      forecastData = await fetch3HourForecast(lat, lon);
    } catch (forecastErr) {
      console.warn('OpenWeather 3-hour forecast failed:', forecastErr.message);
      return res.status(200).json({ rain: [], flagged: [], unavailable: true });
    }

    // Compute rain buckets
    const rainBuckets = computeRainBuckets(
      forecastData.list,
      forecastData.timezoneOffsetSeconds,
      new Date(),
      date
    );

    if (rainBuckets.length === 0) {
      return res.status(200).json({ rain: [], flagged: [] });
    }

    // Match activities on this day whose suggestedTime matches a rainy bucket
    const dayPlan = Array.isArray(itinerary.days)
      ? itinerary.days.find((d) => d.dayNumber === currentDayNumber)
      : null;
    const activities = Array.isArray(dayPlan?.activities) ? dayPlan.activities : [];

    const rainyBucketNames = rainBuckets.map((b) => b.bucket);
    const matchingActivities = [];

    for (const act of activities) {
      const actObj = typeof act.toObject === 'function' ? act.toObject() : act;
      // Activities marked done are never flagged
      if (actObj.done === true) {
        continue;
      }
      const suggestedTime = actObj.suggestedTime;
      const matchedBucket = rainyBucketNames.find((b) =>
        matchesSuggestedTimeBucket(suggestedTime, b)
      );
      if (matchedBucket) {
        matchingActivities.push({
          activity: act,
          actObj,
          matchedBucket,
        });
      }
    }

    if (matchingActivities.length === 0) {
      return res.status(200).json({
        rain: rainBuckets.map(({ bucket, probabilityPercent }) => ({
          bucket,
          probabilityPercent,
        })),
        flagged: [],
      });
    }

    // Classify activities where outdoor === null or undefined
    const unclassified = matchingActivities.filter(
      (m) => m.actObj.outdoor === null || m.actObj.outdoor === undefined
    );

    if (unclassified.length > 0) {
      try {
        const classifications = await classifyActivitiesOutdoor(
          unclassified.map((m) => ({
            title: m.actObj.title || m.actObj.name || '',
            description: m.actObj.description || '',
          }))
        );

        let modified = false;
        unclassified.forEach((m, idx) => {
          const val = classifications[idx]; // true, false, or null
          m.activity.outdoor = val;
          m.actObj.outdoor = val;
          modified = true;
        });

        if (modified) {
          itinerary.markModified('days');
          await itinerary.save();
        }
      } catch (llmErr) {
        console.warn('Outdoor classification LLM error:', llmErr.message);
      }
    }

    // Activities where outdoor === true are flagged
    const flagged = [];
    for (const m of matchingActivities) {
      if (m.actObj.outdoor === true) {
        flagged.push({
          title: m.actObj.title || m.actObj.name || 'Outdoor activity',
          bucket: m.matchedBucket,
        });
      }
    }

    return res.status(200).json({
      rain: rainBuckets.map(({ bucket, probabilityPercent }) => ({
        bucket,
        probabilityPercent,
      })),
      flagged,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /itinerary/:id/undo (and /itinerary/:itineraryId/undo)
 * Protected by JWT authenticate middleware.
 * Accepts { expectedEditId: string }.
 * Verifies itinerary ownership (generic 404 if missing or unowned).
 * Checks that the newest snapshot matches expectedEditId.
 * If no history or mismatch: returns 409.
 * Restores the snapshot's previousDays and atomically pops the snapshot in ONE update.
 * Returns the updated itinerary with undo summary (never raw snapshots).
 */
router.post(['/:id/undo', '/:itineraryId/undo'], authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.id || req.params.itineraryId;
    const { expectedEditId } = req.body || {};

    if (!expectedEditId || typeof expectedEditId !== 'string' || !expectedEditId.trim()) {
      return res.status(400).json({ error: 'expectedEditId is required' });
    }

    const trimmedExpectedId = expectedEditId.trim();
    if (!mongoose.Types.ObjectId.isValid(trimmedExpectedId)) {
      return res.status(400).json({ error: 'Invalid expectedEditId format' });
    }

    const itinerary = await findUserItinerary(targetId, req.userId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const history = Array.isArray(itinerary.editHistory) ? itinerary.editHistory : [];
    if (history.length === 0) {
      return res.status(409).json({ error: 'No edit history available to undo' });
    }

    const newestSnapshot = history[history.length - 1];
    const newestIdStr = newestSnapshot._id ? newestSnapshot._id.toString() : null;

    if (newestIdStr !== trimmedExpectedId) {
      return res.status(409).json({ error: 'Expected edit ID does not match latest edit snapshot' });
    }

    const restoredDays = applySnapshot(itinerary.days, newestSnapshot);
    const expectedObjId = new mongoose.Types.ObjectId(trimmedExpectedId);

    // Atomic update: verify the last element is still expectedObjId, set restored days, and pop snapshot
    const updatedItinerary = await Itinerary.findOneAndUpdate(
      {
        _id: itinerary._id,
        userId: req.userId,
        $expr: {
          $eq: [
            { $arrayElemAt: ['$editHistory._id', -1] },
            expectedObjId,
          ],
        },
      },
      {
        $set: { days: restoredDays },
        $pop: { editHistory: 1 },
      },
      { new: true }
    );

    if (!updatedItinerary) {
      return res.status(409).json({ error: 'Concurrent edit or snapshot already undone' });
    }

    const bookingsCount = await Booking.countDocuments({
      itineraryId: updatedItinerary._id,
    });

    const doc = updatedItinerary.toObject();
    delete doc.editHistory;

    let computedBudgetEstimate = doc.budgetEstimate;
    if (!computedBudgetEstimate && Array.isArray(doc.days)) {
      const daySum = doc.days.reduce((acc, d) => acc + (d.estimatedCostINR || 0), 0);
      if (daySum > 0) {
        computedBudgetEstimate = daySum;
      }
    }
    if (!computedBudgetEstimate) {
      const tier = (doc.budgetTier || 'mid').toLowerCase();
      const dailyRates = { budget: 1500, mid: 4000, luxury: 10000 };
      const rate = dailyRates[tier] || 4000;
      const numDays = Array.isArray(doc.days) && doc.days.length > 0 ? doc.days.length : 1;
      computedBudgetEstimate = numDays * rate;
    }

    return res.status(200).json({
      ...doc,
      itineraryId: doc._id,
      itinerary: doc.days,
      bookingsCount,
      budgetEstimate: computedBudgetEstimate,
      restoredDays: newestSnapshot.dayNumbers || [],
      undo: formatUndo(updatedItinerary.editHistory),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /itinerary/:itineraryId (and /itinerary/:id)
 * Protected by JWT authenticate middleware.
 * If the itinerary doesn't exist OR doesn't belong to req.userId,
 * returns a generic 404 to avoid leaking existence across users.
 * Returns itinerary details including bookingsCount, budgetEstimate, and undo summary.
 */
router.get('/:itineraryId', authenticate, async (req, res, next) => {
  try {
    const targetId = req.params.itineraryId || req.params.id;

    const itinerary = await findUserItinerary(targetId, req.userId);

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const bookingsCount = await Booking.countDocuments({
      itineraryId: itinerary._id,
    });

    const doc = itinerary.toObject();
    delete doc.editHistory;

    let computedBudgetEstimate = doc.budgetEstimate;
    if (!computedBudgetEstimate && Array.isArray(doc.days)) {
      const daySum = doc.days.reduce((acc, d) => acc + (d.estimatedCostINR || 0), 0);
      if (daySum > 0) {
        computedBudgetEstimate = daySum;
      }
    }
    if (!computedBudgetEstimate) {
      const tier = (doc.budgetTier || 'mid').toLowerCase();
      const dailyRates = { budget: 1500, mid: 4000, luxury: 10000 };
      const rate = dailyRates[tier] || 4000;
      const numDays = Array.isArray(doc.days) && doc.days.length > 0 ? doc.days.length : 1;
      computedBudgetEstimate = numDays * rate;
    }

    return res.status(200).json({
      ...doc,
      itineraryId: doc._id,
      itinerary: doc.days,
      bookingsCount,
      budgetEstimate: computedBudgetEstimate,
      undo: formatUndo(itinerary.editHistory),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
