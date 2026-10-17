import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  routeIntent,
  getOffTopicMessage,
  GENERAL_ASSISTANT_AVAILABLE,
  OFF_TOPIC_MESSAGES,
} from '../src/services/agents/intentNode.js';

describe('routeIntent and off-topic message selection', () => {
  const allowedAnswerTypes = new Set([
    'trip',
    'general',
    'edit',
    'booking',
    'in_journey',
    'redirect',
  ]);

  describe('routeIntent pure function', () => {
    it('routes trip_question to trip answerType', () => {
      const res = routeIntent('trip_question');
      assert.equal(res.answerType, 'trip');
      assert.equal(res.handler, 'trip');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('routes general_question to general answerType', () => {
      const res = routeIntent('general_question');
      assert.equal(res.answerType, 'general');
      assert.equal(res.handler, 'general');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('routes edit_request to edit answerType', () => {
      const res = routeIntent('edit_request');
      assert.equal(res.answerType, 'edit');
      assert.equal(res.handler, 'edit');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('routes booking_question to booking answerType', () => {
      const res = routeIntent('booking_question');
      assert.equal(res.answerType, 'booking');
      assert.equal(res.handler, 'booking');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('routes off_topic to redirect answerType', () => {
      const res = routeIntent('off_topic');
      assert.equal(res.answerType, 'redirect');
      assert.equal(res.handler, 'redirect');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('routes in_journey to in_journey answerType', () => {
      const res = routeIntent('in_journey');
      assert.equal(res.answerType, 'in_journey');
      assert.equal(res.handler, 'in_journey');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });

    it('defaults unknown intent to general answerType', () => {
      const res = routeIntent('unknown_custom_intent');
      assert.equal(res.answerType, 'general');
      assert.equal(res.handler, 'general');
      assert.ok(allowedAnswerTypes.has(res.answerType));
    });
  });

  describe('getOffTopicMessage selection with flag on and off', () => {
    it('GENERAL_ASSISTANT_AVAILABLE config constant is true', () => {
      assert.strictEqual(GENERAL_ASSISTANT_AVAILABLE, true);
    });

    it('returns unavailable message when flag is false', () => {
      const message = getOffTopicMessage(false);
      assert.equal(
        message,
        "I focus on your trip and travel plans, so I can't help with that. If it relates to your trip, tell me how."
      );
      assert.equal(message, OFF_TOPIC_MESSAGES.unavailable);
    });

    it('returns available message when flag is true', () => {
      const message = getOffTopicMessage(true);
      assert.equal(
        message,
        "I focus on your trip, so I can't help with that here. For general questions, try the Travel Assistant."
      );
      assert.equal(message, OFF_TOPIC_MESSAGES.available);
    });

    it('default invocation respects GENERAL_ASSISTANT_AVAILABLE constant', () => {
      const defaultMessage = getOffTopicMessage();
      assert.equal(
        defaultMessage,
        "I focus on your trip, so I can't help with that here. For general questions, try the Travel Assistant."
      );
    });
  });
});

