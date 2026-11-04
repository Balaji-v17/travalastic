import { apiFetch } from './api.ts';

export interface AirportSuggestion {
  name: string;
  iataCode: string;
  cityName: string;
  country: string;
}

export interface RawBackendOffer {
  offerId: string;
  airline?: string;
  airlineName?: string;
  price: {
    amount: string;
    currency: string;
  };
  departureTime: string | null;
  arrivalTime: string | null;
  duration: string | null;

  // Rich Duffel properties if returned or present in fixtures
  id?: string;
  slices?: any[];
  owner?: { name?: string; iata_code?: string };
  passengers?: any[];
  conditions?: any;
  expiresAt?: string;
  expires_at?: string;
  isTest?: boolean;
  live_mode?: boolean;
}

export interface SuggestAirportsParams {
  q: string;
  signal?: AbortSignal;
}

export interface SearchFlightsParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  cabin?: string;
  signal?: AbortSignal;
}

/**
 * Fetch airport suggestions from the Duffel Place Suggestions API via backend.
 */
export async function suggestAirports({
  q,
  signal,
}: SuggestAirportsParams): Promise<AirportSuggestion[]> {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  return apiFetch<AirportSuggestion[]>(
    `/flights/airports?query=${encodeURIComponent(trimmed)}`,
    {
      signal,
      timeoutMs: 15000,
    }
  );
}

/**
 * Search flight offers via Duffel backed by Travalastic backend.
 * Only supported fields (origin, destination, departureDate, passengers) are sent.
 */
export async function searchFlights({
  origin,
  destination,
  departureDate,
  adults = 1,
  signal,
}: SearchFlightsParams): Promise<RawBackendOffer[]> {
  const payload = {
    origin: origin.trim().toUpperCase(),
    destination: destination.trim().toUpperCase(),
    departureDate: departureDate.trim(),
    passengers: Math.max(1, Math.min(9, Math.floor(adults))),
  };

  return apiFetch<RawBackendOffer[]>('/flights/search', {
    method: 'POST',
    body: payload,
    signal,
    timeoutMs: 45000,
  });
}

/**
 * Verify offer freshness and get detailed offer information.
 */
export async function fetchOfferDetails(
  offerId: string,
  signal?: AbortSignal
): Promise<RawBackendOffer & { isValid?: boolean; message?: string }> {
  return apiFetch<RawBackendOffer & { isValid?: boolean; message?: string }>(
    `/flights/offers/${encodeURIComponent(offerId.trim())}`,
    {
      signal,
      timeoutMs: 20000,
    }
  );
}
