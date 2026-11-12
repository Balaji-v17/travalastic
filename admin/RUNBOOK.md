# Travalastic Admin Panel Production Runbook

This runbook documents operational procedures, emergency recovery protocols, and configuration requirements for the Travalastic Admin Panel.

---

## 1. Create the First Super Admin in Production

In a fresh production deployment without existing administrative accounts, bootstrap the root Super Admin directly from the server environment:

```bash
cd backend
ADMIN_BOOTSTRAP_EMAIL="admin@travalastic.com" ADMIN_BOOTSTRAP_PASSWORD="secure-temporary-password-min-12-chars" node scripts/createSuperAdmin.js
```

* Password must be at least 12 characters.
* If environment variables are omitted, the script interactively prompts for email and password.
* Once created, sign in at the admin portal URL (e.g. `https://admin.travalastic.com` or `http://localhost:8444`).
* Upon first sign-in, the account will be prompted to change their temporary password.

---

## 2. Add or Deactivate an Admin Account

### Adding an Admin Account
1. Sign in as a **Super Admin** and navigate to **Admins** (`#/admins`).
2. Click **Create new admin**.
3. Enter the admin's corporate email address and select their assigned role:
   * `super_admin`: Full management, audit logs, catalog editing, and traveler deletions.
   * `content_editor`: Curated places, hotels, and style collections.
   * `support_agent`: Traveler account lookup and audited account deletion.
4. Click **Create admin**.
5. Copy the generated one-time temporary password and deliver it to the team member through a secure communication channel. The temporary password is never shown again.

### Deactivating an Admin Account
1. Navigate to **Admins** (`#/admins`).
2. Find the target administrator in the list.
3. Click the status toggle or actions menu and select **Deactivate account**.
4. Confirm deactivation in the dialog.
5. The administrator's record is marked `active: false` and their `tokensValidAfter` timestamp is set to the current time, instantly revoking all active sessions across all devices.

---

## 3. Reset an Admin Password

When an administrator forgets their credentials or loses access:
1. Sign in as a **Super Admin** and open **Admins** (`#/admins`).
2. Locate the administrator and select **Reset password**.
3. Confirm the reset prompt.
4. A new unambiguous temporary password (minimum 16 characters) is generated and displayed once.
5. The admin's `mustChangePassword` flag is set to `true` and `tokensValidAfter` is updated to invalidate existing sessions.
6. Share the temporary password securely with the admin. They will be forced to choose a new personal password immediately upon next login.

*Note: Super Admins cannot reset their own password via the Admins screen; use **Change password** instead.*

---

## 4. Compromised Token or Exposed `ADMIN_JWT_SECRET`

If an administrator's credentials/token leak, or `ADMIN_JWT_SECRET` is inadvertently committed or exposed:

### Step 1: Rotate `ADMIN_JWT_SECRET`
1. Generate a new cryptographically random 64-character secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update the `ADMIN_JWT_SECRET` environment variable in your production hosting dashboard (e.g. Render Environment Variables).
3. Trigger a redeploy of the backend service.

### Step 2: Session Termination & Re-authentication
* Because all JWT signatures are verified against `ADMIN_JWT_SECRET`, rotating the secret instantly and irrevocably invalidates every existing administrative session globally.
* Any subsequent request with an old token receives HTTP 401 (`Your session ended. Please sign in again.`).
* Administrators must sign in again with their email and password to receive new tokens signed with the rotated secret.

---

## 5. Recovery When the Only Super Admin Is Locked Out

If the sole Super Admin account is deactivated, locked out, or credentials are lost:

### Method A: Emergency Super Admin Creation via CLI
Connect to the production server shell / container and run:
```bash
cd backend
ADMIN_BOOTSTRAP_EMAIL="emergency-admin@travalastic.com" ADMIN_BOOTSTRAP_PASSWORD="strong-recovery-password-min-12-chars" node scripts/createSuperAdmin.js
```

### Method B: Direct Database Recovery via `mongosh`
Connect to the MongoDB Atlas cluster shell:
```bash
mongosh "mongodb+srv://<cluster>.mongodb.net/travalastic" --username <db-admin>
```

Execute the recovery script to reactivate or elevate an admin account:
```javascript
use travalastic;

// 1. Reactivate and reset lock on an existing admin
db.adminusers.updateOne(
  { email: "admin@travalastic.com" },
  {
    $set: {
      role: "super_admin",
      active: true,
      mustChangePassword: true,
      tokensValidAfter: new Date()
    }
  }
);

// 2. Generate a bcrypt hash for a new temporary password (e.g. using node locally)
// node -e "require('bcrypt').hash('TemporaryPass123!', 10).then(console.log)"
// Then update the passwordHash field:
db.adminusers.updateOne(
  { email: "admin@travalastic.com" },
  {
    $set: {
      passwordHash: "$2b$10$e8GjJbVwM6G5N6T6J9D1Ou0vTfF9qC1jZ6aK5k7vL8m9nP0qR1s2u" // replace with new hash
    }
  }
);
```

---

## 6. Seed Style Collections

To populate or sync the initial 6 curated style collections (Honeymoons, Wellness, Adventure, Family, Private escapes, Celebrations) with their default destination picks:

```bash
cd backend
node scripts/seedStyleCollections.js
```

* Safely upserts all 6 collections without duplicating documents.
* Existing edited picks are preserved unless the collection is missing.

---

## 7. Handle a Traveler Account Deletion Request End-to-End

When a customer submits a GDPR Article 17 erasure request, support ticket, or privacy inquiry:

### Step 1: Exact Email Lookup
1. Sign in as a **Support Agent** or **Super Admin** and open **Support** (`#/support`).
2. Enter the traveler's exact email address into the search input.
3. Click **Look up**.
4. Confirm the account profile card matches (email, account ID, member since date).

### Step 2: Generate Deletion Preview
1. Click **Delete this account...**.
2. The system executes a dry run using the shared deletion service and displays:
   * **Will be removed**: Itemized counts of itineraries, chat conversations, logged expenses, flight bookings, packing templates, disruptions, and user profile.
   * **Will be kept**: Retained operational items with legal justifications (Audit Logs for regulatory compliance; Shared Catalogs).
3. Review the preview figures carefully. If preview fails, click **Retry preview** or **Cancel**.
4. Click **Continue to confirmation**.

### Step 3: Confirmation and Authorization
1. View the live 5-minute security authorization window countdown.
2. Complete all three verification gates:
   * **Typed confirmation email**: Enter the exact email address of the account (case-insensitive).
   * **Reason for deletion**: Enter a plain-text justification between 5 and 200 characters (e.g. `Customer requested deletion under GDPR Article 17 via support ticket #9182`). No HTML tags permitted.
   * **Confirmation checkbox**: Check *"I understand this cannot be undone"*.
3. The **Delete account** button enables only when all 3 checks and the preview token are valid.

### Step 4: Execution & Success Recap
1. Click **Delete account**.
2. The server creates pre-deletion and post-deletion audit records, purges all linked user collections in MongoDB, and permanently deletes the user account.
3. The modal displays **Account deleted** with completion timestamp and removed/kept summary.
4. Click **Done** to close the dialog and reset all lookup state.
5. All previous traveler JWT tokens are immediately rejected by the traveler authentication middleware.

---

## 8. Environment Variables Reference

All sensitive values must be provisioned securely in hosting secret stores and never committed to source control.

### Backend (`backend/.env`)
* `PORT`: Server listening port (default: `8000`).
* `MONGODB_URI`: MongoDB Atlas cluster connection string.
* `JWT_SECRET`: Secret for signing traveler user authentication tokens.
* `ADMIN_JWT_SECRET`: Dedicated secret for admin JWT tokens (minimum 32 characters, must differ from `JWT_SECRET`).
* `ADMIN_SESSION_HOURS`: Duration in hours before an admin token expires (default: `8`).
* `ADMIN_ORIGINS`: Comma-separated list of permitted web origins for `/admin` routes (e.g. `http://localhost:8444,https://admin.travalastic.com`). No wildcards permitted.
* `WEB_ORIGINS`: Comma-separated list of permitted traveler web origins (e.g. `http://localhost:8443,https://travalastic.vercel.app`).
* `GROQ_API_KEY`: API key for Groq LLM inference.
* `GEMINI_API_KEY`: API key for Google Gemini vector embeddings.
* `OPENWEATHER_API_KEY`: API key for OpenWeather forecasting.
* `DUFFEL_API_KEY`: API key for Duffel flight booking API.
* `DUFFEL_WEBHOOK_SECRET`: HMAC-SHA256 secret for Duffel webhook signature validation.
* `DUFFEL_WEBHOOK_TOLERANCE_SECONDS`: Webhook timestamp age tolerance in seconds.
* `BOOKING_AFFILIATE_ID`: Affiliate tracking identifier for hotel redirects.
* `PEXELS_API_KEY`: API key for Pexels destination photo previews.
* `ENABLE_DISRUPTION_SIMULATOR`: Boolean flag to enable demo disruption simulation endpoint.

### Admin Frontend (`admin/.env`)
* `VITE_API_BASE_URL`: Base URL of the backend API (e.g. `http://localhost:8000` or `https://api.travalastic.com`).

