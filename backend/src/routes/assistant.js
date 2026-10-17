import express from 'express';
import { rateLimit } from 'express-rate-limit';
import authenticate from '../middleware/authenticate.js';
import { findUserItinerary } from '../models/Itinerary.js';
import {
  validateAssistantRequest,
  buildTripHint,
  callTravelAssistant,
} from '../services/travelAssistantService.js';

export const ASSISTANT_RATE_LIMIT_PER_HOUR = 30;

export const assistantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: ASSISTANT_RATE_LIMIT_PER_HOUR,
  keyGenerator: (req) => (req.userId ? req.userId.toString() : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many assistant messages. Please try again after an hour.' },
});

const router = express.Router();

/**
 * POST /assistant/message
 *
 * Stateless Travel Assistant endpoint:
 * - Auth-protected via JWT authenticate middleware
 * - Rate limited to 30 messages/hour per user
 * - Validates input via pure function validateAssistantRequest
 * - Optional tripId loaded with ownership check and pure buildTripHint extraction
 * - Privacy: stores nothing in database; never logs prompt, history, or reply content
 * - Returns { reply, sources }
 */
router.post('/message', authenticate, assistantLimiter, async (req, res) => {
  const startTime = Date.now();
  let messageLength = 0;
  let toolUsed = false;

  try {
    // 1. Validate request body via pure function
    const validation = validateAssistantRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const { message, history, tripId } = validation;
    messageLength = message.length;

    // 2. Optional tripId: load with ownership check and extract whitelisted fields
    let tripHint = '';
    if (tripId) {
      const itinerary = await findUserItinerary(tripId, req.userId);
      if (!itinerary) {
        return res.status(404).json({ error: 'Itinerary not found' });
      }
      tripHint = buildTripHint(itinerary);
    }

    // 3. Call Travel Assistant service
    const result = await callTravelAssistant({
      message,
      history,
      tripHint,
    });

    const sources = Array.isArray(result?.sources) ? result.sources : [];
    toolUsed = sources.length > 0;

    // 4. Privacy logging: log ONLY userId, message length, tool-used, and latency
    const latencyMs = Date.now() - startTime;
    console.info(
      `[Assistant] userId=${req.userId} msgLen=${messageLength} toolUsed=${toolUsed} latency=${latencyMs}ms`
    );

    // 5. Return structured response
    return res.status(200).json({
      reply: result?.reply || '',
      sources,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.warn(
      `[Assistant] error userId=${req.userId} msgLen=${messageLength} latency=${latencyMs}ms: ${error.message}`
    );

    // Map provider errors, 429s, or 503s to standard 503 Service Unavailable
    if (
      error.status === 503 ||
      error.status === 429 ||
      /groq|openai|rate limit|provider|quota|service unavailable/i.test(error.message)
    ) {
      return res.status(503).json({
        error: 'Travel Assistant is temporarily unavailable. Please try again shortly.',
      });
    }

    return res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

