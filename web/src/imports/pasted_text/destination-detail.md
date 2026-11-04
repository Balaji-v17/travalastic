TRAVALASTIC — DESTINATION DETAIL 2.0

Explore 2.0 is now complete.

Do NOT modify ExplorePage.

Now redesign and deepen DestinationDetailPage.

The destination page is the critical bridge:

EXPLORE
→ DESTINATION
→ DISCOVER
→ PLAN
→ BOOK

It should NOT feel like a static destination information page.

It should feel like a complete decision-making page for a traveler who is considering the destination.

==================================================
1. DESTINATION HERO
==================================================

Create a cinematic full-width destination hero.

Example:

TOKYO

Japan

"Where tradition meets tomorrow."

Show:

Destination image
Country
Rating
Best time to visit
Typical trip duration
Starting daily budget

Primary CTA:

"Plan with Journey AI"

Secondary:

"Explore stays"

Tertiary:

"Explore experiences"

Add:

♡ Save destination

The hero should feel editorial, not like a product card.

==================================================
2. DESTINATION SNAPSHOT
==================================================

Immediately below the hero, show a compact decision strip:

Best for:
Culture · Food · Shopping · Photography

Ideal duration:
5–8 nights

Typical daily budget:
₹8,000–₹15,000

Best season:
March–May

Travel difficulty:
Easy

Flight time from Mumbai:
~7 hours

Use actual destination data where available.

Do not invent unsupported values.

==================================================
3. WHY VISIT
==================================================

Create a strong editorial section:

"Why Tokyo?"

Use 3–4 meaningful reasons.

Example:

World-class food
Ancient traditions
Nightlife & design
Endless neighborhoods to explore

Use large visual compositions rather than four identical cards.

==================================================
4. JOURNEY AI DESTINATION PLANNER
==================================================

Make Journey AI prominent here.

Section:

"Let Journey AI build Tokyo around you."

Supporting:

"Tell us your dates, budget and travel style. We'll build the route, stays and experiences around what matters to you."

CTA:

"Build my Tokyo journey"

When clicked:

Journey AI must open with:

destination = Tokyo

already preselected.

If the user came from a filtered Explore state, preserve useful travel preferences where appropriate.

==================================================
5. WHERE TO STAY
==================================================

Use real hotels associated with this destination.

Show:

Hotel image
Name
Rating
Location
Room starting price
Key amenities

Do NOT immediately send users to checkout.

Flow:

Hotel card
→ Hotel Detail
→ Hotel Booking

Add:

"View all stays"

which opens Hotel Search filtered to this destination.

==================================================
6. HOTEL RECOMMENDATION INTELLIGENCE
==================================================

Instead of simply listing hotels, provide useful context.

Example:

"Best for first-time visitors"

"Best luxury stay"

"Best value"

"Best for couples"

"Best location"

These should be based on actual hotel data.

Do not randomly assign labels.

==================================================
7. EXPERIENCES
==================================================

Create:

"Things worth doing"

Use actual experiences associated with the destination.

Show:

Image
Experience
Duration
Rating
Price
Category

Examples:

Food
Culture
Adventure
Nature
Nightlife

Experience card:

→ Experience Detail

NOT directly to checkout.

Add:

"Explore all experiences"

→ Experience Search filtered to destination.

==================================================
8. EXPERIENCE HIGHLIGHT
==================================================

Create one large editorial experience feature.

Example:

"Tokyo After Dark"

Large image
Description
Duration
Rating
Price

CTA:

"Explore experience"

Use an existing experience from the data layer.

==================================================
9. SAMPLE JOURNEYS
==================================================

Show how travelers can actually spend time here.

Examples:

5-Day Tokyo Essentials
7-Day Tokyo + Kyoto
10-Day Japan Explorer

Each should display:

Duration
Approximate budget
Travel style
Highlights

CTA:

"Build this with Journey AI"

Do not create disconnected fake itineraries.

Use Journey AI with prefilled constraints.

==================================================
10. DESTINATION ITINERARY PREVIEW
==================================================

Show a compact example timeline.

DAY 1

Arrival
Shinjuku
Tokyo dinner

DAY 2

Asakusa
Senso-ji
Ueno

DAY 3

Tsukiji
Shibuya
Nightlife

This is a preview, not a full itinerary builder.

CTA:

"Build my complete journey"

→ Journey AI

==================================================
11. LOCAL INSIGHT
==================================================

Add practical information.

Getting around
Currency
Language
Time zone
Visa information
Connectivity
Payment methods

Only show data available in the destination model.

If visa information is unavailable:

Do not invent it.

Use:

"Check visa requirements"

→ Visa Center

==================================================
12. BEST TIME TO VISIT
==================================================

Create a visual seasonal section.

Show:

Jan
Feb
Mar
Apr
May
Jun
Jul
Aug
Sep
Oct
Nov
Dec

Highlight:

Best
Good
Peak
Low

Use actual destination season data if available.

If the current data model does not support this yet, create the structure without fabricating detailed climate statistics.

==================================================
13. TRAVEL STYLE MATCH
==================================================

If traveler preferences exist:

Show:

"Why Tokyo matches you"

Example:

Food
★★★★★

Culture
★★★★★

Photography
★★★★☆

Adventure
★★★☆☆

This should use the traveler's stored preferences.

If no profile preferences exist:

"Discover your travel style"

CTA:

"Set preferences"

==================================================
14. SIMILAR DESTINATIONS
==================================================

Show:

"If you like Tokyo, you may also like..."

Use actual destination relationships where available.

Potential examples:

Seoul
Singapore
Kyoto
Osaka

Each opens its own destination page.

==================================================
15. SAVE / SHARE
==================================================

Support:

♡ Save

Share

Saved destinations should use the existing Saved Places state.

Do not create another save system.

==================================================
16. BOOKING HANDOFF
==================================================

Verify all paths.

Destination
→ Hotel
→ Hotel Detail
→ Hotel Booking

Destination
→ Experience
→ Experience Detail
→ Experience Booking

Destination
→ Flight Search
→ Flight Detail
→ Flight Booking

Destination
→ Journey AI
→ Journey
→ Booking

Every route must preserve destination context.

==================================================
17. ACTIVE JOURNEY AWARENESS
==================================================

If the traveler already has a journey containing this destination:

Show:

"You're already planning Tokyo."

Then:

Open Journey
Continue planning

Do NOT create another journey automatically.

==================================================
18. VISUAL STRUCTURE
==================================================

Do NOT build:

Hero
→ cards
→ cards
→ cards
→ cards

Use:

FULL-BLEED HERO
↓
DESTINATION SNAPSHOT
↓
EDITORIAL STORY
↓
JOURNEY AI FEATURE
↓
HOTEL DISCOVERY
↓
EXPERIENCE FEATURE
↓
EXPERIENCE COLLECTION
↓
SAMPLE JOURNEYS
↓
PRACTICAL GUIDE
↓
SEASONAL DISCOVERY
↓
TRAVEL STYLE MATCH
↓
SIMILAR DESTINATIONS
↓
FOOTER

Every section should have a different visual rhythm.

==================================================
19. DATA RULE
==================================================

Use centralized data.

Destination detail must derive:

hotels
experiences
flights
sample journey information

from relationships to the destination ID.

Do NOT use:

hotels[0]
experiences[0]
destinations[0]

as generic placeholders.

==================================================
20. RESPONSIVE
==================================================

Desktop:

Cinematic editorial layout.

Tablet:

Two-column where appropriate.

Mobile:

Stack naturally.

Hero remains strong.

Horizontal rails become swipeable.

No horizontal page overflow.

==================================================
21. FINAL TEST
==================================================

Test:

Explore
→ Tokyo
→ Destination Detail

Then:

Tokyo
→ Journey AI
→ Tokyo preselected

Tokyo
→ Hotel
→ Hotel Detail
→ Booking

Tokyo
→ Experience
→ Experience Detail
→ Booking

Tokyo
→ Similar destination
→ Destination Detail

Tokyo
→ Save
→ Saved Places

Tokyo
→ Active Journey
→ Existing Journey

No dead ends.

No generic redirects.

No lost destination context.

Do not report success based solely on TypeScript compilation.

Test the actual consumer journey.