import { apiFetch } from './api';

export interface BackendActivity {
  title: string;
  name?: string;
  description: string;
  suggestedTime: string | null;
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
  activities: BackendActivity[];
  estimatedCostINR?: number;
  accommodationSuggestion?: string;
}

export interface BackendGenerateResponse {
  itineraryId: string;
  itinerary: BackendDayPlan[];
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
  const start = new Date(dna.startDate || Date.now());
  const end = new Date(start);
  end.setDate(end.getDate() + nights);
  const startDateStr = dna.startDate || start.toISOString().split('T')[0];
  const endDateStr = !isNaN(end.getTime()) ? end.toISOString().split('T')[0] : '';

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

/**
 * Calls the backend POST /itinerary/generate endpoint with typed response.
 */
export async function generateItinerary(
  dna: JourneyDNA,
  signal?: AbortSignal
): Promise<BackendGenerateResponse> {
  const rawRequest = buildRawRequest(dna);
  return apiFetch<BackendGenerateResponse>('/itinerary/generate', {
    method: 'POST',
    body: { rawRequest },
    signal,
  });
}
