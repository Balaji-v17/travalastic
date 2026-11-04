Yes — **that should be the next major task.** The navigation/accessibility fixes can be done alongside it, but the **Flight Booking Flow deserves a dedicated overhaul**.

The current flow needs to feel like a real airline/OTA booking experience, not a generic multi-step form.

### Flight Booking Flow we should build

**1. Flight Summary**

* Route: Mumbai → Tokyo
* Date + duration
* Airline + flight number
* Cabin
* Fare type
* Baggage included
* Refund/change conditions
* Fare breakdown

**2. Traveler Details**

* Lead traveler
* Other travelers
* Passport details
* Date of birth
* Gender where required
* Nationality
* Contact information
* Auto-fill from Profile/Travelers

**3. Seat Selection**

* Actual aircraft-style seat map
* Available / occupied / selected
* Window / middle / aisle
* Extra-legroom
* Paid vs included seats
* Per-seat pricing
* Skip option where allowed

**4. Baggage**

* Included baggage clearly shown
* Cabin baggage
* Checked baggage
* Add extra baggage
* Per-piece pricing
* Different allowance for each flight segment

**5. Meals & Add-ons**

* Meal preference
* Vegetarian / non-vegetarian / special meal
* Meal pricing
* Priority boarding
* Lounge
* Other airline add-ons

**6. Review**
A proper final booking summary:

```text
Mumbai → Tokyo
15 Mar 2027

IndiGo
6E 123
Economy

Traveler
Lokesh Kumar

Seat
12A · Window

Baggage
1 × 20kg

Meal
Vegetarian

────────────────
Base Fare       ₹32,000
Taxes           ₹4,850
Seat            ₹1,200
Baggage         ₹1,800
Meal              ₹450
────────────────
Total           ₹40,300
```

Then:

**Continue to Payment →**

**7. Payment**

* Saved payment methods
* UPI
* Cards
* Net banking
* Wallet
* Secure payment state
* Processing state
* Failure/retry state

**8. Confirmation**
Not just "Booking Successful."

Show:

> **You're going to Tokyo. ✈️**

Then:

* PNR
* Flight details
* Traveler
* Seat
* Baggage
* Payment receipt
* Download ticket
* Add to calendar
* View booking
* **Return to Journey**
* View all bookings

And if it originated from a Journey:

**"Added to Tokyo Spring Escape"**

---

### Most important architectural rule

The flow needs to understand:

```text
Flight Booking
      ↓
bookingFlow
      ├── type: flight
      ├── itemId
      ├── journeyId
      ├── itineraryItemId
      └── source
             ↓
        Confirmation
             ↓
       Update Booking
             ↓
     Update Itinerary
             ↓
       Return Journey
```

So if someone books a flight **from a Journey**, the booking immediately becomes part of that Journey.

If they book independently from **Flights**, it goes into **Bookings**, without magically attaching itself to a journey.

That distinction is crucial.

---

## MCP prompt for the Flight Booking overhaul

> **Now perform a complete UX and functional overhaul of the Flight Booking Flow only.**
>
> Do not treat this as a visual refresh. Rebuild the traveler experience so it feels comparable to a serious modern flight-booking portal.
>
> The current flow feels generic and does not communicate flight-booking context strongly enough.
>
> Use the existing Travalastic architecture, AppContext and mock data. Do not create a disconnected booking system.
>
> ### REQUIRED FLOW
>
> **Flight Summary → Traveler Details → Seat Selection → Baggage → Meals & Add-ons → Review → Payment → Confirmation**
>
> ### 1. FLIGHT SUMMARY
>
> Create a strong flight-specific summary header showing:
>
> * Origin
> * Destination
> * Departure date
> * Return date if applicable
> * Airline
> * Flight number
> * Departure/arrival times
> * Duration
> * Stops
> * Cabin class
> * Fare type
> * Included baggage
> * Refund/change conditions
>
> Make the route visually prominent.
>
> Include a compact persistent booking summary/sidebar showing the running total.
>
> ### 2. TRAVELER DETAILS
>
> Build proper traveler forms:
>
> * First name
> * Last name
> * Date of birth
> * Gender where applicable
> * Nationality
> * Passport number
> * Passport expiry
> * Passport issuing country
> * Email
> * Phone
>
> Support multiple travelers.
>
> Allow selecting existing travelers from Profile to auto-fill details.
>
> Clearly distinguish:
>
> **Lead Traveler**
>
> from:
>
> **Additional Travelers**
>
> Validate required fields before continuing.
>
> ### 3. SEAT SELECTION
>
> Replace any generic selector with a visual aircraft seat map.
>
> Show:
>
> * Available
> * Selected
> * Occupied
> * Window
> * Middle
> * Aisle
> * Extra-legroom
> * Paid seats
> * Included seats
>
> Display the selected seat and its price.
>
> Allow skipping seat selection if the fare permits it.
>
> Support separate seat selection for each traveler and flight segment where applicable.
>
> ### 4. BAGGAGE
>
> Clearly distinguish:
>
> **Included**
>
> and:
>
> **Additional baggage**
>
> Show cabin and checked baggage allowances.
>
> Allow travelers to add additional baggage.
>
> Display:
>
> allowance
> selected amount
> additional cost
>
> Do not show baggage options that don't make sense for the selected flight/fare.
>
> ### 5. MEALS & ADD-ONS
>
> Add flight-specific extras:
>
> * Standard meal
> * Vegetarian
> * Non-vegetarian
> * Special meal
> * Priority boarding
> * Lounge where applicable
>
> Clearly show included vs paid options.
>
> Do not show hotel fields, hotel preferences or unrelated booking fields.
>
> ### 6. REVIEW
>
> Build a professional airline-style review screen.
>
> Sections:
>
> **Flight**
> **Travelers**
> **Seats**
> **Baggage**
> **Meals & Add-ons**
> **Fare Rules**
> **Price Breakdown**
>
> Show:
>
> Base fare
> Taxes
> Seat fees
> Baggage
> Meals
> Add-ons
> Total
>
> Include an explicit cancellation/change policy summary.
>
> Add:
>
> **Edit** actions beside each section.
>
> ### 7. PAYMENT
>
> Build a proper payment step:
>
> * Saved cards
> * New card
> * UPI
> * Net banking
> * Wallet
>
> Show the final amount prominently.
>
> Include:
>
> **Secure payment**
>
> and appropriate processing/loading/error states.
>
> Never create a booking until payment succeeds.
>
> ### 8. CONFIRMATION
>
> Create a premium confirmation experience.
>
> Show:
>
> * Booking confirmed
> * PNR
> * Airline
> * Flight number
> * Route
> * Date/time
> * Travelers
> * Seats
> * Baggage
> * Meals
> * Total paid
>
> Actions:
>
> **View Booking**
> **Download Ticket**
> **Add to Calendar**
> **View Journey**
> **View All Bookings**
>
> If the booking originated from a Journey, explicitly show:
>
> **Added to [Journey Name]**
>
> and return to that exact Journey when the user chooses to continue.
>
> ### 9. JOURNEY CONTEXT
>
> Preserve:
>
> `journeyId`
> `itineraryItemId`
> `source`
> `itemId`
>
> throughout the entire flow.
>
> If:
>
> `source === 'journey'`
>
> then confirmation must:
>
> 1. Create the booking
> 2. Attach it to the correct journey
> 3. Mark the correct itinerary item as BOOKED
> 4. Recalculate journey booking/planning progress
> 5. Return to that exact journey
>
> Never use:
>
> `journeys[0]`
>
> as a fallback.
>
> If no matching journey exists, show a proper error/not-found state.
>
> ### 10. STANDALONE FLIGHT BOOKING
>
> If the traveler enters through:
>
> **Navigation → Flights**
>
> or:
>
> **Search → Flights**
>
> the booking should remain standalone.
>
> It should appear in:
>
> **Bookings → Flights**
>
> and should not attach itself to an arbitrary journey.
>
> ### 11. UI DIRECTION
>
> Avoid generic cards stacked vertically.
>
> Use a sophisticated travel-booking layout:
>
> * strong route header
> * horizontal progress indicator
> * main content + persistent fare summary
> * airline/flight visual hierarchy
> * dense but readable information
> * clear section boundaries
> * sticky price summary on desktop
> * responsive bottom summary on mobile
> * meaningful empty/loading/error states
>
> The interface should feel like a **real flight reservation product**, not a generic checkout template.
>
> ### 12. QA
>
> Test:
>
> Search → Flight Results → Flight Detail → Flight Booking
>
> Journey → Flight itinerary item → Flight Booking
>
> Booking → Payment → Confirmation
>
> Confirmation → Journey
>
> Confirmation → Bookings
>
> Verify:
>
> * no hotel fields appear
> * no experience fields appear
> * seat selection works
> * baggage affects price
> * meals affect price
> * payment total matches review
> * booking is created only after successful payment
> * itinerary status changes correctly
> * correct journey is updated
> * standalone booking remains standalone
>
> Run TypeScript validation and fix all runtime errors before finishing.
>
> **Do not modify the HotelBookingFlow or ExperienceBookingFlow in this pass except where shared booking infrastructure requires compatibility.**

That should be the **next substantial implementation**, while the navbar and dedicated Flights/Hotels/Experiences navigation fix runs alongside it.
