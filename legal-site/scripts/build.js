#!/usr/bin/env node

/**
 * Travalastic Legal Site Builder
 * Dependency-free Node script to compile templates with legal-config.json
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'legal-config.json');
const distDir = path.join(rootDir, 'dist');
const stylesPath = path.join(rootDir, 'styles.css');

if (!fs.existsSync(configPath)) {
  console.error(`Error: Config file not found at ${configPath}`);
  process.exit(1);
}

const rawConfig = fs.readFileSync(configPath, 'utf8');
let config;
try {
  config = JSON.parse(rawConfig);
} catch (err) {
  console.error(`Error parsing legal-config.json: ${err.message}`);
  process.exit(1);
}

const isCompanyNameEmpty = !config.companyName || !config.companyName.trim();
const isSupportEmailEmpty = !config.supportEmail || !config.supportEmail.trim();
const isDraft = isCompanyNameEmpty || isSupportEmailEmpty;

const DRAFT_BANNER_HTML = `
  <div class="draft-banner">
    <strong>DRAFT: NOT FOR PUBLICATION.</strong>
    Company name and/or support email not set.
  </div>
`;

// Ensure dist directory exists
fs.mkdirSync(distDir, { recursive: true });

// Copy styles.css to dist
if (fs.existsSync(stylesPath)) {
  fs.copyFileSync(stylesPath, path.join(distDir, 'styles.css'));
  console.log('✓ Copied styles.css to dist/');
} else {
  console.warn('⚠ Warning: styles.css not found in root legal-site folder');
}

const templates = ['index.html', 'privacy.html', 'delete-account.html'];

const replacements = {
  '{{appName}}': config.appName || '',
  '{{companyName}}': config.companyName || '',
  '{{supportEmail}}': config.supportEmail || '',
  '{{lastUpdated}}': config.lastUpdated || '',
};

for (const templateName of templates) {
  const templatePath = path.join(rootDir, templateName);
  if (!fs.existsSync(templatePath)) {
    console.warn(`⚠ Warning: Template ${templateName} not found, skipping.`);
    continue;
  }

  let content = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }

  // Inject prominent banner at top of page if draft mode
  if (isDraft) {
    if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/(<body[^>]*>)/i, `$1${DRAFT_BANNER_HTML}`);
    } else {
      content = DRAFT_BANNER_HTML + content;
    }
  }

  const outputPath = path.join(distDir, templateName);
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✓ Built ${templateName} -> dist/${templateName}${isDraft ? ' (with DRAFT banner)' : ''}`);
}

console.log('\nBuild complete successfully.');
if (isDraft) {
  console.log('NOTICE: Built in DRAFT mode because companyName and/or supportEmail is not set.');
}

