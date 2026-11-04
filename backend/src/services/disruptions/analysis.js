/**
 * Pure analysis engine for flight disruptions.
 *
 * Rules:
 * - No network, DB, Duffel, or LLM calls.
 * - Airport-local times without timezone offset (Duffel specification).
 * - Named constants for delay thresholds.
 */

// Delay thresholds (minutes)
export const DELAY_THRESHOLD_MIN = 15; // Under 15 is ignored
export const DELAY_THRESHOLD_30_MAX = 44; // 15-44 -> 30 min option
export const DELAY_THRESHOLD_60_MAX = 89; // 45-89 -> 60 min option
export const DELAY_THRESHOLD_120_MAX = 149; // 90-149 -> 120 min option
export const DELAY_THRESHOLD_180_MIN = 150; // 150 or more -> 180 min option
export const DELAY_THRESHOLD_CAPPED = 180; // Over 180 is capped

export const DELAY_OPTIONS = [30, 60, 120, 180];

/**
 * Extracts normalized uppercase IATA / airport code from a string or airport object.
 *
 * @param {string|Object} location - Airport code or Duffel airport object
 * @returns {string|null} 3-letter IATA code or uppercase string
 */
export function extractAirportCode(location) {
  if (!location) return null;
  if (typeof location === 'string') return location.trim().toUpperCase();
  if (typeof location === 'object') {
    const code = location.iata_code || location.code || location.id;
    if (typeof code === 'string') return code.trim().toUpperCase();
  }
  return null;
}

/**
 * Parses an airport-local ISO string into epoch milliseconds in a timezone-independent manner.
 * Duffel returns airport-local timestamps without timezone offset (e.g. "2026-10-28T14:30:00").
 * Appending 'Z' evaluates them on a fixed UTC timeline, avoiding host environment DST or local timezone shifts.
 *
 * @param {string} isoStr - ISO datetime string
 * @returns {number|null} Milliseconds timestamp or null if invalid
 */
export function parseLocalIsoToMs(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const trimmed = isoStr.trim();
  if (!trimmed) return null;

  // If timezone offset or Z is explicitly present, parse as-is
  if (/[zZ]|([+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return isNaN(ms) ? null : ms;
  }

  // Airport-local: append Z to treat as fixed UTC timeline
  const ms = Date.parse(`${trimmed}Z`);
  return isNaN(ms) ? null : ms;
}

/**
 * Extracts YYYY-MM-DD date string from an ISO or date-like string.
 *
 * @param {string} dateStr
 * @returns {string|null} YYYY-MM-DD or null
 */
export function extractDatePart(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Compares old and new flight slice segments and computes delay and structural changes.
 *
 * @param {Array<Object>} oldSegments - Array of { departing_at, arriving_at, origin, destination }
 * @param {Array<Object>} newSegments - Array of { departing_at, arriving_at, origin, destination }
 * @returns {{ changed: boolean, structural: boolean, delayMinutes: number|null, departureShiftMinutes?: number|null }}
 */
export function computeFlightDelay(oldSegments, newSegments) {
  if (
    !Array.isArray(oldSegments) ||
    !Array.isArray(newSegments) ||
    oldSegments.length === 0 ||
    newSegments.length === 0
  ) {
    return {
      changed: true,
      structural: true,
      delayMinutes: null,
      departureShiftMinutes: null,
    };
  }

  // If segment counts differ, structural change (reroute / extra stop / cancellation)
  if (oldSegments.length !== newSegments.length) {
    return {
      changed: true,
      structural: true,
      delayMinutes: null,
      departureShiftMinutes: null,
    };
  }

  // Verify that all segment origin and destination airport codes match
  for (let i = 0; i < oldSegments.length; i++) {
    const oldOrigin = extractAirportCode(oldSegments[i]?.origin);
    const newOrigin = extractAirportCode(newSegments[i]?.origin);
    const oldDest = extractAirportCode(oldSegments[i]?.destination);
    const newDest = extractAirportCode(newSegments[i]?.destination);

    if (!oldOrigin || !newOrigin || oldOrigin !== newOrigin || !oldDest || !newDest || oldDest !== newDest) {
      return {
        changed: true,
        structural: true,
        delayMinutes: null,
        departureShiftMinutes: null,
      };
    }
  }

  // Compare first departing_at and last arriving_at
  const oldFirstDepart = oldSegments[0]?.departing_at;
  const newFirstDepart = newSegments[0]?.departing_at;
  const oldLastArrive = oldSegments[oldSegments.length - 1]?.arriving_at;
  const newLastArrive = newSegments[newSegments.length - 1]?.arriving_at;

  const oldDepartMs = parseLocalIsoToMs(oldFirstDepart);
  const newDepartMs = parseLocalIsoToMs(newFirstDepart);
  const oldArriveMs = parseLocalIsoToMs(oldLastArrive);
  const newArriveMs = parseLocalIsoToMs(newLastArrive);

  if (oldArriveMs == null || newArriveMs == null || oldDepartMs == null || newDepartMs == null) {
    return {
      changed: true,
      structural: true,
      delayMinutes: null,
      departureShiftMinutes: null,
    };
  }

  const delayMinutes = Math.round((newArriveMs - oldArriveMs) / 60000);
  const departureShiftMinutes = Math.round((newDepartMs - oldDepartMs) / 60000);
  const changed = delayMinutes !== 0 || departureShiftMinutes !== 0;

  return {
    changed,
    structural: false,
    delayMinutes,
    departureShiftMinutes,
  };
}

/**
 * Maps a flight delay in minutes to one of the rescheduling preview delay options (30, 60, 120, 180).
 * - Under 15: returns null (ignore)
 * - 15 - 44: returns { option: 30, capped: false }
 * - 45 - 89: returns { option: 60, capped: false }
 * - 90 - 149: returns { option: 120, capped: false }
 * - 150 or more: returns { option: 180, capped: delayMinutes > 180 }
 *
 * @param {number} delayMinutes
 * @returns {{ option: number, capped: boolean }|null}
 */
export function mapDelayToOption(delayMinutes) {
  if (
    delayMinutes == null ||
    typeof delayMinutes !== 'number' ||
    isNaN(delayMinutes) ||
    delayMinutes < DELAY_THRESHOLD_MIN
  ) {
    return null;
  }

  if (delayMinutes <= DELAY_THRESHOLD_30_MAX) {
    return { option: 30, capped: false };
  }

  if (delayMinutes <= DELAY_THRESHOLD_60_MAX) {
    return { option: 60, capped: false };
  }

  if (delayMinutes <= DELAY_THRESHOLD_120_MAX) {
    return { option: 120, capped: false };
  }

  return {
    option: 180,
    capped: delayMinutes > DELAY_THRESHOLD_CAPPED,
  };
}

/**
 * Uses the date part of the arrival string and date-only arithmetic against the itinerary start date
 * to determine which itinerary day is affected.
 *
 * @param {Object} itinerary - Itinerary document or object with startDate, endDate, days
 * @param {string} newArrival - Arrival ISO string
 * @returns {number|null} 1-indexed dayNumber, or null if outside trip dates
 */
export function findAffectedDay(itinerary, newArrival) {
  const arrivalDateStr = extractDatePart(newArrival);
  const startDateStr = extractDatePart(itinerary?.startDate);

  if (!arrivalDateStr || !startDateStr) {
    return null;
  }

  const [aY, aM, aD] = arrivalDateStr.split('-').map(Number);
  const [sY, sM, sD] = startDateStr.split('-').map(Number);

  const arrivalUtc = Date.UTC(aY, aM - 1, aD);
  const startUtc = Date.UTC(sY, sM - 1, sD);

  const diffDays = Math.round((arrivalUtc - startUtc) / (1000 * 60 * 60 * 24));
  const dayNumber = diffDays + 1;

  if (dayNumber < 1) {
    return null;
  }

  // Verify against endDate if present
  const endDateStr = extractDatePart(itinerary?.endDate);
  if (endDateStr) {
    const [eY, eM, eD] = endDateStr.split('-').map(Number);
    const endUtc = Date.UTC(eY, eM - 1, eD);
    if (arrivalUtc > endUtc) {
      return null;
    }
  }

  // Verify against itinerary days array if present
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  if (days.length > 0) {
    const dayExists = days.some((d) => d?.dayNumber === dayNumber);
    if (!dayExists) {
      return null;
    }
  }

  return dayNumber;
}

/**
 * Classifies a disruption and determines whether an automated rescheduling preview can be triggered.
 *
 * @param {Object} itinerary - Itinerary document or object
 * @param {Object} delayInfo - Result from computeFlightDelay: { changed, structural, delayMinutes }
 * @param {string} newArrival - New arrival datetime string
 * @returns {{ actionable: boolean, reason: string|null, dayNumber: number|null, option: number|null, capped: boolean }}
 */
export function classifyDisruption(itinerary, delayInfo, newArrival) {
  // 1. Structural change check
  if (!delayInfo || delayInfo.structural || delayInfo.delayMinutes == null) {
    return {
      actionable: false,
      reason: 'route changed; needs manual review',
      dayNumber: null,
      option: null,
      capped: false,
    };
  }

  // 2. Delay option mapping check
  const mappedOption = mapDelayToOption(delayInfo.delayMinutes);
  if (!mappedOption) {
    const affectedDay = findAffectedDay(itinerary, newArrival);
    return {
      actionable: false,
      reason: 'delay under 15 minutes',
      dayNumber: affectedDay,
      option: null,
      capped: false,
    };
  }

  // 3. Trip date boundary check
  const dayNumber = findAffectedDay(itinerary, newArrival);
  if (dayNumber == null) {
    return {
      actionable: false,
      reason: 'arrival outside trip dates',
      dayNumber: null,
      option: mappedOption.option,
      capped: mappedOption.capped,
    };
  }

  // 4. Activity status check (must have at least one undone activity on that day)
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const dayPlan = days.find((d) => d?.dayNumber === dayNumber);
  const activities = Array.isArray(dayPlan?.activities) ? dayPlan.activities : [];

  const hasUndoneActivity = activities.length > 0 && activities.some((act) => !act?.done);
  if (!hasUndoneActivity) {
    return {
      actionable: false,
      reason: 'nothing left to reschedule',
      dayNumber,
      option: mappedOption.option,
      capped: mappedOption.capped,
    };
  }

  // 5. Actionable disruption
  return {
    actionable: true,
    reason: null,
    dayNumber,
    option: mappedOption.option,
    capped: mappedOption.capped,
  };
}

/**
 * Deterministically constructs a deduplication key from an order ID and change ID.
 *
 * @param {string} orderId
 * @param {string} changeId
 * @returns {string} Formatted dedupe key
 */
export function buildDedupeKey(orderId, changeId) {
  const o = String(orderId || '').trim();
  const c = String(changeId || '').trim();
  return `${o}:${c}`;
}

export default {
  computeFlightDelay,
  mapDelayToOption,
  findAffectedDay,
  classifyDisruption,
  buildDedupeKey,
  extractAirportCode,
  parseLocalIsoToMs,
  extractDatePart,
  DELAY_THRESHOLD_MIN,
  DELAY_THRESHOLD_30_MAX,
  DELAY_THRESHOLD_60_MAX,
  DELAY_THRESHOLD_120_MAX,
  DELAY_THRESHOLD_180_MIN,
  DELAY_THRESHOLD_CAPPED,
  DELAY_OPTIONS,
};

