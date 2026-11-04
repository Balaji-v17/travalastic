# Travalastic Parity Audit Report: Mobile vs Web vs Backend

## Executive Summary
This report audits the Travalastic mobile client (`mobile/` Expo React Native), web client (`web/` React Vite), and backend API (`backend/` Express Node.js).
Total Findings: 14 across 12 analytical dimensions.
- **Blocks Demo**: 3 (F-01: Broken `/itinerary` call in Mobile Travel Assistant; F-05: Empty legal links showing unavailable alert; F-13: Unauthenticated flight bookings orphaned from history)
- **Wrong Data**: 4 (F-02: Total flight price mislabeled as "total per traveler" on mobile; F-03: Date shifting in UTC-negative zones; F-04: Trip end date calculation off by +1 day on mobile; F-14: Mobile passenger DOB loose validation)
- **Confusing**: 4 (F-06: 429 rate limit copy discrepancy in assistant chat; F-07: Silent auth token retention on 401 in mobile; F-09: Disruption simulator env var naming differences; F-11: AI edit proposal action buttons missing on web)
- **Cosmetic**: 3 (F-08: Trip status grouping tabs present on web but omitted on mobile; F-10: Silent localhost fallback in mobile release builds; F-12: Redundant backend weather routes)

---

## Release Blockers
1. **F-01 (`mobile/src/screens/TravelAssistantScreen.js:132`)**: Mobile calls non-existent `GET /itinerary` instead of `GET /itinerary/mine`, permanently breaking trip context loading in the Travel Assistant.
2. **F-02 (`mobile/src/screens/FlightSearchScreen.js:765`)**: Mobile displays Duffel total order amount with label `"total per traveler"`, presenting 2x–9x inflated per-person fares for group bookings.
3. **F-05 (`mobile/config/legal.js:3-5`)**: Mobile legal URLs are empty strings, causing policy links to display `"This page isn't available yet"`, violating Google Play and Apple App Store compliance requirements.
4. **F-10 (`mobile/src/config/api.js:6-8`)**: Missing `EXPO_PUBLIC_API_URL` silently defaults to `localhost:8000` or Android emulator IP `10.0.2.2:8000`, causing production app builds on real devices to fail all network calls.
5. **F-13 (`backend/src/routes/flights.js:379`)**: `POST /flights/book` lacks `authenticate` middleware, allowing guest users to book flights that become orphaned and never appear under `GET /bookings/mine`.

---

## "Agrees" Table (Verified with Codebase Evidence)
| Feature / Subsystem | Mobile Evidence | Web Evidence | Backend Contract | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **User Sign-up** | `mobile/src/screens/SignUpScreen.js:33` | `web/src/pages/traveler/AuthPage.tsx:75` | `backend/src/routes/auth.js:199` | Agrees: Both send `{ name, email, password }`, read `{ token, user }`, handle 400/409. |
| **User Login** | `mobile/src/screens/LoginScreen.js:32` | `web/src/pages/traveler/AuthPage.tsx:64` | `backend/src/routes/auth.js:202` | Agrees: Both send `{ email, password }`, read `{ token, user }`, handle 400/401. |
| **Current User Profile** | `mobile/src/screens/EditProfileScreen.js:45` | `web/src/pages/traveler/ProfilePage.tsx:66` | `backend/src/routes/auth.js:205` | Agrees: Both call `GET /auth/me` with Bearer JWT, read `{ user }`. |
| **Profile Update** | `mobile/src/screens/EditProfileScreen.js:95` | `web/src/pages/traveler/ProfilePage.tsx:103` | `backend/src/routes/auth.js:208` | Agrees: Both call `PATCH /auth/me` sending `{ name }`, read updated `{ user }`. |
| **Account Deletion** | `mobile/src/screens/DeleteAccountScreen.js:30` | `web/src/pages/traveler/DeleteAccountPage.tsx:55` | `backend/src/routes/auth.js:211` | Agrees: Both call `DELETE /auth/me` sending `{ password }`, clear client storage on 200. |
| **Destination Search** | `mobile/src/screens/ExploreScreen.js:59` | `web/src/pages/traveler/ExplorePage.tsx:282` | `backend/src/routes/destinations.js:401` | Agrees: Both query `?q=` or `?query=`, read `{ results, availableCategories }`. |
| **Destination Weather** | `mobile/src/screens/TodayScreen.js:171` | `web/src/pages/traveler/DestinationPage.tsx:51` | `backend/src/routes/destinations.js:407` | Agrees: Both query `?destination=` or `?lat=&lon=`, read weather forecast. |
| **Trip Generation** | `mobile/src/screens/TripRequestScreen.js:112` | `web/src/lib/itineraryApi.ts:113` | `backend/src/routes/itinerary.js:55` | Agrees: Both send `{ rawRequest }`, receive `{ itineraryId, itinerary }`. |
| **User Itineraries** | `mobile/src/screens/SavedItinerariesScreen.js:30` | `web/src/store/AppContext.tsx:267` | `backend/src/routes/itinerary.js:91` | Agrees: Both call `GET /itinerary/mine`, parse array of saved itineraries. |
| **Itinerary Detail** | `mobile/src/screens/ItineraryScreen.js:68` | `web/src/store/AppContext.tsx:282` | `backend/src/routes/itinerary.js:1563` | Agrees: Both call `GET /itinerary/:id`, render day-by-day activities. |
| **Airport Suggestions** | `mobile/src/screens/FlightSearchScreen.js:170` | `web/src/lib/flightsApi.ts:62` | `backend/src/routes/flights.js:36` | Agrees: Both call `GET /flights/airports?q=`, read `{ code, name, city, country }`. |
| **Flight Search** | `mobile/src/screens/FlightSearchScreen.js:330` | `web/src/lib/flightsApi.ts:88` | `backend/src/routes/flights.js:90` | Agrees: Both send `{ origin, destination, departureDate, passengers }`, read trimmed offers. |
| **Flight Offer Freshness**| `mobile/src/screens/PassengerFormScreen.js:101`| `web/src/lib/bookingApi.ts:122` | `backend/src/routes/flights.js:317` | Agrees: Both call `GET /flights/offers/:offerId`, handle 410/422 expiration gracefully. |
| **Flight Booking** | `mobile/src/screens/PassengerFormScreen.js:127`| `web/src/lib/bookingApi.ts:152` | `backend/src/routes/flights.js:379` | Agrees: Both send `{ offerId, passengers, itineraryId }`, receive booking record. |
| **Booking History** | `mobile/src/screens/BookingHistoryScreen.js:30` | `web/src/lib/bookingsApi.ts:89` | `backend/src/routes/bookings.js:12` | Agrees: Both call `GET /bookings/mine`, parse flight bookings array. |
| **Hotel Search** | `mobile/src/screens/HotelsScreen.js:166` | `web/src/lib/hotelsApi.ts:59` | `backend/src/routes/hotels.js:16` | Agrees: Both call `GET /hotels/search?destination=`, read curated hotel items. |
| **Hotel External Link** | `mobile/src/screens/HotelsScreen.js:192` | `web/src/pages/traveler/HotelsPage.tsx:93` | Client-derived Booking.com affiliate link | Agrees: Both direct out to Booking.com with destination and date query params. |
| **Disruptions List** | `mobile/src/api/disruptions.js:80` | `web/src/lib/disruptionsApi.ts:94` | `backend/src/routes/disruptions.js:51` | Agrees: Both query `GET /disruptions?itineraryId=`, parse disruption cards. |
| **Disruption Proposal** | `mobile/src/api/disruptions.js:111` | `web/src/lib/disruptionsApi.ts:126` | `backend/src/routes/disruptions.js:250` | Agrees: Both post `POST /disruptions/:id/proposal`, handle 429 rate limit. |
| **Disruption Approval** | `mobile/src/api/disruptions.js:128` | `web/src/lib/disruptionsApi.ts:143` | `backend/src/routes/disruptions.js:287` | Agrees: Both post `POST /disruptions/:id/approve`, update itinerary schedule. |
| **Disruption Dismissal**| `mobile/src/api/disruptions.js:144` | `web/src/lib/disruptionsApi.ts:159` | `backend/src/routes/disruptions.js:317` | Agrees: Both post `POST /disruptions/:id/dismiss`, transition to dismissed state. |
| **Disruption Undo** | `mobile/src/api/disruptions.js:158` | `web/src/lib/disruptionsApi.ts:175` | `backend/src/routes/disruptions.js:343` | Agrees: Both post `POST /disruptions/:id/undo`, revert schedule changes. |
| **Disruption Simulator**| `mobile/src/api/disruptions.js:177` | `web/src/lib/disruptionsApi.ts:193` | `backend/src/routes/disruptions.js:94` | Agrees: Both post `{ itineraryId, delayMinutes, structural }` to `/disruptions/simulate`. |
| **SIMULATED Badge** | `mobile/src/screens/DisruptionDetailScreen.js:330` | `web/src/components/disruptions/DisruptionBanner.tsx:79` | `backend/src/models/Disruption.js:64` | Agrees: Both display explicit `SIMULATED` pill when `disruption.source === 'simulation'`. |

---

## Detailed Findings (Ranked by Severity then Effort)

### 1. F-01 (Blocks Demo, Low Effort)
- **ID**: `F-01`
- **Severity**: Blocks Demo
- **Mobile Evidence**: In `mobile/src/screens/TravelAssistantScreen.js:132`:
  ```javascript
  const response = await apiClient('/itinerary');
  ```
- **Web Evidence**: In `web/src/components/chat/TravelAssistantPanel.tsx:26`:
  ```typescript
  const { selectedJourneyId, journeys } = useApp();
  // Reads trips hydrated from /itinerary/mine via AppContext.tsx:267
  ```
- **Backend Contract**: `backend/src/routes/itinerary.js:91` exports `router.get('/mine', authenticate, ...)`. There is no `GET /itinerary` route; calls to `GET /itinerary` return 404 Not Found (`backend/src/server.js:131`).
- **Proposed Fix (Mobile)**: In `mobile/src/screens/TravelAssistantScreen.js:132`, change `apiClient('/itinerary')` to `apiClient('/itinerary/mine')` so the user's saved trips successfully populate the assistant context picker.

### 2. F-02 (Wrong Data, Low Effort)
- **ID**: `F-02`
- **Severity**: Wrong Data
- **Mobile Evidence**: In `mobile/src/screens/FlightSearchScreen.js:761-765`:
  ```javascript
  <Text style={styles.priceAmount}>
    {item.price?.currency === 'USD' ? '$' : `${item.price?.currency} `}
    {Number(item.price?.amount || 0).toFixed(2)}
  </Text>
  <Text style={styles.priceSubtext}>total per traveler</Text>
  ```
- **Web Evidence**: In `web/src/lib/flightAdapter.ts:255-266`:
  ```typescript
  const totalAmount = raw.price?.amount || raw.total_amount || '0';
  const totalNum = parseFloat(totalAmount);
  let perAdultApprox = passengerCount > 1 ? (totalNum / passengerCount).toFixed(2) : null;
  // Labels totalAmount as total and shows ~per adult approx if passengers > 1
  ```
- **Backend Contract**: In `backend/src/routes/flights.js:203-206`:
  ```javascript
  price: { amount: offer.total_amount, currency: offer.total_currency }
  ```
  In Duffel API v2, `offer.total_amount` is the grand total for all passengers on the order, NOT the per-person rate.
- **Proposed Fix (Mobile)**: In `mobile/src/screens/FlightSearchScreen.js:765`, change `total per traveler` to `total for ${passengers || 1} ${passengers === 1 ? 'traveler' : 'travelers'}` or divide by `passengers` to compute the actual per-traveler rate.

### 3. F-05 (Blocks Demo, Low Effort)
- **ID**: `F-05`
- **Severity**: Blocks Demo
- **Mobile Evidence**: In `mobile/config/legal.js:3-5`:
  ```javascript
  export const PRIVACY_POLICY_URL = '';
  export const TERMS_URL = '';
  export const ACCOUNT_DELETION_INFO_URL = '';
  ```
  Lines 11–20 trigger `Alert.alert('Notice', "This page isn't available yet")` when any legal button is pressed in `ProfileScreen.js` or `DeleteAccountScreen.js`.
- **Web Evidence**: In `web/src/pages/legal/legalContent.ts:1-120`, `web/src/pages/traveler/PrivacyPage.tsx`, and `web/src/pages/traveler/DeleteAccountPage.tsx`, the web app serves interactive in-app pages for Privacy and Delete Account under the `privacy` and `delete-account` routes.
- **Backend/Repo Contract**: The project contains standalone static HTML pages in `legal-site/privacy.html` and `legal-site/delete-account.html`.
- **Proposed Fix (Mobile)**: In `mobile/config/legal.js:3-5`, assign hosted URL endpoints (e.g. `https://travalastic.com/privacy.html` and `https://travalastic.com/delete-account.html`) or render in-app web views corresponding to `legal-site/`.

### 4. F-10 (Cosmetic / Operational Blocker, Low Effort)
- **ID**: `F-10`
- **Severity**: Cosmetic in dev, Blocks Demo in production standalone builds
- **Mobile Evidence**: In `mobile/src/config/api.js:6-8`:
  ```javascript
  export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
  ```
  If `EXPO_PUBLIC_API_URL` is omitted from the build environment, standalone APKs or TestFlight builds connect to `localhost:8000` on the physical phone and fail all network requests.
- **Web Evidence**: In `web/src/lib/api.ts:7-11`:
  ```typescript
  if (!rawBaseUrl || typeof rawBaseUrl !== 'string' || !rawBaseUrl.trim()) {
    throw new Error('Missing required environment variable VITE_API_BASE_URL...');
  }
  ```
  Web fails fast at build/start time if the API URL is missing.
- **Backend Contract**: Requires incoming requests to target the deployed Express host and port (`backend/src/server.js:140`).
- **Proposed Fix (Mobile)**: In `mobile/src/config/api.js`, throw or log a prominent error when `process.env.EXPO_PUBLIC_API_URL` is empty outside development mode (`!__DEV__`).

### 5. F-13 (Blocks Demo, Medium Effort)
- **ID**: `F-13`
- **Severity**: Blocks Demo
- **Mobile Evidence**: In `mobile/src/screens/PassengerFormScreen.js:127`:
  Calls `POST /flights/book` without requiring user authentication. If the user is unauthenticated, `req.userId` is `null`.
- **Web Evidence**: In `web/src/lib/bookingApi.ts:152`:
  Calls `POST /flights/book` via `apiFetch`. If guest token is absent, `req.userId` is `null`.
- **Backend Contract**: `backend/src/routes/flights.js:379` does NOT mount the `authenticate` middleware on `POST /flights/book`. Lines 466–472 save the booking with `userId: req.userId || null`. Subsequently, `GET /bookings/mine` (`backend/src/routes/bookings.js:12`) queries `{ userId: req.userId }`. Because `userId` is `null`, guest bookings can never be retrieved or tracked.
- **Proposed Fix (Backend & Clients)**: In `backend/src/routes/flights.js:379`, mount `authenticate` middleware on `POST /flights/book` so bookings are always associated with an authenticated user account, and require login in both client booking funnels before final confirmation.

### 6. F-03 (Wrong Data, Medium Effort)
- **ID**: `F-03`
- **Severity**: Wrong Data
- **Mobile Evidence**: In `mobile/src/screens/TripHubScreen.js:72-78`:
  ```javascript
  const s = new Date(startDate);
  const e = new Date(endDate);
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  ```
  And in `mobile/src/screens/HotelsScreen.js:145`:
  ```javascript
  const cin = new Date(checkinDate.trim());
  ```
- **Web Evidence**: In `web/src/pages/traveler/JourneyPage.tsx:168-169`:
  ```tsx
  {new Date(journey.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
  ```
  And in `web/src/lib/itineraryAdapter.ts:94-104`:
  ```typescript
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const dayDate = new Date(startDate);
  dayDate.setDate(dayDate.getDate() + (dayNumber - 1));
  dateStr = dayDate.toISOString().split('T')[0];
  ```
- **Backend Contract**: Backend stores and returns pure date-only ISO strings `"YYYY-MM-DD"` (`backend/src/models/Itinerary.js:12-13`).
- **Explanation**: Per ECMAScript specification, `new Date("YYYY-MM-DD")` treats the string as UTC midnight (`00:00:00Z`). In timezones behind UTC (such as America/New_York UTC-5 or America/Los_Angeles UTC-8), UTC midnight corresponds to the prior evening (e.g. `2026-11-19 19:00:00 EST`). Calling `toLocaleDateString()` or `getDate()` shifts dates back by 1 calendar day. (Note: `web/src/lib/stay.ts` avoids this bug via regex component extraction).
- **Proposed Fix (Mobile & Web)**: Standardize all date-only string formatting in `mobile/src/screens/TripHubScreen.js`, `mobile/src/screens/HotelsScreen.js`, `web/src/pages/traveler/JourneyPage.tsx`, and `web/src/lib/itineraryAdapter.ts` to use numeric regex matching (`/^(\d{4})-(\d{2})-(\d{2})$/`) or `Date.UTC(...)` rather than parsing directly with `new Date(string)`.

### 7. F-04 (Wrong Data, Low Effort)
- **ID**: `F-04`
- **Severity**: Wrong Data
- **Mobile Evidence**: In `mobile/src/screens/TripHubScreen.js:104-105`:
  ```javascript
  const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  d.setDate(d.getDate() + (count || 1));
  ```
- **Web Evidence**: In `web/src/lib/itineraryAdapter.ts:103`:
  ```typescript
  dayDate.setDate(dayDate.getDate() + (dayNumber - 1));
  ```
- **Backend Contract**: `backend/src/routes/itinerary.js:69-70` stores `startDate` and `endDate` representing inclusive trip bounds.
- **Explanation**: For a 3-day trip starting on Nov 20, the days are Day 1 (Nov 20), Day 2 (Nov 21), and Day 3 (Nov 22). Mobile's `deriveEndDate` adds 3 to Nov 20, producing Nov 23 (4 calendar days). Web computes `dayNumber - 1`, correctly spanning 3 calendar days.
- **Proposed Fix (Mobile)**: In `mobile/src/screens/TripHubScreen.js:105, 113`, change `(count || 1)` to `Math.max(0, (count || 1) - 1)`.

### 8. F-14 (Wrong Data, Low Effort)
- **ID**: `F-14`
- **Severity**: Wrong Data
- **Mobile Evidence**: In `mobile/src/screens/PassengerFormScreen.js:87-88`:
  ```javascript
  const birthDate = new Date(p.dateOfBirth.trim());
  if (isNaN(birthDate.getTime()) || birthDate >= new Date()) { ... }
  ```
  Accepts free-form string formats like `"12/31/1990"` or `"Jan 1 2000"`, which standard JavaScript `Date` parsers may interpret unpredictably across Android JavaScriptCore and Hermes engines.
- **Web Evidence**: In `web/src/lib/passengerValidation.ts:85-115`:
  Strictly validates `YYYY-MM-DD` regex format, checks calendar day validity (e.g. rejects Feb 30 and invalid leap years), and verifies `utcDate <= refUTC`.
- **Backend Contract**: `backend/src/routes/flights.js:433` mandates `born_on` must be an ISO string matching `YYYY-MM-DD` for Duffel passenger creation.
- **Proposed Fix (Mobile)**: In `mobile/src/screens/PassengerFormScreen.js:85`, enforce regex `/^\d{4}-\d{2}-\d{2}$/` and calendar validation before submitting to `POST /flights/book`.

### 9. F-06 (Confusing, Low Effort)
- **ID**: `F-06`
- **Severity**: Confusing
- **Mobile Evidence**: In `mobile/src/screens/TravelAssistantScreen.js:236-238`:
  ```javascript
  } else if (response.status === 429) {
    setErrorMessage("You've reached the hourly limit. Try again later.");
  ```
- **Web Evidence**: In `web/src/lib/chatApi.ts:19-21`:
  ```typescript
  if (status === 429) {
    return new ChatError(429, "You're sending messages too quickly, wait a moment");
  }
  ```
- **Backend Contract**: In `backend/src/routes/assistant.js:13-22`:
  Rate limiter is configured with `windowMs: 60 * 60 * 1000` (1 hour) and `limit: 30`, returning `{ error: 'Too many assistant messages. Please try again after an hour.' }`.
- **Explanation**: Web tells the user to "wait a moment", which implies a short burst delay (seconds), when the backend actually throttles for an entire hour. Mobile's copy accurately reflects the hourly limit.
- **Proposed Fix (Web)**: In `web/src/lib/chatApi.ts:20`, update the message to `"You've reached the hourly limit. Please try again later."` or forward `err.message`.

### 10. F-07 (Confusing, Medium Effort)
- **ID**: `F-07`
- **Severity**: Confusing
- **Mobile Evidence**: In `mobile/src/config/apiClient.js:40-44`:
  `apiClient` executes standard fetch and returns raw response without status interception. On receiving a 401 Unauthorized, it does not clear `travalastic_token` from `SecureStore` or notify `AuthContext.js`.
- **Web Evidence**: In `web/src/lib/api.ts:105-110`:
  ```typescript
  if (res.status === 401 && !(normalizedPath === '/auth/me' && options?.method === 'DELETE')) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  ```
  Web centrally intercepts 401, clears localStorage, and dispatches an event causing `AuthContext.tsx` to transition the session to `anon`.
- **Backend Contract**: `backend/src/middleware/authenticate.js:28-34` returns `401 Unauthorized` with `{ error: 'Invalid or expired token' }`.
- **Proposed Fix (Mobile)**: In `mobile/src/config/apiClient.js`, intercept 401 responses, clear `SecureStore.deleteItemAsync('travalastic_token')`, and dispatch an auth reset event so the user is immediately transitioned to the login screen.

### 11. F-09 (Confusing, Low Effort)
- **ID**: `F-09`
- **Severity**: Confusing
- **Mobile Evidence**: `mobile/src/config/api.js:11` reads `process.env.EXPO_PUBLIC_ENABLE_SIMULATOR`.
- **Web Evidence**: `web/src/components/disruptions/SimulateDelayControl.tsx:16` reads `import.meta.env?.VITE_ENABLE_SIMULATOR`.
- **Backend Contract**: `backend/src/routes/disruptions.js:21, 98` checks `process.env.ENABLE_DISRUPTION_SIMULATOR === 'true'`.
- **Explanation**: The simulator flag name differs across all three tiers: `ENABLE_DISRUPTION_SIMULATOR` (backend) vs `EXPO_PUBLIC_ENABLE_SIMULATOR` (mobile) vs `VITE_ENABLE_SIMULATOR` (web). In `.env.example`, having `EXPO_PUBLIC_ENABLE_SIMULATOR=false` can confuse developers configuring the backend.
- **Proposed Fix (Documentation / Config)**: Standardize documentation in root `.env.example` to explicitly show the required variables for each tier side-by-side.

### 12. F-11 (Confusing, Medium Effort)
- **ID**: `F-11`
- **Severity**: Confusing
- **Mobile Evidence**: In `mobile/src/screens/ChatScreen.js:195-255`:
  Parses edit proposals from `POST /chat/message` and renders interactive "Review changes", "Apply to itinerary" (`applyReschedule`), and "Undo" buttons calling `POST /itinerary/:id/undo`.
- **Web Evidence**: In `web/src/components/chat/TripChatPanel.tsx:1-250`:
  Renders markdown text of the assistant's reply but does not render interactive apply or undo buttons, making AI trip chat read-only on web.
- **Backend Contract**: `backend/src/routes/chat.js:19-150` supports conversational modifications, returning `{ editId, undoable, updatedItinerary }`, and `backend/src/routes/itinerary.js:1463` supports `POST /itinerary/:id/undo`.
- **Proposed Fix (Web)**: In `web/src/components/chat/TripChatPanel.tsx`, add action buttons calling `apiFetch('/itinerary/:id/reschedule/apply')` and `apiFetch('/itinerary/:id/undo')` to match mobile parity.

### 13. F-08 (Cosmetic, Low Effort)
- **ID**: `F-08`
- **Severity**: Cosmetic
- **Mobile Evidence**: In `mobile/src/screens/SavedItinerariesScreen.js:37-64`:
  Renders a single flat list of all trips returned by `GET /itinerary/mine` sorted by creation date, with no status categorization badges.
- **Web Evidence**: In `web/src/pages/traveler/MyTripsPage.tsx:353-366` and `web/src/lib/journeyAdapter.ts:60-75`:
  Dynamically filters trips into tabs: `planning`, `upcoming`, and `completed` using `deriveStatus()`.
- **Backend Contract**: `backend/src/routes/itinerary.js:91` returns raw itinerary documents without computing a lifecycle status string.
- **Proposed Fix (Mobile)**: In `mobile/src/screens/SavedItinerariesScreen.js`, add segmented tab controls (`Planning`, `Upcoming`, `Completed`) matching the web presentation.

### 14. F-12 (Cosmetic, Low Effort)
- **ID**: `F-12`
- **Severity**: Cosmetic
- **Mobile Evidence**: Calls `GET /destinations/weather` (`mobile/src/screens/TodayScreen.js:171`).
- **Web Evidence**: Calls `GET /destinations/weather` (`web/src/pages/traveler/DestinationPage.tsx:51`).
- **Backend Contract**: Exposes both `GET /destinations/weather` (`backend/src/routes/destinations.js:407`) and `GET /weather` (`backend/src/server.js:97`). Both call `getWeatherForecast` with identical parameters. `GET /weather` is uncalled by both clients.
- **Proposed Fix (Backend)**: In `backend/src/server.js:97`, deprecate `GET /weather` and route all weather queries through `backend/src/routes/destinations.js:407`.

---

## 1. Complete Backend Endpoint Matrix (59 Routes)

| # | Route | Auth? | Request Fields | Response Fields | Error Codes | Client Callers | Client Fields Sent / Read | Differences & Flags |
|---|---|---|---|---|---|---|---|---|
| 1 | `GET /health` | No | None | `{ status: 'ok' }` | None | Web only (`web/src/lib/api.ts:141`) | Web reads `{ status }` | Web only health check; mobile does not poll `/health`. |
| 2 | `GET /health/db` | No | None | `{ status, db, state, readyState }` | None | Uncalled | None | Diagnostic endpoint; uncalled by both clients. |
| 3 | `POST /auth/signup` | No | Body: `{ name, email, password }` | `{ token, user: { id, name, email } }` | 400, 409, 500 | Mobile & Web (`SignUpScreen.js:33`, `AuthPage.tsx:75`) | Both send name, email, password; read token, user | Full parity. |
| 4 | `POST /auth/login` | No | Body: `{ email, password }` | `{ token, user: { id, name, email } }` | 400, 401, 500 | Mobile & Web (`LoginScreen.js:32`, `AuthPage.tsx:64`) | Both send email, password; read token, user | Full parity. |
| 5 | `GET /auth/me` | Yes (JWT) | Headers: Bearer JWT | `{ user: { id, name, email, createdAt } }` | 401, 404, 500 | Mobile & Web (`EditProfileScreen.js:45`, `ProfilePage.tsx:66`) | Both read `{ user }` | Full parity. |
| 6 | `PATCH /auth/me` | Yes (JWT) | Body: `{ name }` | `{ user: { id, name, email } }` | 400, 401, 404, 500 | Mobile & Web (`EditProfileScreen.js:95`, `ProfilePage.tsx:103`) | Both send `{ name }`, read updated `{ user }` | Full parity. |
| 7 | `DELETE /auth/me` | Yes (JWT) | Body: `{ password }` | `{ message: 'Account deleted successfully' }` | 400, 401, 404, 500 | Mobile & Web (`DeleteAccountScreen.js:30`, `DeleteAccountPage.tsx:55`)| Both send `{ password }`, clear client state | Full parity: deletes User, Itineraries, Expenses, Bookings, Disruptions. |
| 8 | `GET /destinations/trending` | No | None | `Array<{ id, name, country, imageUrl, description }>` | 500 | Mobile only (`HomeScreen.js:96`, `TrendingDestinationsScreen.js:364`)| Mobile reads trending cards | Mobile exclusive. |
| 9 | `GET /destinations/search` | No | Query: `?q=` or `?query=` | `{ results, destinations, availableCategories }` | 400, 502 | Mobile & Web (`ExploreScreen.js:59`, `ExplorePage.tsx:282`) | Both query by keyword, read results | Full parity. |
| 10| `GET /destinations/weather`| No | Query: `?lat=&lon=&date=` or `?destination=` | `{ description, temperature, windSpeed, humidity }` | 200 (fallback) | Mobile & Web (`TodayScreen.js:171`, `DestinationPage.tsx:51`) | Both send destination or coords | Full parity. |
| 11| `GET /weather` | No | Query: `?lat=&lon=&latitude=&longitude=&date=` | `{ description, temperature, ... }` | 200 (fallback) | Uncalled | None | Legacy alias; uncalled by both clients. |
| 12| `POST /itinerary/generate` | Yes (JWT) | Body: `{ rawRequest }` | `{ itineraryId, itinerary }` | 400, 401, 500 | Mobile & Web (`TripRequestScreen.js:112`, `itineraryApi.ts:113`) | Both send `{ rawRequest: string }`, read `{ itineraryId, itinerary }` | Full parity. |
| 13| `GET /itinerary/mine` | Yes (JWT) | Query: `?limit=` (opt) | `Array<Itinerary>` | 401, 500 | Mobile & Web (`SavedItinerariesScreen.js:30`, `AppContext.tsx:267`) | Both read array of saved trips | Full parity. |
| 14| `GET /itinerary/:id` | Yes (JWT) | Params: `id` | `Itinerary` document | 401, 404, 500 | Mobile & Web (`ItineraryScreen.js:68`, `AppContext.tsx:282`) | Both read full trip details | Full parity. |
| 15| `POST /itinerary/:id/packing-list` | Yes (JWT) | Params: `id` | `{ packingList: Array<Item> }` | 401, 404, 500 | Mobile only (`PackingListScreen.js:32`) | Mobile generates checklist from trip metadata | Mobile exclusive. |
| 16| `POST /itinerary/:id/packing/custom` | Yes (JWT) | Body: `{ name, category }` | Updated `{ packingList }` | 400, 401, 404, 500 | Mobile only (`PackingListScreen.js:146`) | Mobile adds user custom packing item | Mobile exclusive. |
| 17| `DELETE /itinerary/:id/packing/custom/:itemId` | Yes (JWT) | Params: `id`, `itemId` | Updated `{ packingList }` | 401, 404, 500 | Mobile only (`PackingListScreen.js:187`) | Mobile deletes custom packing item | Mobile exclusive. |
| 18| `POST /itinerary/:id/packing/apply-template` | Yes (JWT) | Body: `{ templateId, dryRun }` | `{ added, skippedDuplicates, skippedOverCap }` | 400, 401, 404, 500 | Mobile only (`TemplatesScreen.js:118`) | Mobile applies packing template | Mobile exclusive. |
| 19| `PATCH /itinerary/:id/packing/checked` | Yes (JWT) | Body: `{ itemId, checked }` | `{ success: true, item }` | 400, 401, 404, 500 | Mobile only (`PackingListScreen.js:98`) | Mobile toggles packed state | Mobile exclusive. |
| 20| `GET /itinerary/:id/bookings` | Yes (JWT) | Params: `id` | `Array<Booking>` | 401, 404, 500 | Mobile & Web (`TodayScreen.js:202`, `bookingsApi.ts:96`) | Both read bookings matching trip | Full parity. |
| 21| `POST /itinerary/:id/travelers` | Yes (JWT) | Body: `{ name }` | `{ traveler, travelers }` | 400, 401, 404, 500 | Mobile only (`ExpensesScreen.js:169`) | Mobile adds companion traveler | Mobile exclusive. |
| 22| `PATCH /itinerary/:id/travelers/:travelerId` | Yes (JWT) | Body: `{ name }` | `{ traveler, travelers }` | 400, 401, 404, 500 | Mobile only (`ExpensesScreen.js:196`) | Mobile renames companion traveler | Mobile exclusive. |
| 23| `DELETE /itinerary/:id/travelers/:travelerId` | Yes (JWT) | Params: `id`, `travelerId` | `{ success: true, travelers }` | 401, 404, 409, 500 | Mobile only (`ExpensesScreen.js:215`) | Mobile deletes traveler; 409 if in expenses | Mobile exclusive. |
| 24| `POST /itinerary/:id/expenses` | Yes (JWT) | Body: `{ description, amount, currency, paidBy, splitAmong }` | `{ expense, totals }` | 400, 401, 404, 500 | Mobile only (`ExpensesScreen.js:370`) | Mobile adds expense with FX conversion | Mobile exclusive. |
| 25| `GET /itinerary/:id/expenses` | Yes (JWT) | Params: `id` | `{ travelers, expenses, totals, balances, settlements }` | 401, 404, 500 | Mobile only (`ExpensesScreen.js:110`) | Mobile reads balances & settlement plan | Mobile exclusive. |
| 26| `DELETE /itinerary/:id/expenses/:expenseId` | Yes (JWT) | Params: `id`, `expenseId` | `{ success: true }` | 401, 404, 500 | Mobile only (`ExpensesScreen.js:425`) | Mobile deletes trip expense | Mobile exclusive. |
| 27| `PATCH /itinerary/:id/activities/done` | Yes (JWT) | Body: `{ dayNumber, activityIndex, done }` | Updated activity | 400, 401, 404, 500 | Mobile only (`TodayScreen.js:357`) | Mobile checks off activity | Mobile exclusive. |
| 28| `PUT /itinerary/:id/days/:dayNumber/order` | Yes (JWT) | Body: `{ order, expectedTitles }` | Updated DayPlan | 400, 401, 404, 409, 500 | Mobile only (`ReorderDayScreen.js:215`) | Mobile submits reordered permutation | Mobile exclusive. |
| 29| `POST /itinerary/:id/reschedule/preview` | Yes (JWT) | Body: `{ dayNumber, delayMinutes }` | `{ dayNumber, delayMinutes, items, summary }` | 400, 401, 404, 429, 500 | Mobile only (`TodayScreen.js:423`) | Mobile previews rescheduled day activities | Mobile exclusive. |
| 30| `POST /itinerary/:id/reschedule/apply` | Yes (JWT) | Body: `{ dayNumber, items }` | `{ updatedDay, editId }` | 400, 401, 404, 409, 500 | Mobile only (`TodayScreen.js:466`) | Mobile applies reschedule | Mobile exclusive. |
| 31| `GET /itinerary/:id/today-alerts` | Yes (JWT) | Params: `id`, Query: `?date=` | `{ alerts: Array<Alert> }` | 401, 404, 500 | Mobile only (`TodayScreen.js:127`) | Mobile fetches weather/schedule alerts | Mobile exclusive. |
| 32| `POST /itinerary/:id/undo` | Yes (JWT) | Body: `{ expectedEditId }` | `{ itinerary, revertedEditId }` | 400, 401, 404, 409, 500 | Mobile & Web (`disruptions.js:158`, `disruptionsApi.ts:175`) | Both call undo on schedule edits | Full parity. |
| 33| `GET /flights/airports` | No | Query: `?q=` | `Array<{ code, name, city, country }>` | 400, 500 | Mobile & Web (`FlightSearchScreen.js:170`, `flightsApi.ts:62`) | Both query IATA / place suggestions | Full parity. |
| 34| `POST /flights/search` | No | Body: `{ origin, destination, departureDate, passengers }` | `Array<TrimmedOffer>` | 400, 500, 502 | Mobile & Web (`FlightSearchScreen.js:330`, `flightsApi.ts:88`) | Both send search criteria; read offers | Full parity. |
| 35| `GET /flights/offers/:offerId` | No | Params: `offerId` | `{ isValid, offer, message }` | 400, 410, 422, 500 | Mobile & Web (`PassengerFormScreen.js:101`, `bookingApi.ts:122`)| Both re-verify offer price and expiry | Full parity. |
| 36| `POST /flights/book` | Optional (Bug F-13) | Body: `{ offerId, passengers, itineraryId }` | `{ booking: BookingDocument }` | 400, 410, 422, 500, 502 | Mobile & Web (`PassengerFormScreen.js:127`, `bookingApi.ts:152`)| Both submit booking form | Missing auth middleware (F-13). |
| 37| `GET /flights/bookings/:bookingId/status` | Yes (JWT) | Params: `bookingId` | `{ bookingId, status, pnr }` | 401, 404, 500 | Mobile & Web (`TodayScreen.js:209`, `bookingsApi.ts:120`) | Both poll Duffel order confirmation | Full parity. |
| 38| `GET /hotels/search` | No | Query: `?destination=` | `Array<CuratedHotel>` | 400, 500 | Mobile & Web (`HotelsScreen.js:166`, `hotelsApi.ts:59`) | Both query destination hotels | Full parity. |
| 39| `GET /admin/hotels` | No | Query: `?destination=` | `Array<CuratedHotel>` | 500 | Uncalled | None | Dev diagnostic route; uncalled by both clients. |
| 40| `GET /cars/search` | No | Query: `?location=&pickupDate=&dropoffDate=` | `Array<CarRentalOption>` | 400, 500 | Mobile only (`CarsScreen.js:70`) | Mobile reads rental quotes | Mobile exclusive. |
| 41| `GET /routes/search` | No | Query: `?origin=&destination=&date=` | `Array<TransitRoute>` | 400, 500 | Mobile only (`TrainsAndBusesScreen.js:61`) | Mobile reads train/bus schedules | Mobile exclusive. |
| 42| `POST /chat/message` | Yes (JWT) | Body: `{ itineraryId, message, conversationId }` | `{ reply, conversationId, editId, undoable, updatedItinerary }` | 400, 401, 404, 429, 500 | Mobile & Web (`ChatScreen.js:169`, `chatApi.ts:53`) | Mobile sends & processes edits; Web displays text only | Asymmetry: Web is read-only (F-11). |
| 43| `GET /bookings/mine` | Yes (JWT) | Headers: Bearer JWT | `Array<BookingDocument>` | 401, 500 | Mobile & Web (`BookingHistoryScreen.js:30`, `bookingsApi.ts:89`) | Both read user's bookings | Full parity. |
| 44| `DELETE /expenses/:expenseId` | Yes (JWT) | Params: `expenseId` | `{ success: true }` | 401, 404, 500 | Mobile only (`ExpensesScreen.js:428`) | Mobile deletes standalone expense | Mobile exclusive. |
| 45| `GET /fx/currencies` | No | None | `Array<{ code, name, symbol }>` | 500 | Uncalled | None | Currencies list; uncalled (hardcoded in UI). |
| 46| `GET /fx/rate` | No | Query: `?from=&to=&date=` | `{ rate, from, to, date }` | 400, 500 | Mobile only (`ExpensesScreen.js:227`) | Mobile converts expense currencies | Mobile exclusive. |
| 47| `POST /packing-templates` | Yes (JWT) | Body: `{ name, items }` | Created `PackingTemplate` | 400, 401, 500 | Mobile only (`SaveTemplateScreen.js:156`) | Mobile saves custom packing template | Mobile exclusive. |
| 48| `GET /packing-templates` | Yes (JWT) | Headers: Bearer JWT | `Array<PackingTemplate>` | 401, 500 | Mobile only (`TemplatesScreen.js:52`) | Mobile lists user & system templates | Mobile exclusive. |
| 49| `DELETE /packing-templates/:id` | Yes (JWT) | Params: `id` | `{ success: true }` | 401, 404, 500 | Mobile only (`TemplatesScreen.js:87`) | Mobile deletes custom packing template | Mobile exclusive. |
| 50| `POST /assistant/message` | Yes (JWT) | Body: `{ message, history, tripId }` | `{ reply, sources }` | 400, 401, 404, 429, 500 | Mobile & Web (`TravelAssistantScreen.js:218`, `chatApi.ts:103`) | Both send message & history; receive reply | Full parity (Mobile has F-01 bug loading tripId). |
| 51| `GET /disruptions` | Yes (JWT) | Query: `?itineraryId=` | `Array<Disruption>` | 400, 401, 500 | Mobile & Web (`disruptions.js:80`, `disruptionsApi.ts:94`) | Both read disruption records | Full parity. |
| 52| `POST /disruptions/simulate` | Yes (JWT) | Body: `{ itineraryId, delayMinutes, structural }` | Created `Disruption` | 400, 401, 404, 500 | Mobile & Web (`disruptions.js:177`, `disruptionsApi.ts:193`) | Both trigger simulated delay | Full parity (flag-gated). |
| 53| `GET /disruptions/:id` | Yes (JWT) | Params: `id` | `Disruption` | 401, 404, 500 | Mobile & Web (`disruptions.js:94`, `disruptionsApi.ts:111`) | Both fetch single disruption detail | Full parity. |
| 54| `POST /disruptions/:id/proposal` | Yes (JWT) | Params: `id` | `{ disruption, proposal }` | 400, 401, 404, 429, 500 | Mobile & Web (`disruptions.js:111`, `disruptionsApi.ts:126`) | Both generate rescheduling plan | Full parity. |
| 55| `POST /disruptions/:id/approve` | Yes (JWT) | Params: `id` | `{ disruption, updatedItinerary }` | 400, 401, 404, 409, 500 | Mobile & Web (`disruptions.js:128`, `disruptionsApi.ts:143`) | Both accept proposed reschedule | Full parity. |
| 56| `POST /disruptions/:id/dismiss` | Yes (JWT) | Params: `id` | `{ disruption }` | 401, 404, 500 | Mobile & Web (`disruptions.js:144`, `disruptionsApi.ts:159`) | Both dismiss disruption notification | Full parity. |
| 57| `POST /disruptions/:id/undo` | Yes (JWT) | Params: `id` | `{ disruption, revertedEditId }` | 400, 401, 404, 409, 500 | Mobile & Web (`disruptions.js:158`, `disruptionsApi.ts:175`) | Both undo approved changes | Full parity. |
| 58| `POST /webhooks/duffel` | Signature | Headers: `X-Duffel-Signature`, Body: Raw bytes | `{ received: true }` | 401, 503 | External Duffel webhook service | Duffel service sends event payloads | Backend inbound webhook only. |
| 59| `POST /test/intent` | No | Body: `{ message }` | `{ intent, confidence, entities }` | 400, 500 | Uncalled | None | AI intent testing endpoint; uncalled in client apps. |

---

## 2. Dates and Time Zones Analysis

### Timezone Shifting Bug (`new Date("YYYY-MM-DD")`)
- **Root Cause**: The ECMAScript specification dictates that ISO date-only strings (`YYYY-MM-DD`) are parsed as UTC midnight (`00:00:00.000Z`). In timezones behind UTC (such as US Eastern `UTC-5` or US Pacific `UTC-8`), UTC midnight evaluates to the previous calendar day (e.g. 7:00 PM or 4:00 PM on the previous date).
- **Mobile Occurrence**:
  - `mobile/src/screens/TripHubScreen.js:72-78`: `const s = new Date(startDate); s.toLocaleDateString(...)`. Displays Nov 19 instead of Nov 20 in New York.
  - `mobile/src/screens/HotelsScreen.js:145`: `const cin = new Date(checkinDate.trim())`. Displays shifted hotel check-in date.
- **Web Occurrence**:
  - `web/src/pages/traveler/JourneyPage.tsx:168-169`: `{new Date(journey.startDate).toLocaleDateString('en-IN', ...)}`.
  - `web/src/lib/itineraryAdapter.ts:94-104`: Creates `new Date(startDateStr)` and extracts dates using local getters mixed with `toISOString()`.
- **Where Code Handled it Correctly**:
  - `web/src/lib/stay.ts:43-52`: Strictly parses `"YYYY-MM-DD"` via regex match `/^(\d{4})-(\d{2})-(\d{2})$/` and calculates day differences mathematically without timezone conversions.
  - `web/src/lib/passengerValidation.ts:97`: Uses `Date.UTC(year, month - 1, day)`.
  - `mobile/src/utils/disruptions.js:132` & `web/src/lib/disruptionView.ts:135`: Explicitly parses time strings by splitting colon digits without `new Date()`.

### Trip Day Calculation (`startDate + dayNumber`)
- **Mobile**: `mobile/src/screens/TripHubScreen.js:105` calculates end date by adding `count`:
  `d.setDate(d.getDate() + (count || 1))` -> **Bug**: Overcounts trip by +1 day (3-day trip from Nov 20 ends Nov 23).
- **Web**: `web/src/lib/itineraryAdapter.ts:103` calculates:
  `dayDate.setDate(dayDate.getDate() + (dayNumber - 1))` -> Correctly keeps a 3-day trip on Day 1 (Nov 20), Day 2 (Nov 21), Day 3 (Nov 22).

---

## 3. Money and Currency Handling

| Category | Backend Contract | Mobile Client | Web Client | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Flight Fares** | Duffel decimal string (e.g. `"850.50"`), currency code (`"USD"`, `"GBP"`, `"INR"`). `backend/src/routes/flights.js:203`. | Formats as `{currency} {Number(amount).toFixed(2)}`. **Bug F-02**: Labels total as `"total per traveler"`. | `web/src/lib/flightAdapter.ts:207`: `formatMoney(amount, currency)`. Accurately labels total and computes per-adult rate. | **Conflict (F-02)** on per-traveler label. |
| **Hotels** | CuratedHotel `priceRangeINR` stored as string `"₹3,500 - ₹5,500"`. `backend/src/models/CuratedHotel.js:19`. | Displays `priceRangeINR` string directly. | Displays `priceRangeINR` string directly. | **Agrees**. |
| **Expenses** | `Expense` model stores `amountINR` as Number, optional `originalAmount` & `originalCurrency`. `backend/src/models/Expense.js:22`. | Converts foreign currency to INR via `GET /fx/rate`, formats with `en-IN` (`₹`). | Feature absent on Web. | **Mobile Exclusive**. |
| **Budgets** | `Itinerary` stores `totalBudget` or `budgetEstimate` as integer INR. `backend/src/models/Itinerary.js:28`. | Formats as `₹{sum.toLocaleString('en-IN')}`. | Formats as `₹{amount.toLocaleString('en-IN')}`. | **Agrees**. |
| **Bookings** | `Booking` model stores `totalAmount` (string/number) & `currency`. `backend/src/models/Booking.js:81`. | Displays `{currency} {totalAmount}`. | `web/src/lib/bookingView.ts:160`: `formatMoney(totalAmount, currency)`. | **Agrees**. |

---

## 4. Validation Limits Matrix

| Field | Backend Validation | Mobile Validation | Web Validation | Parity Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Trip Nights** | 1 to 14 nights (`backend/src/models/Itinerary.js`, `plannerService`) | 1 to 14 days presets (`TripRequestScreen.js:67`) | 1 to 14 nights (`web/src/lib/plannerForm.ts:106`) | **Agrees** |
| **Travelers Count** | 1 to 9 travelers (10 max in `itinerary.js:520`) | 1 to 9 travelers | 1 to 9 travelers (`web/src/lib/plannerForm.ts:117`) | **Agrees** |
| **Traveler Names** | 1–30 chars, trimmed, not "me"/"you", unique (`itinerary.js:575`) | 1–30 chars, trimmed, rejects duplicates (`ExpensesScreen.js:174`)| Feature absent on web | **Agrees** |
| **Passenger DOB** | `YYYY-MM-DD`, valid date $\le$ today (`flights.js:433`) | `new Date(dob) <= new Date()` (`PassengerFormScreen.js:88`) | Strict `YYYY-MM-DD` regex + leap year check (`passengerValidation.ts:85`) | **Conflict (F-14)**: Mobile has loose date parsing |
| **Passenger Names** | 2–50 chars, alphabetic, title required (`flights.js:415`) | $\ge 2$ chars, title dropdown (`PassengerFormScreen.js:72`) | 2–50 chars, title dropdown (`passengerValidation.ts:45`) | **Agrees** |
| **Passenger Email**| Valid email regex (`flights.js:440`) | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`PassengerFormScreen.js:94`) | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`passengerValidation.ts:133`) | **Agrees** |
| **Passenger Phone**| 5–15 digits, E.164 (`flights.js:447`) | Strips non-digits, requires $\ge 7$ digits (`PassengerFormScreen.js:98`) | Strips non-digits, requires 7–15 digits (`passengerValidation.ts:145`) | **Agrees** |
| **Hotel Stay Nights**| $\le 30$ nights | Duration presets 2, 3, 5, 7 nights (`HotelsScreen.js:78`) | $\le 30$ nights (`web/src/lib/stay.ts:115`) | **Agrees** |
| **Delay Minutes** | Strict enum: `[30, 60, 120, 180]` (`itinerary.js:1116`) | Buttons for 30, 60, 120, 180 min (`TodayScreen.js:401`) | Dropdown with 30, 60, 120, 180 min (`SimulateDelayControl.tsx:75`)| **Agrees** |
| **Chat Message** | Max 2000 chars, non-empty (`chat.js:32`, `assistant.js:39`) | Trims string, disables submit on empty (`ChatScreen.js:160`)| Trims string, enforces max 2000 chars (`chatApi.ts:99`) | **Agrees** |

---

## 5. Derived Statuses and Labels

### Trip Lifecycle Status
- **Backend**: Does not store a status enum; only `startDate` and `endDate`.
- **Web**: `web/src/lib/journeyAdapter.ts:67` derives status based on wall-clock date comparisons:
  - `today < startDate` -> `'planning'`
  - `startDate <= today <= endDate` -> `'in-travel'`
  - `today > endDate` -> `'completed'`
- **Mobile**: `mobile/src/screens/SavedItinerariesScreen.js` does not compute or display trip status pills; lists trips chronologically.

### Flight Booking Status
- **Backend / Duffel**: Returns `'confirmed'`, `'cancelled'`.
- **Web**: `web/src/lib/bookingView.ts:53`: Maps `'confirmed'` (green badge, "Confirmed"), `'cancelled'` (red badge, "Cancelled"), unknown (neutral badge, title-cased).
- **Mobile**: `mobile/src/screens/BookingHistoryScreen.js:160`: Maps `'confirmed'` (green checkmark, "CONFIRMED"), other (yellow clock, uppercase raw status).

### Disruption Guardian Status
- **Backend**: `status` enum: `['new', 'proposed', 'approved', 'dismissed', 'expired', 'reverted']`.
- **Web**: `web/src/lib/disruptionView.ts:36`: Maps to `'generating'`, `'review'`, `'manual_review'`, `'applied'`, `'closed'`.
- **Mobile**: `mobile/src/utils/disruptions.js:44`: Maps to `'new'`, `'proposed_reschedule'`, `'proposed_manual_review'`, `'approved'`, `'reverted'`, `'dismissed'`, `'expired'`, `'unknown'`.
- **Simulator Badge**: Both clients display identical copy `SIMULATED` pill with tooltip/subtitle: *"Demo tool. Creates a SIMULATED disruption. Not a real airline event."*

---

## 6. Error Handling Comparison

| Status Code | Backend Cause | Mobile Behavior | Web Behavior | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **401 Unauthorized** | Missing, invalid, or expired JWT | Generic banner; leaves token in SecureStore (**F-07**). | Clears localStorage token, dispatches `auth:expired` event, redirects to login. | **Conflict (F-07)** |
| **400 Bad Request** | Schema/validation failure | Displays `err.message` in red error alert banner. | Displays inline field validation or banner message. | **Agrees** |
| **404 Not Found** | Record ID does not exist | Displays not-found state or alert; soft fails gracefully. | Displays empty state with navigation CTA. | **Agrees** |
| **409 Conflict** | Concurrency conflict, day altered, or traveler in expenses | Displays `"This day changed. Please reopen it."` | Handled on disruption approval with retry CTA. | **Agrees** |
| **410 / 422 Expired** | Duffel offer expired or unbookable | Shows banner: `"Offer expired. Please search again."` | Disables booking button, displays expiry alert with search CTA. | **Agrees** |
| **429 Rate Limit** | AI Chat / Assistant hourly limit reached | Displays: `"You've reached the hourly limit. Try again later."` | Displays: `"You're sending messages too quickly, wait a moment"` (**F-06**). | **Conflict (F-06)** |
| **500 / 502 / 503** | Upstream AI or Duffel failure | Shows: `"Unable to connect to service. Please check connection."` | Shows: `"The server took too long to respond. Please try again."` | **Agrees** |

---

## 7. Auth and Session Management

- **Storage Medium**:
  - Mobile: `expo-secure-store` hardware-backed encrypted keychain storage (`mobile/src/context/AuthContext.js:30`).
  - Web: Browser `localStorage` (`web/src/lib/auth.ts:1-25`).
- **Session Expiry**: Backend issues 7-day JWTs signed with `JWT_SECRET`. Neither client has a background timer refreshing tokens before expiry.
- **Mid-Session 401 Handling**:
  - Web: Centralized in `web/src/lib/api.ts:105`. Removes token and immediately forces transition to anon state.
  - Mobile: Unhandled in `mobile/src/config/apiClient.js:40`. Stale token persists in `SecureStore` until user manually signs out or re-logs in.
- **Account Deletion Cleanup**:
  - Backend: `backend/src/services/accountDeletion.js` executes atomic deletion of User, Itineraries, Expenses, Bookings, Disruptions, and Packing Templates.
  - Both clients clear local tokens and cached user objects upon receiving 200 from `DELETE /auth/me`.

---

## 8. AI Features: Trip Chat & Travel Assistant

| Feature | Backend Endpoint | Mobile Implementation | Web Implementation | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Trip Chat Messaging** | `POST /chat/message` | `mobile/src/screens/ChatScreen.js` | `web/src/components/chat/TripChatPanel.tsx` | Agrees on message exchange. |
| **Edit Proposals (Apply)** | `POST /itinerary/:id/reschedule/apply` | Full UI: Preview card, "Apply to Itinerary" button | Not implemented: Displays raw text explanation only (**F-11**). | **Asymmetry (F-11)** |
| **Edit Proposals (Undo)** | `POST /itinerary/:id/undo` | Undo button in chat and top banner | Not implemented in trip chat. | **Asymmetry (F-11)** |
| **Travel Assistant Messaging**| `POST /assistant/message` | `mobile/src/screens/TravelAssistantScreen.js` | `web/src/components/chat/TravelAssistantPanel.tsx` | Agrees on stateless chat. |
| **Travel Assistant Trip Hint**| `POST /assistant/message` with `{ tripId }` | **Broken**: Calls `GET /itinerary` which 404s (**F-01**). | Reads `journeys` from `AppContext` and sends active `selectedJourneyId`. | **Mobile Bug (F-01)** |
| **Rate Limit Notification** | `429 Too Many Requests` | "You've reached the hourly limit" | "Sending messages too quickly" (**F-06**). | **Conflict (F-06)** |
| **Markdown Rendering** | N/A | React Native custom markdown renderer | `SafeMarkdown.tsx` via `react-markdown` | Agrees |

---

## 9. Disruption Guardian Parity

- **Lifecycle State Machine**: Both clients correctly follow the backend disruption lifecycle:
  1. `new`: Disruption detected via Duffel webhook or simulation.
  2. `proposed`: Re-scheduling proposal generated (kind: `reschedule` or `manual_review`).
  3. `approved`: Schedule change committed to the itinerary with an atomic undo snapshot.
  4. `reverted`: Changes reverted via `POST /disruptions/:id/undo`.
  5. `dismissed`: Notification dismissed by traveler without applying changes.
- **Simulator Trigger**:
  - Mobile: `mobile/src/screens/TripHubScreen.js:676` renders "Simulate flight delay" demo button when `EXPO_PUBLIC_ENABLE_SIMULATOR === 'true'`.
  - Web: `web/src/components/disruptions/SimulateDelayControl.tsx:16` renders delay simulator modal when `VITE_ENABLE_SIMULATOR === 'true'`.
- **Reminder Formatting**: Both clients strictly preserve wall-clock flight times and format reminder block times using pure string parsing without `new Date()` timezone conversions (`mobile/src/utils/disruptions.js:202`, `web/src/lib/disruptionView.ts:199`).

---

## 10. User Feature Parity Matrix

| Feature | Mobile Status | Web Status | Backend Status |
| :--- | :--- | :--- | :--- |
| **Auth (Login / Signup)** | Supported | Supported | Supported (`/auth/*`) |
| **Profile & Settings** | Supported | Supported | Supported (`/auth/me`) |
| **Account Deletion** | Supported (in-app flow) | Supported (in-app + web form) | Supported (`DELETE /auth/me`) |
| **Destination Search & Explore** | Supported | Supported | Supported (`/destinations/search`) |
| **Trending Destinations** | Supported | Absent | Supported (`/destinations/trending`) |
| **AI Trip Generation** | Supported | Supported | Supported (`/itinerary/generate`) |
| **Trip Hub / Itinerary Day View** | Supported | Supported (`JourneyPage.tsx`) | Supported (`/itinerary/:id`) |
| **Today View (Day Alerts / Done Checks)** | Supported (`TodayScreen.js`) | Absent | Supported (`/today-alerts`, `/done`) |
| **Activity Reordering** | Supported (`ReorderDayScreen.js`) | Absent | Supported (`/days/:day/order`) |
| **Delay Activity Rescheduler** | Supported (`TripHubScreen.js`) | Absent | Supported (`/reschedule/*`) |
| **Flight Search & Results** | Supported (`FlightSearchScreen.js`)| Supported (`FlightSearchPage.tsx`) | Supported (`/flights/search`) |
| **Flight Offer Details** | Supported (`PassengerFormScreen.js`)| Supported (`FlightDetailPage.tsx`) | Supported (`/flights/offers/:id`) |
| **Flight Booking Flow** | Supported (`PassengerFormScreen.js`)| Supported (`FlightBookingStepFlow.tsx`)| Supported (`/flights/book`) |
| **Flight Booking History** | Supported (`BookingHistoryScreen.js`)| Supported (`MyBookingsPage.tsx`) | Supported (`/bookings/mine`) |
| **Curated Hotels & Booking.com Outlink**| Supported (`HotelsScreen.js`) | Supported (`HotelsPage.tsx`) | Supported (`/hotels/search`) |
| **Car Rentals Search** | Supported (`CarsScreen.js`) | Sample/Mock variant only | Supported (`/cars/search`) |
| **Trains & Buses Transit Search** | Supported (`TrainsAndBusesScreen.js`)| Sample/Mock variant only | Supported (`/routes/search`) |
| **Packing Lists & Custom Templates** | Supported (`PackingListScreen.js`) | Absent | Supported (`/packing-*`, `/packing/*`) |
| **Group Expenses & Multi-Currency FX**| Supported (`ExpensesScreen.js`) | Absent | Supported (`/expenses/*`, `/fx/*`) |
| **Travelers Split Management** | Supported (`ExpensesScreen.js`) | Absent | Supported (`/travelers/*`) |
| **AI Trip Chat** | Supported (Interactive apply/undo)| Supported (Read-only conversation)| Supported (`/chat/message`) |
| **AI Travel Assistant** | Supported (Floating FAB + Tab) | Supported (Slideover panel) | Supported (`/assistant/message`) |
| **Disruption Guardian (Delays & Undo)** | Supported | Supported | Supported (`/disruptions/*`) |

---

## 11. Legal and Privacy Surface

| Surface | Mobile Client | Web Client | Hosted Static Asset |
| :--- | :--- | :--- | :--- |
| **Privacy Policy** | `mobile/config/legal.js:3`: Empty string -> Alert: *"This page isn't available yet"* (**F-05**). | In-app route `/privacy` rendering `web/src/pages/traveler/PrivacyPage.tsx`. | `legal-site/privacy.html` |
| **Terms of Service** | `mobile/config/legal.js:4`: Empty string -> Alert: *"This page isn't available yet"* (**F-05**). | In-app route `/privacy` (terms section). | `legal-site/privacy.html` |
| **Account Deletion Info** | `mobile/config/legal.js:5`: Empty string -> Alert: *"This page isn't available yet"* (**F-05**). | In-app route `/delete-account` rendering `DeleteAccountPage.tsx`. | `legal-site/delete-account.html` |
| **Sign-up Notice** | Explicit notice: "By signing up, you agree to our Terms and Privacy Policy." | Explicit notice with clickable link to `/privacy`. | N/A |

---

## 12. Configuration and Environment Variables

| Variable Name | Tier | Purpose | Default / Fallback | Production Misconfiguration Risk |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Backend | HTTP listening port | `8000` | Low: Defaults to standard port. |
| `MONGODB_URI` | Backend | MongoDB Atlas connection string | None (required) | High: Backend halts on startup if missing. |
| `JWT_SECRET` | Backend | JWT signing secret | None (required) | High: Auth endpoints fail if missing. |
| `DUFFEL_API_KEY` | Backend | Duffel Flights API token | None | High: Flight searches return 500 error if missing. |
| `DUFFEL_WEBHOOK_SECRET` | Backend | HMAC-SHA256 signature key | None | Med: `/webhooks/duffel` returns 503 if omitted. |
| `DUFFEL_WEBHOOK_TOLERANCE_SECONDS`| Backend | Webhook timestamp max age | `0` (disabled) | Low: 0 disables tolerance check safely. |
| `ENABLE_DISRUPTION_SIMULATOR` | Backend | Enables `/disruptions/simulate` | `false` | Low: Disabled in production by default. |
| `WEB_ORIGINS` | Backend | Allowed CORS origins | `http://localhost:5173,http://localhost:8443` | Med: Production web domain must be whitelisted. |
| `EXPO_PUBLIC_API_URL` | Mobile | Base URL for backend API | `http://localhost:8000` or `http://10.0.2.2:8000` | **High (F-10)**: Omitting causes physical mobile app to silently fail all network requests. |
| `EXPO_PUBLIC_ENABLE_SIMULATOR` | Mobile | Show simulator delay buttons | `false` | Low: Keep false in release builds. |
| `VITE_API_BASE_URL` | Web | Base URL for backend API | None (fatal throw if omitted) | Low: App refuses to run if missing, alerting build operator. |
| `VITE_ENABLE_SIMULATOR` | Web | Show delay simulator controls | `false` | Low: Keep false in release builds. |
| `VITE_SHOW_SAMPLE_PAGES` | Web | Enable legacy mock sample pages | `false` | Low: Only true for sample reviews. |
| `VITE_FLIGHTS_TEST_MODE` | Web | Display Duffel test banner | `true` | Low: Set false when live IATA credentials attached. |

---

## UNVERIFIED List
The following items could not be verified by static code audit alone and require runtime environment access:
1. **Live Duffel Inbound Webhook**: Delivery and HMAC verification of live flight change webhooks from Duffel's production servers (requires Duffel sandbox/production event broadcast).
2. **Booking.com Affiliate Attribution**: Click-through and affiliate tracking conversion on Booking.com affiliate URLs (requires external browser navigation to live affiliate portal).
3. **OpenWeather Free-Tier Rate Limits**: Real API quota throttling and HTTP error behavior from OpenWeather in production (requires active outbound internet access).
4. **Physical Device Keychain Biometrics**: Behavior of `expo-secure-store` across iOS keychain restores after device migration (requires testing on physical hardware).

