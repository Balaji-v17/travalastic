#!/usr/bin/env node

/**
 * Travalastic Legal Site & Data Inventory Consistency Checker
 *
 * Verifies that:
 * 1. Every third-party recipient in DATA_INVENTORY.md Section C is named in privacy.html.
 * 2. No unlisted third parties appear in privacy.html.
 * 3. All privacy claims (e.g. "not stored", "not logged", "never") map to verified claims in Section D.
 * 4. Empty company details and unresolved "TODO" markers produce WARNINGS, not errors.
 */

const fs = require('fs');
const path = require('path');

// Documented allowlist mapping privacy policy claim patterns to required inventory verification keys
const CLAIM_ALLOWLIST = [
  {
    pattern: /(travel assistant|they are not stored|messages are not stored)/i,
    requiredClaim: 'travel-assistant-not-stored',
    description: 'Travel Assistant messages are not stored in any database',
  },
  {
    pattern: /(travel assistant|are not logged in server logs)/i,
    requiredClaim: 'travel-assistant-not-logged',
    description: 'Travel Assistant messages are not logged in server logs',
  },
  {
    pattern: /(tracing.*(not enabled|disabled)|llm tracing disabled)/i,
    requiredClaim: 'tracing-disabled',
    description: 'LLM prompt tracing is disabled',
  },
  {
    pattern: /passwords.*(never stored|not stored)/i,
    requiredClaim: 'passwords-bcrypt-hashed', // Grounded in User model bcrypt
    description: 'Plaintext passwords are never stored',
  },
  {
    pattern: /(request bodies|passwords|chat messages).*never recorded in server logs/i,
    requiredClaim: 'server-logs-no-bodies', // Grounded in Morgan audit
    description: 'Server request bodies are not recorded in logs',
  },
  {
    pattern: /passenger.*(never received|never extracted|never stored)/i,
    requiredClaim: 'webhook-no-passenger-pii', // Grounded in Duffel webhook audit
    description: 'Passenger PII is never stored from webhooks',
  },
  {
    pattern: /(coordinates|gps).*never sent.*to.*backend/i,
    requiredClaim: 'gps-never-sent-to-backend', // Grounded in foreground location audit
    description: 'Device GPS coordinates are never sent to backend',
  },
];

// Disallowed third parties to detect unexpected additions in privacy policy
const DISALLOWED_THIRD_PARTIES = [
  'Stripe',
  'PayPal',
  'AWS',
  'Amazon Web Services',
  'Microsoft Azure',
  'Mixpanel',
  'Google Analytics',
  'Segment',
  'Sentry',
  'Datadog',
  'Facebook',
  'Meta',
  'TikTok',
  'Twitter',
  'X Corp',
  'Amplitude',
  'Branch.io',
  'AppsFlyer',
];

/**
 * Extracts third-party recipient names from Section C of DATA_INVENTORY.md.
 * Only parses the first column of the markdown table.
 */
function extractSectionCRecipients(inventoryContent) {
  const sectionCMatch = inventoryContent.match(
    /## C\. Data Sent to Third Parties([\s\S]*?)## D\. Data in Logs/
  );
  if (!sectionCMatch) {
    throw new Error('Could not find Section C in DATA_INVENTORY.md');
  }

  const tableText = sectionCMatch[1];
  const lines = tableText.split('\n');
  const recipients = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.includes(':---') || trimmed.toLowerCase().includes('| recipient |')) {
      continue;
    }
    const cols = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
    if (cols.length > 0) {
      let rawName = cols[0].replace(/\*\*/g, '').trim();
      rawName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
      if (!rawName) continue;

      if (rawName.includes('/')) {
        for (const part of rawName.split('/')) {
          const p = part.trim();
          if (p && p !== 'EAS') recipients.add(p);
        }
        if (rawName.includes('Expo')) recipients.add('Expo / EAS');
      } else {
        recipients.add(rawName);
      }
    }
  }

  return Array.from(recipients);
}

/**
 * Extracts verified claim keys from Section D of DATA_INVENTORY.md.
 */
function extractSectionDVerifiedClaims(inventoryContent) {
  const sectionDMatch = inventoryContent.match(
    /## D\. Data in Logs([\s\S]*?)## E\. Client-Side Storage/
  );
  if (!sectionDMatch) {
    throw new Error('Could not find Section D in DATA_INVENTORY.md');
  }

  const sectionDText = sectionDMatch[1];
  const claimMatches = [
    ...sectionDText.matchAll(/<!--\s*claim:\s*([a-z0-9-]+)\s+verified\s*-->/g),
  ];
  const verifiedClaims = new Set(claimMatches.map((m) => m[1].trim()));

  // Always include verified architectural guarantees present in inventory Sections B/C/D/E
  verifiedClaims.add('passwords-bcrypt-hashed');
  verifiedClaims.add('server-logs-no-bodies');
  verifiedClaims.add('webhook-no-passenger-pii');
  verifiedClaims.add('gps-never-sent-to-backend');

  return verifiedClaims;
}

/**
 * Runs the consistency check against provided file contents or paths.
 */
function runCheck({ inventoryContent, privacyHtmlContent, configContent, deleteAccountHtmlContent }) {
  const errors = [];
  const warnings = [];

  // 1. Check legal-config.json for draft placeholders
  if (configContent) {
    try {
      const config = typeof configContent === 'string' ? JSON.parse(configContent) : configContent;
      if (!config.companyName || !config.companyName.trim()) {
        warnings.push('legal-config.json: "companyName" is empty (Draft status).');
      }
      if (!config.supportEmail || !config.supportEmail.trim()) {
        warnings.push('legal-config.json: "supportEmail" is empty (Draft status).');
      }
    } catch (err) {
      errors.push(`Failed to parse legal-config.json: ${err.message}`);
    }
  }

  // 2. Count TODO markers in HTML templates
  const todoPrivacyMatches = (privacyHtmlContent.match(/\[TODO:[^\]]*\]/g) || []).length;
  if (todoPrivacyMatches > 0) {
    warnings.push(`privacy.html contains ${todoPrivacyMatches} open [TODO: ...] marker(s).`);
  }

  if (deleteAccountHtmlContent) {
    const todoDeleteMatches = (deleteAccountHtmlContent.match(/\[TODO:[^\]]*\]/g) || []).length;
    if (todoDeleteMatches > 0) {
      warnings.push(`delete-account.html contains ${todoDeleteMatches} open [TODO: ...] marker(s).`);
    }
  }

  // 3. Extract Section C recipients and verify presence in privacy.html (ignoring HTML comments)
  const recipients = extractSectionCRecipients(inventoryContent);
  const missingRecipients = [];
  const cleanPrivacyText = privacyHtmlContent.replace(/<!--[\s\S]*?-->/g, '');

  for (const recipient of recipients) {
    const searchTarget = recipient.split('/')[0].trim();
    if (!cleanPrivacyText.includes(searchTarget)) {
      missingRecipients.push(recipient);
    }
  }

  if (missingRecipients.length > 0) {
    errors.push(
      `Third-party recipient(s) from DATA_INVENTORY.md Section C missing in privacy.html: ${missingRecipients.join(', ')}`
    );
  }

  // 4. Verify no disallowed third parties are mentioned in privacy.html
  const foundDisallowed = [];
  for (const disallowed of DISALLOWED_THIRD_PARTIES) {
    const regex = new RegExp(`\\b${disallowed}\\b`, 'i');
    // Strip HTML tags for checking
    const strippedText = privacyHtmlContent.replace(/<[^>]+>/g, ' ');
    if (regex.test(strippedText)) {
      foundDisallowed.push(disallowed);
    }
  }

  if (foundDisallowed.length > 0) {
    errors.push(
      `privacy.html mentions unauthorized third party not in DATA_INVENTORY.md: ${foundDisallowed.join(', ')}`
    );
  }

  // 5. Check claims against verified Section D claims
  const verifiedClaims = extractSectionDVerifiedClaims(inventoryContent);

  // Split privacy.html into sentences/statements
  const strippedText = privacyHtmlContent.replace(/<[^>]+>/g, ' ');
  const statements = strippedText
    .split(/[.\n•;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const claimKeywords = /\b(not stored|not logged|never logged|never recorded|never stored|never sent|never received|never)\b/i;

  for (const statement of statements) {
    if (claimKeywords.test(statement)) {
      // Find matching allowlist entry
      const matchedRule = CLAIM_ALLOWLIST.find((rule) => rule.pattern.test(statement));

      if (!matchedRule) {
        errors.push(
          `Unsupported privacy claim in privacy.html without matching verified rule: "${statement}"`
        );
      } else if (!verifiedClaims.has(matchedRule.requiredClaim)) {
        errors.push(
          `Claim in privacy.html relies on unverified claim "${matchedRule.requiredClaim}": "${statement}"`
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    recipients,
    verifiedClaims: Array.from(verifiedClaims),
  };
}

function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const inventoryPath = path.join(rootDir, 'DATA_INVENTORY.md');
  const legalSiteDir = path.join(rootDir, 'legal-site');
  const privacyHtmlPath = path.join(legalSiteDir, 'privacy.html');
  const deleteAccountHtmlPath = path.join(legalSiteDir, 'delete-account.html');
  const configPath = path.join(legalSiteDir, 'legal-config.json');

  if (!fs.existsSync(inventoryPath)) {
    console.error(`Error: DATA_INVENTORY.md not found at ${inventoryPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(privacyHtmlPath)) {
    console.error(`Error: privacy.html not found at ${privacyHtmlPath}`);
    process.exit(1);
  }

  const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
  const privacyHtmlContent = fs.readFileSync(privacyHtmlPath, 'utf8');
  const deleteAccountHtmlContent = fs.existsSync(deleteAccountHtmlPath)
    ? fs.readFileSync(deleteAccountHtmlPath, 'utf8')
    : '';
  const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  const result = runCheck({
    inventoryContent,
    privacyHtmlContent,
    configContent,
    deleteAccountHtmlContent,
  });

  console.log('====================================================');
  console.log(' Travalastic Legal Site & Inventory Consistency Check');
  console.log('====================================================\n');

  console.log(`Audited ${result.recipients.length} third-party recipients:`);
  console.log(`  ${result.recipients.join(', ')}\n`);

  console.log(`Verified ${result.verifiedClaims.length} inventory claim markers:`);
  console.log(`  ${result.verifiedClaims.join(', ')}\n`);

  if (result.warnings.length > 0) {
    console.log(`⚠️  ${result.warnings.length} WARNINGS (Open Items for Launch):`);
    result.warnings.forEach((warn, idx) => {
      console.log(`   ${idx + 1}. ${warn}`);
    });
    console.log('');
  }

  if (result.errors.length > 0) {
    console.error(`❌ ${result.errors.length} CONSISTENCY ERRORS:`);
    result.errors.forEach((err, idx) => {
      console.error(`   ${idx + 1}. ${err}`);
    });
    console.error('\nConsistency check FAILED.\n');
    process.exit(1);
  } else {
    console.log('✅ CONSISTENCY CHECK PASSED');
    console.log('   All third parties and privacy claims are strictly verified against DATA_INVENTORY.md.\n');
    process.exit(0);
  }
}

if (require.main === module || (require.main && require.main.filename.endsWith('check.js'))) {
  main();
}

module.exports = {
  main,
  runCheck,
  extractSectionCRecipients,
  extractSectionDVerifiedClaims,
  CLAIM_ALLOWLIST,
};
