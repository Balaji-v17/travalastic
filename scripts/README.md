# Support-Side Account Deletion Script

This directory contains the operational script for fulfilling verified user account deletion requests received via customer support (e.g., when a user cannot access the mobile application, forgot their password, or uninstalled the app).

---

## Script Overview

- **Script:** `scripts/deleteUserByEmail.js`
- **Purpose:** Looks up an account by registered email (using the same case-insensitive, trimmed email normalization as signup) and deletes the user and all associated child documents (itineraries, chat conversations, expenses, flight bookings) using the shared `services/accountDeletion.js` path.

---

## Operational Rules & Governance

1. **Access Control & Production Credentials:**
   - Running this script requires direct write access to the production database via `MONGODB_URI`.
   - Who is authorized to execute this script in production environments is a strict access decision for the company. Access should be restricted to authorized operational staff.

2. **Identity Verification Prerequisite:**
   - **Do NOT run this script until the requester's identity has been verified** according to the company's established identity verification procedure.
   - Do not proceed based solely on an unauthenticated email or ticket without completing verification.

3. **Mandatory Dry Run First:**
   - **Always perform a dry run first** before attempting actual deletion.
   - Running the script without the `--confirm` flag executes a read-only dry run using `countUserData()`. It displays the target user ID and per-collection counts of documents that will be affected without modifying or deleting any data.

4. **Support Ticket Documentation:**
   - The deletion script intentionally stores no personal records, audit tables, or requester information in the database.
   - Operators **must record the support ticket reference** and execution timestamp in the company's internal support / ticketing system for audit and compliance tracking.

---

## Usage

### 1. Dry Run (Default)

Inspect the account and document counts without deleting anything:

```bash
node scripts/deleteUserByEmail.js <email>
```

**Example:**
```bash
node scripts/deleteUserByEmail.js user@example.com
```

**Sample Output:**
```
Target cluster host: cluster0.abcde.mongodb.net
Target database:     travalastic_prod

--- DRY RUN (No data deleted) ---
User ID:        67056637e17cbaf901193a02
Account Email:  user@example.com

Per-collection records found:
  Itineraries:   3
  Conversations: 2
  Expenses:      12
  Bookings:      1
  Users:         1

To permanently delete this user and all data, run:
  node scripts/deleteUserByEmail.js "user@example.com" --confirm "user@example.com"
```

---

### 2. Confirmed Deletion

Permanently erase the user account and all child records:

```bash
node scripts/deleteUserByEmail.js <email> --confirm <email>
```

**Example:**
```bash
node scripts/deleteUserByEmail.js user@example.com --confirm user@example.com
```

**Safety Check:**
Both email arguments must match exactly after normalization (`trim().toLowerCase()`). If they differ, the script will immediately abort without making any modifications.

**Sample Output:**
```
Target cluster host: cluster0.abcde.mongodb.net
Target database:     travalastic_prod

--- ACCOUNT DELETION COMPLETED ---
Per-collection deleted counts:
  Itineraries:   3
  Conversations: 2
  Expenses:      12
  Bookings:      1
  Users:         1
User account deleted: 67056637e17cbaf901193a02 (method: support)
```
