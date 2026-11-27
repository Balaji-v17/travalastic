import type { Journey } from '../data/mockData.ts';
import { normalizeDateString } from './tripStatus.ts';

export const DUPLICATE_NOTICE_DISMISS_KEY = 'travalastic_dismiss_duplicates_notice_v1';

export interface TripExtrasCount {
  expensesCount?: number | null;
}

export interface TripSummaryMetrics {
  itemsCount: number;
  doneCount: number;
  editCount: number;
  flightBookingsCount: number;
  recordedBookingsCount: number;
  hasAnyBooking: boolean;
  hasConfirmedDuffelBooking: boolean;
  expensesCount: number | null;
  chatMessagesCount: number | null;
}

export interface DuplicateTripGroup {
  key: string;
  kind: 'exact' | 'similar';
  destination: string;
  startDate: string;
  endDate: string;
  trips: Journey[];
  mostCompleteTripId: string | null;
}

export interface DuplicateGroupingResult {
  exactGroups: DuplicateTripGroup[];
  similarGroups: DuplicateTripGroup[];
  totalSets: number;
}

export interface KeepSelectionValidation {
  valid: boolean;
  reason?: string;
  keptTrips: Journey[];
  deleteTrips: Journey[];
}

export interface DeletionConfirmationRequirements {
  requiresAckCannotUndo: boolean;
  requiresExtraBookingConfirm: boolean;
  duffelBookedTrips: Journey[];
  recordedBookedTrips: Journey[];
}

export interface SequentialDeleteItemResult {
  id: string;
  title: string;
  ok: boolean;
  error?: string;
}

export interface SequentialDeleteOutcome {
  results: SequentialDeleteItemResult[];
  succeededIds: string[];
  failedItems: SequentialDeleteItemResult[];
}

/**
 * Normalizes a trip destination for duplicate grouping (trimmed, lowercased, collapsed whitespace).
 */
export function normalizeDuplicateDestination(destination?: string | null): string {
  return (destination || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks if two YYYY-MM-DD date intervals overlap using string-only comparisons.
 * Never parses date strings into Date instances.
 */
export function datesOverlap(
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null
): boolean {
  const a1 = normalizeDateString(startA);
  const a2 = normalizeDateString(endA);
  const b1 = normalizeDateString(startB);
  const b2 = normalizeDateString(endB);
  if (!a1 || !a2 || !b1 || !b2) return false;
  if (a1 > a2 || b1 > b2) return false;
  return a1 <= b2 && b1 <= a2;
}

/**
 * Extracts real summary counts from a Journey (plus optional fetched extras).
 * Counts that cannot be obtained from existing endpoints stay `null` ("unknown").
 */
export function getTripSummaryMetrics(
  journey: Journey,
  extras?: TripExtrasCount | null
): TripSummaryMetrics {
  const days = Array.isArray(journey.itinerary) ? journey.itinerary : [];
  let itemsCount = 0;
  let doneCount = 0;
  for (const day of days) {
    const acts = Array.isArray(day.activities) ? day.activities : [];
    itemsCount += acts.length;
    for (const act of acts) {
      if (act && act.done === true) doneCount += 1;
    }
  }

  const editCount =
    typeof journey.editCount === 'number' && journey.editCount > 0 ? journey.editCount : 0;

  const flightBookingsCount =
    typeof journey.flightBookingsCount === 'number'
      ? Math.max(0, journey.flightBookingsCount)
      : Array.isArray(journey.bookings)
      ? journey.bookings.length
      : 0;

  const recordedBookingsCount =
    typeof journey.recordedBookingsCount === 'number'
      ? Math.max(0, journey.recordedBookingsCount)
      : 0;

  const expensesCount =
    extras && typeof extras.expensesCount === 'number' ? Math.max(0, extras.expensesCount) : null;

  return {
    itemsCount,
    doneCount,
    editCount,
    flightBookingsCount,
    recordedBookingsCount,
    hasAnyBooking: flightBookingsCount > 0 || recordedBookingsCount > 0,
    hasConfirmedDuffelBooking: flightBookingsCount > 0,
    expensesCount,
    // Backend has no existing endpoint exposing per-trip chat message counts.
    chatMessagesCount: null,
  };
}

/**
 * Computes a deterministic completeness score favoring more itinerary items, done marks, and edits.
 */
export function scoreTripCompleteness(
  journey: Journey,
  extras?: TripExtrasCount | null
): number {
  const m = getTripSummaryMetrics(journey, extras);
  return m.itemsCount * 10 + m.doneCount * 5 + m.editCount * 8 + (m.flightBookingsCount + m.recordedBookingsCount) * 15;
}

/**
 * Picks the single "Most complete" suggested trip ID in a group (pure suggestion; nothing is preselected for deletion).
 * Returns `null` when every trip in the group has zero items, edits, done marks, and bookings.
 */
export function pickMostCompleteTripId(
  trips: Journey[],
  extrasByTripId?: Record<string, TripExtrasCount | undefined>
): string | null {
  if (!Array.isArray(trips) || trips.length === 0) return null;

  let bestTrip: Journey | null = null;
  let bestScore = 0;
  let bestMetrics: TripSummaryMetrics | null = null;

  for (const trip of trips) {
    const extras = extrasByTripId ? extrasByTripId[trip.id] : undefined;
    const metrics = getTripSummaryMetrics(trip, extras);
    const score = scoreTripCompleteness(trip, extras);
    if (score <= 0) continue;

    if (!bestTrip || score > bestScore) {
      bestTrip = trip;
      bestScore = score;
      bestMetrics = metrics;
      continue;
    }

    if (score === bestScore && bestMetrics) {
      if (
        metrics.itemsCount > bestMetrics.itemsCount ||
        (metrics.itemsCount === bestMetrics.itemsCount && metrics.editCount > bestMetrics.editCount) ||
        (metrics.itemsCount === bestMetrics.itemsCount &&
          metrics.editCount === bestMetrics.editCount &&
          String(trip.createdAt || '') > String(bestTrip.createdAt || ''))
      ) {
        bestTrip = trip;
        bestScore = score;
        bestMetrics = metrics;
      }
    }
  }

  return bestTrip ? bestTrip.id : null;
}

/**
 * Pure grouping function:
 * - `exactGroups`: same normalized destination + identical YYYY-MM-DD start and end dates (`list.length > 1`)
 * - `similarGroups`: same normalized destination with overlapping (not solely identical) YYYY-MM-DD dates
 */
export function groupDuplicateTrips(
  journeys: Journey[],
  extrasByTripId?: Record<string, TripExtrasCount | undefined>
): DuplicateGroupingResult {
  const list = Array.isArray(journeys) ? journeys : [];

  const exactMap = new Map<string, Journey[]>();
  const byDest = new Map<string, Array<{ trip: Journey; start: string; end: string }>>();

  for (const j of list) {
    const norm = normalizeDuplicateDestination(j.destination);
    const start = normalizeDateString(j.startDate);
    const end = normalizeDateString(j.endDate);
    if (!norm || !start || !end) continue;

    const exactKey = `${norm}|${start}|${end}`;
    if (!exactMap.has(exactKey)) exactMap.set(exactKey, []);
    exactMap.get(exactKey)!.push(j);

    if (!byDest.has(norm)) byDest.set(norm, []);
    byDest.get(norm)!.push({ trip: j, start, end });
  }

  const exactGroups: DuplicateTripGroup[] = [];
  for (const [key, groupTrips] of exactMap.entries()) {
    if (groupTrips.length > 1) {
      exactGroups.push({
        key: `exact:${key}`,
        kind: 'exact',
        destination: groupTrips[0].destination,
        startDate: normalizeDateString(groupTrips[0].startDate),
        endDate: normalizeDateString(groupTrips[0].endDate),
        trips: groupTrips,
        mostCompleteTripId: pickMostCompleteTripId(groupTrips, extrasByTripId),
      });
    }
  }

  const similarGroups: DuplicateTripGroup[] = [];
  for (const [normDest, entries] of byDest.entries()) {
    if (entries.length < 2) continue;

    // Connected components under string-based interval overlap
    const visited = new Array(entries.length).fill(false);
    for (let i = 0; i < entries.length; i++) {
      if (visited[i]) continue;
      const queue = [i];
      visited[i] = true;
      const component: typeof entries = [];

      while (queue.length > 0) {
        const idx = queue.shift()!;
        const current = entries[idx];
        component.push(current);

        for (let k = 0; k < entries.length; k++) {
          if (visited[k]) continue;
          if (datesOverlap(current.start, current.end, entries[k].start, entries[k].end)) {
            visited[k] = true;
            queue.push(k);
          }
        }
      }

      if (component.length < 2) continue;

      const distinctDatePairs = new Set(component.map((c) => `${c.start}|${c.end}`));
      // Only include in "Similar trips" when date ranges actually differ (exact-only sets stay in exactGroups)
      if (distinctDatePairs.size < 2) continue;

      const trips = component.map((c) => c.trip);
      let minStart = component[0].start;
      let maxEnd = component[0].end;
      for (const c of component) {
        if (c.start < minStart) minStart = c.start;
        if (c.end > maxEnd) maxEnd = c.end;
      }

      similarGroups.push({
        key: `similar:${normDest}|${minStart}|${maxEnd}|${trips.map((t) => t.id).sort().join(',')}`,
        kind: 'similar',
        destination: component[0].trip.destination,
        startDate: minStart,
        endDate: maxEnd,
        trips,
        mostCompleteTripId: pickMostCompleteTripId(trips, extrasByTripId),
      });
    }
  }

  return {
    exactGroups,
    similarGroups,
    totalSets: exactGroups.length + similarGroups.length,
  };
}

/**
 * Validates that at least one trip in a group stays kept and at least one is targeted for deletion.
 */
export function validateGroupKeepSelection(
  groupTrips: Journey[],
  keepIds: ReadonlySet<string>
): KeepSelectionValidation {
  const keptTrips = groupTrips.filter((t) => keepIds.has(t.id));
  const deleteTrips = groupTrips.filter((t) => !keepIds.has(t.id));

  if (keptTrips.length < 1) {
    return {
      valid: false,
      reason: 'At least one trip must remain kept. You cannot delete all trips in a group.',
      keptTrips,
      deleteTrips,
    };
  }
  if (deleteTrips.length < 1) {
    return {
      valid: false,
      reason: 'Nothing is selected for deletion. Uncheck a duplicate you want to remove.',
      keptTrips,
      deleteTrips,
    };
  }
  return {
    valid: true,
    keptTrips,
    deleteTrips,
  };
}

/**
 * Determines booking warnings and confirmation checkboxes required for a deletion batch.
 */
export function getDeletionConfirmationRequirements(
  tripsToDelete: Journey[]
): DeletionConfirmationRequirements {
  const duffelBookedTrips: Journey[] = [];
  const recordedBookedTrips: Journey[] = [];

  for (const trip of tripsToDelete) {
    const metrics = getTripSummaryMetrics(trip);
    if (metrics.hasConfirmedDuffelBooking) duffelBookedTrips.push(trip);
    if (metrics.recordedBookingsCount > 0) recordedBookedTrips.push(trip);
  }

  return {
    requiresAckCannotUndo: true,
    requiresExtraBookingConfirm: duffelBookedTrips.length > 0,
    duffelBookedTrips,
    recordedBookedTrips,
  };
}

export function canConfirmPermanentDelete(
  acks: { ackCannotUndo: boolean; extraBookingConfirm: boolean },
  tripsToDelete: Journey[]
): boolean {
  if (!tripsToDelete || tripsToDelete.length === 0) return false;
  const reqs = getDeletionConfirmationRequirements(tripsToDelete);
  if (reqs.requiresAckCannotUndo && !acks.ackCannotUndo) return false;
  if (reqs.requiresExtraBookingConfirm && !acks.extraBookingConfirm) return false;
  return true;
}

/**
 * Deletes trips sequentially, collecting per-trip success or error without aborting earlier/later items.
 */
export async function deleteTripsSequentially(
  trips: Journey[],
  deleteById: (id: string) => Promise<void>
): Promise<SequentialDeleteOutcome> {
  const results: SequentialDeleteItemResult[] = [];
  const succeededIds: string[] = [];
  const failedItems: SequentialDeleteItemResult[] = [];

  for (const trip of trips) {
    const label = trip.title || trip.destination || trip.id;
    try {
      await deleteById(trip.id);
      const item: SequentialDeleteItemResult = { id: trip.id, title: label, ok: true };
      results.push(item);
      succeededIds.push(trip.id);
    } catch (err: any) {
      const item: SequentialDeleteItemResult = {
        id: trip.id,
        title: label,
        ok: false,
        error: err?.message || 'Delete failed',
      };
      results.push(item);
      failedItems.push(item);
    }
  }

  return { results, succeededIds, failedItems };
}

export function readDuplicateNoticeDismissed(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    if (!storage) return false;
    return storage.getItem(DUPLICATE_NOTICE_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeDuplicateNoticeDismissed(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  dismissed: boolean
): void {
  try {
    if (!storage) return;
    storage.setItem(DUPLICATE_NOTICE_DISMISS_KEY, dismissed ? '1' : '0');
  } catch {
    // Ignore storage restriction errors
  }
}
