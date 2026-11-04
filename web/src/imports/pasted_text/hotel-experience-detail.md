TRAVALASTIC — HOTEL DETAIL + EXPERIENCE DETAIL 2.0

Destination Detail is now the decision-making bridge between discovery and planning.

Now upgrade the two product-detail experiences:

1. HotelDetailPage
2. ExperienceDetailPage

Do NOT modify:

HomePage
ExplorePage
DestinationDetailPage
Journey AI

Only make the minimum shared-component/data changes required for these two detail experiences.

The objective:

LISTING
→ DETAIL
→ UNDERSTAND
→ COMPARE
→ BOOK

Both pages must feel like premium travel products, not generic e-commerce detail pages.

==================================================
PART A — HOTEL DETAIL
==================================================

1. HOTEL HERO

Create a premium photographic gallery.

Use:

Primary large image
Supporting image grid
Gallery count
Favorite
Share

Overlay:

Hotel name
Destination
Rating
Review count
Location

Example:

PARK HYATT TOKYO

Tokyo, Japan

★★★★★ 4.8
1,284 reviews

Do not fabricate review counts if unavailable.

==================================================
2. HOTEL SUMMARY
==================================================

Show:

Property type
Neighborhood
Guest rating
Starting room price
Key highlights

Example:

Luxury hotel
Shinjuku
4.8 guest rating
From ₹28,500/night

Add a concise editorial description.

==================================================
3. "WHY THIS HOTEL?"
==================================================

Connect this to Journey AI.

Show a compact explanation based on:

Traveler preferences
Budget
Location
Amenities
Rating

Example:

"Good match for your Japan journey"

"Close to the neighborhoods you're planning to visit and within your premium accommodation preference."

If no Journey context exists:

show generic hotel strengths instead.

==================================================
4. ROOM SELECTION
==================================================

This is critical.

Display actual rooms associated with the hotel.

Each room:

Image
Name
Guests
Bed
Size
Amenities
Cancellation policy
Meal plan
Price

Examples:

Deluxe King
2 guests
King bed
42 m²
Breakfast included
Free cancellation

Do NOT show flight fields.

No:

Seat
Baggage
Meals selection
Cabin

Those belong exclusively to flights.

==================================================
5. ROOM COMPARISON
==================================================

Allow the user to compare room options.

Compare:

Price
Room size
Guests
Bed
Breakfast
Cancellation
Amenities

CTA:

"Select room"

Once selected:

continue to Hotel Booking Flow.

==================================================
6. AMENITIES
==================================================

Create a visually clean amenity section.

Examples:

Wi-Fi
Pool
Gym
Spa
Restaurant
Breakfast
Parking
Airport transfer

Only display amenities that exist in the hotel data.

==================================================
7. LOCATION
==================================================

Show:

Neighborhood
Address
Nearby landmarks
Distance to key areas

If map infrastructure already exists, provide a map preview.

Do not create a fake interactive map.

==================================================
8. REVIEWS
==================================================

Show review summary.

Example:

4.8

Excellent

Cleanliness
4.9

Location
4.8

Service
4.7

Value
4.5

Only use available review data.

If detailed review data is unavailable, create a clean summary structure rather than fake reviews.

==================================================
9. POLICIES
==================================================

Clearly display:

Check-in
Check-out
Cancellation
Payment
Children
Pets
Taxes / fees

Use the actual hotel policy model.

==================================================
10. BOOKING CTA
==================================================

Sticky booking summary:

Selected room
Dates
Guests
Price
Taxes / fees

CTA:

"Reserve room"

Flow:

Hotel Detail
→ Hotel Booking Flow

Hotel Booking Flow must remain:

Room Selection
→ Guest Details
→ Preferences
→ Review
→ Payment
→ Confirmation

Absolutely NO:

seat selection
baggage
flight meals
flight number

==================================================
11. JOURNEY CONTEXT

If opened from Journey:

Show:

"Part of your Japan Journey"

Then preserve:

journeyId
itemId
source = journey

After confirmation:

return to the SAME journey.

The itinerary item becomes:

✓ BOOKED

==================================================
PART B — EXPERIENCE DETAIL
==================================================

1. EXPERIENCE HERO

Large image/gallery.

Show:

Experience name
Destination
Rating
Review count
Starting price
Duration

Example:

TOKYO STREET FOOD EXPERIENCE

Shinjuku · 3 hours

★★★★★ 4.9

From ₹3,500/person

==================================================
2. EXPERIENCE STORY

Show a concise editorial description.

Explain:

What the traveler actually experiences.

Avoid generic marketing filler.

==================================================
3. SCHEDULE

Show:

Available dates
Time slots
Duration

Example:

Morning
10:00–13:00

Afternoon
15:00–18:00

Evening
18:30–21:30

These must connect to actual available slots.

==================================================
4. INCLUDED / NOT INCLUDED

Create two clear sections.

Included:

Guide
Food tasting
Transport

Not included:

Hotel pickup
Personal purchases
Tips

Use actual experience data.

==================================================
5. MEETING POINT

Clearly show:

Meeting location
Arrival instructions
Approximate duration
Pickup information if available

Do not invent location information.

==================================================
6. PARTICIPANTS

Before booking:

Adults
Children
Other supported participant types

Show:

Per-person pricing
Total pricing

This should feed the Experience Booking Flow.

==================================================
7. WHY THIS EXPERIENCE?

If Journey context exists:

Explain why it fits the journey.

Example:

"Matches your interest in food and fits your free afternoon on Day 3."

This should use actual:

Journey DNA
Itinerary
Schedule

Do not fake personalization.

==================================================
8. REVIEWS

Show:

Rating
Review count
Category breakdown

Only use available data.

==================================================
9. EXPERIENCE BOOKING CTA

Sticky bottom/side booking summary:

Date
Time
Participants
Price

CTA:

"Book experience"

Flow:

Experience Detail
→ Experience Booking Flow

Experience Booking Flow:

Overview
→ Date
→ Time Slot
→ Participants
→ Traveler Details
→ Review
→ Payment
→ Confirmation

No hotel room fields.

No flight fields.

==================================================
10. JOURNEY CONTEXT

If opened from Journey:

Show:

"Add to your Japan Journey"

Preserve:

journeyId
itemId
source = journey

After confirmation:

return to SAME Journey.

Update the itinerary item:

UNBOOKED
→ BOOKED

==================================================
PART C — SHARED DATA RULES
==================================================

Both pages must load data by actual ID.

Hotel:

hotelId
→ Hotel

Experience:

experienceId
→ Experience

Never use:

hotels[0]
experiences[0]

Never infer the selected entity from array position.

==================================================
PART D — SOURCE TRACKING
==================================================

Both detail pages must understand:

source:

journey
search
destination
deals

If source = journey:

preserve journeyId.

If source = search:

return appropriately to the consumer search/result context.

If source = destination:

preserve destination context.

If source = deals:

preserve deal context.

Do not automatically create or attach a journey unless the user explicitly chooses to do so.

==================================================
PART E — BOOKING FLOW SEPARATION
==================================================

This is a hard requirement.

HOTEL:

Hotel Detail
→ Hotel Booking

Only hotel-related information.

EXPERIENCE:

Experience Detail
→ Experience Booking

Only experience-related information.

FLIGHT:

Existing Flight Detail
→ Flight Booking

Only flight-related information.

Never share irrelevant fields between flows.

==================================================
PART F — VISUAL QUALITY
==================================================

These pages should feel premium.

Use:

Large photography
Editorial typography
Sticky booking panel
Clear hierarchy
Generous whitespace
Strong pricing hierarchy
Subtle borders
High-quality gallery
Clear CTA

Avoid:

Dense SaaS cards
Huge tables
Generic dashboard components
Overuse of pills
Excessive badges

==================================================
PART G — RESPONSIVE
==================================================

Desktop:

Gallery + sticky booking panel.

Tablet:

Responsive two-column.

Mobile:

Gallery
→ Summary
→ Details
→ Rooms / Schedule
→ Policies
→ Sticky bottom CTA

No horizontal overflow.

==================================================
FINAL END-TO-END TESTS
==================================================

TEST 1

Explore
→ Destination
→ Hotel
→ Hotel Detail
→ Select Deluxe Room
→ Guest Details
→ Preferences
→ Review
→ Payment
→ Confirmation

Verify:

No flight fields appear.

TEST 2

Explore
→ Destination
→ Experience
→ Experience Detail
→ Date
→ Time
→ Participants
→ Traveler Details
→ Review
→ Payment
→ Confirmation

Verify:

No hotel or flight fields appear.

TEST 3

Journey
→ Hotel
→ Hotel Detail
→ Book
→ Confirmation
→ SAME Journey

Hotel itinerary item becomes BOOKED.

TEST 4

Journey
→ Experience
→ Experience Detail
→ Book
→ Confirmation
→ SAME Journey

Experience itinerary item becomes BOOKED.

TEST 5

Deals
→ Hotel
→ Hotel Detail
→ Booking

Verify source remains:

deals

Do not report completion based solely on compilation.

Verify the actual consumer flows.