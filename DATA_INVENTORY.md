# Travalastic Data Inventory & Privacy Audit

This document provides a comprehensive, read-only data audit of the Travalastic codebase (`backend/` and `mobile/`).

---

## 1. Stored User Data (Mongoose Models)

The backend database contains 9 Mongoose models across MongoDB collections. Below is the field-by-field breakdown detailing whether each field contains personal data and whether it is linked to a `userId`.

### 1.1 `users` Collection (`User` Model)
*File: `backend/src/models/User.js`*

| Field Name | Type | Personal Data? | Linked to `userId`? | Description / Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Yes (Is the `userId`) | Primary unique identifier for the user account |
| `email` | `String` | Yes | Yes | User's personal email address (unique, lowercase, trimmed) |
| `name` | `String` | Yes | Yes | User's full name |
| `passwordHash` | `String` | Yes | Yes | Bcrypt hash of the user's account password (authentication credential) |
| `createdAt` | `Date` | No | Yes | Account creation timestamp |

---

### 1.2 `itineraries` Collection (`Itinerary` Model)
*File: `backend/src/models/Itinerary.js`*

| Field Name | Type | Personal Data? | Linked to `userId`? | Description / Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | No | Yes | Itinerary unique document identifier |
| `userId` | `ObjectId` | Yes | Yes (Link Field) | Foreign key reference to `User._id` (indexed, required) |
| `rawRequest` | `String` | Yes | Yes | User's raw free-text travel prompt and trip requests |
| `destination` | `String` | Yes | Yes | Destination of user's personal trip |
| `startDate` | `String` | Yes | Yes | Trip start date (YYYY-MM-DD) |
| `endDate` | `String` | Yes | Yes | Trip end date (YYYY-MM-DD) |
| `budgetTier` | `String` | Yes | Yes | User's budget preference (`budget`, `mid`, `luxury`) |
| `interests` | `[String]` | Yes | Yes | Array of user's personal travel interests and preferences |
| `budgetEstimate` | `Number` | Yes | Yes | Total calculated budget allocation in INR |
| `days` | `[DayPlanSchema]` | Yes | Yes | Day-by-day itinerary contents (see nested fields below) |
| `days[].dayNumber` | `Number` | Yes | Yes | Daily schedule day index |
| `days[].activities` | `[Mixed]` | Yes | Yes | Array of planned activities (`title`, `name`, `description`, `suggestedTime`, `placeId`, `location: { lat, lon, placeName }`) |
| `days[].estimatedCostINR`| `Number` | Yes | Yes | Daily estimated spending |
| `days[].accommodationSuggestion` | `String` | Yes | Yes | Hotel or stay recommendation tailored to user |
| `packingList` | `[PackingCategorySchema]` | Yes | Yes | Categorized packing list (`category`, `items: [String]`) tailored to user's itinerary activities |
| `createdAt` | `Date` | No | Yes | Creation timestamp |

---

### 1.3 `conversations` Collection (`Conversation` Model)
*File: `backend/src/models/Conversation.js`*

| Field Name | Type | Personal Data? | Linked to `userId`? | Description / Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | No | Yes | Conversation document identifier |
| `userId` | `ObjectId` | Yes | Yes (Link Field) | Foreign key reference to `User._id` (indexed, required) |
| `itineraryId` | `ObjectId` | Yes | Yes | Foreign key reference to `Itinerary._id` (indexed, required) |
| `messages` | `[MessageSchema]` | Yes | Yes | Array of chat interaction objects |
| `messages[].role` | `String` | No | Yes | Sender role (`user` or `assistant`) |
| `messages[].content`| `String` | Yes | Yes | Free-text chat messages submitted by user and assistant responses |
| `messages[].timestamp` | `Date` | No | Yes | Message timestamp |
| `createdAt` | `Date` | No | Yes | Document creation timestamp |
| `updatedAt` | `Date` | No | Yes | Document last update timestamp |

---

### 1.4 `expenses` Collection (`Expense` Model)
*File: `backend/src/models/Expense.js`*

| Field Name | Type | Personal Data? | Linked to `userId`? | Description / Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | No | Yes | Expense document identifier |
| `userId` | `ObjectId` | Yes | Yes (Link Field) | Foreign key reference to `User._id` (indexed, required) |
| `itineraryId` | `ObjectId` | Yes | Yes | Foreign key reference to `Itinerary._id` (indexed, required) |
| `description` | `String` | Yes | Yes | Free-text description of personal expenditure |
| `amountINR` | `Number` | Yes | Yes | Financial amount spent in INR |
| `category` | `String` | Yes | Yes | Category (`Food`, `Transport`, `Accommodation`, `Activities`, `Shopping`, `Other`) |
| `createdAt` | `Date` | No | Yes | Timestamp of expense entry |
| `updatedAt` | `Date` | No | Yes | Last modified timestamp |

---

### 1.5 `bookings` Collection (`Booking` Model)
*File: `backend/src/models/Booking.js`*

| Field Name | Type | Personal Data? | Linked to `userId`? | Description / Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | No | Yes / Conditional | Booking document identifier |
| `userId` | `ObjectId` | Yes | Yes (Link Field)* | Reference to `User._id` (*Optional in schema; null if booked unauthenticated) |
| `itineraryId` | `ObjectId` | Yes | Yes | Reference to `Itinerary._id` (optional, default: `null`) |
| `bookingReference` | `String` | Yes | Yes / Conditional | Airline PNR / Duffel booking reference code |
| `orderId` | `String` | Yes | Yes / Conditional | Duffel order identifier |
| `offerId` | `String` | No | Yes / Conditional | Duffel flight offer identifier |
| `type` | `String` | No | Yes / Conditional | Booking type (default `'flight'`) |
| `status` | `String` | Yes | Yes / Conditional | Order status (`confirmed`, etc.) |
| `airline` | `String` | Yes | Yes / Conditional | Airline carrier name |
| `origin` | `String` | Yes | Yes / Conditional | Flight departure airport / city code |
| `destination` | `String` | Yes | Yes / Conditional | Flight destination airport / city code |
| `departureTime` | `Date` | Yes | Yes / Conditional | Flight departure date and time |
| `arrivalTime` | `Date` | Yes | Yes / Conditional | Flight arrival date and time |
| `duration` | `String` | No | Yes / Conditional | Total flight travel duration |
| `passengers` | `[PassengerSchema]` | Yes | Yes / Conditional | Array of passenger traveler objects (see subfields below) |
| `passengers[].givenName` | `String` | Yes | Yes / Conditional | Passenger given / first name |
| `passengers[].familyName`| `String` | Yes | Yes / Conditional | Passenger family / last name |
| `passengers[].name` | `String` | Yes | Yes / Conditional | Passenger full name |
| `passengers[].dateOfBirth` | `String` | Yes | Yes / Conditional | Passenger date of birth (`YYYY-MM-DD`) |
| `passengers[].gender` | `String` | Yes | Yes / Conditional | Passenger gender (`m` / `f`) |
| `passengers[].title` | `String` | Yes | Yes / Conditional | Passenger title / honorific (`mr`, `ms`, etc.) |
| `passengers[].email` | `String` | Yes | Yes / Conditional | Passenger contact email |
| `passengers[].phoneNumber` | `String` | Yes | Yes / Conditional | Passenger phone number |
| `passengerNames` | `[String]` | Yes | Yes / Conditional | Full passenger names list |
| `totalAmount` | `String` | Yes | Yes / Conditional | Financial payment amount |
| `currency` | `String` | Yes | Yes / Conditional | Transaction currency (e.g. `USD`, `INR`) |
| `slices` | `Array` | Yes | Yes / Conditional | Flight segment and route details |
| `rawOrder` | `Object` | Yes | Yes / Conditional | Complete raw Duffel API response payload containing tickets, documents, and passenger data |
| `createdAt` | `Date` | No | Yes / Conditional | Booking creation timestamp |
| `updatedAt` | `Date` | No | Yes / Conditional | Booking update timestamp |

---

### 1.6 Public Catalog Collections (No Personal Data)

The following 4 collections hold static, curated, or scraped public catalog records:

1. **`curatedhotels` (`CuratedHotel` Model)** (`backend/src/models/CuratedHotel.js`):
   - Fields: `_id`, `destination`, `budgetTier`, `name`, `priceRangeINR`, `rating`, `createdAt`.
   - Personal Data: **No**.
   - Linked to `userId`: **No**.
2. **`curatedroutes` (`CuratedRoute` Model)** (`backend/src/models/CuratedRoute.js`):
   - Fields: `_id`, `mode`, `origin`, `destination`, `approxDurationHours`, `frequency`, `note`, `createdAt`.
   - Personal Data: **No**.
   - Linked to `userId`: **No**.
3. **`destinationcontents` (`DestinationContent` Model)** (`backend/src/models/DestinationContent.js`):
   - Fields: `_id`, `text`, `tags`, `embedding`, `createdAt`.
   - Personal Data: **No**.
   - Linked to `userId`: **No**.
4. **`touristplaces` (`TouristPlace` Model)** (`backend/src/models/TouristPlace.js`):
   - Fields: `_id`, `name`, `city`, `state`, `zone`, `type`, `significance`, `googleRating`, `entranceFeeINR`, `timeNeededHours`, `bestTimeToVisit`, `embedding`, `createdAt`, `updatedAt`.
   - Personal Data: **No**.
   - Linked to `userId`: **No**.

---

## 2. Outbound Third-Party Calls

This section maps all external network requests, SDK invocations, and third-party APIs called across `backend/` and `mobile/`.

### 2.1 LLM Providers

| Provider | File(s) Making the Call | Function / Node | Model Used | API Key Variable | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cerebras** | `backend/src/services/agents/plannerNode.js` | `plannerNode` (Primary) | `llama3.1-70b` | `CEREBRAS_API_KEY` | `rawRequest` (user's raw travel request / prompt text). Target endpoint: `https://api.cerebras.ai/v1`. |
| **Groq** | `backend/src/services/agents/plannerNode.js` | `plannerNode` (Secondary fallback) | `openai/gpt-oss-20b` | `GROQ_API_KEY` | `rawRequest` (user's raw travel request / prompt text). Target endpoint: `https://api.groq.com/openai/v1`. |
| **Groq** | `backend/src/services/agents/intentNode.js` | `intentNode` | `openai/gpt-oss-120b` (fallback: `openai/gpt-oss-20b`) | `GROQ_API_KEY` | `message` / `rawRequest` (user's free-text chat message or trip request). |
| **Groq** | `backend/src/services/agents/editNode.js` | `editItinerary` (Step 1 analysis & Step 2 day regeneration) | `openai/gpt-oss-120b` (fallback: `openai/gpt-oss-20b`) | `GROQ_API_KEY` | `editRequest` (user modification request text), trip destination, budget tier, travel interests, original activities & costs. |
| **Groq** | `backend/src/services/agents/qaNode.js` | `qaNode` | `openai/gpt-oss-120b` (fallback: `openai/gpt-oss-20b`) | `GROQ_API_KEY` | `question` (user's free-text chat query), trip destination, dates, budget tier, interests, complete daily activities, hotel suggestions, and packing list. |
| **Groq** | `backend/src/services/ai/composerNode.js` | `composerNode` | `openai/gpt-oss-120b` (fallback: `openai/gpt-oss-20b`) | `GROQ_API_KEY` | `destination`, travel dates (`startDate`, `endDate`), `budgetTier`, `budgetEstimate`, `interests`, `rawRequest`, and personalized travel blurbs. |
| **Groq** | `backend/src/services/packingListService.js` | `generatePackingList` | `openai/gpt-oss-120b` (fallback: `openai/gpt-oss-20b`) | `GROQ_API_KEY` | `destination`, travel dates, `budgetTier`, `interests`, and all daily activities planned across the itinerary. |

> **LLM Provider Summary**:  
> The codebase uses **both Cerebras and Groq**.  
> - `plannerNode.js` invokes **Cerebras** as its primary LLM via `@langchain/openai` targeting `https://api.cerebras.ai/v1`, falling back to Groq if Cerebras fails.  
> - `intentNode.js`, `editNode.js`, `qaNode.js`, `composerNode.js`, and `packingListService.js` invoke **Groq** via `@langchain/groq`.

---

### 2.2 Embedding Provider

| Service | File(s) Making the Call | Function | Model / SDK | API Key Variable | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Gemini** | `backend/src/services/embeddingService.js` | `embedText` | `gemini-embedding-001` via `@google/genai` | `GEMINI_API_KEY` | - In `personalizationNode.js`: `interests` (user-selected travel interests/tags).<br>- In `destinations.js`: `destinationQuery` (search query string typed by user). |

---

### 2.3 Flight Aggregator (Duffel)

| Service | File(s) Making the Call | Method / Endpoint | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- |
| **Duffel API** | `backend/src/routes/flights.js` | `duffel.suggestions.list` | `query` (city / airport name typed by user). |
| **Duffel API** | `backend/src/routes/flights.js` | `duffel.offerRequests.create` | User's flight search parameters: origin, destination, departure date, return date, passenger count, cabin class. |
| **Duffel API** | `backend/src/routes/flights.js` | `duffel.offers.get` | Selected flight `offerId`. |
| **Duffel API** | `backend/src/routes/flights.js` | `duffel.orders.create` | **Sensitive personal traveler data**: Passenger full names (`given_name`, `family_name`), titles (`title`), genders (`gender`), dates of birth (`born_on`), contact emails (`email`), phone numbers (`phone_number`), and payment transaction amounts. |
| **Duffel API** | `backend/src/routes/flights.js` | `duffel.orders.get` | User's Duffel `orderId` (used to refresh booking status). |

---

### 2.4 Weather Provider

| Service | File(s) Making the Call | Method / Endpoint | API Key Variable | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- | :--- |
| **OpenWeather** | `backend/src/services/weatherService.js` | HTTP GET `https://api.openweathermap.org/data/2.5/forecast` | `OPENWEATHER_API_KEY` | Geographical coordinates (`latitude`, `longitude` of user's destination or requested location) and user's travel `date`. |

---

### 2.5 Geocoding and Mapping Providers

| Service | File(s) Making the Call | Method / Endpoint | API Key Variable | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- | :--- |
| **OpenStreetMap Nominatim** | `backend/src/services/placesService.js` | HTTP GET `https://nominatim.openstreetmap.org/search` | None (Throttled, custom User-Agent) | Destination or place search query typed by the user (`query`). |
| **OpenStreetMap Overpass** | `backend/src/services/overpassService.js` | HTTP POST `https://overpass-api.de/api/interpreter` | None (Custom User-Agent) | Destination geographical coordinates (`latitude`, `longitude` within 25km radius) corresponding to user's destination. |

---

### 2.6 Photography Provider

| Service | File(s) Making the Call | Method / Endpoint | API Key Variable | User-Derived Data Transmitted |
| :--- | :--- | :--- | :--- | :--- |
| **Pexels API** | `backend/src/services/pexelsService.js` | HTTP GET `https://api.pexels.com/v1/search` | `PEXELS_API_KEY` | Destination query string typed by user (e.g. `"Goa"`). |

---

### 2.7 Mobile Client Outbound Requests & Deep Links

- **Backend API Communication**: All `fetch()` requests in the mobile application (`mobile/config/apiClient.js`, `mobile/screens/*.js`) communicate **exclusively** with the self-hosted Travalastic backend (`API_BASE_URL`). The mobile app makes no direct third-party HTTP API calls.
- **External Deep Links (`Linking.openURL`)**:
  - `Uber` (`https://m.uber.com/ul/?action=setPickup` in `CabBookingScreen.js`): Transmits device GPS pickup coordinates (`latitude`, `longitude`), dropoff coordinates, and destination name to the Uber app/website.
  - `RentalCars` (`https://www.rentalcars.com/search-results?locationName=...` in `CarsScreen.js`): Transmits destination name.
  - `Google Maps` (`https://www.google.com/maps/search/?api=1&query=lat,lon` in `ItineraryScreen.js`): Transmits activity latitude and longitude.
  - `IRCTC` (`https://www.irctc.co.in/nget/train-search` in `TrainsAndBusesScreen.js`): Static link (no user data appended).
  - `RedBus` (`https://www.redbus.in/` in `TrainsAndBusesScreen.js`): Static link (no user data appended).

---

## 3. Device Permissions and On-Device Data

### 3.1 Device Permissions

| Permission | Module | Location in Code | Purpose | Is Data Sent to Backend? |
| :--- | :--- | :--- | :--- | :--- |
| **Foreground Location** | `expo-location` | `mobile/screens/CabBookingScreen.js` (`handleUseCurrentLocation`) | Requests user's current GPS location to pre-fill pickup coordinates when booking a cab. | **NO**. Device GPS coordinates (`latitude`, `longitude`) stay strictly on the device. They are stored only in local React state (`pickup`) and used client-side to generate an outbound Uber deep link URL. They are never sent to the backend. |

*Manifest declaration note*: In `mobile/app.json`, only `"plugins": ["expo-secure-store"]` is listed; `expo-location` permissions are requested dynamically at runtime via `Location.requestForegroundPermissionsAsync()`.

---

### 3.2 On-Device Storage Inventory

| Storage Mechanism | Key Name | File(s) Where Accessed | Stored Data & Sensitivity |
| :--- | :--- | :--- | :--- |
| **`SecureStore`** (iOS Keychain / Android Keystore) | `travalastic_token` | `mobile/App.js`, `mobile/config/apiClient.js`, `mobile/screens/LoginScreen.js`, `mobile/screens/SignUpScreen.js`, `mobile/screens/ProfileScreen.js`, `mobile/screens/EditProfileScreen.js`, `mobile/screens/HomeScreen.js` | User's active JWT authentication token. Contains encoded `userId` and user `email`. Cleared upon logout via `SecureStore.deleteItemAsync`. |
| **`SecureStore`** (Legacy Fallback Reads) | `userToken`, `token` | `mobile/App.js`, `mobile/src/context/AuthContext.js` | Legacy session token keys (checked read-only during startup for backward compatibility; never written). |
| **`AsyncStorage`** | *None* | *None* | **Not used.** `AsyncStorage` is not installed or referenced anywhere in `mobile/`. |
| **`localStorage`** (Web Only) | `travalastic_token` | `mobile/config/apiClient.js`, `mobile/screens/LoginScreen.js`, `mobile/screens/SignUpScreen.js` | Web platform fallback storing the JWT token in browser `localStorage`. |

---

## 4. Server-Side Logging

Below is the inventory of user-derived data that appears in server-side logs:

| Logging Mechanism | File / Location | What is Logged | Sensitivity & User Data Included |
| :--- | :--- | :--- | :--- |
| **Morgan HTTP Logger** (`morgan('dev')`) | `backend/src/server.js`, `server/server.js` | HTTP request method, URL path, query string, status code, response time. | **Destination & flight search queries, dates, and coordinates**: URLs containing query strings are logged to stdout. Examples:<br>- `GET /destinations/search?q=<destination>`<br>- `GET /flights/suggestions?query=<city>`<br>- `GET /flights/search?origin=BOM&destination=DEL...`<br>- `GET /weather?lat=...&lon=...`<br>- `GET /itinerary/<itineraryId>`<br>*(Request bodies are NOT logged by Morgan).* |
| **Error Stack Traces** (`console.error(err.stack)`) | `backend/src/server.js` | Unhandled error stacks. | May contain URL parameters or error messages resulting from malformed requests. |
| **External API Error Logs** | `backend/src/routes/flights.js` (lines 573, 587) | `console.error('Failed to persist booking:', saveError)` and `console.error('Duffel order creation error:', error)` | If Duffel or Mongoose rejects booking parameters, error messages containing invalid fields (e.g., passenger name or birthdate validation failures) may be written to server logs. |
| **Destination Name Logging** | `backend/src/services/pexelsService.js` (lines 136, 139) | `console.error('Error querying Pexels API for "<cleanName>":', err.message)` | User-searched destination name. |

> **Credentials & Chat Logging**:  
> User passwords, password hashes, JWT tokens, and free-text chat message contents are **NOT** logged in plaintext by any server-side loggers.

---

## 5. User Account Deletion Map

To fulfill a complete user account deletion ("Right to Be Forgotten"), the following map identifies all collections storing user-linked data, the exact link field to query, and flagged orphan data risks.

### 5.1 Deletion Target Map

| Collection Name | Mongoose Model | User Link Field | Deletion Query | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `User` | `_id` | `{ _id: targetUserId }` | Removes primary user account record, name, email, and password hash. |
| `itineraries` | `Itinerary` | `userId` | `{ userId: targetUserId }` | Removes all itineraries, custom schedules, and generated packing lists belonging to the user. |
| `conversations` | `Conversation` | `userId` | `{ userId: targetUserId }` | Removes all chat sessions and free-text AI conversation history. |
| `expenses` | `Expense` | `userId` | `{ userId: targetUserId }` | Removes all recorded trip expenses and spending records. |
| `bookings` | `Booking` | `userId` | `{ userId: targetUserId }` | Removes flight bookings, passenger names, birthdates, emails, and phone numbers. *(See orphan risk below)*. |

---

### 5.2 Flagged Orphan Collections (User Data Existing WITHOUT a `userId` Link)

> [!WARNING]  
> **CRITICAL FLAG: `bookings` Collection**  
> In [`backend/src/models/Booking.js`](file:///Users/balaji.v/travalastic/backend/src/models/Booking.js), the `userId` field is defined as optional:  
> ```javascript
> userId: {
>   type: mongoose.Schema.Types.ObjectId,
>   ref: 'User',
>   index: true,
> }
> ```  
> In [`backend/src/routes/flights.js`](file:///Users/balaji.v/travalastic/backend/src/routes/flights.js) (`POST /flights/book`), the endpoint does **not** enforce the `authenticate` middleware. Instead, it attempts best-effort resolution of `userId` from the Authorization header, `req.body.userId`, or by matching passenger emails against the `users` collection.  
>  
> **The Orphan Condition**:  
> If a user books a flight without an active authentication session (or without an Authorization header), and the passenger email does not match an existing registered user, the booking document is persisted with:  
> `userId: null`  
>  
> **Impact on Deletion**:  
> Personal passenger data (passenger full names, dates of birth, phone numbers, emails, PNR references, and Duffel ticket payloads) will exist in the `bookings` collection with `userId: null`. A standard account deletion query (`{ userId: targetUserId }`) will **fail to locate or delete these records**.  
>  
> To guarantee complete erasure, an account deletion procedure must also search the `bookings` collection for passenger email matches:  
> `{ $or: [{ userId: targetUserId }, { "passengers.email": targetUserEmail }] }`.

---

## 6. Two-assistant split addendum

This section audits the architectural data flow, logging footprint, third-party transmissions, on-device memory boundaries, and deletion guarantees introduced by the two-assistant separation: the trip-grounded Trip Chat assistant (`trip_question` route) and the stateless general Travel Assistant (`POST /assistant/message`).

Every claim in this section has been verified against the current codebase. For each item, the exact source file and function verifying the claim are explicitly identified.

---

### 6.1 Trip Chat: Trip-Question Grounding & Field Whitelist

*Files:*
- `backend/src/services/agents/tripContext.js` — function `buildTripContext(itinerary, expenseSummary, flightSummaries)`
- `backend/src/services/agents/tripQaNode.js` — functions `answerTripQuestion({ question, itineraryId, userId, conversationMessages, currentDate })`, `tripQaNode(state)`

#### Itinerary Fields Reaching the LLM Provider
When a user asks a trip-grounded question (`trip_question`), `answerTripQuestion` loads the itinerary fresh from MongoDB using `findUserItinerary(itineraryId, userId)` (preventing stale cache leaks and enforcing ownership). It passes the itinerary, logged expenses, and linked flight bookings to `buildTripContext`.

**Exclusively Whitelisted Fields Transmitted to LLM Provider (Groq):**
1. **Trip Overview**:
   - `destination` (`itin.destination`)
   - `startDate` and `endDate` (`itin.startDate`, `itin.endDate`)
   - `budgetTier` (`itin.budgetTier`)
   - `interests` (`itin.interests` — array of strings)
   - `budgetEstimate` (`itin.budgetEstimate`, explicitly labelled `"Total Estimated Cost: ₹<amount> (AI estimate)"`)
2. **Daily Schedule (`itin.days`)**:
   - `dayNumber` (`day.dayNumber`)
   - `estimatedCostINR` (`day.estimatedCostINR`, explicitly labelled `"Day Estimated Cost: ₹<amount> (AI estimate)"`)
   - `accommodationSuggestion` (`day.accommodationSuggestion`)
   - **Activities (`day.activities`)**:
     - `title` or `name`
     - `suggestedTime`
     - `description`
     - `done` (boolean status, rendered as `[Done]` or `[Not done]`)
     - `location` (`placeName`, `lat`, `lon` if present, rendered as `"Location known: Yes (<placeName>, lat: <lat>, lon: <lon>)"` or `"No"`)
3. **Logged Actual Expenses (`expenseSummary`)**:
   - `totalSpent` (sum of `amountINR`, explicitly labelled `"(actual, logged by the user, not tied to a specific day)"`)
   - `categoryTotals` (spending totals aggregated by category: `Food`, `Transport`, `Accommodation`, `Activities`, `Shopping`, `Other`)
4. **Linked Flight Bookings (`flightSummaries`)**:
   - Route (`f.origin → f.destination` or `slices[0].origin.iata_code → slices[0].destination.iata_code`)
   - Departure date/time (`f.departureTime` as ISO string or `f.departureDate`)
   - Booking status (`f.status`, e.g. `'confirmed'`)
5. **Conversation History**:
   - The most recent 6 messages (`role` and `content` only) from the active trip chat session (`conversationMessages.slice(-6)`), plus the current user question.
6. **Explicit NOT AVAILABLE List**:
   - Fixed prompt boundary notifying the LLM that traveler counts, opening hours, driving/travel times, ticket prices, hotel reservation confirmations, and ground transit bookings are not in the trip data and must never be invented.

#### Sensitive Passenger & Payment Data Exclusion Confirmation
- **Claim**: Passenger names, dates of birth, booking references, and payment data are **NEVER** included in the prompt or sent to the LLM provider, even when a flight booking is linked to the trip.
- **Verification Status**: **TRUE**.
- **Code Proof (`backend/src/services/agents/tripContext.js`, lines 156–194)**:
  `buildTripContext` iterates over linked `Booking` records and projects strictly three fields: route, departure time, and status (`• Route: ${route} | Departure: ${departure} | Status: ${status}`).
  The following sensitive `Booking` fields are completely excluded from the context:
  - Passenger names (`passengers[].givenName`, `passengers[].familyName`, `passengers[].name`, `passengerNames`) — **EXCLUDED**.
  - Passenger dates of birth (`passengers[].dateOfBirth`) — **EXCLUDED**.
  - Passenger genders and titles (`passengers[].gender`, `passengers[].title`) — **EXCLUDED**.
  - Passenger contact details (`passengers[].email`, `passengers[].phoneNumber`) — **EXCLUDED**.
  - Booking & Order references (`bookingReference`, Duffel PNR, `orderId`, `offerId`) — **EXCLUDED**.
  - Payment & financial transaction data (`totalAmount`, `currency`, Duffel `rawOrder` tickets and payment receipt payloads) — **EXCLUDED**.
  - Verified by automated unit test: `backend/test/tripContext.test.js` (`"fixture: passenger fields never appear even if present on the input"`).

---

### 6.2 Stateless Travel Assistant: `POST /assistant/message`

*Files:*
- `backend/src/routes/assistant.js` — route handler `router.post('/message', authenticate, assistantLimiter, ...)`
- `backend/src/services/travelAssistantService.js` — functions `validateAssistantRequest(body)`, `buildTripHint(itinerary, options)`, `callTravelAssistant({ message, history, tripHint, deps })`
- `backend/src/server.js` — server middleware configuration
- `backend/src/middleware/authenticate.js` — JWT authentication middleware

#### (a) Database Persistence: Zero Writes
- **Claim**: Nothing is written to the database during execution of `POST /assistant/message`.
- **Verification Status**: **TRUE**.
- **Code Proof**:
  - `backend/src/routes/assistant.js` imports only `findUserItinerary` from `../models/Itinerary.js`.
  - When `tripId` is provided, it executes `findUserItinerary(tripId, req.userId)` (`Itinerary.findOne({ _id: id, userId })`), which is a read-only query.
  - Across `backend/src/routes/assistant.js` and `backend/src/services/travelAssistantService.js`, there are **zero** database mutation calls: no `new Model()`, `.save()`, `.create()`, `.updateOne()`, `.findOneAndUpdate()`, `.deleteMany()`, or raw MongoDB writes.
  - There is no Mongoose model or MongoDB collection for Travel Assistant conversations.

#### (b) Logging Footprint: Zero Message, History, or Reply Logging
- **Claim**: No message text, conversation history, or assistant reply text is logged anywhere in server logs, logger calls, or error handlers on this path, including app-level middleware.
- **Verification Status**: **TRUE**.
- **Code Proof & Audit of All Logging Points on the Path**:
  1. **Route Success Logger** (`backend/src/routes/assistant.js`, line 74):
     `console.info(`[Assistant] userId=${req.userId} msgLen=${messageLength} toolUsed=${toolUsed} latency=${latencyMs}ms`);`
     Logs only user ID, message character length (`number`), boolean tool flag, and latency in milliseconds. Message text, history, and reply are not logged.
  2. **Route Error Logger** (`backend/src/routes/assistant.js`, line 85):
     `console.warn(`[Assistant] error userId=${req.userId} msgLen=${messageLength} latency=${latencyMs}ms: ${error.message}`);`
     Logs only user ID, message character length (`number`), latency, and the standard exception error message.
  3. **Service Fallback Loggers** (`backend/src/services/travelAssistantService.js`, lines 472, 508, 512):
     Logs only model configuration error names and exception messages (`bindErr.message`, `primaryErr.message`, `fallbackErr.message`).
  4. **App-Level HTTP Logger** (`backend/src/server.js`, line 33):
     Uses `morgan('dev')`. Morgan logs only `:method :url :status :response-time ms - :res[content-length]`. For this endpoint, the URL is `/assistant/message` with no query parameters. `morgan('dev')` **does not log request bodies (`req.body`) or response bodies**.
  5. **Authentication Middleware** (`backend/src/middleware/authenticate.js`, lines 33–36):
     Logs only `console.error('JWT_SECRET is not configured...')` if environment configuration is missing. Does not log tokens, headers, or request bodies.
  6. **App Global Error Handler** (`backend/src/server.js`, line 108):
     Logs `console.error(err.stack)`. Unhandled exceptions contain call stacks and error messages; request body contents are not attached to `Error` instances.

#### (c) Optional `tripId`: Prompt Contribution
- **Function**: `buildTripHint(itinerary)` in `backend/src/services/travelAssistantService.js` (lines 107–176).
- **Prompt Insertion**: `getAssistantSystemPrompt(tripHint)` in `backend/src/prompts/travelAssistant.js` (lines 35–40).
- When `tripId` is supplied and verified by `findUserItinerary(tripId, req.userId)`, `buildTripHint` extracts **strictly 5 whitelisted fields**:
  1. `destination` (`itin.destination`)
  2. `startDate` (`itin.startDate`)
  3. `endDate` (`itin.endDate`)
  4. `budgetTier` (`itin.budgetTier`)
  5. `interests` (`itin.interests` — array of strings)
- **Exact Added Prompt Text**:
  ```text
  HELPFUL TRIP CONTEXT (Provided as background context only, not as a restriction):
  Destination: <destination>
  Dates: <startDate> to <endDate>
  Budget Tier: <budgetTier>
  Interests: <interests comma separated>
  ```
- **Excluded**: Daily schedules, activities, costs, budget estimates, expenses, flight bookings, passenger names, packing lists, and raw requests are **NOT** added to the Travel Assistant prompt.

---

### 6.3 Third Parties Used by Two-Assistant Flows

| Third Party | Invoking File & Function | Target Endpoint | User-Derived Data Received |
| :--- | :--- | :--- | :--- |
| **Groq (ChatGroq)** | `backend/src/services/agents/tripQaNode.js` (`answerTripQuestion`) | `POST https://api.groq.com/openai/v1/chat/completions` | **Trip Chat**: User question, last 6 chat messages (`role`, `content`), and whitelisted trip context (destination, dates, budget tier, interests, daily activities with time bucket and done status, logged expense totals by category, linked flight route and status). |
| **Groq (ChatGroq)** | `backend/src/services/travelAssistantService.js` (`callTravelAssistant`) | `POST https://api.groq.com/openai/v1/chat/completions` | **Travel Assistant**: User message (1–1000 chars), up to 10 newest history messages (role and content truncated to 2000 chars), tool definitions, tool execution outputs, and optional 5-field trip hint (destination, dates, budget tier, interests) if `tripId` toggle was active. |
| **OpenStreetMap Nominatim** | `backend/src/services/placesService.js` (`searchPlaces`), invoked by `runForecastLookup` in `travelAssistantService.js` | `GET https://nominatim.openstreetmap.org/search?q=<place>&format=jsonv2...` | **Weather Tool Geocoding**: Destination/city query string extracted by the LLM (e.g. `"Goa"` or `"Mysore"`). No user IDs, tokens, or IP addresses forwarded. |
| **OpenWeather** | `backend/src/services/weatherService.js` (`getWeatherForecast`), invoked by `runForecastLookup` in `travelAssistantService.js` | `GET https://api.openweathermap.org/data/2.5/forecast?lat=<lat>&lon=<lon>&appid=...&units=metric` | **Weather Tool Forecast**: Destination latitude and longitude coordinates (resolved via Nominatim), target date (within 5-day window), metric units, and server API key. No user IDs, trip IDs, or user questions forwarded. |

---

### 6.4 Mobile Client: Memory Isolation & Lifecycle Cleanup

*Files:*
- `client/screens/TravelAssistantScreen.js` (and mirror files `client/src/screens/TravelAssistantScreen.js`, `mobile/screens/TravelAssistantScreen.js`, `mobile/src/screens/TravelAssistantScreen.js`)
- `client/utils/authCleanup.js` (and mirror files `client/src/utils/authCleanup.js`, `mobile/utils/authCleanup.js`, `mobile/src/utils/authCleanup.js`)
- `client/screens/ProfileScreen.js` (and mirror files)
- `client/screens/DeleteAccountScreen.js` (and mirror files)

#### On-Device Storage Verification
1. **Held in Memory Only**:
   - **Verification Status**: **TRUE**.
   - **Code Proof**: In `TravelAssistantScreen.js` (line 24), conversation history is stored exclusively in a module-scoped memory variable:
     ```javascript
     let inMemoryAssistantConversation = [];
     ```
     Component state initializes from and synchronizes with this array via `getTravelAssistantStore()` and `setTravelAssistantStore()`.
2. **Cleared on "Clear chat"**:
   - **Verification Status**: **TRUE**.
   - **Code Proof**: In `TravelAssistantScreen.js` (lines 163–168), `handleClearChat` invokes `clearTravelAssistantStore()`, resetting `inMemoryAssistantConversation = []` and clearing local React component state.
3. **Cleared on Logout**:
   - **Verification Status**: **TRUE**.
   - **Code Proof**: In `ProfileScreen.js` (line 36), `handleLogout` invokes `clearLocalAuthData()`. In `authCleanup.js` (line 13), `clearLocalAuthData()` explicitly calls `clearTravelAssistantStore()`, flushing all in-memory messages.
4. **Cleared on Account Deletion**:
   - **Verification Status**: **TRUE**.
   - **Code Proof**: In `DeleteAccountScreen.js` (line 37), `handleConfirmDelete` invokes `clearLocalAuthData()`, which calls `clearTravelAssistantStore()` prior to navigation to the login screen.
5. **No Persistence to SecureStore, AsyncStorage, or Files**:
   - **Verification Status**: **TRUE**.
   - **Code Proof**: `TravelAssistantScreen.js` does not import `expo-secure-store`, `@react-native-async-storage/async-storage`, or any filesystem libraries (`expo-file-system`, `fs`). No assistant message, session metadata, or reply is written to persistent on-device storage.

---

### 6.5 New Environment Variables, Dependencies, and Network Calls

#### Environment Variables Added
- **None**.
- **Verification**: Both the Trip Chat Q&A node (`tripQaNode.js`) and the Travel Assistant service (`travelAssistantService.js`) reuse existing environment variables already configured in the backend:
  - `GROQ_API_KEY` (existing LLM credentials)
  - `GROQ_MODEL` (existing optional model identifier override; defaults to `openai/gpt-oss-120b`)
  - `OPENWEATHER_API_KEY` (existing weather API credentials)
  - `JWT_SECRET` (existing token verification secret)
  - `PORT` (existing server port)

#### New Dependencies Added
1. **Backend** (`backend/package.json`):
   - `express-rate-limit` (`^8.7.1`): Used in `backend/src/routes/assistant.js` to enforce the 30 requests/hour/user rate limit (`assistantLimiter`).
2. **Mobile / Client** (`client/package.json`, `mobile/package.json`):
   - `react-native-markdown-display` (`^7.0.2`): Used in `TravelAssistantScreen.js` and `ChatScreen.js` to render markdown formatting without table clipping.
   - Supporting gesture/animation libraries: `react-native-reanimated` (`4.5.1`), `react-native-gesture-handler` (`~2.32.0`), `react-native-draggable-flatlist` (`^4.0.3`).

#### Network Calls Added
1. **Client-to-Backend**:
   - `POST /assistant/message`: Auth-protected call carrying `{ message, history, tripId? }`.
   - `GET /itinerary`: Invoked once on mount by `TravelAssistantScreen.js` to discover the user's latest trip destination and dates for the optional trip context toggle chip.
2. **Backend Outbound**:
   - `POST https://api.groq.com/openai/v1/chat/completions` (invoked via `@langchain/groq` in `tripQaNode.js` and `travelAssistantService.js`).
   - `GET https://nominatim.openstreetmap.org/search?q=...` (invoked via `placesService.js` only when the Travel Assistant weather tool executes a forecast lookup).
   - `GET https://api.openweathermap.org/data/2.5/forecast?lat=...&lon=...` (invoked via `weatherService.js` only when the Travel Assistant weather tool executes a forecast lookup).

---

### 6.6 User Account Deletion Map Update: Travel Assistant Data

- **Question**: Does the Travel Assistant create any user-linked data requiring deletion?
- **Answer**: **NONE**.
- **Verification Status**: **PROVEN BY CODE**.
- **Code Proof**:
  - `POST /assistant/message` (`backend/src/routes/assistant.js`) is completely stateless. It performs zero `insert`, `save`, or `update` operations against MongoDB.
  - No database collection or document is created for assistant conversations, prompts, or replies.
  - On the client side, conversation history exists strictly in volatile device memory (`inMemoryAssistantConversation`) and is completely cleared upon account deletion via `clearLocalAuthData()` in `authCleanup.js`.
  - **Deletion Map Impact**: Section 5.1 requires **no new collections, models, or deletion queries**. The 5 audited collections (`users`, `itineraries`, `conversations`, `expenses`, `bookings`) remain the complete and exhaustive list of persisted user data collections.


