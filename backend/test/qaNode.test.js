import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkInJourney } from '../src/services/agents/qaNode.js';

describe('qaNode - checkInJourney', () => {
  const sampleItinerary = {
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    days: [
      {
        dayNumber: 1,
        estimatedCostINR: 2000,
        accommodationSuggestion: 'Taj Fort Aguada',
        activities: [
          {
            title: 'Morning Yoga on Beach',
            name: 'Morning Yoga on Beach',
            suggestedTime: 'Morning',
            description: 'Relax by the waves',
            done: false,
          },
          {
            title: 'Chapora Fort Visit',
            name: 'Chapora Fort Visit',
            suggestedTime: 'Afternoon',
            description: 'Explore scenic ruins',
            done: false,
          },
          {
            title: 'Sunset Cruise',
            name: 'Sunset Cruise',
            suggestedTime: 'Evening',
            description: 'Mandovi river cruise',
            done: false,
          },
        ],
      },
    ],
  };

  const todayDate = new Date('2026-10-12T10:00:00Z');

  it('answers "what\'s next" with the first not-done activity', () => {
    const result = checkInJourney(sampleItinerary, "What's next?", todayDate);
    assert.ok(result);
    assert.equal(result.inJourney, true);
    assert.equal(result.dayNumber, 1);
    assert.match(result.answer, /Next up for today \(Day 1\): \[Morning\] Morning Yoga on Beach/);
  });

  it('answers "what\'s next" with the second activity when the first is marked done', () => {
    const itinWithFirstDone = {
      ...sampleItinerary,
      days: [
        {
          ...sampleItinerary.days[0],
          activities: [
            { ...sampleItinerary.days[0].activities[0], done: true },
            sampleItinerary.days[0].activities[1],
            sampleItinerary.days[0].activities[2],
          ],
        },
      ],
    };

    const result = checkInJourney(itinWithFirstDone, "what's next", todayDate);
    assert.ok(result);
    assert.match(result.answer, /Next up for today \(Day 1\): \[Afternoon\] Chapora Fort Visit/);
  });

  it('says everything is done if none remain not-done', () => {
    const itinAllDone = {
      ...sampleItinerary,
      days: [
        {
          ...sampleItinerary.days[0],
          activities: sampleItinerary.days[0].activities.map((a) => ({ ...a, done: true })),
        },
      ],
    };

    const result = checkInJourney(itinAllDone, "What is next?", todayDate);
    assert.ok(result);
    assert.equal(result.answer, 'Everything is done for today!');
  });

  it('preserves full schedule answer for non-next questions (e.g. today schedule)', () => {
    const result = checkInJourney(sampleItinerary, "What is today's schedule?", todayDate);
    assert.ok(result);
    assert.match(result.answer, /Today \(Day 1\) you have:/);
    assert.match(result.answer, /Morning Yoga on Beach/);
    assert.match(result.answer, /Chapora Fort Visit/);
    assert.match(result.answer, /Sunset Cruise/);
    assert.match(result.answer, /Stay: Taj Fort Aguada/);
  });
});

