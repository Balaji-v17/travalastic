TRAVALASTIC — JOURNEY AI INTEGRATION QA

Journey AI is now implemented with:

• Journey DNA
• Journey generation
• Journey Health
• Budget intelligence
• AI controls
• What If comparison
• Why This explanations
• Daily itinerary
• Hotel / Experience actions
• Ask Journey AI
• Existing journey and booking state

Do NOT add new features.

Perform a complete integration QA of Journey AI against the rest of the Travalastic consumer product.

==================================================
A. JOURNEY CREATION
==================================================

Test:

Home
→ Journey AI
→ Build Journey

Verify:

• Journey DNA is captured
• Destination is stored
• Origin is stored
• Dates are stored
• Travelers are stored
• Budget is stored
• Pace is stored
• Comfort is stored
• Interests are stored
• Must-haves are stored
• Avoid preferences are stored
• Notes are stored

Generated journey must be derived from these values.

==================================================
B. DATA INTEGRITY
==================================================

Every generated:

Flight
Hotel
Experience

must reference an existing entity ID from the centralized data layer.

Do not generate disconnected fake entities.

Verify:

flightId
hotelId
experienceId
journeyId
itineraryItemId

remain consistent throughout the flow.

==================================================
C. AI CONTROLS
==================================================

Test every existing AI control.

For every action verify:

Before
→ Action
→ Journey changes
→ Budget changes
→ Health changes
→ Explanation changes

No action should merely change displayed text.

==================================================
D. WHAT IF
==================================================

Generate an alternative.

Verify:

Current journey remains intact.

Alternative has independent state.

Compare:

Cost
Health
Duration
Hotels
Experiences
Travel time

"Use this version" should explicitly replace the planning version.

Do not accidentally modify already-booked components.

==================================================
E. WHY THIS
==================================================

Verify explanations reference actual data.

Do not use generic text.

Examples:

Hotel explanation references:
price
location
rating
preferences

Flight explanation references:
price
duration
stops
arrival/departure

Experience explanation references:
interest
rating
duration
location

==================================================
F. ASK JOURNEY AI
==================================================

Ask:

"How much budget do I have left?"

"What's already booked?"

"What's unbooked?"

"Which day is busiest?"

"How much free time do I have?"

"What happens if my flight is delayed?"

"What should I pack?"

"Can we add a food experience?"

Verify responses use the CURRENT journey state.

Do not use stale generated values.

==================================================
G. JOURNEY → BOOKING
==================================================

From Journey AI:

Hotel
→ Hotel Detail
→ Hotel Booking

Verify:

journeyId preserved.

Then:

Confirmation
→ SAME Journey

Hotel becomes:

BOOKED

Repeat for:

Flight
Experience

Each must use its own booking flow.

==================================================
H. BOOKING → ASK JOURNEY AI
==================================================

After booking a hotel:

Ask:

"What is booked?"

Journey AI must recognize the hotel as BOOKED.

Ask:

"How much have I spent?"

Budget must reflect the booking.

Ask:

"What is still unbooked?"

The response must reflect current state.

==================================================
I. MY TRIPS
==================================================

Save the generated journey.

Verify it appears in:

My Trips

Open it.

Verify it opens the exact same journey.

No duplicate journey should be created.

==================================================
J. NAVIGATION
==================================================

Verify:

Home → Journey AI

Journey AI → My Trips

Journey AI → Journey

Journey → Hotel

Journey → Experience

Journey → Flight

Journey → Booking

Booking → Journey

Journey → Ask Journey AI

No dead ends.

==================================================
K. FINAL TEST
==================================================

Perform this exact scenario:

Create Japan journey.

Make it cheaper.

Add food experiences.

Compare a 10-day alternative.

Use the alternative.

Open Kyoto hotel.

Book hotel.

Return to Japan journey.

Ask:

"What's booked?"

Ask:

"How much budget do I have left?"

Ask:

"What's next?"

Every answer must reflect the actual current state.

Do not report success based solely on compilation.

Fix functional inconsistencies before declaring completion.