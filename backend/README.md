# Travalastic Backend

Backend service powering Travalastic API, AI trip planner, booking integrations, and the Admin Panel.

## Admin Bootstrap

To initialize the first super admin account:

### Interactive Mode:
```bash
node scripts/createSuperAdmin.js
```
The script will prompt for:
- Super admin email
- Super admin password (must be at least 12 characters)

### Environment Variable Mode (CI/Automation):
```bash
ADMIN_BOOTSTRAP_EMAIL="admin@travalastic.com" ADMIN_BOOTSTRAP_PASSWORD="strong-password-min-12-chars" node scripts/createSuperAdmin.js
```

### Security Notes:
- Passwords must be at least 12 characters.
- Passwords are encrypted using bcrypt (cost 10) and are never logged, displayed, or written to disk.
- Duplicate emails are strictly rejected.

## Audit Log & Tamper-Resistance

Administrative actions, mutations, logins, and access-denial events are recorded in an append-only collection (`audit_logs`).

### Tamper-Resistance Notice:
- Application-level schema pre-hooks and method overrides in Mongoose strictly prohibit `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `replaceOne`, and document modifications on existing records.
- **Important**: Application-level code enforcement alone does NOT guarantee complete tamper-resistance against direct database compromise or malicious database administrators. Complete tamper-resistance requires database-level privilege separation: the application's MongoDB user in production should be provisioned with a custom role granting `insert` and `find` actions only on the `audit_logs` collection, with `update`, `delete`, and `dropCollection` privileges revoked.


