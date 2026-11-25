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

export interface MergedBookingItem {
  id: string;
  kind: 'flight' | 'hotel' | 'bus' | 'train' | 'cab' | 'car_rental';
  source: 'duffel' | 'recorded';
  title: string;
  subtitle: string;
  provider: string;
  startAt: string;
  endAt: string;
  status: 'booked' | 'cancelled';
  rawStatus?: string;
  reference: string;
  amount: string;
  currency: string;
  notes: string;
  tripId: string | null;
  createdAt: string;
  flight?: RawBooking;
}

export interface MergedBookingsResponse {
  items: MergedBookingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: {
    total: number;
    byKind: {
      flight: number;
      hotel: number;
      bus: number;
      train: number;
      cab: number;
      car_rental: number;
    };
    byWhen: {
      upcoming: number;
      past: number;
      cancelled: number;
    };
  };
}

export interface RecordedBookingPayload {
  kind: 'hotel' | 'bus' | 'train' | 'cab' | 'car_rental';
  title: string;
  provider: string;
  startAt: string;
  endAt?: string;
  reference?: string;
  amount?: string;
  currency?: string;
  status?: 'booked' | 'cancelled';
  notes?: string;
  tripId?: string | null;
}

export async function listAllBookings(params: {
  kind?: string;
  when?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<MergedBookingsResponse> {
  try {
    const qs = new URLSearchParams();
    if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
    if (params.when && params.when !== 'all') qs.set('when', params.when);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const queryStr = qs.toString();
    const res = await apiFetch<MergedBookingsResponse>(
      `/bookings/all${queryStr ? `?${queryStr}` : ''}`,
      {
        method: 'GET',
        signal: params.signal,
        timeoutMs: 15000,
      }
    );
    return res;
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

export async function listRecordedBookings(
  options: { tripId?: string; signal?: AbortSignal } = {}
): Promise<MergedBookingItem[]> {
  try {
    const qs = options.tripId ? `?tripId=${encodeURIComponent(options.tripId)}` : '';
    const list = await apiFetch<MergedBookingItem[]>(`/bookings/recorded${qs}`, {
      method: 'GET',
      signal: options.signal,
      timeoutMs: 15000,
    });
    return Array.isArray(list) ? list : [];
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

export async function createRecordedBooking(
  payload: RecordedBookingPayload
): Promise<MergedBookingItem> {
  try {
    return await apiFetch<MergedBookingItem>('/bookings/recorded', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 15000,
    });
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

export async function updateRecordedBooking(
  id: string,
  payload: Partial<RecordedBookingPayload>
): Promise<MergedBookingItem> {
  try {
    return await apiFetch<MergedBookingItem>(`/bookings/recorded/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      timeoutMs: 15000,
    });
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

export async function deleteRecordedBooking(id: string): Promise<{ deleted: boolean; id: string }> {
  try {
    return await apiFetch<{ deleted: boolean; id: string }>(
      `/bookings/recorded/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        timeoutMs: 15000,
      }
    );
  } catch (err) {
    throw normalizeBookingsError(err);
  }
}

export interface CuratedRouteItem {
  _id?: string;
  mode: 'train' | 'bus';
  origin: string;
  destination: string;
  approxDurationHours?: number;
  frequency?: string;
  note?: string;
  name?: string;
}

export async function searchCuratedRoutes(params: {
  mode: 'train' | 'bus';
  origin: string;
  destination: string;
  signal?: AbortSignal;
}): Promise<{ routes: CuratedRouteItem[]; bookingLinkUrl: string | null }> {
  const qs = new URLSearchParams({
    mode: params.mode,
    origin: params.origin.trim(),
    destination: params.destination.trim(),
  });
  return await apiFetch<{ routes: CuratedRouteItem[]; bookingLinkUrl: string | null }>(
    `/routes/search?${qs.toString()}`,
    {
      method: 'GET',
      signal: params.signal,
      timeoutMs: 15000,
    }
  );
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

