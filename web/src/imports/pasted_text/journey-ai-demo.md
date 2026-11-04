JOURNEY AI — INTERACTION DEPTH PASS

The Journey AI UI is now conceptually redesigned.

Now audit every AI control and remove anything that is merely decorative.

These actions must produce real state changes:

• Make it cheaper
• Make it more luxurious
• Slow the pace down
• Add more food
• Add more adventure
• Add more culture
• Remove shopping
• Add 2 days
• Reduce travel time
• Avoid early flights
• Keep hotels under a specified price

When an action is selected:

Read the current journey
Modify the appropriate itinerary components
Recalculate budget
Recalculate Journey Health
Update the journey timeline
Preserve existing bookings unless the change explicitly affects them
Explain what changed

Do not fake AI responses with static text.

Use deterministic demo intelligence backed by the existing data layer where real AI/API infrastructure is unavailable.

The experience should FEEL intelligent while remaining technically reliable.


JOURNEY AI — VERSION COMPARISON

Implement a meaningful "What if?" comparison system.

When the user asks:

"What if I reduce my budget?"

or:

"What if I add 2 days?"

or:

"What if I want more luxury?"

create an alternative journey version.

Do not overwrite the current journey immediately.

Show:

CURRENT JOURNEY
vs
AI ALTERNATIVE

Compare:

Total cost
Duration
Hotels
Destinations
Travel time
Experiences
Journey Health
Pace

Highlight meaningful differences.

Example:

CURRENT
₹1,47,800
8 nights
Premium hotels
92 Journey Health

ALTERNATIVE
₹1,29,200
8 nights
Comfort hotels
95 Journey Health

Explain:

"₹18,600 saved by changing the Tokyo hotel and replacing one private transfer."

Actions:

Compare
Use this version
Keep current

If the user chooses the alternative:

replace the active planning version.

Do not affect already confirmed bookings without explicit confirmation.


JOURNEY AI — EXPLAINABLE DECISIONS

Add contextual "Why this?" explanations throughout Journey AI.

Relevant entities should expose:

Why this hotel?
Why this flight?
Why this destination?
Why this order?
Why this activity?
Why this price?

Examples:

WHY THIS HOTEL?

"Selected because it is close to your preferred neighborhoods, fits your ₹7,000/night target and includes breakfast."

WHY THIS FLIGHT?

"₹4,200 more than the cheapest option, but it avoids a 7-hour layover and arrives 3 hours earlier."

WHY KYOTO BEFORE OSAKA?

"This order reduces backtracking and groups your cultural experiences together."

WHY DAY 4?

"We moved the food tour to the afternoon so your morning remains free, matching your relaxed travel pace."

These explanations must be derived from actual journey data and preferences.

Do not display generic AI filler.

Keep explanations concise and useful.


JOURNEY AI — CONTEXTUAL ASSISTANT

Add "Ask Journey AI" to the Journey page.

This is NOT a generic chatbot.

It must understand the currently opened journey.

It should have access to:

• Journey ID
• Destination
• Dates
• Travelers
• Journey DNA
• Itinerary
• Bookings
• Hotels
• Flights
• Experiences
• Budget
• Remaining budget
• Booking status
• Upcoming activities

Example questions:

"How much have we spent?"

"What's booked already?"

"Can I add another food experience?"

"Which day is the busiest?"

"Do we have enough time between these activities?"

"Can I reduce the hotel cost?"

"How much free time do I have in Kyoto?"

"What should I pack?"

"Which activities haven't been booked?"

The assistant must answer based on the actual current journey.

Do not show generic responses unrelated to the journey.

If an action is requested, offer a real action.

Example:

User:
"Find me a cheaper Kyoto hotel."

AI:

"Your current hotel is ₹18,500 for 2 nights.

I found 3 alternatives within your preferences."

[View alternatives]

Do not pretend an action happened if it did not.


JOURNEY AI — JOURNEY HEALTH ENGINE

Implement a real Journey Health calculation for generated journeys.

Journey Health should consider:

Budget fit
Pace
Travel time
Interest alignment
Hotel quality
Transfer efficiency
Daily activity density

Example:

JOURNEY HEALTH
92 / 100

Budget        94
Pace          91
Interests     98
Convenience   96
Travel Time   84
Hotels        93

Scores must be calculated from the actual journey state.

Do not use completely random values.

If one metric is weak, explain why.

Example:

Travel Time — 84

"Day 5 contains 4h 20m of intercity travel."

Then offer:

"Optimize this"

Optimization should actually modify the journey where possible.

When the journey changes:

Recalculate the score.

When the user books an item:

Update the relevant journey state.

When a booking is cancelled:

Update the journey state and score.

The score should always reflect the current journey.


JOURNEY AI — STAKEHOLDER DEMO EXPERIENCE

Create a polished deterministic demo scenario for Journey AI.

The demo should allow a stakeholder to experience the product's unique intelligence within approximately 3–5 minutes.

Default scenario:

2 travelers
Japan
8 nights
Budget ₹1,50,000
Relaxed pace
Food + Culture + Photography

Demo sequence:

STEP 1

Build the journey.

Show:

Journey DNA
Route
Budget
Journey Health
Itinerary

STEP 2

Select:

"Make it cheaper"

Show the journey being recalculated.

Display:

Previous price
New price
Savings
What changed

STEP 3

Select:

"Add more food"

Show the itinerary updating.

STEP 4

Open:

"What if I add 2 days?"

Show:

Current Journey
Alternative Journey

STEP 5

Open:

"Why this hotel?"

Show a concise explanation based on actual data.

STEP 6

Book the hotel.

Use the correct Hotel Booking Flow.

No flight fields.

STEP 7

Return to the SAME journey.

Show:

Hotel ✓ BOOKED

STEP 8

Open:

"Ask Journey AI"

Ask:

"How much budget do I have left?"

The response must use the actual journey state.

STEP 9

Ask:

"What happens if my flight is delayed?"

Show how Journey AI evaluates the itinerary.

The objective is to demonstrate:

UNDERSTAND
→ BUILD
→ OPTIMIZE
→ EXPLAIN
→ BOOK
→ ADAPT

This is the signature Travalastic product story.

Do not add fake AI typing animations without meaningful underlying state changes.

The demo must be reliable every time.