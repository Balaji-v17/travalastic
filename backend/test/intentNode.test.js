import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  IntentEnum,
  classifyIntentFallback,
  classifyIntent,
} from '../src/services/agents/intentNode.js';

describe('Intent Classifier - 5-intent taxonomy', () => {
  const originalGroqKey = process.env.GROQ_API_KEY;

  before(() => {
    delete process.env.GROQ_API_KEY;
  });

  after(() => {
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
  });

  it('fixed intent enum contains exactly the 5 required intents', () => {
    assert.deepEqual(IntentEnum.options, [
      'edit_request',
      'trip_question',
      'general_question',
      'booking_question',
      'off_topic',
    ]);
  });

  describe('Required prompt cases (fallback & classification logic)', () => {
    it('"what am I doing on day 2" -> trip_question', async () => {
      const res = await classifyIntent('what am I doing on day 2');
      assert.equal(res.intent, 'trip_question');
    });

    it('"how much will day 2 cost" -> trip_question', async () => {
      const res = await classifyIntent('how much will day 2 cost');
      assert.equal(res.intent, 'trip_question');
    });

    it('"can I fit Jog Falls on day 1" -> trip_question', async () => {
      const res = await classifyIntent('can I fit Jog Falls on day 1');
      assert.equal(res.intent, 'trip_question');
    });

    it('"make day 2 cheaper" -> edit_request', async () => {
      const res = await classifyIntent('make day 2 cheaper');
      assert.equal(res.intent, 'edit_request');
    });

    it('"what\'s the capital of France" -> off_topic', async () => {
      const res = await classifyIntent("what's the capital of France");
      assert.equal(res.intent, 'off_topic');
    });

    it('"write me a python script" -> off_topic', async () => {
      const res = await classifyIntent('write me a python script');
      assert.equal(res.intent, 'off_topic');
    });

    it('"tell me a joke" -> off_topic', async () => {
      const res = await classifyIntent('tell me a joke');
      assert.equal(res.intent, 'off_topic');
    });

    it('"what should I pack" -> general_question', async () => {
      const res = await classifyIntent('what should I pack');
      assert.equal(res.intent, 'general_question');
    });

    it('"best food in Mysore" -> general_question', async () => {
      const res = await classifyIntent('best food in Mysore');
      assert.equal(res.intent, 'general_question');
    });

    it('"is it safe to travel to Kashmir in November" -> general_question', async () => {
      const res = await classifyIntent('is it safe to travel to Kashmir in November');
      assert.equal(res.intent, 'general_question');
    });
  });

  describe('Additional clear & ambiguous cases', () => {
    it('schedule and activity inquiries on saved itinerary -> trip_question', () => {
      assert.equal(classifyIntentFallback('which day has the beach visit?'), 'trip_question');
      assert.equal(classifyIntentFallback('what do I have on day 3?'), 'trip_question');
      assert.equal(classifyIntentFallback('show me day 1 activities'), 'trip_question');
      assert.equal(classifyIntentFallback('where am I staying on day 2?'), 'trip_question');
    });

    it('feasibility questions -> trip_question', () => {
      assert.equal(
        classifyIntentFallback('do I have time for scuba diving on day 1?'),
        'trip_question'
      );
      assert.equal(
        classifyIntentFallback('will an extra museum visit fit into day 2?'),
        'trip_question'
      );
      assert.equal(
        classifyIntentFallback('is it feasible to visit Chapora Fort on day 3?'),
        'trip_question'
      );
    });

    it('cost, estimates, and expenses inquiries -> trip_question', () => {
      assert.equal(classifyIntentFallback('what is the estimated cost of day 1?'), 'trip_question');
      assert.equal(classifyIntentFallback('total cost of the trip'), 'trip_question');
      assert.equal(classifyIntentFallback('how much did I spend so far?'), 'trip_question');
      assert.equal(classifyIntentFallback('what are my logged expenses?'), 'trip_question');
    });

    it('flight inquiries -> trip_question', () => {
      assert.equal(classifyIntentFallback('what are my flights?'), 'trip_question');
      assert.equal(classifyIntentFallback('check flight status'), 'trip_question');
      assert.equal(classifyIntentFallback('when is my flight?'), 'trip_question');
    });

    it('explicit edit commands on itinerary -> edit_request', () => {
      assert.equal(
        classifyIntentFallback('change day 2 to visit Baga beach instead'),
        'edit_request'
      );
      assert.equal(classifyIntentFallback('remove morning museum on day 3'), 'edit_request');
      assert.equal(classifyIntentFallback('swap day 1 and day 2'), 'edit_request');
      assert.equal(classifyIntentFallback('reschedule day 1 afternoon'), 'edit_request');
      assert.equal(classifyIntentFallback('add dinner at Fisherman Wharf on day 2'), 'edit_request');
      assert.equal(classifyIntentFallback('make the trip less hectic'), 'edit_request');
    });

    it('booking transaction inquiries without planning -> booking_question', () => {
      assert.equal(classifyIntentFallback('book me a flight to Delhi'), 'booking_question');
      assert.equal(classifyIntentFallback('buy tickets for flight'), 'booking_question');
      assert.equal(classifyIntentFallback('reserve a cab right now'), 'booking_question');
    });

    it('planning inquiries with hotel/room words remain general_question (deflection override)', () => {
      assert.equal(
        classifyIntentFallback('Provide a 2 days trip for Goa, search for budget rooms, and add a hidden gem'),
        'general_question'
      );
      assert.equal(
        classifyIntentFallback('Plan a weekend in Jaipur with budget stays'),
        'general_question'
      );
    });

    it('general travel advice and weather inquiries -> general_question', () => {
      assert.equal(classifyIntentFallback('what is the weather like in Goa in December?'), 'general_question');
      assert.equal(classifyIntentFallback('recommend top 5 local foods in Kerala'), 'general_question');
      assert.equal(classifyIntentFallback('is it safe to travel solo in Tokyo?'), 'general_question');
    });

    it('off-topic math and personal advice -> off_topic', () => {
      assert.equal(classifyIntentFallback('what is 2 + 2'), 'off_topic');
      assert.equal(classifyIntentFallback('should I break up with my girlfriend?'), 'off_topic');
    });

    it('empty or whitespace-only message returns general_question', () => {
      assert.equal(classifyIntentFallback(''), 'general_question');
      assert.equal(classifyIntentFallback('   '), 'general_question');
    });
  });
});
