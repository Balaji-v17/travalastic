/**
 * Pure, erasable TypeScript functions for calculating trip status and booking presence.
 * Uses local calendar days and date-only string comparisons (never parses Date objects with new Date(string)).
 */

export type TripStatus = 'planning' | 'upcoming' | 'in-progress' | 'completed' | 'past';

export interface TripLike {
  startDate?: string | null;
  endDate?: string | null;
  bookings?: Array<any> | null;
  bookingsCount?: number;
  hasBooking?: boolean;
}

/**
 * Checks if a trip has any confirmed booking.
 * Currently checks real flight bookings (Duffel orders).
 * Single place to extend later for hotel/cab/rental/train bookings.
 */
export function tripHasBooking(trip?: TripLike | null): boolean {
  if (!trip) return false;
  if (trip.hasBooking === true) return true;
  if (Array.isArray(trip.bookings) && trip.bookings.length > 0) return true;
  if (typeof trip.bookingsCount === 'number' && trip.bookingsCount > 0) return true;
  return false;
}

/**
 * Returns the current date as a YYYY-MM-DD string in local machine time.
 * Avoids toISOString() which shifts calendar days based on UTC offset.
 */
export function getLocalDateString(d: Date = new Date()): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    d = new Date();
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes input date to YYYY-MM-DD string without parsing Date strings into Date objects.
 */
export function normalizeDateString(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return getLocalDateString(dateInput);
  }
  return '';
}

/**
 * Pure function calculating trip status from date-only strings and booking presence.
 * - Planning: no confirmed booking AND end date is today or later.
 * - Upcoming: at least one confirmed booking AND start date is after today.
 * - In progress: at least one confirmed booking AND today is between start and end inclusive.
 * - Completed: at least one confirmed booking AND end date is before today.
 * - Past (not booked): no confirmed booking AND end date is before today.
 */
export function tripStatus(
  trip?: TripLike | null,
  todayInput: string | Date = getLocalDateString()
): TripStatus {
  const start = normalizeDateString(trip?.startDate);
  const end = normalizeDateString(trip?.endDate);
  const today =
    typeof todayInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayInput.trim())
      ? todayInput.trim()
      : normalizeDateString(todayInput) || getLocalDateString();

  const hasBooking = tripHasBooking(trip);

  if (!end) {
    return 'planning';
  }

  if (hasBooking) {
    if (end < today) {
      return 'completed';
    }
    if (start && start > today) {
      return 'upcoming';
    }
    return 'in-progress';
  } else {
    if (end < today) {
      return 'past';
    }
    return 'planning';
  }
}

export interface BookablePlanItem {
  id: string;
  title: string;
  type: 'hotel' | 'flight' | 'transfer';
  icon: string;
}

/**
 * Filters items that can actually be booked:
 * - Stays (from accommodationSuggestion or activities with type 'hotel' / kind 'stay')
 * - Transport legs (kind === 'transit' or type === 'flight' | 'transfer' | 'transport')
 * Strictly excludes places (sightseeing/temples/viewpoints), meals, and rest/free time.
 */
export function getBookablePlanItems(journey?: any): BookablePlanItem[] {
  const items: BookablePlanItem[] = [];
  const seenTitles = new Set<string>();

  for (const day of journey?.itinerary || []) {
    // 1. Stays from accommodationSuggestion (e.g. hotel/guesthouse stay recommendation)
    if (day.accommodationSuggestion && typeof day.accommodationSuggestion === 'string') {
      const trimmed = day.accommodationSuggestion.trim();
      if (trimmed && !seenTitles.has(trimmed.toLowerCase())) {
        seenTitles.add(trimmed.toLowerCase());
        items.push({
          id: `stay-${day.day}`,
          title: trimmed.startsWith('Stay:') ? trimmed : `Stay: ${trimmed}`,
          type: 'hotel',
          icon: '🏨',
        });
      }
    }

    // 2. Activities that are bookable: stays or transit/transfer/transport/flight
    for (const act of day.activities || []) {
      const rawKind = act.kind;
      const rawType = act.type;

      // Strictly exclude places, meals, rest/free time
      if (
        rawKind === 'place' ||
        rawKind === 'meal' ||
        rawKind === 'rest' ||
        rawType === 'meal' ||
        rawType === 'free' ||
        rawType === 'activity'
      ) {
        continue;
      }

      // Check if it qualifies as a stay or transport leg
      const isStay = rawType === 'hotel' || rawKind === 'stay';
      const isTransit =
        rawKind === 'transit' ||
        rawType === 'flight' ||
        rawType === 'transfer' ||
        rawType === 'transport';

      if ((isStay || isTransit) && act.status !== 'booked') {
        const titleKey = (act.title || '').toLowerCase().trim();
        if (titleKey && !seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          items.push({
            id: act.id,
            title: act.title,
            type: isStay ? 'hotel' : rawType === 'flight' ? 'flight' : 'transfer',
            icon: isStay ? '🏨' : rawType === 'flight' ? '✈' : '🚌',
          });
        }
      }
    }
  }

  return items;
}

export default tripStatus;
