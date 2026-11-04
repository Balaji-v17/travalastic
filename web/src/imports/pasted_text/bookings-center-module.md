Next is the **Bookings Center**. This is important because it becomes the user's single source of truth for everything they've actually reserved.

Give the MCP this prompt:

> **Now build/overhaul the Travalastic Bookings Center into a proper consumer reservation management module.**
>
> This is NOT another search page and NOT another dashboard.
>
> The user's mental model should be:
>
> **“Everything I have booked is here.”**
>
> ---
>
> ## 1. INFORMATION ARCHITECTURE
>
> Make **Bookings** a first-class destination in the main navigation.
>
> The page should clearly separate:
>
> **All**
>
> **Flights**
>
> **Hotels**
>
> **Experiences**
>
> **Transfers**
>
> **Trains**
>
> **Buses**
>
> **Camps**
>
> **Insurance**
>
> **Visa**
>
> Do not make the user go through Journey just to find a reservation.
>
> ---
>
> ## 2. BOOKINGS HERO
>
> Create a useful header:
>
> **My Bookings**
>
> `Everything you've reserved, in one place.`
>
> Show compact summary:
>
> **8**
> Total bookings
>
> **3**
> Upcoming
>
> **2**
> Completed
>
> **1**
> Needs attention
>
> Avoid turning this into a giant KPI dashboard.
>
> ---
>
> ## 3. UPCOMING BOOKING
>
> Make the next upcoming reservation visually dominant.
>
> Example:
>
> **Tokyo Spring Escape**
>
> ✈️ Mumbai → Tokyo
> 15 Mar · 11:20 PM
>
> **Confirmed**
>
> Then show:
>
> **Flight**
> IndiGo · 6E123
>
> **Hotel**
> Park Hyatt Tokyo · 15–22 Mar
>
> **Experience**
> Tsukiji Food Tour · 18 Mar
>
> CTA:
>
> **Open Journey**
>
> ---
>
> ## 4. BOOKING LIST
>
> Create a clean chronological reservation list.
>
> Each booking should immediately communicate:
>
> **What**
>
> **When**
>
> **Where**
>
> **Status**
>
> **Amount**
>
> **Booking reference**
>
> Example:
>
> ### ✈️ IndiGo 6E123
>
> Mumbai → Tokyo
>
> 15 Mar 2027 · 11:20 PM
>
> **Confirmed**
>
> PNR: ABC123
>
> ₹42,800
>
> `View Booking`
>
> ---
>
> ## 5. DOMAIN-SPECIFIC BOOKING CARDS
>
> Do NOT render every booking with the same generic card.
>
> ### Flight
>
> Show:
>
> Origin → Destination
>
> Departure / arrival
>
> Airline
>
> Flight number
>
> Cabin
>
> Seat
>
> PNR
>
> Status
>
> ### Hotel
>
> Show:
>
> Hotel
>
> Check-in → Check-out
>
> Room
>
> Guests
>
> Rate plan
>
> Cancellation status
>
> Confirmation number
>
> ### Experience
>
> Show:
>
> Experience
>
> Date
>
> Time
>
> Participants
>
> Meeting point
>
> Confirmation number
>
> ### Transfer
>
> Pickup → Drop-off
>
> Date/time
>
> Vehicle
>
> Driver status where available
>
> ### Visa
>
> Application country
>
> Application ID
>
> Current stage
>
> Documents pending
>
> Estimated decision
>
> ---
>
> ## 6. FILTERING
>
> Provide:
>
> **All**
>
> **Upcoming**
>
> **Completed**
>
> **Cancelled**
>
> **Needs attention**
>
> Then service filters:
>
> Flights / Hotels / Experiences / etc.
>
> Filters should update the displayed count and results immediately.
>
> ---
>
> ## 7. SEARCH
>
> Add:
>
> **Search bookings**
>
> Search by:
>
> * Booking reference
> * Destination
> * Hotel
> * Airline
> * Experience
> * Traveler name
>
> ---
>
> ## 8. BOOKING DETAIL
>
> Clicking **View Booking** must open a proper Booking Detail page/modal.
>
> It should contain:
>
> ### Overview
>
> Booking status
>
> Reference number
>
> Amount
>
> Date booked
>
> ### Details
>
> Domain-specific information.
>
> ### Travelers
>
> Who is traveling.
>
> ### Documents
>
> Tickets
>
> Vouchers
>
> Receipts
>
> ### Payment
>
> Amount
>
> Payment method
>
> Transaction reference
>
> ### Cancellation
>
> Policy
>
> Deadline
>
> Refund estimate where applicable.
>
> ---
>
> ## 9. ACTIONS
>
> Depending on booking type, expose relevant actions:
>
> **Flight**
>
> * View ticket
> * Download ticket
> * Manage seat
> * Manage baggage
> * Cancel
> * Contact support
>
> **Hotel**
>
> * View voucher
> * Get directions
> * Contact hotel
> * Modify dates where supported
> * Cancel
>
> **Experience**
>
> * View voucher
> * Directions
> * Add to calendar
> * Contact host
> * Cancel
>
> Never show irrelevant actions.
>
> ---
>
> ## 10. JOURNEY CONNECTION
>
> This is critical.
>
> A booking may belong to a Journey.
>
> Show:
>
> **Part of Tokyo Spring Escape**
>
> `Open Journey →`
>
> But a standalone booking should show:
>
> **Standalone booking**
>
> and must not invent a Journey.
>
> ---
>
> ## 11. JOURNEY ↔ BOOKINGS RELATIONSHIP
>
> Establish this mental model throughout the application:
>
> **Journey**
> = what I'm planning / doing
>
> **Bookings**
> = what I've actually reserved
>
> **Itinerary**
> = chronological plan
>
> Therefore:
>
> Unbooked itinerary item → exists only in Journey
>
> Booked itinerary item → appears in Journey + Bookings
>
> Standalone booking → appears in Bookings, but not in Journey
>
> ---
>
> ## 12. BOOKING STATUS SYSTEM
>
> Standardize statuses:
>
> **Confirmed**
>
> **Pending**
>
> **Cancelled**
>
> **Completed**
>
> **Needs Attention**
>
> **Refund Processing**
>
> Use consistent visual treatment across all booking types.
>
> ---
>
> ## 13. DOCUMENTS
>
> Add a dedicated:
>
> **Travel Documents**
>
> section inside Bookings.
>
> Aggregate:
>
> * Flight tickets
> * Hotel vouchers
> * Experience vouchers
> * Transfer confirmations
> * Insurance documents
> * Visa documents
> * Payment receipts
>
> Make it possible to quickly find the document needed at the airport/hotel/activity.
>
> ---
>
> ## 14. EMPTY STATE
>
> If the user has no bookings:
>
> **Your journey starts here.**
>
> `You haven't booked anything yet.`
>
> CTAs:
>
> **Find a Flight**
>
> **Find a Hotel**
>
> **Explore Experiences**
>
> **Plan with Journey AI**
>
> ---
>
> ## 15. RESPONSIVE DESIGN
>
> Desktop:
>
> Main booking list + contextual side panel.
>
> Mobile:
>
> Stacked booking cards.
>
> Sticky filter/search controls.
>
> Important booking information must remain above the fold.
>
> ---
>
> ## 16. DATA INTEGRITY
>
> Do not create duplicate booking records.
>
> A booking should have:
>
> `id`
>
> `type`
>
> `status`
>
> `source`
>
> `journeyId?`
>
> `itineraryItemId?`
>
> `bookingReference`
>
> `createdAt`
>
> `totalAmount`
>
> `travelerIds`
>
> `details`
>
> Never attach a standalone booking to `journeys[0]`.
>
> ---
>
> ## 17. FINAL USER FLOWS
>
> Verify all of these:
>
> **Flight**
>
> Flights → Search → Flight → Booking → Confirmation → Bookings
>
> **Hotel**
>
> Hotels → Search → Hotel → Room → Booking → Confirmation → Bookings
>
> **Experience**
>
> Experiences → Search → Experience → Booking → Confirmation → Bookings
>
> **Journey-originated**
>
> Journey → Unbooked Item → Booking → Confirmation → Exact Journey
>
> **Standalone**
>
> Search → Booking → Confirmation → Bookings
>
> ---
>
> ## IMPORTANT DESIGN RULE
>
> Do not make this look like an internal admin dashboard.
>
> It is a **consumer reservation center**.
>
> Think:
>
> **premium travel app + airline manage-booking + hotel reservation manager**
>
> Not:
>
> **CRM / operations dashboard / analytics console.**
>
> Keep the visual language consistent with the new Travalastic homepage but introduce stronger information hierarchy and significantly less generic card stacking.
>
> Finish with a TypeScript check and runtime QA of every flow.
