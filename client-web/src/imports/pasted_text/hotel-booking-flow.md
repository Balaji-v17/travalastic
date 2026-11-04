Next should be the **Hotel Booking Flow**, and this time we should deliberately make it feel nothing like the flight flow.

Use this MCP prompt:

> **Now overhaul and QA the Hotel Booking Flow as a dedicated hotel-reservation experience. Do not reuse the Flight Booking Flow structure or fields.**
>
> The goal is to make hotel booking feel like a premium, trustworthy OTA/hotel reservation experience.
>
> ### FLOW
>
> **Hotel & Room Selection → Guest Details → Preferences → Review → Payment → Confirmation**
>
> ---
>
> ### 1. HOTEL CONTEXT HEADER
>
> Always keep the selected hotel visible:
>
> **Park Hyatt Tokyo**
>
> Tokyo, Japan
> ⭐ 4.8 · Luxury
> 📍 Shinjuku
>
> Show:
>
> * Check-in
> * Check-out
> * Nights
> * Rooms
> * Guests
>
> Do not show flight-specific concepts such as:
>
> * Seat
> * Cabin
> * Baggage
> * Flight number
> * Airline
> * Boarding
>
> ---
>
> ### 2. ROOM SELECTION — MAKE THIS THE CORE EXPERIENCE
>
> This must be the strongest part of the hotel booking flow.
>
> Display multiple room types with:
>
> * Room photography
> * Room name
> * Bed configuration
> * Occupancy
> * Room size
> * View
> * Amenities
> * Breakfast inclusion
> * Cancellation policy
> * Payment policy
> * Taxes/fees
> * Total price
>
> Example:
>
> **Deluxe King Room**
>
> 1 King Bed · 2 Guests · 42 m²
> City View
> ✓ Breakfast included
> ✓ Free cancellation until 14 Mar
>
> **₹38,400 total**
>
> `Select Room`
>
> Make the cancellation policy highly visible before selection.
>
> ---
>
> ### 3. RATE PLAN DIFFERENTIATION
>
> A single room can have multiple rates.
>
> Support:
>
> **Room Only**
>
> **Breakfast Included**
>
> **Free Cancellation**
>
> **Non-refundable**
>
> Clearly communicate why one rate costs more than another.
>
> Never hide important restrictions behind tiny text.
>
> ---
>
> ### 4. GUEST DETAILS
>
> Build a hotel-specific guest form:
>
> * Lead guest
> * Additional guests
> * Existing travelers from Profile
> * Guest names
> * Contact information
> * Special requests
>
> Do NOT ask for:
>
> * Flight seat
> * Passport information unless genuinely required
> * Airline information
> * Baggage
> * Meal selection
>
> ---
>
> ### 5. HOTEL PREFERENCES
>
> Create meaningful hotel preferences:
>
> **Room preferences**
>
> * High floor
> * Low floor
> * Quiet room
> * Near elevator
> * Away from elevator
>
> **Bed preference**
>
> * King
> * Twin
> * No preference
>
> **Arrival**
>
> * Estimated arrival time
> * Late arrival
>
> **Special requests**
>
> Free-text field.
>
> Clearly state that preferences are requests and are subject to hotel availability.
>
> ---
>
> ### 6. REVIEW
>
> Create a proper hotel reservation summary:
>
> **Hotel**
>
> Park Hyatt Tokyo
>
> **Stay**
>
> 15 Mar → 22 Mar
> 7 nights
>
> **Room**
>
> Deluxe King · 1 room
>
> **Guests**
>
> 2 adults
>
> **Rate**
>
> Breakfast included
> Free cancellation
>
> **Preferences**
>
> High floor
>
> ---
>
> ### 7. PRICE BREAKDOWN
>
> Make hotel pricing transparent:
>
> Room × 7 nights
>
> Taxes
>
> Service fees
>
> Resort/city taxes where applicable
>
> Discounts
>
> **Total**
>
> ₹XX,XXX
>
> Clearly distinguish:
>
> **Pay now**
>
> vs
>
> **Pay at property**
>
> if the selected rate supports it.
>
> ---
>
> ### 8. CANCELLATION POLICY
>
> This should be visible on the review screen, not buried.
>
> Example:
>
> **Free cancellation until 14 Mar**
>
> Cancel before the deadline → ₹0 cancellation fee
>
> After deadline → 1 night's charge
>
> Make the policy understandable to a normal traveler.
>
> ---
>
> ### 9. PAYMENT
>
> Support:
>
> * Saved cards
> * New card
> * UPI
> * Net banking
>
> Show:
>
> **Pay ₹XX,XXX**
>
> or:
>
> **Reserve — Pay at Property**
>
> depending on the rate.
>
> Do not create the booking until payment/reservation succeeds.
>
> Include:
>
> * Processing state
> * Failure state
> * Retry
> * Payment success
>
> ---
>
> ### 10. CONFIRMATION
>
> Make the confirmation feel like a hotel reservation.
>
> **Your stay is confirmed. 🏨**
>
> Show:
>
> * Hotel
> * Address
> * Check-in
> * Check-out
> * Nights
> * Room
> * Guests
> * Rate plan
> * Cancellation policy
> * Confirmation number
> * Amount paid
>
> Actions:
>
> **View Booking**
>
> **Get Directions**
>
> **Contact Hotel**
>
> **View Journey**
>
> **View All Bookings**
>
> If originated from Journey:
>
> **Added to Tokyo Spring Escape**
>
> ---
>
> ### 11. JOURNEY INTEGRATION
>
> Preserve:
>
> `journeyId`
>
> `itineraryItemId`
>
> `source`
>
> `itemId`
>
> If booking originated from a Journey:
>
> 1. Create hotel booking
> 2. Attach it to the exact journey
> 3. Mark the exact itinerary item as BOOKED
> 4. Update journey progress
> 5. Return to that exact journey
>
> Never use:
>
> `journeys[0]`
>
> as a fallback.
>
> ---
>
> ### 12. STANDALONE HOTEL BOOKING
>
> If entered through:
>
> **Hotels → Search → Hotel → Book**
>
> the booking must remain standalone.
>
> It should appear under:
>
> **Bookings → Hotels**
>
> without attaching itself to an arbitrary journey.
>
> ---
>
> ### 13. VISUAL DIRECTION
>
> Do NOT copy the Flight Booking layout.
>
> Hotel booking should feel:
>
> **editorial + hospitality + premium**
>
> rather than airline/checkout-heavy.
>
> Use:
>
> * large room photography
> * clear rate comparison
> * strong cancellation-policy hierarchy
> * comfortable whitespace
> * elegant typography
> * sticky booking summary on desktop
> * responsive bottom summary on mobile
>
> Avoid:
>
> * excessive cards
> * generic numbered forms
> * unnecessary gradients
> * irrelevant badges
> * flight terminology
>
> ---
>
> ### 14. FINAL QA
>
> Test:
>
> **Hotels → Search → Hotel Detail → Select Room → Guest → Preferences → Review → Payment → Confirmation**
>
> and:
>
> **Journey → Hotel itinerary item → Hotel Booking → Confirmation → Journey**
>
> Verify:
>
> * correct hotel
> * correct room
> * correct rate plan
> * correct dates
> * correct guests
> * cancellation policy preserved
> * room price affects total
> * payment amount matches review
> * booking created only after successful payment
> * exact itinerary item becomes BOOKED
> * exact journey is updated
> * standalone bookings remain standalone
>
> Run TypeScript validation and resolve all runtime errors before finishing.
>
> **Do not modify the Flight Booking Flow except shared booking infrastructure compatibility.**

### After Hotel

Then we'll do **Experience Booking Flow** separately:

**Experience → Date → Time Slot → Participants → Traveler Details → Review → Payment → Confirmation**

That one should feel much more like an **activity/ticket reservation**, not a hotel or flight checkout.

After all three are solid, we'll do one final **Bookings Center + Journey Management UX pass** so the user has a crystal-clear answer to:

> **“What have I booked?”** → Bookings
> **“What am I doing on my trip?”** → Journey
> **“What still needs booking?”** → Journey
> **“Where are all my reservations?”** → Bookings.
