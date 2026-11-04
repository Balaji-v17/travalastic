TRAVALASTIC — FLIGHT DISCOVERY + DETAIL + BOOKING 2.0

Hotel and Experience Detail flows are now separated and structured correctly.

Now bring the Flight experience to the same product quality level.

Do NOT redesign Home, Explore, Destination, Hotel Detail, Experience Detail, or Journey AI.

Focus only on:

Flight Search
Flight Results
Flight Detail
Flight Booking
Flight → Journey integration

==================================================
1. FLIGHT SEARCH
==================================================

Flight search must support:

Origin
Destination
Departure date
Return date
Travelers
Cabin class

Trip type:

Round trip
One way

Traveler breakdown:

Adults
Children
Infants

Cabin:

Economy
Premium Economy
Business
First

Search must preserve these values in SearchQuery.

Do not carry hotel or experience fields into flight search.

==================================================
2. SEARCH RESULTS
==================================================

Results should feel like a real flight marketplace.

Each result should show:

Airline
Flight number
Departure airport
Departure time
Arrival airport
Arrival time
Duration
Stops
Baggage
Price
Fare type

Example:

IndiGo
6E 123

Mumbai
06:20

Tokyo
18:45

1 stop
12h 25m

₹32,500

Show:

Best
Cheapest
Fastest

sorting options.

==================================================
3. SMART FILTERS
==================================================

Filters:

Price
Airlines
Stops
Departure time
Arrival time
Duration
Cabin

Filters must update the actual results.

Display:

"18 flights"

based on the filtered dataset.

Do not use hardcoded result counts.

==================================================
4. FLIGHT RESULT CONTEXT
==================================================

If search originated from:

Destination:

preserve destination.

If from Journey:

preserve journeyId and itineraryItemId.

If from Home:

source = search.

If from Deals:

source = deals.

Do not lose context during navigation.

==================================================
5. FLIGHT DETAIL
==================================================

Create a premium flight detail page.

Show:

Airline
Flight number
Aircraft where available
Departure
Arrival
Duration
Stops
Baggage
Fare conditions

Create a visual flight timeline:

Mumbai
06:20

↓
Flight
↓
Layover

↓

Tokyo
18:45

Make layovers visually obvious.

==================================================
6. FARE OPTIONS
==================================================

If multiple fare options exist:

Basic
Standard
Flex

Compare:

Price
Cabin
Baggage
Seat selection
Meals
Cancellation
Change policy

User should select a fare before continuing.

Do not expose irrelevant hotel fields.

==================================================
7. WHY THIS FLIGHT?
==================================================

If opened from Journey AI:

show contextual intelligence.

Example:

"Recommended for your journey because it arrives before your first planned activity and stays within your flight budget."

If there are cheaper or faster alternatives:

show:

Cheapest option
Fastest option
Recommended option

Explain why the recommended flight was selected.

==================================================
8. FLIGHT BOOKING FLOW
==================================================

Keep the flight-specific flow strictly isolated.

Flow:

Flight Details
→ Traveler Details
→ Seat Selection
→ Baggage
→ Meals
→ Review
→ Payment
→ Confirmation

ONLY flight-related fields.

==================================================
9. TRAVELER DETAILS
==================================================

Support multiple travelers.

Each traveler:

Title
First name
Last name
Date of birth
Gender where required
Nationality
Passport details where applicable
Contact information

Validate required fields.

Do not allow confirmation with missing required traveler information.

==================================================
10. SEAT SELECTION
==================================================

Create a visual seat map.

Support:

Available
Selected
Occupied
Premium

If seat data is unavailable:

use a deterministic demo seat map.

Selecting a seat should update the booking state.

Do not expose seat selection in Hotel or Experience flows.

==================================================
11. BAGGAGE
==================================================

Show baggage entitlement.

Example:

Cabin baggage
7 kg

Checked baggage
15 kg

Optional additional baggage:

15 kg
20 kg
30 kg

Price updates when additional baggage is selected.

==================================================
12. MEALS
==================================================

Meal selection should be flight-specific.

Examples:

Vegetarian
Non-vegetarian
Vegan
Jain
Gluten-free

Allow per-traveler meal selection if supported.

Price updates appropriately.

==================================================
13. REVIEW
==================================================

Show:

Flight
Fare
Travelers
Seats
Baggage
Meals

Price breakdown:

Base fare
Taxes
Seat fees
Baggage
Meals

Total

Make it clear what is included and what was added.

==================================================
14. PAYMENT
==================================================

Use the existing payment UI/state.

Do not implement real payment processing.

Use the existing demo payment architecture.

After successful payment:

create booking.

==================================================
15. CONFIRMATION
==================================================

Show:

Booking confirmed

PNR / booking reference

Flight information

Traveler information

Seats

Baggage

Meals

Total paid

Actions:

View Journey
View Booking
Download / View Confirmation where existing infrastructure supports it

==================================================
16. JOURNEY INTEGRATION
==================================================

This is critical.

If flight booking started from Journey:

store:

source = journey
journeyId
itemId
itineraryItemId
bookingId

After confirmation:

return to the SAME Journey.

Update:

UNBOOKED
→ BOOKED

Do not use:

journeys[0]

under any circumstance.

==================================================
17. AI JOURNEY INTEGRATION
==================================================

If Journey AI recommended the flight:

preserve its relationship with the journey.

Journey should show:

Flight ✓ BOOKED

Ask Journey AI:

"What's booked?"

must recognize the flight.

Ask:

"How much have I spent?"

must include the flight cost.

Ask:

"What's next?"

must return the next unbooked itinerary item.

==================================================
18. FLIGHT ALTERNATIVES
==================================================

On Flight Detail provide:

Cheaper
Faster
Recommended

If the user switches:

update the selected flight.

If a flight has already been booked:

do not silently replace it.

==================================================
19. DISRUPTION PREPARATION
==================================================

Prepare flight booking data for future disruption handling.

A flight should have enough structured information to support:

delay
cancellation
schedule change
connection issue

Do not build the full disruption engine here.

Just ensure the booking model is not designed in a way that prevents it later.

==================================================
20. DATA RULE
==================================================

Flights must be resolved by:

flightId

Never:

flights[0]

Never infer a flight from an array position.

Every flight displayed in results/detail/booking must reference the same entity.

==================================================
21. RESPONSIVE
==================================================

Desktop:

Results + filter sidebar.

Flight Detail:

timeline + fare options + booking panel.

Mobile:

Stack naturally.

Sticky booking CTA.

Seat map must remain usable on small screens.

No horizontal page overflow.

==================================================
22. FINAL TESTS
==================================================

TEST A

Home
→ Flights
→ Search Mumbai → Tokyo
→ Results
→ Filter
→ Flight Detail
→ Fare
→ Traveler
→ Seat
→ Baggage
→ Meal
→ Review
→ Payment
→ Confirmation

TEST B

Journey AI
→ Japan Journey
→ Flight
→ Flight Detail
→ Book
→ Confirmation
→ SAME Journey

Verify:

Flight = BOOKED

TEST C

Hotel Booking

Verify it does NOT contain:

Seat
Baggage
Meal

TEST D

Experience Booking

Verify it does NOT contain:

Seat
Baggage
Meal
Room

TEST E

Flight Booking

Verify it contains ONLY relevant flight information.

TEST F

Ask Journey AI after booking:

"What have I booked?"

"How much have I spent?"

"What's next?"

All answers must reflect current state.

==================================================
SUCCESS CRITERIA
==================================================

Flight must feel like a first-class product inside Travalastic.

The complete transactional architecture should now be:

DESTINATION
→ HOTEL DETAIL → HOTEL BOOKING

DESTINATION
→ EXPERIENCE DETAIL → EXPERIENCE BOOKING

DESTINATION
→ FLIGHT DETAIL → FLIGHT BOOKING

All three must remain independent.

Do not report success based solely on TypeScript compilation.

Test the actual flows and state transitions.