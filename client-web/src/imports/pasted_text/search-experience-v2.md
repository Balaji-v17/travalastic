TRAVALASTIC — SEARCH EXPERIENCE 2.0

The core state/navigation architecture is now stable.

Do NOT touch AppProvider, Router, Journey routing, or confirmation routing unless a genuine bug is discovered.

Now improve the consumer SEARCH → RESULTS → DETAIL → BOOKING experience.

==================================================
1. SEARCH PAGE
==================================================

Audit the current SearchPage.

It must feel like a real travel marketplace rather than a static results list.

Support:

Flights
Hotels
Experiences

Each tab must have its own contextual search controls.

Flights:
- From
- To
- Departure
- Return
- Travelers
- Cabin

Hotels:
- Destination
- Check-in
- Check-out
- Rooms
- Guests

Experiences:
- Destination
- Date
- Participants
- Experience type

Do NOT show irrelevant fields between categories.

==================================================
2. RESULTS
==================================================

Increase the depth of realistic results.

Hotels:
30+ realistic hotels

Flights:
20+ realistic routes / options

Experiences:
30+ experiences

Do NOT simply duplicate cards with different names.

Each result should have meaningful differences:

Hotels:
- rating
- location
- room types
- price
- cancellation
- amenities
- review count
- distance

Flights:
- airline
- departure
- arrival
- duration
- stops
- baggage
- cabin
- price

Experiences:
- duration
- rating
- reviews
- time slots
- meeting point
- included items
- cancellation
- price

==================================================
3. SEARCH STATE
==================================================

Search must remember the user's query.

Example:

Mumbai → Tokyo
15 Mar → 22 Mar
2 travelers

Results should reflect that context.

When opening a result and returning:

The search state should remain intact.

Do not reset the page.

==================================================
4. FILTERS
==================================================

Filters must actually change the visible results.

Hotels:

Price
Rating
Property type
Amenities
Cancellation

Flights:

Stops
Airline
Departure time
Arrival time
Price
Cabin

Experiences:

Price
Duration
Category
Rating
Time

Show result count dynamically.

Example:

"248 hotels in Bali"

Do not use static result counts if filtering changes them.

==================================================
5. SORTING
==================================================

Add:

Recommended
Price: Low → High
Price: High → Low
Rating
Best reviewed

Sorting must actually reorder the results.

==================================================
6. RESULT CARDS
==================================================

Make cards information-dense but premium.

Every card should have one obvious primary CTA.

Hotel:

View hotel

Flight:

View flight

Experience:

View experience

Do NOT immediately send users to checkout.

==================================================
7. DETAIL PAGE TRANSITION
==================================================

Search result
→ Detail page

Preserve:

search context
source
selected entity ID

Example:

hotelId
source = search

==================================================
8. DETAIL PAGES
==================================================

HotelDetail:

Gallery
Rating
Location
Amenities
Rooms
Room prices
Cancellation policy
Reviews
Map/location
"Choose room"

ExperienceDetail:

Gallery
Rating
Duration
Schedule
Time slots
Included
Excluded
Meeting point
Reviews
Cancellation
"Choose date"

FlightDetail:

Route
Airline
Departure
Arrival
Duration
Stops
Baggage
Fare conditions
"Select flight"

==================================================
9. BOOKING HANDOFF
==================================================

Detail page → correct booking flow.

Hotel:

HotelDetail
→ HotelBookingFlow

Experience:

ExperienceDetail
→ ExperienceBookingFlow

Flight:

FlightDetail
→ FlightBookingFlow

Never use a generic booking flow for all three.

==================================================
10. BOOKING CONTEXT
==================================================

When booking originates from Search:

source = "search"

If no journeyId exists:

booking remains standalone.

Never attach it to a journey automatically.

If user is already inside a journey:

source = "journey"
journeyId = exact journey

==================================================
11. STANDALONE BOOKING
==================================================

After standalone booking:

Confirmation
→ My Trips

But do NOT create a fake journey just to contain the booking.

Show standalone booking appropriately in My Trips / Bookings.

==================================================
12. JOURNEY BOOKING
==================================================

When booking from Journey:

Confirmation
→ SAME Journey

Immediately update:

itinerary item → BOOKED

booking count

budget

remaining amount

My Trips

Journey AI

==================================================
13. VISUAL QUALITY
==================================================

Search should feel like:

premium travel marketplace

NOT:

admin dashboard
table
generic ecommerce listing

Use:

large imagery
clear hierarchy
sticky filter/search controls where appropriate
comfortable spacing
strong typography
subtle hover states
loading skeletons
empty states

==================================================
14. LOADING
==================================================

Create realistic loading states.

Example:

"Searching 248 hotels in Bali..."

Then reveal results progressively.

Do not make loading purely cosmetic.

==================================================
15. EMPTY STATES
==================================================

If filters produce no results:

"No stays match your filters."

Actions:

Clear filters
Ask Journey AI

For flights:

"Try adjusting your dates or stops."

For experiences:

"Try another date or experience type."

==================================================
16. MOBILE / RESPONSIVE
==================================================

Do not destroy the existing desktop design.

Make the layout responsive.

Desktop:

Sidebar filters + results

Mobile:

Filter button
Sort button
Full-width results

==================================================
17. FINAL END-TO-END TEST
==================================================

Test:

Home
→ Hotels
→ Search Bali
→ Filter
→ Sort
→ Hotel result
→ Hotel Detail
→ Select room
→ Hotel Booking
→ Confirmation
→ My Trips

Then:

Home
→ Experiences
→ Search
→ Experience
→ Detail
→ Booking
→ Confirmation

Then:

Home
→ Flights
→ Search
→ Flight
→ Detail
→ Flight Booking
→ Confirmation

Then:

Journey
→ Hotel
→ Detail
→ Booking
→ Confirmation
→ SAME Journey

Verify there are no irrelevant fields.

Hotel must NEVER show:
Seat
Baggage
Meals

Experience must NEVER show:
Seat
Baggage
Meals

Flight must NEVER show:
Room selection
Hotel amenities
Meeting point

==================================================
SUCCESS CRITERIA
==================================================

The user should feel:

Search
→ Compare
→ Understand
→ Decide
→ Book

rather than:

Search
→ click card
→ generic checkout.

Do not report success based solely on compilation.

Report actual flows tested and any remaining UX/state issues.