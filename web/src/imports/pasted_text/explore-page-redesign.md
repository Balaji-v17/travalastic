TRAVALASTIC — EXPLORE PAGE 2.0
DISCOVERY ENGINE REDESIGN

The HomePage and Journey AI are now substantially upgraded.

Now redesign the consumer-facing ExplorePage so it feels like a premium travel discovery product rather than a destination catalogue.

IMPORTANT:

Do NOT simply add more cards.

Do NOT make the page longer by duplicating destination grids.

Do NOT turn Explore into a dashboard.

Explore's purpose is:

DISCOVER → FILTER → COMPARE → UNDERSTAND → PLAN

The user should be able to discover a destination and naturally continue into Journey AI, Hotels, Experiences or the destination detail page.

==================================================
1. EXPLORE HERO
==================================================

Create a strong editorial discovery header.

Heading:

"Where will you go next?"

Supporting:

"Explore places that match the way you want to travel."

Add a prominent discovery/search field:

"Search destinations, regions, experiences..."

Below it show quick travel-style filters:

Beach
Mountains
Culture
Food
Adventure
Wellness
Wildlife
City
Romantic

The selected style must remain connected to SearchQuery.travelStyle.

==================================================
2. SMART DISCOVERY CONTEXT
==================================================

If Explore was opened from:

Home → Travel by Interest

show:

"Exploring: Mountains"

with a clear removable filter.

If opened from a destination search:

show:

"Results for Japan"

If opened normally:

show:

"Explore the world"

Do not lose navigation context.

==================================================
3. FEATURED DESTINATION
==================================================

Do NOT begin with a grid.

Create a large editorial destination feature.

Example:

JAPAN

"Tradition, technology and unforgettable food."

Show:

Large cinematic image

Best for:
Culture · Food · Photography

Ideal duration:
7–12 nights

From:
₹8,000/day

Journey Health preview:

"Excellent match for Food + Culture travelers"

Actions:

Explore Japan
Plan Japan with Journey AI

==================================================
4. DISCOVER BY REGION
==================================================

Create a region discovery section.

Regions:

Asia
Europe
Middle East
Indian Ocean
Americas
Oceania

Use visually distinct large tiles.

Each should show:

Region
Number of destinations
Short editorial description

Example:

ASIA

"Ancient cities, tropical islands and some of the world's best food."

20+ destinations

Clicking a region should filter Explore.

==================================================
5. DESTINATION RESULTS
==================================================

Now introduce the destination collection.

Do NOT show 20+ identical cards.

Use an editorial masonry/grid composition.

Example:

One large destination
Two medium
Three compact

Each destination should show:

Image
Destination
Country
Travel style
Starting price
Trending indicator where relevant

Hover:

Explore
Plan with Journey AI

Do not send users directly to checkout.

==================================================
6. SMART FILTERS
==================================================

Create a refined filter system.

Filters:

Region
Country
Travel style
Budget
Trip duration
Best season
Traveler type
Experience type

Examples:

Under ₹5,000/day

3–5 days

7–10 days

Beach

Food

Family

Couples

Solo

Luxury

Filters must update the actual results.

Show:

"24 destinations"

not a hardcoded count.

==================================================
7. "MATCHED TO YOUR STYLE"
==================================================

If traveler preferences exist, create:

"Picked for your travel style"

Example:

"Because you love food + culture"

Show 4–6 destinations.

Use actual profile/preferences data where available.

If no preferences exist:

"Discover your travel style"

CTA:

"Set preferences"

Do not show fake personalization.

==================================================
8. TRENDING NOW
==================================================

Create a horizontal editorial rail.

Example:

Trending this week

Tokyo
Bali
Dubai
Maldives
Kyoto
Rajasthan
Kerala

Each should show:

Trending percentage
Price
Best for

Allow horizontal scrolling.

==================================================
9. SEASONAL DISCOVERY
==================================================

Add a section:

"Where to travel right now"

Use the current month/date from application logic.

Examples should be based on existing destination data.

Show:

Best destinations this season

Do not hardcode irrelevant seasonal recommendations.

Each destination:

Best months
Why now
Starting price

==================================================
10. TRAVELER TYPE
==================================================

Add visual discovery categories:

Solo travelers
Couples
Families
Friends
Luxury travelers
Budget travelers

Each category should filter or influence Explore results.

Example:

Couples

→ filters travelerType = couples

==================================================
11. EXPERIENCE-LED DISCOVERY
==================================================

Add:

"Choose what you want to feel."

Categories:

Taste
Adventure
Relax
Discover
Celebrate
Reconnect

Each should surface destinations/experiences matching that intent.

This is different from basic travel styles.

For example:

"Taste"

→ food-focused destinations + food experiences.

==================================================
12. DESTINATION DETAIL HANDOFF
==================================================

Every destination card must lead to:

Destination Detail

NOT directly to booking.

Destination Detail should provide:

Hotels
Experiences
Flights
Plan with Journey AI

The destination page becomes the bridge between discovery and transaction.

==================================================
13. JOURNEY AI HANDOFF
==================================================

Every major Explore context should have:

"Plan this with Journey AI"

Examples:

Japan
→ Journey AI with Japan preselected

Mountains
→ Journey AI with travelStyle = Adventure

Food
→ Journey AI with interest = Food

Couples
→ Journey AI with travelerType = Couples

Preserve all relevant context.

==================================================
14. SAVE DESTINATION
==================================================

Allow:

♡ Save

on destinations.

Saved destinations should appear in the user's Saved Places / profile state if that functionality already exists.

Do not create a separate disconnected save system.

==================================================
15. COMPARE
==================================================

Add a lightweight comparison capability.

Allow selecting up to 3 destinations.

Example:

Japan
vs
Bali
vs
Thailand

Compare:

Typical budget
Ideal duration
Travel style
Best season
Flight difficulty
Experience density

CTA:

"Plan this journey"

This should hand the comparison context to Journey AI.

==================================================
16. EMPTY STATE
==================================================

If filters produce zero results:

Show:

"No destinations match these preferences."

Then offer:

Clear filters

or:

"Let Journey AI find something for me"

This should open Journey AI with the relevant constraints.

==================================================
17. RESULT COUNT
==================================================

Result counts must be calculated from the actual filtered dataset.

Do not display arbitrary numbers.

Example:

18 destinations

5 destinations

0 destinations

==================================================
18. NAVIGATION
==================================================

Test:

Explore
→ Destination
→ Back

Explore
→ Journey AI

Explore
→ Region filter

Explore
→ Travel style

Explore
→ Traveler type

Explore
→ Compare

Explore
→ Saved Places

Every action must preserve useful context.

==================================================
19. VISUAL DESIGN
==================================================

Explore should feel like:

Airbnb discovery
+
premium travel editorial
+
intelligent personalization

Use:

Large photography
Editorial typography
Asymmetric layouts
Horizontal rails
Large destination features
Subtle filters
Generous whitespace

Avoid:

Dashboard-style KPI cards
Dense tables
Uniform card grids
Excessive pills
Generic SaaS UI

==================================================
20. RESPONSIVE
==================================================

Desktop:

Editorial multi-column layouts.

Tablet:

Reduce columns intelligently.

Mobile:

Large destination cards
Horizontal swipe rails
Sticky filter control
No horizontal page overflow

==================================================
21. FINAL USER FLOW
==================================================

Verify these complete flows:

A:

Home
→ Explore
→ Japan
→ Destination Detail
→ Plan with Journey AI
→ Japan preselected

B:

Home
→ Mountains
→ Explore
→ Adventure filter active
→ Destination
→ Journey AI

C:

Explore
→ Food
→ Food-focused destinations
→ Compare 3
→ Journey AI

D:

Explore
→ Couples
→ Filtered destinations
→ Destination
→ Hotel
→ Hotel Detail
→ Hotel Booking

==================================================
SUCCESS CRITERIA
==================================================

Explore should answer:

"Where should I go?"

without forcing the user to already know the destination.

The page should help the traveler move naturally from:

INTEREST
→ DESTINATION
→ INSPIRATION
→ COMPARISON
→ JOURNEY AI
→ BOOKING

Do not report success based solely on TypeScript compilation.

Verify the actual navigation, filtering, personalization and context preservation.