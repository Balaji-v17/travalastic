TRAVALASTIC — DEEP PRODUCT REWORK
DO NOT MAKE MINOR UI IMPROVEMENTS.

The current product is functional, but it is still too shallow and several core workflows are conceptually wrong.

I need you to stop adding isolated polish and now perform a proper product-depth and workflow architecture pass.

There are FOUR major problems to solve:

1. The website is too short / content-light.
2. Navigation and information architecture are not deep enough.
3. Booking flows are incorrectly shared between different product types.
4. Booking completion does not reliably return the traveler to the originating journey / itinerary.

Do NOT simply patch these individually.
Refactor the relevant architecture so the product behaves correctly.

==================================================
1. WEBSITE DEPTH
==================================================

The website currently feels too short because there are not enough meaningful content sections, discovery surfaces, detail states and interconnected pages.

I do NOT mean "make the page physically longer by adding filler."

I mean increase PRODUCT DEPTH.

Every major area should feel like a complete travel product.

HOME should contain meaningful sections such as:

• Hero search
• Popular destinations
• Trending destinations
• Seasonal destinations
• Popular flights
• Hotel collections
• Experiences
• Curated itineraries
• Travel inspiration
• Travel by interest
• AI trip planning
• Recently viewed / personalized content where appropriate
• Deals
• Why Travalastic
• Trust / traveler reassurance
• Footer discovery navigation

EXPLORE should have:

• Large destination catalog
• Region filters
• Travel style filters
• Budget filters
• Duration filters
• Best-time filters
• Search
• Result count
• Featured destinations
• Trending destinations
• Curated collections
• Destination cards
• Empty states

DESTINATION PAGES should feel editorial and substantial.

Include:

• Hero
• Overview
• Highlights
• Best time
• Weather / season information
• Suggested duration
• Budget guidance
• Popular areas
• Things to do
• Experiences
• Hotels
• Flights
• Suggested itineraries
• Travel tips
• Related destinations
• FAQ
• Plan with AI CTA

Do NOT create arbitrary filler text.
Use structured realistic data.

==================================================
2. INFORMATION ARCHITECTURE
==================================================

The website currently feels like a collection of screens rather than a deep travel platform.

Create stronger consumer navigation.

Primary navigation:

Explore
Plan a Trip
Flights
Hotels
Experiences
Deals
My Trips

Secondary / utility:

Search
Help
Profile

Ensure every navigation item has a meaningful landing page.

Do not create dead-end pages.

Every important card should lead somewhere meaningful.

Examples:

Destination card
→ Destination page

Hotel card
→ Hotel detail

Flight result
→ Flight detail / booking

Experience card
→ Experience detail / booking

Deal
→ Relevant product detail / booking

Trip
→ Journey

==================================================
3. IMPORTANT: DIFFERENT BOOKING FLOWS
==================================================

THIS IS THE MOST IMPORTANT CORRECTION.

Do NOT use one generic booking flow for every travel product.

A hotel is NOT a flight.

A flight is NOT an experience.

An experience is NOT a transfer.

Each product type must have its own domain-specific booking flow.

Create separate booking flow logic/components while reusing only common infrastructure such as:

• Progress indicator
• Traveler information
• Price summary
• Payment
• Confirmation
• Error handling

The actual steps must differ by product type.

==================================================
4. FLIGHT BOOKING FLOW
==================================================

Flight booking should support flight-specific steps.

Example:

1. Flight Selection
2. Traveler Details
3. Seat Selection
4. Baggage / Add-ons
5. Meals / Preferences
6. Review
7. Payment
8. Confirmation

Flight-specific information:

• Origin
• Destination
• Departure time
• Arrival time
• Airline
• Flight number
• Cabin
• Fare
• Seat map
• Baggage
• Meals

Do not show hotel-specific information here.

==================================================
5. HOTEL BOOKING FLOW
==================================================

Hotel booking must have a completely different flow.

Example:

1. Room Selection
2. Guest Details
3. Room Preferences
4. Add-ons
5. Review
6. Payment
7. Confirmation

Hotel-specific information:

• Hotel
• Location
• Room type
• Bed type
• Occupancy
• Check-in
• Check-out
• Nights
• Breakfast
• Cancellation policy
• Amenities
• Special requests

DO NOT show:

• Seat selection
• Aircraft seat map
• Flight meals
• Flight baggage
• Flight number
• Airline-specific options

This is mandatory.

==================================================
6. EXPERIENCE BOOKING FLOW
==================================================

Experience booking must have its own flow.

Example:

1. Experience / Date Selection
2. Time Slot
3. Participants
4. Traveler Details
5. Add-ons
6. Review
7. Payment
8. Confirmation

Experience-specific information:

• Experience name
• Location
• Date
• Time
• Duration
• Participants
• Meeting point
• Age restrictions
• Included items
• Optional add-ons

DO NOT show:

• Seat selection
• Hotel rooms
• Flight baggage
• Airline meals

==================================================
7. TRANSFER BOOKING FLOW
==================================================

If transfers exist, create a transfer-specific flow.

Example:

1. Transfer Type
2. Date / Time
3. Pickup
4. Drop-off
5. Travelers
6. Vehicle
7. Review
8. Payment
9. Confirmation

==================================================
8. PACKAGE BOOKING FLOW
==================================================

Packages can combine multiple products.

The package flow should show the complete bundle:

Flight
Hotel
Transfers
Experiences

Then allow the traveler to review each component before payment.

==================================================
9. SHARED BOOKING ARCHITECTURE
==================================================

Create a booking-flow architecture similar to:

BookingFlow
├── FlightBookingFlow
├── HotelBookingFlow
├── ExperienceBookingFlow
├── TransferBookingFlow
└── PackageBookingFlow

Shared components can include:

BookingProgress
TravelerDetails
PriceSummary
PaymentStep
BookingConfirmation
BookingError

But product-specific steps MUST remain separate.

Do NOT solve this using dozens of conditional labels inside one giant component.

==================================================
10. BOOKING CONTEXT
==================================================

The booking flow must retain:

booking type
item ID
journey ID
origin
destination
item metadata
source page
source itinerary item

For example:

startBookingFlow({
  type: "hotel",
  itemId: "hotel_123",
  journeyId: "journey_456",
  source: "journey"
})

The flow must never lose this context.

==================================================
11. RETURN TO ORIGIN
==================================================

This is another critical requirement.

If the user starts booking FROM AN ITINERARY:

Journey
→ Day 3
→ Hotel
→ Book

then after successful booking:

Payment
→ Confirmation
→ RETURN TO SAME JOURNEY

The user must return to:

Journey
→ same trip
→ same day
→ same itinerary item

NOT:

Home

NOT:

My Trips

NOT:

journeys[0]

NOT:

a random journey

Use:

bookingFlow.journeyId

to identify the correct journey.

The journey should update immediately with the new booking state.

==================================================
12. ITINERARY BOOKING STATE
==================================================

Each itinerary item should have meaningful states:

UNBOOKED
↓
BOOKING
↓
BOOKED
↓
MODIFIED
↓
CANCELLED

Example:

DAY 3

🏨 Kyoto Hotel

Before:

[ Book Hotel ]

After booking:

✓ Booked
Reservation confirmed

[ View Booking ]

The button and status should update without requiring a page refresh.

==================================================
13. AI ITINERARY → BOOKING
==================================================

When an AI-generated itinerary contains:

Flight
Hotel
Experience

each item must open its corresponding booking flow.

Example:

AI itinerary:

Day 1
✈ Flight
→ Flight Booking Flow

Day 1
🏨 Hotel
→ Hotel Booking Flow

Day 2
🎎 Experience
→ Experience Booking Flow

Each booking should attach to the same journey.

==================================================
14. HOTEL EXPERIENCE DEPTH
==================================================

Hotel results should lead to a real hotel detail page.

Include:

• Image gallery
• Hotel name
• Rating
• Location
• Description
• Amenities
• Room options
• Cancellation policies
• Reviews
• Nearby attractions
• Map / location context
• Availability
• Price per night
• Total stay price

Then:

Select room
→ Hotel booking flow

==================================================
15. FLIGHT EXPERIENCE DEPTH
==================================================

Flight results should lead to a flight detail / selection experience.

Include:

• Airline
• Flight number
• Route
• Departure
• Arrival
• Duration
• Stops
• Cabin
• Fare conditions
• Baggage
• Seat availability
• Fare comparison

Then:

Select flight
→ Flight booking flow

==================================================
16. EXPERIENCE DETAIL PAGE
==================================================

Experience cards should lead to a full detail page.

Include:

• Image gallery
• Experience overview
• Location
• Duration
• Date availability
• Time slots
• Participants
• Included
• Excluded
• Meeting point
• Requirements
• Reviews
• Cancellation policy
• Related experiences

Then:

Book Experience
→ Experience booking flow

==================================================
17. HOTEL / FLIGHT / EXPERIENCE DATA
==================================================

Do NOT use the same generic mock object structure for all products.

Create distinct models.

Flight:

id
airline
flightNumber
origin
destination
departure
arrival
duration
stops
cabin
fare
baggage
seatAvailability

Hotel:

id
name
location
rating
amenities
rooms
checkIn
checkOut
nightlyPrice
cancellationPolicy

Experience:

id
name
location
duration
availableDates
timeSlots
participants
price
included
meetingPoint
cancellationPolicy

==================================================
18. SEARCH RESULTS
==================================================

Search results must be product-specific.

Flight results should look like flights.

Hotel results should look like hotels.

Experience results should look like experiences.

Do not force every result into the same card architecture if it makes the information meaningless.

==================================================
19. WEBSITE CONTENT DEPTH
==================================================

Increase depth through REAL product surfaces.

Add:

• Destination collections
• Travel themes
• Curated trips
• Seasonal collections
• Experience categories
• Hotel collections
• Flight discovery
• Deals
• Travel inspiration
• Destination guides
• FAQs
• Related content

Create enough realistic sample data that pages don't feel empty.

Aim for:

20–30 destinations
30+ hotels
30+ experiences
20+ flight routes
15+ curated trips
multiple travel-interest categories

The data must be internally consistent.

==================================================
20. NAVIGATION DEPTH
==================================================

Ensure navigation is easy and discoverable.

Add appropriate:

• Breadcrumbs
• Back navigation
• Related content
• "Explore more"
• "You may also like"
• "Continue planning"
• "View all"

The user should never feel trapped inside a page.

==================================================
21. SEARCH CONTEXT
==================================================

When a user searches:

Bali

and selects a hotel,

the hotel detail page should know:

Destination = Bali

Search dates = selected dates

Travelers = selected travelers

When booking starts, that context should remain available.

==================================================
22. BOOKING CONFIRMATION
==================================================

Confirmation pages must be product-specific.

Flight confirmation:

Flight details
Seat
Baggage
Meal
PNR / confirmation

Hotel confirmation:

Hotel
Room
Guests
Check-in
Check-out
Confirmation number

Experience confirmation:

Experience
Date
Time
Participants
Meeting point
Confirmation number

Do not display irrelevant information.

==================================================
23. POST-BOOKING JOURNEY UPDATE
==================================================

After successful booking:

1. Booking is created.
2. Correct journey is updated.
3. Itinerary item changes to BOOKED.
4. My Trips updates.
5. Confirmation is shown.
6. Traveler can return to journey.
7. Journey shows the newly booked item.

If booking started from the journey, provide:

"Back to your trip"

as the primary post-confirmation action.

==================================================
24. PRODUCT DEPTH
==================================================

The objective is NOT to make the website longer just for the sake of height.

The objective is:

MORE USEFUL CONTENT
MORE DISCOVERABLE PRODUCTS
MORE CONNECTED PAGES
MORE REALISTIC DATA
MORE COMPLETE WORKFLOWS
MORE MEANINGFUL INTERACTIONS

==================================================
25. DO NOT BREAK EXISTING WORK
==================================================

Preserve the existing working features:

• Home
• Explore
• Search
• Destination
• AI Planner
• My Trips
• Profile
• Deals
• Support
• Journey

Improve their architecture rather than replacing them unnecessarily.

==================================================
26. TEST THESE EXACT FLOWS
==================================================

After implementation, test:

FLOW A — HOTEL

Explore
→ Bali
→ Hotel
→ Hotel Detail
→ Select Room
→ Guest Details
→ Review
→ Payment
→ Confirmation
→ Back to source

There must be NO flight seat or meal step.

FLOW B — FLIGHT

Search Flights
→ Flight
→ Select
→ Traveler Details
→ Seat
→ Baggage
→ Meal
→ Payment
→ Confirmation

FLOW C — EXPERIENCE

Explore
→ Experience
→ Detail
→ Date
→ Time
→ Participants
→ Payment
→ Confirmation

FLOW D — AI ITINERARY HOTEL

AI Planner
→ Generate Japan itinerary
→ Hotel item
→ Book
→ Hotel-specific flow
→ Confirmation
→ Return to Japan itinerary
→ Hotel now shows BOOKED

FLOW E — AI ITINERARY EXPERIENCE

AI Planner
→ Experience item
→ Book
→ Experience-specific flow
→ Confirmation
→ Return to same itinerary

FLOW F — AI ITINERARY FLIGHT

AI Planner
→ Flight item
→ Book
→ Flight-specific flow
→ Seat / baggage / meal
→ Confirmation
→ Return to same itinerary

==================================================
27. FINAL QUALITY BAR
==================================================

Before declaring this task complete, verify:

• Website feels substantial
• Navigation is clear
• Search has enough results
• Destination pages are rich
• Hotel details are rich
• Flight details are rich
• Experience details are rich
• Booking flows are domain-specific
• Booking context is preserved
• Journey ID is never lost
• Correct journey is updated
• Itinerary updates immediately
• Confirmation is product-specific
• Return-to-journey works
• No irrelevant booking steps appear
• No dead-end pages exist
• No major TypeScript errors
• Responsive layout remains intact

Do not report "complete" after only a TypeScript check.

Actually verify the user workflows.

This is now a PRODUCT DEPTH + DOMAIN WORKFLOW REWORK.

Make the website substantially deeper and make every booking type behave correctly.