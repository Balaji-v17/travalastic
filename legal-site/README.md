# Travalastic Legal Site

A lightweight, dependency-free static legal website for Travalastic. Built with pure HTML and CSS, system fonts, mobile-first design, high-contrast light and dark mode, and zero client-side JavaScript, trackers, or external network requests.

---

## Directory Structure

```
legal-site/
├── legal-config.json     # Configuration values (appName, companyName, supportEmail, lastUpdated)
├── index.html            # Hub page linking to all legal documents
├── privacy.html          # Privacy Policy template (drafted strictly from DATA_INVENTORY.md)
├── delete-account.html   # Account deletion guide and options
├── styles.css            # Pure CSS styles (responsive, high contrast, system fonts, dark mode)
├── dist/                 # Generated static website (gitignored)
├── scripts/
│   ├── build.js          # Node script to compile templates and inject draft banners
│   └── check.js          # Pre-submission validator (exits 1 if unready, exits 0 if ready)
└── README.md
```

---

## 1. Filling the Configuration

Edit `legal-site/legal-config.json` before publishing:

```json
{
  "appName": "Travalastic",
  "companyName": "Your Legal Entity Name Pvt. Ltd.",
  "supportEmail": "support@yourdomain.com",
  "lastUpdated": "October 9, 2026"
}
```

*Note: If `companyName` or `supportEmail` is left blank, `build.js` will automatically inject a prominent warning banner at the top of every page stating that the document is a DRAFT not for publication.*

---

## 2. Resolving Confirmation Markers

Open `privacy.html` and `delete-account.html` and resolve all markers formatted as:
`[COMPANY TO CONFIRM: <what is needed>]`

These include:
- **Governing Jurisdiction and Legal Basis:** Section 1 of `privacy.html`
- **Minimum Age Requirement:** Section 1 of `privacy.html`
- **Data Retention Periods:** Section 6 of `privacy.html`
- **Database Backup Retention:** Section 6 of `privacy.html` & Option 1 of `delete-account.html`
- **Grievance Officer Contact Details:** Section 9 of `privacy.html`
- **Manual Account Deletion Verification & SLA:** Option 2 of `delete-account.html`

Replace the entire `[COMPANY TO CONFIRM: ...]` placeholder with your company's confirmed policy text.

---

## 3. Building the Site

To build the static site into `legal-site/dist/`, run:

```bash
cd legal-site
node scripts/build.js
```

Or from the repository root:

```bash
node legal-site/scripts/build.js
```

This compiles `index.html`, `privacy.html`, `delete-account.html`, substitutes all `{{placeholder}}` values, injects the draft banner if fields are missing, and copies `styles.css` to `dist/`.

---

## 4. Pre-Submission Rule

Before submitting your app to Google Play Store or Apple App Store, run the pre-submission check script:

```bash
cd legal-site
node scripts/check.js
```

### Validation Rule:
**Do NOT submit to Google Play or the App Store until `node scripts/check.js` exits with code 0.**

The script will fail with exit code `1` and print detailed errors if:
1. `companyName` or `supportEmail` in `legal-config.json` is empty.
2. Any `[COMPANY TO CONFIRM: ...]` marker remains in the built HTML pages.

---

## 5. Deploying to Vercel

To host this static site as an independent legal portal on Vercel:

1. In the Vercel Dashboard, select **Add New Project** and import the Travalastic repository.
2. Configure the project settings:
   - **Framework Preset:** `Other`
   - **Root Directory:** `legal-site`
   - **Build Command:** `node scripts/build.js`
   - **Output Directory:** `dist`
3. Click **Deploy**.

Once deployed, link the generated Vercel URLs to `mobile/config/legal.js` (`PRIVACY_POLICY_URL` and `ACCOUNT_DELETION_INFO_URL`) and your Google Play Store Console privacy policy URL field.

