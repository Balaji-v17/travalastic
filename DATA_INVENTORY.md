# Travalastic Data Inventory & Privacy Audit

## A. Summary
Travalastic is an AI-powered travel planning and itinerary management platform. The application handles:
1. **User Account Data**: Name, email address, and bcrypt-hashed account passwords for identity and access management.
2. **Trip & Itinerary Data**: Free-text travel prompts, destinations, travel dates, budget preferences, travel interest tags, daily activity schedules, and custom packing templates.
3. **Conversations**: AI itinerary chat messages stored persistently for trip grounding; general travel assistant messages processed statelessly in volatile client/server memory only.
4. **Expenses & Spending**: Activity costs, logged expense amounts in INR and original foreign currencies, FX exchange rates, and cost-splitting member breakdowns.
5. **Flight Bookings & Disruption Guardian**: Passenger identities (full names, birthdates, gender, email, phone) and Duffel booking order references; flight delay minutes and derived rescheduled timestamps.

---

## B. Data We Store

| Data Item | Collection / Field | Purpose | Retention / Deletion | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| User Profile | `users` (`_id`, `email`, `name`, `passwordHash`, `createdAt`) | Authentication, account identity, and session authorization. | Retained until user deletes account. Permanently deleted via `User.deleteOne({ _id: userId })`. | [`backend/src/models/User.js`](file:///Users/balaji.v/travalastic/backend/src/models/User.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L54) |
| Travel Itineraries | `itineraries` (`userId`, `rawRequest`, `destination`, `startDate`, `endDate`, `budgetTier`, `interests`, `budgetEstimate`, `days[]`, `packingList[]`, `editHistory[]`) | Storing generated trip plans, user preferences, daily schedules, AI undo snapshots, and packing items. | Retained until user deletes account. Permanently deleted via `Itinerary.deleteMany({ userId })`. | [`backend/src/models/Itinerary.js`](file:///Users/balaji.v/travalastic/backend/src/models/Itinerary.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L48) |
| Trip Chat Conversations | `conversations` (`userId`, `itineraryId`, `messages[].role`, `messages[].content`, `messages[].timestamp`) | Grounded trip Q&A, itinerary modification conversation history. | Retained until user deletes account. Permanently deleted via `Conversation.deleteMany({ userId })`. | [`backend/src/models/Conversation.js`](file:///Users/balaji.v/travalastic/backend/src/models/Conversation.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L49) |
| Trip Expenses & Splits | `expenses` (`userId`, `itineraryId`, `description`, `amountINR`, `amountOriginal`, `currencyOriginal`, `fxRateToINR`, `splitDetails[]`, `category`) | Tracking traveler spending, multi-currency conversions, and bill splitting between companions. | Retained until user deletes account. Permanently deleted via `Expense.deleteMany({ userId })`. | [`backend/src/models/Expense.js`](file:///Users/balaji.v/travalastic/backend/src/models/Expense.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L50) |
| Flight Bookings | `bookings` (`userId`, `itineraryId`, `bookingReference`, `orderId`, `offerId`, `status`, `airline`, `origin`, `destination`, `departureTime`, `arrivalTime`, `passengers[]`, `passengerNames[]`, `totalAmount`, `currency`, `slices[]`, `rawOrder`) | Flight order persistence, PNR reference tracking, boarding pass and schedule display. | Retained until user deletes account. Permanently deleted via `Booking.deleteMany({ userId })`. *(Note: bookings created unauthenticated have `userId: null`; see Section H)*. | [`backend/src/models/Booking.js`](file:///Users/balaji.v/travalastic/backend/src/models/Booking.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L51) |
| Packing Templates | `packingtemplates` (`userId`, `name`, `items[].text`, `items[].category`, `createdAt`) | Reusable user packing checklists across multiple journeys. | Retained until user deletes account. Permanently deleted via `PackingTemplate.deleteMany({ userId })`. | [`backend/src/models/PackingTemplate.js`](file:///Users/balaji.v/travalastic/backend/src/models/PackingTemplate.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L52) |
| Flight Disruptions | `disruptions` (`userId`, `itineraryId`, `bookingId`, `type`, `source`, `dedupeKey`, `details { oldDeparture, newDeparture, oldArrival, newArrival, delayMinutes, structural }`, `proposal`, `status`, `detectedAt`) | Tracking airline schedule changes, storing reschedule proposals, supporting approve/undo workflows. | Retained until user deletes account. Permanently deleted via `Disruption.deleteMany({ userId })`. | [`backend/src/models/Disruption.js`](file:///Users/balaji.v/travalastic/backend/src/models/Disruption.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js#L53) |
| Curated Hotels Catalog | `curatedhotels` (`destination`, `budgetTier`, `name`, `priceRangeINR`, `rating`) | Global static catalog for hotel recommendations. | Global non-user catalog. Not tied to user; not deleted. | [`backend/src/models/CuratedHotel.js`](file:///Users/balaji.v/travalastic/backend/src/models/CuratedHotel.js) |
| Curated Routes Catalog | `curatedroutes` (`mode`, `origin`, `destination`, `approxDurationHours`, `frequency`, `note`) | Global transit options catalog. | Global non-user catalog. Not tied to user; not deleted. | [`backend/src/models/CuratedRoute.js`](file:///Users/balaji.v/travalastic/backend/src/models/CuratedRoute.js) |
| Destination Content Catalog | `destinationcontents` (`text`, `tags`, `embedding`) | Curated destination vector search repository. | Global non-user catalog. Not tied to user; not deleted. | [`backend/src/models/DestinationContent.js`](file:///Users/balaji.v/travalastic/backend/src/models/DestinationContent.js) |
| Tourist Places Catalog | `touristplaces` (`name`, `city`, `state`, `zone`, `type`, `significance`, `googleRating`, `entranceFeeINR`, `timeNeededHours`, `embedding`) | Global tourist attractions vector catalog. | Global non-user catalog. Not tied to user; not deleted. | [`backend/src/models/TouristPlace.js`](file:///Users/balaji.v/travalastic/backend/src/models/TouristPlace.js) |

---

## C. Data Sent to Third Parties

| Recipient | What Exactly is Sent | User-Identifying? | Purpose | Evidence | Provider-Side Retention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Groq** | User prompt, trip questions, whitelisted itinerary context (destination, dates, budget tier, interests, daily activities with time bucket and done status, logged expense category totals, linked flight route and status), recent 6 chat messages, Travel Assistant user message (1–1000 chars) and recent 10 history entries. | **Yes** (Free-text user prompts, travel dates, personal preferences, daily plans). | Core LLM reasoning: generating itineraries, answering trip chat questions, stateless general assistant responses, reschedule proposals, packing suggestions. | [`backend/src/services/agents/tripQaNode.js`](file:///Users/balaji.v/travalastic/backend/src/services/agents/tripQaNode.js#L112), [`backend/src/services/travelAssistantService.js`](file:///Users/balaji.v/travalastic/backend/src/services/travelAssistantService.js#L442), [`backend/src/services/rescheduleService.js`](file:///Users/balaji.v/travalastic/backend/src/services/rescheduleService.js#L418) | UNVERIFIED (Check Groq Commercial Terms of Service & Data Processing Agreement regarding retention of API inputs). |
| **Cerebras** | Raw travel request text (`rawRequest`). | **Yes** (Free-text prompt describing user travel desires). | Primary LLM inference for initial itinerary generation in `plannerNode`. | [`backend/src/services/agents/plannerNode.js`](file:///Users/balaji.v/travalastic/backend/src/services/agents/plannerNode.js#L149) | UNVERIFIED (Check Cerebras API Data Policy). |
| **Google Gemini** | User travel interest tags (`interests`) and destination search strings (`destinationQuery`). | **Yes** (Travel preference tags). | Generating text embeddings (`gemini-embedding-001`) for vector similarity search against attractions and destination content. | [`backend/src/services/embeddingService.js`](file:///Users/balaji.v/travalastic/backend/src/services/embeddingService.js#L18), [`backend/src/services/agents/personalizationNode.js`](file:///Users/balaji.v/travalastic/backend/src/services/agents/personalizationNode.js#L45) | UNVERIFIED (Check Google Cloud / Google AI Studio Terms of Service regarding API logging). |
| **Duffel** | Flight search parameters (origin, destination, dates, passenger count, cabin class); **Booking orders**: Passenger full names, titles, genders, dates of birth, contact email, contact phone, payment amounts. | **Yes** (Direct personal identities of passengers and contact details). | Flight availability search and official airline reservation order placement. | [`backend/src/routes/flights.js`](file:///Users/balaji.v/travalastic/backend/src/routes/flights.js#L150), [`backend/src/routes/flights.js`](file:///Users/balaji.v/travalastic/backend/src/routes/flights.js#L540) | UNVERIFIED (Governed by Duffel Terms of Service and underlying airline ticket retention regulations). |
| **OpenWeather** | Destination / activity geographic coordinates (`latitude`, `longitude`) and target date. | **No** (Coordinates of travel location, no user identity). | Weather forecast retrieval for travel dates and rainfall scheduling alerts. | [`backend/src/services/weatherService.js`](file:///Users/balaji.v/travalastic/backend/src/services/weatherService.js#L30) | UNVERIFIED (Check OpenWeather API Privacy Policy). |
| **OpenStreetMap Nominatim** | Destination or place search query string (`query`). | **No** (Search terms only; no user identifiers forwarded). | Geocoding city and landmark names to latitude/longitude coordinates. | [`backend/src/services/placesService.js`](file:///Users/balaji.v/travalastic/backend/src/services/placesService.js#L52) | UNVERIFIED (Subject to OpenStreetMap Foundation Standard Privacy Policy). |
| **OpenStreetMap Overpass** | Geographic bounding box / radius coordinates (`lat`, `lon` within 25km). | **No** (Geographic coordinates only). | Fetching tourist attractions, points of interest, and amenities for destination planning. | [`backend/src/services/overpassService.js`](file:///Users/balaji.v/travalastic/backend/src/services/overpassService.js#L68) | UNVERIFIED (Subject to OSM Overpass API Acceptable Use Policy). |
| **Pexels** | Destination query string (e.g. `"Goa"`). | **No** (Location name only). | Sourcing royalty-free cover photography for destinations. | [`backend/src/services/pexelsService.js`](file:///Users/balaji.v/travalastic/backend/src/services/pexelsService.js#L122) | UNVERIFIED (Check Pexels API Terms of Service). |
| **Frankfurter** | Currency codes (`from=<currency>`, `to=INR`). | **No** (Currency ISO codes only). | Real-time foreign exchange reference rates (ECB data) for expense currency conversion. | [`backend/src/services/fxRates.js`](file:///Users/balaji.v/travalastic/backend/src/services/fxRates.js#L44) | UNVERIFIED (Public open-source FX rate API; no authentication). |
| **MongoDB Atlas** | All stored collections listed in Section B over TLS. | **Yes** (Encrypted database cluster holding user accounts, itineraries, bookings). | Primary cloud database hosting. | [`backend/src/server.js`](file:///Users/balaji.v/travalastic/backend/src/server.js#L131) | UNVERIFIED (Governed by MongoDB Cloud Privacy Notice and customer DPA). |
| **Render** | Incoming HTTP requests over HTTPS (IP address, User-Agent, request headers). | **Yes** (Network IP addresses and request headers). | Cloud hosting platform executing the Node.js backend runtime. | [`backend/src/server.js`](file:///Users/balaji.v/travalastic/backend/src/server.js) | UNVERIFIED (Check Render Privacy Policy regarding infrastructure server access logs). |
| **Vercel** | Incoming web client requests over HTTPS (IP address, User-Agent). | **Yes** (Client IP address). | Cloud CDN and hosting for web frontends. | [`web/vite.config.ts`](file:///Users/balaji.v/travalastic/web/vite.config.ts) | UNVERIFIED (Check Vercel Privacy Policy). |
| **Google Fonts** | Font stylesheet request from visitor browser (`fonts.googleapis.com` & `fonts.gstatic.com`). | **Yes** (Visitor browser IP address and User-Agent). | Typography styling in web application. | [`web/src/index.css`](file:///Users/balaji.v/travalastic/web/src/index.css#L1) | UNVERIFIED (Subject to Google Fonts Privacy Policy). |
| **Unsplash** | Image asset requests from visitor browser (`images.unsplash.com`). | **Yes** (Visitor browser IP address). | Web UI destination card photography display (222 image URLs). | [`web/src/data/mockData.ts`](file:///Users/balaji.v/travalastic/web/src/data/mockData.ts) | UNVERIFIED (Check Unsplash Image API / CDN Privacy Policy). |
| **Uber (Redirect)** | Device GPS pickup latitude/longitude, destination dropoff coordinates and address. | **Yes** (Exact user GPS coordinates at time of cab booking). | Deep link navigation to Uber cab dispatch service. | [`mobile/screens/CabBookingScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/CabBookingScreen.js#L155) | User-directed navigation; governed by Uber Privacy Notice. |
| **RentalCars (Redirect)** | Destination city name. | **No** (Destination name string). | Partner redirect link for car rental booking. | [`mobile/screens/CarsScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/CarsScreen.js#L35) | User-directed navigation; governed by Rentalcars.com Privacy Policy. |
| **Google Maps (Redirect)**| Activity latitude and longitude coordinates. | **No** (Location coordinates). | Opening activity location in Google Maps app / web. | [`mobile/screens/ItineraryScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/ItineraryScreen.js#L210) | User-directed navigation; governed by Google Privacy Policy. |
| **IRCTC / RedBus (Redirect)**| None (Static home / search URLs without query parameters). | **No** | Transit reference navigation. | [`mobile/screens/TrainsAndBusesScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/TrainsAndBusesScreen.js#L42) | User-directed navigation. |
| **Expo / EAS** | Application bundle manifests during build/update. | **No** (Build artifacts only; no user data in runtime payload). | React Native framework build tooling and distribution. | [`mobile/eas.json`](file:///Users/balaji.v/travalastic/mobile/eas.json) | Governed by Expo Privacy Policy. |

---

## D. Data in Logs

| Logging Mechanism | File / Location | What is Logged | Sensitivity & PII Assessment |
| :--- | :--- | :--- | :--- |
| **Morgan HTTP Logger** (`morgan('dev')`) | [`backend/src/server.js`](file:///Users/balaji.v/travalastic/backend/src/server.js#L33) | HTTP request method, URL path, query string, status code, response time. | **Query parameters logged**: Destination search terms (`/destinations/search?q=...`), flight queries (`/flights/search?...`), coordinates (`/weather?lat=...`). Request bodies, passwords, and chat messages are **never** logged by Morgan. |
| **Assistant Route Logger** | [`backend/src/routes/assistant.js`](file:///Users/balaji.v/travalastic/backend/src/routes/assistant.js#L74) | `userId`, message character length (`number`), `toolUsed` (`boolean`), and latency in ms. | **No message text logged**: Logs metrics only. Message content, conversation history, and assistant replies are **never** logged. |
| **Assistant Error Logger** | [`backend/src/routes/assistant.js`](file:///Users/balaji.v/travalastic/backend/src/routes/assistant.js#L85) | `userId`, message character length, latency, exception `error.message`. | Error message only. Request body and prompt text are not logged. |
| **Disruption Webhook Loggers** | [`backend/src/routes/duffelWebhook.js`](file:///Users/balaji.v/travalastic/backend/src/routes/duffelWebhook.js#L65) | Duffel event ID (`wev_...`), event type, outcome label (`skipped`, `duplicate`, `success`), error message on failure. | Webhook metadata only. Raw payload, signature headers, passenger names, and PNRs are **never** logged. |
| **Disruption Proposal Loggers**| [`backend/src/services/disruptions/proposal.js`](file:///Users/balaji.v/travalastic/backend/src/services/disruptions/proposal.js#L315) | `disruptionId` and outcome enum (`generated`, `cached`, `manual_review`, `failed`). | Disruption identifier and processing status only. Itinerary text, activity titles, and proposed changes are **never** logged. |
| **Disruption Lifecycle Loggers**| [`backend/src/services/disruptions/lifecycle.js`](file:///Users/balaji.v/travalastic/backend/src/services/disruptions/lifecycle.js#L87) | `disruptionId`, action (`approve`, `dismiss`, `undo`), outcome (`idempotent`, `crash_recovery`, `success`). | Operational audit identifiers only. |
| **Flight Booking Error Loggers**| [`backend/src/routes/flights.js`](file:///Users/balaji.v/travalastic/backend/src/routes/flights.js#L573) | `saveError` (Mongoose DB persistence failure) and `error` (Duffel API order creation error). | Mongoose error or Duffel API error object. May contain validation field names if payload was rejected. |
| **External API Error Loggers** | [`backend/src/services/travelAssistantService.js`](file:///Users/balaji.v/travalastic/backend/src/services/travelAssistantService.js#L472), [`backend/src/services/packingListService.js`](file:///Users/balaji.v/travalastic/backend/src/services/packingListService.js#L322) | Fallback model error messages (`err.message`). | Technical exception strings only. Prompts and completions are not logged. |
| **Global Error Handler** | [`backend/src/server.js`](file:///Users/balaji.v/travalastic/backend/src/server.js#L108) | `console.error(err.stack)`. | Unhandled call stack traces. Does not log request body. |

### Verification of Specific Audit Claims
- `grep -rn "console\." backend/src | wc -l`: **89 occurrences**. None of these console calls log request bodies, prompt texts, or LLM generation outputs.
- <!-- claim: travel-assistant-not-stored verified --> **Travel Assistant messages not stored**: **VERIFIED**. Proven by code: `POST /assistant/message` in [`backend/src/routes/assistant.js`](file:///Users/balaji.v/travalastic/backend/src/routes/assistant.js) has zero database write operations. No Mongoose model exists for assistant conversations.
- <!-- claim: travel-assistant-not-logged verified --> **Travel Assistant messages not logged**: **VERIFIED**. Proven by code: `routes/assistant.js` lines 74 & 85 log strictly `userId`, `msgLen` (number), `toolUsed` (boolean), `latencyMs`, and `error.message`.
- <!-- claim: trip-chat-stored verified --> **Trip chat messages ARE stored**: **VERIFIED**. Confirmed: messages are stored in MongoDB in the `conversations` collection (`Conversation` model in [`backend/src/models/Conversation.js`](file:///Users/balaji.v/travalastic/backend/src/models/Conversation.js)) and retained until user account deletion.
- <!-- claim: tracing-disabled verified --> **LLM Tracing disabled**: **VERIFIED**. Confirmed: No LangSmith or LangChain tracing environment variables (`LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`) are configured or referenced in the codebase.

---

## E. Client-Side Storage

| App | Storage Mechanism | Key Name | Content & Sensitivity | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `SecureStore` (iOS Keychain / Android Keystore) | `travalastic_token` | Active JWT authentication token (contains encoded `userId` and `email`). Cleared on logout and account deletion. | [`mobile/src/context/AuthContext.js`](file:///Users/balaji.v/travalastic/mobile/src/context/AuthContext.js#L53), [`mobile/src/utils/authCleanup.js`](file:///Users/balaji.v/travalastic/mobile/src/utils/authCleanup.js#L21) |
| **Mobile** | `SecureStore` (Legacy Reads) | `userToken`, `token` | Read-only backward compatibility check during app startup; never written by current app. | [`mobile/src/context/AuthContext.js`](file:///Users/balaji.v/travalastic/mobile/src/context/AuthContext.js#L31) |
| **Mobile** | `AsyncStorage` | *None* | **Not used.** `@react-native-async-storage/async-storage` is not installed or referenced. | [`mobile/package.json`](file:///Users/balaji.v/travalastic/mobile/package.json) |
| **Mobile** | Volatile In-Memory Only | `inMemoryAssistantConversation` | Travel Assistant conversation history. Volatile JavaScript array; cleared on "Clear Chat", logout, or account deletion. Never persisted to disk. | [`mobile/screens/TravelAssistantScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/TravelAssistantScreen.js#L24), [`mobile/utils/authCleanup.js`](file:///Users/balaji.v/travalastic/mobile/utils/authCleanup.js#L13) |
| **Web** | `localStorage` | `travalastic_token` | Active JWT authentication token. Cleared on user logout. *(Security note: accessible via XSS; see Section H)*. | [`web/src/lib/auth.ts`](file:///Users/balaji.v/travalastic/web/src/lib/auth.ts#L3), [`web/src/store/AuthContext.tsx`](file:///Users/balaji.v/travalastic/web/src/store/AuthContext.tsx) |
| **Web** | `sessionStorage` | *None* | **Not used.** Zero references across `web/src/`. | [`web/src/`](file:///Users/balaji.v/travalastic/web/src) |
| **Web** | Cookies (`document.cookie`) | *None* | **Not used.** Zero cookie read/write operations across `web/src/`. | [`web/src/`](file:///Users/balaji.v/travalastic/web/src) |
| **Web** | Volatile In-Memory Only | Flight Booking Component State | Passenger full names, birthdates, title, gender, contact email, and contact phone collected during flight booking. Held exclusively in volatile React component state; zero persistence to `localStorage`, `sessionStorage`, cookies, query parameters, or client console logs. Transmitted over HTTPS to backend `POST /flights/book` (forwarded to Duffel and persisted per Section B `bookings`), then purged from client memory immediately upon booking confirmation or navigating away. | [`web/src/pages/traveler/FlightBookingPage.tsx`](file:///Users/balaji.v/travalastic/web/src/pages/traveler/FlightBookingPage.tsx) |

---

## F. Browser-Side Third-Party Requests (Web App)

| Host | Count / URLs | Data Received by Host | Purpose | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `fonts.googleapis.com` & `fonts.gstatic.com` | 1 stylesheet link (`DM Serif Display`, `Inter`, `JetBrains Mono`) + underlying font file fetches | Visitor browser IP address, User-Agent, referer header. | Typography rendering in browser. | [`web/src/index.css`](file:///Users/balaji.v/travalastic/web/src/index.css#L1) |
| `images.unsplash.com` | 222 hardcoded image URLs across mock data and page views | Visitor browser IP address, User-Agent, referer header. | Destination and activity photography display. | [`web/src/data/mockData.ts`](file:///Users/balaji.v/travalastic/web/src/data/mockData.ts) |
| `tile.openstreetmap.org` (OpenStreetMap Tile Server) | Dynamic raster tile image requests (`/{z}/{x}/{y}.png`) | Map area coordinates (tile coordinates x, y, zoom level) and the user's IP address, per standard HTTP tile requests. No user credentials, tokens, account data, or itinerary text are transmitted. | OpenStreetMap raster map tiles for rendering grounded itinerary place markers. | [`web/src/components/itinerary/ItineraryMap.tsx`](file:///Users/balaji.v/travalastic/web/src/components/itinerary/ItineraryMap.tsx) |
| Booking.com (Outbound affiliate redirect) | User-initiated outbound link (`booking.com/searchresults.html`) | Destination query (`ss`), stay dates (`checkin`, `checkout`), guest count (`group_adults`), room count (`no_rooms`), affiliate tag (`aid`). Zero user identity, zero PII, zero tokens, zero account data. | Live hotel room availability and real-time rate lookup on Booking.com. | Generated server-side with `process.env.BOOKING_AFFILIATE_ID` in [`backend/src/routes/hotels.js`](file:///Users/balaji.v/travalastic/backend/src/routes/hotels.js#L44), augmented on client in [`web/src/lib/stay.ts`](file:///Users/balaji.v/travalastic/web/src/lib/stay.ts), opened in new tab via [`web/src/components/hotels/CuratedHotelCard.tsx`](file:///Users/balaji.v/travalastic/web/src/components/hotels/CuratedHotelCard.tsx). |
| Uber (Outbound universal link) | User-initiated outbound universal link (`m.uber.com/ul/`) | Dropoff coordinates (`dropoff[latitude]`, `dropoff[longitude]`, `dropoff[nickname]`), default `pickup=my_location` (Uber automatically resolves user location; browser never prompts or accesses location), optional client ID. Zero user identity, zero PII, zero tokens, zero account data. | Outbound navigation to Uber ride booking with destination pre-set. | [`web/src/lib/transportLinks.ts`](file:///Users/balaji.v/travalastic/web/src/lib/transportLinks.ts), [`web/src/pages/traveler/GroundTransportPage.tsx`](file:///Users/balaji.v/travalastic/web/src/pages/traveler/GroundTransportPage.tsx) |
| RentalCars (Outbound affiliate redirect) | User-initiated outbound affiliate link (`rentalcars.com/search-results`) | Pickup location name (`locationName`, `dropLocationName`), pickup date (`pickupDate`), drop-off date (`dropoffDate`), affiliate tag (`aid`, `affiliateCode`). Zero user identity, zero PII, zero tokens, zero account data. | Outbound affiliate redirect for car rental search on Rentalcars.com. | Generated server-side via [`backend/src/routes/cars.js`](file:///Users/balaji.v/travalastic/backend/src/routes/cars.js), fallback in [`web/src/lib/transportLinks.ts`](file:///Users/balaji.v/travalastic/web/src/lib/transportLinks.ts), opened via [`web/src/pages/traveler/GroundTransportPage.tsx`](file:///Users/balaji.v/travalastic/web/src/pages/traveler/GroundTransportPage.tsx). |
| Analytics / Custom Scripts | **0** | None | No third-party analytics (Google Analytics, Mixpanel, Sentry) or tracking scripts are present in `web/index.html`, `web/vite.config.ts`, or `web/.figma/make/site.json`. | [`web/index.html`](file:///Users/balaji.v/travalastic/web/index.html), [`web/.figma/make/site.json`](file:///Users/balaji.v/travalastic/web/.figma/make/site.json) |

---

## G. Account Deletion Coverage

| Model Name | Has `userId`? | Deleted on Account Deletion? | Deletion Operation & Query | Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `User` | Yes (`_id`) | **Yes** | `User.deleteOne({ _id: userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js) |
| `Itinerary` | Yes (`userId`) | **Yes** | `Itinerary.deleteMany({ userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js) |
| `Conversation` | Yes (`userId`) | **Yes** | `Conversation.deleteMany({ userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js) |
| `Expense` | Yes (`userId`) | **Yes** | `Expense.deleteMany({ userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js) |
| `Booking` | Yes (`userId`)* | **Yes** (Authenticated bookings) | `Booking.deleteMany({ userId })` *(Unauthenticated orphan risk noted in Section H)* | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js) |
| `PackingTemplate` | Yes (`userId`) | **Yes** | `PackingTemplate.deleteMany({ userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js), [`backend/test/packingTemplates.test.js`](file:///Users/balaji.v/travalastic/backend/test/packingTemplates.test.js#L99) |
| `Disruption` | Yes (`userId`) | **Yes** | `Disruption.deleteMany({ userId })` | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js), [`backend/test/disruptions.test.js`](file:///Users/balaji.v/travalastic/backend/test/disruptions.test.js#L489) |
| `CuratedHotel` | No | **Exempt** | Shared curated catalog; contains no personal data. | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js#L14) |
| `CuratedRoute` | No | **Exempt** | Static transit definitions; contains no personal data. | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js#L15) |
| `DestinationContent` | No | **Exempt** | Public destination search embeddings; contains no personal data. | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js#L16) |
| `TouristPlace` | No | **Exempt** | Public tourist attraction database; contains no personal data. | [`backend/test/accountDeletionCoverage.test.js`](file:///Users/balaji.v/travalastic/backend/test/accountDeletionCoverage.test.js#L17) |

---

## H. Gaps and Decisions

1. **Empty Legal Entity Name and Privacy Contact Email**  
   - **Severity**: `blocks launch`  
   - **Risk**: In `legal-site/legal-config.json`, `companyName` and `supportEmail` are empty strings. Play Store policy, GDPR, CCPA, and India DPDP Act require clearly identifying the legal data controller entity and providing an accessible contact email for privacy and deletion requests.  
   - **Suggested Fix**: Company ownership must supply the registered legal entity name and an active privacy contact email address (e.g. `privacy@travalastic.com`) before production submission.

2. **Unauthenticated Flight Booking Orphan Records**  
   - **Severity**: `blocks launch`  
   - **Risk**: In [`backend/src/routes/flights.js`](file:///Users/balaji.v/travalastic/backend/src/routes/flights.js) (`POST /flights/book`), the endpoint does not require the `authenticate` middleware. When a user books without an Authorization header and their passenger email is not already registered, the booking is stored with `userId: null`. When that user subsequently registers or deletes their account, `deleteUserAndData` queries strictly `{ userId }`. The booking document containing passenger names, dates of birth, emails, phone numbers, and Duffel ticket payloads remains orphaned in MongoDB.  
   - **Suggested Fix**: Enforce `authenticate` middleware on `POST /flights/book` to guarantee every booking is linked to a valid `userId`, and add email-based cleanup in `deleteUserAndData`: `{ $or: [{ userId }, { "passengers.email": userEmail }] }`.

3. **JWT Authentication Token Stored in Browser `localStorage`**  
   - **Severity**: `should fix`  
   - **Risk**: [`web/src/lib/auth.ts`](file:///Users/balaji.v/travalastic/web/src/lib/auth.ts#L1) stores the user's active JWT in browser `localStorage`. Any cross-site scripting (XSS) vulnerability in the web application can read and exfiltrate this session token.  
   - **Suggested Fix**: Transition web authentication to secure, `HttpOnly`, `SameSite=Lax` cookies with CSRF token verification.

4. **Third-Party Hotlinking of Fonts & Images on Web Client**  
   - **Severity**: `should fix`  
   - **Risk**: The web client loads Google Fonts from `fonts.googleapis.com` and 222 images from `images.unsplash.com`. Every browser visit transmits the user's IP address and browsing headers directly to Google and Unsplash servers without prior consent.  
   - **Suggested Fix**: Self-host web fonts (`.woff2` files via `@fontsource`) and serve destination imagery from Travalastic's own origin CDN / object storage before production launch.

5. **LLM Provider Data Retention and Model Training Terms**  
   - **Severity**: `needs decision`  
   - **Risk**: The backend sends user prompts, itinerary details, and chat messages to Groq and Cerebras. Commercial API terms typically state API data is not used for model training, but may be retained in provider server logs for 30 days for abuse monitoring.  
   - **Suggested Fix**: Management/Legal must review Groq's and Cerebras's enterprise Data Processing Agreements (DPAs) and confirm zero-retention / abuse-logging duration to ensure compliance with privacy representations.

6. **Public OpenStreetMap (Nominatim & Overpass) Acceptable Use Policies**  
   - **Severity**: `note`  
   - **Risk**: Backend relies on public OSM Nominatim and Overpass endpoints for place search and attraction queries without API keys. Increased production traffic risks IP-level rate-limiting or blocking under OSM fair use guidelines.  
   - **Suggested Fix**: Provision a paid or self-hosted geocoding and POI service (e.g. Mapbox, Google Maps Platform, or dedicated Nominatim container) prior to scaling.

7. **Cross-Border Cloud Data Hosting vs. India DPDP Act 2023**  
   - **Severity**: `needs decision`  
   - **Risk**: Backend is hosted on Render (US/EU regions) and MongoDB Atlas (cloud cluster). If servicing Indian residents, the India Digital Personal Data Protection Act 2023 guidelines on cross-border data transfer and security safeguards must be formally validated.  
   - **Suggested Fix**: Confirm cloud database region placement and ensure privacy policy explicitly informs users of overseas data processing.

---

## I. Open Questions for the Internship Team

1. **Age Threshold for Children / Minors**: What is the minimum age requirement for Travalastic user accounts? If minors under 18 (or under 13/16 depending on jurisdiction) can travel as passengers on flight bookings made by guardians, what consent verification mechanism should be documented?
2. **Account Deletion Retention Timelines**: Are MongoDB Atlas automated backups retained for 7, 14, or 30 days? When a user deletes their account, live database records are deleted immediately; what is the exact timeline for backup tape expiration?
3. **Flight Booking Guest Checkout**: Should flight booking require user registration/login upfront, or should guest booking be retained with an explicit email-based deletion flow?
4. **Third-Party CDN Migration**: Can destination images and Google Fonts be bundled into the web static build assets to achieve zero third-party browser network calls?
5. **Customer Support & Privacy Contact**: What email address should receive data subject access and deletion requests submitted via the hosted delete-account web page?

---

## J. Admin Panel & Operational Data Access

### 1. What Is Stored
* **`adminusers` Collection**:
  * `email`: Admin work email address.
  * `passwordHash`: Bcrypt-hashed password (salt rounds = 10); plaintext passwords are never stored.
  * `role`: Administrative role (`super_admin`, `content_editor`, `support_agent`).
  * `active`: Account status boolean (inactive accounts rejected immediately on all calls).
  * `mustChangePassword`: Boolean flag requiring password change at next login.
  * `passwordChangedAt`: Timestamp of last password change.
  * `tokensValidAfter`: Token invalidation cutoff timestamp (tokens issued prior are revoked).
  * `createdAt`: Account provisioning date.
  * `lastLoginAt`: Timestamp of last successful administrative sign-in.
  * `createdBy`: Reference to the Super Admin who provisioned the account.
* **`auditlogs` Collection**:
  * Fields: `at`, `actorId`, `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `summary`, `changes`.
  * **Privacy Guarantee**: Audit logs **never store passwords or traveler emails**. Traveler accounts are referenced strictly by database `userId`; email lookup operations record only whether a match occurred without persisting queried emails.

### 2. Role-Based Access Control Matrix
* **Super Admin (`super_admin`)**: Complete administrative control: manage admin accounts, reassign roles, reset passwords, inspect the operational audit log, manage places and hotels, edit style collections, search traveler accounts by exact email, and execute audited account deletions.
* **Content Editor (`content_editor`)**: Curated catalog management only: create, edit, hide, and restore tourist places and curated hotels; edit style collection picks. Zero access to admin accounts, audit logs, or traveler accounts.
* **Support Agent (`support_agent`)**: Traveler assistance only: exact-email account lookup and preview-then-confirm permanent account deletion with reason logging. Support agents never see trip itineraries, conversations, bookings, or expenses. Zero access to catalog editing or admin user management.

### 3. Session Credential Storage
Admin JWT tokens are stored strictly in volatile browser `sessionStorage` (and memory). Tokens are automatically destroyed upon tab close or sign-out, and are never saved to persistent `localStorage` or cookies.

### 4. Third-Party Hosts & Analytics
* **`https://images.pexels.com`**: Sourcing destination cover photos solely upon explicit user action ("Preview photo" button click).
* **Zero Analytics**: No third-party analytics tools (e.g. Google Analytics, Mixpanel), tracker scripts, or external telemetry are present in the admin panel.

### 5. Audit Log Retention
Audit log records are retained **indefinitely, to be decided by the team**, ensuring a permanent, tamper-evident operational compliance trail.

