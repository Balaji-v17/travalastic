Continue with the next Travalastic consumer-product task.

The AppProvider / Router runtime issue has already been fixed and the application is now loading correctly.

DO NOT redesign or rewrite unrelated screens.

First audit the CURRENT implementation of:

- MyTripsPage
- JourneyPage
- AppContext
- booking flows
- confirmation flow
- itinerary state
- navigation/state transitions

Then improve only what is actually missing.

PRIMARY GOAL:

Make My Trips the ownership layer connecting:

Home
→ Explore
→ Destination
→ Journey AI
→ Journey
→ Detail Pages
→ Booking
→ Confirmation
→ My Trips
→ Continue Planning

==================================================
MY TRIPS
==================================================

Make My Trips feel like a premium personal travel space, NOT a dashboard.

It should clearly communicate:

Upcoming journeys
Planning journeys
Completed journeys
Booking progress
Budget progress
What needs attention
Continue planning

Use real application state.

No hardcoded counts.

==================================================
ACTIVE JOURNEY
==================================================

Feature the most relevant upcoming/active journey.

Show:

Destination
Dates
Travelers
Journey Health
Booked items / total itinerary items
Total planned
Total booked
Remaining budget

Actions:

Open Journey
Continue Planning
Ask Journey AI

==================================================
CONTINUE PLANNING
==================================================

If itinerary items remain unbooked, surface them.

Example:

Still to arrange

✈ Mumbai → Tokyo
🏨 Kyoto hotel
🍣 Tsukiji food tour

Each item must open its CORRECT detail/booking flow.

Hotel must NEVER open the flight booking flow.

Experience must NEVER show flight fields.

Flight must NEVER open hotel/experience fields.

==================================================
BOOKING STATE
==================================================

Every booking must use explicit IDs.

Never use:

journeys[0]
hotels[0]
flights[0]
experiences[0]

Use:

journeyId
bookingId
itineraryItemId
hotelId
experienceId
flightId
destinationId

==================================================
BOOKING PROGRESS
==================================================

Calculate dynamically.

Example:

4 / 7 booked

When hotel booking completes:

4 / 7 → 5 / 7

When cancelled:

5 / 7 → 4 / 7

No hardcoded progress.

==================================================
BUDGET
==================================================

Use the same budget source used by Journey AI.

Show:

Total planned
Booked
Remaining

When booking:

Booked increases
Remaining decreases

When cancelling:

Booked decreases
Remaining increases

Do not create a second budget system.

==================================================
CONFIRMATION
==================================================

After successful booking:

Hotel:
Confirmation
→ SAME originating journey

Experience:
Confirmation
→ SAME originating journey

Flight:
Confirmation
→ SAME originating journey

If booking originated from Search/Destination/Deals without a journey:

Do NOT attach it to an arbitrary journey.

==================================================
JOURNEY SYNCHRONIZATION
==================================================

The following must always agree:

My Trips
Journey
Journey AI
Booking Confirmation

Example:

Hotel = BOOKED

My Trips:
5 / 7 booked

Journey:
Hotel ✓ BOOKED

Journey AI:
"What have I booked?"
→ Hotel ✓

All derived from the same state.

==================================================
ASK JOURNEY AI
==================================================

From My Trips and Journey, support:

What's next?
What have I booked?
How much have I spent?
How much budget remains?
What still needs booking?
Can I make this cheaper?
Is my itinerary too busy?

Responses must use CURRENT journey state.

==================================================
NAVIGATION AUDIT
==================================================

Verify:

Home → Explore
Explore → Destination
Destination → Detail
Detail → Booking
Booking → Confirmation
Confirmation → Journey
Journey → My Trips
My Trips → Journey
Journey → Journey AI

No dead ends.

No generic redirects.

==================================================
BACK NAVIGATION
==================================================

Preserve context.

Search → Hotel Detail → Back
must return to Search.

Journey → Hotel Detail → Back
must return to Journey.

Journey → Booking → Confirmation
must return to the originating Journey.

==================================================
FINAL QA
==================================================

Actually test these flows:

1. Create journey with Journey AI.
2. Verify it appears in My Trips.
3. Open journey.
4. Book hotel.
5. Verify hotel becomes BOOKED.
6. Verify budget updates.
7. Verify booking count updates.
8. Return to journey.
9. Book experience.
10. Verify experience becomes BOOKED.
11. Book flight.
12. Verify flight becomes BOOKED.
13. Open My Trips.
14. Verify all three bookings are reflected.
15. Ask Journey AI what is booked.
16. Ask what's next.
17. Verify remaining unbooked itinerary items.
18. Test a standalone hotel booking from Search.
19. Verify it does NOT attach to journeys[0].
20. Verify browser/app navigation remains stable.

Do not report success merely because TypeScript compiles.

Report:

- what was already correct
- what was changed
- what was tested
- any remaining issues
- TypeScript status
- runtime console status