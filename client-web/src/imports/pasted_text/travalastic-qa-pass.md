TRAVALASTIC — CROSS-FLOW STATE + BEHAVIORAL QA PASS

The traveler-facing product is now visually and structurally complete.

DO NOT redesign pages.
DO NOT add major features.
DO NOT create new dashboards.

The goal of this pass is to make every existing action propagate correctly through the entire application.

Think of Travalastic as ONE connected product, not a collection of independent pages.

==================================================
1. GLOBAL STATE AUDIT
==================================================

Audit AppContext and every state mutation.

Identify the canonical source of truth for:

- journeys
- bookings
- itinerary items
- saved destinations
- search state
- planner state
- traveler profile
- notifications
- documents
- expenses

Do not create duplicate local state where shared application state already exists.

Avoid hardcoded values that should come from state.

==================================================
2. BOOKING → JOURNEY PROPAGATION
==================================================

Test all three booking types.

HOTEL:

Start from Journey
→ select hotel
→ booking
→ confirmation
→ return to SAME Journey

Verify immediately:

hotel itinerary item = BOOKED
journey booking count increases
budget updates
expense appears
documents/voucher appears
My Trips reflects the change

Repeat from Search.

Repeat from Destination.

Repeat from Deals.

Standalone bookings must NOT attach themselves to an arbitrary journey.

==================================================
3. EXPERIENCE → JOURNEY
==================================================

Test:

Journey
→ Experience
→ Experience Detail
→ Book
→ Confirmation
→ SAME Journey

Verify:

correct itineraryItemId
correct journeyId
status changes to BOOKED
budget updates
expense appears
voucher appears

No flight-specific fields.

==================================================
4. FLIGHT → JOURNEY
==================================================

Test:

Journey
→ Flight
→ Flight Details
→ Booking
→ Confirmation
→ SAME Journey

Verify:

traveler details
seat
baggage
meals
review
payment
confirmation

Then:

flight itinerary item = BOOKED
budget recalculates
expense appears
document appears
Journey progress updates

==================================================
5. BOOKING SOURCE
==================================================

Every booking must preserve:

source

Allowed:

journey
search
destination
deals

If:

source === journey

and:

journeyId exists

confirmation MUST return to that exact journey.

Otherwise:

return to My Trips.

Never use:

journeys[0]

as an entity fallback.

==================================================
6. ITINERARY ITEM IDENTITY
==================================================

Every itinerary item that can be booked must have a stable ID.

Never identify an itinerary item by:

array position
name
destination
first matching item

Use:

itineraryItemId

throughout the booking lifecycle.

==================================================
7. JOURNEY AI STATE
==================================================

Verify Journey AI uses the current journey.

Ask:

"What have I booked?"

The answer must reflect current bookings.

Ask:

"What's next?"

It must return the first relevant unbooked itinerary item.

Book that item.

Ask again.

The answer must change.

Ask:

"Can I save money?"

The response must use the actual journey budget.

Ask:

"Make my itinerary less busy."

The journey should actually change if this action is implemented.

==================================================
8. BUDGET CONSISTENCY
==================================================

The same journey budget should appear consistently in:

Journey
Journey AI
My Trips
Booking confirmation where relevant
Expenses

When a booking occurs:

remaining budget changes
expense ledger changes
category totals change
health score may change

No hardcoded ₹350,000 or other fallback demo budgets.

==================================================
9. EXPENSES
==================================================

Verify expense generation.

Hotel booking:

→ Hotels expense

Flight booking:

→ Flights expense

Experience booking:

→ Experiences expense

Verify:

total
category total
remaining budget

all calculate from actual booking data.

==================================================
10. DOCUMENTS
==================================================

Documents should derive from actual bookings.

Hotel:

hotel voucher

Flight:

flight confirmation / boarding-related document

Experience:

experience voucher

Do not display documents for services that have not been booked.

==================================================
11. MY TRIPS
==================================================

Verify My Trips is derived from journeys.

After creating a journey:

it appears immediately.

After booking:

booking progress changes.

After all items are booked:

journey status/progress updates accordingly.

No page refresh should be required.

==================================================
12. SEARCH → DETAIL → BOOKING
==================================================

Test each:

Search Flights
→ Flight Detail
→ Booking

Search Hotels
→ Hotel Detail
→ Room Selection
→ Booking

Search Experiences
→ Experience Detail
→ Booking

Verify the selected entity survives the entire flow.

Never accidentally book another entity because of:

array index
stale state
previous selection
default mock item

==================================================
13. DESTINATION FLOW
==================================================

Test:

Explore
→ Destination
→ Hotel
→ Hotel Detail
→ Booking

and:

Explore
→ Destination
→ Experience
→ Experience Detail
→ Booking

Verify the exact selected entity is preserved.

==================================================
14. SAVED DESTINATIONS
==================================================

Save a destination.

Navigate away.

Return to Explore.

Verify saved state persists.

Unsave it.

Verify all UI surfaces update.

No duplicate saved entries.

==================================================
15. PROFILE → JOURNEY AI
==================================================

Verify Travel Identity preferences actually influence Journey AI.

Examples:

preferred cabin
hotel comfort
travel pace
budget style
dietary preferences
accessibility preferences

If the profile says:

Premium hotel

Journey AI should not silently recommend budget accommodation.

If:

Relaxed pace

Journey AI should not generate an overloaded itinerary.

==================================================
16. NOTIFICATIONS
==================================================

Verify notifications are generated from meaningful events.

Examples:

Booking confirmed
Trip saved
Document available
Travel update

Each actionable notification must navigate to the correct context.

"View Journey"

must open the relevant journey.

Never journeys[0].

==================================================
17. SUPPORT
==================================================

Support must know the current journey context.

If the user is on:

Tokyo Journey

and asks:

"What have I booked?"

the response should relate to Tokyo Journey.

Do not use arbitrary journey selection.

==================================================
18. NAVIGATION BACK BEHAVIOR
==================================================

Audit:

Back from Hotel Detail
Back from Experience Detail
Back from Flight Detail
Back from Booking
Back from Confirmation

The user should return to the logical originating context.

Do not always send users to Home.

Examples:

Journey → Hotel → Back

returns to Journey.

Explore → Hotel → Back

returns to Explore.

Search → Hotel → Back

returns to Search.

==================================================
19. REFRESH / RELOAD
==================================================

Determine which state is intentionally session-only and which should persist.

At minimum, avoid catastrophic behavior where refreshing:

- destroys a saved journey unexpectedly
- creates duplicate journeys
- loses booking state
- resets profile preferences

If persistence architecture already exists, use it.

Do not introduce a backend.

==================================================
20. ERROR RECOVERY
==================================================

Test invalid IDs.

Examples:

invalid journey
invalid hotel
invalid experience
invalid booking

Never crash.

Show:

Not found
→ useful recovery CTA

==================================================
21. RACE CONDITIONS
==================================================

Check rapid interactions.

Examples:

Double-click Book
Double-click Save
Double-click Confirm
Navigate while loading

Prevent:

duplicate booking
duplicate journey
duplicate saved destination
duplicate expense

==================================================
22. TYPE / DATA CONSISTENCY
==================================================

Audit shared interfaces.

Avoid inconsistent representations such as:

status: "BOOKED"

versus:

booked: true

unless there is a clear reason.

Prefer one canonical representation.

Audit:

Booking
Journey
ItineraryItem
Hotel
RoomType
Experience
Flight
Payment
Expense
Document
Notification

==================================================
23. CONSOLE QA
==================================================

Run the application and inspect browser console.

Fix:

runtime exceptions
React warnings
invalid state updates
missing keys
context errors
navigation errors

Especially verify there are ZERO:

"useApp must be used within AppProvider"

errors.

==================================================
24. STAKEHOLDER DEMO TEST
==================================================

Run this exact sequence:

HOME
↓
EXPLORE JAPAN
↓
TOKYO
↓
JOURNEY AI
↓
CREATE 7-NIGHT JOURNEY
↓
SAVE
↓
MY TRIPS
↓
OPEN JOURNEY
↓
BOOK HOTEL
↓
CONFIRM
↓
RETURN TO SAME JOURNEY
↓
VERIFY HOTEL BOOKED
↓
ASK JOURNEY AI "WHAT HAVE I BOOKED?"
↓
BOOK EXPERIENCE
↓
RETURN TO JOURNEY
↓
BOOK FLIGHT
↓
RETURN TO JOURNEY
↓
OPEN EXPENSES
↓
VERIFY ALL 3 CATEGORIES
↓
OPEN DOCUMENTS
↓
VERIFY GENERATED DOCUMENTS
↓
OPEN MY TRIPS
↓
VERIFY FINAL JOURNEY STATE

The entire sequence must work without refreshing the page.

==================================================
25. FINAL RULE
==================================================

Do not rewrite functioning screens unnecessarily.

Do not add visual complexity.

Do not create new features.

Fix the underlying state, identity, navigation and behavioral problems.

The final product should behave as if it were backed by one coherent travel platform.

Run TypeScript check AND runtime testing.

Do not report success based only on compilation.

Report:

1. State issues found
2. Navigation issues found
3. Booking issues found
4. Data consistency issues
5. Runtime errors
6. Fixes applied
7. Exact stakeholder flow tested
8. Remaining limitations