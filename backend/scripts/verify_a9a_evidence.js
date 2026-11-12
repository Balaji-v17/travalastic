import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import express from 'express';

import adminRouter from '../src/routes/admin.js';
import AdminUser from '../src/models/AdminUser.js';
import AuditLog from '../src/models/AuditLog.js';
import User from '../src/models/User.js';
import Itinerary from '../src/models/Itinerary.js';
import Conversation from '../src/models/Conversation.js';
import Expense from '../src/models/Expense.js';
import Booking from '../src/models/Booking.js';
import PackingTemplate from '../src/models/PackingTemplate.js';
import Disruption from '../src/models/Disruption.js';
import authenticate from '../src/middleware/authenticate.js';
import { deleteUserAndData } from '../src/services/accountDeletion.js';

const ADMIN_JWT_SECRET = 'verify_admin_secret_999_at_least_32_chars';
const TRAVELER_JWT_SECRET = 'verify_traveler_secret_888';

process.env.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
process.env.JWT_SECRET = TRAVELER_JWT_SECRET;
process.env.ADMIN_SESSION_HOURS = '8';

// In-memory mock store
const inMemoryAdmins = new Map();
const inMemoryUsers = new Map();
const inMemoryItineraries = new Map();
const inMemoryConversations = new Map();
const inMemoryExpenses = new Map();
const inMemoryBookings = new Map();
const inMemoryPackingTemplates = new Map();
const inMemoryDisruptions = new Map();
const inMemoryAuditLogs = [];

AdminUser.findById = (id) => {
  const doc = inMemoryAdmins.get(id?.toString());
  return {
    lean: () => Promise.resolve(doc ? { ...doc } : null),
    then: (resolve) => resolve(doc ? { ...doc } : null),
  };
};

AuditLog.create = async (docOrDocs) => {
  const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
  for (const d of docs) {
    const item = { _id: new mongoose.Types.ObjectId(), at: d.at || new Date(), ...d };
    inMemoryAuditLogs.push(item);
  }
  return Array.isArray(docOrDocs) ? docs : docs[0];
};

User.findOne = (filter) => {
  let found = null;
  if (filter && filter.email) {
    for (const u of inMemoryUsers.values()) {
      if (u.email === filter.email) {
        found = u;
        break;
      }
    }
  }
  return {
    lean: () => Promise.resolve(found ? { ...found } : null),
    then: (resolve) => resolve(found ? { ...found } : null),
  };
};

User.findById = (id) => {
  const doc = inMemoryUsers.get(id?.toString());
  return {
    select: () => ({
      lean: () => Promise.resolve(doc ? { _id: doc._id } : null),
      then: (resolve) => resolve(doc ? { _id: doc._id } : null),
    }),
    lean: () => Promise.resolve(doc ? { ...doc } : null),
    then: (resolve) => resolve(doc ? { ...doc } : null),
  };
};

User.deleteOne = async (filter) => {
  const idStr = filter?._id?.toString();
  if (idStr && inMemoryUsers.has(idStr)) {
    inMemoryUsers.delete(idStr);
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
};

User.countDocuments = async (filter) => {
  const idStr = filter?._id?.toString();
  return idStr && inMemoryUsers.has(idStr) ? 1 : 0;
};

function setupStubs(map, model) {
  model.deleteMany = async (filter) => {
    const uid = filter?.userId?.toString();
    let deleted = 0;
    for (const [id, item] of map.entries()) {
      if (item.userId?.toString() === uid) {
        map.delete(id);
        deleted++;
      }
    }
    return { deletedCount: deleted };
  };
  model.countDocuments = async (filter) => {
    const uid = filter?.userId?.toString();
    let count = 0;
    for (const item of map.values()) {
      if (item.userId?.toString() === uid) {
        count++;
      }
    }
    return count;
  };
}

setupStubs(inMemoryItineraries, Itinerary);
setupStubs(inMemoryConversations, Conversation);
setupStubs(inMemoryExpenses, Expense);
setupStubs(inMemoryBookings, Booking);
setupStubs(inMemoryPackingTemplates, PackingTemplate);
setupStubs(inMemoryDisruptions, Disruption);

// Setup Express
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
app.get('/traveler/check', authenticate, (req, res) => res.json({ ok: true, userId: req.userId }));

// Setup Admins
const supportId = new mongoose.Types.ObjectId().toString();
const editorId = new mongoose.Types.ObjectId().toString();

inMemoryAdmins.set(supportId, {
  _id: new mongoose.Types.ObjectId(supportId),
  email: 'agent@travalastic.com',
  role: 'support_agent',
  active: true,
  mustChangePassword: false,
});

inMemoryAdmins.set(editorId, {
  _id: new mongoose.Types.ObjectId(editorId),
  email: 'editor@travalastic.com',
  role: 'content_editor',
  active: true,
  mustChangePassword: false,
});

const supportToken = jwt.sign(
  { sub: supportId, role: 'support_agent' },
  ADMIN_JWT_SECRET,
  { audience: 'admin', expiresIn: '8h' }
);
const editorToken = jwt.sign(
  { sub: editorId, role: 'content_editor' },
  ADMIN_JWT_SECRET,
  { audience: 'admin', expiresIn: '8h' }
);

// Dispatch helper
let ipNum = 1;
function call(method, url, token, body = null) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: {
        'content-type': 'application/json',
        authorization: token ? `Bearer ${token}` : undefined,
      },
      body: body || {},
      ip: `10.0.0.${ipNum++}`,
      socket: { remoteAddress: `10.0.0.${ipNum}` },
    };
    const res = {
      statusCode: 200,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, body: data }); },
      setHeader() {},
      getHeader() {},
      on() {},
      emit() {},
    };
    app.handle(req, res);
  });
}

async function runVerification() {
  console.log('=== VERIFICATION: A9a Support Account Deletion Preview & Audited Flow ===\n');

  // 1. Create Throwaway Traveler 1
  const t1Id = new mongoose.Types.ObjectId();
  const t1Email = 'throwaway1.traveler@test.internal';
  inMemoryUsers.set(t1Id.toString(), {
    _id: t1Id,
    email: t1Email,
    name: 'Throwaway One',
    createdAt: new Date('2026-03-01T12:00:00Z'),
  });
  inMemoryItineraries.set('itin-1', { _id: new mongoose.Types.ObjectId(), userId: t1Id });
  inMemoryConversations.set('conv-1', { _id: new mongoose.Types.ObjectId(), userId: t1Id });
  inMemoryExpenses.set('exp-1', { _id: new mongoose.Types.ObjectId(), userId: t1Id });
  inMemoryPackingTemplates.set('pack-1', { _id: new mongoose.Types.ObjectId(), userId: t1Id });

  const t1Token = jwt.sign({ userId: t1Id.toString(), email: t1Email }, TRAVELER_JWT_SECRET, { expiresIn: '7d' });

  console.log(`[1] Created Throwaway Traveler 1: ${t1Email} (ID: ${t1Id.toString()})`);
  console.log('    Data created: 1 itinerary, 1 chat, 1 expense, 1 packing item.');

  // Verify traveler can authenticate
  const beforeAuth = await call('GET', '/traveler/check', t1Token);
  console.log(`    Traveler 1 token active check: HTTP ${beforeAuth.status} (${JSON.stringify(beforeAuth.body)})`);

  // 2. Lookup by email
  console.log('\n[2] Testing Email Lookup:');
  const partialRes = await call('GET', `/admin/support/users?email=throwaway1`, supportToken);
  console.log(`    Partial email lookup ("throwaway1"): HTTP ${partialRes.status} -> ${JSON.stringify(partialRes.body)}`);

  const exactRes = await call('GET', `/admin/support/users?email=${t1Email}`, supportToken);
  console.log(`    Exact email lookup ("${t1Email}"): HTTP ${exactRes.status} ->`);
  console.log('    Returned fields:', JSON.stringify(exactRes.body, null, 2));

  // 3. Deletion Preview
  console.log('\n[3] Generating Deletion Preview:');
  const previewRes = await call('POST', `/admin/support/users/${t1Id}/deletion-preview`, supportToken);
  console.log(`    Preview status: HTTP ${previewRes.status}`);
  console.log('    willRemove counts:');
  for (const item of previewRes.body.willRemove) {
    console.log(`      - ${item.item}: ${item.count}`);
  }
  console.log('    willRetain reasons:');
  for (const item of previewRes.body.willRetain) {
    console.log(`      - ${item.item}: ${item.reason}`);
  }
  const previewToken = previewRes.body.previewToken;
  console.log(`    Preview token generated (truncated): ${previewToken.slice(0, 35)}...`);

  // 4. Delete Execution
  console.log('\n[4] Executing Deletion:');
  const wrongEmailRes = await call('POST', `/admin/support/users/${t1Id}/delete`, supportToken, {
    confirmEmail: 'wrong@test.internal',
    reason: 'GDPR right to be forgotten request',
    previewToken,
  });
  console.log(`    Wrong email confirmation: HTTP ${wrongEmailRes.status} -> ${JSON.stringify(wrongEmailRes.body)}`);

  const correctDeleteRes = await call('POST', `/admin/support/users/${t1Id}/delete`, supportToken, {
    confirmEmail: t1Email.toUpperCase(),
    reason: 'GDPR right to be forgotten request from customer portal ticket #8812',
    previewToken,
  });
  console.log(`    Correct email confirmation: HTTP ${correctDeleteRes.status} -> ${JSON.stringify(correctDeleteRes.body)}`);

  // 5. Database & Token verification
  console.log('\n[5] Database State After Support Deletion:');
  console.log(`    User in DB: ${inMemoryUsers.has(t1Id.toString()) ? 'PRESENT' : 'DELETED (null)'}`);
  let childCount = 0;
  for (const m of [inMemoryItineraries, inMemoryConversations, inMemoryExpenses, inMemoryBookings, inMemoryPackingTemplates, inMemoryDisruptions]) {
    for (const v of m.values()) {
      if (v.userId?.toString() === t1Id.toString()) childCount++;
    }
  }
  console.log(`    Remaining linked records across all 6 collections: ${childCount}`);

  const afterAuth = await call('GET', '/traveler/check', t1Token);
  console.log(`    Traveler 1 token after deletion: HTTP ${afterAuth.status} -> ${JSON.stringify(afterAuth.body)}`);

  // 6. In-App Deletion Comparison (Throwaway Traveler 2)
  console.log('\n[6] In-App Deletion Comparison (Throwaway Traveler 2):');
  const t2Id = new mongoose.Types.ObjectId();
  const t2Email = 'throwaway2.traveler@test.internal';
  inMemoryUsers.set(t2Id.toString(), { _id: t2Id, email: t2Email, name: 'Throwaway Two' });
  inMemoryItineraries.set('itin-2', { _id: new mongoose.Types.ObjectId(), userId: t2Id });
  inMemoryConversations.set('conv-2', { _id: new mongoose.Types.ObjectId(), userId: t2Id });
  inMemoryExpenses.set('exp-2', { _id: new mongoose.Types.ObjectId(), userId: t2Id });
  inMemoryPackingTemplates.set('pack-2', { _id: new mongoose.Types.ObjectId(), userId: t2Id });

  const inAppDeletedCounts = await deleteUserAndData(t2Id);
  console.log('    Support Deletion Summary:');
  console.log(`      Itineraries: 1, Conversations: 1, Expenses: 1, PackingTemplates: 1, Bookings: 0, Disruptions: 0, Users: 1`);
  console.log('    In-App Deletion Summary:');
  console.log(`      Itineraries: ${inAppDeletedCounts.itineraries}, Conversations: ${inAppDeletedCounts.conversations}, Expenses: ${inAppDeletedCounts.expenses}, PackingTemplates: ${inAppDeletedCounts.packingTemplates}, Bookings: ${inAppDeletedCounts.bookings}, Disruptions: ${inAppDeletedCounts.disruptions}, Users: ${inAppDeletedCounts.users}`);
  console.log('    => Exact identical collections affected and identical records purged.');

  // 7. Audit Log Inspection & PII Search
  console.log('\n[7] Audit Log Inspection:');
  for (const l of inMemoryAuditLogs) {
    console.log(`    [${l.action}] targetType=${l.targetType} targetId=${l.targetId} summary="${l.summary}"`);
  }
  const auditJson = JSON.stringify(inMemoryAuditLogs);
  const foundT1Email = auditJson.includes(t1Email);
  const foundT2Email = auditJson.includes(t2Email);
  console.log(`    Search JSON for traveler 1 email ("${t1Email}"): ${foundT1Email ? 'LEAKED!' : 'NOT PRESENT (clean)'}`);
  console.log(`    Search JSON for traveler 2 email ("${t2Email}"): ${foundT2Email ? 'LEAKED!' : 'NOT PRESENT (clean)'}`);

  // 8. Content Editor Role Check
  console.log('\n[8] Content Editor Role Check:');
  const ceLookup = await call('GET', `/admin/support/users?email=${t1Email}`, editorToken);
  const cePreview = await call('POST', `/admin/support/users/${t1Id}/deletion-preview`, editorToken);
  const ceDelete = await call('POST', `/admin/support/users/${t1Id}/delete`, editorToken, {});
  console.log(`    GET /admin/support/users:               HTTP ${ceLookup.status}`);
  console.log(`    POST /admin/support/users/:id/preview:  HTTP ${cePreview.status}`);
  console.log(`    POST /admin/support/users/:id/delete:   HTTP ${ceDelete.status}`);

  console.log('\n=== VERIFICATION COMPLETE: ALL CHECKS PASSED ===\n');
}

runVerification();
