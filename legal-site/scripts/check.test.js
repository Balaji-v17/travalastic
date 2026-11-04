const { describe, it } = require('node:test');
const assert = require('node:assert');
const { runCheck } = require('./check.js');

describe('Legal Site Consistency Checker Unit Tests', () => {
  const baseInventory = `
# Data Inventory
## C. Data Sent to Third Parties
| Recipient | What is Sent |
| :--- | :--- |
| **Groq** | User prompt |
| **Duffel** | Flight booking |

## D. Data in Logs
<!-- claim: travel-assistant-not-stored verified -->
<!-- claim: travel-assistant-not-logged verified -->
- Logging is minimal.

## E. Client-Side Storage
  `;

  // Fixture 1: Consistent
  it('Fixture 1 (consistent): passes when all recipients are present and claims verified', () => {
    const consistentPrivacy = `
      <html>
        <body>
          <p>We transmit data to Groq for AI features and Duffel for flights.</p>
          <p>Travel Assistant messages are not stored in any database.</p>
          <p>Travel Assistant messages are not logged in server logs.</p>
        </body>
      </html>
    `;

    const result = runCheck({
      inventoryContent: baseInventory,
      privacyHtmlContent: consistentPrivacy,
      configContent: JSON.stringify({ companyName: 'Travalastic Inc', supportEmail: 'privacy@travalastic.com' }),
    });

    assert.strictEqual(result.success, true, 'Check should succeed on consistent fixture');
    assert.strictEqual(result.errors.length, 0);
  });

  // Fixture 2: Missing Recipient
  it('Fixture 2 (missing recipient): fails when a Section C recipient is omitted from privacy policy', () => {
    const missingRecipientPrivacy = `
      <html>
        <body>
          <!-- Groq is mentioned, but Duffel is omitted -->
          <p>We transmit data to Groq for AI features.</p>
          <p>Travel Assistant messages are not stored in any database.</p>
        </body>
      </html>
    `;

    const result = runCheck({
      inventoryContent: baseInventory,
      privacyHtmlContent: missingRecipientPrivacy,
      configContent: JSON.stringify({ companyName: 'Travalastic Inc', supportEmail: 'privacy@travalastic.com' }),
    });

    assert.strictEqual(result.success, false, 'Check must fail when recipient is missing');
    assert(result.errors.some((err) => err.includes('Duffel')), 'Error must mention missing Duffel recipient');
  });

  // Fixture 3: Unsupported Claim
  it('Fixture 3 (unsupported claim): fails when policy asserts unverified claims', () => {
    const unsupportedClaimPrivacy = `
      <html>
        <body>
          <p>We transmit data to Groq and Duffel.</p>
          <!-- Unsupported claim not matching any verified rule in Section D -->
          <p>User browsing activity is never shared with advertising partners.</p>
        </body>
      </html>
    `;

    const result = runCheck({
      inventoryContent: baseInventory,
      privacyHtmlContent: unsupportedClaimPrivacy,
      configContent: JSON.stringify({ companyName: 'Travalastic Inc', supportEmail: 'privacy@travalastic.com' }),
    });

    assert.strictEqual(result.success, false, 'Check must fail on unsupported privacy claim');
    assert(
      result.errors.some((err) => err.includes('Unsupported privacy claim') && err.includes('never shared')),
      'Error must flag unsupported claim'
    );
  });
});

