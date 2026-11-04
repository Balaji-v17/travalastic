import { apiFetch, ApiError } from './api.ts';

export interface BookingPassenger {
  givenName?: string;
  familyName?: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  title?: string;
  email?: string;
  phoneNumber?: string;
}

export interface RawBooking {
  _id: string;
  id?: string;
  userId?: string | null;
  itineraryId?: string | null;
  bookingReference: string;
  orderId?: string | null;
  offerId?: string | null;
  type?: string;
  status?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  duration?: string | null;
  passengers?: BookingPassenger[];
  passengerNames?: string[];
  totalAmount?: string | number;
  currency?: string;
  slices?: any[];
  rawOrder?: any;
  createdAt?: string;
}

export interface BookingStatusResponse {
  bookingId: string;
  orderId?: string;
  bookingReference: string;
  status: string;
  departureTime?: string | null;
  route: string;
  airline?: string;
  origin?: string;
  destination?: string;
  totalAmount?: string | number;
  currency?: string;
}

export class BookingsApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'BookingsApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, BookingsApiError.prototype);
  }
}

export function normalizeBookingsError(err: unknown): BookingsApiError {
  if (err instanceof BookingsApiError) return err;
  let status = 0;
  let message = 'Failed to load flight bookings';
  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err && typeof err === 'object') {
    const e = err as { status?: number; message?: string };
    if (typeof e.status === 'number') status = e.status;
    if (typeof e.message === 'string' && e.message) message = e.message;
  }
  let code = 'UNKNOWN_ERROR';
  if (status === 401) code = 'UNAUTHORIZED';
  else if (status === 404) code = 'NOT_FOUND';
  else if (status === 408) code = 'TIMEOUT';
  else if (status === 0) code = 'NETWORK_ERROR';
  else if (status >= 500) code = 'SERVER_ERROR';

  return new BookingsApiError(status, code, message);
}

/**
 * Fetches all flight bookings for the authenticated user from GET /bookings/mine.
 * Sorted descending by createdAt on the backend.
 */
export async function listBookings(
  options: { signal?: AbortSignal } = {}
): Promise<RawBooking[]> {
  try {
    const list = await apiFetch<RawBooking[]>('/bookings/mine', {
      method: 'GET',
      signal: options.signal,
      timeoutMs: 15000,
    });
    return Array.isArray(list) ? list : [];
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

/**
 * Re-checks fresh status of a single booking from Duffel via GET /flights/bookings/:bookingId/status.
 * Confirms user ownership on the backend; returns 404 if booking is not owned by the caller.
 */
export async function getBookingStatus(
  bookingId: string,
  options: { signal?: AbortSignal } = {}
): Promise<BookingStatusResponse> {
  if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
    throw new BookingsApiError(400, 'BAD_REQUEST', 'bookingId is required');
  }
  try {
    return await apiFetch<BookingStatusResponse>(
      `/flights/bookings/${encodeURIComponent(bookingId.trim())}/status`,
      {
        method: 'GET',
        signal: options.signal,
        timeoutMs: 15000,
      }
    );
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

