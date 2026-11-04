import mongoose from 'mongoose';
import Disruption from '../../models/Disruption.js';
import Itinerary from '../../models/Itinerary.js';
import { applyReschedule } from '../rescheduleService.js';
import { applySnapshot } from '../undoService.js';
import { computeBaseHash } from './proposal.js';

/**
 * Maps proposal changes to normalized items and applies them to the day
 * using the deterministic applyReschedule engine (NO model calls).
 *
 * @param {Object} day
 * @param {Array<Object>} changes
 * @returns {Object} Updated day object
 */
export function applyProposalChangesToDay(day, changes = []) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];

  const items = (changes || []).map((change) => {
    let actIndex = -1;
    if (change.activityId != null) {
      actIndex = activities.findIndex((a, idx) => {
        const id = a?.id || a?._id?.toString() || a?.placeId || a?.activityId || String(idx);
        return String(id) === String(change.activityId);
      });
    }

    return {
      index: actIndex,
      title: actIndex >= 0 ? (activities[actIndex]?.title || activities[actIndex]?.name || '') : '',
      action: change.action === 'skip' ? 'drop' : change.action,
      newBucket: change.toTime || null,
      reason: change.reason || '',
    };
  });

  return applyReschedule(day, items);
}

/**
 * Approves a stored disruption proposal.
 * Applies the stored proposal changes to the user's saved itinerary with snapshot-based undo.
 * Enforces race safety, crash safety, and strict staleness checks. Never calls LLM.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.disruptionId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.baseHash
 * @param {boolean} [params.simulateCrash=false] - For crash safety testing
 * @returns {Promise<{ success: boolean, disruption: Object, undoAvailable: boolean, simulated: boolean, message?: string }>}
 */
export async function approveDisruption({
  disruptionId,
  userId,
  baseHash,
  simulateCrash = false,
}) {
  if (!mongoose.Types.ObjectId.isValid(disruptionId)) {
    const err = new Error('Invalid disruption ID');
    err.statusCode = 400;
    throw err;
  }

  if (!baseHash || typeof baseHash !== 'string' || !baseHash.trim()) {
    const err = new Error('baseHash is required');
    err.statusCode = 400;
    throw err;
  }

  const trimmedHash = baseHash.trim();

  // 1. Load disruption by id + userId (ownership-checked, generic 404)
  const disruption = await Disruption.findOne({ _id: disruptionId, userId });
  if (!disruption) {
    const err = new Error('Disruption not found');
    err.statusCode = 404;
    throw err;
  }

  const isSimulated = disruption.source === 'simulation';
  const simulatedMessage = isSimulated ? 'This was a simulated disruption' : undefined;

  // 2. Status & proposal checks
  if (disruption.status === 'approved') {
    if (disruption.proposal?.baseHash === trimmedHash) {
      // Idempotent approve: return current record
      console.log(`[Disruptions] disruptionId=${disruptionId} action=approve outcome=idempotent`);
      return {
        success: true,
        disruption,
        undoAvailable: true,
        simulated: isSimulated,
        message: simulatedMessage,
      };
    }
    const err = new Error('Disruption is already approved with a different proposal');
    err.statusCode = 409;
    throw err;
  }

  if (disruption.proposal?.kind === 'manual_review') {
    const err = new Error('Manual review disruptions cannot be automatically approved');
    err.statusCode = 400;
    throw err;
  }

  if (disruption.status !== 'proposed') {
    const err = new Error(`Cannot approve disruption with status "${disruption.status}"`);
    err.statusCode = 409;
    throw err;
  }

  if (!disruption.proposal || disruption.proposal.kind !== 'reschedule') {
    const err = new Error('No valid reschedule proposal found to approve');
    err.statusCode = 400;
    throw err;
  }

  if (disruption.proposal.baseHash !== trimmedHash) {
    const err = new Error('proposal_changed');
    err.statusCode = 409;
    err.error = 'proposal_changed';
    throw err;
  }

  // 3. Load Itinerary
  const itinerary = await Itinerary.findOne({ _id: disruption.itineraryId, userId });
  if (!itinerary) {
    const err = new Error('Itinerary not found');
    err.statusCode = 404;
    throw err;
  }

  const dayNumber = disruption.proposal.dayNumber;
  const existingDays = Array.isArray(itinerary.days) ? itinerary.days : [];
  const day = existingDays.find((d) => d.dayNumber === dayNumber);
  if (!day) {
    const err = new Error('itinerary_changed');
    err.statusCode = 409;
    err.error = 'itinerary_changed';
    throw err;
  }

  const disruptionTag = `disruption:${disruption._id}`;

  // 4. Crash Recovery Check:
  // If this disruption's edit was ALREADY applied to editHistory in a previous attempt
  // that crashed before updating Disruption status, finish the status update only!
  const history = Array.isArray(itinerary.editHistory) ? itinerary.editHistory : [];
  const existingSnapshot = history.find(
    (e) => e.tag === disruptionTag || String(e.disruptionId) === String(disruption._id)
  );

  if (existingSnapshot) {
    const updatedDisruption = await Disruption.findOneAndUpdate(
      { _id: disruption._id, userId, status: { $in: ['proposed', 'approved'] } },
      {
        $set: {
          status: 'approved',
          appliedEditId: existingSnapshot._id.toString(),
          approvedAt: disruption.approvedAt || new Date(),
        },
      },
      { new: true }
    );

    console.log(`[Disruptions] disruptionId=${disruptionId} action=approve outcome=crash_recovery`);
    return {
      success: true,
      disruption: updatedDisruption || disruption,
      undoAvailable: true,
      simulated: isSimulated,
      message: simulatedMessage,
    };
  }

  // 5. Staleness check against CURRENT day's state
  const currentHash = computeBaseHash(day);
  if (currentHash !== disruption.proposal.baseHash) {
    const err = new Error('itinerary_changed');
    err.statusCode = 409;
    err.error = 'itinerary_changed';
    throw err;
  }

  // Re-validate at apply time: every activityId still exists in that day and none is done
  const activities = Array.isArray(day.activities) ? day.activities : [];
  for (const change of disruption.proposal.changes || []) {
    const actIndex = activities.findIndex((a, idx) => {
      const id = a?.id || a?._id?.toString() || a?.placeId || a?.activityId || String(idx);
      return String(id) === String(change.activityId);
    });
    if (actIndex === -1) {
      const err = new Error('itinerary_changed');
      err.statusCode = 409;
      err.error = 'itinerary_changed';
      throw err;
    }
    const act = activities[actIndex];
    if (typeof act !== 'string' && act?.done === true) {
      const err = new Error('itinerary_changed');
      err.statusCode = 409;
      err.error = 'itinerary_changed';
      throw err;
    }
  }

  // 6. Apply stored changes deterministically (NO LLM CALL)
  const updatedDay = applyProposalChangesToDay(day, disruption.proposal.changes);
  const newDays = existingDays.map((d) => (d.dayNumber === dayNumber ? updatedDay : d));

  const previousDays = [
    typeof day.toObject === 'function' ? day.toObject() : JSON.parse(JSON.stringify(day)),
  ];

  const snapshotId = new mongoose.Types.ObjectId();
  const snapshotEntry = {
    _id: snapshotId,
    createdAt: new Date(),
    dayNumbers: [dayNumber],
    previousDays,
    tag: disruptionTag,
    label: 'Flight delay adjustment',
    disruptionId: disruption._id,
  };

  // 7. Atomic conditional write to Itinerary:
  // Ensure the tag is NOT already present (guarantees exactly one edit on concurrent calls)
  const updatedItinerary = await Itinerary.findOneAndUpdate(
    {
      _id: itinerary._id,
      userId,
      'editHistory.tag': { $ne: disruptionTag },
    },
    {
      $set: { days: newDays },
      $push: {
        editHistory: {
          $each: [snapshotEntry],
          $slice: -10,
        },
      },
    },
    { new: true }
  );

  let appliedEditId = snapshotId.toString();

  if (!updatedItinerary) {
    // Another concurrent call wrote the snapshot just now
    const reloaded = await Itinerary.findOne({ _id: itinerary._id, userId });
    const raceSnapshot = (reloaded?.editHistory || []).find(
      (e) => e.tag === disruptionTag || String(e.disruptionId) === String(disruption._id)
    );
    if (raceSnapshot) {
      appliedEditId = raceSnapshot._id.toString();
    } else {
      const err = new Error('itinerary_changed');
      err.statusCode = 409;
      throw err;
    }
  }

  // Simulate crash failure between itinerary write and Disruption status update
  if (simulateCrash) {
    const err = new Error('Simulated crash between itinerary write and disruption status update');
    err.statusCode = 500;
    throw err;
  }

  // 8. Update Disruption status to 'approved'
  const approvedAt = new Date();
  const updatedDisruption = await Disruption.findOneAndUpdate(
    {
      _id: disruption._id,
      userId,
      status: { $in: ['proposed', 'approved'] },
    },
    {
      $set: {
        status: 'approved',
        appliedEditId,
        approvedAt,
      },
    },
    { new: true }
  );

  if (!updatedDisruption) {
    // Lost race to concurrent dismiss: revert the itinerary edit so dismissed -> no edit
    await Itinerary.findOneAndUpdate(
      {
        _id: itinerary._id,
        userId,
      },
      {
        $set: { days: itinerary.days },
        $pull: { editHistory: { tag: disruptionTag } },
      }
    );
    const err = new Error('Cannot approve disruption that was dismissed');
    err.statusCode = 409;
    throw err;
  }

  console.log(`[Disruptions] disruptionId=${disruptionId} action=approve outcome=success`);
  return {
    success: true,
    disruption: updatedDisruption,
    undoAvailable: true,
    simulated: isSimulated,
    message: simulatedMessage,
  };
}

/**
 * Dismisses a stored disruption.
 * Allowed for statuses 'new' or 'proposed'.
 * Already dismissed returns 200 idempotent.
 * If already approved, returns 409 instructing user to undo.
 * Never touches the itinerary.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.disruptionId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @returns {Promise<{ success: boolean, disruption: Object, simulated: boolean }>}
 */
export async function dismissDisruption({ disruptionId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(disruptionId)) {
    const err = new Error('Invalid disruption ID');
    err.statusCode = 400;
    throw err;
  }

  const disruption = await Disruption.findOne({ _id: disruptionId, userId });
  if (!disruption) {
    const err = new Error('Disruption not found');
    err.statusCode = 404;
    throw err;
  }

  const isSimulated = disruption.source === 'simulation';

  if (disruption.status === 'dismissed') {
    console.log(`[Disruptions] disruptionId=${disruptionId} action=dismiss outcome=idempotent`);
    return { success: true, disruption, simulated: isSimulated };
  }

  if (disruption.status === 'approved') {
    const err = new Error('Disruption is already approved. Undo the approval instead.');
    err.statusCode = 409;
    throw err;
  }

  if (disruption.status === 'expired' || disruption.status === 'reverted') {
    const err = new Error(`Cannot dismiss disruption with status "${disruption.status}"`);
    err.statusCode = 409;
    throw err;
  }

  const dismissedAt = new Date();
  const updated = await Disruption.findOneAndUpdate(
    {
      _id: disruption._id,
      userId,
      status: { $in: ['new', 'proposed'] },
    },
    {
      $set: {
        status: 'dismissed',
        dismissedAt,
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await Disruption.findOne({ _id: disruptionId, userId });
    if (current?.status === 'dismissed') {
      return { success: true, disruption: current, simulated: isSimulated };
    }
    const err = new Error(`Cannot dismiss disruption with status "${current?.status}"`);
    err.statusCode = 409;
    throw err;
  }

  console.log(`[Disruptions] disruptionId=${disruptionId} action=dismiss outcome=success`);
  return {
    success: true,
    disruption: updated,
    simulated: isSimulated,
  };
}

/**
 * Undoes an approved disruption.
 * Restores the affected day using the existing undo operation (applySnapshot).
 * Reverts only if the disruption edit is the latest edit in editHistory.
 * Handles eviction (too_old), newer changes (newer_changes_exist), and crash safety.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.disruptionId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {boolean} [params.simulateCrash=false] - For crash safety testing
 * @returns {Promise<{ success: boolean, disruption: Object, restoredDays?: number[], simulated: boolean, message?: string }>}
 */
export async function undoDisruption({
  disruptionId,
  userId,
  simulateCrash = false,
}) {
  if (!mongoose.Types.ObjectId.isValid(disruptionId)) {
    const err = new Error('Invalid disruption ID');
    err.statusCode = 400;
    throw err;
  }

  const disruption = await Disruption.findOne({ _id: disruptionId, userId });
  if (!disruption) {
    const err = new Error('Disruption not found');
    err.statusCode = 404;
    throw err;
  }

  const isSimulated = disruption.source === 'simulation';

  // Idempotent undo: already reverted
  if (disruption.status === 'reverted') {
    console.log(`[Disruptions] disruptionId=${disruptionId} action=undo outcome=idempotent`);
    return {
      success: true,
      disruption,
      message: 'Disruption approval already undone',
      simulated: isSimulated,
    };
  }

  if (disruption.status !== 'approved' || !disruption.appliedEditId) {
    const err = new Error(`Cannot undo disruption with status "${disruption.status}"`);
    err.statusCode = 409;
    throw err;
  }

  const itinerary = await Itinerary.findOne({ _id: disruption.itineraryId, userId });
  if (!itinerary) {
    const err = new Error('Itinerary not found');
    err.statusCode = 404;
    throw err;
  }

  const history = Array.isArray(itinerary.editHistory) ? itinerary.editHistory : [];
  const appliedIdStr = disruption.appliedEditId.toString();

  // Crash safety on Undo:
  // If the itinerary was already restored in a prior attempt that crashed before Disruption update,
  // the snapshot won't be in history, but the day's hash matches the pre-approval baseHash!
  const snapshotIndex = history.findIndex((e) => e._id.toString() === appliedIdStr);

  if (snapshotIndex === -1) {
    const day = (itinerary.days || []).find((d) => d.dayNumber === disruption.proposal?.dayNumber);
    const currentHash = computeBaseHash(day);

    if (disruption.proposal?.baseHash && currentHash === disruption.proposal.baseHash) {
      // Itinerary was already restored! Finish the status update.
      const updated = await Disruption.findOneAndUpdate(
        { _id: disruption._id, userId, status: { $in: ['approved', 'reverted'] } },
        {
          $set: {
            status: 'reverted',
            revertedAt: disruption.revertedAt || new Date(),
          },
        },
        { new: true }
      );

      console.log(`[Disruptions] disruptionId=${disruptionId} action=undo outcome=crash_recovery`);
      return {
        success: true,
        disruption: updated || disruption,
        simulated: isSimulated,
      };
    }

    // Otherwise, the snapshot has been evicted from the 10-entry history
    const err = new Error('Snapshot has been evicted from edit history.');
    err.statusCode = 409;
    err.error = 'too_old';
    throw err;
  }

  // Undo allowed ONLY if that snapshot is the MOST RECENT entry in editHistory
  if (snapshotIndex !== history.length - 1) {
    const err = new Error('Other changes were made after this one. Undo those first.');
    err.statusCode = 409;
    err.error = 'newer_changes_exist';
    throw err;
  }

  const targetSnapshot = history[snapshotIndex];
  const restoredDays = applySnapshot(itinerary.days, targetSnapshot);
  const expectedObjId = new mongoose.Types.ObjectId(appliedIdStr);

  // Atomic Itinerary update: verify last element matches expectedObjId, set days, and pop
  const updatedItinerary = await Itinerary.findOneAndUpdate(
    {
      _id: itinerary._id,
      userId,
      $expr: {
        $eq: [
          { $arrayElemAt: ['$editHistory._id', -1] },
          expectedObjId,
        ],
      },
    },
    {
      $set: { days: restoredDays },
      $pop: { editHistory: 1 },
    },
    { new: true }
  );

  if (!updatedItinerary) {
    const err = new Error('newer_changes_exist');
    err.statusCode = 409;
    err.message = 'Other changes were made after this one. Undo those first.';
    throw err;
  }

  // Crash simulation hook
  if (simulateCrash) {
    const err = new Error('Simulated crash between itinerary restore and disruption status update');
    err.statusCode = 500;
    throw err;
  }

  // Update Disruption status to 'reverted'
  const revertedAt = new Date();
  const updatedDisruption = await Disruption.findOneAndUpdate(
    {
      _id: disruption._id,
      userId,
      status: 'approved',
    },
    {
      $set: {
        status: 'reverted',
        revertedAt,
      },
    },
    { new: true }
  );

  console.log(`[Disruptions] disruptionId=${disruptionId} action=undo outcome=success`);
  return {
    success: true,
    disruption: updatedDisruption || disruption,
    restoredDays: targetSnapshot.dayNumbers || [],
    simulated: isSimulated,
  };
}

export default {
  applyProposalChangesToDay,
  approveDisruption,
  dismissDisruption,
  undoDisruption,
};
