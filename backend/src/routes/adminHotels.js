import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import CuratedHotel from '../models/CuratedHotel.js';
import { requireAdmin, requireRole } from '../middleware/adminAuth.js';
import { runAudited } from '../services/audit.js';

const router = express.Router();

// Rate limiter: max 30 hotel mutations per minute per admin
const hotelMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many hotel modification requests. Please slow down.' },
});

// HTML tag detector regex
const HTML_REGEX = /<[^>]*>/;

export function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

const ALLOWED_HOTEL_FIELDS = [
  'name',
  'destination',
  'city',
  'budgetTier',
  'priceRangeINR',
  'rating',
];

const ALLOWED_AUDIT_FIELDS = [
  'name',
  'destination',
  'budgetTier',
  'priceRangeINR',
  'rating',
  'hidden',
  'hiddenReason',
  'priceReviewedAt',
  'updatedBy',
  'updatedByEmail',
];

const VALID_BUDGET_TIERS = ['budget', 'mid', 'luxury'];
export const MAX_SANE_PRICE_INR = 1000000; // ₹10,00,000 INR per night sane upper limit

function validateStringField(val, fieldName, { min = 1, max = 100, required = false } = {}) {
  if (required && (val === undefined || val === null || typeof val !== 'string' || !val.trim())) {
    return `${fieldName} is required`;
  }
  if (val !== undefined && val !== null) {
    if (typeof val !== 'string') return `${fieldName} must be a string`;
    if (HTML_REGEX.test(val)) return `HTML tags are not allowed in ${fieldName}`;
    const trimmed = val.trim();
    if (trimmed.length < min || trimmed.length > max) {
      return `${fieldName} must be between ${min} and ${max} characters`;
    }
  }
  return null;
}

export function validatePriceRangeINR(val) {
  if (val === undefined || val === null) return null;
  if (typeof val !== 'string') return 'Price range must be a string';
  if (HTML_REGEX.test(val)) return 'HTML tags are not allowed in price';
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) return 'Price range must not exceed 100 characters';

  // Check for negative signs
  if (/-\s*\d/.test(trimmed) && !/^\s*\d+[\d,]*\s*-\s*\d+/.test(trimmed) && !/₹\s*\d+[\d,]*\s*-\s*₹?\s*\d+/.test(trimmed)) {
    return 'Price must be greater than 0';
  }

  // Extract all numbers
  const cleaned = trimmed.replace(/,/g, '');
  const matches = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) {
    return 'Price must contain valid positive numbers';
  }

  const nums = matches.map((m) => Number(m));
  for (const n of nums) {
    if (!Number.isFinite(n) || n <= 0) {
      return 'Price must be greater than 0';
    }
    if (n > MAX_SANE_PRICE_INR) {
      return `Price cannot exceed ₹${MAX_SANE_PRICE_INR.toLocaleString('en-IN')}`;
    }
  }

  if (nums.length >= 2 && nums[0] > nums[1]) {
    return 'Minimum price cannot exceed maximum price';
  }

  return null;
}

function mapHotelResponse(doc) {
  const updatedByEmail = doc.updatedBy && typeof doc.updatedBy === 'object' && doc.updatedBy.email
    ? doc.updatedBy.email
    : doc.updatedByEmail || null;
  const updatedById = doc.updatedBy && typeof doc.updatedBy === 'object' && doc.updatedBy._id
    ? doc.updatedBy._id.toString()
    : doc.updatedBy
      ? doc.updatedBy.toString()
      : null;

  return {
    _id: doc._id.toString(),
    id: doc._id.toString(),
    name: doc.name,
    destination: doc.destination,
    city: doc.destination,
    budgetTier: doc.budgetTier,
    priceRangeINR: doc.priceRangeINR || null,
    rating: doc.rating !== undefined && doc.rating !== null ? Number(doc.rating) : null,
    priceReviewedAt: doc.priceReviewedAt || null,
    hidden: doc.hidden === true,
    hiddenReason: doc.hiddenReason || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedBy: updatedById,
    updatedByEmail,
  };
}

// All /admin/hotels routes require authenticated content_editor or super_admin
router.use(requireAdmin);
router.use(requireRole('content_editor', 'super_admin'));

/**
 * GET /admin/hotels
 * Content editors and Super Admins only.
 */
router.get(
  '/',
  async (req, res) => {
    try {
      const {
        q,
        destination,
        city,
        budgetTier,
        hidden,
        cursor,
        limit: limitRaw = '25',
      } = req.query;

      const limitNum = Math.min(Math.max(parseInt(String(limitRaw), 10) || 25, 1), 100);
      const query = {};

      // Search query 'q': max 60 chars, regex escaped, plain text match across name and destination
      if (typeof q === 'string' && q.trim()) {
        const cleanQ = escapeRegex(q.trim().slice(0, 60));
        const qRegex = new RegExp(cleanQ, 'i');
        query.$or = [{ name: qRegex }, { destination: qRegex }];
      }

      // Filter destination or city alias
      const destFilter = destination || city;
      if (typeof destFilter === 'string' && destFilter.trim()) {
        query.destination = new RegExp(`^${escapeRegex(destFilter.trim())}$`, 'i');
      }

      // Filter budgetTier
      if (typeof budgetTier === 'string' && budgetTier.trim()) {
        query.budgetTier = budgetTier.trim().toLowerCase();
      }

      // Filter hidden: 'true', 'false', or 'all'
      if (hidden === 'true') {
        query.hidden = true;
      } else if (hidden === 'false') {
        query.hidden = { $ne: true };
      }

      // Cursor pagination (_id < cursor, sorted desc)
      if (cursor && typeof cursor === 'string' && mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      const hotels = await CuratedHotel.find(query)
        .sort({ _id: -1 })
        .limit(limitNum + 1)
        .populate('updatedBy', 'email')
        .lean();

      let nextCursor = null;
      let results = hotels;
      if (hotels.length > limitNum) {
        results = hotels.slice(0, limitNum);
        const lastItem = results[results.length - 1];
        nextCursor = lastItem._id.toString();
      }

      return res.status(200).json({
        hotels: results.map(mapHotelResponse),
        nextCursor,
      });
    } catch (err) {
      console.error('Error listing hotels:', err.message);
      return res.status(500).json({ error: 'Failed to list hotels' });
    }
  }
);

/**
 * GET /admin/hotels/:id
 */
router.get(
  '/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hotel ID format' });
      }

      const hotel = await CuratedHotel.findById(id).populate('updatedBy', 'email').lean();
      if (!hotel) {
        return res.status(404).json({ error: 'Hotel not found' });
      }

      return res.status(200).json(mapHotelResponse(hotel));
    } catch (err) {
      console.error('Error fetching hotel:', err.message);
      return res.status(500).json({ error: 'Failed to fetch hotel' });
    }
  }
);

/**
 * POST /admin/hotels
 * Creates a new curated hotel.
 */
router.post(
  '/',
  hotelMutationLimiter,
  async (req, res) => {
    try {
      const body = req.body || {};

      // Name validation
      const nameErr = validateStringField(body.name, 'Hotel name', { min: 2, max: 120, required: true });
      if (nameErr) return res.status(400).json({ error: nameErr });
      const cleanName = body.name.trim().replace(/\s+/g, ' ');

      // Destination validation (accepts destination or city alias)
      const rawDest = body.destination || body.city;
      const destErr = validateStringField(rawDest, 'Destination', { min: 2, max: 100, required: true });
      if (destErr) return res.status(400).json({ error: destErr });
      const cleanDest = rawDest.trim().replace(/\s+/g, ' ');

      // Budget tier validation
      if (!body.budgetTier || typeof body.budgetTier !== 'string' || !VALID_BUDGET_TIERS.includes(body.budgetTier.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Budget tier must be one of: budget, mid, luxury' });
      }
      const cleanTier = body.budgetTier.trim().toLowerCase();

      // Rating validation
      if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
        const numRating = Number(body.rating);
        if (!Number.isFinite(numRating) || numRating < 0 || numRating > 5) {
          return res.status(400).json({ error: 'Rating must be a number between 0 and 5' });
        }
      }
      const cleanRating = body.rating !== undefined && body.rating !== null && body.rating !== '' ? Number(body.rating) : undefined;

      // Price range validation
      const priceErr = validatePriceRangeINR(body.priceRangeINR);
      if (priceErr) return res.status(400).json({ error: priceErr });
      const cleanPrice = body.priceRangeINR ? body.priceRangeINR.trim() : undefined;

      // Duplicate check: normalized destination + name
      const duplicate = await CuratedHotel.findOne({
        destination: new RegExp(`^${escapeRegex(cleanDest)}$`, 'i'),
        name: new RegExp(`^${escapeRegex(cleanName)}$`, 'i'),
      });
      if (duplicate) {
        return res.status(409).json({
          error: `A hotel named "${cleanName}" in "${cleanDest}" already exists`,
        });
      }

      const now = new Date();
      const priceReviewedAt = cleanPrice ? now : null;

      const newId = new mongoose.Types.ObjectId();
      const hotelData = {
        _id: newId,
        name: cleanName,
        destination: cleanDest,
        budgetTier: cleanTier,
        priceRangeINR: cleanPrice || null,
        rating: cleanRating,
        hidden: false,
        hiddenReason: null,
        priceReviewedAt,
        updatedBy: req.admin?.id ? new mongoose.Types.ObjectId(req.admin.id) : null,
        updatedByEmail: req.admin?.email || null,
      };

      // Audited mutation
      const result = await runAudited(
        req,
        {
          action: 'hotel.create',
          targetType: 'hotel',
          targetId: newId.toString(),
          summary: `Created hotel ${cleanName} in ${cleanDest}`,
          allowedFields: ALLOWED_AUDIT_FIELDS,
          before: null,
          after: hotelData,
        },
        async (session) => {
          const [newHotel] = await CuratedHotel.create([hotelData], session ? { session } : {});
          return newHotel;
        }
      );

      return res.status(201).json(mapHotelResponse(result));
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error creating hotel:', err.message);
      return res.status(500).json({ error: 'Failed to create hotel' });
    }
  }
);

/**
 * PATCH /admin/hotels/:id
 * Updates specific fields of an existing curated hotel.
 */
router.patch(
  '/:id',
  hotelMutationLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hotel ID format' });
      }

      const body = req.body || {};
      const keys = Object.keys(body);
      if (keys.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      // Check for disallowed fields
      const disallowed = keys.filter((k) => !ALLOWED_HOTEL_FIELDS.includes(k));
      if (disallowed.length > 0) {
        return res.status(400).json({ error: `Disallowed fields: ${disallowed.join(', ')}` });
      }

      const targetHotel = await CuratedHotel.findById(id);
      if (!targetHotel) {
        return res.status(404).json({ error: 'Hotel not found' });
      }

      const updates = {};

      // Name validation
      if (body.name !== undefined) {
        const nameErr = validateStringField(body.name, 'Hotel name', { min: 2, max: 120, required: true });
        if (nameErr) return res.status(400).json({ error: nameErr });
        updates.name = body.name.trim().replace(/\s+/g, ' ');
      }

      // Destination validation
      const rawDest = body.destination !== undefined ? body.destination : body.city;
      if (rawDest !== undefined) {
        const destErr = validateStringField(rawDest, 'Destination', { min: 2, max: 100, required: true });
        if (destErr) return res.status(400).json({ error: destErr });
        updates.destination = rawDest.trim().replace(/\s+/g, ' ');
      }

      // Budget tier validation
      if (body.budgetTier !== undefined) {
        if (typeof body.budgetTier !== 'string' || !VALID_BUDGET_TIERS.includes(body.budgetTier.trim().toLowerCase())) {
          return res.status(400).json({ error: 'Budget tier must be one of: budget, mid, luxury' });
        }
        updates.budgetTier = body.budgetTier.trim().toLowerCase();
      }

      // Rating validation
      if (body.rating !== undefined) {
        if (body.rating === null || body.rating === '') {
          updates.rating = null;
        } else {
          const numRating = Number(body.rating);
          if (!Number.isFinite(numRating) || numRating < 0 || numRating > 5) {
            return res.status(400).json({ error: 'Rating must be a number between 0 and 5' });
          }
          updates.rating = numRating;
        }
      }

      // Price range validation
      let priceChanged = false;
      if (body.priceRangeINR !== undefined) {
        if (body.priceRangeINR === null || body.priceRangeINR === '') {
          const oldPrice = targetHotel.priceRangeINR || null;
          if (oldPrice !== null) {
            priceChanged = true;
          }
          updates.priceRangeINR = null;
        } else {
          const priceErr = validatePriceRangeINR(body.priceRangeINR);
          if (priceErr) return res.status(400).json({ error: priceErr });
          const newPrice = body.priceRangeINR.trim();
          if (newPrice !== (targetHotel.priceRangeINR || '')) {
            priceChanged = true;
          }
          updates.priceRangeINR = newPrice;
        }
      }

      // Duplicate check if name or destination is modified
      const effectiveName = updates.name || targetHotel.name;
      const effectiveDest = updates.destination || targetHotel.destination;
      if (updates.name || updates.destination) {
        const duplicate = await CuratedHotel.findOne({
          _id: { $ne: targetHotel._id },
          destination: new RegExp(`^${escapeRegex(effectiveDest)}$`, 'i'),
          name: new RegExp(`^${escapeRegex(effectiveName)}$`, 'i'),
        });
        if (duplicate) {
          return res.status(409).json({
            error: `A hotel named "${effectiveName}" in "${effectiveDest}" already exists`,
          });
        }
      }

      // If price was changed by admin, update priceReviewedAt to server now
      if (priceChanged) {
        updates.priceReviewedAt = new Date();
      }

      updates.updatedBy = req.admin?.id ? new mongoose.Types.ObjectId(req.admin.id) : null;
      updates.updatedByEmail = req.admin?.email || null;
      updates.updatedAt = new Date();

      const beforeDoc = targetHotel.toObject ? targetHotel.toObject() : { ...targetHotel };
      const afterDoc = { ...beforeDoc, ...updates };

      // Audited mutation
      const result = await runAudited(
        req,
        {
          action: 'hotel.update',
          targetType: 'hotel',
          targetId: targetHotel._id.toString(),
          summary: `Updated hotel ${effectiveName} in ${effectiveDest}`,
          allowedFields: ALLOWED_AUDIT_FIELDS,
          before: beforeDoc,
          after: afterDoc,
        },
        async (session) => {
          Object.assign(targetHotel, updates);
          await targetHotel.save(session ? { session } : {});
          return targetHotel;
        }
      );

      return res.status(200).json(mapHotelResponse(result));
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error updating hotel:', err.message);
      return res.status(500).json({ error: 'Failed to update hotel' });
    }
  }
);

/**
 * POST /admin/hotels/:id/hide
 * Hides hotel from public search and future itinerary generation.
 */
router.post(
  '/:id/hide',
  hotelMutationLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hotel ID format' });
      }

      const targetHotel = await CuratedHotel.findById(id);
      if (!targetHotel) {
        return res.status(404).json({ error: 'Hotel not found' });
      }

      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : null;
      if (reason && HTML_REGEX.test(reason)) {
        return res.status(400).json({ error: 'HTML tags are not allowed in hide reason' });
      }

      const beforeDoc = targetHotel.toObject ? targetHotel.toObject() : { ...targetHotel };
      const afterDoc = {
        ...beforeDoc,
        hidden: true,
        hiddenReason: reason || null,
        updatedBy: req.admin?.id || null,
        updatedByEmail: req.admin?.email || null,
      };

      const result = await runAudited(
        req,
        {
          action: 'hotel.hide',
          targetType: 'hotel',
          targetId: targetHotel._id.toString(),
          summary: `Hidden hotel ${targetHotel.name} in ${targetHotel.destination}`,
          allowedFields: ALLOWED_AUDIT_FIELDS,
          before: beforeDoc,
          after: afterDoc,
        },
        async (session) => {
          targetHotel.hidden = true;
          targetHotel.hiddenReason = reason || null;
          targetHotel.updatedBy = req.admin?.id ? new mongoose.Types.ObjectId(req.admin.id) : null;
          targetHotel.updatedByEmail = req.admin?.email || null;
          targetHotel.updatedAt = new Date();
          await targetHotel.save(session ? { session } : {});
          return targetHotel;
        }
      );

      return res.status(200).json(mapHotelResponse(result));
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error hiding hotel:', err.message);
      return res.status(500).json({ error: 'Failed to hide hotel' });
    }
  }
);

/**
 * POST /admin/hotels/:id/restore
 * Restores a hidden hotel to public visibility.
 */
router.post(
  '/:id/restore',
  hotelMutationLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hotel ID format' });
      }

      const targetHotel = await CuratedHotel.findById(id);
      if (!targetHotel) {
        return res.status(404).json({ error: 'Hotel not found' });
      }

      const beforeDoc = targetHotel.toObject ? targetHotel.toObject() : { ...targetHotel };
      const afterDoc = {
        ...beforeDoc,
        hidden: false,
        hiddenReason: null,
        updatedBy: req.admin?.id || null,
        updatedByEmail: req.admin?.email || null,
      };

      const result = await runAudited(
        req,
        {
          action: 'hotel.restore',
          targetType: 'hotel',
          targetId: targetHotel._id.toString(),
          summary: `Restored hotel ${targetHotel.name} in ${targetHotel.destination}`,
          allowedFields: ALLOWED_AUDIT_FIELDS,
          before: beforeDoc,
          after: afterDoc,
        },
        async (session) => {
          targetHotel.hidden = false;
          targetHotel.hiddenReason = null;
          targetHotel.updatedBy = req.admin?.id ? new mongoose.Types.ObjectId(req.admin.id) : null;
          targetHotel.updatedByEmail = req.admin?.email || null;
          targetHotel.updatedAt = new Date();
          await targetHotel.save(session ? { session } : {});
          return targetHotel;
        }
      );

      return res.status(200).json(mapHotelResponse(result));
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error restoring hotel:', err.message);
      return res.status(500).json({ error: 'Failed to restore hotel' });
    }
  }
);

export default router;
export { router as adminHotelsRouter };
