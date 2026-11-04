Now perform a HOME PAGE FUNCTIONAL QA pass.

Do not redesign the homepage.
Do not add new sections.
Do not change the visual composition unless required to fix a functional issue.

The homepage is now visually complete.

The next objective is to make every interaction meaningful and connected to the rest of Travalastic.

==================================================
1. HERO SEARCH
==================================================

Test all search tabs:

Flights
Hotels
Experiences
Packages

Changing the tab must change the relevant search fields.

Examples:

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

Search must navigate to the correct results experience.

Do not send all four product types to the same generic result page.

==================================================
2. HERO POPULAR DESTINATIONS
==================================================

Every popular destination must be clickable.

Tokyo
Bali
Maldives
Paris
Dubai

Clicking a destination must open the correct Destination Detail page.

Do not create dead links.

==================================================
3. FEATURED DESTINATION
==================================================

Verify the rotating featured destinations:

Tokyo
Santorini
Maldives

Each state must have its own:

• Image
• Description
• Country
• Facts
• Price
• CTA

"Explore" must open the correct destination.

"Plan with AI" must open the AI Planner with that destination preselected.

==================================================
4. TRENDING DESTINATIONS
==================================================

Test:

Large destination
Medium destinations
Horizontal destination rail

Every destination must open its correct destination detail page.

"Explore all" must open Explore.

==================================================
5. EXPERIENCE DISCOVERY
==================================================

The featured experience must open:

Experience Detail Page

The compact experience rows must also be clickable.

Do not send users directly to checkout.

Correct flow:

Home
→ Experience
→ Experience Detail
→ Booking

==================================================
6. AI TRIP PLANNER
==================================================

Verify:

Start Planning Free
→ AI Planner

The itinerary preview should feel like a real product demonstration.

The AI Planner must be able to create a journey.

After saving:

AI Planner
→ My Trips
→ Journey

The created trip must actually exist in application state.

==================================================
7. CURATED JOURNEYS
==================================================

Test:

Cherry Blossom Japan
Bali Wellness
Dubai Luxury Weekend

Each must open a meaningful destination / curated trip experience.

Do not create dead-end cards.

"View all journeys" should lead to a meaningful collection page.

==================================================
8. TRAVEL INSPIRATION
==================================================

Every article/card must have a meaningful destination or guide destination.

Examples:

48 Hours in Kyoto
→ Kyoto destination / guide

Japan Winter Guide
→ Japan

Food destinations
→ relevant discovery

Do not make these decorative cards.

==================================================
9. FEATURED DEAL
==================================================

"Explore the deal" must open a meaningful deal/detail experience.

The deal should preserve:

Destination
Dates if defined
Traveler context
Product type

If the deal is hotel-based, it should eventually lead into Hotel Detail → Hotel Booking.

If flight-based, Flight Detail → Flight Booking.

==================================================
10. TRAVEL BY INTEREST
==================================================

Test every interest tile:

Mountains
Beaches
Culture
Food & Drink
Wildlife
Adventure

Each must open a filtered Explore experience.

Example:

Mountains
→ Explore
→ filter = Mountains

Do not simply navigate to generic Explore without preserving the selected interest.

==================================================
11. WHY TRAVALASTIC
==================================================

Verify these are informative and visually polished:

Discover
Plan
Book
Travel

If they are interactive, interactions must have purpose.

If they are static value propositions, keep them static.

Do not add unnecessary buttons.

==================================================
12. ACTIVE JOURNEY
==================================================

If the user has an active trip:

Open Journey
→ exact active journey

If the user has no active trip:

Show:

"Ready for your next journey?"

→ Plan with AI

Do not display fake active-trip information when no journey exists.

==================================================
13. NAVIGATION
==================================================

Test the entire top navigation:

Explore
Plan a Trip
Flights
Hotels
Experiences
Deals
My Trips

Search
Help
Profile

Every navigation item must open the correct page.

No duplicate destinations.

No dead routes.

No unexpected redirects.

==================================================
14. BACK NAVIGATION
==================================================

Test:

Home
→ Destination
→ Back

Home
→ Experience
→ Back

Home
→ Deal
→ Back

Home
→ AI Planner
→ Back

Home
→ My Trips
→ Journey
→ Back

Navigation should preserve useful context.

==================================================
15. RESPONSIVE QA
==================================================

Check the homepage at:

Desktop
Tablet
Mobile

Specifically verify:

• Hero
• Search
• Featured destination
• Trending rail
• Experience split
• AI planner
• Magazine grid
• Deal banner
• Interest tiles
• Active journey

No horizontal overflow.

No clipped CTAs.

No broken image ratios.

No text collisions.

No desktop-only navigation remaining on mobile.

==================================================
16. STATE QA
==================================================

Test:

No active journey
Active journey
Saved AI itinerary
Booked itinerary
Empty search
Search results
No matching results
Loading state

The homepage must respond appropriately to each state.

==================================================
FINAL RULE
==================================================

Do not report success because TypeScript compiles.

Actually test the navigation and interactions.

The success criterion is:

A traveler can start on Home and meaningfully continue through:

HOME
→ DISCOVER
→ DETAIL
→ PLAN
→ SEARCH
→ BOOK
→ MY TRIPS
→ JOURNEY

without encountering dead ends, generic redirects, fake interactions, or lost context.

Do not redesign anything during this pass.
Fix functional issues only.