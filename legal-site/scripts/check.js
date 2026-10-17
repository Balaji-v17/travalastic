#!/usr/bin/env node

/**
 * Travalastic Legal Site Pre-Submission Check
 * Exits 1 if companyName or supportEmail is empty OR any "[COMPANY TO CONFIRM" marker remains in built pages.
 * Exits 0 otherwise.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'legal-config.json');
const distDir = path.join(rootDir, 'dist');
const buildScriptPath = path.join(rootDir, 'scripts', 'build.js');

const errors = [];

// 1. Check legal-config.json existence and fields
if (!fs.existsSync(configPath)) {
  errors.push(`Config file not found at ${configPath}`);
} else {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.companyName || !config.companyName.trim()) {
      errors.push('Configuration: "companyName" is empty in legal-config.json.');
    }

    if (!config.supportEmail || !config.supportEmail.trim()) {
      errors.push('Configuration: "supportEmail" is empty in legal-config.json.');
    }
  } catch (err) {
    errors.push(`Configuration: Failed to parse legal-config.json: ${err.message}`);
  }
}

// 2. Ensure built pages exist (run build.js if dist/ is missing or empty)
if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
  try {
    console.log('Building legal site for verification...');
    execFileSync(process.execPath, [buildScriptPath], { stdio: 'pipe' });
  } catch (err) {
    errors.push(`Build failed: ${err.message}`);
  }
}

// 3. Check for any "[COMPANY TO CONFIRM" markers in dist/ HTML files
if (fs.existsSync(distDir)) {
  const htmlFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.html'));

  if (htmlFiles.length === 0) {
    errors.push('No HTML files found in dist/ to check.');
  }

  for (const file of htmlFiles) {
    const filePath = path.join(distDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('[COMPANY TO CONFIRM')) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('[COMPANY TO CONFIRM')) {
          const match = line.match(/\[COMPANY TO CONFIRM:[^\]]+\]/);
          const markerText = match ? match[0] : line.trim();
          errors.push(`Unresolved marker in dist/${file} (line ${index + 1}): ${markerText}`);
        }
      });
    }
  }
}

// 4. Output results and exit
if (errors.length > 0) {
  console.error('\n❌ PRE-SUBMISSION CHECK FAILED');
  console.error('The legal pages cannot be published until the following items are addressed:\n');
  errors.forEach((err, idx) => {
    console.error(`  ${idx + 1}. ${err}`);
  });
  console.error('\nPlease update legal-config.json and resolve all template markers, rebuild with:');
  console.error('  node scripts/build.js\n');
  process.exit(1);
} else {
  console.log('\n✅ PRE-SUBMISSION CHECK PASSED');
  console.log('  • Company name and support email are configured.');
  console.log('  • No "[COMPANY TO CONFIRM" markers remain in built pages.');
  console.log('Site is ready for deployment and App Store / Google Play submission.\n');
  process.exit(0);
}

