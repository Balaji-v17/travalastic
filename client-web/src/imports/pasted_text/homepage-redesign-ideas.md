Yes. At this point I would **stop adding more homepage sections**. The current homepage has enough content; the problem is that it doesn't behave like a serious travel product.

The homepage needs to become a **travel decision interface**, not a collection of editorial cards.

### What I would change

**1. Hero becomes the actual product**

Instead of:

> Where to? · Dates · Travelers → Search

make it a proper unified booking/search module.

**Hero**

> **Your next journey starts here.**

> Flights, stays, experiences and complete journeys — planned around you.

Then a large segmented search control:

**✈ Flights | 🏨 Hotels | ✦ Experiences | 🧭 Journey**

#### Flights

`From`
Mumbai (BOM)

`To`
Tokyo (NRT)

`Departure`
15 Mar

`Return`
22 Mar

`Travellers`
2 Adults · Economy

**Search flights →**

#### Hotels

`Where` → Bali
`Check-in` → 15 Mar
`Check-out` → 22 Mar
`Guests` → 2 Adults · 1 Room

**Search stays →**

#### Experiences

`Destination` → Tokyo
`Date` → 17 Mar
`Guests` → 2
`Category` → Food & Culture

**Find experiences →**

#### Journey

This is where Travalastic differentiates itself:

`Where do you want to go?`
`When?`
`Who is travelling?`
`Budget`
`Travel style`

**Build my Journey →**

And beneath the control:

**Popular right now:** Tokyo · Bali · Dubai · Maldives · Kerala

That's much more meaningful.

---

# 2. Add a "Continue where you left off" layer

If the user has a journey:

### **Your Japan journey is taking shape**

**68% planned**

Mumbai → Tokyo → Kyoto
15–22 Mar · 2 travelers

**Next step**

🏨 Book your Kyoto stay

`Continue Journey →`

If there is no journey:

### **Planning your next escape?**

**Tell Journey AI what you're looking for and we'll build the trip around you.**

`Start with Journey AI →`

This should be **dynamic**, not a permanent promotional card.

---

# 3. Replace the giant destination wall

The current homepage throws 15–20 destinations at the user.

That's too much.

Instead:

## Where travelers are going

A proper editorial composition:

**Large feature**

### Tokyo

Japan
**The city that never runs out of things to discover.**

`Explore Tokyo →`

Then beside it:

**Bali**
**Dubai**
**Maldives**

Then:

`Explore all destinations →`

The homepage should **inspire**, while Explore handles the catalog.

---

# 4. Add a real "Book your trip" section

This is missing conceptually.

### Everything you need for one journey

Four connected services:

**Flights**
Compare routes and fares

**Hotels**
Stays matched to your journey

**Experiences**
Things worth doing when you arrive

**Transfers**
Airport-to-hotel and local transport

Then:

> **Build them into one journey with Journey AI**

This explains what Travalastic actually does.

---

# 5. Make Journey AI feel like the product advantage

Right now it feels like another marketing section.

Instead:

## Don't search for a trip. Describe one.

Large conversational interface:

> **"I want a relaxed 7-day Japan trip from Mumbai in March, around ₹2.5L for two people. We love food, culture and scenic places, but don't want packed days."**

Then show the generated result visually:

**Japan · 7 nights**

✈ Mumbai → Tokyo
🏨 3 nights Tokyo
🏨 3 nights Kyoto
🍜 4 experiences
🚆 Tokyo → Kyoto
💰 ₹2,42,800

**Journey Health 94**

`View Journey →`

That communicates the USP far better than bullet points.

---

# 6. Introduce "Trip building blocks"

This is where we can make Travalastic feel different.

### Build your journey your way

**Start with a flight**
We'll build the rest around it.

**Start with a hotel**
Find experiences around your stay.

**Start with an experience**
We'll suggest the destination and stay.

**Start with a destination**
Journey AI builds the complete trip.

This is a much stronger product concept than another card grid.

---

# 7. Experiences should have an actual visual hierarchy

Instead of four generic experience cards:

## What do you want to experience?

Large horizontal categories:

**Taste**
Food tours · Cooking · Markets

**Explore**
Landmarks · Culture · History

**Adventure**
Hiking · Diving · Wildlife

**Relax**
Wellness · Beaches · Retreats

**Celebrate**
Nightlife · Events · Luxury

Clicking one should actually take the user into filtered Explore/Experiences.

---

# 8. Add a travel intelligence section

This is another place where Travalastic can differentiate.

### Before you book, know what matters.

Three editorial panels:

**Best time to go**
Tokyo · March–May

**What you'll spend**
Typical 7-day couple trip
₹1.8L–₹2.8L

**What you need**
Passport ✓
Visa required ✓
Travel insurance recommended ✓

**Ask Journey AI →**

This naturally introduces the future **Visa Center** without making the homepage feel like a government portal.

---

# 9. Deals should not be a generic sale banner

Instead:

## Worth booking now

**Soneva Jani**
Maldives
₹X / night

**Mumbai → Dubai**
from ₹X return

**Bali Wellness Escape**
7 nights · ₹X/person

Use actual urgency:

`Price dropped 12%`

`Limited availability`

`Best value this week`

Then:

**See all deals →**

---

# 10. Finish with the user's journey

Near the bottom:

### Your entire journey. One place.

Visual flow:

**Discover**

↓

**Plan**

↓

**Book**

↓

**Travel**

↓

**Manage**

with the actual Travalastic product screens represented underneath.

Then:

> Flights. Hotels. Experiences. Transfers. Documents. Visa.
> **All connected to one journey.**

That's the message stakeholders should remember.

---

# Final homepage structure

I would make the homepage roughly:

```text
NAV
│
├── HERO + UNIVERSAL SEARCH
│
├── CONTINUE JOURNEY / PERSONALIZED NEXT STEP
│
├── DESTINATION FEATURE
│
├── BOOK YOUR JOURNEY
│     Flights
│     Hotels
│     Experiences
│     Transfers
│
├── JOURNEY AI
│     "Describe your dream trip"
│     → generated Journey preview
│
├── TRIP BUILDING BLOCKS
│
├── EXPERIENCE DISCOVERY
│
├── TRAVEL INTELLIGENCE
│     Timing / Cost / Visa / Documents
│
├── WORTH BOOKING NOW
│
├── INSPIRATION / TRAVEL STORIES
│
├── YOUR ENTIRE JOURNEY. ONE PLACE.
│
└── FOOTER
```

**Notice what's missing:** another 20-card destination grid, another KPI strip, another generic "Why us" section, and endless repeated CTAs.

The homepage should have **8–10 strong compositions**, each with a specific job.

---

## MCP prompt I'd use now

> **Redesign the Travalastic HomePage as a premium consumer travel product. Do not simply add more cards or increase the number of sections. The current page contains enough content but lacks product hierarchy, meaningful interaction, and a coherent decision flow.**
>
> **Treat the homepage as the entry point to the entire Travalastic product. Every major section must answer a specific traveler intent.**
>
> **Primary objective:** within the first screen, the user must understand that Travalastic can help them **search individual travel services OR build and manage an entire journey.**
>
> ### HERO
>
> Replace the current generic hero search with a real contextual universal search module.
>
> Tabs:
>
> **Flights | Hotels | Experiences | Journey**
>
> Each tab must render completely different, type-appropriate fields.
>
> Flights:
> From / To / Departure / Return / Travelers / Cabin
>
> Hotels:
> Destination / Check-in / Check-out / Rooms / Guests
>
> Experiences:
> Destination / Date / Participants / Category
>
> Journey:
> Destination / Dates / Travelers / Budget / Travel style
>
> The CTA must change according to the selected tab:
>
> Search Flights
> Search Hotels
> Find Experiences
> Build My Journey
>
> Include popular destinations underneath as quick selections.
>
> Do not use fake generic fields that don't change with context.
>
> ### PERSONALIZED CONTINUATION
>
> If an active Journey exists, show:
>
> Journey name
> destination
> dates
> travelers
> planning/booking progress
> next recommended action
>
> Example:
>
> **Japan Spring Escape**
>
> 68% planned
>
> "Next: Book your Kyoto stay"
>
> `Continue Journey`
>
> If no journey exists, show a Journey AI entry point instead.
>
> ### DESTINATION FEATURE
>
> Replace the current large destination collection with an editorial destination composition:
>
> one dominant destination + 2–3 supporting destinations.
>
> The section must feel curated rather than like a database.
>
> ### BOOK YOUR JOURNEY
>
> Introduce the four core booking building blocks:
>
> Flights
> Hotels
> Experiences
> Transfers
>
> Explain that these can be combined into one Journey.
>
> Every card must navigate to the appropriate existing product flow.
>
> ### JOURNEY AI
>
> Make Journey AI the primary product differentiator.
>
> Show a conversational trip request such as:
>
> "I want a relaxed 7-day Japan trip from Mumbai in March for two people, around ₹2.5L. We love food and culture."
>
> Show a realistic generated Journey preview containing:
>
> flight
> hotels
> experiences
> transport
> estimated cost
> Journey Health score
>
> CTA:
>
> **Build this Journey**
>
> This must connect to the existing AIPlanner/Journey state rather than being a static mock.
>
> ### TRIP BUILDING
>
> Add:
>
> Start with a flight
> Start with a hotel
> Start with an experience
> Start with a destination
>
> Each option should explain how Travalastic builds the rest of the Journey around that starting point.
>
> ### EXPERIENCES
>
> Replace generic experience cards with five intent categories:
>
> Taste
> Explore
> Adventure
> Relax
> Celebrate
>
> Clicking each category must filter/navigate to the existing experience discovery flow.
>
> ### TRAVEL INTELLIGENCE
>
> Add an editorial section answering:
>
> Best time to go
> Typical trip cost
> Visa requirement
> Documents needed
>
> This should use destination data and connect to Journey AI / future Visa Center functionality.
>
> ### DEALS
>
> Replace generic promotional content with 3–4 high-value bookable opportunities showing:
>
> price
> price change
> availability
> travel dates
>
> Each must link to the correct booking/detail flow.
>
> ### FINAL VALUE PROPOSITION
>
> Create a visual journey:
>
> **Discover → Plan → Book → Travel → Manage**
>
> Explain that Travalastic connects:
>
> Flights
> Hotels
> Experiences
> Transfers
> Documents
> Visa
> Journey management
>
> into one connected traveler experience.
>
> ### DESIGN DIRECTION
>
> Do NOT create a SaaS dashboard.
>
> Do NOT use repeated card grids.
>
> Do NOT create KPI-heavy sections.
>
> Do NOT use generic gradients everywhere.
>
> Do NOT fill whitespace by adding random cards.
>
> Use:
>
> cinematic photography
> editorial typography
> asymmetric layouts
> strong whitespace
> large destination imagery
> restrained glass/overlay UI
> subtle motion
> premium travel-magazine composition
>
> Every section must have a clear purpose, a strong visual hierarchy, and a logical next action.
>
> **Most importantly: reuse and connect to the existing AppContext, Journey AI, Explore, Search, Booking, Trips, Bookings and Detail-page flows. Do not create disconnected mock interactions.**
>
> Before finishing, test:
>
> Home → Flight search
> Home → Hotel search
> Home → Experience search
> Home → Journey AI
> Home → Destination
> Home → Existing Journey
> Home → Deals
>
> Verify every CTA reaches a meaningful next screen and that no CTA is decorative.
>
> Run TypeScript validation and fix all errors.

This would be the right **homepage reset**. After this, I would **not touch the homepage again until we test the complete traveler flow end-to-end**. The next priority should then be the newly defined **Bookings Center + Visa Center**, because those are currently the biggest product gaps.
