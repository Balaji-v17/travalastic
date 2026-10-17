import mongoose from 'mongoose';
import Itinerary from '../models/Itinerary.js';

/**
 * Pure functions and helpers for itinerary undo operations.
 */

/**
 * Pure function that applies a snapshot entry to an array of itinerary days.
 * Replaces the days targeted by the snapshot with their previous state,
 * preserving array ordering and keeping untouched days and unaffected fields intact.
 *
 * @param {Array<Object>} days - Current itinerary days
 * @param {Object} entry - Snapshot entry with { dayNumbers: number[], previousDays: Object[] }
 * @returns {Array<Object>} Restored array of days
 */
export function applySnapshot(days, entry) {
  if (!Array.isArray(days)) return [];
  if (!entry || !Array.isArray(entry.previousDays)) {
    return days.map((d) =>
      typeof d.toObject === 'function' ? d.toObject() : JSON.parse(JSON.stringify(d))
    );
  }

  const previousDaysMap = new Map();
  for (const prevDay of entry.previousDays) {
    if (prevDay && typeof prevDay.dayNumber === 'number') {
      const clonedPrev =
        typeof prevDay.toObject === 'function'
          ? prevDay.toObject()
          : JSON.parse(JSON.stringify(prevDay));
      previousDaysMap.set(clonedPrev.dayNumber, clonedPrev);
    }
  }

  return days.map((day) => {
    const dayObj =
      typeof day.toObject === 'function'
        ? day.toObject()
        : JSON.parse(JSON.stringify(day));

    if (previousDaysMap.has(dayObj.dayNumber)) {
      return previousDaysMap.get(dayObj.dayNumber);
    }
    return dayObj;
  });
}

/**
 * Formats editHistory into a safe client-facing undo summary.
 * NEVER leaks the snapshots array or raw snapshot entries.
 *
 * @param {Array<Object>} editHistory
 * @returns {{ count: number, lastEditId: string | null, lastEditDays: number[] }}
 */
export function formatUndo(editHistory) {
  const history = Array.isArray(editHistory) ? editHistory : [];
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  return {
    count: history.length,
    lastEditId: lastEntry && lastEntry._id ? lastEntry._id.toString() : null,
    lastEditDays:
      lastEntry && Array.isArray(lastEntry.dayNumbers) ? [...lastEntry.dayNumbers] : [],
  };
}

/**
 * Shared atomic snapshot-and-write routine used by chat edits and reschedule apply.
 * Atomically writes newDays AND pushes the snapshot to editHistory (keeping only last 10 entries).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.itineraryId
 * @param {string|mongoose.Types.ObjectId} [params.userId]
 * @param {Array<Object>} params.newDays
 * @param {Array<number>} params.modifiedDayNumbers
 * @param {Array<Object>} params.previousDays
 * @returns {Promise<{ updatedItinerary: Object, editId: string }>}
 */
export async function saveItineraryEditSnapshot({
  itineraryId,
  userId,
  newDays,
  modifiedDayNumbers,
  previousDays,
}) {
  const snapshotId = new mongoose.Types.ObjectId();
  const snapshotEntry = {
    _id: snapshotId,
    createdAt: new Date(),
    dayNumbers: modifiedDayNumbers,
    previousDays: (previousDays || []).map((d) =>
      typeof d.toObject === 'function' ? d.toObject() : JSON.parse(JSON.stringify(d))
    ),
  };

  const query = userId ? { _id: itineraryId, userId } : { _id: itineraryId };
  const updatedItinerary = await Itinerary.findOneAndUpdate(
    query,
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

  return {
    updatedItinerary,
    editId: snapshotId.toString(),
  };
}

export default {
  applySnapshot,
  formatUndo,
  saveItineraryEditSnapshot,
};

