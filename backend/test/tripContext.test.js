import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTripContext } from '../src/services/agents/tripContext.js';

describe('buildTripContext pure function', () => {
  it('fixture: passenger fields never appear even if present on the input', () => {
    const itinerary = {
      destination: 'Goa',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      budgetTier: 'budget',
      interests: ['beaches', 'culture'],
      budgetEstimate: 15000,
      days: [
        {
          dayNumber: 1,
          estimatedCostINR: 3000,
          accommodationSuggestion: 'Zostel Goa',
          activities: [
            {
              title: 'Anjuna Beach',
              description: 'Relax by the sea',
              suggestedTime: 'Morning',
              done: false,
              location: { lat: 15.58, lon: 73.74, placeName: 'Anjuna Beach' },
            },
          ],
        },
      ],
    };

    const flightsWithSensitiveData = [
      {
        origin: 'DEL',
        destination: 'GOI',
        departureTime: '2026-11-01T06:00:00.000Z',
        status: 'confirmed',
        // SENSITIVE DATA THAT MUST NEVER APPEAR:
        bookingReference: 'XYZ789REF',
        orderId: 'ord_secret_999',
        offerId: 'off_secret_888',
        passengers: [
          {
            givenName: 'John',
            familyName: 'Doe',
            dateOfBirth: '1990-05-15',
            gender: 'm',
            email: 'john.doe@example.com',
            phoneNumber: '+919876543210',
          },
        ],
        passengerNames: ['John Doe', 'Jane Doe'],
        totalAmount: '4500.00',
        currency: 'INR',
        rawOrder: { paymentMethod: 'card_credit', last4: '1234' },
      },
    ];

    const context = buildTripContext(itinerary, [], flightsWithSensitiveData);

    // Whitelisted fields MUST appear:
    assert.match(context, /Route: DEL → GOI/);
    assert.match(context, /2026-11-01T06:00:00.000Z/);
    assert.match(context, /Status: confirmed/);

    // Sensitive passenger, booking ref, and payment fields MUST NEVER appear:
    assert.doesNotMatch(context, /XYZ789REF/);
    assert.doesNotMatch(context, /ord_secret/);
    assert.doesNotMatch(context, /off_secret/);
    assert.doesNotMatch(context, /John/);
    assert.doesNotMatch(context, /Doe/);
    assert.doesNotMatch(context, /1990-05-15/);
    assert.doesNotMatch(context, /john\.doe@example\.com/);
    assert.doesNotMatch(context, /\+919876543210/);
    assert.doesNotMatch(context, /4500\.00/);
    assert.doesNotMatch(context, /card_credit/);
    assert.doesNotMatch(context, /1234/);
  });

  it('fixture: done activities are flagged', () => {
    const itinerary = {
      destination: 'Jaipur',
      days: [
        {
          dayNumber: 1,
          estimatedCostINR: 2000,
          accommodationSuggestion: 'Heritage Haveli',
          activities: [
            {
              title: 'Hawa Mahal',
              description: 'Palace of Winds',
              suggestedTime: 'Morning',
              done: true,
            },
            {
              title: 'City Palace',
              description: 'Royal residence',
              suggestedTime: 'Afternoon',
              done: false,
            },
          ],
        },
      ],
    };

    const context = buildTripContext(itinerary, [], []);

    assert.match(context, /Hawa Mahal \[Done\]/);
    assert.match(context, /City Palace \[Not done\]/);
  });

  it('fixture: estimates and actuals are labelled differently', () => {
    const itinerary = {
      destination: 'Kerala',
      budgetEstimate: 25000,
      days: [
        {
          dayNumber: 1,
          estimatedCostINR: 5000,
          accommodationSuggestion: 'Backwater Resort',
          activities: [],
        },
      ],
    };

    const expenses = [
      { amountINR: 1200, category: 'Food' },
      { amountINR: 800, category: 'Transport' },
    ];

    const context = buildTripContext(itinerary, expenses, []);

    // Total and day estimates must be explicitly labelled "AI estimate"
    assert.match(context, /Total Estimated Cost: ₹25000 \(AI estimate\)/);
    assert.match(context, /Day Estimated Cost: ₹5000 \(AI estimate\)/);

    // Logged expenses must be explicitly labelled "actual, logged by the user, not tied to a specific day"
    assert.match(
      context,
      /actual, logged by the user, not tied to a specific day/
    );
    assert.match(context, /Total Logged: ₹2000 \(actual, logged by the user, not tied to a specific day\)/);
    assert.match(context, /Food: ₹1200/);
    assert.match(context, /Transport: ₹800/);
  });

  it('fixture: missing data produces the NOT AVAILABLE entries', () => {
    // Empty / missing data
    const context = buildTripContext({}, null, null);

    assert.match(context, /=== NOT AVAILABLE IN TRIP DATA ===/);
    assert.match(context, /- Number of travelers/);
    assert.match(context, /- Opening hours/);
    assert.match(context, /- Travel times between places/);
    assert.match(context, /- Ticket prices/);
    assert.match(context, /- Hotel confirmations/);
    assert.match(context, /- Train\/bus\/cab bookings/);

    // Missing destination & overview fields fallback safely
    assert.match(context, /Destination: Not specified/);
    assert.match(context, /Dates: Not specified/);
    assert.match(context, /Budget Tier: Not specified/);
    assert.match(context, /Interests: None specified/);
    assert.match(context, /Total Estimated Cost: Not specified \(AI estimate\)/);
  });

  it('fixture: a day with no activities', () => {
    const itinerary = {
      destination: 'Manali',
      days: [
        {
          dayNumber: 1,
          estimatedCostINR: 1500,
          accommodationSuggestion: 'Snow Valley Resort',
          activities: [],
        },
        {
          dayNumber: 2,
          estimatedCostINR: 2500,
          accommodationSuggestion: 'Snow Valley Resort',
          activities: null,
        },
      ],
    };

    const context = buildTripContext(itinerary, [], []);

    assert.match(context, /Day 1/);
    assert.match(context, /Day 2/);
    const noActivitiesMatches = context.match(/Activities: No activities scheduled/g);
    assert.equal(noActivitiesMatches?.length, 2);
  });
});

