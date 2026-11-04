import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import express from 'express';

import Disruption from '../src/models/Disruption.js';
import Itinerary from '../src/models/Itinerary.js';
import User from '../src/models/User.js';
import disruptionsRouter from '../src/routes/disruptions.js';
import {
  generateProposal,
  validateProposalItems,
  buildDeterministicSummary,
  formatDuration,
  computeBaseHash,
  checkAndExpireDisruption,
} from '../src/services/disruptions/proposal.js';
import {
  mapDelayToOption,
  findAffectedDay,
} from '../src/services/disruptions/analysis.js';

// In-memory test dispatcher for Express apps
function dispatch(app, { method, url, headers = {}, body = '' }) {
  return new Promise((resolve) => {
    const rawBuffer = Buffer.isBuffer(body)
      ? body
      : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');

    const req = Readable.from(rawBuffer.length > 0 ? [rawBuffer] : []);
    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(rawBuffer.length),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };

    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';

    let statusCode = 200;
    const resHeaders = {};
    let resBody = '';

    const res = new EventEmitter();
    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(resHeaders);
    res.hasHeader = (k) => Boolean(resHeaders[k.toLowerCase()]);
    res.removeHeader = (k) => {
      delete resHeaders[k.toLowerCase()];
    };
    res.status = (code) => {
      statusCode = code;
      return res;
    };
    res.json = (data) => {
      resHeaders['content-type'] = 'application/json';
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk.toString();
      try {
        resolve({ status: statusCode, headers: resHeaders, body: JSON.parse(resBody) });
      } catch {
        resolve({ status: statusCode, headers: resHeaders, body: resBody });
      }
    };

    app.handle(req, res);
  });
}

describe('Disruption Proposal Engine & Read Routes', () => {
  const jwtSecret = 'test_jwt_secret_proposal';
  const testUserId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  let validToken;

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.GROQ_API_KEY = '';
    validToken = jwt.sign({ userId: testUserId.toString() }, jwtSecret);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Boundary & Option Mapping Tests
  // ────────────────────────────────────────────────────────────────────────────
  describe('Delay mapping boundaries and option extraction', () => {
    it('verifies boundary values: 44 -> 30, 45 -> 60, 149 -> 120, 150 -> 180, <15 -> null', () => {
      assert.strictEqual(mapDelayToOption(10), null);
      assert.strictEqual(mapDelayToOption(14), null);

      assert.deepStrictEqual(mapDelayToOption(15), { option: 30, capped: false });
      assert.deepStrictEqual(mapDelayToOption(44), { option: 30, capped: false });

      assert.deepStrictEqual(mapDelayToOption(45), { option: 60, capped: false });
      assert.deepStrictEqual(mapDelayToOption(89), { option: 60, capped: false });

      assert.deepStrictEqual(mapDelayToOption(90), { option: 120, capped: false });
      assert.deepStrictEqual(mapDelayToOption(149), { option: 120, capped: false });

      assert.deepStrictEqual(mapDelayToOption(150), { option: 180, capped: false });
      assert.deepStrictEqual(mapDelayToOption(180), { option: 180, capped: false });
      assert.deepStrictEqual(mapDelayToOption(200), { option: 180, capped: true });
    });

    it('asserts option comes from stored mapDelayToOption and engine is called with that option and dayNumber', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      let engineCalledWith = null;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'new',
          details: { delayMinutes: 95, structural: false, newArrival: '2026-11-02T15:35:00' },
          proposal: { dayNumber: 2, option: 120, capped: false },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          destination: 'Goa',
          startDate: '2026-11-01',
          days: [
            { dayNumber: 1, activities: [] },
            {
              dayNumber: 2,
              activities: [
                { id: 'act-1', title: 'Museum', suggestedTime: 'Morning', done: false },
                { id: 'act-2', title: 'Beach', suggestedTime: 'Afternoon', done: false },
              ],
            },
          ],
        });

        Disruption.findOneAndUpdate = async (filter, update) => ({
          _id: disruptionId,
          ...update.$set,
        });

        const mockEngine = async (params) => {
          engineCalledWith = params;
          return {
            items: [
              { index: 0, action: 'keep', reason: 'Kept' },
              { index: 1, action: 'move', newBucket: 'Evening', reason: 'Moved to evening' },
            ],
          };
        };

        const res = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.strictEqual(res.success, true);
        assert.ok(engineCalledWith);
        assert.strictEqual(engineCalledWith.dayNumber, 2);
        assert.strictEqual(engineCalledWith.delayMinutes, 120);
        assert.strictEqual(engineCalledWith.destination, 'Goa');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Summary Formatting & Determinism
  // ────────────────────────────────────────────────────────────────────────────
  describe('Deterministic summary generation', () => {
    it('produces exact text "2 h 5 min" for 125 minutes', () => {
      assert.strictEqual(formatDuration(125), '2 h 5 min');
      assert.strictEqual(formatDuration(60), '1 h');
      assert.strictEqual(formatDuration(30), '30 min');
      assert.strictEqual(formatDuration(0), '0 min');

      const summary = buildDeterministicSummary({
        delayMinutes: 125,
        oldArrival: '2026-11-02T14:00:00',
        newArrival: '2026-11-02T16:05:00',
        dayNumber: 2,
        changesCount: 3,
        capped: false,
      });

      assert.ok(summary.includes('2 h 5 min'));
      assert.ok(summary.includes('(14:00 -> 16:05)'));
      assert.ok(summary.includes('shifting 3 activities on Day 2'));
      assert.strictEqual(summary.includes('capped'), false);
    });

    it('mentions capping for a 200-minute delay', () => {
      const summary = buildDeterministicSummary({
        delayMinutes: 200,
        oldArrival: '2026-11-02T14:00:00',
        newArrival: '2026-11-02T17:20:00',
        dayNumber: 2,
        changesCount: 2,
        capped: true,
      });

      assert.ok(summary.includes('3 h 20 min'));
      assert.ok(summary.includes('capped at 180 minutes'));
      assert.ok(summary.toLowerCase().includes('capped'));
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Proposal Generation, Status Transition & Itinerary Immutability
  // ────────────────────────────────────────────────────────────────────────────
  describe('Proposal generation and Itinerary immutability', () => {
    it('stores valid proposal, transitions status to proposed, and leaves Itinerary 100% byte-identical', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const originalItineraryDoc = {
        _id: itineraryId,
        userId: testUserId,
        destination: 'Jaipur',
        startDate: '2026-11-01',
        editHistory: [{ editId: 'edit-1', timestamp: new Date('2026-10-01') }],
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'act-1', title: 'Hawa Mahal', suggestedTime: 'Morning', done: false },
              { id: 'act-2', title: 'City Palace', suggestedTime: 'Afternoon', done: false },
            ],
          },
        ],
      };

      // Deep clone before proposal generation to assert byte-identity
      const clonedBefore = JSON.parse(JSON.stringify(originalItineraryDoc));

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;
      const origItinerarySave = Itinerary.prototype?.save;

      let savedDisruptionProposal = null;
      let savedDisruptionStatus = null;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'new',
          details: { delayMinutes: 60, structural: false, newArrival: '2026-11-01T11:00:00' },
          proposal: { dayNumber: 1, option: 60, capped: false },
        });

        Itinerary.findOne = async () => originalItineraryDoc;

        Disruption.findOneAndUpdate = async (filter, update) => {
          savedDisruptionProposal = update.$set.proposal;
          savedDisruptionStatus = update.$set.status;
          return {
            _id: disruptionId,
            status: savedDisruptionStatus,
            proposal: savedDisruptionProposal,
          };
        };

        const mockEngine = async () => ({
          items: [
            { index: 0, action: 'keep', reason: 'Kept in place' },
            { index: 1, action: 'move', newBucket: 'Evening', reason: 'Pushed later' },
          ],
        });

        const res = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(savedDisruptionStatus, 'proposed');
        assert.strictEqual(savedDisruptionProposal.kind, 'reschedule');
        assert.strictEqual(savedDisruptionProposal.option, 60);
        assert.strictEqual(savedDisruptionProposal.dayNumber, 1);
        assert.ok(savedDisruptionProposal.baseHash);
        assert.strictEqual(savedDisruptionProposal.changes.length, 2);
        assert.strictEqual(savedDisruptionProposal.changes[0].activityId, 'act-1');
        assert.strictEqual(savedDisruptionProposal.changes[0].action, 'keep');
        assert.strictEqual(savedDisruptionProposal.changes[1].activityId, 'act-2');
        assert.strictEqual(savedDisruptionProposal.changes[1].action, 'move');
        assert.strictEqual(savedDisruptionProposal.changes[1].toTime, 'Evening');

        // Verify Itinerary document remains strictly byte-identical (deep equal)
        const clonedAfter = JSON.parse(JSON.stringify(originalItineraryDoc));
        assert.deepStrictEqual(clonedBefore, clonedAfter);
        assert.strictEqual(clonedBefore.editHistory.length, clonedAfter.editHistory.length);
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('asserts model input contains NO booking, passenger, or payment fields', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      let engineInputArg = null;

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          bookingId: new mongoose.Types.ObjectId(), // linked booking on disruption
          status: 'new',
          details: { delayMinutes: 60, structural: false },
          proposal: { dayNumber: 1, option: 60 },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          destination: 'Kerala',
          days: [
            {
              dayNumber: 1,
              activities: [{ id: 'a1', title: 'Tea plantation', done: false }],
            },
          ],
        });

        Disruption.findOneAndUpdate = async () => ({ _id: disruptionId, status: 'proposed' });

        const mockEngine = async (params) => {
          engineInputArg = params;
          return {
            items: [{ index: 0, action: 'keep', reason: 'Good' }],
          };
        };

        await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.ok(engineInputArg);
        const serialized = JSON.stringify(engineInputArg).toLowerCase();

        // Must NOT contain sensitive booking or passenger fields
        assert.strictEqual(serialized.includes('bookingreference'), false);
        assert.strictEqual(serialized.includes('passenger'), false);
        assert.strictEqual(serialized.includes('dateofbirth'), false);
        assert.strictEqual(serialized.includes('paymentmethod'), false);
        assert.strictEqual(serialized.includes('creditcard'), false);
        assert.strictEqual(serialized.includes('cvv'), false);
        assert.strictEqual(serialized.includes('orderid'), false);
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Output Validation, Retry & 502 Handling
  // ────────────────────────────────────────────────────────────────────────────
  describe('Output validation and retry behavior', () => {
    const testDay = {
      dayNumber: 1,
      activities: [
        { id: 'act-1', title: 'Morning Walk', suggestedTime: 'Morning', done: false },
        { id: 'act-2', title: 'Lunch', suggestedTime: 'Afternoon', done: false },
        { id: 'act-3', title: 'Done Activity', suggestedTime: 'Evening', done: true },
      ],
    };

    it('rejects unknown activity id or index', () => {
      assert.strictEqual(
        validateProposalItems([{ activityId: 'non-existent', action: 'keep' }], testDay),
        false
      );
      assert.strictEqual(
        validateProposalItems([{ index: 999, action: 'keep' }], testDay),
        false
      );
      assert.strictEqual(
        validateProposalItems([{ index: -1, action: 'keep' }], testDay),
        false
      );
    });

    it('rejects attempts to touch done activities', () => {
      // index 2 is done: true
      assert.strictEqual(
        validateProposalItems([{ index: 2, action: 'move', newBucket: 'Night' }], testDay),
        false
      );
      assert.strictEqual(
        validateProposalItems([{ activityId: 'act-3', action: 'drop' }], testDay),
        false
      );
    });

    it('rejects invalid or backwards time bucket moves', () => {
      // Invalid bucket name
      assert.strictEqual(
        validateProposalItems([{ index: 0, action: 'move', newBucket: 'Midnight' }], testDay),
        false
      );
      // Backwards move (Afternoon -> Morning)
      assert.strictEqual(
        validateProposalItems([{ index: 1, action: 'move', newBucket: 'Morning' }], testDay),
        false
      );
      // Same bucket move (Morning -> Morning)
      assert.strictEqual(
        validateProposalItems([{ index: 0, action: 'move', newBucket: 'Morning' }], testDay),
        false
      );
    });

    it('rejects conflicting actions on the same activity', () => {
      assert.strictEqual(
        validateProposalItems(
          [
            { index: 0, action: 'move', newBucket: 'Evening' },
            { index: 0, action: 'drop' },
          ],
          testDay
        ),
        false
      );
    });

    it('retries once upon validation failure and succeeds if second attempt is valid', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      let callCount = 0;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'new',
          details: { delayMinutes: 60, structural: false },
          proposal: { dayNumber: 1, option: 60 },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [testDay],
        });

        Disruption.findOneAndUpdate = async (filter, update) => ({
          _id: disruptionId,
          status: 'proposed',
          proposal: update.$set.proposal,
        });

        const flakyEngine = async () => {
          callCount++;
          if (callCount === 1) {
            // First call returns an invalid index
            return { items: [{ index: 999, action: 'keep' }] };
          }
          // Second call returns valid items
          return { items: [{ index: 0, action: 'keep', reason: 'Valid' }] };
        };

        const res = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: flakyEngine,
        });

        assert.strictEqual(callCount, 2, 'Engine should be called exactly twice (1 retry)');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.proposal.changes[0].action, 'keep');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('fails with 502 when both attempts fail validation; stores nothing, status remains new', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      let updateAttempted = false;
      let callCount = 0;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'new',
          details: { delayMinutes: 60, structural: false },
          proposal: { dayNumber: 1, option: 60 },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [testDay],
        });

        Disruption.findOneAndUpdate = async () => {
          updateAttempted = true;
        };

        const alwaysFailingEngine = async () => {
          callCount++;
          return { items: [{ index: 999, action: 'invalid' }] };
        };

        await assert.rejects(
          async () => {
            await generateProposal({
              disruptionId,
              userId: testUserId,
              engineFn: alwaysFailingEngine,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 502);
            assert.strictEqual(err.message, "couldn't generate a proposal right now");
            return true;
          }
        );

        assert.strictEqual(callCount, 2, 'Engine should have been retried once');
        assert.strictEqual(updateAttempted, false, 'No database update should be attempted on failure');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Caching & Idempotency by baseHash
  // ────────────────────────────────────────────────────────────────────────────
  describe('Idempotency and caching via baseHash', () => {
    it('returns cached proposal without calling engine when day is unchanged; regenerates when day changes or regenerate=true', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      let currentDayActivities = [
        { id: 'act-1', title: 'Museum', suggestedTime: 'Morning', done: false },
      ];

      const initialHash = computeBaseHash({ activities: currentDayActivities });

      let storedProposal = {
        kind: 'reschedule',
        dayNumber: 1,
        option: 60,
        baseHash: initialHash,
        generatedAt: new Date('2026-10-31T10:00:00Z'),
        summary: 'Cached summary',
        changes: [{ activityId: 'act-1', action: 'keep', fromTime: 'Morning', reason: 'Kept' }],
        unchangedCount: 1,
        capped: false,
      };

      let disruptionStatus = 'proposed';
      let engineCalls = 0;

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: disruptionStatus,
          details: { delayMinutes: 60, structural: false },
          proposal: storedProposal,
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [{ dayNumber: 1, activities: currentDayActivities }],
        });

        Disruption.findOneAndUpdate = async (filter, update) => {
          storedProposal = update.$set.proposal;
          disruptionStatus = update.$set.status;
          return { _id: disruptionId, status: disruptionStatus, proposal: storedProposal };
        };

        const mockEngine = async () => {
          engineCalls++;
          return { items: [{ index: 0, action: 'keep', reason: 'Freshly generated' }] };
        };

        // Call 1: Unchanged day -> returns cached proposal with ZERO engine calls
        const res1 = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.strictEqual(res1.cached, true);
        assert.strictEqual(engineCalls, 0, 'Must NOT call engine when baseHash matches');
        assert.strictEqual(res1.proposal.summary, 'Cached summary');

        // Call 2: Edit that day (change activity suggestedTime) -> baseHash changes -> engine is called
        currentDayActivities = [
          { id: 'act-1', title: 'Museum', suggestedTime: 'Afternoon', done: false },
        ];

        const res2 = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.strictEqual(res2.cached, false);
        assert.strictEqual(engineCalls, 1, 'Engine must be called when day has changed');
        assert.notStrictEqual(res2.proposal.baseHash, initialHash);

        // Call 3: Forced regeneration via regenerate=true -> calls engine even if unchanged
        const res3 = await generateProposal({
          disruptionId,
          userId: testUserId,
          regenerate: true,
          engineFn: mockEngine,
        });

        assert.strictEqual(res3.cached, false);
        assert.strictEqual(engineCalls, 2, 'Engine must be called when regenerate=true');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. Structural Changes -> manual_review
  // ────────────────────────────────────────────────────────────────────────────
  describe('Structural changes', () => {
    it('sets kind manual_review without calling engine when structural is true', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      let engineCalled = false;
      let storedProposal = null;
      let storedStatus = null;

      const origDisruptionFindOne = Disruption.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'new',
          details: { structural: true, delayMinutes: 120 },
          proposal: { actionable: false, reason: 'route changed; needs manual review' },
        });

        Disruption.findOneAndUpdate = async (filter, update) => {
          storedProposal = update.$set.proposal;
          storedStatus = update.$set.status;
          return { _id: disruptionId, status: storedStatus, proposal: storedProposal };
        };

        const mockEngine = async () => {
          engineCalled = true;
          return { items: [] };
        };

        const res = await generateProposal({
          disruptionId,
          userId: testUserId,
          engineFn: mockEngine,
        });

        assert.strictEqual(engineCalled, false, 'Engine must NEVER be called for structural disruptions');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.proposal.kind, 'manual_review');
        assert.strictEqual(storedStatus, 'proposed');
        assert.ok(res.proposal.summary.includes('manual'));
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. Ownership & Status Validation (404, 409, 400)
  // ────────────────────────────────────────────────────────────────────────────
  describe('Ownership and status constraints', () => {
    it('returns generic 404 for another user disruption (indistinguishable from nonexistent)', async () => {
      const disruptionId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      try {
        // Disruption.findOne with { _id, userId: otherUserId } returns null
        Disruption.findOne = async ({ _id, userId }) => {
          if (String(userId) === String(testUserId)) {
            return null; // not found for this user
          }
          return { _id: disruptionId, userId: otherUserId };
        };

        await assert.rejects(
          async () => {
            await generateProposal({
              disruptionId,
              userId: testUserId,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 404);
            assert.strictEqual(err.message, 'Disruption not found');
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
      }
    });

    it('returns 409 when disruption status is approved or dismissed', async () => {
      const disruptionId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'approved',
        });

        await assert.rejects(
          async () => {
            await generateProposal({
              disruptionId,
              userId: testUserId,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.ok(err.message.includes('approved'));
            return true;
          }
        );

        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'dismissed',
        });

        await assert.rejects(
          async () => {
            await generateProposal({
              disruptionId,
              userId: testUserId,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.ok(err.message.includes('dismissed'));
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
      }
    });

    it('returns 400 for bad id format', async () => {
      await assert.rejects(
        async () => {
          await generateProposal({
            disruptionId: 'invalid-id-format',
            userId: testUserId,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Invalid disruption ID');
          return true;
        }
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 8. Lazy Expiry
  // ────────────────────────────────────────────────────────────────────────────
  describe('Lazy expiry check', () => {
    it('expires disruption for a day 3 days in the past on read; approved status stays approved', async () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const origFindOneAndUpdate = Disruption.findOneAndUpdate;

      let updateAttempted = false;

      try {
        Disruption.findOneAndUpdate = async (filter, update) => {
          updateAttempted = true;
          return { status: update.$set.status };
        };

        // 1. New disruption 3 days in past -> expires
        const pastDisruption = {
          _id: new mongoose.Types.ObjectId(),
          status: 'new',
          details: { newArrival: pastDate },
        };

        const res1 = await checkAndExpireDisruption(pastDisruption);
        assert.strictEqual(updateAttempted, true);
        assert.strictEqual(res1.status, 'expired');

        // 2. Approved disruption 3 days in past -> stays approved
        updateAttempted = false;
        const approvedDisruption = {
          _id: new mongoose.Types.ObjectId(),
          status: 'approved',
          details: { newArrival: pastDate },
        };

        const res2 = await checkAndExpireDisruption(approvedDisruption);
        assert.strictEqual(updateAttempted, false, 'Must never expire approved disruption');
        assert.strictEqual(res2.status, 'approved');
      } finally {
        Disruption.findOneAndUpdate = origFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 9. HTTP Routes & Integration
  // ────────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoints (GET /disruptions, GET /:id, POST /:id/proposal, POST /simulate)', () => {
    let app;
    let storedDisruptions = [];
    let itineraryDoc;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/disruptions', disruptionsRouter);

      const itineraryId = new mongoose.Types.ObjectId();
      itineraryDoc = {
        _id: itineraryId,
        userId: testUserId,
        destination: 'Mumbai',
        startDate: '2026-11-01',
        days: [
          { dayNumber: 1, activities: [] },
          {
            dayNumber: 2,
            activities: [
              { id: 'act-1', title: 'Gateway of India', suggestedTime: 'Morning', done: false },
              { id: 'act-2', title: 'Marine Drive', suggestedTime: 'Evening', done: false },
            ],
          },
        ],
      };

      storedDisruptions = [];

      User.findById = (id) => ({
        select: () => ({
          lean: async () => (String(id) === String(testUserId) ? { _id: testUserId } : null),
        }),
      });

      Itinerary.findById = async (id) => (String(id) === String(itineraryId) ? itineraryDoc : null);
      Itinerary.findOne = async ({ _id, userId }) =>
        String(_id) === String(itineraryId) && String(userId) === String(testUserId) ? itineraryDoc : null;

      Disruption.create = async (doc) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          detectedAt: new Date(),
          proposal: null,
          status: 'new',
          ...doc,
          toObject() {
            return { ...this };
          },
        };
        storedDisruptions.push(item);
        return item;
      };

      Disruption.find = ({ userId }) => ({
        sort: () => ({
          limit: async () =>
            storedDisruptions.filter((d) => String(d.userId) === String(userId)),
        }),
      });

      Disruption.findOne = async ({ _id, userId }) => {
        const found = storedDisruptions.find(
          (d) => String(d._id) === String(_id) && String(d.userId) === String(userId)
        );
        return found || null;
      };

      Disruption.findOneAndUpdate = async (filter, update) => {
        const found = storedDisruptions.find(
          (d) => String(d._id) === String(filter._id) && String(d.userId) === String(filter.userId)
        );
        if (!found) return null;
        if (filter.status?.$in && !filter.status.$in.includes(found.status)) return null;

        if (update.$set) {
          Object.assign(found, update.$set);
        }
        return found;
      };
    });

    it('end-to-end simulation -> GET list shows simulated: true -> POST proposal generates deterministic changes', async () => {
      process.env.ENABLE_DISRUPTION_SIMULATOR = 'true';

      // 1. Simulate a 120-minute delay on Day 2
      const simRes = await dispatch(app, {
        method: 'POST',
        url: '/disruptions/simulate',
        headers: { Authorization: `Bearer ${validToken}` },
        body: {
          itineraryId: itineraryDoc._id.toString(),
          dayNumber: 2,
          delayMinutes: 120,
        },
      });

      assert.strictEqual(simRes.status, 200);
      assert.strictEqual(simRes.body.simulated, true);
      assert.strictEqual(simRes.body.success, true);
      const disruptionId = simRes.body.disruption._id.toString();

      // 2. GET /disruptions list
      const listRes = await dispatch(app, {
        method: 'GET',
        url: '/disruptions',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(listRes.status, 200);
      assert.ok(Array.isArray(listRes.body));
      assert.strictEqual(listRes.body.length, 1);
      assert.strictEqual(listRes.body[0].simulated, true);
      assert.strictEqual(listRes.body[0].status, 'new');
      assert.strictEqual(listRes.body[0].hasProposal, false);
      assert.strictEqual(listRes.body[0].dayNumber, 2);

      // 3. POST /disruptions/:id/proposal
      const propRes1 = await dispatch(app, {
        method: 'POST',
        url: `/disruptions/${disruptionId}/proposal`,
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(propRes1.status, 200);
      assert.strictEqual(propRes1.body.success, true);
      assert.strictEqual(propRes1.body.cached, false);
      assert.ok(propRes1.body.summary.includes('2 h'));
      assert.ok(propRes1.body.changes.length > 0);
      // All changed activity ids must come from Day 2 activities
      for (const ch of propRes1.body.changes) {
        assert.ok(['act-1', 'act-2'].includes(ch.activityId));
      }

      // 4. Re-call POST proposal -> cached: true
      const propRes2 = await dispatch(app, {
        method: 'POST',
        url: `/disruptions/${disruptionId}/proposal`,
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(propRes2.status, 200);
      assert.strictEqual(propRes2.body.cached, true);
      assert.strictEqual(propRes2.body.summary, propRes1.body.summary);

      // 5. GET /disruptions/:id returns full record including proposal
      const getRes = await dispatch(app, {
        method: 'GET',
        url: `/disruptions/${disruptionId}`,
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.status, 'proposed');
      assert.strictEqual(getRes.body.proposal.kind, 'reschedule');
      assert.strictEqual(getRes.body.proposal.option, 120);
    });

    it('enforces 10 requests/hour rate limit on proposal generation (11th request -> 429)', async () => {
      const rateLimitUserId = new mongoose.Types.ObjectId();
      const rateLimitToken = jwt.sign({ userId: rateLimitUserId.toString() }, jwtSecret);

      const disruptionId = new mongoose.Types.ObjectId();
      storedDisruptions.push({
        _id: disruptionId,
        userId: rateLimitUserId,
        itineraryId: itineraryDoc._id,
        status: 'new',
        details: { delayMinutes: 60, structural: false },
        proposal: { dayNumber: 2, option: 60 },
        toObject() {
          return { ...this };
        },
      });

      const origUserFindById = User.findById;
      const origItineraryFindOne = Itinerary.findOne;
      User.findById = (id) => ({
        select: () => ({
          lean: async () => ({ _id: id }),
        }),
      });
      Itinerary.findOne = async () => itineraryDoc;

      try {
        // Issue 10 requests for the user (all should pass)
        for (let i = 0; i < 10; i++) {
          const res = await dispatch(app, {
            method: 'POST',
            url: `/disruptions/${disruptionId}/proposal`,
            headers: { Authorization: `Bearer ${rateLimitToken}` },
          });
          assert.strictEqual(res.status, 200);
        }

        // The 11th request for the same user must be rate limited with status 429
        const rateLimitedRes = await dispatch(app, {
          method: 'POST',
          url: `/disruptions/${disruptionId}/proposal`,
          headers: { Authorization: `Bearer ${rateLimitToken}` },
        });

        assert.strictEqual(rateLimitedRes.status, 429);
        assert.ok(rateLimitedRes.body.error.includes('Too many proposal requests'));
      } finally {
        User.findById = origUserFindById;
        Itinerary.findOne = origItineraryFindOne;
      }
    });
  });
});
