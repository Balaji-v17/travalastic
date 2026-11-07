import {
  formatLocalTime,
  formatDateLabel,
  parseIsoDuration,
  formatDuration,
  formatMoney,
} from './flightAdapter.ts';
export { formatDateLabel };
import { FLIGHTS_TEST_MODE } from '../config/features.ts';
import type { RawBooking } from './bookingsApi.ts';

export type StatusTone = 'success' | 'danger' | 'neutral';

export interface BookingView {
  id: string;
  reference: string;
  orderId: string | null;
  offerId: string | null;
  status: string;
  statusLabel: string;
  statusTone: StatusTone;
  route: {
    origin: string;
    destination: string;
    originName?: string;
    destinationName?: string;
  };
  departureTime: string | null;
  arrivalTime: string | null;
  departureDate: string | null;
  rawDepartureTime: string | null;
  rawArrivalTime: string | null;
  carrier: string;
  flightNumbers: string[];
  duration: string | null;
  durationMinutes: number | null;
  totalAmount: string;
  currency: string;
  formattedTotal: string;
  createdAt: string;
  passengerNames: string[];
  itineraryId: string | null;
  isTest: boolean;
}

/**
 * Maps raw backend/Duffel status to human-readable label and visual tone.
 * Real Duffel statuses:
 * - 'confirmed': order confirmed with airline
 * - 'cancelled': order cancelled
 * Unknown values are title-cased with a neutral badge (never an invented meaning).
 */
export function mapBookingStatus(rawStatus?: string | null): {
  label: string;
  tone: StatusTone;
} {
  if (!rawStatus || typeof rawStatus !== 'string') {
    return { label: 'Confirmed', tone: 'success' };
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'confirmed') {
    return { label: 'Confirmed', tone: 'success' };
  }
  if (normalized === 'cancelled') {
    return { label: 'Cancelled', tone: 'danger' };
  }

  // Unknown status fallback: title-case with neutral tone
  const words = normalized.replace(/[-_]/g, ' ').split(/\s+/);
  const titleCased = words
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');

  return { label: titleCased || 'Unknown', tone: 'neutral' };
}

/**
 * Extracts YYYY-MM-DD from an ISO string using pure string manipulation,
 * avoiding any UTC/local timezone shifts caused by `new Date()`.
 */
export function extractLocalDatePart(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Converts a raw backend Booking document into a clean, typed BookingView.
 * Strict privacy guarantee:
 * - Includes traveler names ONLY.
 * - NEVER extracts or exposes dates of birth, phone numbers, email addresses, or document IDs.
 */
export function toBookingView(raw: RawBooking): BookingView {
  const id = String(raw._id || raw.id || '');
  const reference = raw.bookingReference ? String(raw.bookingReference).trim() : '';
  const orderId = raw.orderId ? String(raw.orderId).trim() : null;
  const offerId = raw.offerId ? String(raw.offerId).trim() : null;
  const rawStatus = raw.status ? String(raw.status).trim() : 'confirmed';
  const { label: statusLabel, tone: statusTone } = mapBookingStatus(rawStatus);

  const rawDep = raw.departureTime ? String(raw.departureTime).trim() : null;
  const rawArr = raw.arrivalTime ? String(raw.arrivalTime).trim() : null;

  const departureTime = formatLocalTime(rawDep);
  const arrivalTime = formatLocalTime(rawArr);
  const departureDate = formatDateLabel(rawDep) || null;

  // Extract flight numbers and airport names if slices are stored
  const flightNumbers: string[] = [];
  let originName: string | undefined;
  let destinationName: string | undefined;

  if (Array.isArray(raw.slices)) {
    for (const slice of raw.slices) {
      if (Array.isArray(slice.segments)) {
        for (const seg of slice.segments) {
          const fn =
            seg.flight_number ||
            seg.flightNumber ||
            (seg.marketing_carrier_flight_number ? String(seg.marketing_carrier_flight_number) : '');
          if (fn && !flightNumbers.includes(fn)) {
            flightNumbers.push(fn);
          }
          if (!originName && seg.origin?.name) {
            originName = seg.origin.name;
          }
          if (seg.destination?.name) {
            destinationName = seg.destination.name;
          }
        }
      }
    }
  }

  // Extract traveler names ONLY (never DOB, contact, or documents)
  const names: string[] = [];
  if (Array.isArray(raw.passengerNames) && raw.passengerNames.length > 0) {
    for (const n of raw.passengerNames) {
      if (typeof n === 'string' && n.trim()) {
        names.push(n.trim());
      }
    }
  } else if (Array.isArray(raw.passengers) && raw.passengers.length > 0) {
    for (const p of raw.passengers) {
      const combined =
        p.name || `${p.givenName || ''} ${p.familyName || ''}`.trim();
      if (combined && !names.includes(combined)) {
        names.push(combined);
      }
    }
  }

  const durationMinutes = parseIsoDuration(raw.duration);
  const duration = durationMinutes != null ? formatDuration(durationMinutes) : raw.duration || null;

  const totalAmount = raw.totalAmount != null ? String(raw.totalAmount) : '0';
  const currency = raw.currency ? raw.currency.trim().toUpperCase() : 'USD';
  const formattedTotal = formatMoney(totalAmount, currency);

  const itineraryId = raw.itineraryId ? String(raw.itineraryId).trim() : null;

  // Determine if booking is flagged test
  const isTest =
    (raw as any).isTest === true ||
    raw.rawOrder?.live_mode === false ||
    (raw.rawOrder?.live_mode === undefined && FLIGHTS_TEST_MODE);

  return {
    id,
    reference,
    orderId,
    offerId,
    status: rawStatus,
    statusLabel,
    statusTone,
    route: {
      origin: raw.origin ? raw.origin.trim().toUpperCase() : '',
      destination: raw.destination ? raw.destination.trim().toUpperCase() : '',
      originName,
      destinationName,
    },
    departureTime,
    arrivalTime,
    departureDate,
    rawDepartureTime: rawDep,
    rawArrivalTime: rawArr,
    carrier: raw.airline ? raw.airline.trim() : 'Commercial Airline',
    flightNumbers,
    duration,
    durationMinutes,
    totalAmount,
    currency,
    formattedTotal,
    createdAt: raw.createdAt ? String(raw.createdAt).trim() : '',
    passengerNames: names,
    itineraryId,
    isTest,
  };
}

/**
 * Checks whether a booking is upcoming based strictly on the calendar date (YYYY-MM-DD),
 * without `new Date()` timezone conversions.
 * - departure date >= today -> upcoming
 * - departure date < today -> completed/past
 * - missing/null departure date -> false (neither upcoming nor completed; shown under "All" only).
 */
export function isUpcoming(
  departureDateStr: string | null | undefined,
  todayLocalDate?: string
): boolean {
  const depDate = extractLocalDatePart(departureDateStr);
  if (!depDate) return false;

  const today =
    todayLocalDate ||
    new Date().toLocaleDateString('en-CA'); // en-CA reliably outputs YYYY-MM-DD in local time

  return depDate >= today;
}

/**
 * Searches a booking view over booking reference, route codes, route airport names, and carrier.
 * Case-insensitive, whitespace-trimmed.
 */
export function matchesSearch(view: BookingView, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (view.reference.toLowerCase().includes(q)) return true;
  if (view.route.origin.toLowerCase().includes(q)) return true;
  if (view.route.destination.toLowerCase().includes(q)) return true;
  if (view.route.originName && view.route.originName.toLowerCase().includes(q)) return true;
  if (view.route.destinationName && view.route.destinationName.toLowerCase().includes(q)) return true;
  if (view.carrier.toLowerCase().includes(q)) return true;
  if (view.flightNumbers.some((fn) => fn.toLowerCase().includes(q))) return true;

  return false;
}

/**
 * Heuristic lookup to correlate an in-flight offer with a completed booking order:
 * 1. Primary check: Exact match on stored `offerId` (if present in the booking document).
 * 2. Fallback check: If the booking document does not preserve `offerId`, inspect bookings created
 *    within the last `windowMinutes` (default 30) matching the offer's route (origin + destination)
 *    and departure date/time.
 * Returns the newest matching booking, or null if no match is found.
 */
export function findRecentBookingForOffer(
  views: BookingView[],
  offerId: string,
  now: Date | string = new Date(),
  windowMinutes: number = 30
): BookingView | null {
  if (!Array.isArray(views) || views.length === 0 || !offerId) {
    return null;
  }

  const cleanOfferId = offerId.trim();

  // 1. Primary check: Exact offerId match
  const exactMatches = views.filter((v) => v.offerId && v.offerId.trim() === cleanOfferId);
  if (exactMatches.length > 0) {
    // Sort descending by createdAt or keep newest
    return exactMatches.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime() || 0;
      const tB = new Date(b.createdAt).getTime() || 0;
      return tB - tA;
    })[0];
  }

  // 2. Fallback heuristic: Only for bookings where offerId is not stored
  const refTime = typeof now === 'string' ? new Date(now).getTime() : now.getTime();
  const windowMs = windowMinutes * 60 * 1000;

  const fallbackCandidates = views.filter((v) => {
    // Must NOT have a mismatched offerId
    if (v.offerId && v.offerId.trim() !== cleanOfferId) return false;
    if (!v.createdAt) return false;

    const createdTime = new Date(v.createdAt).getTime();
    if (isNaN(createdTime)) return false;

    const diff = refTime - createdTime;
    // Must be created within the window (0 <= diff <= windowMs)
    return diff >= -1000 && diff <= windowMs;
  });

  if (fallbackCandidates.length === 0) return null;

  return fallbackCandidates.sort((a, b) => {
    const tA = new Date(a.createdAt).getTime() || 0;
    const tB = new Date(b.createdAt).getTime() || 0;
    return tB - tA;
  })[0];
}

