#!/usr/bin/env node

/**
 * Root runner for support-side deleteUserByEmail script.
 * Delegates execution to backend/scripts/deleteUserByEmail.js within the backend environment.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../backend/scripts/deleteUserByEmail.js');
const backendDir = path.resolve(__dirname, '../backend');

const res = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  cwd: backendDir,
  stdio: 'inherit',
});

process.exit(res.status ?? 1);

