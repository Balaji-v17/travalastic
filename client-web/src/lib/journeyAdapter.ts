import type { Journey } from '../data/mockData';
import type { BackendDayPlan } from './itineraryApi';
import { backendDaysToItineraryDays } from './itineraryAdapter';

export const NEUTRAL_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="800" height="500" fill="url(%23g)"/><circle cx="400" cy="250" r="160" fill="%23334155" opacity="0.2"/></svg>';

export interface BackendSavedItinerary {
  _id?: string;
  id?: string;
  itineraryId?: string;
  userId?: string;
  destination?: string;
  destinationId?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  budgetTier?: 'budget' | 'mid' | 'luxury';
  budgetEstimate?: number;
  totalBudget?: number;
  currency?: string;
  travelers?: Array<{ name?: string }> | number;
  days?: BackendDayPlan[];
  itinerary?: BackendDayPlan[];
  imageUrl?: string;
  image?: string;
  destinationImage?: string;
  bookingsCount?: number;
}

export interface BackendBooking {
  _id: string;
  id?: string;
  itineraryId?: string | null;
  type?: string;
  status?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  totalAmount?: string | number;
  [key: string]: any;
}

function toDateString(d: string | Date | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Pure function deriving journey status strictly from dates:
 * - today before startDate -> 'planning'
 * - between startDate and endDate inclusive -> 'in-travel'
 * - after endDate -> 'completed'
 * - missing or invalid startDate / endDate -> 'planning'
 * Never produces 'booked' or 'pre-travel'.
 */
export function deriveStatus(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
  today: string | Date = new Date()
): 'planning' | 'in-travel' | 'completed' {
  const start = toDateString(startDate ?? undefined);
  const end = toDateString(endDate ?? undefined);
  const now = toDateString(today);

  if (!start || !end || !now) {
    return 'planning';
  }

  if (now < start) {
    return 'planning';
  }
  if (now > end) {
    return 'completed';
  }
  return 'in-travel';
}

/**
 * Pure adapter converting a saved backend itinerary into the Journey shape used throughout the web app.
 * Only real fields are copied; no values are fabricated.
 */
export function toJourney(
  savedItinerary: BackendSavedItinerary,
  matchingBookings: (string | BackendBooking)[] = [],
  signedInUserId: string = ''
): Journey {
  const id = String(savedItinerary._id || savedItinerary.id || savedItinerary.itineraryId || '');
  const travelerId = signedInUserId || String(savedItinerary.userId || '');
  const destination = savedItinerary.destination ? String(savedItinerary.destination).trim() : '';
  const destinationId = (savedItinerary.destinationId || destination || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const title = savedItinerary.title ? String(savedItinerary.title).trim() : '';
  const startDate = savedItinerary.startDate ? String(savedItinerary.startDate).trim() : '';
  const endDate = savedItinerary.endDate ? String(savedItinerary.endDate).trim() : '';

  let travelersCount = 1;
  if (Array.isArray(savedItinerary.travelers) && savedItinerary.travelers.length > 0) {
    travelersCount = savedItinerary.travelers.length;
  } else if (typeof savedItinerary.travelers === 'number' && savedItinerary.travelers > 0) {
    travelersCount = savedItinerary.travelers;
  }

  const status = deriveStatus(startDate, endDate);

  const normalizedBookings: BackendBooking[] = matchingBookings.map((b) =>
    typeof b === 'string' ? { _id: b, id: b } : b
  );
  const bookingIds: string[] = normalizedBookings
    .map((b) => String(b._id || b.id || ''))
    .filter(Boolean);

  const rawDays = savedItinerary.days || savedItinerary.itinerary || [];
  const itinerary = backendDaysToItineraryDays(rawDays, startDate, destination, normalizedBookings);

  const realBudget =
    typeof savedItinerary.budgetEstimate === 'number' && savedItinerary.budgetEstimate > 0
      ? savedItinerary.budgetEstimate
      : typeof savedItinerary.totalBudget === 'number' && savedItinerary.totalBudget > 0
      ? savedItinerary.totalBudget
      : undefined;

  const rawImage =
    savedItinerary.imageUrl || savedItinerary.image || savedItinerary.destinationImage;
  const imageUrl =
    rawImage && typeof rawImage === 'string' && rawImage.trim()
      ? rawImage.trim()
      : NEUTRAL_PLACEHOLDER_IMAGE;

  return {
    id,
    travelerId,
    destination,
    destinationId,
    title,
    status,
    startDate,
    endDate,
    travelers: travelersCount,
    bookings: bookingIds,
    totalBudget: realBudget,
    totalSpend: 0,
    currency: savedItinerary.currency || 'INR',
    imageUrl,
    itinerary,
    notifications: [],
    disruptions: [],
  };
}

