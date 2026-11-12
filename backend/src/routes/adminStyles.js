import express from 'express';
import rateLimit from 'express-rate-limit';
import StyleCollection, { ALLOWED_STYLE_KEYS } from '../models/StyleCollection.js';
import { requireAdmin, requireRole } from '../middleware/adminAuth.js';
import { runAudited } from '../services/audit.js';
import { invalidateStylePublicCache } from './styles.js';
import { resolveDestinationPhoto } from './destinations.js';

const router = express.Router();

const HTML_TAG_REGEX = /<[^>]*>/;

// Rate limit: 20/min per admin to protect Pexels quota
const previewPhotoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.admin?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many preview requests. Please wait a moment.' },
});

export function buildStyleUpdateSummary(beforeNames, afterNames) {
  const beforeSet = new Set(beforeNames);
  const afterSet = new Set(afterNames);

  const added = afterNames.filter((n) => !beforeSet.has(n));
  const removed = beforeNames.filter((n) => !afterSet.has(n));

  // Check if common items are in a different order
  const commonBefore = beforeNames.filter((n) => afterSet.has(n));
  const commonAfter = afterNames.filter((n) => beforeSet.has(n));
  const isReordered =
    commonBefore.length > 1 &&
    commonBefore.some((name, idx) => name !== commonAfter[idx]);

  const parts = [];
  if (added.length > 0) {
    parts.push(`Added: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`Removed: ${removed.join(', ')}`);
  }
  if (isReordered) {
    parts.push('Reordered');
  }

  if (parts.length === 0) {
    return 'No changes to picks.';
  }

  let summary = parts.join('. ') + '.';
  if (summary.length > 200) {
    summary = `Picks updated: +${added.length}, -${removed.length}${isReordered ? ', reordered' : ''}. (${summary.slice(0, 150)}...)`;
    if (summary.length > 200) {
      summary = summary.slice(0, 197) + '...';
    }
  }

  return summary;
}

// All endpoints in this router require authenticated content_editor or super_admin
router.use(requireAdmin);
router.use(requireRole('content_editor', 'super_admin'));

/**
 * GET /admin/styles/preview-photo?query=
 * Calls the same photo resolution service as /destinations/trending (24h cache).
 * Returns { photoUrl, photographerName, photographerUrl } or 404 when none.
 * Rate limited to 20/min per admin. Does NOT log query.
 */
router.get('/preview-photo', previewPhotoLimiter, async (req, res) => {
  try {
    const rawQuery = (req.query.query || req.query.q || '').trim();
    if (!rawQuery) {
      return res.status(400).json({ message: 'Query parameter is required.' });
    }

    if (rawQuery.length > 100) {
      return res.status(400).json({ message: 'Query parameter cannot exceed 100 characters.' });
    }

    const photo = await resolveDestinationPhoto(rawQuery, { allowGenericFallback: false });
    if (!photo || !photo.photoUrl) {
      return res.status(404).json({ message: 'No photo found for destination.' });
    }

    return res.status(200).json({
      photoUrl: photo.photoUrl,
      photographerName: photo.photographerName,
      photographerUrl: photo.photographerUrl,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to preview photo.' });
  }
});

/**
 * GET /admin/styles
 * List the 6 style collections with picksCount, version, updatedAt, updatedByEmail
 */
router.get('/', async (req, res) => {
  try {
    const docs = await StyleCollection.find({}).sort({ createdAt: 1 });
    const collections = docs.map((doc) => ({
      key: doc.key,
      picksCount: (doc.picks || []).length,
      version: doc.version,
      updatedAt: doc.updatedAt,
      updatedByEmail: doc.updatedByEmail || null,
    }));

    return res.status(200).json({ collections });
  } catch (error) {
    console.error('Error listing style collections for admin:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /admin/styles/:key
 * Single style collection with full picks array
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_STYLE_KEYS.includes(key)) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    const doc = await StyleCollection.findOne({ key });
    if (!doc) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    return res.status(200).json({
      key: doc.key,
      picks: doc.picks || [],
      version: doc.version,
      updatedAt: doc.updatedAt,
      updatedByEmail: doc.updatedByEmail || null,
    });
  } catch (error) {
    console.error('Error getting style collection for admin:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /admin/styles/:key
 * Full replacement of picks with version conflict check (409) and auditing
 */
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_STYLE_KEYS.includes(key)) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    // Reject unknown body fields
    const allowedBodyFields = ['picks', 'expectedVersion'];
    const unknownBodyKeys = Object.keys(req.body).filter((k) => !allowedBodyFields.includes(k));
    if (unknownBodyKeys.length > 0) {
      return res.status(400).json({ message: `Unknown field: ${unknownBodyKeys[0]}` });
    }

    const { picks, expectedVersion } = req.body;

    if (expectedVersion === undefined || expectedVersion === null || typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
      return res.status(400).json({ message: 'expectedVersion must be an integer.' });
    }

    if (!Array.isArray(picks)) {
      return res.status(400).json({ message: 'picks must be an array.' });
    }

    if (picks.length > 12) {
      return res.status(400).json({ message: 'A style collection can hold at most 12 picks.' });
    }

    const sanitizedPicks = [];
    const seenNormalizedNames = new Set();

    for (let i = 0; i < picks.length; i++) {
      const p = picks[i];
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        return res.status(400).json({ message: `Pick at index ${i} must be an object.` });
      }

      const allowedPickKeys = ['name', 'imageQuery'];
      const unknownPickKeys = Object.keys(p).filter((k) => !allowedPickKeys.includes(k));
      if (unknownPickKeys.length > 0) {
        return res.status(400).json({ message: `Unknown field in pick at index ${i}: ${unknownPickKeys[0]}` });
      }

      if (typeof p.name !== 'string') {
        return res.status(400).json({ message: `Pick at index ${i} requires a string name.` });
      }

      const name = p.name.trim();
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({ message: `Pick name "${name}" must be between 2 and 80 characters.` });
      }

      if (HTML_TAG_REGEX.test(name)) {
        return res.status(400).json({ message: `Pick name "${name}" cannot contain HTML tags.` });
      }

      const normalized = name.toLowerCase().replace(/\s+/g, ' ');
      if (seenNormalizedNames.has(normalized)) {
        return res.status(400).json({ message: `Duplicate pick name "${name}" in collection.` });
      }
      seenNormalizedNames.add(normalized);

      let imageQuery = null;
      if (p.imageQuery !== undefined && p.imageQuery !== null) {
        if (typeof p.imageQuery !== 'string') {
          return res.status(400).json({ message: `imageQuery in pick at index ${i} must be a string.` });
        }
        const trimmedQuery = p.imageQuery.trim();
        if (trimmedQuery.length > 100) {
          return res.status(400).json({ message: `imageQuery in pick at index ${i} cannot exceed 100 characters.` });
        }
        if (HTML_TAG_REGEX.test(trimmedQuery)) {
          return res.status(400).json({ message: `imageQuery in pick at index ${i} cannot contain HTML tags.` });
        }
        if (trimmedQuery.length > 0) {
          imageQuery = trimmedQuery;
        }
      }

      sanitizedPicks.push({
        name,
        ...(imageQuery ? { imageQuery } : {}),
      });
    }

    const collection = await StyleCollection.findOne({ key });
    if (!collection) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    if (collection.version !== expectedVersion) {
      return res.status(409).json({ message: 'This collection changed. Reload and try again.' });
    }

    const beforeNames = (collection.picks || []).map((p) => p.name);
    const afterNames = sanitizedPicks.map((p) => p.name);
    const summary = buildStyleUpdateSummary(beforeNames, afterNames);

    await runAudited(
      req,
      {
        action: 'style.update',
        targetType: 'style_collection',
        targetId: collection.key,
        summary,
        allowedFields: ['picks', 'version'],
        before: { picks: beforeNames, version: collection.version },
        after: { picks: afterNames, version: collection.version + 1 },
      },
      async (session) => {
        collection.picks = sanitizedPicks;
        collection.version = collection.version + 1;
        collection.updatedBy = req.admin._id;
        collection.updatedByEmail = req.admin.email;
        await collection.save({ session });
        return collection;
      }
    );

    invalidateStylePublicCache(key);

    return res.status(200).json({
      key: collection.key,
      picks: collection.picks,
      version: collection.version,
      updatedAt: collection.updatedAt,
      updatedByEmail: collection.updatedByEmail,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Error updating style collection:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
