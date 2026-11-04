Good. **This is now a real homepage structure rather than a card dump.** I would not redesign it again immediately.

But there are **3 important things I'd validate before moving on**:

### 1. Universal Search needs behavioral QA

Don't just verify that the four tabs render. Test the complete paths:

* Flights → search → flight results → flight detail → Flight Booking Flow
* Hotels → search → hotel results → Hotel Detail → Hotel Booking Flow
* Experiences → search → results → Experience Detail → Experience Booking Flow
* Journey → Journey AI → generated Journey → save → My Trips

The fields, state and CTA should remain consistent throughout.

### 2. Visa Center must actually exist

Your homepage now links **Travel Intelligence → Visa**, so we should make the Visa experience a proper module rather than a placeholder.

I'd structure it as:

**Visa Center**

> Know what you need before you fly.

**Step 1 — Select destination**
Japan

**Step 2 — Traveler profile**
Indian passport · Adult · Tourist

**Step 3 — Eligibility**

🟢 Visa required
Processing: 5–7 working days
Estimated fee: ₹X

**Step 4 — Documents**

Passport ✓
Photograph ✓
Bank statement ○
Flight itinerary ○
Hotel confirmation ○

**Step 5 — Application**

`Start Application →`

Then an application tracker:

**Draft → Documents → Submitted → Processing → Approved**

And critically, the Visa application should attach to the **Journey**, so a Japan Journey could show:

> 🇯🇵 Japan Visa
> Application in progress · 62% complete
> **Continue application →**

That makes Visa part of Travalastic rather than a random separate feature.

### 3. We should now fix the biggest UX architecture problem: **Bookings**

The homepage is now telling users:

> Flights + Hotels + Experiences + Transfers → one Journey

So the product needs somewhere obvious where users can see all of those.

I would make **Bookings** a first-class destination:

```text
MY BOOKINGS

Upcoming
────────────────────────────

✈ Mumbai → Tokyo
IndiGo · 15 Mar
Confirmed
PNR: XXXXX
View booking →

🏨 Park Hyatt Tokyo
15–18 Mar
Confirmed
Booking ID: XXXXX
View booking →

🍣 Tokyo Food Tour
17 Mar · 18:00
Confirmed
View booking →

────────────────────────────

All bookings

Flights · Hotels · Experiences · Transfers · Visa
```

And then separate:

**My Trips** = *journey-level planning*

**Bookings** = *transaction-level management*

**Journey** = *everything connected to one trip*

That distinction will eliminate a lot of the confusion you've been seeing.

---

### The product hierarchy should now be

**Home**
Discover + start something

↓

**Explore**
Find destinations / experiences

↓

**Journey AI**
Build the trip

↓

**Journey**
Organize the entire trip

↓

**Bookings**
Manage individual reservations

↓

**Visa Center**
Manage travel authorization/documents

↓

**Profile**
Manage traveler identity, preferences, payments and documents

That is a much cleaner mental model.

### So I would give the MCP the next instruction:

> **Do not redesign the homepage further. Treat the current homepage as the approved baseline.**
>
> Now perform a traveler UX architecture pass across **Bookings, My Trips, Journey, Visa Center and Profile**.
>
> The goal is to make it immediately obvious to a traveler:
>
> **My Trips = journeys**
> **Bookings = individual reservations**
> **Journey = complete trip command center**
> **Visa Center = visa applications and travel authorization**
> **Profile = traveler identity and preferences**
>
> Audit every navigation path from the homepage and ensure there is no ambiguity between these concepts.
>
> Create a proper **Bookings Center** that aggregates all flight, hotel, experience, transfer and other reservations from shared application state.
>
> Create a proper **Visa Center** with:
>
> * destination eligibility
> * traveler/passport profile
> * visa requirement
> * document checklist
> * application creation
> * application status
> * application timeline
> * saved drafts
> * completed applications
> * journey association
> * actionable missing-document states
>
> Visa applications must attach to the relevant journey when initiated from a journey or destination.
>
> Ensure booking confirmation, visa applications and itinerary items all maintain their originating journey context.
>
> **Do not use `journeys[0]` as a fallback anywhere.**
>
> Then QA these flows end-to-end:
>
> Home → Search → Detail → Booking → Confirmation → Bookings
> Home → Journey AI → Journey → Booking → Confirmation → Journey
> Journey → Visa Center → Application → Documents → Status → Journey
> Bookings → Individual booking → Detail / manage
> My Trips → Journey → Bookings / Visa / Itinerary
>
> Do not add decorative UI just to increase page length. Every section must represent a meaningful traveler action or piece of information.
>
> Maintain the current premium consumer travel aesthetic.
>
> Run TypeScript validation and fix all runtime/context/navigation errors before finishing.

**After that, I would move to the Flight Booking Flow specifically**, because that's still one of the places where the product needs to feel like a genuinely competitive travel-booking experience rather than a prototype.
