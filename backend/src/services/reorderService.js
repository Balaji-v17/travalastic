/**
 * Pure function to apply a new order permutation to an itinerary day's activities.
 *
 * Rules:
 * 1. order is an array of the day's CURRENT indexes in their desired new order.
 * 2. order is an exact permutation of 0..n-1 where n is activities.length.
 * 3. Every done activity stays at its own index (order[i] === i for each done i).
 * 4. The activity at new position i is the old activity order[i], moved as a whole object
 *    (location, placeId, description, everything).
 * 5. For each position that is not done, set suggestedTime to the value currently at that POSITION
 *    (time labels belong to positions, not to activities), or leave it unset if the position has none.
 * 6. Purity: does not mutate input activities or order arrays, or their nested objects.
 *
 * @param {Array<Object>} activities - Array of activity objects
 * @param {Array<number>} order - Array of indices in new order
 * @returns {Array<Object>} Reordered activities array
 * @throws {Error} If order is not an exact permutation or a done activity is moved
 */
export function applyOrder(activities, order) {
  if (!Array.isArray(activities)) {
    throw new Error('activities must be an array');
  }
  if (!Array.isArray(order)) {
    throw new Error('order must be an array');
  }

  const n = activities.length;
  if (order.length !== n) {
    throw new Error(`order length (${order.length}) must match activity count (${n})`);
  }

  // Validate permutation: exact integers 0..n-1, each occurring once
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const idx = order[i];
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= n) {
      throw new Error(`Invalid index in order permutation: ${idx}`);
    }
    if (seen.has(idx)) {
      throw new Error(`Duplicate index in order permutation: ${idx}`);
    }
    seen.add(idx);
  }

  // Validate that every done activity stays at its own index (order[i] === i for each done i)
  for (let i = 0; i < n; i++) {
    const isDone = Boolean(activities[i]?.done);
    if (isDone && order[i] !== i) {
      throw new Error(`Done activity at index ${i} cannot be moved (order[${i}] is ${order[i]})`);
    }
  }

  // Build new activities
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    const sourceIdx = order[i];
    const sourceAct = activities[sourceIdx];

    // Clone source activity
    const movedAct =
      typeof sourceAct?.toObject === 'function'
        ? sourceAct.toObject()
        : JSON.parse(JSON.stringify(sourceAct || {}));

    // If the position is not done, time label comes from position i
    const isPositionDone = Boolean(movedAct.done);
    if (!isPositionDone) {
      const positionTime = activities[i]?.suggestedTime;
      if (positionTime !== undefined && positionTime !== null) {
        movedAct.suggestedTime = positionTime;
      } else {
        delete movedAct.suggestedTime;
      }
    }

    result[i] = movedAct;
  }

  return result;
}

