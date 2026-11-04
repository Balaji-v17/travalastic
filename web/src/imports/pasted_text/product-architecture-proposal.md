Exactly. This is now a **product architecture problem**, not just a UI problem.

Right now Travalastic has pieces of bookings, trips, journeys, and itineraries, but the user doesn't have a clear mental model of:

**What have I booked? → What trip does it belong to? → What do I need to do next? → Where are my tickets/vouchers?**

We should fix that before polishing individual booking flows.

### The model I recommend

Travalastic should have **4 clearly different concepts**:

**1. Discover**
Find destinations, flights, hotels, experiences, deals.

**2. Journey AI**
Build the trip and itinerary.

**3. My Trips**
Manage the *trip as a whole*.

**4. My Bookings**
Manage *every individual reservation*, regardless of which trip it belongs to.

That distinction will immediately make the product easier to understand.

---

# New navigation

I would change the main navigation to:

**Explore · Journey AI · Flights · Hotels · Experiences · Trips · Bookings**

Then right side:

**Search · Help · Profile**

And importantly, **Trips and Bookings are not the same thing.**

### Trips

Think:

> "Where am I going?"

Example:

**Japan Spring Escape**
Mar 15–22 · 2 travelers

`Planning 68%`

Mumbai → Tokyo → Kyoto → Mumbai

**Next up**

✈️ Flight to Tokyo
15 Mar · 22:40

**Itinerary**

Day 1 — Arrival
Day 2 — Shinjuku
Day 3 — Asakusa
...

---

### Bookings

Think:

> "What reservations do I have?"

A dedicated booking center.

At the top:

**My Bookings**

`All · Flights · Hotels · Experiences · Transfers · Trains · Buses · Insurance · Visa`

Then:

### Upcoming

**✈️ IndiGo 6E 1234**

Mumbai → Tokyo
15 Mar · 22:40

**Confirmed**

PNR: ABC123

`View booking` `Manage`

---

**🏨 Park Hyatt Tokyo**

15–18 Mar
Deluxe King · 2 guests

**Confirmed**

`View booking` `Manage`

---

**🎎 Tokyo Cultural Walking Tour**

17 Mar · 10:00
2 participants

**Confirmed**

`View booking`

---

Now I can answer the question:

> "Where's my hotel booking?"

Immediately.

---

# And Trips needs a proper hierarchy

The Trip page should become the **command center for the traveler**, but without looking like an operations dashboard.

I'd structure it as:

### Journey header

**Japan Spring Escape**

Tokyo · Kyoto
15–22 Mar 2027
2 travelers

`Planning 68%`

**Budget**

₹2,81,500 / ₹3,00,000

---

### Trip navigation

**Overview | Itinerary | Bookings | Expenses | Documents | Journey AI**

This is much clearer.

---

## Overview

The overview answers:

> "What's happening with my trip?"

**Next up**

✈️ Mumbai → Tokyo
15 Mar · 22:40

**Trip progress**

Flight ✓
Hotel ✓
Experiences 2/4
Transfers 0/2

**Journey Health**

92/100

**Upcoming**

Day 1
Arrival → Hotel → Dinner

---

# Itinerary

This is where the actual day-by-day plan lives.

### Day 1 · Tokyo

**22:40**

✈️ Mumbai → Tokyo

**09:15**

🚕 Airport → Park Hyatt Tokyo

**11:00**

🏨 Check-in

**19:30**

🍣 Dinner at Kozue

Every item has:

`Booked` / `Reserve` / `Add`

And clicking a booked item opens its actual booking.

---

# Bookings inside the trip

This should show only reservations belonging to **this trip**.

### Flights

✓ Mumbai → Tokyo
✓ Kyoto → Mumbai

### Hotels

✓ Park Hyatt Tokyo
✓ Ritz-Carlton Kyoto

### Experiences

✓ Tsukiji Food Tour
○ Tokyo Cooking Class

### Transfers

○ Airport Transfer

And:

**+ Add another booking**

This is where the relationship becomes obvious:

> **My Bookings = everything I have reserved.**
> **Trip Bookings = reservations belonging to this particular trip.**

---

# Documents

This should become a proper **Travel Wallet**.

Instead of burying documents somewhere in Profile:

### Travel Wallet

**Japan Spring Escape**

**Flight tickets**

* Mumbai → Tokyo
* Kyoto → Mumbai

**Hotel vouchers**

* Park Hyatt Tokyo
* Ritz-Carlton Kyoto

**Experience vouchers**

* Tsukiji Food Tour

**Travel documents**

* Passport
* Visa
* Insurance

With:

`View` `Download` `Share`

---

# And Profile should NOT manage bookings

This is another source of confusion.

Profile should contain:

**Personal**

* Personal information
* Travelers
* Preferences

**Travel Identity**

* Passport
* Documents
* Home airport
* Airlines
* Cabin preference

**Payments**

* Cards
* UPI
* Wallet

**Security**

* Password
* 2FA
* Sessions

**Support**

That's it.

Bookings belong in **Bookings**.

Trips belong in **Trips**.

Documents can be surfaced through **Trips → Documents / Travel Wallet**.

---

# We also need a global booking state

This is the important architectural change.

Instead of booking information being scattered through different pages, establish a single concept:

```text
Booking
 ├── id
 ├── type
 ├── status
 ├── source
 ├── journeyId?
 ├── itineraryItemId?
 ├── travelerIds
 ├── provider
 ├── confirmationNumber
 ├── dates
 ├── price
 ├── payment
 ├── cancellationPolicy
 └── details
```

Then:

```text
My Bookings
      │
      ├── Flight Booking
      │       └── Journey A
      │
      ├── Hotel Booking
      │       └── Journey A
      │
      ├── Experience Booking
      │       └── Journey A
      │
      └── Hotel Booking
              └── Standalone
```

That gives us the flexibility to have a booking belong to a Journey **without making the booking dependent on the Journey**.

---

# One more thing: "Trip" vs "Journey"

I'd actually simplify the terminology.

The product currently uses **Trip**, **Journey**, **Itinerary**, **Booking**, and **Journey AI**.

That's too many concepts.

I'd establish:

### Journey

The overall travel project.

> **Japan Spring Escape**

### Itinerary

The day-by-day plan inside that Journey.

### Booking

A confirmed reservation.

### Journey AI

The intelligence that creates and manages the Journey.

Then use **"My Trips"** in the consumer UI if you prefer the familiar language, but internally the object can remain `Journey`.

So the user sees:

**My Trips**

→ Japan Spring Escape

→ **Itinerary**

→ **Bookings**

→ **Documents**

→ **Expenses**

Much easier.

---

# And this should become our next MCP task

Don't ask it to simply "create a bookings page."

Give it the architectural requirement:

> **Travalastic currently lacks a clear traveler-facing information architecture for managing trips and bookings. Before adding further UI features, redesign the Trip and Booking management architecture so a traveler can immediately understand the difference between a trip, itinerary, booking and document.**
>
> **DO NOT patch the existing MyTripsPage. Rework the information architecture and relevant navigation/components where necessary.**
>
> ### 1. GLOBAL NAVIGATION
>
> Update the consumer navigation to:
>
> **Explore | Journey AI | Flights | Hotels | Experiences | Trips | Bookings**
>
> Right:
>
> **Search | Help | Profile**
>
> Remove ambiguous navigation where necessary.
>
> ### 2. MY BOOKINGS — NEW FIRST-CLASS MODULE
>
> Create a dedicated `MyBookingsPage`.
>
> This is the global reservation management center.
>
> Tabs:
>
> **All | Flights | Hotels | Experiences | Transfers | Trains | Buses | Insurance | Visa**
>
> Show:
>
> * upcoming bookings
> * completed bookings
> * cancelled bookings
> * pending bookings
> * booking status
> * confirmation number
> * provider
> * date/time
> * traveler
> * price
> * linked Journey
>
> Each booking must have a dedicated detail view.
>
> ### 3. BOOKING DETAIL
>
> Create reusable `BookingDetailPage` architecture with type-specific content.
>
> Flight booking:
> PNR, flight timeline, passengers, seats, baggage, meals, fare, payment, cancellation/change policy.
>
> Hotel:
> property, room, guests, dates, amenities, cancellation policy, payment, voucher.
>
> Experience:
> date, time, participants, meeting point, inclusions, voucher.
>
> Never display irrelevant fields between booking types.
>
> ### 4. MY TRIPS
>
> Rework `MyTripsPage` into a true trip management center.
>
> Each trip card must show:
>
> * destination
> * dates
> * travelers
> * journey status
> * planning progress
> * booking progress
> * next upcoming item
> * total budget
> * amount committed
>
> Provide clear actions:
>
> **Open Trip**
> **Continue Planning**
> **View Bookings**
>
> ### 5. JOURNEY PAGE
>
> Reorganize JourneyPage into:
>
> **Overview | Itinerary | Bookings | Expenses | Documents | Journey AI**
>
> Overview answers:
> "What is happening with my trip?"
>
> Itinerary answers:
> "What am I doing each day?"
>
> Bookings answers:
> "What have I reserved?"
>
> Expenses answers:
> "What have I spent?"
>
> Documents answers:
> "What travel documents/vouchers do I need?"
>
> Journey AI answers:
> "What should I change or do next?"
>
> ### 6. ITINERARY → BOOKING RELATIONSHIP
>
> Every itinerary item must clearly show:
>
> **Booked**
> **Available**
> **Pending**
> **Cancelled**
>
> A booked itinerary item must link directly to its booking.
>
> An unbooked item must provide:
>
> **Book now**
>
> After successful booking:
>
> `itineraryItem.status = booked`
>
> and the itinerary item must reference the actual booking ID.
>
> ### 7. GLOBAL BOOKING DATA MODEL
>
> Establish one canonical booking model.
>
> Every booking must contain:
>
> `id`
> `type`
> `status`
> `source`
> `journeyId?`
> `itineraryItemId?`
> `travelerIds`
> `provider`
> `confirmationNumber`
> `startDate`
> `endDate`
> `price`
> `payment`
> `cancellationPolicy`
> `details`
>
> `source` must support:
>
> `journey`
> `search`
> `destination`
> `deals`
>
> Never use `journeys[0]`.
>
> ### 8. DOCUMENTS / TRAVEL WALLET
>
> Add a clear Travel Wallet / Documents experience.
>
> It should aggregate:
>
> * flight tickets
> * hotel vouchers
> * experience vouchers
> * insurance documents
> * visa documents
> * passport/travel documents
>
> A user should be able to access documents from:
>
> **Trip → Documents**
>
> and from:
>
> **Profile → Travel Documents**
>
> without duplicating the underlying data.
>
> ### 9. PROFILE
>
> Remove booking-management responsibilities from Profile.
>
> Profile should focus on:
>
> Personal information
> Travelers
> Travel identity
> Documents
> Payment methods
> Preferences
> Security
> Support
>
> ### 10. UX PRINCIPLE
>
> The product must answer these four questions immediately:
>
> **Where am I going? → My Trips**
>
> **What have I booked? → My Bookings**
>
> **What am I doing? → Itinerary**
>
> **What documents do I need? → Travel Wallet**
>
> Do not use generic dashboard layouts.
>
> This is a premium consumer travel product, not an operations console.
>
> Use editorial travel UI, strong hierarchy, clear timelines, contextual cards, progressive disclosure and type-specific booking experiences.
>
> Finally test these complete journeys:
>
> `Journey AI → Create Journey → Itinerary → Book Flight → Confirmation → Journey → Bookings`
>
> `Search → Hotel → Book → Confirmation → My Bookings`
>
> `Journey → Itinerary → Book Experience → Confirmation → Journey`
>
> `My Bookings → Booking Detail → Linked Journey`
>
> `Trip → Documents → Flight/Hotel/Experience voucher`
>
> Ensure every navigation action has an obvious next step and no dead ends.
>
> Run TypeScript validation and fix all errors before finishing.

**This should be the next major milestone.** After this, the whole product will finally have a coherent skeleton. Then we can tackle **Visa Center → Visa Application → Document Collection → Application Tracking**, which should be another first-class module rather than a random feature buried in Profile.
