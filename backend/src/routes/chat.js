import express from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/authenticate.js';
import { findUserItinerary } from '../models/Itinerary.js';
import Conversation from '../models/Conversation.js';
import { classifyIntent } from '../services/agents/intentNode.js';
import { editItinerary } from '../services/agents/editNode.js';
import { answerQuestion } from '../services/agents/qaNode.js';

const router = express.Router();

/**
 * POST /chat/message
 * Protected by JWT authenticate middleware.
 * Accepts: { itineraryId: string, message: string, conversationId?: string }
 * Returns: { reply: string, updatedItinerary: Object | null, conversationId: string }
 */
router.post('/message', authenticate, async (req, res, next) => {
  try {
    const { itineraryId, message, conversationId } = req.body || {};

    if (!itineraryId || typeof itineraryId !== 'string' || !itineraryId.trim()) {
      return res.status(400).json({ error: 'itineraryId is required in request body' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message string is required in request body' });
    }

    // 1. Verify the itinerary belongs to req.userId (reusing findUserItinerary)
    const itinerary = await findUserItinerary(itineraryId.trim(), req.userId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // 2. Find Conversation by conversationId, or create a new one keyed to userId + itineraryId
    let conversation = null;
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.userId,
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        userId: req.userId,
        itineraryId: itinerary._id,
        messages: [],
      });
    }

    // 3. Append user message to conversation history
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    });

    // 4. Run intentNode to classify the message
    const classification = await classifyIntent(message.trim());
    const intent = classification?.intent || 'general_question';

    let reply = '';
    let updatedItinerary = null;

    // 5. Route based on intent
    if (intent === 'edit_request') {
      const editResult = await editItinerary({
        itineraryId: itinerary._id,
        userId: req.userId,
        editRequest: message.trim(),
      });

      if (editResult.success && editResult.itinerary) {
        const doc = editResult.itinerary.toObject
          ? editResult.itinerary.toObject()
          : editResult.itinerary;

        updatedItinerary = {
          ...doc,
          itineraryId: doc._id,
          itinerary: doc.days,
        };

        reply = editResult.changeDescription
          ? `I have updated your itinerary: ${editResult.changeDescription}`
          : 'I have updated your itinerary according to your request.';
      } else {
        updatedItinerary = null;
        reply = editResult.error || 'Could not modify the itinerary with that request.';
      }
    } else if (intent === 'booking_question') {
      reply = 'You can search and book that from the Book tab.';
      updatedItinerary = null;
    } else {
      // General question (or in-journey schedule question)
      const qaResult = await answerQuestion({
        question: message.trim(),
        itinerary,
      });
      reply = qaResult.answer || 'Here is the information you requested.';
      updatedItinerary = null;
    }

    // 6. Append assistant reply to conversation history and persist
    conversation.messages.push({
      role: 'assistant',
      content: reply,
      timestamp: new Date(),
    });

    await conversation.save();

    // 7. Return response
    return res.status(200).json({
      reply,
      updatedItinerary,
      conversationId: conversation._id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

