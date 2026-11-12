# Travalastic Admin Console

Standalone administrative web console for Travalastic staff (Super Admins, Content Editors, and Support Agents).

## Development & Build

```bash
# Install dependencies
npm install

# Run dev server (runs on port 8444 with strictPort)
npm run dev

# Run unit test suite (Node test runner for pure helpers)
npm test

# Typecheck & build production bundle
npx tsc --noEmit
npm run build
```

## Security & Third-Party Media Hosts

### External Image Origin: `images.pexels.com`
The admin console connects to `images.pexels.com` strictly for manual destination photo previews in the Style Collections manager (`#/collections/:key`):
- **User-Initiated Only**: Previews are fetched only when an editor explicitly clicks the "Preview photo" button. Previews are never requested automatically or in bulk.
- **Privacy & Referrer Policy**: All preview thumbnail `<img>` elements enforce `referrerpolicy="no-referrer"` and `loading="lazy"`.
- **Approved Origin**: `images.pexels.com` is the only external third-party media host loaded by the admin console. No external tracker, analytical pixel, or unapproved CDN is permitted.

## Navigation & Role-Based Access Control

The admin console implements strict client-side route guards and navigation filtering:
- **Super Admin (`super_admin`)**: Full access (Dashboard, Places, Hotels, Collections, Admins, Audit Log).
- **Content Editor (`content_editor`)**: Catalog & content access (Dashboard, Places, Hotels, Collections).
- **Support Agent (`support_agent`)**: Read-only operations access (Dashboard only). Direct navigation to `/places`, `/hotels`, `/collections`, `/admins`, or `/audit` renders a "Not permitted" view with zero network requests emitted.

