TRAVALASTIC — MY TRIPS + END-TO-END CONSUMER FLOW

Do NOT add another isolated feature.

The core consumer product now contains:

Home
Explore
Destination Detail
Hotel Detail
Experience Detail
Flight Search / Detail
Journey AI
Hotel Booking
Experience Booking
Flight Booking
My Trips
Journey

Now make My Trips the central ownership layer and perform an end-to-end consumer flow audit.

==================================================
PART 1 — MY TRIPS REDESIGN
==================================================

My Trips should answer:

"What are my trips?"
"What is happening next?"
"What have I booked?"
"What still needs to be booked?"
"Where do I continue planning?"

Do NOT make it a simple card grid.

==================================================
1. MY TRIPS HEADER
==================================================

Show:

My Trips

"Everything you're planning, booking and experiencing."

Stats:

Upcoming
Planning
Completed

Use actual journey state.

Do not use arbitrary numbers.

==================================================
2. ACTIVE JOURNEY
==================================================

If an active journey exists, feature it prominently.

Example:

TOKYO SPRING ESCAPE

Mar 15–22
2 travelers

Journey Health:
92 / 100

Booked:
4 / 7 items

₹1,12,400 booked
₹35,600 remaining

CTA:

"Open journey"

Secondary:

"Ask Journey AI"

==================================================
3. CONTINUE PLANNING
==================================================

If a journey has unbooked items:

Show:

"Continue planning"

Example:

3 things left to book:

✈ Flight
🏨 Kyoto hotel
🎎 Food tour

CTA:

"Continue journey"

Clicking an item should open the correct detail/booking flow.

==================================================
4. UPCOMING TRIP TIMELINE
==================================================

Create a compact timeline.

Example:

MAR 15

✈ Mumbai → Tokyo
Booked ✓

MAR 16

🏨 Park Hyatt Tokyo
Booked ✓

MAR 17

🍣 Food Experience
Not booked

MAR 18

🚄 Tokyo → Kyoto
Not booked

This should be derived from actual itinerary state.

==================================================
5. TRIP FILTERS
==================================================

Filters:

All
Planning
Upcoming
In progress
Completed

Filtering must use real journey status.

==================================================
6. JOURNEY CARDS
==================================================

Each card should show:

Destination
Dates
Travelers
Journey status
Booking progress
Budget
Journey Health where available

Actions:

Open Journey
Continue Planning
Ask Journey AI

Do not overload cards with every itinerary item.

==================================================
7. EMPTY STATE
==================================================

If no journeys exist:

"Your next journey starts here."

Actions:

Build with Journey AI

Explore destinations

==================================================
8. COMPLETED JOURNEYS
==================================================

Completed journeys should feel different.

Show:

Destination
Dates
Highlights
Total spent

CTA:

"View journey"

Optional:

"Plan another trip"

==================================================
PART 2 — BOOKING CONSISTENCY
==================================================

Audit all bookings entering My Trips.

Bookings can originate from:

Journey AI
Journey
Search
Destination
Deals

Every booking must be associated correctly.

Never use:

journeys[0]

If no journey exists:

booking remains independent.

==================================================
PART 3 — JOURNEY BOOKING PROGRESS
==================================================

Journey progress must be calculated from actual itinerary state.

Example:

4 / 7 booked

Progress:

57%

When a hotel is booked:

3 / 7
→
4 / 7

When a flight is cancelled:

4 / 7
→
3 / 7

Do not hardcode progress.

==================================================
PART 4 — BUDGET SYNC
==================================================

My Trips must reflect current journey budget.

Show:

Total planned
Booked
Remaining

Example:

Planned:
₹1,50,000

Booked:
₹1,12,400

Remaining:
₹37,600

When a booking is made:

Booked increases.

Remaining decreases.

If booking is cancelled:

reverse the calculation.

Use the same budget source as Journey AI.

Do not maintain a second conflicting budget system.

==================================================
PART 5 — JOURNEY AI SYNC
==================================================

My Trips and Journey AI must use the same journey state.

Example:

My Trips:

Hotel ✓ Booked

Journey AI:

"What have I booked?"

→ Hotel ✓ Booked

Journey:

Hotel

→ BOOKED

All three must reflect the same state.

==================================================
PART 6 — ASK JOURNEY AI FROM MY TRIPS
==================================================

Allow:

"Ask Journey AI"

from the active journey.

Quick prompts:

What's next?

What have I booked?

How much have I spent?

What still needs booking?

Can I make this cheaper?

Is my itinerary too busy?

This should open the contextual Journey AI panel for that exact journey.

==================================================
PART 7 — END-TO-END AUDIT
==================================================

Now audit the following complete user journeys.

--------------------------------------------------
FLOW A — NEW TRAVELER
--------------------------------------------------

Home
→ Explore
→ Destination
→ Save destination
→ Journey AI
→ Create journey
→ My Trips

Verify the journey appears immediately.

--------------------------------------------------
FLOW B — HOTEL
--------------------------------------------------

Journey
→ Hotel
→ Hotel Detail
→ Hotel Booking
→ Confirmation
→ SAME Journey
→ My Trips

Verify:

Hotel = BOOKED

Booking count updates.

Budget updates.

--------------------------------------------------
FLOW C — EXPERIENCE
--------------------------------------------------

Journey
→ Experience
→ Experience Detail
→ Experience Booking
→ Confirmation
→ SAME Journey

Verify:

Experience = BOOKED

--------------------------------------------------
FLOW D — FLIGHT
--------------------------------------------------

Journey
→ Flight
→ Flight Detail
→ Flight Booking
→ Confirmation
→ SAME Journey

Verify:

Flight = BOOKED

--------------------------------------------------
FLOW E — SEARCH BOOKING
--------------------------------------------------

Home
→ Hotels
→ Search
→ Hotel
→ Detail
→ Booking

No existing journey.

Verify:

Booking succeeds.

Do NOT attach automatically to journeys[0].

--------------------------------------------------
FLOW F — DESTINATION BOOKING
--------------------------------------------------

Explore
→ Destination
→ Hotel
→ Detail
→ Booking

Verify destination context is preserved.

--------------------------------------------------
FLOW G — DEAL BOOKING
--------------------------------------------------

Deals
→ Hotel
→ Detail
→ Booking

Verify:

source = deals

--------------------------------------------------
FLOW H — AI
--------------------------------------------------

Journey AI
→ Generate

Make cheaper.

Add food experience.

Use What If.

Use alternative.

Book hotel.

Return to journey.

Ask:

"What have I booked?"

"What is next?"

"How much budget remains?"

Every response must use current state.

==================================================
PART 8 — NAVIGATION AUDIT
==================================================

Verify every page has a logical next action.

Home
→ Explore / Journey AI / Search

Explore
→ Destination

Destination
→ Hotel / Experience / Flight / Journey AI

Hotel Detail
→ Hotel Booking

Experience Detail
→ Experience Booking

Flight Detail
→ Flight Booking

Booking
→ Confirmation

Confirmation
→ Journey / My Trips

My Trips
→ Journey

Journey
→ Booking / Journey AI

No dead-end pages.

No generic redirects.

==================================================
PART 9 — BACK NAVIGATION
==================================================

Back navigation must preserve context.

Examples:

Search
→ Detail
→ Back

returns to the correct search state.

Journey
→ Hotel
→ Detail
→ Back

returns to the journey.

Journey
→ Booking
→ Confirmation

returns to the same journey.

Do not reset the entire application state.

==================================================
PART 10 — DATA CONSISTENCY
==================================================

Audit all references.

Never resolve an entity using:

array[0]

Never assume:

first journey
first hotel
first flight
first experience

Everything must use explicit IDs.

Required relationships:

journeyId
bookingId
itemId
itineraryItemId
destinationId
hotelId
experienceId
flightId

==================================================
PART 11 — STATE OWNERSHIP
==================================================

There must be one source of truth for:

Journey
Booking
Itinerary
Budget
Traveler

Do not duplicate these into unrelated local states.

Local UI state is fine.

Business state must remain centralized.

==================================================
PART 12 — VISUAL QUALITY
==================================================

My Trips should feel like a premium personal travel space.

Not:

dashboard
admin panel
spreadsheet

Use:

Large journey imagery
Editorial typography
Travel timeline
Progress indicators
Clear booking states
Subtle status indicators

==================================================
SUCCESS CRITERIA
==================================================

A stakeholder should be able to perform:

DISCOVER
→ PLAN
→ BOOK
→ RETURN
→ REVIEW
→ CONTINUE PLANNING

without encountering:

lost context
wrong journey
wrong booking flow
irrelevant fields
stale budget
incorrect booking count
dead ends
generic redirects

Do not report success based solely on compilation.

Actually execute the complete flows and verify state transitions.