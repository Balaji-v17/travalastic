import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import TouristPlace from '../models/TouristPlace.js';
import { requireAdmin, requireRole } from '../middleware/adminAuth.js';
import { runAudited } from '../services/audit.js';
import { invalidateDestinationCache } from './destinations.js';

const router = express.Router();

// Rate limiter: max 30 place mutations per minute per admin
const placeMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || req.ip || 'unknown_admin',
  validate: { keyGeneratorIpFallback: false },
  statusCode: 429,
  message: { error: 'Too many place modification requests. Please slow down.' },
});

// HTML tag detector regex
const HTML_REGEX = /<[^>]*>/;

export function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

const ALLOWED_PLACE_FIELDS = [
  'name',
  'city',
  'state',
  'type',
  'latitude',
  'longitude',
  'zone',
  'significance',
  'bestTimeToVisit',
  'googleRating',
  'entranceFeeINR',
  'timeNeededHours',
];

const ALLOWED_AUDIT_FIELDS = [
  'name',
  'city',
  'state',
  'zone',
  'type',
  'significance',
  'googleRating',
  'entranceFeeINR',
  'timeNeededHours',
  'bestTimeToVisit',
  'latitude',
  'longitude',
  'placeId',
  'source',
  'isCurated',
  'hidden',
  'hiddenReason',
  'embeddingStale',
  'updatedBy',
];

const TEXT_FIELDS_FEEDING_EMBEDDINGS = [
  'name',
  'type',
  'significance',
  'zone',
  'city',
  'state',
  'bestTimeToVisit',
];

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

function validateCoordinates(lat, lon, required = false) {
  if (required && (lat === undefined || lon === undefined || lat === null || lon === null)) {
    return 'latitude and longitude are required';
  }
  if (lat !== undefined || lon !== undefined) {
    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      return 'latitude and longitude must be updated together';
    }
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (!Number.isFinite(numLat) || numLat < -90 || numLat > 90) {
      return 'latitude must be a finite number between -90 and 90';
    }
    if (!Number.isFinite(numLon) || numLon < -180 || numLon > 180) {
      return 'longitude must be a finite number between -180 and 180';
    }
    if (numLat === 0 && numLon === 0) {
      return 'Coordinates cannot be 0, 0';
    }
  }
  return null;
}

function validateNumericField(val, fieldName, { min = 0, max = Infinity, required = false } = {}) {
  if (required && (val === undefined || val === null)) {
    return `${fieldName} is required`;
  }
  if (val !== undefined && val !== null) {
    const num = Number(val);
    if (!Number.isFinite(num)) {
      return `${fieldName} must be a number`;
    }
    if (num < min || num > max) {
      return `${fieldName} must be between ${min} and ${max}`;
    }
  }
  return null;
}

function mapPlaceResponse(doc) {
  const updatedByEmail = doc.updatedBy && typeof doc.updatedBy === 'object' && doc.updatedBy.email
    ? doc.updatedBy.email
    : null;
  const updatedById = doc.updatedBy && typeof doc.updatedBy === 'object' && doc.updatedBy._id
    ? doc.updatedBy._id.toString()
    : doc.updatedBy
      ? doc.updatedBy.toString()
      : null;

  return {
    _id: doc._id.toString(),
    id: doc._id.toString(),
    placeId: doc.placeId || doc._id.toString(),
    name: doc.name,
    city: doc.city,
    state: doc.state,
    zone: doc.zone || null,
    type: doc.type,
    significance: doc.significance || null,
    googleRating: doc.googleRating ?? null,
    entranceFeeINR: doc.entranceFeeINR ?? 0,
    timeNeededHours: doc.timeNeededHours ?? null,
    bestTimeToVisit: doc.bestTimeToVisit || null,
    latitude: doc.latitude ?? doc.lat ?? null,
    longitude: doc.longitude ?? doc.lon ?? null,
    hidden: doc.hidden === true,
    hiddenReason: doc.hiddenReason || null,
    source: doc.source || 'kaggle',
    isCurated: doc.isCurated === true,
    embeddingStale: doc.embeddingStale === true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedBy: updatedById,
    updatedByEmail,
  };
}

// All /admin/places routes require authenticated content_editor or super_admin
router.use(requireAdmin);
router.use(requireRole('content_editor', 'super_admin'));

/**
 * GET /admin/places?q&city&state&type&hidden&limit&cursor
 */
router.get('/', async (req, res) => {
  try {
    const { q, city, state, type, hidden, limit, cursor } = req.query;

    const filter = {};

    // Escaped search query, max 60 chars
    if (typeof q === 'string' && q.trim()) {
      const cleanQ = q.trim().slice(0, 60);
      const escaped = escapeRegex(cleanQ);
      filter.$or = [
        { name: new RegExp(escaped, 'i') },
        { city: new RegExp(escaped, 'i') },
      ];
    }

    if (typeof city === 'string' && city.trim()) {
      filter.city = new RegExp('^' + escapeRegex(city.trim()) + '$', 'i');
    }
    if (typeof state === 'string' && state.trim()) {
      filter.state = new RegExp('^' + escapeRegex(state.trim()) + '$', 'i');
    }
    if (typeof type === 'string' && type.trim()) {
      filter.type = new RegExp('^' + escapeRegex(type.trim()) + '$', 'i');
    }

    if (hidden === 'true') {
      filter.hidden = true;
    } else if (hidden === 'false') {
      filter.hidden = { $ne: true };
    }

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

    const docs = await TouristPlace.find(filter)
      .sort({ _id: -1 })
      .limit(limitNum + 1)
      .populate('updatedBy', 'email')
      .lean();

    const hasMore = docs.length > limitNum;
    const items = hasMore ? docs.slice(0, limitNum) : docs;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

    const places = items.map(mapPlaceResponse);

    return res.status(200).json({ places, nextCursor });
  } catch (err) {
    console.error('Error fetching admin places:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/places/:id
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  try {
    const doc = await TouristPlace.findById(id).populate('updatedBy', 'email').lean();
    if (!doc) {
      return res.status(404).json({ error: 'Place not found' });
    }
    return res.status(200).json(mapPlaceResponse(doc));
  } catch (err) {
    console.error('Error fetching admin place by id:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/places
 */
router.post('/', placeMutationLimiter, async (req, res) => {
  const body = req.body || {};

  // Check unknown fields
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PLACE_FIELDS.includes(key)) {
      return res.status(400).json({ error: `Unknown field: ${key}` });
    }
  }

  // Validate required string fields
  const nameErr = validateStringField(body.name, 'name', { min: 2, max: 120, required: true });
  if (nameErr) return res.status(400).json({ error: nameErr });

  const cityErr = validateStringField(body.city, 'city', { min: 1, max: 100, required: true });
  if (cityErr) return res.status(400).json({ error: cityErr });

  const stateErr = validateStringField(body.state, 'state', { min: 1, max: 100, required: true });
  if (stateErr) return res.status(400).json({ error: stateErr });

  const typeErr = validateStringField(body.type, 'type', { min: 1, max: 100, required: true });
  if (typeErr) return res.status(400).json({ error: typeErr });

  // Validate coordinates (both required)
  const coordErr = validateCoordinates(body.latitude, body.longitude, true);
  if (coordErr) return res.status(400).json({ error: coordErr });

  // Validate optional string fields
  const zoneErr = validateStringField(body.zone, 'zone', { min: 1, max: 100, required: false });
  if (zoneErr) return res.status(400).json({ error: zoneErr });

  const sigErr = validateStringField(body.significance, 'significance', { min: 1, max: 500, required: false });
  if (sigErr) return res.status(400).json({ error: sigErr });

  const timeErr = validateStringField(body.bestTimeToVisit, 'bestTimeToVisit', { min: 1, max: 100, required: false });
  if (timeErr) return res.status(400).json({ error: timeErr });

  // Validate optional numeric fields
  const ratingErr = validateNumericField(body.googleRating, 'googleRating', { min: 0, max: 5 });
  if (ratingErr) return res.status(400).json({ error: ratingErr });

  const feeErr = validateNumericField(body.entranceFeeINR, 'entranceFeeINR', { min: 0 });
  if (feeErr) return res.status(400).json({ error: feeErr });

  const hoursErr = validateNumericField(body.timeNeededHours, 'timeNeededHours', { min: 0, max: 48 });
  if (hoursErr) return res.status(400).json({ error: hoursErr });

  try {
    // Duplicate check on normalized name + city
    const existing = await TouristPlace.findOne({
      name: new RegExp('^' + escapeRegex(body.name.trim()) + '$', 'i'),
      city: new RegExp('^' + escapeRegex(body.city.trim()) + '$', 'i'),
    });
    if (existing) {
      return res.status(409).json({ error: 'Place with this name and city already exists' });
    }

    const newId = new mongoose.Types.ObjectId();
    const placeId = newId.toString();

    const placeDocData = {
      _id: newId,
      placeId,
      name: body.name.trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      type: body.type.trim(),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      zone: body.zone ? body.zone.trim() : undefined,
      significance: body.significance ? body.significance.trim() : undefined,
      bestTimeToVisit: body.bestTimeToVisit ? body.bestTimeToVisit.trim() : undefined,
      googleRating: body.googleRating !== undefined && body.googleRating !== null ? Number(body.googleRating) : undefined,
      entranceFeeINR: body.entranceFeeINR !== undefined && body.entranceFeeINR !== null ? Number(body.entranceFeeINR) : 0,
      timeNeededHours: body.timeNeededHours !== undefined && body.timeNeededHours !== null ? Number(body.timeNeededHours) : undefined,
      isCurated: true,
      source: 'admin',
      hidden: false,
      embeddingStale: true,
      updatedBy: req.admin.id,
    };

    const savedPlace = await runAudited(
      req,
      {
        action: 'place.create',
        targetType: 'TouristPlace',
        targetId: newId.toString(),
        summary: `Created place ${body.name.trim()} in ${body.city.trim()}`,
        allowedFields: ALLOWED_AUDIT_FIELDS,
        before: null,
        after: placeDocData,
      },
      async (session) => {
        const place = new TouristPlace(placeDocData);
        await place.save(session ? { session } : {});
        return place;
      }
    );

    invalidateDestinationCache();

    return res.status(201).json(mapPlaceResponse({
      ...savedPlace.toObject(),
      updatedBy: { _id: req.admin.id, email: req.admin.email },
    }));
  } catch (err) {
    if (err.statusCode === 500) {
      return res.status(500).json({ error: 'Failed to create place' });
    }
    console.error('Error creating place:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /admin/places/:id
 */
router.patch('/:id', placeMutationLimiter, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  const body = req.body || {};
  const bodyKeys = Object.keys(body);
  if (bodyKeys.length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  for (const key of bodyKeys) {
    if (!ALLOWED_PLACE_FIELDS.includes(key)) {
      return res.status(400).json({ error: `Unknown field: ${key}` });
    }
  }

  // Check latitude & longitude must be updated together
  const hasLat = body.latitude !== undefined;
  const hasLon = body.longitude !== undefined;
  if ((hasLat && !hasLon) || (!hasLat && hasLon)) {
    return res.status(400).json({ error: 'latitude and longitude must be updated together' });
  }
  if (hasLat && hasLon) {
    const coordErr = validateCoordinates(body.latitude, body.longitude, true);
    if (coordErr) return res.status(400).json({ error: coordErr });
  }

  if (body.name !== undefined) {
    const nameErr = validateStringField(body.name, 'name', { min: 2, max: 120, required: true });
    if (nameErr) return res.status(400).json({ error: nameErr });
  }
  if (body.city !== undefined) {
    const cityErr = validateStringField(body.city, 'city', { min: 1, max: 100, required: true });
    if (cityErr) return res.status(400).json({ error: cityErr });
  }
  if (body.state !== undefined) {
    const stateErr = validateStringField(body.state, 'state', { min: 1, max: 100, required: true });
    if (stateErr) return res.status(400).json({ error: stateErr });
  }
  if (body.type !== undefined) {
    const typeErr = validateStringField(body.type, 'type', { min: 1, max: 100, required: true });
    if (typeErr) return res.status(400).json({ error: typeErr });
  }
  if (body.zone !== undefined) {
    const zoneErr = validateStringField(body.zone, 'zone', { min: 1, max: 100, required: false });
    if (zoneErr) return res.status(400).json({ error: zoneErr });
  }
  if (body.significance !== undefined) {
    const sigErr = validateStringField(body.significance, 'significance', { min: 1, max: 500, required: false });
    if (sigErr) return res.status(400).json({ error: sigErr });
  }
  if (body.bestTimeToVisit !== undefined) {
    const timeErr = validateStringField(body.bestTimeToVisit, 'bestTimeToVisit', { min: 1, max: 100, required: false });
    if (timeErr) return res.status(400).json({ error: timeErr });
  }
  if (body.googleRating !== undefined) {
    const ratingErr = validateNumericField(body.googleRating, 'googleRating', { min: 0, max: 5 });
    if (ratingErr) return res.status(400).json({ error: ratingErr });
  }
  if (body.entranceFeeINR !== undefined) {
    const feeErr = validateNumericField(body.entranceFeeINR, 'entranceFeeINR', { min: 0 });
    if (feeErr) return res.status(400).json({ error: feeErr });
  }
  if (body.timeNeededHours !== undefined) {
    const hoursErr = validateNumericField(body.timeNeededHours, 'timeNeededHours', { min: 0, max: 48 });
    if (hoursErr) return res.status(400).json({ error: hoursErr });
  }

  try {
    const place = await TouristPlace.findById(id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const targetName = body.name !== undefined ? body.name.trim() : place.name;
    const targetCity = body.city !== undefined ? body.city.trim() : place.city;

    if (
      targetName.toLowerCase() !== place.name.toLowerCase() ||
      targetCity.toLowerCase() !== place.city.toLowerCase()
    ) {
      const dup = await TouristPlace.findOne({
        _id: { $ne: place._id },
        name: new RegExp('^' + escapeRegex(targetName) + '$', 'i'),
        city: new RegExp('^' + escapeRegex(targetCity) + '$', 'i'),
      });
      if (dup) {
        return res.status(409).json({ error: 'Place with this name and city already exists' });
      }
    }

    // Check if any text field feeding embeddings was changed
    const textChanged = TEXT_FIELDS_FEEDING_EMBEDDINGS.some((f) => {
      if (body[f] === undefined) return false;
      const oldVal = (place[f] || '').toString().trim();
      const newVal = (body[f] || '').toString().trim();
      return oldVal !== newVal;
    });

    const before = place.toObject();
    const after = { ...before };

    for (const field of ALLOWED_PLACE_FIELDS) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string') {
          after[field] = body[field].trim();
        } else if (body[field] === null) {
          after[field] = null;
        } else {
          after[field] = Number(body[field]);
        }
      }
    }

    if (textChanged) {
      after.embeddingStale = true;
    }
    after.updatedBy = req.admin.id;

    const updatedPlace = await runAudited(
      req,
      {
        action: 'place.update',
        targetType: 'TouristPlace',
        targetId: place._id.toString(),
        summary: `Updated place ${place.name}`,
        allowedFields: ALLOWED_AUDIT_FIELDS,
        before,
        after,
      },
      async (session) => {
        for (const [key, val] of Object.entries(after)) {
          if (key === '_id' || key === '__v') continue;
          place[key] = val;
        }
        await place.save(session ? { session } : {});
        return place;
      }
    );

    invalidateDestinationCache();

    return res.status(200).json(mapPlaceResponse({
      ...updatedPlace.toObject(),
      updatedBy: { _id: req.admin.id, email: req.admin.email },
    }));
  } catch (err) {
    if (err.statusCode === 500) {
      return res.status(500).json({ error: 'Failed to update place' });
    }
    console.error('Error updating place:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/places/:id/hide
 */
router.post('/:id/hide', placeMutationLimiter, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  const { reason } = req.body || {};
  if (reason !== undefined && reason !== null) {
    const reasonErr = validateStringField(reason, 'reason', { min: 1, max: 200, required: false });
    if (reasonErr) return res.status(400).json({ error: reasonErr });
  }

  try {
    const place = await TouristPlace.findById(id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const before = place.toObject();
    const finalReason = reason && typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : place.hiddenReason || 'Hidden by admin';

    const after = {
      ...before,
      hidden: true,
      hiddenReason: finalReason,
      updatedBy: req.admin.id,
    };

    const updatedPlace = await runAudited(
      req,
      {
        action: 'place.hide',
        targetType: 'TouristPlace',
        targetId: place._id.toString(),
        summary: `Hid place ${place.name}${reason ? ': ' + reason.trim() : ''}`.slice(0, 200),
        allowedFields: ['hidden', 'hiddenReason', 'updatedBy'],
        before,
        after,
      },
      async (session) => {
        place.hidden = true;
        place.hiddenReason = finalReason;
        place.updatedBy = req.admin.id;
        await place.save(session ? { session } : {});
        return place;
      }
    );

    invalidateDestinationCache();

    return res.status(200).json(mapPlaceResponse({
      ...updatedPlace.toObject(),
      updatedBy: { _id: req.admin.id, email: req.admin.email },
    }));
  } catch (err) {
    if (err.statusCode === 500) {
      return res.status(500).json({ error: 'Failed to hide place' });
    }
    console.error('Error hiding place:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/places/:id/restore
 */
router.post('/:id/restore', placeMutationLimiter, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  try {
    const place = await TouristPlace.findById(id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const before = place.toObject();
    const after = {
      ...before,
      hidden: false,
      hiddenReason: null,
      updatedBy: req.admin.id,
    };

    const updatedPlace = await runAudited(
      req,
      {
        action: 'place.restore',
        targetType: 'TouristPlace',
        targetId: place._id.toString(),
        summary: `Restored place ${place.name}`.slice(0, 200),
        allowedFields: ['hidden', 'hiddenReason', 'updatedBy'],
        before,
        after,
      },
      async (session) => {
        place.hidden = false;
        place.hiddenReason = null;
        place.updatedBy = req.admin.id;
        await place.save(session ? { session } : {});
        return place;
      }
    );

    invalidateDestinationCache();

    return res.status(200).json(mapPlaceResponse({
      ...updatedPlace.toObject(),
      updatedBy: { _id: req.admin.id, email: req.admin.email },
    }));
  } catch (err) {
    if (err.statusCode === 500) {
      return res.status(500).json({ error: 'Failed to restore place' });
    }
    console.error('Error restoring place:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as adminPlacesRouter };

