import crypto from 'crypto';
import mongoose from 'mongoose';
import Disruption from '../../models/Disruption.js';
import Itinerary from '../../models/Itinerary.js';
import {
  generateRescheduleProposal,
  getBucketFromSuggestedTime,
} from '../rescheduleService.js';
import {
  mapDelayToOption,
  findAffectedDay,
} from './analysis.js';

/**
 * Formats a duration in minutes into a clean plain-text string.
 * Example: 125 -> "2 h 5 min", 60 -> "1 h", 30 -> "30 min".
 *
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (!minutes || typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) {
    return '0 min';
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

/**
 * Builds a deterministic summary text strictly from stored numeric and date details.
 * Never asks LLM for delay facts.
 *
 * @param {Object} params
 * @param {number} params.delayMinutes
 * @param {string|null} [params.oldArrival]
 * @param {string|null} [params.newArrival]
 * @param {number} params.dayNumber
 * @param {number} params.changesCount - Count of moved or skipped activities
 * @param {boolean} params.capped
 * @returns {string}
 */
export function buildDeterministicSummary({
  delayMinutes,
  oldArrival,
  newArrival,
  dayNumber,
  changesCount = 0,
  capped = false,
}) {
  const durationStr = formatDuration(delayMinutes);
  let timeStr = '';
  if (oldArrival && newArrival && typeof oldArrival === 'string' && typeof newArrival === 'string') {
    const oldT = oldArrival.length >= 16 ? oldArrival.slice(11, 16) : oldArrival;
    const newT = newArrival.length >= 16 ? newArrival.slice(11, 16) : newArrival;
    timeStr = ` (${oldT} -> ${newT})`;
  }

  let activityText = '';
  if (changesCount === 0) {
    activityText = `keeping all activities on Day ${dayNumber} as scheduled`;
  } else {
    const plural = changesCount === 1 ? '1 activity' : `${changesCount} activities`;
    activityText = `shifting ${plural} on Day ${dayNumber}`;
  }

  let summary = `Your flight now arrives about ${durationStr} later${timeStr}. I proposed ${activityText}.`;
  if (capped) {
    summary += ' Note: delay exceeded 3 hours and was capped at 180 minutes for rescheduling.';
  }
  return summary;
}

/**
 * Computes a stable SHA-256 slice (baseHash) of the affected day's activities.
 * Hashes ONLY the affected day's activity ids, titles, suggested times, and done flags.
 *
 * @param {Object} day
 * @returns {string}
 */
export function computeBaseHash(day) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const activityData = activities.map((a, idx) => ({
    id: a?.id || a?._id?.toString() || a?.placeId || a?.activityId || idx,
    title: (typeof a === 'string' ? a : (a?.title || a?.name || '')).trim(),
    suggestedTime: (typeof a === 'string' ? null : a?.suggestedTime) || '',
    done: Boolean(typeof a === 'string' ? false : a?.done),
  }));
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(activityData))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Validates the rescheduling engine output items against the day's current state.
 * - Every referenced activity exists on that day
 * - Done activities are never moved or skipped
 * - Valid time bucket targets for moves (strictly later than current bucket)
 * - No activity has conflicting actions (e.g. both moved and skipped)
 *
 * @param {Array<Object>} items
 * @param {Object} day
 * @returns {boolean}
 */
export function validateProposalItems(items, day) {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const validBuckets = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const seenActionsByActivity = new Map();

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      return false;
    }

    // 1. Identify which activity is referenced
    let actIndex = -1;
    let act = null;

    if (item.activityId != null) {
      actIndex = activities.findIndex((a, idx) => {
        const id = a?.id || a?._id?.toString() || a?.placeId || a?.activityId || String(idx);
        return String(id) === String(item.activityId);
      });
      if (actIndex === -1) {
        return false; // Unknown activity id
      }
      act = activities[actIndex];
    } else if (typeof item.index === 'number' && Number.isInteger(item.index)) {
      if (item.index < 0 || item.index >= activities.length) {
        return false; // Out of bounds index
      }
      actIndex = item.index;
      act = activities[actIndex];
    } else {
      return false; // Neither activityId nor integer index
    }

    // 2. Activities already done are never touched
    const isDone = typeof act !== 'string' && act?.done === true;
    if (isDone) {
      return false;
    }

    // 3. Action must be valid
    const rawAction = (item.action || '').toLowerCase();
    const action = rawAction === 'drop' ? 'skip' : rawAction;
    if (action !== 'keep' && action !== 'move' && action !== 'skip') {
      return false;
    }

    // 4. No conflicting actions on the same activity
    const existingAction = seenActionsByActivity.get(actIndex);
    if (existingAction && existingAction !== action) {
      return false;
    }
    seenActionsByActivity.set(actIndex, action);

    // 5. Valid times and time buckets for moves
    if (action === 'move') {
      const targetBucket = item.newBucket || item.toTime;
      if (!targetBucket || !validBuckets.includes(targetBucket)) {
        return false;
      }
      const currentBucket = getBucketFromSuggestedTime(act?.suggestedTime);
      const currIdx = validBuckets.indexOf(currentBucket);
      const targetIdx = validBuckets.indexOf(targetBucket);
      if (targetIdx <= currIdx) {
        return false; // Cannot move to same or earlier bucket
      }
    }
  }

  return true;
}

/**
 * Lazy expiry check:
 * Compares date strings in UTC.
 * Note: Timezone imprecision exists because itineraries and flight arrivals
 * may be in local destination timezones while comparisons are done using UTC calendar dates.
 * If the affected day's date is more than 1 day in the past relative to current UTC date,
 * mark status as 'expired'. Never expire 'approved' or 'dismissed'.
 *
 * @param {Object} disruption
 * @param {Object|null} [itinerary]
 * @returns {Promise<Object>}
 */
export async function checkAndExpireDisruption(disruption, itinerary = null) {
  if (!disruption) return disruption;
  if (
    disruption.status === 'approved' ||
    disruption.status === 'dismissed' ||
    disruption.status === 'expired' ||
    disruption.status === 'reverted'
  ) {
    return disruption;
  }

  let affectedDateStr = null;
  if (disruption.details?.newArrival) {
    affectedDateStr = disruption.details.newArrival.slice(0, 10);
  } else if (itinerary?.startDate && disruption.proposal?.dayNumber) {
    const [y, m, d] = itinerary.startDate.slice(0, 10).split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d + (disruption.proposal.dayNumber - 1)));
    affectedDateStr = dateObj.toISOString().slice(0, 10);
  }

  if (!affectedDateStr) return disruption;

  const [aY, aM, aD] = affectedDateStr.split('-').map(Number);
  const affectedUtc = Date.UTC(aY, aM - 1, aD);

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  if (todayUtc - affectedUtc > msPerDay) {
    const updated = await Disruption.findOneAndUpdate(
      {
        _id: disruption._id,
        status: { $in: ['new', 'proposed'] },
      },
      {
        $set: { status: 'expired' },
      },
      { new: true }
    );
    if (updated) {
      return updated;
    }
  }

  return disruption;
}

/**
 * Generates a re-plan proposal for a stored Disruption by reusing the existing
 * reschedule engine. Pure detection and proposal generation; leaves the itinerary
 * document byte-identical before and after.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.disruptionId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {boolean} [params.regenerate=false]
 * @param {Function} [params.engineFn] - Optional injected engine function (for testing/mocking)
 * @returns {Promise<{ success: boolean, proposal: Object, disruption?: Object, cached?: boolean }>}
 */
export async function generateProposal({
  disruptionId,
  userId,
  regenerate = false,
  engineFn = generateRescheduleProposal,
}) {
  // 1. Validate disruptionId format
  if (!mongoose.Types.ObjectId.isValid(disruptionId)) {
    const err = new Error('Invalid disruption ID');
    err.statusCode = 400;
    throw err;
  }

  // 2. Load disruption by id AND userId (ownership checked; generic 404)
  const disruption = await Disruption.findOne({ _id: disruptionId, userId });
  if (!disruption) {
    const err = new Error('Disruption not found');
    err.statusCode = 404;
    throw err;
  }

  // 3. Status checks: allowed statuses are 'new' and 'proposed'
  if (['approved', 'dismissed', 'expired', 'reverted'].includes(disruption.status)) {
    const err = new Error(`Cannot generate proposal for disruption with status "${disruption.status}"`);
    err.statusCode = 409;
    throw err;
  }

  // 4. Structural change or non-actionable check: store manual_review proposal without calling AI
  const isStructural = Boolean(disruption.details?.structural);
  const isNotActionable = disruption.proposal && disruption.proposal.actionable === false;

  if (isStructural || isNotActionable) {
    const proposal = {
      kind: 'manual_review',
      option: null,
      baseHash: '',
      generatedAt: disruption.proposal?.generatedAt || new Date(),
      summary: 'Flight schedule changed structurally (route/segments modified). Please review your itinerary manually.',
      changes: [],
      unchangedCount: 0,
      capped: false,
    };

    const updated = await Disruption.findOneAndUpdate(
      {
        _id: disruption._id,
        userId,
        status: { $in: ['new', 'proposed'] },
      },
      {
        $set: {
          proposal,
          status: 'proposed',
        },
      },
      { new: true }
    );

    console.log(`[DisruptionProposal] disruptionId=${disruptionId} outcome=manual_review`);
    return {
      success: true,
      proposal,
      disruption: updated || disruption,
      cached: false,
    };
  }

  // 5. Load current itinerary for disruption.itineraryId (owned by user)
  const itinerary = await Itinerary.findOne({ _id: disruption.itineraryId, userId });
  if (!itinerary) {
    const err = new Error('Itinerary not found');
    err.statusCode = 404;
    throw err;
  }

  // 6. Determine affected dayNumber and mapped option
  let dayNumber = disruption.proposal?.dayNumber;
  if (dayNumber == null) {
    dayNumber = findAffectedDay(itinerary, disruption.details?.newArrival);
  }

  let option = disruption.proposal?.option;
  let capped = Boolean(disruption.proposal?.capped);
  if (option == null) {
    const mapped = mapDelayToOption(disruption.details?.delayMinutes);
    option = mapped?.option || null;
    capped = Boolean(mapped?.capped);
  }

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  const day = days.find((d) => d.dayNumber === dayNumber);
  if (!day) {
    const err = new Error(`Day ${dayNumber} not found in itinerary`);
    err.statusCode = 400;
    throw err;
  }

  // 7. Compute baseHash for idempotency and staleness
  const baseHash = computeBaseHash(day);

  if (
    !regenerate &&
    disruption.proposal &&
    disruption.proposal.kind === 'reschedule' &&
    disruption.proposal.baseHash === baseHash &&
    disruption.proposal.option === option
  ) {
    console.log(`[DisruptionProposal] disruptionId=${disruptionId} outcome=cached`);
    return {
      success: true,
      proposal: disruption.proposal,
      disruption,
      cached: true,
    };
  }

  // 8. Whitelist day context for prompt / engine (no passenger, booking, or payment fields)
  const cleanDay = {
    dayNumber: day.dayNumber,
    activities: (day.activities || []).map((a, idx) => ({
      id: a?.id || a?._id?.toString() || a?.placeId || a?.activityId || String(idx),
      title: typeof a === 'string' ? a : (a?.title || a?.name || ''),
      suggestedTime: typeof a === 'string' ? null : (a?.suggestedTime || null),
      done: Boolean(typeof a === 'string' ? false : a?.done),
      description: typeof a === 'string' ? '' : (a?.description || ''),
      placeId: typeof a === 'string' ? null : (a?.placeId || null),
      location: typeof a === 'string' ? null : (a?.location || null),
      outdoor: typeof a === 'string' ? null : a?.outdoor,
    })),
  };

  // 9. Call reschedule engine with validation and 1 retry
  let engineResult = null;
  let isValid = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      engineResult = await engineFn({
        destination: itinerary.destination || '',
        dayNumber,
        delayMinutes: option,
        day: cleanDay,
      });

      if (engineResult && validateProposalItems(engineResult.items, cleanDay)) {
        isValid = true;
        break;
      }
    } catch (err) {
      // Retry once on failure
    }
  }

  if (!isValid || !engineResult) {
    console.log(`[DisruptionProposal] disruptionId=${disruptionId} outcome=failed`);
    const err = new Error("couldn't generate a proposal right now");
    err.statusCode = 502;
    throw err;
  }

  // 10. Map engine result to proposal shape
  const activities = cleanDay.activities;
  const changes = (engineResult.items || []).map((item) => {
    let actIndex = -1;
    if (item.activityId != null) {
      actIndex = activities.findIndex((a, idx) => {
        const id = a?.id || a?._id?.toString() || a?.placeId || a?.activityId || String(idx);
        return String(id) === String(item.activityId);
      });
    }
    if (actIndex === -1 && typeof item.index === 'number') {
      actIndex = item.index;
    }
    const act = activities[actIndex] || {};
    const actId = act.id || act._id?.toString() || act.placeId || act.activityId || String(actIndex);
    const rawAction = (item.action || 'keep').toLowerCase();
    const action = rawAction === 'drop' ? 'skip' : rawAction;
    const fromTime = item.currentBucket || getBucketFromSuggestedTime(act.suggestedTime);
    const toTime = action === 'move' ? (item.newBucket || item.toTime || null) : undefined;
    const reason = (item.reason || 'Kept as scheduled')
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 140);

    const changeObj = {
      activityId: String(actId),
      action,
      fromTime,
      reason,
    };
    if (toTime) {
      changeObj.toTime = toTime;
    }
    return changeObj;
  });

  const keptCount = changes.filter((c) => c.action === 'keep').length;
  const doneCount = activities.filter((a) => a.done).length;
  const unchangedCount = keptCount + doneCount;
  const shiftedCount = changes.filter((c) => c.action !== 'keep').length;

  const summary = buildDeterministicSummary({
    delayMinutes: disruption.details?.delayMinutes || option,
    oldArrival: disruption.details?.oldArrival,
    newArrival: disruption.details?.newArrival,
    dayNumber,
    changesCount: shiftedCount,
    capped,
  });

  const proposal = {
    kind: 'reschedule',
    dayNumber,
    option,
    baseHash,
    generatedAt: disruption.proposal?.generatedAt || new Date(),
    summary,
    changes,
    unchangedCount,
    capped: Boolean(capped),
  };

  // 11. Conditional update to status 'proposed'
  const updated = await Disruption.findOneAndUpdate(
    {
      _id: disruption._id,
      userId,
      status: { $in: ['new', 'proposed'] },
    },
    {
      $set: {
        proposal,
        status: 'proposed',
      },
    },
    { new: true }
  );

  console.log(`[DisruptionProposal] disruptionId=${disruptionId} outcome=generated`);
  return {
    success: true,
    proposal,
    disruption: updated || disruption,
    cached: false,
  };
}

export default {
  generateProposal,
  validateProposalItems,
  buildDeterministicSummary,
  formatDuration,
  computeBaseHash,
  checkAndExpireDisruption,
};

