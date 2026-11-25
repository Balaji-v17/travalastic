import { apiFetch } from './api.ts';
import type { TripCoverImage } from '../data/mockData.ts';

export interface BackendActivity {
  title: string;
  name?: string;
  description: string;
  timeOfDay?: string | null;
  suggestedTime: string | null;
  kind?: 'place' | 'meal' | 'transit' | 'rest';
  placeRef?: string | null;
  placeId: string | null;
  location?: {
    lat: number | null;
    lon: number | null;
    placeName: string | null;
  } | null;
  outdoor?: boolean | null;
  done?: boolean;
}

export interface BackendDayPlan {
  dayNumber: number;
  theme?: string;
  activities: BackendActivity[];
  estimatedCostINR?: number;
  accommodationSuggestion?: string;
}

export interface UndoState {
  count: number;
  lastEditId: string | null;
  lastEditDays: number[];
}

export interface BackendGenerateResponse {
  itineraryId: string;
  itinerary: BackendDayPlan[];
  coverImage?: TripCoverImage | null;
  grounding?: {
    candidateCount: number;
    sources: string[];
    limited: boolean;
  };
  replaced?: boolean;
  undo?: UndoState;
}

export interface JourneyDNA {
  destination: string;
  destinationId: string;
  origin: string;
  startDate: string;
  nights: number;
  travelers: number;
  budget: number | '';
  pace: 'relaxed' | 'balanced' | 'packed';
  comfort: 'smart' | 'comfortable' | 'premium' | 'luxury';
  interests: string[];
  mustHave: string;
  avoid: string;
  notes: string;
}

/**
 * Computes calendar date-only start and end dates without timezone offsets.
 */
export function computeTripDates(startDateStr?: string, nights: number = 3): { startDate: string; endDate: string } {
  let start = startDateStr ? startDateStr.trim().slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    start = `${y}-${m}-${d}`;
  }
  const [y, m, d] = start.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d + (nights > 0 ? nights : 1));
  const endY = targetDate.getFullYear();
  const endM = String(targetDate.getMonth() + 1).padStart(2, '0');
  const endD = String(targetDate.getDate()).padStart(2, '0');
  const end = `${endY}-${endM}-${endD}`;
  return { startDate: start, endDate: end };
}

/**
 * Builds the natural language rawRequest string from DNA form fields.
 * The backend POST /itinerary/generate endpoint accepts exclusively `{ rawRequest: string }`.
 * Any invalid state (such as nights <= 0 or missing destination) produces an empty string,
 * triggering the backend's validation check.
 */
export function buildRawRequest(dna: JourneyDNA): string {
  if (!dna.destination || !dna.destination.trim() || dna.nights <= 0) {
    return '';
  }

  const parts: string[] = [];
  const nights = dna.nights;
  const { startDate: startDateStr, endDate: endDateStr } = computeTripDates(dna.startDate, nights);

  // Map comfort level to backend budgetTier: 'budget' | 'mid' | 'luxury'
  let tier: 'budget' | 'mid' | 'luxury' = 'mid';
  if (dna.comfort === 'smart') tier = 'budget';
  else if (dna.comfort === 'comfortable') tier = 'mid';
  else if (dna.comfort === 'premium' || dna.comfort === 'luxury') tier = 'luxury';

  parts.push(`Plan a ${nights}-day trip to ${dna.destination.trim()} from ${startDateStr} to ${endDateStr}.`);
  if (dna.origin && dna.origin.trim()) {
    parts.push(`Traveling from ${dna.origin.trim()}.`);
  }
  if (dna.travelers) {
    parts.push(`For ${dna.travelers} traveler${dna.travelers > 1 ? 's' : ''}.`);
  }
  if (typeof dna.budget === 'number' && !isNaN(dna.budget) && dna.budget > 0) {
    parts.push(`Budget tier: ${tier} (total budget: ₹${dna.budget.toLocaleString()}).`);
  } else {
    parts.push(`Budget tier: ${tier}.`);
  }
  if (dna.comfort) {
    parts.push(`Comfort preference: ${dna.comfort}.`);
  }
  if (dna.pace) {
    parts.push(`Pace preference: ${dna.pace}.`);
  }
  if (dna.interests && dna.interests.length > 0) {
    parts.push(`Interests: ${dna.interests.join(', ')}.`);
  }
  if (dna.mustHave && dna.mustHave.trim()) {
    parts.push(`Must include: ${dna.mustHave.trim()}.`);
  }
  if (dna.avoid && dna.avoid.trim()) {
    parts.push(`Avoid: ${dna.avoid.trim()}.`);
  }
  if (dna.notes && dna.notes.trim()) {
    parts.push(`Additional preferences: ${dna.notes.trim()}.`);
  }

  return parts.join(' ');
}

export interface DuplicateCheckResult {
  duplicate: boolean;
  existingTripId?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Checks for existing trip matching destination and dates BEFORE calling the AI.
 */
export async function checkDuplicateItinerary(params: {
  destination?: string;
  startDate?: string;
  endDate?: string;
  rawRequest?: string;
}): Promise<DuplicateCheckResult> {
  return apiFetch<DuplicateCheckResult>('/itinerary/check-duplicate', {
    method: 'POST',
    body: params,
  });
}

export interface GenerateOptions {
  onDuplicate?: 'replace' | 'keep_both';
  replaceTripId?: string;
  signal?: AbortSignal;
}

/**
 * Calls the backend POST /itinerary/generate endpoint with typed response.
 */
export async function generateItinerary(
  dna: JourneyDNA,
  optionsOrSignal?: GenerateOptions | AbortSignal
): Promise<BackendGenerateResponse> {
  let options: GenerateOptions = {};
  if (optionsOrSignal instanceof AbortSignal) {
    options = { signal: optionsOrSignal };
  } else if (optionsOrSignal) {
    options = optionsOrSignal;
  }
  const rawRequest = buildRawRequest(dna);
  const { startDate, endDate } = computeTripDates(dna.startDate, dna.nights);
  return apiFetch<BackendGenerateResponse>('/itinerary/generate', {
    method: 'POST',
    body: {
      rawRequest,
      destination: dna.destination,
      startDate,
      endDate,
      onDuplicate: options.onDuplicate,
      replaceTripId: options.replaceTripId,
    },
    signal: options.signal,
  });
}

/**
 * Calls POST /itinerary/:id/undo to restore the previous itinerary plan.
 */
export async function undoItineraryApi(
  itineraryId: string,
  expectedEditId?: string | null
): Promise<{
  itineraryId: string;
  itinerary: BackendDayPlan[];
  undo?: UndoState;
  restoredDays?: number[];
}> {
  return apiFetch<{
    itineraryId: string;
    itinerary: BackendDayPlan[];
    undo?: UndoState;
    restoredDays?: number[];
  }>(`/itinerary/${itineraryId}/undo`, {
    method: 'POST',
    body: expectedEditId ? { expectedEditId } : {},
  });
}

/**
 * Calls POST /itineraries/:id/cover to lazily resolve and persist a missing destination cover photo.
 */
export async function fetchTripCover(
  itineraryId: string
): Promise<TripCoverImage | null> {
  const res = await apiFetch<{ coverImage?: TripCoverImage | null }>(
    `/itineraries/${encodeURIComponent(itineraryId)}/cover`,
    { method: 'POST', body: {} }
  );
  return res?.coverImage ?? null;
}
