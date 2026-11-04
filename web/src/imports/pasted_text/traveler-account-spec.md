TRAVALASTIC — TRAVELER ACCOUNT + DOCUMENTS + SUPPORT 2.0

The core consumer flows are now established:

Home
Explore
Search
Destination
Detail Pages
Journey AI
Booking
My Trips
Journey

Do NOT rebuild those systems.

Now complete the personal traveler layer:

Profile
Travelers
Travel Documents
Payments
Preferences
Notifications
Support

The objective is to make the account area genuinely useful to someone who travels frequently.

==================================================
1. PROFILE HOME
==================================================

Profile should NOT feel like an admin settings page.

Create a premium traveler profile.

Show:

Traveler name
Profile photo/avatar
Home city
Travel style
Preferred cabin
Preferred hotel comfort
Saved destinations
Upcoming journey

Example:

ARJUN SHARMA

Mumbai, India

Balanced traveler
Comfort stays
Economy / Premium Economy

"Edit travel identity"

==================================================
2. TRAVEL IDENTITY
==================================================

Create a meaningful travel identity section.

Store:

Home airport
Preferred airlines
Preferred cabin
Hotel comfort
Budget style
Travel pace
Favorite travel styles
Dietary preferences
Accessibility preferences
Preferred activities

These preferences should be usable by Journey AI.

Example:

Journey AI should know:

"User prefers comfortable hotels and relaxed itineraries."

Do not merely save decorative settings.

==================================================
3. TRAVELERS
==================================================

Allow multiple traveler profiles.

Example:

You
Arjun Sharma

Partner
Priya Sharma

Child
Aarav Sharma

Each traveler:

Name
DOB
Gender where appropriate
Nationality
Passport information
Contact information
Special requirements

Provide:

Add traveler
Edit traveler
Remove traveler

Do not expose sensitive information unnecessarily.

==================================================
4. TRAVEL DOCUMENTS
==================================================

Create a proper Travel Documents center.

Categories:

Passport
Visa
Government ID
Travel Insurance
Other

Each document should have:

Document type
Traveler
Expiry date
Status

Examples:

Passport
Expires 18 Nov 2031
✓ Valid

Japan Visa
Valid until 30 Mar 2027
✓ Active

Use realistic mock state.

==================================================
5. EXPIRY INTELLIGENCE
==================================================

Surface useful warnings.

Example:

"Your passport expires in 5 months."

"Your visa expires before your upcoming journey."

"Your passport has less than 6 months validity for this destination."

These should be contextual.

Do NOT pretend to perform real government verification.

==================================================
6. JOURNEY AI DOCUMENT CONTEXT
==================================================

Journey AI should be able to use document state.

Examples:

"Do I have the documents I need?"

"Is my passport valid for this trip?"

"What documents should I carry?"

Responses should reference the traveler's stored document state.

==================================================
7. PAYMENTS
==================================================

Create a consumer payment center.

Show:

Saved cards
UPI
Wallet / credits

Example:

Visa •••• 4242

Default payment method

Actions:

Add
Edit
Remove
Set default

Do NOT store real payment credentials.

Use mock/demo data only.

==================================================
8. BOOKING PAYMENT HANDOFF
==================================================

Booking flows should use the selected payment method.

Example:

Payment

Visa •••• 4242
Default

Change

Do not ask for card details repeatedly if a saved method exists.

==================================================
9. PREFERENCES
==================================================

Separate travel preferences from account settings.

Allow:

Travel pace
Budget style
Accommodation
Activities
Food
Climate
Travel style

These should feed Journey AI and recommendations.

==================================================
10. NOTIFICATIONS
==================================================

Create a real traveler notification center.

Categories:

Booking
Journey
Payment
Travel alert
Recommendation

Examples:

"Your Tokyo hotel is confirmed."

"Your flight departs tomorrow."

"Your passport expires in 5 months."

"Your Kyoto experience is still unbooked."

Notifications should be derived from application state where possible.

==================================================
11. NOTIFICATION ACTIONS
==================================================

Every important notification should have an action.

Examples:

Hotel confirmed
→ View booking

Flight tomorrow
→ Open journey

Experience unbooked
→ Book now

Document expiring
→ View document

Do not create dead-end notifications.

==================================================
12. SUPPORT CENTER
==================================================

Support should NOT be a generic chatbot page.

Make it contextual.

Show:

Current journey
Recent bookings
Common issues
Help categories

Categories:

Bookings
Payments
Cancellations
Changes
Travel documents
Flights
Hotels
Experiences

==================================================
13. CONTEXTUAL SUPPORT
==================================================

If user opens Support from:

Journey

Support automatically knows the journey.

Hotel booking

Support knows the hotel booking.

Flight booking

Support knows the flight.

Example:

"How can we help with your Tokyo journey?"

Recent:

Park Hyatt Tokyo
IndiGo Mumbai → Tokyo
Tsukiji Food Tour

==================================================
14. ASK JOURNEY AI VS SUPPORT
==================================================

Clearly distinguish them.

Journey AI:

Planning
Recommendations
Optimization
"Itinerary too busy?"
"Can I save money?"

Support:

Booking problems
Refunds
Cancellations
Payment issues
Assistance

Do NOT make both screens identical chatbots.

==================================================
15. HELP CENTER
==================================================

Create useful help topics.

Examples:

How cancellations work
How refunds work
Changing a booking
Adding travelers
Managing documents
Payment methods
Using Journey AI

Use expandable articles/cards.

==================================================
16. BOOKING SUPPORT
==================================================

From a booking:

View booking
→ Help

Show contextual actions:

Change booking
Cancel booking
Payment issue
Contact support

Only show actions appropriate to that booking type.

==================================================
17. ACCOUNT SECURITY
==================================================

Add:

Password
Login activity
Two-factor authentication
Device/session management

For demo purposes these can be realistic UI states.

Do not implement fake security claims.

==================================================
18. PRIVACY
==================================================

Allow:

Personalization
Marketing communications
Travel alerts
Data preferences

Use clear explanations.

==================================================
19. ACCOUNT NAVIGATION
==================================================

Profile navigation should be clean:

Profile
Travel Identity
Travelers
Documents
Payments
Preferences
Notifications
Security
Privacy
Help & Support

Avoid giant sidebars.

Use tabs/sections appropriate to the existing design language.

==================================================
20. GLOBAL SYNCHRONIZATION
==================================================

Verify:

Profile preferences
→ Journey AI

Travelers
→ Booking flows

Documents
→ Journey AI

Payments
→ Booking

Notifications
→ Booking/Journey state

Support
→ Booking/Journey context

Everything must use the same application state.

==================================================
21. DEMO SCENARIO
==================================================

Test:

Create traveler profile.

Add second traveler.

Add passport.

Set travel preferences.

Create Tokyo journey using Journey AI.

Journey AI should reflect those preferences.

Book hotel.

Payment screen should show saved payment method.

Booking confirmation should create notification.

Open Notifications.

Click notification.

Return to Journey.

Open Support.

Support should understand the journey.

Ask Journey AI:

"Do I have everything I need for Japan?"

It should use:

Traveler
Documents
Journey
Bookings
Preferences

==================================================
22. VISUAL QUALITY
==================================================

Profile should feel:

Personal
Premium
Calm
Trustworthy

NOT:

Admin
CRM
Enterprise dashboard

Use:

Large profile header
Editorial section headings
Clean cards
Subtle dividers
Clear status chips
Travel imagery where appropriate

==================================================
23. FINAL QA
==================================================

Test:

Profile
→ Edit preferences
→ Journey AI

Profile
→ Travelers
→ Booking

Documents
→ Journey AI

Payments
→ Booking

Booking
→ Notification

Notification
→ Journey

Journey
→ Support

Support
→ Booking

No dead ends.

No duplicate state.

No hardcoded traveler information where application state already exists.

==================================================
SUCCESS CRITERIA
==================================================

The traveler should feel:

"This platform knows me, understands my trips, remembers my preferences, keeps my documents organized, and helps me when something goes wrong."

Do not report success based only on TypeScript compilation.

Verify the actual runtime flows and state synchronization.