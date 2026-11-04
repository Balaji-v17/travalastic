Next: **Experience Booking Flow**. This should be the third genuinely different booking experience — not another generic checkout.

Give the MCP this:

> **Now overhaul and QA the Experience Booking Flow as a dedicated activity/experience reservation experience.**
>
> Do not copy the Flight or Hotel booking flow. The experience flow must have its own information hierarchy, interaction patterns and booking logic.
>
> ### FLOW
>
> **Experience Overview → Date → Time Slot → Participants → Traveler Details → Review → Payment → Confirmation**
>
> ---
>
> ### 1. EXPERIENCE OVERVIEW
>
> Make the selected experience immediately understandable:
>
> **Tokyo Tsukiji Food Tour**
>
> Tokyo, Japan
> ⭐ 4.9 · 1,240 reviews
>
> Show:
>
> * Hero/gallery imagery
> * Duration
> * Meeting point
> * Language
> * Group size
> * Cancellation policy
> * What's included
> * What's not included
> * Important information
> * Starting price
>
> Add:
>
> **Book this experience**
>
> Do not send the user straight into a generic checkout.
>
> ---
>
> ### 2. DATE SELECTION
>
> Build an experience-specific availability calendar.
>
> Show:
>
> * Available dates
> * Unavailable dates
> * Selected date
> * Price variation
> * Special/peak dates
>
> Example:
>
> **Sat, 21 Mar**
>
> ₹4,500 / person
>
> Avoid a generic date input whenever the experience has actual availability data.
>
> ---
>
> ### 3. TIME SLOT SELECTION
>
> Show real session options:
>
> **09:00 AM**
> Morning Food Walk
> 2h · 8 spots left
>
> **02:00 PM**
> Afternoon Food Walk
> 2h · 5 spots left
>
> **06:00 PM**
> Evening Food Walk
> 2h · 3 spots left
>
> Clearly display:
>
> * Start time
> * End time/duration
> * Availability
> * Price
>
> Selected slot should update the booking summary immediately.
>
> ---
>
> ### 4. PARTICIPANTS
>
> Support participant categories where applicable:
>
> * Adults
> * Children
> * Infants
> * Seniors
>
> Example:
>
> Adults × 2
> Children × 1
>
> Show the price calculation live.
>
> Respect the experience's minimum/maximum participant rules.
>
> ---
>
> ### 5. TRAVELER DETAILS
>
> Ask only information actually required by the experience.
>
> Support existing travelers from Profile.
>
> Include:
>
> * Name
> * Email
> * Phone
> * Participant details where required
>
> If an experience requires:
>
> * dietary information
> * accessibility requirements
> * emergency contact
> * age
>
> show those contextually.
>
> Do not ask for:
>
> * airline
> * flight seat
> * baggage
> * hotel room
>
> unless the specific experience actually requires something related.
>
> ---
>
> ### 6. MEETING POINT
>
> Make meeting logistics extremely clear before payment.
>
> Show:
>
> **Meeting Point**
>
> Tsukiji Outer Market
> Tokyo
>
> Include:
>
> * Address
> * Map preview
> * Meeting instructions
> * Recommended arrival time
> * Contact information where available
>
> If pickup is available, allow the user to select:
>
> **Meeting point**
>
> or:
>
> **Hotel pickup**
>
> with the appropriate price.
>
> ---
>
> ### 7. REVIEW
>
> Build an experience-specific review:
>
> **Experience**
>
> Tokyo Tsukiji Food Tour
>
> **Date**
>
> 21 Mar 2027
>
> **Time**
>
> 06:00 PM
>
> **Participants**
>
> 2 Adults
>
> **Meeting Point**
>
> Tsukiji Outer Market
>
> **Included**
>
> Food tastings
> Local guide
> Water
>
> **Cancellation**
>
> Free cancellation until 24 hours before
>
> Every section should have an **Edit** action.
>
> ---
>
> ### 8. PRICE BREAKDOWN
>
> Calculate dynamically:
>
> Adult price × participants
>
> Child price × participants
>
> Pickup/add-ons
>
> Taxes
>
> Fees
>
> Discounts
>
> **Total**
>
> The review total and payment total must always match.
>
> ---
>
> ### 9. PAYMENT
>
> Support:
>
> * UPI
> * Cards
> * Net banking
> * Saved payment methods
>
> Primary CTA:
>
> **Pay ₹XX,XXX**
>
> Do not create the experience booking before payment succeeds.
>
> Include realistic:
>
> * Processing
> * Success
> * Failure
> * Retry
>
> states.
>
> ---
>
> ### 10. CONFIRMATION
>
> Create a dedicated experience confirmation:
>
> **You're booked! 🎟️**
>
> **Tokyo Tsukiji Food Tour**
>
> Show:
>
> * Confirmation number
> * Date
> * Time
> * Participants
> * Meeting point
> * Duration
> * Cancellation policy
> * Amount paid
>
> Actions:
>
> **View Booking**
>
> **Get Directions**
>
> **Add to Calendar**
>
> **Contact Host**
>
> **View Journey**
>
> **View All Bookings**
>
> If journey-originated:
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
> `itineraryItemId`
> `source`
> `itemId`
>
> If originating from a Journey:
>
> 1. Create the experience booking
> 2. Attach it to the exact Journey
> 3. Mark the exact itinerary item BOOKED
> 4. Update Journey progress
> 5. Return to that exact Journey
>
> Never use:
>
> `journeys[0]`
>
> as a fallback.
>
> ---
>
> ### 12. STANDALONE EXPERIENCE
>
> If entered through:
>
> **Experiences → Search → Experience Detail**
>
> keep it standalone.
>
> It should appear under:
>
> **Bookings → Experiences**
>
> and must not attach itself to an arbitrary journey.
>
> ---
>
> ### 13. VISUAL DIRECTION
>
> This flow should feel like:
>
> **premium travel experience + event ticketing**
>
> rather than hotel booking or airline booking.
>
> Use:
>
> * large experience imagery
> * availability calendar
> * visual time-slot cards
> * participant stepper
> * meeting-point map
> * clear cancellation policy
> * sticky booking summary
>
> Avoid:
>
> * generic form stacks
> * unnecessary cards
> * flight terminology
> * hotel terminology
> * seat maps
> * baggage fields
> * room-selection patterns
>
> ---
>
> ### 14. FINAL QA
>
> Test:
>
> **Experiences → Search → Detail → Date → Time → Participants → Traveler → Review → Payment → Confirmation**
>
> Also test:
>
> **Journey → Experience itinerary item → Booking → Confirmation → Journey**
>
> Verify:
>
> * date changes availability
> * time slot changes availability
> * participants change price
> * pickup/add-ons change price
> * cancellation policy is preserved
> * payment total matches review
> * booking only occurs after successful payment
> * exact itinerary item becomes BOOKED
> * exact Journey updates
> * standalone booking remains standalone
>
> Run TypeScript validation and fix all runtime errors.

**After this, don't immediately redesign another booking flow.** The next logical task should be the **Bookings Center** — one unified place where Flights, Hotels, Experiences, Transfers, Visa applications, etc. can actually be managed. That will solve the larger information-architecture problem you've been pointing out.
