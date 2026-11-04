TRAVALASTIC — JOURNEY 2.0 + TRAVEL LIFECYCLE

The core architecture and booking routing are stable.

Do NOT rebuild AppContext, Router, Search, or existing booking flows unless a real regression is found.

Now make the Journey experience feel like the user's actual travel command center.

==================================================
1. JOURNEY HEADER
==================================================

Redesign the top of JourneyPage around the trip itself.

Show:

Destination
Trip dates
Travelers
Journey status
Journey Health
Budget status

Example:

TOKYO SPRING ESCAPE
15–22 March · 2 travelers

Journey Health
92 / 100

₹1,12,400 booked
₹37,600 remaining

Primary:
"Ask Journey AI"

Secondary:
"Manage trip"

Use actual journey state.

==================================================
2. TRIP TIMELINE
==================================================

Create a visual chronological timeline.

Example:

MAR 15
✈ Mumbai → Tokyo
Booked

MAR 15
🏨 Park Hyatt Tokyo
Booked

MAR 16
🍣 Tsukiji Food Tour
Not booked

MAR 18
🚄 Tokyo → Kyoto
Not booked

MAR 18
🏨 Ritz-Carlton Kyoto
Booked

Each itinerary item must have:

date
time where available
entity
status
price
action

Actions:

View
Book
Manage

==================================================
3. BOOKED VS UNBOOKED
==================================================

Make status visually obvious.

BOOKED:
✓ Confirmed

UNBOOKED:
"Needs booking"

CANCELLED:
"Cancelled"

PENDING:
"Processing"

Do not use ambiguous labels.

==================================================
4. BOOKING MANAGEMENT
==================================================

For booked items allow:

View booking
View confirmation
View details
Contact support

For unbooked items:

View details
Book now

For cancelled items:

Find alternative

==================================================
5. TRIP SECTIONS
==================================================

Organize the journey into:

Overview
Itinerary
Bookings
Documents
Expenses

Use tabs or segmented navigation.

Do not create unnecessary pages if the existing JourneyPage can handle this cleanly.

==================================================
6. OVERVIEW
==================================================

Show:

Next event
Trip progress
Budget
Journey Health
Booking progress
Weather placeholder/context
Important travel information

Example:

Next up

Flight to Tokyo
Tomorrow · 08:40

==================================================
7. BOOKINGS
==================================================

Show all confirmed bookings grouped by type:

Flights
Hotels
Experiences
Transfers

Each should display:

confirmation reference
date
provider
status
amount

Do not expose irrelevant fields.

==================================================
8. DOCUMENTS
==================================================

Create a useful document area.

Examples:

Flight confirmation
Hotel confirmation
Experience voucher
Travel insurance
Visa documents

Use actual booking state.

If nothing exists:

"No travel documents yet."

==================================================
9. EXPENSES
==================================================

Show:

Total planned
Total booked
Remaining
Category breakdown

Categories:

Flights
Hotels
Experiences
Transport
Food
Other

Use the same financial source as Journey AI.

Do not create a separate budget calculation.

==================================================
10. JOURNEY AI
==================================================

Make Journey AI deeply contextual.

Quick actions:

What's next?
What have I booked?
What's still missing?
Can I save money?
Is my itinerary too busy?
What should I pack?
What happens if my flight is delayed?

Responses should use the current journey.

==================================================
11. WHAT-IF MODE
==================================================

Preserve the existing What If functionality.

Examples:

"Make this trip cheaper."

"Give me more free time."

"Upgrade my hotels."

"Add one more food experience."

"Reduce travel time."

Show:

Current
Alternative

Cost difference
Journey Health difference

CTA:

Use this version

Do not modify the saved journey until the user explicitly chooses it.

==================================================
12. TRAVEL DAY MODE
==================================================

If the journey is currently in progress, switch the Journey UI into a more practical mode.

Show:

Today
Next event
Current location
Next booking
Important reminders

Example:

TODAY · MAR 17

10:30
Tsukiji Food Tour

18:00
Shibuya Evening

NEXT:
Hotel check-in · 21:00

Do not overdo this.

==================================================
13. TRIP PROGRESS
==================================================

Show meaningful progress:

Planning
██████░░ 75%

Booking
████████ 100%

Trip
Not started

During travel:

Trip
████░░░░ 50%

Calculate dynamically.

==================================================
14. TRIP HEALTH
==================================================

Use the existing Journey Health model.

Show the six factors:

Budget fit
Pace
Interests
Convenience
Travel time
Hotels

Allow the user to understand WHY the score exists.

Example:

92 / 100

Budget fit
Excellent

Pace
Balanced

Travel time
Good

==================================================
15. DISRUPTION EXPERIENCE
==================================================

Keep disruption traveler-facing only.

Example:

"Your flight has been delayed."

Then show:

What changed
What it affects
What Travalastic recommends

Actions:

View options
Ask Journey AI
Contact support

NO:

Simulate disruption
Resolve incident
Operator controls
Supplier controls

==================================================
16. SUPPORT
==================================================

Journey support must automatically understand:

journeyId
bookings
destination
dates
current itinerary
traveler count

So:

"Where is my hotel?"

should produce a contextual response.

==================================================
17. MY TRIPS SYNCHRONIZATION
==================================================

Verify:

My Trips
↔ Journey
↔ Journey AI
↔ Booking state

All must update immediately after:

booking
cancellation
alternative selection
journey edits

==================================================
18. RESPONSIVE DESIGN
==================================================

Desktop:

Large editorial journey header
Timeline
Side information panels

Mobile:

Compact header
Scrollable timeline
Sticky primary action

Do not turn the page into a dashboard.

==================================================
19. FINAL QA
==================================================

Test:

Create journey
→ Save

My Trips
→ Open Journey

Book hotel
→ Journey updates

Book experience
→ Journey updates

Book flight
→ Journey updates

Ask Journey AI
→ Uses current state

Change What If
→ Compare

Use alternative
→ Journey updates

Open Documents
→ Current confirmations

Open Expenses
→ Current financial state

Navigate back to My Trips
→ Correct journey remains selected

No journeys[0].

No hardcoded booking counts.

No stale budget.

No irrelevant booking fields.

==================================================
SUCCESS CRITERIA
==================================================

The Journey page should answer one question:

"Everything about my trip — what is happening, what is booked, what is next, what it costs, and what I should do."

It should feel like the strongest screen in Travalastic.

Do not report success merely because TypeScript compiles.

Report actual runtime flows tested.