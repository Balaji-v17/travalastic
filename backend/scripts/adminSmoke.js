#!/usr/bin/env node

/**
 * Manual Role Smoke Test Script: backend/scripts/adminSmoke.js
 *
 * Verifies role-based access control across all admin route groups:
 * - super_admin
 * - content_editor
 * - support_agent
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL="super@travalastic.com" SUPER_ADMIN_PASSWORD="password" \
 *   EDITOR_EMAIL="editor@travalastic.com" EDITOR_PASSWORD="password" \
 *   SUPPORT_EMAIL="support@travalastic.com" SUPPORT_PASSWORD="password" \
 *   node scripts/adminSmoke.js [baseUrl]
 *
 * Note: Never prints passwords or authentication tokens to stdout or logs.
 */

import 'dotenv/config';

const BASE_URL = (process.argv[2] || process.env.ADMIN_SMOKE_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

const TEST_ROLES = [
  {
    role: 'super_admin',
    email: process.env.SUPER_ADMIN_EMAIL || 'smoke_super@travalastic.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Password1234!',
  },
  {
    role: 'content_editor',
    email: process.env.EDITOR_EMAIL || 'smoke_editor@travalastic.com',
    password: process.env.EDITOR_PASSWORD || 'Password1234!',
  },
  {
    role: 'support_agent',
    email: process.env.SUPPORT_EMAIL || 'smoke_support@travalastic.com',
    password: process.env.SUPPORT_PASSWORD || 'Password1234!',
  },
];

const ROUTE_TESTS = [
  {
    group: 'Auth / Me',
    path: '/admin/auth/me',
    expected: {
      super_admin: 200,
      content_editor: 200,
      support_agent: 200,
    },
  },
  {
    group: 'Places Manager',
    path: '/admin/places?limit=1',
    expected: {
      super_admin: 200,
      content_editor: 200,
      support_agent: 403,
    },
  },
  {
    group: 'Hotels Manager',
    path: '/admin/hotels?limit=1',
    expected: {
      super_admin: 200,
      content_editor: 200,
      support_agent: 403,
    },
  },
  {
    group: 'Style Collections',
    path: '/admin/styles',
    expected: {
      super_admin: 200,
      content_editor: 200,
      support_agent: 403,
    },
  },
  {
    group: 'Support (Lookup)',
    path: '/admin/support/users?email=nonexistent_smoke_test@travalastic.com',
    expected: {
      super_admin: 404, // Authorized to query; 404 indicates authorized user lookup
      content_editor: 403, // Forbidden
      support_agent: 404, // Authorized to query; 404 indicates authorized user lookup
    },
  },
  {
    group: 'Admins Manager',
    path: '/admin/admins',
    expected: {
      super_admin: 200,
      content_editor: 403,
      support_agent: 403,
    },
  },
  {
    group: 'Audit Log Viewer',
    path: '/admin/audit?limit=1',
    expected: {
      super_admin: 200,
      content_editor: 403,
      support_agent: 403,
    },
  },
];

async function apiRequest(endpoint, { method = 'GET', token = null, body = null } = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, data };
}

async function runSmokeTest() {
  console.log('========================================================================');
  console.log(` Travalastic Admin Role RBAC Smoke Test`);
  console.log(` Target Base URL: ${BASE_URL}`);
  console.log('========================================================================\n');

  const roleTokens = {};
  const signinErrors = [];

  // Step 1: Sign in as each test account
  for (const { role, email, password } of TEST_ROLES) {
    process.stdout.write(`Signing in as ${role} (${email})... `);
    try {
      const res = await apiRequest('/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if (res.status === 200 && res.data?.token) {
        roleTokens[role] = res.data.token;
        console.log(`OK (HTTP 200)`);
      } else {
        const errorMsg = res.data?.error || `HTTP ${res.status}`;
        console.log(`FAILED (${errorMsg})`);
        signinErrors.push({ role, email, status: res.status, error: errorMsg });
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      signinErrors.push({ role, email, status: 0, error: err.message });
    }
  }

  console.log('\n--- Role Access Verification Table ---\n');

  const resultsTable = [];
  let allPassed = true;

  for (const route of ROUTE_TESTS) {
    for (const { role } of TEST_ROLES) {
      const expectedStatus = route.expected[role];
      const token = roleTokens[role];

      let actualStatus = 'SKIPPED (no token)';
      let pass = false;

      if (token) {
        try {
          const res = await apiRequest(route.path, { token });
          actualStatus = res.status;
          pass = actualStatus === expectedStatus;
        } catch (err) {
          actualStatus = `ERR: ${err.message}`;
          pass = false;
        }
      }

      if (!pass) allPassed = false;

      resultsTable.push({
        'Route Group': route.group,
        'Path': route.path.split('?')[0],
        'Role': role,
        'Expected': expectedStatus,
        'Actual': actualStatus,
        'Result': pass ? 'PASS' : 'FAIL',
      });
    }
  }

  console.table(resultsTable);

  if (signinErrors.length > 0) {
    console.log('\n⚠️ Note on Sign-in Failures:');
    console.log('One or more test accounts could not sign in. Ensure test accounts exist in the database');
    console.log('or set SUPER_ADMIN_EMAIL, EDITOR_EMAIL, and SUPPORT_EMAIL in your environment.\n');
  }

  console.log(`Overall RBAC Smoke Result: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'ATTENTION REQUIRED ⚠️'}\n`);
  return allPassed;
}

runSmokeTest().catch((err) => {
  console.error('Fatal error during smoke test execution:', err.message);
  process.exit(1);
});

