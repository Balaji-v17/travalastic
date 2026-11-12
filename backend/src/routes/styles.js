import express from 'express';
import StyleCollection, { ALLOWED_STYLE_KEYS } from '../models/StyleCollection.js';

const router = express.Router();

// Server-side in-memory cache of 60s per key
export const stylePublicCache = new Map();
export const STYLE_CACHE_TTL_MS = 60 * 1000;

export function invalidateStylePublicCache(key) {
  if (key) {
    stylePublicCache.delete(key);
  } else {
    stylePublicCache.clear();
  }
}

/**
 * Public endpoint: GET /styles/:key
 * Returns { key, picks: [{ name, imageQuery? }], version }
 * No auth. Cache-Control: public, max-age=60.
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    if (!ALLOWED_STYLE_KEYS.includes(key)) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    // Check in-memory 60s cache
    const cached = stylePublicCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json(cached.data);
    }

    const doc = await StyleCollection.findOne({ key });
    if (!doc) {
      return res.status(404).json({ message: 'Style collection not found.' });
    }

    const picks = (doc.picks || []).map((p) => {
      const pickObj = { name: p.name };
      if (p.imageQuery && p.imageQuery.trim()) {
        pickObj.imageQuery = p.imageQuery.trim();
      }
      return pickObj;
    });

    const responseData = {
      key: doc.key,
      picks,
      version: doc.version,
    };

    stylePublicCache.set(key, {
      data: responseData,
      expiresAt: Date.now() + STYLE_CACHE_TTL_MS,
    });

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching style collection:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

