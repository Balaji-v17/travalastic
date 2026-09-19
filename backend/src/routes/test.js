import express from 'express';
import { classifyIntent } from '../services/agents/intentNode.js';

const router = express.Router();

/**
 * Temporary test route: POST /test/intent
 * Accepts: { message: string }
 * Returns: { intent: "edit_request" | "general_question" | "booking_question" }
 */
router.post('/intent', async (req, res, next) => {
  try {
    const { message } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message string is required in request body' });
    }

    const result = await classifyIntent(message);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

