import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

export const DROP_MIN_DELAY_MINUTES = 120;
export const ALLOWED_DELAYS = [30, 60, 120, 180];
export const BUCKET_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'];

/**
 * Maps a suggestedTime string or clock pattern to one of the four canonical time buckets.
 * @param {string|null|undefined} suggestedTime
 * @returns {'Morning'|'Afternoon'|'Evening'|'Night'}
 */
export function getBucketFromSuggestedTime(suggestedTime) {
  if (!suggestedTime || typeof suggestedTime !== 'string') {
    return 'Morning';
  }
  const lower = suggestedTime.trim().toLowerCase();
  if (lower.includes('morning')) return 'Morning';
  if (lower.includes('afternoon')) return 'Afternoon';
  if (lower.includes('evening')) return 'Evening';
  if (lower.includes('night')) return 'Night';

  // Parse clock time patterns (e.g. "10:00 AM", "2:30 PM", "14:00")
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toLowerCase() : null;

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    const totalMinutes = hour * 60 + minute;
    if (totalMinutes >= 360 && totalMinutes <= 719) return 'Morning'; // 06:00 - 11:59
    if (totalMinutes >= 720 && totalMinutes <= 1019) return 'Afternoon'; // 12:00 - 16:59
    if (totalMinutes >= 1020 && totalMinutes <= 1259) return 'Evening'; // 17:00 - 20:59
    if (totalMinutes >= 1260 && totalMinutes <= 1439) return 'Night'; // 21:00 - 23:59
  }

  return 'Morning';
}

/**
 * Pure function that validates and normalizes a rescheduling proposal.
 * - Ignores unknown or done indexes.
 * - Keeps the first item for each index.
 * - Treats missing activities as keep.
 * - Converts a move to an earlier or identical bucket into keep.
 * - Converts any drop into keep when delayMinutes is below DROP_MIN_DELAY_MINUTES (120).
 * - Includes each activity's title and currentBucket in its item.
 * - Store nothing.
 *
 * @param {Object} day - Itinerary day object with activities array
 * @param {number} delayMinutes - The requested delay in minutes (30, 60, 120, 180)
 * @param {Array<Object>} rawItems - Proposed items from LLM or client
 * @returns {Array<Object>} Normalized list of proposal items sorted by index
 */
export function normalizeProposal(day, delayMinutes, rawItems = []) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const delay = Number(delayMinutes) || 0;
  const items = Array.isArray(rawItems) ? rawItems : [];

  const seenIndexes = new Set();
  const rawByNotDoneIndex = new Map();

  for (const item of items) {
    if (!item || typeof item.index !== 'number' || !Number.isInteger(item.index)) {
      continue;
    }
    const idx = item.index;
    // Ignore out-of-bounds indexes
    if (idx < 0 || idx >= activities.length) {
      continue;
    }
    const act = activities[idx];
    // Ignore done indexes
    if (typeof act !== 'string' && act?.done === true) {
      continue;
    }
    // Keep only the first item for each index
    if (seenIndexes.has(idx)) {
      continue;
    }
    seenIndexes.add(idx);
    rawByNotDoneIndex.set(idx, item);
  }

  const result = [];

  for (let idx = 0; idx < activities.length; idx++) {
    const act = activities[idx];
    const isDone = typeof act !== 'string' && act?.done === true;
    if (isDone) {
      continue; // Only consider not-done activities
    }

    const title = typeof act === 'string' ? act : (act?.title || act?.name || '');
    const currentBucket = getBucketFromSuggestedTime(
      typeof act === 'string' ? null : act?.suggestedTime
    );
    const currentBucketIdx = BUCKET_ORDER.indexOf(currentBucket);

    const raw = rawByNotDoneIndex.get(idx);

    if (!raw) {
      // Missing activities default to keep
      result.push({
        index: idx,
        title,
        action: 'keep',
        currentBucket,
        newBucket: null,
        reason: 'Kept as scheduled',
      });
      continue;
    }

    let action = (raw.action || 'keep').toLowerCase();
    let newBucket = raw.newBucket || null;
    let reason =
      typeof raw.reason === 'string' && raw.reason.trim()
        ? raw.reason.trim().slice(0, 140)
        : 'Kept as scheduled';

    if (action === 'drop') {
      // Converts any drop into keep when delayMinutes is below DROP_MIN_DELAY_MINUTES (120)
      if (delay < DROP_MIN_DELAY_MINUTES) {
        action = 'keep';
        newBucket = null;
        if (!raw.reason || raw.reason === 'Kept as scheduled') {
          reason = 'Kept as scheduled (delay under 2 hours)';
        }
      }
    } else if (action === 'move') {
      if (!newBucket || typeof newBucket !== 'string') {
        action = 'keep';
        newBucket = null;
      } else {
        const canonicalNewBucket = getBucketFromSuggestedTime(newBucket);
        const newBucketIdx = BUCKET_ORDER.indexOf(canonicalNewBucket);
        // Converts a move to an earlier or identical bucket into keep
        if (newBucketIdx <= currentBucketIdx) {
          action = 'keep';
          newBucket = null;
        } else {
          newBucket = canonicalNewBucket;
        }
      }
    } else {
      action = 'keep';
      newBucket = null;
    }

    result.push({
      index: idx,
      title,
      action,
      currentBucket,
      newBucket: action === 'move' ? newBucket : null,
      reason,
    });
  }

  // Ensure sorted by index ascending
  result.sort((a, b) => a.index - b.index);

  return result;
}

/**
 * Pure function that deterministically applies rescheduling without any LLM call:
 * - Moved activities get their new suggestedTime bucket.
 * - Dropped activities are removed.
 * - Done activities stay in their current positions.
 * - The remaining activities fill the other positions, ordered by bucket
 *   (Morning, Afternoon, Evening, Night) and keeping their relative order within a bucket.
 * - Costs are NOT recomputed.
 *
 * @param {Object} day - Current day object
 * @param {Array<Object>} normalizedItems - Proposal items validated against day
 * @returns {Object} Updated day object with rescheduled activities
 */
export function applyReschedule(day, normalizedItems = []) {
  const originalActivities = Array.isArray(day?.activities) ? day.activities : [];
  const itemsMap = new Map();
  for (const item of normalizedItems) {
    if (item && typeof item.index === 'number') {
      itemsMap.set(item.index, item);
    }
  }

  const remainingNotDone = [];

  for (let idx = 0; idx < originalActivities.length; idx++) {
    const act = originalActivities[idx];
    const isDone = typeof act !== 'string' && act?.done === true;
    if (isDone) {
      continue;
    }

    const item = itemsMap.get(idx);
    const action = item?.action || 'keep';

    if (action === 'drop') {
      // Dropped activities are removed
      continue;
    }

    const clonedAct =
      typeof act === 'string'
        ? { title: act, name: act, suggestedTime: null, done: false }
        : typeof act.toObject === 'function'
        ? act.toObject()
        : { ...act };

    let bucket;
    if (action === 'move' && item.newBucket) {
      clonedAct.suggestedTime = item.newBucket;
      bucket = item.newBucket;
    } else {
      bucket = getBucketFromSuggestedTime(clonedAct.suggestedTime);
    }

    remainingNotDone.push({
      originalIndex: idx,
      activity: clonedAct,
      bucket,
    });
  }

  // Order remaining activities by bucket (Morning, Afternoon, Evening, Night),
  // keeping relative order within a bucket
  remainingNotDone.sort((a, b) => {
    const bIndexA = BUCKET_ORDER.indexOf(a.bucket);
    const bIndexB = BUCKET_ORDER.indexOf(b.bucket);
    if (bIndexA !== bIndexB) {
      return bIndexA - bIndexB;
    }
    return a.originalIndex - b.originalIndex;
  });

  // Done activities stay in their current positions.
  // The remaining activities fill the other positions.
  const slots = new Array(originalActivities.length);
  for (let idx = 0; idx < originalActivities.length; idx++) {
    const act = originalActivities[idx];
    const isDone = typeof act !== 'string' && act?.done === true;
    if (isDone) {
      slots[idx] =
        typeof act.toObject === 'function' ? act.toObject() : { ...act };
    }
  }

  let remainingPointer = 0;
  for (let idx = 0; idx < slots.length; idx++) {
    if (slots[idx] === undefined) {
      if (remainingPointer < remainingNotDone.length) {
        slots[idx] = remainingNotDone[remainingPointer].activity;
        remainingPointer++;
      }
    }
  }

  // Filter out any undefined/empty slots from dropped activities
  const finalActivities = slots.filter((act) => act !== undefined);

  const clonedDay =
    typeof day.toObject === 'function' ? day.toObject() : { ...day };
  clonedDay.activities = finalActivities;

  return clonedDay;
}

// Zod schemas for structured LLM response
export const RescheduleItemSchema = z.object({
  index: z.number().describe("0-based index of the activity in the day's activities list"),
  action: z
    .enum(['keep', 'move', 'drop'])
    .describe('Action for this activity: keep, move (to a later bucket), or drop'),
  newBucket: z
    .enum(['Morning', 'Afternoon', 'Evening', 'Night'])
    .nullable()
    .optional()
    .describe('Target time bucket if moving to a later bucket; null if keep or drop'),
  reason: z.string().max(140).describe('Brief plain words explanation, maximum 140 characters'),
});

export const RescheduleProposalSchema = z.object({
  summary: z
    .string()
    .describe('A 1-2 sentence plain-language summary of how the day was adjusted'),
  items: z.array(RescheduleItemSchema).describe('Array of suggestions for each not-done activity'),
});

/**
 * Fallback proposal generator when LLM is unavailable or errors
 */
function createFallbackProposal(day, delayMinutes) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const notDoneIndices = [];
  for (let i = 0; i < activities.length; i++) {
    if (activities[i]?.done !== true) notDoneIndices.push(i);
  }

  let summary = `You are running ${delayMinutes} minutes late. Your remaining schedule has been adjusted.`;
  const rawItems = [];

  if (delayMinutes <= 60) {
    summary = `With a ${delayMinutes}-minute delay, you should still have time to complete your remaining plans.`;
    for (const idx of notDoneIndices) {
      rawItems.push({
        index: idx,
        action: 'keep',
        newBucket: null,
        reason: 'Kept as scheduled despite the brief delay.',
      });
    }
  } else {
    const dropCount = delayMinutes >= 180 ? 2 : 1;
    const keepLimit = Math.max(1, notDoneIndices.length - dropCount);
    summary = `With a ${delayMinutes}-minute delay, dropping lower-priority activities prevents rushing.`;
    for (let i = 0; i < notDoneIndices.length; i++) {
      const idx = notDoneIndices[i];
      if (i >= keepLimit && notDoneIndices.length > 1) {
        rawItems.push({
          index: idx,
          action: 'drop',
          newBucket: null,
          reason: 'Dropped to prevent rushing due to the delay.',
        });
      } else {
        rawItems.push({
          index: idx,
          action: 'keep',
          newBucket: null,
          reason: 'Kept as scheduled.',
        });
      }
    }
  }

  return {
    summary,
    items: normalizeProposal(day, delayMinutes, rawItems),
  };
}

/**
 * Generates an AI reschedule proposal using one structured-output LLM call.
 * Normalizes and validates the proposal with normalizeProposal.
 *
 * @param {Object} params
 * @param {string} params.destination - Destination name
 * @param {number} params.dayNumber - Day number
 * @param {number} params.delayMinutes - 30, 60, 120, or 180
 * @param {Object} params.day - Itinerary day object
 * @returns {Promise<{ summary: string, items: Array<Object>, dayNumber: number, delayMinutes: number }>}
 */
export async function generateRescheduleProposal({
  destination = '',
  dayNumber,
  delayMinutes,
  day,
}) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const notDoneList = [];

  activities.forEach((act, idx) => {
    if (typeof act !== 'string' && act?.done === true) return;
    const title = typeof act === 'string' ? act : (act?.title || act?.name || 'Activity');
    const bucket = getBucketFromSuggestedTime(typeof act === 'string' ? null : act?.suggestedTime);
    const desc = typeof act === 'string' ? '' : (act?.description || '');
    notDoneList.push(
      `Index ${idx}: "${title}" [Current bucket: ${bucket}]${desc ? ` - ${desc}` : ''}`
    );
  });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || notDoneList.length === 0) {
    const fallback = createFallbackProposal(day, delayMinutes);
    return {
      dayNumber,
      delayMinutes,
      summary: fallback.summary,
      items: fallback.items,
    };
  }

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const systemPrompt = `You are a travel scheduling assistant helping a traveler who is running late today.
PROMPT RULES:
1. Durations and opening hours are unknown, so NEVER invent exact times or clock timestamps.
2. The ONLY allowed actions are "keep", "move" (to a strictly LATER time bucket: Morning, Afternoon, Evening, Night), or "drop".
3. NEVER add or rename activities. Use the exact index provided.
4. For delays of 60 minutes or less, strongly prefer keeping everything ("keep").
5. For longer delays (120 or 180 minutes), drop the lowest-priority remaining activities rather than cramming the schedule.
6. Write each reason in plain words, at most 140 characters.
7. Return a brief 1-2 sentence summary of your proposal.`;

  const userPrompt = `Destination: ${destination || 'Current trip'}
Day Number: ${dayNumber}
Delay: ${delayMinutes} minutes
Remaining (not-done) activities to reschedule:
${notDoneList.join('\n')}`;

  try {
    const model = new ChatGroq({
      apiKey,
      model: modelName,
      temperature: 0.1,
    }).withStructuredOutput(RescheduleProposalSchema);

    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const normalizedItems = normalizeProposal(day, delayMinutes, response?.items || []);

    return {
      dayNumber,
      delayMinutes,
      summary: response?.summary || `Adjusted plan for a ${delayMinutes}-minute delay.`,
      items: normalizedItems,
    };
  } catch (err) {
    console.warn('Groq reschedule proposal failed, using fallback:', err.message);
    const fallback = createFallbackProposal(day, delayMinutes);
    return {
      dayNumber,
      delayMinutes,
      summary: fallback.summary,
      items: fallback.items,
    };
  }
}

