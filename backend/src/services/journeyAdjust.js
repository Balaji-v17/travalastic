import crypto from 'crypto';

/**
 * Pure Haversine straight-line distance in kilometers between two lat/lon pairs.
 * Earth radius R = 6371 km.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0;
  }
  const l1 = Number(lat1);
  const lo1 = Number(lon1);
  const l2 = Number(lat2);
  const lo2 = Number(lon2);
  if (
    !Number.isFinite(l1) ||
    !Number.isFinite(lo1) ||
    !Number.isFinite(l2) ||
    !Number.isFinite(lo2)
  ) {
    return 0;
  }
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(l2 - l1);
  const dLon = toRad(lo2 - lo1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(l1)) * Math.cos(toRad(l2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes a stable SHA-256 baseHash of the entire itinerary state across all days.
 * Hashes only day numbers and activity identifiers, titles, slots, kinds, and done flags.
 *
 * @param {Object} itinerary
 * @returns {string} SHA-256 hex string
 */
export function computeBaseHash(itinerary) {
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const activityData = days.map((day) => {
    const activities = Array.isArray(day?.activities) ? day.activities : [];
    return {
      dayNumber: day.dayNumber,
      activities: activities.map((a, idx) => ({
        id: a?.id || a?._id?.toString() || a?.placeId || a?.placeRef || idx,
        title: (typeof a === 'string' ? a : (a?.title || a?.name || '')).trim(),
        suggestedTime: a?.suggestedTime || a?.timeOfDay || '',
        kind: a?.kind || 'place',
        done: Boolean(a?.done || a?.status === 'done' || a?.status === 'booked'),
      })),
    };
  });
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(activityData))
    .digest('hex');
}

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 *
 * @param {number|string} [seed]
 * @returns {{ seed: number, next: () => number }}
 */
export function createRng(seed) {
  let s = 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    s = seed >>> 0;
  } else if (typeof seed === 'string' && seed.trim()) {
    for (let i = 0; i < seed.length; i++) {
      s = (Math.imul(31, s) + seed.charCodeAt(i)) >>> 0;
    }
  } else {
    s = (Math.random() * 0xffffffff) >>> 0;
  }

  return {
    seed: s,
    next: function () {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Checks whether an activity is marked as completed or booked.
 */
export function isActivityDone(act) {
  return Boolean(act?.done === true || act?.status === 'done' || act?.status === 'booked');
}

/**
 * Checks whether an activity is considered a place activity.
 */
export function isPlaceActivity(act) {
  if (!act) return false;
  const kind = act.kind;
  if (kind) {
    return kind === 'place';
  }
  // Fallback for legacy activity objects without explicit kind
  const type = act.type;
  if (type === 'flight' || type === 'hotel' || type === 'transfer' || type === 'meal' || type === 'free') {
    return false;
  }
  return true;
}

/**
 * Checks whether an activity is derived from curated TouristPlace data.
 */
export function isCuratedPlace(act) {
  const ref = String(act?.placeRef || act?.placeId || act?.id || '');
  if (act?.source === 'curated') return true;
  if (/^[0-9a-fA-F]{24}$/.test(ref)) return true;
  if (ref.startsWith('curated')) return true;
  return false;
}

/**
 * Checks whether an activity has finite, valid geographic coordinates.
 */
export function hasValidCoordinates(act) {
  const loc = act?.location;
  if (!loc) return false;
  const lat = Number(loc.lat != null ? loc.lat : loc.latitude);
  const lon = Number(loc.lon != null ? loc.lon : loc.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Deep clones day plan objects to ensure adjustments are pure.
 */
function cloneDays(days) {
  return (days || []).map((d) =>
    typeof d.toObject === 'function' ? d.toObject() : JSON.parse(JSON.stringify(d))
  );
}

/**
 * Rule 1: slow_pace
 * - Pace set to 'relaxed'.
 * - At most 2 'place' activities per day.
 * - Keeps already done items, then curated before osm, then earlier in the day.
 * - Removed ones listed in changes with reason "To slow the pace".
 * - Meals, transit, rest untouched.
 * - Never removes done items.
 *
 * @param {Array<Object>} rawDays
 * @returns {{ days: Array<Object>, changes: Array<Object>, summary: string, newPace: string }}
 */
export function slowPace(rawDays) {
  const days = cloneDays(rawDays);
  const changes = [];

  for (const day of days) {
    const activities = Array.isArray(day.activities) ? day.activities : [];
    const placeIndices = [];
    const nonPlaceIndices = [];

    activities.forEach((act, idx) => {
      if (isPlaceActivity(act)) {
        placeIndices.push({ act, idx });
      } else {
        nonPlaceIndices.push({ act, idx });
      }
    });

    if (placeIndices.length <= 2) {
      continue;
    }

    const donePlaces = placeIndices.filter((p) => isActivityDone(p.act));
    const nonDonePlaces = placeIndices.filter((p) => !isActivityDone(p.act));

    const keptPlaceIndices = new Set();
    // 1. All done items MUST be kept
    donePlaces.forEach((p) => keptPlaceIndices.add(p.idx));

    // 2. How many additional non-done places can we keep?
    const remainingSlots = Math.max(0, 2 - donePlaces.length);

    if (remainingSlots > 0 && nonDonePlaces.length > 0) {
      // Prioritize: curated before OSM, then earlier in the day (lower original idx)
      const sortedNonDone = nonDonePlaces.slice().sort((a, b) => {
        const aCurated = isCuratedPlace(a.act);
        const bCurated = isCuratedPlace(b.act);
        if (aCurated && !bCurated) return -1;
        if (!aCurated && bCurated) return 1;
        return a.idx - b.idx;
      });

      const toKeep = sortedNonDone.slice(0, remainingSlots);
      toKeep.forEach((p) => keptPlaceIndices.add(p.idx));
    }

    // Identify removals
    const newActivities = [];
    activities.forEach((act, idx) => {
      if (!isPlaceActivity(act)) {
        // Meals, transit, rest untouched
        newActivities.push(act);
      } else if (keptPlaceIndices.has(idx)) {
        newActivities.push(act);
      } else {
        changes.push({
          type: 'removed',
          day: day.dayNumber,
          before: act.title || act.name || 'Place activity',
          reason: 'To slow the pace',
        });
      }
    });

    day.activities = newActivities;
  }

  const summary =
    changes.length > 0
      ? `Removed ${changes.length} ${changes.length === 1 ? 'place' : 'places'} to slow the pace (max 2 per day)`
      : 'Itinerary is already at a relaxed pace (max 2 places per day)';

  return {
    days,
    changes,
    summary,
    newPace: 'relaxed',
  };
}

/**
 * Rule 2: reduce_transit
 * - Per day, reorder 'place' activities by nearest-neighbour using haversine distance
 *   from the first place of the day (or stay location if stored).
 * - Keep time-of-day slots in order (reassign slot labels in the original sequence).
 * - Metrics: straight-line km before -> after, labelled "straight-line distance, not driving time".
 * - If fewer than 2 located places in every day, throw 422 with "Needs places with saved locations".
 *
 * @param {Array<Object>} rawDays
 * @param {Object} [stayLocation]
 * @returns {{ days: Array<Object>, changes: Array<Object>, summary: string, metrics: Object }}
 */
export function reduceTransit(rawDays, stayLocation = null) {
  const days = cloneDays(rawDays);
  const changes = [];

  // Check if at least one day has >= 2 located places
  const hasDayWithTwoPlaces = days.some((day) => {
    const acts = Array.isArray(day.activities) ? day.activities : [];
    return acts.filter((a) => isPlaceActivity(a) && hasValidCoordinates(a)).length >= 2;
  });

  if (!hasDayWithTwoPlaces) {
    const err = new Error('Needs places with saved locations');
    err.statusCode = 422;
    throw err;
  }

  let totalBeforeKm = 0;
  let totalAfterKm = 0;

  for (const day of days) {
    const activities = Array.isArray(day.activities) ? day.activities : [];

    // Find all located place activities and their positions
    const placeEntries = [];
    activities.forEach((act, idx) => {
      if (isPlaceActivity(act) && hasValidCoordinates(act)) {
        placeEntries.push({ act, idx });
      }
    });

    if (placeEntries.length < 2) {
      continue;
    }

    // Calculate before distance for this day
    for (let i = 0; i < placeEntries.length - 1; i++) {
      const p1 = placeEntries[i].act.location;
      const p2 = placeEntries[i + 1].act.location;
      totalBeforeKm += haversineKm(p1.lat, p1.lon, p2.lat, p2.lon);
    }

    // Nearest neighbour reordering
    let ordered = [];
    const unvisited = placeEntries.map((p) => ({ ...p.act }));

    // Check if day has stay location with valid coordinates
    const dayStay =
      (day.stayLocation && Number.isFinite(day.stayLocation.lat) && day.stayLocation) ||
      (stayLocation && Number.isFinite(stayLocation.lat) && stayLocation) ||
      null;

    let currentLat;
    let currentLon;

    if (dayStay && Number.isFinite(dayStay.lat) && Number.isFinite(dayStay.lon)) {
      currentLat = dayStay.lat;
      currentLon = dayStay.lon;
    } else {
      // First place of the day is the starting anchor
      const first = unvisited.shift();
      ordered.push(first);
      currentLat = Number(first.location.lat != null ? first.location.lat : first.location.latitude);
      currentLon = Number(first.location.lon != null ? first.location.lon : first.location.longitude);
    }

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const uLoc = unvisited[i].location;
        const uLat = Number(uLoc.lat != null ? uLoc.lat : uLoc.latitude);
        const uLon = Number(uLoc.lon != null ? uLoc.lon : uLoc.longitude);
        const dist = haversineKm(currentLat, currentLon, uLat, uLon);

        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextPlace = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(nextPlace);
      currentLat = Number(nextPlace.location.lat != null ? nextPlace.location.lat : nextPlace.location.latitude);
      currentLon = Number(nextPlace.location.lon != null ? nextPlace.location.lon : nextPlace.location.longitude);
    }

    // Calculate after distance for this day
    for (let i = 0; i < ordered.length - 1; i++) {
      const p1 = ordered[i].location;
      const p2 = ordered[i + 1].location;
      totalAfterKm += haversineKm(p1.lat, p1.lon, p2.lat, p2.lon);
    }

    // Original slots sequence
    const originalSlots = placeEntries.map((pe) => ({
      timeOfDay: pe.act.timeOfDay,
      suggestedTime: pe.act.suggestedTime,
      time: pe.act.time,
    }));

    // Put reordered places back into original place slots
    placeEntries.forEach((pe, k) => {
      const newPlace = ordered[k];
      const slot = originalSlots[k];

      const beforeTitle = pe.act.title || pe.act.name || `Stop ${k + 1}`;
      const afterTitle = newPlace.title || newPlace.name || `Stop ${k + 1}`;

      if (pe.act.id !== newPlace.id || pe.act.title !== newPlace.title) {
        changes.push({
          type: 'moved',
          day: day.dayNumber,
          before: beforeTitle,
          after: afterTitle,
          reason: 'Reordered to minimize travel distance',
        });
      }

      // Reassign slot labels in the original sequence
      activities[pe.idx] = {
        ...newPlace,
        timeOfDay: slot.timeOfDay,
        suggestedTime: slot.suggestedTime,
        time: slot.time,
      };
    });

    day.activities = activities;
  }

  const beforeKm = Math.round(totalBeforeKm * 10) / 10;
  const afterKm = Math.round(totalAfterKm * 10) / 10;

  const metrics = {
    beforeKm,
    afterKm,
    label: 'straight-line distance, not driving time',
  };

  const summary =
    afterKm < beforeKm
      ? `Reduced straight-line travel from ${beforeKm} km to ${afterKm} km`
      : `Route is already optimized for minimal transit (${afterKm} km)`;

  return {
    days,
    changes,
    summary,
    metrics,
  };
}

/**
 * Rule 3: surprise_me
 * - Add ONE unused candidate (never already in the itinerary) with valid coordinates
 *   to the day with the fewest 'place' activities.
 * - Seeded random choice (seed returned and reused on apply).
 * - Time-of-day = first free slot.
 * - Title and description only from the candidate record; labelled "Surprise pick".
 * - If no unused candidate exists, throw 422 "No more verified places to suggest".
 *
 * @param {Array<Object>} rawDays
 * @param {Array<Object>} candidates
 * @param {number|string} [seed]
 * @returns {{ days: Array<Object>, changes: Array<Object>, summary: string, seed: number }}
 */
export function surpriseMe(rawDays, candidates = [], seed) {
  const days = cloneDays(rawDays);
  const rng = createRng(seed);

  // Collect all existing activity titles and ids
  const existingNames = new Set();
  const existingIds = new Set();

  for (const day of days) {
    const acts = Array.isArray(day.activities) ? day.activities : [];
    for (const act of acts) {
      const title = (act.title || act.name || '').toLowerCase().trim();
      if (title) existingNames.add(title);

      const placeName = (act.location?.placeName || '').toLowerCase().trim();
      if (placeName) existingNames.add(placeName);

      if (act.placeId) existingIds.add(String(act.placeId).trim());
      if (act.placeRef) existingIds.add(String(act.placeRef).trim());
      if (act.id) existingIds.add(String(act.id).trim());
    }
  }

  // Filter unused candidates with valid coordinates
  const unused = (candidates || []).filter((c) => {
    if (!c || !c.name) return false;
    const lat = Number(c.lat);
    const lon = Number(c.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;

    const normName = c.name.toLowerCase().trim();
    if (existingNames.has(normName)) return false;

    const cId = c.id != null ? String(c.id).trim() : '';
    if (cId && existingIds.has(cId)) return false;

    return true;
  });

  if (unused.length === 0) {
    const err = new Error('No more verified places to suggest');
    err.statusCode = 422;
    throw err;
  }

  // Pick one unused candidate deterministically using RNG
  const pickIndex = Math.floor(rng.next() * unused.length);
  const chosen = unused[pickIndex];

  // Find day with fewest 'place' activities (tie-breaker: lowest dayNumber)
  let targetDay = days[0];
  let minPlaceCount = Infinity;

  for (const day of days) {
    const acts = Array.isArray(day.activities) ? day.activities : [];
    const placeCount = acts.filter(isPlaceActivity).length;
    if (placeCount < minPlaceCount) {
      minPlaceCount = placeCount;
      targetDay = day;
    }
  }

  // Find first free slot on target day
  const targetActs = Array.isArray(targetDay.activities) ? targetDay.activities : [];
  const takenSlots = new Set(
    targetActs
      .map((a) => (a.timeOfDay || a.suggestedTime || '').toLowerCase().trim())
      .filter(Boolean)
  );

  const slotSequence = ['Morning', 'Afternoon', 'Evening'];
  let freeSlot = slotSequence.find((slot) => !takenSlots.has(slot.toLowerCase()));
  if (!freeSlot) {
    freeSlot = 'Afternoon';
  }

  // Construct new activity with title and description only from candidate record
  const newActivity = {
    id: `surprise-${chosen.id || Date.now()}`,
    title: chosen.name.trim(),
    name: chosen.name.trim(),
    description: chosen.note || chosen.type || 'Surprise pick',
    timeOfDay: freeSlot,
    suggestedTime: freeSlot,
    kind: 'place',
    placeRef: chosen.id ? String(chosen.id).trim() : null,
    placeId: chosen.id ? String(chosen.id).trim() : null,
    location: {
      lat: Number(chosen.lat),
      lon: Number(chosen.lon),
      placeName: chosen.name.trim(),
    },
    note: 'Surprise pick',
    cost: 0,
    done: false,
  };

  // Insert in appropriate time slot position
  const slotOrderMap = { morning: 1, afternoon: 2, evening: 3, night: 4 };
  const targetSlotOrder = slotOrderMap[freeSlot.toLowerCase()] || 2;

  let insertIdx = targetActs.length;
  for (let i = 0; i < targetActs.length; i++) {
    const actSlot = (targetActs[i].timeOfDay || targetActs[i].suggestedTime || '').toLowerCase();
    const actOrder = slotOrderMap[actSlot] || 2;
    if (actOrder > targetSlotOrder) {
      insertIdx = i;
      break;
    }
  }

  targetActs.splice(insertIdx, 0, newActivity);
  targetDay.activities = targetActs;

  const changes = [
    {
      type: 'added',
      day: targetDay.dayNumber,
      after: chosen.name.trim(),
      reason: 'Surprise pick',
    },
  ];

  const summary = `Added ${chosen.name.trim()} as a surprise pick on Day ${targetDay.dayNumber}`;

  return {
    days,
    changes,
    summary,
    seed: rng.seed,
  };
}

/**
 * Previews an itinerary adjustment. Does NOT perform any writes.
 *
 * @param {Object} itinerary - Itinerary Mongoose document or plain object
 * @param {'slow_pace'|'reduce_transit'|'surprise_me'} action
 * @param {Object} [options]
 * @param {number|string} [options.seed]
 * @param {Array<Object>} [options.candidates]
 * @returns {Promise<{ baseHash: string, seed?: number, changes: Array<Object>, summary: string, metrics?: Object }>}
 */
export async function previewAdjust(itinerary, action, options = {}) {
  const baseHash = computeBaseHash(itinerary);

  if (action === 'slow_pace') {
    const result = slowPace(itinerary.days);
    return {
      baseHash,
      changes: result.changes,
      summary: result.summary,
    };
  }

  if (action === 'reduce_transit') {
    const result = reduceTransit(itinerary.days, itinerary.destinationCoordinates);
    return {
      baseHash,
      changes: result.changes,
      summary: result.summary,
      metrics: result.metrics,
    };
  }

  if (action === 'surprise_me') {
    const candidates = options.candidates || [];
    const result = surpriseMe(itinerary.days, candidates, options.seed);
    return {
      baseHash,
      seed: result.seed,
      changes: result.changes,
      summary: result.summary,
    };
  }

  const err = new Error(`Unsupported action: ${action}`);
  err.statusCode = 400;
  throw err;
}

/**
 * Recomputes the adjustment on the server side from action and seed.
 *
 * @param {Object} itinerary - Itinerary document
 * @param {'slow_pace'|'reduce_transit'|'surprise_me'} action
 * @param {Object} [options]
 * @param {number|string} [options.seed]
 * @param {Array<Object>} [options.candidates]
 * @returns {Promise<{ newDays: Array<Object>, changes: Array<Object>, summary: string, metrics?: Object, newPace?: string }>}
 */
export async function executeAdjust(itinerary, action, options = {}) {
  if (action === 'slow_pace') {
    const result = slowPace(itinerary.days);
    return {
      newDays: result.days,
      changes: result.changes,
      summary: result.summary,
      newPace: result.newPace,
    };
  }

  if (action === 'reduce_transit') {
    const result = reduceTransit(itinerary.days, itinerary.destinationCoordinates);
    return {
      newDays: result.days,
      changes: result.changes,
      summary: result.summary,
      metrics: result.metrics,
    };
  }

  if (action === 'surprise_me') {
    const candidates = options.candidates || [];
    const result = surpriseMe(itinerary.days, candidates, options.seed);
    return {
      newDays: result.days,
      changes: result.changes,
      summary: result.summary,
      seed: result.seed,
    };
  }

  const err = new Error(`Unsupported action: ${action}`);
  err.statusCode = 400;
  throw err;
}

export default {
  haversineKm,
  computeBaseHash,
  createRng,
  isActivityDone,
  isPlaceActivity,
  isCuratedPlace,
  hasValidCoordinates,
  slowPace,
  reduceTransit,
  surpriseMe,
  previewAdjust,
  executeAdjust,
};
