import { apiFetch, ApiError } from './api.ts';

export interface BookingPassengerPayload {
  givenName: string;
  familyName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender?: 'm' | 'f';
  title?: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  email?: string;
  phoneNumber?: string;
}

export interface CreateBookingPayload {
  offerId: string;
  passengers: BookingPassengerPayload[];
  itineraryId?: string;
}

export interface BookingResponse {
  bookingReference: string;
  orderId: string;
  bookingId: string | null;
  itineraryId: string | null;
  totalAmount: string;
  currency: string;
  passengerNames: string[];
  status: string;
}

export interface RepriceOfferResponse {
  isValid: boolean;
  offerId: string;
  airline?: string;
  airlineName?: string;
  price?: {
    amount: string;
    currency: string;
  };
  departureTime?: string | null;
  arrivalTime?: string | null;
  duration?: string | null;
  expiresAt?: string | null;
  message?: string;
}

export interface NormalizedBookingError {
  status: number;
  code: string;
  message: string;
}

export class BookingApiError extends Error implements NormalizedBookingError {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, BookingApiError.prototype);
  }
}

export function normalizeBookingError(err: unknown): BookingApiError {
  if (err instanceof BookingApiError) {
    return err;
  }

  let status = 0;
  let message = 'An unexpected error occurred while processing your booking.';

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err && typeof err === 'object') {
    const anyErr = err as { status?: number; message?: string; name?: string };
    if (typeof anyErr.status === 'number') {
      status = anyErr.status;
    }
    if (typeof anyErr.message === 'string' && anyErr.message.trim()) {
      message = anyErr.message;
    }
  }

  let code = 'UNKNOWN_ERROR';
  if (status === 409) {
    code = 'OFFER_EXPIRED';
  } else if (status === 400) {
    code = 'VALIDATION_ERROR';
  } else if (status === 408) {
    code = 'TIMEOUT';
  } else if (status === 0) {
    code = 'NETWORK_ERROR';
  } else if (status === 410) {
    code = 'OFFER_GONE';
  } else if (status === 422) {
    code = 'UNPROCESSABLE_ENTITY';
  } else if (status === 500) {
    code = 'SERVER_ERROR';
  } else if (status === 502) {
    code = 'PROVIDER_ERROR';
  }

  return new BookingApiError(status, code, message);
}

/**
 * Re-checks freshness and current pricing of an existing Duffel offer before booking.
 * Timeout: 60s.
 */
export async function repriceOffer(
  offerId: string,
  signal?: AbortSignal
): Promise<RepriceOfferResponse> {
  if (!offerId || typeof offerId !== 'string' || !offerId.trim()) {
    throw new BookingApiError(400, 'VALIDATION_ERROR', 'offerId is required');
  }

  try {
    const result = await apiFetch<RepriceOfferResponse>(
      `/flights/offers/${encodeURIComponent(offerId.trim())}`,
      {
        method: 'GET',
        signal,
        timeoutMs: 60000,
      }
    );
    return result;
  } catch (err) {
    throw normalizeBookingError(err);
  }
}

/**
 * Creates a confirmed flight order via backend /flights/book (Duffel TEST mode).
 * Timeout: 60s.
 */
export async function createBooking(
  payload: CreateBookingPayload,
  signal?: AbortSignal
): Promise<BookingResponse> {
  if (!payload || !payload.offerId) {
    throw new BookingApiError(400, 'VALIDATION_ERROR', 'offerId is required in booking payload');
  }

  if (!Array.isArray(payload.passengers) || payload.passengers.length === 0) {
    throw new BookingApiError(400, 'VALIDATION_ERROR', 'passengers list cannot be empty');
  }

  try {
    const result = await apiFetch<BookingResponse>('/flights/book', {
      method: 'POST',
      body: payload,
      signal,
      timeoutMs: 60000,
    });
    return result;
  } catch (err) {
    throw normalizeBookingError(err);
  }
}

