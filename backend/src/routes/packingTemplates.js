import express from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/authenticate.js';
import PackingTemplate from '../models/PackingTemplate.js';

const router = express.Router();

/**
 * POST /packing-templates
 * Auth-protected.
 * Body: { name, items: [{ text, category? }] }
 * Name: 1-40 chars, trimmed, unique per user (case-insensitive).
 * Items: 1-40 entries, each text 1-80 chars, category 1-40 chars (default "My items").
 * Drops duplicate texts (case-insensitive).
 * Max 10 templates per user.
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, items } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 40) {
      return res.status(400).json({ error: 'Template name cannot exceed 40 characters' });
    }

    // At most 10 templates per user & case-insensitive name uniqueness check
    const userTemplates = await PackingTemplate.find({ userId: req.userId });
    if (userTemplates.length >= 10) {
      return res.status(400).json({ error: 'Maximum limit of 10 templates per user reached' });
    }

    const lowerName = trimmedName.toLowerCase();
    if (userTemplates.some((t) => t.name.toLowerCase() === lowerName)) {
      return res.status(400).json({ error: 'A template with this name already exists' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be an array with 1 to 40 entries' });
    }

    if (items.length > 40) {
      return res.status(400).json({ error: 'items cannot contain more than 40 entries' });
    }

    const dedupedItems = [];
    const seenTexts = new Set();

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rawText = typeof it === 'string' ? it : it?.text;
      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ error: `Item at index ${i} has empty text` });
      }
      const itemText = rawText.trim();
      if (itemText.length > 80) {
        return res.status(400).json({ error: `Item "${itemText.slice(0, 20)}..." exceeds 80 characters` });
      }

      const rawCategory =
        typeof it === 'object' && it?.category !== undefined && it?.category !== null
          ? String(it.category).trim()
          : 'My items';
      const itemCategory = rawCategory.length > 0 ? rawCategory : 'My items';
      if (itemCategory.length > 40) {
        return res.status(400).json({ error: `Category for "${itemText.slice(0, 20)}..." exceeds 40 characters` });
      }

      const lowerText = itemText.toLowerCase();
      if (!seenTexts.has(lowerText)) {
        seenTexts.add(lowerText);
        dedupedItems.push({
          text: itemText,
          category: itemCategory,
        });
      }
    }

    if (dedupedItems.length < 1) {
      return res.status(400).json({ error: 'Template must contain at least 1 item' });
    }
    if (dedupedItems.length > 40) {
      return res.status(400).json({ error: 'Template can contain at most 40 items' });
    }

    const template = await PackingTemplate.create({
      userId: req.userId,
      name: trimmedName,
      items: dedupedItems,
    });

    return res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /packing-templates
 * Auth-protected.
 * Returns [{ id, name, itemCount, createdAt }].
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const templates = await PackingTemplate.find({ userId: req.userId }).sort({ createdAt: -1 });
    const formatted = templates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      itemCount: Array.isArray(t.items) ? t.items.length : 0,
      createdAt: t.createdAt,
    }));
    return res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /packing-templates/:id
 * Auth-protected.
 * Ownership-checked: missing or someone else's returns generic 404.
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Packing template not found' });
    }

    const template = await PackingTemplate.findOne({ _id: id, userId: req.userId });
    if (!template) {
      return res.status(404).json({ error: 'Packing template not found' });
    }

    await PackingTemplate.deleteOne({ _id: id, userId: req.userId });
    return res.status(200).json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

