# Google Play Console — Data Safety Form Draft

> [!IMPORTANT]
> **Working Assumptions (Confirm against the live Play Console wording before submission):**
> 1. **"Collected"**: Data is transmitted off the user's device to Travalastic backend servers or directly to third-party endpoints.
> 2. **"Shared"**: Data is transferred to a third party that is *not* a service provider processing strictly on Travalastic's behalf under contract, OR transfers initiated directly by the user (such as flight ticket purchases or external partner redirect deep links).
> 3. **"Processed Ephemerally"**: Data is processed strictly in-memory during real-time request fulfillment and is neither stored in persistent storage (database or disk) nor written to persistent server logs.
> 4. **"Needs Decision"**: Where third-party retention terms or legal definitions remain open in [`DATA_INVENTORY.md`](file:///Users/balaji.v/travalastic/DATA_INVENTORY.md), conservative facts are provided below for company review.

---

## 1. Data Collection and Sharing Overview

| Data Category & Type | Collected? | Shared? | Optional or Required? | Purposes | Processed Ephemerally? | Evidence in `DATA_INVENTORY.md` | Confidence | Needs Decision Notes |
| :--- | :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **Location: Precise Location** | **Yes** (On-device / Outbound) | **Yes** (User-initiated deep link) | Optional | App functionality (cab pickup dispatch via Uber deep link) | **Yes** (On device memory; never sent to backend) | Section C (Uber), Section E (`expo-location`) | **High** | Device GPS collected only when tapping "Use current location" in cab booking screen; passed directly to Uber app/web. Never received by backend. |
| **Personal Info: Name** | **Yes** | **Yes** (Flight booking only) | Required for account & flights | App functionality, Account management | **No** (Stored in MongoDB) | Section B (`users`, `bookings`), Section C (Duffel) | **High** | Account name stored in `users`; passenger full names stored in `bookings` and sent to Duffel/issuing airlines during ticket purchase. |
| **Personal Info: Email Address** | **Yes** | **Yes** (Flight booking only) | Required | Account management, App functionality | **No** (Stored in MongoDB) | Section B (`users`, `bookings`), Section C (Duffel) | **High** | Login email stored in `users`; passenger contact email stored in `bookings` and shared with Duffel/airlines upon booking. |
| **Personal Info: User IDs** | **Yes** | **No** (Service provider database only) | Required | Account management, App functionality | **No** (Stored in MongoDB & JWT) | Section B (`users._id`), Section E (`SecureStore`) | **High** | MongoDB `ObjectId` generated on registration, stored in DB and active session JWT. |
| **Personal Info: Phone Number** | **Yes** | **Yes** (Flight booking only) | Optional (Required during flight booking) | App functionality (Airline contact) | **No** (Stored in `bookings`) | Section B (`bookings.passengers`), Section C (Duffel) | **High** | Collected only if user enters passenger phone number during flight checkout; forwarded to Duffel. |
| **Personal Info: Date of Birth** | **Yes** | **Yes** (Flight booking only) | Optional (Required during flight booking) | App functionality (Airline passenger age/tariff verification) | **No** (Stored in `bookings`) | Section B (`bookings.passengers`), Section C (Duffel) | **High** | Passenger date of birth collected solely for flight ticketing compliance; forwarded to Duffel. |
| **Personal Info: Gender** | **Yes** | **Yes** (Flight booking only) | Optional (Required during flight booking) | App functionality (Airline passenger manifest) | **No** (Stored in `bookings`) | Section B (`bookings.passengers`), Section C (Duffel) | **High** | Passenger honorific/gender (`m`/`f`) forwarded to Duffel for ticket issuance. |
| **Financial Info: User Payment / Card Info** | **No** | **No** | N/A | None | N/A | Section B, Section C | **High** | Credit card numbers and CVVs are never handled, processed, or stored by Travalastic backend or mobile app. |
| **Financial Info: Purchase History / Other Financial** | **Yes** | **No** | Optional | App functionality (Trip expense tracking & budget estimation) | **No** (Stored in MongoDB) | Section B (`expenses`, `bookings.totalAmount`) | **High** | Recorded trip expenses, amounts in INR/foreign currencies, currency exchange rates, split allocations, and flight ticket prices. |
| **Messages: In-App Messages (Trip Chat)** | **Yes** | **No** (Processed by LLM service provider under API contract) | Optional | App functionality (Itinerary Q&A and modifications) | **No** (Stored in `conversations` until account deletion) | Section B (`conversations`), Section C (Groq) | **High** | Chat messages regarding specific trips are stored in MongoDB to preserve conversational context. Sent to Groq API. |
| **Messages: In-App Messages (Travel Assistant)** | **Yes** | **No** (Processed by LLM service provider under API contract) | Optional | App functionality (General travel assistance) | **Yes** (On Travalastic server/client; volatile memory only) | Section D (`routes/assistant.js`), Section C (Groq) | **Medium** | **NEEDS DECISION**: Message content is not stored in our database and not written to server logs. Confirm whether Groq's 30-day abuse log retention qualifies as "ephemeral processing" under Play Console guidelines. |
| **Files & Docs: Packing Lists & Templates** | **Yes** | **No** | Optional | App functionality (Packing organization) | **No** (Stored in MongoDB) | Section B (`packingtemplates`, `itineraries.packingList`) | **High** | Custom packing items and checklists created by user. |
| **App Activity: Search History** | **Yes** | **No** | Optional | App functionality (City/airport suggestions & destination search) | **Yes** (URL query parameters in volatile request pipeline) | Section C (Duffel, Nominatim, Gemini), Section D (Morgan) | **High** | Destination search strings and airport queries; logged in transient server HTTP access logs. |
| **App Activity: User-Generated Content** | **Yes** | **No** (Processed by LLM providers) | Required for itinerary generation | App functionality (Generating custom travel plans) | **No** (Stored in `itineraries.rawRequest`) | Section B (`itineraries`), Section C (Cerebras, Groq) | **High** | Free-text travel request prompts describing trip desires. |
| **App Info & Performance: Diagnostics / Crash Logs** | **Yes** (Server-side) | **No** | Automatic | Analytics / Server stability | **Yes** (Standard server error logs) | Section D (`server.js`) | **High** | Unhandled server call stacks logged to stdout on backend. No third-party mobile telemetry SDK (Firebase, Sentry) is installed. |
| **Device or Other Identifiers** | **No** | **No** | N/A | None | N/A | Section E, Section C | **High** | No hardware serial numbers, IMEI, MAC addresses, Android ID, or Advertising ID (GAID/IDFA) are collected or accessed. |

---

## 2. Security Practices

| Question | Answer | Code Verification & Evidence |
| :--- | :---: | :--- |
| **Does your app encrypt data in transit?** | **Yes** | All network requests between mobile clients and the backend enforce HTTPS/TLS using standard secure URL schemes. Backend outbound API calls to Groq, Cerebras, Duffel, OpenWeather, and Gemini use HTTPS. ([`backend/src/server.js`](file:///Users/balaji.v/travalastic/backend/src/server.js), [`mobile/src/config/apiClient.js`](file:///Users/balaji.v/travalastic/mobile/src/config/apiClient.js)). |
| **Do you provide a way for users to request that their data be deleted?** | **Yes** | A self-service account deletion flow is built into the mobile app (`Profile` &rarr; `Delete Account`), backed by `DELETE /auth/me`. A web-accessible deletion request page is hosted at `/delete-account.html`. ([`mobile/screens/DeleteAccountScreen.js`](file:///Users/balaji.v/travalastic/mobile/screens/DeleteAccountScreen.js), [`backend/src/services/accountDeletion.js`](file:///Users/balaji.v/travalastic/backend/src/services/accountDeletion.js)). |
| **Are authentication credentials securely stored?** | **Yes** | Account passwords are cryptographically hashed using bcrypt with salt prior to database persistence ([`backend/src/models/User.js`](file:///Users/balaji.v/travalastic/backend/src/models/User.js)). Session JWTs are stored in hardware-backed keystores on mobile devices via `expo-secure-store` ([`mobile/src/utils/authCleanup.js`](file:///Users/balaji.v/travalastic/mobile/src/utils/authCleanup.js)). |
| **Has the app been independently validated against a global security standard (e.g. MASA)?** | **No** | No third-party Mobile Application Security Assessment (MASA) certification has been performed yet. |
| **Does the app comply with the Play Families Policy?** | **No / Needs Decision** | **NEEDS DECISION**: Travalastic is targeted at adult leisure travelers and business travelers. Company legal must supply formal child policy before targeting family audiences. |

---

## 3. Account Deletion Responses

| Play Console Field | Answer | Evidence & Code Reference |
| :--- | :--- | :--- |
| **Does your app allow users to create an account?** | **Yes** | Account creation via email/password in mobile app and web app. ([`backend/src/routes/auth.js`](file:///Users/balaji.v/travalastic/backend/src/routes/auth.js)). |
| **Do you offer a deletion URL outside the app?** | **Yes** | Hosted account deletion information and request page at `delete-account.html`. Built via [`legal-site/scripts/build.js`](file:///Users/balaji.v/travalastic/legal-site/scripts/build.js). |
| **Does the deletion request delete all associated data or only selected data?** | **All user data permanently deleted** | Deletes User profile, itineraries, chat conversations, expenses, authenticated bookings, packing templates, disruptions, and invalidates device tokens. |
| **What data is retained and for what reason?** | **External airline ticketing & cloud backups** | Flight ticket records already issued by airlines are held under airline regulatory obligations. Cloud database encrypted backup snapshots expire automatically according to cloud retention schedules. |

