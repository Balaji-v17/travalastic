TRAVALASTIC — MASTER PRODUCT IMPLEMENTATION DIRECTIVE

You are now working on Travalastic, a full-fledged intelligent travel operating platform.

IMPORTANT:
Do NOT treat this as a landing page.
Do NOT treat this as a visual-only prototype.
Do NOT create disconnected mock screens.
Do NOT build a collection of static dashboards.

I need a believable, functional product that can be demonstrated to stakeholders as if it were a real travel platform.

The platform must have connected user journeys, meaningful interactions, persistent application state, realistic data, role-based experiences, functional navigation, and workflows that make sense from beginning to end.

==================================================
1. PRODUCT VISION
==================================================

Travalastic is an intelligent travel operating ecosystem.

The traveler should be able to:

DISCOVER
→ SEARCH
→ PLAN
→ PERSONALIZE
→ BOOK
→ PAY
→ PREPARE
→ TRAVEL
→ RECEIVE LIVE UPDATES
→ GET SUPPORT
→ COMPLETE THE JOURNEY
→ RETURN / REBOOK

Behind the traveler experience, Travalastic also operates:

• Supplier ecosystem
• Partner management
• Corporate travel
• Booking operations
• Journey operations
• Payments
• Finance
• CRM
• Communication
• Risk & safety
• Fraud
• Security
• Compliance
• AI intelligence
• Predictive intelligence
• Automation
• Analytics
• APIs and integrations
• Multi-market capabilities

The final product should feel like one connected operating system, not separate products.

==================================================
2. CORE PRODUCT PRINCIPLE
==================================================

Every important object should be connected.

Traveler
↓
Journey
↓
Booking
↓
Payment
↓
Supplier
↓
Destination
↓
Services
↓
Risk
↓
Support
↓
Communication
↓
Analytics

A change in one object should be capable of affecting related objects.

Example:

If a flight is delayed:

Flight status changes
↓
Journey updates
↓
Traveler is identified
↓
Connected transfer is checked
↓
Hotel check-in impact is evaluated
↓
Traveler notification is generated
↓
Operations team sees the affected journey
↓
Support can intervene

Do NOT merely show a "flight delayed" toast.

The application should demonstrate the relationship between systems.

==================================================
3. USER TYPES
==================================================

Build the architecture around these primary roles:

A. TRAVELER
B. CORPORATE TRAVEL MANAGER
C. TRAVEL PARTNER / SUPPLIER
D. TRAVALASTIC OPERATIONS USER
E. ADMINISTRATOR

Each role should have a meaningful experience and permissions.

Do not show every role the same dashboard with different labels.

==================================================
4. TRAVELER EXPERIENCE
==================================================

The traveler-facing product must include:

HOME
EXPLORE
SEARCH
DESTINATIONS
FLIGHTS
HOTELS
ACTIVITIES
PACKAGES
AI TRIP PLANNER
WISHLIST
MY TRIPS
BOOKINGS
PAYMENTS
TRAVEL DOCUMENTS
NOTIFICATIONS
SUPPORT
PROFILE

The traveler should be able to navigate naturally between these areas.

==================================================
5. HOMEPAGE
==================================================

Create a premium travel product homepage.

Primary message:

"Your entire journey.
One intelligent travel platform."

Hero search should support:

Destination
Dates
Travelers
Travel type

Primary actions:

Search
Explore
Plan with AI

Also provide discovery content, trending destinations, curated experiences, and personalized recommendations.

The homepage must feel like a real travel product, not a generic marketing template.

==================================================
6. SEARCH EXPERIENCE
==================================================

Build real application-style search flows.

Support:

Flights
Hotels
Activities
Packages
Transfers where appropriate

Search should have:

• Filters
• Sorting
• Availability states
• Pricing
• Details
• Selection
• Comparison where appropriate
• Loading states
• Empty states
• Error states

Results should come from structured application data.

Do NOT use random hardcoded UI cards that have no relationship to the next screen.

Selecting a result must affect the subsequent booking flow.

==================================================
7. DESTINATION EXPERIENCE
==================================================

Each destination should have a meaningful destination page.

Include:

• Overview
• Best time to visit
• Travel style
• Budget guidance
• Popular experiences
• Hotels
• Flights
• Activities
• Packages
• Transfers
• Recommendations
• Trip planning CTA

Users must be able to move from:

Destination
→ Plan Trip
→ Search
→ Select services
→ Build journey

==================================================
8. AI TRIP PLANNER
==================================================

This is one of the flagship features.

Allow the user to specify:

Destination
Dates
Travelers
Budget
Travel style
Interests
Constraints
Free-form trip description

Example:

"We want a relaxed honeymoon with great food, scenic experiences and minimal travel between cities."

Generate a structured itinerary.

The itinerary should contain:

• Days
• Locations
• Activities
• Accommodation suggestions
• Transportation suggestions
• Estimated costs
• Timing
• Notes

The generated itinerary must be editable.

Users should be able to:

Add
Remove
Reorder
Modify
Save
Share
Book

The planner should connect to the booking system.

==================================================
9. JOURNEY WORKSPACE
==================================================

Create a central "My Journey" experience.

A journey should contain:

• Destination
• Dates
• Travelers
• Flights
• Hotels
• Activities
• Transfers
• Payments
• Documents
• Timeline
• Notifications
• Support
• Risks / disruptions

Journey states:

DISCOVERING
PLANNING
BOOKED
PRE-TRAVEL
IN-TRAVEL
COMPLETED
POST-TRAVEL

The journey state should update based on application events.

==================================================
10. BOOKING FLOW
==================================================

Build a believable booking flow.

Example:

SEARCH
→ RESULT
→ SELECT
→ DETAILS
→ ADD-ONS
→ REVIEW
→ PAYMENT
→ CONFIRMATION

Support realistic:

• Traveler information
• Pricing breakdown
• Taxes / fees
• Add-ons
• Cancellation information
• Payment status
• Booking status

After booking:

The booking MUST appear inside My Trips.

Do not create a confirmation page that is disconnected from the rest of the application.

==================================================
11. CHECKOUT
==================================================

Create a multi-step checkout.

Steps:

1. Selection
2. Traveler details
3. Add-ons
4. Review
5. Payment
6. Confirmation

Show:

Subtotal
Taxes
Fees
Discounts
Final amount

Payment states:

Pending
Processing
Successful
Failed
Refunded

These states should influence the application.

==================================================
12. LIVE JOURNEY EXPERIENCE
==================================================

When the traveler is actively traveling, the interface should change.

Show:

Current location
Today's itinerary
Upcoming activity
Next transport
Hotel
Important notifications
Travel documents
Support

Example:

"Your Tokyo day starts in 2h 15m."

The system should prioritize immediate journey context rather than selling products.

==================================================
13. DISRUPTION SIMULATION
==================================================

This is extremely important for stakeholder demonstrations.

Create a demonstrable disruption workflow.

Example:

Flight delayed 45 minutes.

System should:

1. Update flight status
2. Identify affected journey
3. Identify affected traveler
4. Check connected transfer
5. Check hotel impact
6. Create operational alert
7. Notify traveler
8. Display recommended action
9. Allow operations/support to intervene

This should visibly demonstrate that Travalastic is an operating platform rather than a collection of screens.

==================================================
14. SUPPORT
==================================================

Support must be context-aware.

Do not make users repeatedly enter booking information.

Support should know:

Current traveler
Current journey
Current booking
Current destination
Relevant disruptions
Previous support cases

Support categories:

• Booking issue
• Flight issue
• Hotel issue
• Change booking
• Refund
• Travel document
• Safety assistance
• Emergency assistance

==================================================
15. PARTNER PORTAL
==================================================

Create a dedicated supplier/partner experience.

Modules:

Dashboard
Inventory
Products
Availability
Pricing
Bookings
Traveler information
Payouts
Performance
Incidents
Risk
Integrations

Partner dashboard should contain realistic metrics and actionable items.

Example:

Bookings
Revenue
Pending actions
Inventory alerts
Customer rating
Fulfillment rate

==================================================
16. CORPORATE TRAVEL
==================================================

Create a corporate travel experience.

Modules:

Corporate dashboard
Travelers
Travel policies
Bookings
Approvals
Expenses
Reports
Analytics

Example:

Active travelers
Upcoming trips
Pending approvals
Travel spend
Policy compliance

Corporate workflows must actually connect to bookings and traveler records.

==================================================
17. INTERNAL TRAVALASTIC OPERATIONS
==================================================

Create an internal operating system.

Primary navigation:

COMMAND CENTER

JOURNEYS
• Bookings
• Journey Control Tower
• Traveler Support

COMMERCE
• Inventory
• Suppliers
• Payments
• Finance

INTELLIGENCE
• AI Intelligence
• Demand Forecasting
• Analytics

TRUST
• Risk & Safety
• Fraud
• Security
• Compliance

GROWTH
• CRM
• Marketing
• Loyalty

PLATFORM
• Integrations
• APIs
• Developer Platform

ADMIN
• Users
• Roles
• Configuration
• Audit Logs

==================================================
18. JOURNEY CONTROL TOWER
==================================================

Create an operational command center.

Show:

Critical journeys
At-risk journeys
Normal journeys
Completed journeys

Allow operators to open a journey and see:

Traveler
Current location
Bookings
Services
Risks
Communications
Payments
Support cases
Timeline

This must be a functional drill-down experience.

==================================================
19. SUPPLIER INTELLIGENCE
==================================================

Suppliers should have:

Verification status
Operational performance
Quality score
Complaint rate
Incident rate
Financial status
Risk level

Allow operators to:

Review
Monitor
Restrict
Suspend

Do not make these merely decorative buttons.

==================================================
20. RISK & SAFETY
==================================================

Create a Trust & Safety area.

Include:

Destination alerts
Traveler risk
Supplier risk
Fraud cases
Security events
Emergency incidents
Compliance issues

Create incident states:

Detected
Triaged
Investigating
Contained
Resolved
Closed

Risk events should be connected to affected travelers, journeys, bookings and suppliers.

==================================================
21. FINANCE
==================================================

Create meaningful finance workflows.

Include:

Revenue
Expenses
Payments
Refunds
Supplier payouts
Transactions
Financial reports
Forecasting

Financial records should be related to actual application transactions.

==================================================
22. AI INTELLIGENCE
==================================================

AI should be a platform layer, not only a chatbot.

Use it for:

• Trip planning
• Recommendations
• Search assistance
• Support assistance
• Operational summaries
• Demand forecasting
• Supplier insights
• Risk prioritization
• Business intelligence

Whenever AI recommends something, distinguish between:

AI RECOMMENDATION

and

AUTHORIZED ACTION

High-impact actions must require confirmation.

==================================================
23. PREDICTIVE INTELLIGENCE
==================================================

Create demand intelligence.

Show:

Destination demand
Booking trends
Seasonality
Booking window
Capacity
Forecast
Confidence

Example:

"Demand for Goa is trending 18% above forecast."

Allow operators to inspect the underlying signals.

==================================================
24. AUTOMATION
==================================================

Create automation workflows.

Examples:

Booking confirmation
Payment reminder
Supplier notification
Traveler alert
Document reminder
Operational escalation

Automation must have:

Trigger
Condition
Action
Result
Failure state

Provide monitoring:

Executed
Successful
Failed
Escalated
Human override

==================================================
25. DATA MODEL
==================================================

Do not create isolated mock data for every page.

Create shared application entities such as:

User
Traveler
CorporateAccount
Partner
Supplier
Destination
Product
Inventory
Search
Journey
Itinerary
Booking
BookingItem
Payment
Refund
Transaction
Notification
SupportCase
Incident
RiskEvent
TravelDocument
Recommendation
AIInsight
Forecast
Automation
AuditLog

Relationships must exist between these entities.

==================================================
26. APPLICATION STATE
==================================================

Maintain meaningful application state.

For example:

When a user books a hotel:

• Booking is created
• Payment changes
• Journey updates
• My Trips updates
• Confirmation appears
• Notifications update
• Operations can see the booking

Do NOT simulate each page independently.

==================================================
27. DESIGN SYSTEM
==================================================

The product must feel:

Premium
Modern
Trustworthy
Intelligent
Travel-focused
Enterprise-grade

Use:

• Clean typography
• Strong spacing
• Sophisticated cards
• Subtle depth
• Refined interactions
• Consistent components
• Responsive layouts
• Clear hierarchy

Avoid:

• Generic SaaS templates
• Excessive gradients
• Random glassmorphism
• Overcrowded dashboards
• Giant meaningless statistics
• Decorative UI with no purpose
• Stock-template aesthetics

The product should feel closer to the quality level of a serious global travel technology company.

==================================================
28. RESPONSIVE DESIGN
==================================================

Everything must work across:

Desktop
Laptop
Tablet
Mobile

Do not simply shrink desktop screens.

Navigation, cards, tables, forms, booking flows and dashboards must adapt appropriately.

==================================================
29. LOADING / EMPTY / ERROR STATES
==================================================

Every meaningful data-driven interface must have:

Loading
Success
Empty
Error
Unavailable
Permission denied

states.

Do not leave blank white screens.

==================================================
30. DEMO MODE
==================================================

Create a realistic demonstration environment.

Seed the application with believable sample data:

Travelers
Trips
Bookings
Flights
Hotels
Activities
Partners
Suppliers
Incidents
Payments
Corporate accounts
Analytics

The data should be internally consistent.

For example, if a traveler has a Japan trip:

The journey should contain bookings,
the bookings should have suppliers,
the payments should correspond to the bookings,
the journey should have dates,
and operations should see the same journey.

==================================================
31. IMPORTANT: REAL-TIME BEHAVIOR
==================================================

I want the product to FEEL real-time.

Implement simulated live behavior where real external integrations are not available.

Examples:

Flight status changes
Booking updates
Inventory changes
Notifications
Operational alerts
Risk events
Dashboard metric changes

Use controlled simulated events rather than fake random animations.

The system should explain or display what changed.

==================================================
32. EXTERNAL INTEGRATIONS
==================================================

Where real APIs are available and appropriate, structure the application so they can be connected.

Where APIs are unavailable:

DO NOT pretend that fake data is live production data.

Use a clear demo/simulation layer.

Architecture should allow future integrations without rewriting the UI.

==================================================
33. ROLE-BASED ACCESS
==================================================

Implement role-aware navigation and permissions.

A traveler should not see:

Finance administration
Supplier risk controls
Internal security tools

A supplier should not see:

Other suppliers
Internal financial data
Internal traveler intelligence

An operations user should have broader access.

An administrator should control platform configuration.

==================================================
34. AUDITABILITY
==================================================

Important actions should create audit events.

Examples:

Booking created
Payment changed
Refund approved
Supplier restricted
Traveler data accessed
Incident escalated
Role changed

Create an Audit Log interface for administrators.

==================================================
35. ARCHITECTURE RULES
==================================================

Keep the codebase modular.

Separate:

Components
Screens
Services
Data models
State
Navigation
Utilities
Design system
Mock/demo data
Integration adapters

Do not put the entire application into one file.

Do not duplicate components unnecessarily.

Create reusable components.

==================================================
36. CRITICAL DEVELOPMENT RULE
==================================================

DO NOT attempt to implement all functionality in one giant change.

Work incrementally.

First inspect the existing project.

Understand:

• Existing architecture
• Existing screens
• Existing components
• Existing routes
• Existing state
• Existing styling
• Existing dependencies

DO NOT delete working functionality simply to replace it with your preferred architecture.

Reuse and improve existing work where appropriate.

==================================================
37. IMPLEMENTATION PRIORITY
==================================================

Build in this order:

PHASE 1
Foundation
• Routing
• Layout
• Design system
• Authentication
• Roles
• Shared state
• Data models

PHASE 2
Traveler
• Home
• Explore
• Search
• Destination
• AI Planner
• Journey
• Booking
• Checkout
• My Trips
• Support

PHASE 3
Partner
• Partner onboarding
• Dashboard
• Inventory
• Bookings
• Payouts
• Performance

PHASE 4
Corporate
• Dashboard
• Travelers
• Policies
• Approvals
• Expenses
• Reports

PHASE 5
Operations
• Command Center
• Journey Control Tower
• Booking Operations
• Supplier Management
• Support

PHASE 6
Trust & Intelligence
• Risk
• Fraud
• Security
• Compliance
• AI
• Forecasting
• Automation

PHASE 7
Platform
• APIs
• Integrations
• Developer portal
• Ecosystem
• Globalization

==================================================
38. STAKEHOLDER DEMONSTRATION REQUIREMENT
==================================================

The final demo should allow me to demonstrate this sequence:

1. Open Travalastic
2. Search a destination
3. Explore destination
4. Use AI Trip Planner
5. Generate itinerary
6. Edit itinerary
7. Select hotel/flight/activity
8. Book
9. Complete payment
10. See booking inside My Trips
11. Open journey
12. Simulate a travel disruption
13. See traveler notification
14. See operational impact
15. Open Journey Control Tower
16. Open affected traveler
17. Inspect booking / supplier / risk
18. Resolve the issue
19. Return to traveler
20. Continue journey

Then demonstrate:

Traveler → Partner → Corporate → Operations

The transitions should feel like different roles within the same ecosystem.

==================================================
39. QUALITY BAR
==================================================

Before considering any feature complete, verify:

• Does it work?
• Does it connect to the rest of the application?
• Does the state persist?
• Does the next workflow make sense?
• Does the role have permission?
• Does the UI handle loading/error/empty states?
• Does the feature use shared data?
• Does the feature look production-quality?
• Can I demonstrate it to a stakeholder without explaining why the screen is fake?

If the answer is no, improve it.

==================================================
40. FINAL PRODUCT DEFINITION
==================================================

Travalastic should ultimately feel like:

A premium travel marketplace
+
An intelligent trip planner
+
A journey management platform
+
A corporate travel platform
+
A supplier ecosystem
+
A travel operations command center
+
A risk and safety platform
+
An AI intelligence layer
+
An automation platform
+
An enterprise travel operating system

All connected through one coherent product architecture.

DO NOT build a "travel website."

BUILD TRAVALASTIC.