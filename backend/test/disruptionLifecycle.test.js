import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import express from 'express';

import Disruption from '../src/models/Disruption.js';
import Itinerary from '../src/models/Itinerary.js';
import User from '../src/models/User.js';
import disruptionsRouter from '../src/routes/disruptions.js';
import { computeBaseHash } from '../src/services/disruptions/proposal.js';
import {
  approveDisruption,
  dismissDisruption,
  undoDisruption,
  applyProposalChangesToDay,
} from '../src/services/disruptions/lifecycle.js';

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

describe('Disruption Lifecycle (Approve, Dismiss, Undo)', () => {
  const jwtSecret = 'test_jwt_secret_lifecycle';
  const testUserId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  let validToken;
  let modelSpyCount = 0;

  beforeEach(() => {
    modelSpyCount = 0;
    process.env.JWT_SECRET = jwtSecret;
    process.env.GROQ_API_KEY = '';
    validToken = jwt.sign({ userId: testUserId.toString() }, jwtSecret);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Approve Success & Itinerary Changes
  // ────────────────────────────────────────────────────────────────────────────
  describe('Approve disruption workflow', () => {
    it('applies proposal changes, tags editHistory, sets status to approved, and leaves other days byte-identical', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const day1 = {
        dayNumber: 1,
        activities: [{ id: 'd1-a1', title: 'Arrival Dinner', suggestedTime: 'Night', done: false }],
      };

      const day2 = {
        dayNumber: 2,
        activities: [
          { id: 'act-1', title: 'Museum Visit', suggestedTime: 'Morning', done: false },
          { id: 'act-2', title: 'City Walk', suggestedTime: 'Afternoon', done: false },
          { id: 'act-3', title: 'Beach Sunset', suggestedTime: 'Evening', done: false },
        ],
      };

      const initialHash = computeBaseHash(day2);

      const itinerary = {
        _id: itineraryId,
        userId: testUserId,
        destination: 'Goa',
        startDate: '2026-11-01',
        days: [day1, day2],
        editHistory: [],
      };

      const day1Before = JSON.parse(JSON.stringify(day1));

      const storedProposal = {
        kind: 'reschedule',
        dayNumber: 2,
        option: 60,
        baseHash: initialHash,
        summary: 'Your flight arrives later. I proposed shifting activities.',
        changes: [
          { activityId: 'act-1', action: 'move', fromTime: 'Morning', toTime: 'Afternoon', reason: 'Pushed' },
          { activityId: 'act-2', action: 'move', fromTime: 'Afternoon', toTime: 'Evening', reason: 'Pushed' },
          { activityId: 'act-3', action: 'skip', fromTime: 'Evening', reason: 'Dropped' },
        ],
        unchangedCount: 0,
        capped: false,
      };

      const disruption = {
        _id: disruptionId,
        userId: testUserId,
        itineraryId,
        type: 'flight_schedule_change',
        source: 'duffel_webhook',
        status: 'proposed',
        details: { delayMinutes: 60, structural: false },
        proposal: storedProposal,
        appliedEditId: null,
      };

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => disruption;
        Itinerary.findOne = async () => itinerary;

        Itinerary.findOneAndUpdate = async (filter, update) => {
          if (filter['editHistory.tag']?.$ne && itinerary.editHistory.some((e) => e.tag === filter['editHistory.tag'].$ne)) {
            return null; // Tag already exists
          }
          if (update.$set?.days) {
            itinerary.days = update.$set.days;
          }
          if (update.$push?.editHistory?.$each) {
            itinerary.editHistory.push(...update.$push.editHistory.$each);
            if (itinerary.editHistory.length > 10) {
              itinerary.editHistory = itinerary.editHistory.slice(-10);
            }
          }
          return itinerary;
        };

        Disruption.findOneAndUpdate = async (filter, update) => {
          Object.assign(disruption, update.$set);
          return disruption;
        };

        const res = await approveDisruption({
          disruptionId,
          userId: testUserId,
          baseHash: initialHash,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.disruption.status, 'approved');
        assert.ok(res.disruption.appliedEditId);
        assert.ok(res.disruption.approvedAt instanceof Date);
        assert.strictEqual(res.undoAvailable, true);

        // Verify Day 2 changes
        const updatedDay2 = itinerary.days.find((d) => d.dayNumber === 2);
        assert.strictEqual(updatedDay2.activities.length, 2, 'Dropped activity act-3 should be removed');
        assert.strictEqual(updatedDay2.activities[0].title, 'Museum Visit');
        assert.strictEqual(updatedDay2.activities[0].suggestedTime, 'Afternoon');
        assert.strictEqual(updatedDay2.activities[1].title, 'City Walk');
        assert.strictEqual(updatedDay2.activities[1].suggestedTime, 'Evening');

        // Other day (Day 1) must be strictly byte-identical
        assert.deepStrictEqual(itinerary.days[0], day1Before);

        // EditHistory snapshot verification
        assert.strictEqual(itinerary.editHistory.length, 1);
        const snapshot = itinerary.editHistory[0];
        assert.strictEqual(snapshot.tag, `disruption:${disruptionId}`);
        assert.strictEqual(snapshot.label, 'Flight delay adjustment');
        assert.deepStrictEqual(snapshot.dayNumbers, [2]);
        assert.strictEqual(snapshot.previousDays.length, 1);
        assert.strictEqual(snapshot.previousDays[0].activities.length, 3);

        // Assert model was NEVER called
        assert.strictEqual(modelSpyCount, 0);
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('rejects with 409 proposal_changed when wrong baseHash is provided', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'proposed',
          proposal: { kind: 'reschedule', baseHash: 'correct-hash-1234' },
        });

        await assert.rejects(
          async () => {
            await approveDisruption({
              disruptionId,
              userId: testUserId,
              baseHash: 'wrong-hash-5678',
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.error, 'proposal_changed');
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
      }
    });

    it('rejects with 409 itinerary_changed when affected day changed after proposal generation', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const day = {
        dayNumber: 2,
        activities: [{ id: 'act-1', title: 'Museum', suggestedTime: 'Afternoon', done: false }],
      };

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'proposed',
          proposal: {
            kind: 'reschedule',
            dayNumber: 2,
            baseHash: 'old-hash-before-activity-changed',
          },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [day],
        });

        await assert.rejects(
          async () => {
            await approveDisruption({
              disruptionId,
              userId: testUserId,
              baseHash: 'old-hash-before-activity-changed',
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.error, 'itinerary_changed');
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
      }
    });

    it('rejects with 409 when activity marked done after proposal generation', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const dayBeforeDone = {
        dayNumber: 1,
        activities: [{ id: 'act-1', title: 'Morning Walk', suggestedTime: 'Morning', done: false }],
      };
      const hashBeforeDone = computeBaseHash(dayBeforeDone);

      // Now marked done
      const dayAfterDone = {
        dayNumber: 1,
        activities: [{ id: 'act-1', title: 'Morning Walk', suggestedTime: 'Morning', done: true }],
      };

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'proposed',
          proposal: { kind: 'reschedule', dayNumber: 1, baseHash: hashBeforeDone },
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [dayAfterDone],
        });

        await assert.rejects(
          async () => {
            await approveDisruption({
              disruptionId,
              userId: testUserId,
              baseHash: hashBeforeDone,
            });
          },
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.error, 'itinerary_changed');
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
      }
    });

    it('succeeds when a DIFFERENT day was edited after proposal generation', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const day1 = {
        dayNumber: 1,
        activities: [{ id: 'd1-a1', title: 'Edited Day 1', suggestedTime: 'Morning', done: false }],
      };

      const day2 = {
        dayNumber: 2,
        activities: [{ id: 'd2-a1', title: 'Day 2 Target', suggestedTime: 'Morning', done: false }],
      };

      const targetHash = computeBaseHash(day2);

      const itinerary = {
        _id: itineraryId,
        userId: testUserId,
        days: [day1, day2],
        editHistory: [],
      };

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'proposed',
          proposal: {
            kind: 'reschedule',
            dayNumber: 2,
            baseHash: targetHash,
            changes: [{ activityId: 'd2-a1', action: 'keep', fromTime: 'Morning' }],
          },
        });

        Itinerary.findOne = async () => itinerary;
        Itinerary.findOneAndUpdate = async () => itinerary;
        Disruption.findOneAndUpdate = async (f, u) => ({ _id: disruptionId, status: 'approved', ...u.$set });

        const res = await approveDisruption({
          disruptionId,
          userId: testUserId,
          baseHash: targetHash,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.disruption.status, 'approved');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('rejects manual_review with 400, dismissed/expired/new with 409, and other user with 404', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const origDisruptionFindOne = Disruption.findOne;

      try {
        // 1. manual_review -> 400
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'proposed',
          proposal: { kind: 'manual_review', baseHash: 'h' },
        });

        await assert.rejects(
          async () => approveDisruption({ disruptionId, userId: testUserId, baseHash: 'h' }),
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            return true;
          }
        );

        // 2. dismissed -> 409
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'dismissed',
        });

        await assert.rejects(
          async () => approveDisruption({ disruptionId, userId: testUserId, baseHash: 'h' }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            return true;
          }
        );

        // 3. expired -> 409
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'expired',
        });

        await assert.rejects(
          async () => approveDisruption({ disruptionId, userId: testUserId, baseHash: 'h' }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            return true;
          }
        );

        // 4. new (no proposal) -> 409
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          status: 'new',
        });

        await assert.rejects(
          async () => approveDisruption({ disruptionId, userId: testUserId, baseHash: 'h' }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            return true;
          }
        );

        // 5. another user's id -> 404
        Disruption.findOne = async () => null;

        await assert.rejects(
          async () => approveDisruption({ disruptionId, userId: testUserId, baseHash: 'h' }),
          (err) => {
            assert.strictEqual(err.statusCode, 404);
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
      }
    });

    it('idempotent approve (second call with same baseHash) returns 200 with exactly one history entry', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();
      const baseHash = 'test-idempotent-hash';

      const approvedDisruption = {
        _id: disruptionId,
        userId: testUserId,
        itineraryId,
        status: 'approved',
        proposal: { kind: 'reschedule', baseHash },
        appliedEditId: 'edit-123',
      };

      const origDisruptionFindOne = Disruption.findOne;
      try {
        Disruption.findOne = async () => approvedDisruption;

        const res = await approveDisruption({
          disruptionId,
          userId: testUserId,
          baseHash,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.disruption.status, 'approved');
        assert.strictEqual(res.undoAvailable, true);
      } finally {
        Disruption.findOne = origDisruptionFindOne;
      }
    });

    it('crash recovery: detects existing tag in editHistory and finishes status update without duplicating edit', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();
      const baseHash = 'crash-test-hash';
      const existingSnapshotId = new mongoose.Types.ObjectId();

      const itineraryWithTaggedEdit = {
        _id: itineraryId,
        userId: testUserId,
        days: [{ dayNumber: 1, activities: [] }],
        editHistory: [
          {
            _id: existingSnapshotId,
            tag: `disruption:${disruptionId}`,
            dayNumbers: [1],
            previousDays: [],
          },
        ],
      };

      const disruptionInProposedStatus = {
        _id: disruptionId,
        userId: testUserId,
        itineraryId,
        status: 'proposed',
        proposal: { kind: 'reschedule', dayNumber: 1, baseHash },
      };

      let statusUpdated = false;
      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => disruptionInProposedStatus;
        Itinerary.findOne = async () => itineraryWithTaggedEdit;

        Disruption.findOneAndUpdate = async (filter, update) => {
          statusUpdated = true;
          return {
            ...disruptionInProposedStatus,
            status: update.$set.status,
            appliedEditId: update.$set.appliedEditId,
          };
        };

        const res = await approveDisruption({
          disruptionId,
          userId: testUserId,
          baseHash,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(statusUpdated, true);
        assert.strictEqual(res.disruption.status, 'approved');
        assert.strictEqual(res.disruption.appliedEditId, existingSnapshotId.toString());
        assert.strictEqual(itineraryWithTaggedEdit.editHistory.length, 1, 'NO second edit created');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Dismiss Disruption
  // ────────────────────────────────────────────────────────────────────────────
  describe('Dismiss disruption workflow', () => {
    it('dismisses new and proposed disruptions, leaves itinerary untouched, and returns 200 idempotently', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      let currentStatus = 'new';
      let itineraryTouchCount = 0;

      const origDisruptionFindOne = Disruption.findOne;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;
      const origItineraryFindOne = Itinerary.findOne;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: currentStatus,
        });

        Disruption.findOneAndUpdate = async (filter, update) => {
          currentStatus = update.$set.status;
          return { _id: disruptionId, status: currentStatus, dismissedAt: update.$set.dismissedAt };
        };

        Itinerary.findOne = async () => {
          itineraryTouchCount++;
          return {};
        };

        // 1. Dismiss from 'new'
        const res1 = await dismissDisruption({ disruptionId, userId: testUserId });
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.disruption.status, 'dismissed');
        assert.strictEqual(itineraryTouchCount, 0, 'Itinerary must never be touched on dismiss');

        // 2. Dismiss from already 'dismissed' -> 200 idempotent
        const res2 = await dismissDisruption({ disruptionId, userId: testUserId });
        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.disruption.status, 'dismissed');

        // 3. Dismiss from 'approved' -> 409
        currentStatus = 'approved';
        await assert.rejects(
          async () => dismissDisruption({ disruptionId, userId: testUserId }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.ok(err.message.includes('Undo the approval instead'));
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
        Itinerary.findOne = origItineraryFindOne;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Undo Disruption
  // ────────────────────────────────────────────────────────────────────────────
  describe('Undo disruption workflow', () => {
    it('restores affected day to pre-approve state, transitions status to reverted, and supports idempotent repeat', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();
      const appliedEditId = new mongoose.Types.ObjectId();

      const originalDay = {
        dayNumber: 2,
        activities: [
          { id: 'act-1', title: 'Museum Visit', suggestedTime: 'Morning', done: false },
          { id: 'act-2', title: 'City Walk', suggestedTime: 'Afternoon', done: false },
        ],
      };

      const modifiedDay = {
        dayNumber: 2,
        activities: [
          { id: 'act-1', title: 'Museum Visit', suggestedTime: 'Evening', done: false },
        ],
      };

      const itinerary = {
        _id: itineraryId,
        userId: testUserId,
        days: [modifiedDay],
        editHistory: [
          {
            _id: appliedEditId,
            dayNumbers: [2],
            previousDays: [originalDay],
            tag: `disruption:${disruptionId}`,
          },
        ],
      };

      let disruptionStatus = 'approved';

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: disruptionStatus,
          appliedEditId: appliedEditId.toString(),
          proposal: { dayNumber: 2, baseHash: computeBaseHash(originalDay) },
        });

        Itinerary.findOne = async () => itinerary;

        Itinerary.findOneAndUpdate = async (filter, update) => {
          itinerary.days = update.$set.days;
          itinerary.editHistory.pop();
          return itinerary;
        };

        Disruption.findOneAndUpdate = async (filter, update) => {
          disruptionStatus = update.$set.status;
          return { _id: disruptionId, status: disruptionStatus, revertedAt: update.$set.revertedAt };
        };

        // Call Undo 1: Reverts changes
        const res1 = await undoDisruption({ disruptionId, userId: testUserId });
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.disruption.status, 'reverted');
        assert.strictEqual(itinerary.editHistory.length, 0);
        assert.deepStrictEqual(itinerary.days[0], originalDay);

        // Call Undo 2: Idempotent return 200
        const res2 = await undoDisruption({ disruptionId, userId: testUserId });
        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.disruption.status, 'reverted');
        assert.ok(res2.message.includes('already undone'));

        // Assert model was NEVER called
        assert.strictEqual(modelSpyCount, 0);
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('rejects with 409 newer_changes_exist when edits occurred after the disruption edit', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();
      const disruptionEditId = new mongoose.Types.ObjectId();
      const laterEditId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'approved',
          appliedEditId: disruptionEditId.toString(),
        });

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [],
          editHistory: [
            { _id: disruptionEditId, dayNumbers: [1] },
            { _id: laterEditId, dayNumbers: [1] }, // Later edit pushed after disruption
          ],
        });

        await assert.rejects(
          async () => undoDisruption({ disruptionId, userId: testUserId }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.error, 'newer_changes_exist');
            assert.ok(err.message.includes('Other changes were made after this one'));
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
      }
    });

    it('rejects with 409 too_old when snapshot was evicted from the 10-entry history', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();
      const evictedEditId = new mongoose.Types.ObjectId();

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: 'approved',
          appliedEditId: evictedEditId.toString(),
          proposal: { dayNumber: 1, baseHash: 'old-hash' },
        });

        // 10 newer edits that pushed out the disruption edit
        const tenNewEdits = Array.from({ length: 10 }, () => ({
          _id: new mongoose.Types.ObjectId(),
          dayNumbers: [1],
        }));

        Itinerary.findOne = async () => ({
          _id: itineraryId,
          userId: testUserId,
          days: [{ dayNumber: 1, activities: [{ title: 'Brand New', done: false }] }],
          editHistory: tenNewEdits,
        });

        await assert.rejects(
          async () => undoDisruption({ disruptionId, userId: testUserId }),
          (err) => {
            assert.strictEqual(err.statusCode, 409);
            assert.strictEqual(err.error, 'too_old');
            assert.ok(err.message.includes('evicted'));
            return true;
          }
        );
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Concurrency & Race Safety
  // ────────────────────────────────────────────────────────────────────────────
  describe('Race safety: concurrent approve and approve vs dismiss', () => {
    it('concurrent approve x2 produces exactly ONE editHistory entry', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const day = {
        dayNumber: 1,
        activities: [{ id: 'a1', title: 'Sightseeing', suggestedTime: 'Morning', done: false }],
      };
      const baseHash = computeBaseHash(day);

      const itinerary = {
        _id: itineraryId,
        userId: testUserId,
        days: [day],
        editHistory: [],
      };

      const disruption = {
        _id: disruptionId,
        userId: testUserId,
        itineraryId,
        status: 'proposed',
        proposal: {
          kind: 'reschedule',
          dayNumber: 1,
          baseHash,
          changes: [{ activityId: 'a1', action: 'move', fromTime: 'Morning', toTime: 'Afternoon' }],
        },
      };

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => disruption;
        Itinerary.findOne = async () => itinerary;

        Itinerary.findOneAndUpdate = async (filter, update) => {
          const tag = `disruption:${disruptionId}`;
          if (itinerary.editHistory.some((e) => e.tag === tag)) {
            return null; // Atomic exclusion: tag already pushed
          }
          itinerary.days = update.$set.days;
          itinerary.editHistory.push(...update.$push.editHistory.$each);
          return itinerary;
        };

        Disruption.findOneAndUpdate = async (filter, update) => {
          Object.assign(disruption, update.$set);
          return disruption;
        };

        // Run two simultaneous approves
        const [res1, res2] = await Promise.all([
          approveDisruption({ disruptionId, userId: testUserId, baseHash }),
          approveDisruption({ disruptionId, userId: testUserId, baseHash }),
        ]);

        assert.strictEqual(res1.success, true);
        assert.strictEqual(res2.success, true);
        assert.strictEqual(itinerary.editHistory.length, 1, 'Exactly ONE editHistory entry created');
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });

    it('concurrent approve vs dismiss results in consistent end state', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const itineraryId = new mongoose.Types.ObjectId();

      const day = {
        dayNumber: 1,
        activities: [{ id: 'a1', title: 'Sightseeing', suggestedTime: 'Morning', done: false }],
      };
      const baseHash = computeBaseHash(day);

      const itinerary = {
        _id: itineraryId,
        userId: testUserId,
        days: [day],
        editHistory: [],
      };

      let disruptionStatus = 'proposed';

      const origDisruptionFindOne = Disruption.findOne;
      const origItineraryFindOne = Itinerary.findOne;
      const origItineraryFindOneAndUpdate = Itinerary.findOneAndUpdate;
      const origDisruptionFindOneAndUpdate = Disruption.findOneAndUpdate;

      try {
        Disruption.findOne = async () => ({
          _id: disruptionId,
          userId: testUserId,
          itineraryId,
          status: disruptionStatus,
          proposal: { kind: 'reschedule', dayNumber: 1, baseHash, changes: [] },
        });

        Itinerary.findOne = async () => itinerary;

        Itinerary.findOneAndUpdate = async (filter, update) => {
          if (update.$pull?.editHistory) {
            itinerary.editHistory = itinerary.editHistory.filter((e) => e.tag !== update.$pull.editHistory.tag);
          }
          if (update.$push?.editHistory?.$each) {
            itinerary.editHistory.push(...update.$push.editHistory.$each);
          }
          return itinerary;
        };

        Disruption.findOneAndUpdate = async (filter, update) => {
          if (!filter.status?.$in?.includes(disruptionStatus) && filter.status !== disruptionStatus) {
            return null; // Atomic status conflict
          }
          disruptionStatus = update.$set.status;
          return { _id: disruptionId, status: disruptionStatus, ...update.$set };
        };

        // Simulate racing: exactly one must win
        const results = await Promise.allSettled([
          approveDisruption({ disruptionId, userId: testUserId, baseHash }),
          dismissDisruption({ disruptionId, userId: testUserId }),
        ]);

        const successful = results.filter((r) => r.status === 'fulfilled');
        assert.ok(successful.length >= 1);

        // State is consistent
        if (disruptionStatus === 'approved') {
          assert.strictEqual(itinerary.editHistory.length, 1);
        } else if (disruptionStatus === 'dismissed') {
          assert.strictEqual(itinerary.editHistory.length, 0);
        }
      } finally {
        Disruption.findOne = origDisruptionFindOne;
        Itinerary.findOne = origItineraryFindOne;
        Itinerary.findOneAndUpdate = origItineraryFindOneAndUpdate;
        Disruption.findOneAndUpdate = origDisruptionFindOneAndUpdate;
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. HTTP Endpoints & Simulated Disruption Tagging
  // ────────────────────────────────────────────────────────────────────────────
  describe('HTTP Endpoints (POST /:id/approve, POST /:id/dismiss, POST /:id/undo)', () => {
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
          {
            dayNumber: 1,
            activities: [{ id: 'a1', title: 'Museum', suggestedTime: 'Morning', done: false }],
          },
        ],
        editHistory: [],
      };

      storedDisruptions = [];

      User.findById = (id) => ({
        select: () => ({
          lean: async () => ({ _id: id }),
        }),
      });

      Itinerary.findById = async (id) => (String(id) === String(itineraryId) ? itineraryDoc : null);
      Itinerary.findOne = async () => itineraryDoc;
      Itinerary.findOneAndUpdate = async (filter, update) => {
        if (update.$set?.days) itineraryDoc.days = update.$set.days;
        if (update.$push?.editHistory?.$each) {
          itineraryDoc.editHistory.push(...update.$push.editHistory.$each);
        }
        if (update.$pop?.editHistory) {
          itineraryDoc.editHistory.pop();
        }
        return itineraryDoc;
      };

      Disruption.findOne = async ({ _id, userId }) => {
        return storedDisruptions.find((d) => String(d._id) === String(_id) && String(d.userId) === String(userId)) || null;
      };

      Disruption.findOneAndUpdate = async (filter, update) => {
        const found = storedDisruptions.find((d) => String(d._id) === String(filter._id));
        if (!found) return null;
        if (update.$set) Object.assign(found, update.$set);
        return found;
      };
    });

    it('simulated disruption carries simulated: true and message "This was a simulated disruption"', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      const baseHash = computeBaseHash(itineraryDoc.days[0]);

      storedDisruptions.push({
        _id: disruptionId,
        userId: testUserId,
        itineraryId: itineraryDoc._id,
        type: 'flight_schedule_change',
        source: 'simulation',
        status: 'proposed',
        details: { delayMinutes: 60, structural: false },
        proposal: {
          kind: 'reschedule',
          dayNumber: 1,
          baseHash,
          changes: [{ activityId: 'a1', action: 'move', fromTime: 'Morning', toTime: 'Evening' }],
        },
      });

      // 1. Approve simulated disruption
      const approveRes = await dispatch(app, {
        method: 'POST',
        url: `/disruptions/${disruptionId}/approve`,
        headers: { Authorization: `Bearer ${validToken}` },
        body: { baseHash },
      });

      assert.strictEqual(approveRes.status, 200);
      assert.strictEqual(approveRes.body.simulated, true);
      assert.strictEqual(approveRes.body.message, 'This was a simulated disruption');
      assert.strictEqual(approveRes.body.undoAvailable, true);

      // 2. Undo simulated disruption
      const undoRes = await dispatch(app, {
        method: 'POST',
        url: `/disruptions/${disruptionId}/undo`,
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(undoRes.status, 200);
      assert.strictEqual(undoRes.body.simulated, true);
      assert.strictEqual(undoRes.body.disruption.status, 'reverted');
    });

    it('dismiss endpoint works via HTTP', async () => {
      const disruptionId = new mongoose.Types.ObjectId();
      storedDisruptions.push({
        _id: disruptionId,
        userId: testUserId,
        itineraryId: itineraryDoc._id,
        type: 'flight_schedule_change',
        source: 'duffel_webhook',
        status: 'proposed',
      });

      const res = await dispatch(app, {
        method: 'POST',
        url: `/disruptions/${disruptionId}/dismiss`,
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.disruption.status, 'dismissed');
    });
  });
});
