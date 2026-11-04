TRAVALASTIC — CONTEXT & NAVIGATION CONSISTENCY PASS

The previous changes are now compiling cleanly.

Do NOT add new visual sections.

Do NOT redesign pages.

Now verify that the new shared context and navigation architecture is actually consistent throughout the consumer website.

==================================================
1. SEARCH CONTEXT
==================================================

SearchQuery now includes:

travelStyle

Verify that SearchQuery is consistently handled across:

HomePage
HeroSearchBar
ExplorePage
SearchPage
DestinationPage
DealsPage
AppContext

No page should silently discard:

destination
dates
travelers
product type
travelStyle

==================================================
2. HERO SEARCH
==================================================

Verify the contextual HeroSearchBar behavior.

Flights:

Origin
Destination
Dates
Travelers
Cabin

Hotels:

Destination
Check-in
Check-out
Guests / Rooms

Experiences:

Destination
Date
Participants

Packages:

Destination
Dates
Travelers

Changing tabs must change the fields.

Searching must create the appropriate SearchQuery.

Do not use one generic search object that causes irrelevant fields to leak between product types.

==================================================
3. TRAVEL BY INTEREST
==================================================

Verify the complete flow:

Home
→ Travel by Interest
→ Explore

Examples:

Mountains
→ travelStyle = Adventure

Beaches
→ travelStyle = Beach

Culture
→ travelStyle = Culture

Food & Drink
→ travelStyle = Food

Wildlife
→ travelStyle = Wildlife

Adventure
→ travelStyle = Adventure

The exact mappings can use the existing supported travel-style enum/value.

The important requirement:

ExplorePage must visibly open with the correct style filter already selected.

==================================================
4. EXPLORE INITIAL STATE
==================================================

ExplorePage should read travelStyle from shared context on initial navigation.

For example:

Home
→ Mountains
→ Explore

should result in:

Explore
Travel Style: Adventure

with the result set filtered accordingly.

Do NOT require the user to manually select the filter again.

If the user changes the filter afterward, that change should work normally.

==================================================
5. CONTEXT CLEANUP
==================================================

After leaving the filtered Explore experience and beginning a completely unrelated search, do not allow the previous travelStyle to accidentally affect the new search.

Example:

Home
→ Mountains
→ Explore

then:

Flights
→ Mumbai → Dubai

should NOT inherit:

travelStyle = Adventure

unless explicitly relevant.

Use context intentionally, not globally forever.

==================================================
6. CURATED JOURNEYS
==================================================

Verify that curated journey navigation is correct.

A curated journey should NOT blindly open the generic AI Planner.

If the card represents a specific destination:

Cherry Blossom Japan
→ Japan Destination

Bali Wellness & Temples
→ Bali Destination

Dubai Luxury Weekend
→ Dubai Destination

If a dedicated Curated Trip Detail page exists, use that instead.

The user should understand what they are opening.

==================================================
7. DESTINATION CONTEXT
==================================================

Verify:

Destination
→ Plan with AI

still pre-fills the AI Planner correctly.

Destination
→ Hotels

must preserve destination.

Destination
→ Experiences

must preserve destination.

Destination
→ Flights

must preserve destination where appropriate.

Do not lose context between these transitions.

==================================================
8. SEARCH → DETAIL
==================================================

Verify:

Flight Search
→ Flight Detail

Hotel Search
→ Hotel Detail

Experience Search
→ Experience Detail

The selected item ID must be preserved.

The detail page must load the correct entity from the shared data layer.

Do not rely on:

array index
first result
hardcoded object

==================================================
9. DETAIL → BOOKING
==================================================

Verify:

Hotel Detail
→ Hotel Booking Flow

Flight Detail
→ Flight Booking Flow

Experience Detail
→ Experience Booking Flow

The correct:

type
itemId
source
journeyId where applicable

must be passed into the booking context.

==================================================
10. JOURNEY → BOOKING
==================================================

This is critical.

Verify:

Journey
→ itinerary item
→ booking

The booking context contains:

type
itemId
journeyId
source = 'journey'

After confirmation:

booking is attached to that exact journey.

Never use:

journeys[0]

Never infer the journey from the first available journey.

==================================================
11. BOOKING → JOURNEY
==================================================

If booking started from a journey:

confirmation
→ Back to your trip

must return to the exact originating journey.

The correct itinerary item must immediately become:

BOOKED

and display:

✓ Booked
View Booking

==================================================
12. SEARCH → BOOKING
==================================================

If booking started from Search:

source = 'search'

After confirmation:

return to an appropriate consumer confirmation / result state.

Do NOT force the user into a random journey.

If the user chooses to add the booking to an existing trip, use the explicitly selected journey.

==================================================
13. DESTINATION → BOOKING
==================================================

If booking starts from a destination context:

source = 'destination'

Preserve destination context throughout.

Do not automatically assign the booking to journeys[0].

==================================================
14. DEALS → BOOKING
==================================================

If booking starts from Deals:

source = 'deals'

Preserve:

deal ID
product type
product ID
destination

until booking completion.

==================================================
15. DATA MODEL CONSISTENCY
==================================================

The recent fixes changed several model names:

Flight:
fromCode
toCode
to

Activity:
destination
meetingPoint

RoomType:
hotelId
description

Verify all consumers use the canonical model fields.

Do not create additional aliases unless genuinely necessary.

Do not silently use undefined fields.

==================================================
16. BOOKING FLOW ITEM DETAILS
==================================================

ExperienceBookingFlow should correctly resolve:

experience name
destination
meetingPoint
date
time
participants

HotelBookingFlow should resolve:

hotel
room
destination
check-in
check-out
guests

FlightBookingFlow should resolve:

airline
flight number
from
to
departure
arrival
seat
baggage
meal

No cross-product fields.

==================================================
17. PROFILE / MY TRIPS
==================================================

Verify that bookings created through:

Search
Destination
Deals
Journey
AI Planner

appear consistently in the user's booking/trip state.

My Trips should not depend on where the booking originated.

==================================================
18. FINAL USER JOURNEYS TO TEST
==================================================

TEST A:

Home
→ Mountains
→ Explore
→ Adventure filter active

TEST B:

Home
→ Bali
→ Destination
→ Plan with AI
→ AI Planner has Bali preselected

TEST C:

Home
→ Hotels
→ Search
→ Hotel
→ Detail
→ Hotel Booking
→ Confirmation

TEST D:

Home
→ Flights
→ Search
→ Flight
→ Detail
→ Flight Booking
→ Seat
→ Baggage
→ Meal
→ Confirmation

TEST E:

Home
→ Experiences
→ Search
→ Experience
→ Detail
→ Experience Booking
→ Date
→ Time
→ Participants
→ Confirmation

TEST F:

AI Planner
→ Save Japan Journey
→ Journey
→ Hotel
→ Hotel-specific booking
→ Confirmation
→ Same Japan Journey
→ Hotel = BOOKED

TEST G:

AI Planner
→ Same Japan Journey
→ Experience
→ Experience-specific booking
→ Confirmation
→ Same Japan Journey
→ Experience = BOOKED

==================================================
FINAL RULE
==================================================

Do not report success based solely on TypeScript compilation.

The objective is:

ONE CONSISTENT CONTEXT MODEL

feeding:

HOME
→ EXPLORE
→ SEARCH
→ DETAIL
→ PLAN
→ BOOK
→ MY TRIPS
→ JOURNEY

No lost destination.
No lost product type.
No lost item ID.
No lost journey ID.
No irrelevant booking fields.
No generic redirects.
No journeys[0].