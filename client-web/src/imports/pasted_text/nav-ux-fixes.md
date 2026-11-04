Exactly. Those are **navigation architecture issues**, not cosmetic issues. We should fix them alongside the Bookings/Visa work.

There are two clear problems:

### 1. Hero navbar contrast

The homepage hero has a transparent/dark navigation treatment, but when the nav gets its white background, the navigation text/icons are still white.

That creates a serious contrast/accessibility failure.

The nav should have **two explicit visual states**:

**At top of homepage / over hero**

* transparent background
* white logo
* white navigation
* white icons
* subtle dark top scrim if needed

**After scroll / on light pages**

* white background
* dark logo
* dark navigation
* dark icons
* subtle border/shadow

Don't solve this by adding random opacity to the text. Make the navbar state-aware.

Also ensure hover, active and keyboard-focus states remain visible in both themes.

---

### 2. Flights / Hotels / Experiences navigation

You're completely right.

If the navigation says:

**Flights**

the user should **never land on:**

> Search
> [Flights] [Hotels] [Experiences]

and then have to choose Flights again.

The navigation itself is an intent.

It should be:

```text
Flights
   ↓
Flight Search
   ↓
Flight Results
   ↓
Flight Details
   ↓
Flight Booking
```

```text
Hotels
   ↓
Hotel Search
   ↓
Hotel Results
   ↓
Hotel Details
   ↓
Hotel Booking
```

```text
Experiences
   ↓
Experience Search
   ↓
Experience Results
   ↓
Experience Details
   ↓
Experience Booking
```

The generic Search page can still exist for:

**Search / Universal Search**

But the dedicated navigation items should set the search context automatically.

---

## I'd give the MCP this combined prompt

> **Continue from the current approved Travalastic consumer website. Do not redesign the homepage again. Perform this as a product UX/navigation/accessibility correction pass while continuing the Bookings Center and Visa Center work.**
>
> ### 1. FIX HOMEPAGE HERO NAVBAR CONTRAST
>
> The homepage hero navigation currently has a critical contrast problem:
>
> * Hero state uses a transparent/dark overlay.
> * Navigation text/icons are white.
> * When the navbar transitions to its white/scrolled state, some navigation elements remain white.
> * This makes the navigation unreadable on the white background.
>
> Implement explicit navbar visual states:
>
> **Hero / transparent state**
>
> * transparent background
> * white logo
> * white navigation text
> * white icons
> * visible hover state
> * visible active state
> * accessible keyboard focus state
>
> **Scrolled / light state**
>
> * white background
> * dark logo
> * dark navigation text
> * dark icons
> * visible hover state
> * visible active state
> * accessible keyboard focus state
> * subtle bottom border/shadow
>
> Do not use low-opacity white text on white backgrounds.
>
> Ensure WCAG-friendly contrast for navigation text, icons, active states and focus indicators.
>
> The navbar must transition between these states based on scroll position without flickering.
>
> Do not break the navbar appearance on other pages where it already works correctly.
>
> ### 2. FIX NAVIGATION INTENT
>
> The main navigation currently has:
>
> **Flights | Hotels | Experiences**
>
> but all three navigate to the same generic Search page where the traveler has to select the same category again.
>
> This is incorrect.
>
> Navigation labels represent explicit user intent and must open the corresponding search experience directly.
>
> #### Flights
>
> Clicking **Flights** must:
>
> * navigate directly to the flight-search experience
> * automatically activate the Flights context
> * show Flight-specific fields:
>   From
>   To
>   Departure
>   Return
>   Travelers
>   Cabin
> * never require the user to select Flights again
>
> Flow:
>
> **Flights → Flight Search → Flight Results → Flight Detail → Flight Booking → Confirmation**
>
> #### Hotels
>
> Clicking **Hotels** must:
>
> * navigate directly to hotel search
> * automatically activate Hotels
> * show:
>   Destination
>   Check-in
>   Check-out
>   Rooms
>   Guests
>
> Flow:
>
> **Hotels → Hotel Search → Hotel Results → Hotel Detail → Hotel Booking → Confirmation**
>
> #### Experiences
>
> Clicking **Experiences** must:
>
> * navigate directly to experience search
> * automatically activate Experiences
> * show:
>   Destination
>   Date
>   Participants
>   Category
>
> Flow:
>
> **Experiences → Experience Search → Experience Results → Experience Detail → Experience Booking → Confirmation**
>
> ### 3. KEEP UNIVERSAL SEARCH
>
> Do not remove the existing generic Search capability.
>
> The generic Search page should remain available through:
>
> **Search**
>
> and can continue to contain:
>
> Flights / Hotels / Experiences
>
> However, this generic selector should only exist for the generic Search entry point.
>
> Dedicated navigation links must bypass the selector.
>
> Implement this through proper search context/state rather than duplicating three separate search systems.
>
> Example:
>
> `SearchQuery.type = 'flight'`
>
> when Flights navigation is clicked.
>
> `SearchQuery.type = 'hotel'`
>
> when Hotels is clicked.
>
> `SearchQuery.type = 'experience'`
>
> when Experiences is clicked.
>
> The SearchPage should read this context on mount and initialize the correct tab automatically.
>
> ### 4. PRESERVE CONTEXT THROUGH THE FLOW
>
> If the traveler enters through:
>
> Flights → search
>
> the application must preserve:
>
> `source = 'search'`
>
> `type = 'flight'`
>
> and relevant search parameters.
>
> Same for hotels and experiences.
>
> Do not lose the selected service type when navigating to results/detail/booking.
>
> ### 5. BOOKINGS CENTER
>
> Continue implementing the dedicated **Bookings** area.
>
> The mental model must be:
>
> **My Trips = journeys**
>
> **Bookings = individual reservations**
>
> **Journey = complete trip command center**
>
> Bookings should aggregate:
>
> * Flights
> * Hotels
> * Experiences
> * Transfers
> * Other bookable services
>
> Each booking must show:
>
> service type
> supplier
> destination
> dates
> status
> booking/reference number
> amount
> relevant primary action
>
> Clicking a flight must never open a hotel or generic booking flow.
>
> Clicking a hotel must never expose flight-specific fields.
>
> ### 6. VISA CENTER
>
> Continue implementing the Visa Center as a real traveler-facing module.
>
> Include:
>
> destination eligibility
> traveler/passport profile
> visa requirement
> estimated processing time
> estimated fee
> document checklist
> application creation
> saved draft
> application timeline
> submitted
> processing
> approved
> rejected / action required
>
> Applications must be associated with the originating journey when started from Journey, Destination or Journey AI.
>
> ### 7. CONTEXT SAFETY
>
> Audit the entire application for unsafe patterns such as:
>
> `journeys[0]`
>
> when determining the active journey.
>
> Never silently fall back to the first journey.
>
> Use the explicit:
>
> `journeyId`
>
> `selectedJourneyId`
>
> `bookingFlow.journeyId`
>
> or equivalent context.
>
> If the requested entity cannot be found, show a proper empty/not-found state.
>
> ### 8. FINAL NAVIGATION AUDIT
>
> Test every main navigation item:
>
> **Explore**
> → Explore
>
> **Journey AI**
> → Journey AI
>
> **Flights**
> → Flight Search
>
> **Hotels**
> → Hotel Search
>
> **Experiences**
> → Experience Search
>
> **Deals**
> → Deals
>
> **My Trips**
> → My Trips
>
> **Bookings**
> → Bookings Center
>
> **Visa**
> → Visa Center
>
> **Profile**
> → Profile
>
> No dedicated navigation item should land on a screen requiring the traveler to make the same selection again.
>
> ### 9. ACCESSIBILITY QA
>
> Verify:
>
> * navbar contrast
> * keyboard navigation
> * visible focus rings
> * hover states
> * active states
> * buttons with readable labels
> * form labels
> * error states
> * disabled states
> * mobile navigation contrast
>
> Do not sacrifice accessibility for the cinematic hero design.
>
> ### 10. IMPORTANT
>
> Do not add random sections, cards or decorative content.
>
> Do not rewrite already-working flows unnecessarily.
>
> Reuse the existing AppContext/navigation architecture.
>
> Fix the underlying navigation/state model rather than patching individual buttons.
>
> Run TypeScript validation and verify there are **zero TypeScript errors and zero runtime `useApp`/context errors** before finishing.

This is the right kind of pass now: **fix the product's underlying mental model while improving the visual system**, rather than continually making individual screens prettier.
