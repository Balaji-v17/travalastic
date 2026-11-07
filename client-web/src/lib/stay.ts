/**
 * Pure, erasable stay helper functions for Travalastic hotel search & itinerary stay calculation.
 * Zero external dependencies; zero browser timezone shifting; zero logging of user parameters.
 */

export interface StayDates {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
}

export interface StayQuery {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
}

export interface StayValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  errorList: string[];
}

/**
 * Extracts numeric date parts { year, month, day } from a YYYY-MM-DD string.
 * Returns null if the format is invalid or parts are out of calendar range.
 */
export function parseDateParts(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Computes calendar day difference between two YYYY-MM-DD strings using UTC arithmetic
 * on the parsed numeric components. Never uses `new Date(string)` browser timezone parsing.
 */
export function calendarDayDifference(startDateStr: string, endDateStr: string): number | null {
  const p1 = parseDateParts(startDateStr);
  const p2 = parseDateParts(endDateStr);
  if (!p1 || !p2) return null;

  const ms1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const ms2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

/**
 * Derives hotel stay dates from an itinerary's real day dates:
 * - checkIn = first day's date (Day 1)
 * - checkOut = LAST day's date (Day N, the departure day)
 * - nights = difference in calendar days (for a 7-day trip, 6 nights).
 *
 * NOTE ON EARLIER MOBILE BUG:
 * Mobile previously suffered from an issue where Trip Hub prefilled a hardcoded 4-day window
 * (`checkin + 4`) for 7-day trips whenever endDate was unset or derived incorrectly.
 * This helper strictly computes the true stay bounds directly from the first and last itinerary
 * days: checkIn = Day 1 date, checkOut = Day N departure date.
 *
 * Returns null if days <= 1, or if dates are missing, malformed, or non-monotonic.
 */
export function tripStayDates(
  days: Array<{ date?: string } | string> | null | undefined
): StayDates | null {
  if (!Array.isArray(days) || days.length <= 1) {
    return null;
  }

  const rawDates: string[] = [];
  for (const d of days) {
    const str = typeof d === 'string' ? d.trim() : d?.date ? String(d.date).trim() : '';
    if (!str) return null;
    const parts = parseDateParts(str);
    if (!parts) return null;
    rawDates.push(str);
  }

  // Ensure dates are strictly monotonic: date[i] > date[i-1]
  for (let i = 1; i < rawDates.length; i++) {
    const prev = rawDates[i - 1];
    const curr = rawDates[i];
    const diff = calendarDayDifference(prev, curr);
    if (diff == null || diff <= 0) {
      return null;
    }
  }

  const checkIn = rawDates[0];
  const checkOut = rawDates[rawDates.length - 1];
  const nights = calendarDayDifference(checkIn, checkOut);

  if (nights == null || nights <= 0) {
    return null;
  }

  return {
    checkIn,
    checkOut,
    nights,
  };
}

/**
 * Validates hotel stay parameters.
 * - destination: required, non-empty after trim
 * - checkIn: required, valid YYYY-MM-DD, checkIn >= today
 * - checkOut: required, valid YYYY-MM-DD, checkOut > checkIn
 * - nights: <= maxNights (default 30)
 * - guests: 1 to 9
 * - rooms: 1 to 5, and rooms <= guests
 */
export function validateStay(
  query: StayQuery,
  todayStr?: string
): StayValidationResult {
  const errors: Record<string, string> = {};
  const errorList: string[] = [];

  const addError = (field: string, message: string) => {
    errors[field] = message;
    errorList.push(message);
  };

  // 1. Destination
  const dest = query.destination ? query.destination.trim() : '';
  if (!dest) {
    addError('destination', 'Please enter a destination to search hotels.');
  }

  // Determine reference today date
  let today = todayStr ? todayStr.trim() : '';
  if (!today || !parseDateParts(today)) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    today = `${y}-${m}-${day}`;
  }

  // 2. Check-in Date
  const cin = query.checkIn ? query.checkIn.trim() : '';
  const cinParts = parseDateParts(cin);
  if (!cin || !cinParts) {
    addError('checkIn', 'Please select a valid check-in date (YYYY-MM-DD).');
  } else {
    const cinDiff = calendarDayDifference(today, cin);
    if (cinDiff != null && cinDiff < 0) {
      addError('checkIn', 'Check-in date cannot be in the past.');
    }
  }

  // 3. Check-out Date
  const cout = query.checkOut ? query.checkOut.trim() : '';
  const coutParts = parseDateParts(cout);
  if (!cout || !coutParts) {
    addError('checkOut', 'Please select a valid check-out date (YYYY-MM-DD).');
  } else if (cin && cinParts) {
    const nights = calendarDayDifference(cin, cout);
    if (nights == null || nights <= 0) {
      addError('checkOut', 'Check-out date must be after check-in date.');
    } else if (nights > 30) {
      addError('nights', 'Stay duration cannot exceed 30 nights.');
    }
  }

  // 4. Guests (1-9)
  const guests = query.guests != null ? Number(query.guests) : 2;
  if (isNaN(guests) || !Number.isInteger(guests) || guests < 1 || guests > 9) {
    addError('guests', 'Number of guests must be between 1 and 9.');
  }

  // 5. Rooms (1-5, and rooms <= guests)
  const rooms = query.rooms != null ? Number(query.rooms) : 1;
  if (isNaN(rooms) || !Number.isInteger(rooms) || rooms < 1 || rooms > 5) {
    addError('rooms', 'Number of rooms must be between 1 and 5.');
  } else if (!isNaN(guests) && rooms > guests) {
    addError('rooms', 'Number of rooms cannot exceed the number of guests.');
  }

  return {
    ok: errorList.length === 0,
    errors,
    errorList,
  };
}

/**
 * Builds a Booking.com search URL using standard URL & URLSearchParams encoding.
 * Never includes user identity, authentication tokens, cookies, or tracking headers.
 */
export function buildBookingUrl(params: {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  aid?: string;
  hotelName?: string;
  baseUrl?: string;
}): string {
  const base = params.baseUrl || 'https://www.booking.com/searchresults.html';
  const url = new URL(base);

  // Affiliate ID
  if (params.aid && typeof params.aid === 'string' && params.aid.trim()) {
    url.searchParams.set('aid', params.aid.trim());
  }

  // Search string (ss): destination, optionally prefixed with hotel name
  let searchStr = params.hotelName ? `${params.hotelName.trim()}, ${params.destination.trim()}` : params.destination.trim();
  // Truncate overly long destinations to 100 chars to avoid URL overflow
  if (searchStr.length > 100) {
    searchStr = searchStr.slice(0, 100).trim();
  }
  url.searchParams.set('ss', searchStr);

  // Dates
  if (params.checkIn && parseDateParts(params.checkIn)) {
    url.searchParams.set('checkin', params.checkIn.trim());
  }
  if (params.checkOut && parseDateParts(params.checkOut)) {
    url.searchParams.set('checkout', params.checkOut.trim());
  }

  // Guests & Rooms (Booking.com standard parameters)
  if (params.guests && params.guests > 0) {
    url.searchParams.set('group_adults', String(params.guests));
  }
  if (params.rooms && params.rooms > 0) {
    url.searchParams.set('no_rooms', String(params.rooms));
  }

  return url.toString();
}

/**
 * Checks if a given booking URL contains a non-empty affiliate ID (`aid`).
 */
export function isAffiliateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const aid = parsed.searchParams.get('aid');
    return Boolean(aid && aid.trim().length > 0);
  } catch {
    return false;
  }
}

