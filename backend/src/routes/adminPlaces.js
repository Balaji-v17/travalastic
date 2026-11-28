import express from 'express';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import TouristPlace from '../models/TouristPlace.js';
import { requireAdmin, requireRole } from '../middleware/adminAuth.js';
import { runAudited } from '../services/audit.js';
import { invalidateDestinationCache } from './destinations.js';
import {
  BLOCKING_PUBLISH_FLAGS,
  HERITAGE_SOURCE,
  findCuratedOverlap,
  getBlockingPublishFlags,
  recomputeHeritageFlags,
} from '../utils/heritageProcessor.js';
import { tryEmbedPublishedPlace } from '../utils/placeEmbedding.js';

const router = express.Router();

export const MAX_BULK_HERITAGE_ACTION = 50;

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

const CONCURRENCY_META_FIELDS = ['expectedVersion', 'expectedUpdatedAt'];

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
  'sourceId',
  'source',
  'isCurated',
  'hidden',
  'hiddenReason',
  'reviewFlags',
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

function checkConcurrencyConflict(place, body = {}) {
  if (body.expectedVersion !== undefined && body.expectedVersion !== null) {
    const currentVersion = Number(place.__v ?? 0);
    if (Number(body.expectedVersion) !== currentVersion) {
      return 'This place was modified by another editor. Refresh and try again.';
    }
  }
  if (body.expectedUpdatedAt) {
    const currentUpdatedAt = place.updatedAt ? new Date(place.updatedAt).toISOString() : null;
    if (currentUpdatedAt && String(body.expectedUpdatedAt) !== currentUpdatedAt) {
      return 'This place was modified by another editor. Refresh and try again.';
    }
  }
  return null;
}

export function mapPlaceResponse(doc) {
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
    sourceId: doc.sourceId || null,
    name: doc.name,
    city: doc.city,
    state: doc.state ?? null,
    zone: doc.zone || null,
    type: doc.type,
    significance: doc.significance || null,
    googleRating: doc.googleRating ?? null,
    entranceFeeINR: doc.entranceFeeINR ?? null,
    timeNeededHours: doc.timeNeededHours ?? null,
    bestTimeToVisit: doc.bestTimeToVisit || null,
    latitude: doc.latitude ?? doc.lat ?? null,
    longitude: doc.longitude ?? doc.lon ?? null,
    hidden: doc.hidden === true,
    hiddenReason: doc.hiddenReason || null,
    source: doc.source || 'kaggle',
    isCurated: doc.isCurated === true,
    embeddingStale: doc.embeddingStale === true,
    reviewFlags: Array.isArray(doc.reviewFlags) ? doc.reviewFlags : [],
    heritage: doc.heritage
      ? {
          protectedBy: doc.heritage.protectedBy || null,
          asiCircle: doc.heritage.asiCircle || null,
          location: doc.heritage.location || null,
          coordsApprox: Boolean(doc.heritage.coordsApprox),
          mergedSourceIds: Array.isArray(doc.heritage.mergedSourceIds)
            ? doc.heritage.mergedSourceIds
            : [],
          extraCoords: Array.isArray(doc.heritage.extraCoords)
            ? doc.heritage.extraCoords
            : [],
          matchedCuratedPlace: doc.heritage.matchedCuratedPlace || null,
        }
      : null,
    version: doc.__v ?? 0,
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
 * GET /admin/places?q&city&state&type&hidden&hiddenReason&source&flag&protectedBy&sort&limit&cursor&offset
 */
router.get('/', async (req, res) => {
  try {
    const {
      q,
      city,
      state,
      type,
      hidden,
      hiddenReason,
      source,
      flag,
      protectedBy,
      sort,
      limit,
      cursor,
      offset,
    } = req.query;

    const filter = {};

    // Escaped search query matching name, city (district), and heritage.location, max 60 chars
    if (typeof q === 'string' && q.trim()) {
      const cleanQ = q.trim().slice(0, 60);
      const escaped = escapeRegex(cleanQ);
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { name: rx },
        { city: rx },
        { 'heritage.location': rx },
      ];
    }

    if (typeof city === 'string' && city.trim()) {
      filter.city = new RegExp('^' + escapeRegex(city.trim()) + '$', 'i');
    }
    if (typeof state === 'string' && state.trim()) {
      if (state.trim() === '__unmapped__') {
        filter.state = null;
      } else {
        filter.state = new RegExp('^' + escapeRegex(state.trim()) + '$', 'i');
      }
    }
    if (typeof type === 'string' && type.trim()) {
      filter.type = new RegExp('^' + escapeRegex(type.trim()) + '$', 'i');
    }
    if (typeof source === 'string' && source.trim()) {
      filter.source = source.trim();
    }

    if (hidden === 'true') {
      filter.hidden = true;
    } else if (hidden === 'false') {
      filter.hidden = { $ne: true };
    }

    if (typeof hiddenReason === 'string' && hiddenReason.trim() && hiddenReason !== 'all') {
      const hr = hiddenReason.trim();
      if (hr === 'none') {
        filter.hiddenReason = null;
      } else {
        filter.hiddenReason = hr;
      }
    }

    if (typeof flag === 'string' && flag.trim() && flag !== 'all') {
      const f = flag.trim();
      if (f === 'no_blocking') {
        filter.reviewFlags = { $nin: BLOCKING_PUBLISH_FLAGS };
      } else if (f === 'clean') {
        filter.reviewFlags = { $size: 0 };
      } else {
        filter.reviewFlags = f;
      }
    }

    if (typeof protectedBy === 'string' && protectedBy.trim() && protectedBy !== 'all') {
      const pb = protectedBy.trim();
      if (pb.toLowerCase() === 'asi') {
        filter.sourceId = /^asi:/i;
      } else if (pb.toLowerCase() === 'soi') {
        filter.sourceId = /^soi:/i;
      } else {
        filter['heritage.protectedBy'] = new RegExp('^' + escapeRegex(pb) + '$', 'i');
      }
    }

    const sortByStateName = sort === 'state_name';
    const sortSpec = sortByStateName ? { state: 1, name: 1, _id: 1 } : { _id: -1 };
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    if (cursor && !sortByStateName) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    let query = TouristPlace.find(filter)
      .select('-embedding')
      .sort(sortSpec);

    if (sortByStateName && offsetNum > 0) {
      query = query.skip(offsetNum);
    }

    const docs = await query
      .limit(limitNum + 1)
      .populate('updatedBy', 'email')
      .lean();

    const hasMore = docs.length > limitNum;
    const items = hasMore ? docs.slice(0, limitNum) : docs;
    const nextCursor = !sortByStateName && hasMore ? items[items.length - 1]._id.toString() : null;
    const nextOffset = sortByStateName && hasMore ? offsetNum + items.length : null;

    const places = items.map(mapPlaceResponse);

    return res.status(200).json({ places, nextCursor, nextOffset });
  } catch (err) {
    console.error('Error fetching admin places:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/places/bulk-action
 * Bulk publish, reject, or skip_curated up to 50 places with blocking-flag enforcement,
 * curated overlap confirmation, optimistic concurrency, and audited logging.
 */
router.post('/bulk-action', placeMutationLimiter, async (req, res) => {
  const { action, ids, versions, confirmCuratedOverlap } = req.body || {};

  if (!['publish', 'reject', 'skip_curated'].includes(action)) {
    return res.status(400).json({ error: 'action must be "publish", "reject", or "skip_curated"' });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  if (ids.length > MAX_BULK_HERITAGE_ACTION) {
    return res.status(400).json({
      error: `Bulk action is limited to ${MAX_BULK_HERITAGE_ACTION} records per request`,
    });
  }

  const uniqueIds = Array.from(new Set(ids.map((id) => String(id))));
  for (const id of uniqueIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: `Invalid place ID format: ${id}` });
    }
  }

  try {
    const docs = await TouristPlace.find({ _id: { $in: uniqueIds } });
    const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

    const eligible = [];
    const blocked = [];
    const conflicts = [];
    const notFound = [];

    for (const id of uniqueIds) {
      const place = docMap.get(id);
      if (!place) {
        notFound.push(id);
        continue;
      }

      if (versions && typeof versions === 'object' && versions[id] !== undefined) {
        const conflictMsg = checkConcurrencyConflict(place, { expectedVersion: versions[id] });
        if (conflictMsg) {
          conflicts.push({ id, name: place.name, error: conflictMsg });
          continue;
        }
      }

      if (action === 'publish') {
        const blockingFlags = getBlockingPublishFlags(place);
        if (blockingFlags.length > 0) {
          blocked.push({ id, name: place.name, blockingFlags });
          continue;
        }
        if (place.reviewFlags?.includes('matches_curated') && confirmCuratedOverlap !== true) {
          blocked.push({
            id,
            name: place.name,
            blockingFlags: ['matches_curated'],
            matchedCuratedPlace: place.heritage?.matchedCuratedPlace || null,
          });
          continue;
        }
      }

      eligible.push(place);
    }

    const auditAction =
      action === 'publish'
        ? 'place.bulk_publish'
        : action === 'skip_curated'
          ? 'place.bulk_skip_curated'
          : 'place.bulk_reject';

    const succeeded = [];
    if (eligible.length > 0) {
      await runAudited(
        req,
        {
          action: auditAction,
          targetType: 'TouristPlace',
          targetId: eligible.map((p) => p._id.toString()).join(',').slice(0, 200),
          summary: `Bulk ${action} (${eligible.length} place${eligible.length === 1 ? '' : 's'})`,
          allowedFields: ['ids', 'count', 'action'],
          before: { count: eligible.length, ids: eligible.map((p) => p._id.toString()) },
          after: { action, count: eligible.length, ids: eligible.map((p) => p._id.toString()) },
        },
        async (session) => {
          for (const place of eligible) {
            if (action === 'publish') {
              place.hidden = false;
              place.hiddenReason = null;
              place.isCurated = true;
              place.embeddingStale = true;
            } else if (action === 'skip_curated') {
              place.hidden = true;
              place.hiddenReason = 'already_curated';
              place.isCurated = false;
            } else {
              place.hidden = true;
              place.hiddenReason = 'rejected';
              place.isCurated = false;
            }
            place.updatedBy = req.admin.id;
            if (typeof place.increment === 'function') place.increment();
            await place.save(session ? { session } : {});
            succeeded.push(place);
          }
        }
      );

      invalidateDestinationCache();

      if (action === 'publish') {
        for (const place of succeeded) {
          await tryEmbedPublishedPlace(place);
        }
      }
    }

    return res.status(200).json({
      action,
      succeededCount: succeeded.length,
      succeeded: succeeded.map((p) =>
        mapPlaceResponse({
          ...p.toObject(),
          updatedBy: { _id: req.admin.id, email: req.admin.email },
        })
      ),
      blocked,
      conflicts,
      notFound,
    });
  } catch (err) {
    console.error('Error in bulk-action:', err.message);
    return res.status(500).json({ error: 'Failed to process bulk action' });
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
    const doc = await TouristPlace.findById(id).select('-embedding').populate('updatedBy', 'email').lean();
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
    // Duplicate check on normalized name + city (for visible / non-duplicate places)
    const existingMatches = await TouristPlace.find({
      name: new RegExp('^' + escapeRegex(body.name.trim()) + '$', 'i'),
      city: new RegExp('^' + escapeRegex(body.city.trim()) + '$', 'i'),
    });
    if ((existingMatches || []).some((d) => d.hiddenReason !== 'duplicate')) {
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
      googleRating: body.googleRating !== undefined && body.googleRating !== null ? Number(body.googleRating) : null,
      entranceFeeINR: body.entranceFeeINR !== undefined && body.entranceFeeINR !== null ? Number(body.entranceFeeINR) : null,
      timeNeededHours: body.timeNeededHours !== undefined && body.timeNeededHours !== null ? Number(body.timeNeededHours) : null,
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
  const updateKeys = bodyKeys.filter((k) => !CONCURRENCY_META_FIELDS.includes(k));
  if (updateKeys.length === 0) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  for (const key of updateKeys) {
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

    const conflictErr = checkConcurrencyConflict(place, body);
    if (conflictErr) {
      return res.status(409).json({ error: conflictErr });
    }

    const targetName = body.name !== undefined ? body.name.trim() : place.name;
    const targetCity = body.city !== undefined ? body.city.trim() : place.city;
    const isHiddenHeritage = place.source === HERITAGE_SOURCE && place.hidden === true;

    if (
      !isHiddenHeritage &&
      (targetName.toLowerCase() !== place.name.toLowerCase() ||
        targetCity.toLowerCase() !== place.city.toLowerCase())
    ) {
      const dupMatches = await TouristPlace.find({
        _id: { $ne: place._id },
        name: new RegExp('^' + escapeRegex(targetName) + '$', 'i'),
        city: new RegExp('^' + escapeRegex(targetCity) + '$', 'i'),
      });
      if ((dupMatches || []).some((d) => d.hiddenReason !== 'duplicate')) {
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

    if (
      place.source === HERITAGE_SOURCE ||
      (Array.isArray(place.reviewFlags) && place.reviewFlags.length > 0)
    ) {
      const baseFlags = recomputeHeritageFlags(after).filter((f) => f !== 'matches_curated');
      if (place.source === HERITAGE_SOURCE) {
        const curatedQuery = TouristPlace.find({ source: { $ne: HERITAGE_SOURCE } });
        const curatedPlaces =
          curatedQuery && typeof curatedQuery.select === 'function'
            ? await curatedQuery.select('_id name city state latitude longitude source').lean()
            : Array.isArray(curatedQuery)
              ? curatedQuery
              : await curatedQuery;
        const overlap = findCuratedOverlap(after, curatedPlaces || []);
        after.heritage = { ...(after.heritage || {}), matchedCuratedPlace: overlap || null };
        if (overlap) {
          baseFlags.push('matches_curated');
        }
      }
      after.reviewFlags = baseFlags;
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
        if (after.heritage && typeof place.markModified === 'function') {
          place.markModified('heritage');
        }
        if (typeof place.increment === 'function') place.increment();
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
 * POST /admin/places/:id/publish
 * Publishes an unreviewed/hidden place after checking blocking quality flags, curated overlap
 * confirmation, and version concurrency. Triggers best-effort non-blocking embedding.
 */
router.post('/:id/publish', placeMutationLimiter, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  try {
    const place = await TouristPlace.findById(id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const conflictErr = checkConcurrencyConflict(place, req.body || {});
    if (conflictErr) {
      return res.status(409).json({ error: conflictErr });
    }

    const blockingFlags = getBlockingPublishFlags(place);
    if (blockingFlags.length > 0) {
      return res.status(400).json({
        error: `Cannot publish while unresolved flags remain: ${blockingFlags.join(', ')}`,
        blockingFlags,
      });
    }

    if (
      Array.isArray(place.reviewFlags) &&
      place.reviewFlags.includes('matches_curated') &&
      req.body?.confirmCuratedOverlap !== true
    ) {
      return res.status(400).json({
        error: 'Confirm overlap with existing curated place before publishing',
        code: 'CURATED_OVERLAP_CONFIRMATION_REQUIRED',
        matchedCuratedPlace: place.heritage?.matchedCuratedPlace || null,
      });
    }

    const before = place.toObject();
    const after = {
      ...before,
      hidden: false,
      hiddenReason: null,
      isCurated: true,
      embeddingStale: true,
      updatedBy: req.admin.id,
    };

    const updatedPlace = await runAudited(
      req,
      {
        action: 'place.publish',
        targetType: 'TouristPlace',
        targetId: place._id.toString(),
        summary: `Published place ${place.name}`.slice(0, 200),
        allowedFields: ['hidden', 'hiddenReason', 'isCurated', 'embeddingStale', 'updatedBy'],
        before,
        after,
      },
      async (session) => {
        place.hidden = false;
        place.hiddenReason = null;
        place.isCurated = true;
        place.embeddingStale = true;
        place.updatedBy = req.admin.id;
        if (typeof place.increment === 'function') place.increment();
        await place.save(session ? { session } : {});
        return place;
      }
    );

    invalidateDestinationCache();

    // Best-effort single-doc embedding; never blocks or fails the publish response
    await tryEmbedPublishedPlace(updatedPlace);

    return res.status(200).json(mapPlaceResponse({
      ...updatedPlace.toObject(),
      updatedBy: { _id: req.admin.id, email: req.admin.email },
    }));
  } catch (err) {
    if (err.statusCode === 500) {
      return res.status(500).json({ error: 'Failed to publish place' });
    }
    console.error('Error publishing place:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleMarkHeritageHidden(req, res, { hiddenReason, action, summaryPrefix, failMessage }) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid place ID format' });
  }

  try {
    const place = await TouristPlace.findById(id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const conflictErr = checkConcurrencyConflict(place, req.body || {});
    if (conflictErr) {
      return res.status(409).json({ error: conflictErr });
    }

    const before = place.toObject();
    const after = {
      ...before,
      hidden: true,
      hiddenReason,
      isCurated: false,
      updatedBy: req.admin.id,
    };

    const updatedPlace = await runAudited(
      req,
      {
        action,
        targetType: 'TouristPlace',
        targetId: place._id.toString(),
        summary: `${summaryPrefix} ${place.name}`.slice(0, 200),
        allowedFields: ['hidden', 'hiddenReason', 'isCurated', 'updatedBy'],
        before,
        after,
      },
      async (session) => {
        place.hidden = true;
        place.hiddenReason = hiddenReason;
        place.isCurated = false;
        place.updatedBy = req.admin.id;
        if (typeof place.increment === 'function') place.increment();
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
      return res.status(500).json({ error: failMessage });
    }
    console.error(`${failMessage}:`, err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /admin/places/:id/reject
 * Marks a pending/unreviewed heritage monument as rejected (remains hidden).
 */
router.post('/:id/reject', placeMutationLimiter, (req, res) =>
  handleMarkHeritageHidden(req, res, {
    hiddenReason: 'rejected',
    action: 'place.reject',
    summaryPrefix: 'Rejected place',
    failMessage: 'Failed to reject place',
  })
);

/**
 * POST /admin/places/:id/skip-curated
 * Marks a heritage monument matching an existing curated place as skipped (remains hidden, hiddenReason: 'already_curated').
 */
router.post('/:id/skip-curated', placeMutationLimiter, (req, res) =>
  handleMarkHeritageHidden(req, res, {
    hiddenReason: 'already_curated',
    action: 'place.skip_curated',
    summaryPrefix: 'Skipped already-curated place',
    failMessage: 'Failed to skip curated heritage place',
  })
);

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
        if (typeof place.increment === 'function') place.increment();
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

    const blockingFlags = getBlockingPublishFlags(place);
    if (blockingFlags.length > 0) {
      return res.status(400).json({
        error: `Cannot restore while unresolved flags remain: ${blockingFlags.join(', ')}`,
        blockingFlags,
      });
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
        if (typeof place.increment === 'function') place.increment();
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
