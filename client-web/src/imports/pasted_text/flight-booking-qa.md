Good — that means the **architecture and navigation layer is now in a much better state**.

But I wouldn't consider the Flight Booking Flow "done" just because the spec exists and TypeScript is clean. The next step should be **visual + behavioral QA of the actual flow**, because your earlier complaint was that it *felt* crappy, not that it was missing headings.

### Next: Flight Booking Flow — real UX QA

Give the MCP this next prompt:

> **Now do a dedicated visual and interaction QA pass on the existing Flight Booking Flow. Do not rebuild it from scratch and do not modify unrelated pages.**
>
> I want you to evaluate the actual rendered experience as a traveler, not just verify that the required components exist.
>
> Start at:
>
> **Flights → Flight Search → Flight Results → Flight Details → Book Flight**
>
> Then inspect every step:
>
> **1. Flight Summary**
> **2. Traveler Details**
> **3. Seat Selection**
> **4. Baggage**
> **5. Meals & Add-ons**
> **6. Review**
> **7. Payment**
> **8. Confirmation**
>
> ### Fix these UX problems if present
>
> **Flight context must always remain obvious.**
>
> The traveler should always know:
>
> `Mumbai → Tokyo`
> `15 Mar`
> `IndiGo · 6E123`
> `Economy`
>
> without having to remember what they selected earlier.
>
> ### Desktop layout
>
> Use:
>
> **Left / main content**
> booking step
>
> **Right / sticky summary**
> flight + traveler + running fare
>
> Do not turn every piece of information into an isolated card.
>
> Use hierarchy, spacing and typography to create sections.
>
> ### Progress indicator
>
> Make the booking progression visually clear:
>
> `Flight → Travelers → Seats → Baggage → Extras → Review → Payment`
>
> Completed steps should be clickable where safe.
>
> Current step should be visually dominant.
>
> Future steps should look unavailable rather than clickable.
>
> ### Traveler Details QA
>
> Ensure the form doesn't feel like an admin form.
>
> Group logically:
>
> **Traveler identity**
>
> **Passport information**
>
> **Contact information**
>
> Use existing traveler/profile data for autofill.
>
> Show validation inline.
>
> Don't make the user repeatedly enter information that already exists in Profile.
>
> ### Seat Selection QA
>
> The seat map should be the visual centerpiece of this step.
>
> It should actually resemble an aircraft cabin rather than a grid of buttons.
>
> Clearly distinguish:
>
> Available
> Selected
> Occupied
> Extra legroom
> Paid
>
> Show the selected seat and price beside the map.
>
> ### Baggage QA
>
> Make included baggage extremely obvious before presenting upsells.
>
> Example:
>
> **Included**
> `7 kg cabin`
> `20 kg checked`
>
> Then:
>
> **Add baggage**
>
> Avoid making users feel that baggage is mandatory if it is already included.
>
> ### Meals / Add-ons QA
>
> Clearly distinguish:
>
> `Included`
> from
> `+₹450`
>
> Do not overwhelm the user with unnecessary extras.
>
> ### Review QA
>
> The review screen must feel like a final verification page, not another generic form.
>
> Show:
>
> **Your flight**
>
> route + airline + schedule
>
> **Travelers**
>
> names
>
> **Seats**
>
> seat numbers
>
> **Baggage**
>
> allowance
>
> **Meals**
>
> selections
>
> **Fare**
>
> complete breakdown
>
> Every section should have an **Edit** action.
>
> ### Payment QA
>
> Make the final amount impossible to miss.
>
> Use:
>
> **Pay ₹XX,XXX**
>
> instead of a generic "Continue".
>
> During payment:
>
> `Processing payment...`
>
> Do not create the booking prematurely.
>
> Add realistic success/failure/retry states.
>
> ### Confirmation QA
>
> The confirmation should feel like the end of a successful journey.
>
> Prominent:
>
> **You're going to Tokyo! ✈️**
>
> **Booking Confirmed**
>
> PNR
>
> flight
>
> traveler
>
> seat
>
> baggage
>
> total paid
>
> If journey-originated:
>
> **Added to Tokyo Spring Escape**
>
> Then provide:
>
> **View Journey**
> **View Booking**
> **Download Ticket**
> **View All Bookings**
>
> ### IMPORTANT
>
> Do not add more cards merely to make the screen longer.
>
> Do not add decorative gradients, random badges or excessive rounded containers.
>
> The goal is:
>
> **premium + trustworthy + airline-grade + clear**
>
> rather than:
>
> **lots of UI components**
>
> ### Interaction QA
>
> Test both:
>
> **Standalone**
>
> Flights → Search → Booking → Confirmation → Bookings
>
> and:
>
> **Journey-originated**
>
> Journey → Flight → Booking → Confirmation → Journey
>
> Verify that the exact journey and itinerary item are updated.
>
> Never use `journeys[0]`.
>
> Run TypeScript validation and fix any runtime issues found.

After this, I'd move to **Hotel Booking Flow** and make it equally domain-specific — especially room selection, rate plans, cancellation policy, guest details and hotel-specific payment/review. That will also let us verify that our three booking flows genuinely feel different instead of being the same checkout template with different labels.
