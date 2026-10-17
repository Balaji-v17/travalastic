import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Itinerary from '../src/models/Itinerary.js';
import Expense from '../src/models/Expense.js';
import Booking from '../src/models/Booking.js';
import { answerTripQuestion, tripQaNode } from '../src/services/agents/tripQaNode.js';

describe('tripQaNode - Grounded trip Q&A', () => {
  const originalGroqKey = process.env.GROQ_API_KEY;

  before(() => {
    delete process.env.GROQ_API_KEY;
  });

  after(() => {
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
  });

  const testUserId = new mongoose.Types.ObjectId();
  const testItineraryId = new mongoose.Types.ObjectId();

  it('rejects with 404 when itinerary is missing or not owned by user', async () => {
    const origFindOne = Itinerary.findOne;
    Itinerary.findOne = async () => null;

    try {
      await assert.rejects(
        async () => {
          await answerTripQuestion({
            question: 'What is planned on day 1?',
            itineraryId: testItineraryId.toString(),
            userId: testUserId.toString(),
          });
        },
        (err) => {
          assert.equal(err.status, 404);
          assert.equal(err.message, 'Itinerary not found');
          return true;
        }
      );
    } finally {
      Itinerary.findOne = origFindOne;
    }
  });

  it('replies that itinerary has not been generated yet when days array is empty (no LLM call)', async () => {
    const origFindOne = Itinerary.findOne;
    Itinerary.findOne = async () => ({
      _id: testItineraryId,
      userId: testUserId,
      destination: 'Goa',
      days: [],
    });

    try {
      const result = await answerTripQuestion({
        question: 'What am I doing on day 1?',
        itineraryId: testItineraryId.toString(),
        userId: testUserId.toString(),
      });

      assert.ok(result);
      assert.equal(result.grounded, false);
      assert.match(
        result.answer,
        /Your itinerary hasn't been generated yet\. Please generate an itinerary first/i
      );
    } finally {
      Itinerary.findOne = origFindOne;
    }
  });

  it('prioritizes in-trip "what\'s next" shortcut without an LLM call', async () => {
    const origFindOne = Itinerary.findOne;
    const todayStr = '2026-11-02';
    const mockItin = {
      _id: testItineraryId,
      userId: testUserId,
      destination: 'Jaipur',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      days: [
        {
          dayNumber: 1,
          activities: [{ title: 'Amber Fort', done: true }],
        },
        {
          dayNumber: 2,
          activities: [
            {
              title: 'City Palace',
              suggestedTime: 'Morning',
              description: 'Royal courtyards',
              done: false,
            },
          ],
        },
      ],
    };

    Itinerary.findOne = async () => mockItin;

    try {
      const result = await answerTripQuestion({
        question: "what's next?",
        itineraryId: testItineraryId.toString(),
        userId: testUserId.toString(),
        currentDate: new Date(`${todayStr}T10:00:00Z`),
      });

      assert.ok(result);
      assert.equal(result.inJourney, true);
      assert.equal(result.dayNumber, 2);
      assert.match(result.answer, /Next up for today \(Day 2\): \[Morning\] City Palace/);
    } finally {
      Itinerary.findOne = origFindOne;
    }
  });

  it('loads fresh from DB and answers grounded question for active days', async () => {
    const origFindOne = Itinerary.findOne;
    const origExpenseFind = Expense.find;
    const origBookingFind = Booking.find;

    const mockItin = {
      _id: testItineraryId,
      userId: testUserId,
      destination: 'Goa',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      budgetTier: 'budget',
      interests: ['beaches'],
      budgetEstimate: 12000,
      days: [
        {
          dayNumber: 1,
          estimatedCostINR: 2500,
          accommodationSuggestion: 'Zostel Goa',
          activities: [
            {
              title: 'Calangute Beach',
              suggestedTime: 'Morning',
              description: 'Sun and sand',
              done: false,
              location: { lat: 15.54, lon: 73.75, placeName: 'Calangute' },
            },
          ],
        },
      ],
    };

    let findOneCalled = 0;
    Itinerary.findOne = async () => {
      findOneCalled++;
      return mockItin;
    };

    Expense.find = () => ({
      sort: () => [{ amountINR: 500, category: 'Food' }],
    });

    Booking.find = () => ({
      sort: () => [
        {
          origin: 'DEL',
          destination: 'GOI',
          departureTime: new Date('2026-12-01T08:00:00Z'),
          status: 'confirmed',
        },
      ],
    });

    try {
      const convHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
        { role: 'user', content: 'What is planned on day 1?' },
      ];

      const result = await answerTripQuestion({
        question: 'What is planned on day 1?',
        itineraryId: testItineraryId.toString(),
        userId: testUserId.toString(),
        conversationMessages: convHistory,
      });

      assert.equal(findOneCalled, 1, 'Fresh reload on request verified');
      assert.ok(result);
      assert.equal(result.grounded, true);
      assert.ok(result.answer.length > 0);
    } finally {
      Itinerary.findOne = origFindOne;
      Expense.find = origExpenseFind;
      Booking.find = origBookingFind;
    }
  });

  it('tripQaNode wrapper correctly delegates state', async () => {
    const origFindOne = Itinerary.findOne;
    const origExpenseFind = Expense.find;
    const origBookingFind = Booking.find;

    Itinerary.findOne = async () => ({
      _id: testItineraryId,
      userId: testUserId,
      destination: 'Hampi',
      days: [
        {
          dayNumber: 1,
          activities: [{ title: 'Virupaksha Temple', done: false }],
        },
      ],
    });

    Expense.find = () => ({ sort: () => [] });
    Booking.find = () => ({ sort: () => [] });

    try {
      const state = {
        question: 'Which temple do I visit?',
        itineraryId: testItineraryId.toString(),
        userId: testUserId.toString(),
        messages: [{ role: 'user', content: 'Which temple do I visit?' }],
      };

      const newState = await tripQaNode(state);
      assert.ok(newState.tripQaResult);
      assert.ok(newState.answer);
    } finally {
      Itinerary.findOne = origFindOne;
      Expense.find = origExpenseFind;
      Booking.find = origBookingFind;
    }
  });
});

