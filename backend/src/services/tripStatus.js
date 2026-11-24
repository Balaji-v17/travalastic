/**
 * Pure, erasable functions for calculating trip status and booking presence.
 * Uses local calendar days and date-only string comparisons (never parses Date objects with new Date(string)).
 */

/**
 * Checks if a trip has any confirmed booking.
 * Currently checks real flight bookings (Duffel orders).
 * Single place to extend later for hotel/cab/rental/train bookings.
 *
 * @param {Object} trip
 * @returns {boolean}
 */
export function tripHasBooking(trip) {
  if (!trip) return false;
  if (trip.hasBooking === true) return true;
  if (Array.isArray(trip.bookings) && trip.bookings.length > 0) return true;
  if (typeof trip.bookingsCount === 'number' && trip.bookingsCount > 0) return true;
  return false;
}

/**
 * Returns the current date as a YYYY-MM-DD string in local machine time.
 * Avoids toISOString() which shifts calendar days based on UTC offset.
 *
 * @param {Date} [d=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function getLocalDateString(d = new Date()) {
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
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {string} YYYY-MM-DD or empty string
 */
export function normalizeDateString(dateInput) {
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
 *
 * @param {Object} trip - Object with startDate, endDate, and optional bookings/hasBooking
 * @param {string|Date} [todayInput=getLocalDateString()] - Reference date (defaults to local today)
 * @returns {'planning'|'upcoming'|'in-progress'|'completed'|'past'}
 */
export function tripStatus(trip, todayInput = getLocalDateString()) {
  const start = normalizeDateString(trip?.startDate);
  const end = normalizeDateString(trip?.endDate);
  const today =
    typeof todayInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayInput.trim())
      ? todayInput.trim()
      : normalizeDateString(todayInput) || getLocalDateString();

  const hasBooking = tripHasBooking(trip);

  // Missing end date defaults to planning
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
    // today is between start and end inclusive, or start missing/today
    return 'in-progress';
  } else {
    if (end < today) {
      return 'past';
    }
    return 'planning';
  }
}

export default {
  tripHasBooking,
  getLocalDateString,
  normalizeDateString,
  tripStatus,
};

