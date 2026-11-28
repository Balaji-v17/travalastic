import { apiFetch } from './api.ts';
import { normalizeCitySearchKey, type CitySuggestion } from './citySearch.ts';

export interface DidYouMeanHint {
  shouldShow: boolean;
  message: string;
  suggestions: CitySuggestion[];
  blocksSubmit: false;
}

export interface TripDestinationLike {
  destination?: string | null;
}

/**
 * Checks whether a destination matches any destination in the signed-in user's own trips
 * (exact normalized match or matching the primary city segment before a comma).
 */
export function isDestinationInUserTrips(
  destination: string,
  trips: readonly TripDestinationLike[]
): boolean {
  const target = normalizeCitySearchKey(destination);
  if (!target || !Array.isArray(trips) || trips.length === 0) return false;

  const targetHead = normalizeCitySearchKey(destination.split(',')[0]);

  return trips.some((t) => {
    const tripDest = typeof t?.destination === 'string' ? t.destination : '';
    const normTrip = normalizeCitySearchKey(tripDest);
    if (!normTrip) return false;
    const tripHead = normalizeCitySearchKey(tripDest.split(',')[0]);
    return normTrip === target || (Boolean(targetHead) && tripHead === targetHead);
  });
}

/**
 * Pure builder for the non-blocking "did you mean" hint state.
 * Never blocks Journey AI submission.
 */
export function buildDidYouMeanHint(params: {
  destination: string;
  known: boolean;
  suggestions?: readonly CitySuggestion[];
}): DidYouMeanHint {
  const clean = params.destination.trim();
  if (!clean || clean.length < 2 || params.known) {
    return {
      shouldShow: false,
      message: '',
      suggestions: [],
      blocksSubmit: false,
    };
  }

  return {
    shouldShow: true,
    message: `We could not find '${clean}' in our city list. Check the spelling, or continue if it is a small place`,
    suggestions: (params.suggestions || []).slice(0, 3),
    blocksSubmit: false,
  };
}

export async function checkDestinationKnown(
  destination: string,
  options: { signal?: AbortSignal } = {}
): Promise<{ known: boolean; suggestions: CitySuggestion[] }> {
  const trimmed = destination.trim();
  if (trimmed.length < 2) {
    return { known: true, suggestions: [] };
  }

  const data = await apiFetch<{ known?: boolean; suggestions?: CitySuggestion[] }>(
    `/destinations/check?q=${encodeURIComponent(trimmed)}`,
    {
      signal: options.signal,
      timeoutMs: 6000,
    }
  );

  return {
    known: data?.known !== false,
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 3) : [],
  };
}

