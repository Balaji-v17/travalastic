import type {
  BackendGenerateResponse,
  BackendDayPlan,
  BackendActivity,
  JourneyDNA,
} from './itineraryApi';
import type { ItineraryDay, ItineraryActivity } from '../data/mockData';

export interface JourneyItem {
  id: string;
  time: string;
  title: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'meal' | 'free';
  duration: string;
  cost: number;
  costKnown?: boolean;
  entityId?: string;
  entityType?: 'hotel' | 'activity' | 'flight';
  status: 'planned' | 'booked';
  bookingId?: string;
  note?: string;
  aiReason?: string;
  placeId?: string | null;
  location?: {
    lat?: number | null;
    lon?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    placeName?: string | null;
  } | null;
  kind?: 'place' | 'meal' | 'transit' | 'rest';
  placeRef?: string;
}

export interface JourneyDay {
  day: number;
  date: string;
  location: string;
  title: string;
  theme?: string;
  items: JourneyItem[];
  estimatedCostINR?: number;
  accommodationSuggestion?: string;
}

export interface HealthScore {
  overall: number;
  budget: number;
  pace: number;
  interests: number;
  convenience: number;
  travelTime: number;
  hotels: number;
  weakNote?: string;
}

export interface BudgetBreakdown {
  flights: number;
  hotels: number;
  transport: number;
  experiences: number;
  food: number;
  buffer: number;
  total: number;
}

export interface GeneratedJourney {
  dna: JourneyDNA;
  title: string;
  route: string[];
  days: JourneyDay[];
  budget: BudgetBreakdown;
  health: HealthScore;
  primaryHotelId: string;
  primaryFlightId: string;
  version: number;
  savedJourneyId?: string;
  itineraryId?: string;
  aiMessage?: string;
  alternativeVersion?: Omit<GeneratedJourney, 'alternativeVersion'>;
  grounding?: {
    candidateCount: number;
    sources: string[];
    limited: boolean;
  };
}

/**
 * Currency unit conversion helper.
 * The backend itinerary service currently outputs monetary values in whole Indian Rupees (INR).
 * If any upstream partner or service returns paise (1 INR = 100 paise), this constant and helper ensure conversion.
 */
export const PAISE_PER_RUPEE = 100;

export function paiseToRupees(paise: number): number {
  return Math.round(paise / PAISE_PER_RUPEE);
}

/**
 * Reusable day/activity conversion function from backend day plans to ItineraryDay[].
 * Shared between itinerary generation adapter and user journey adapter.
 */
export function backendDaysToItineraryDays(
  backendDays: BackendDayPlan[] = [],
  startDateStr?: string,
  destinationStr?: string,
  matchingBookings: Array<{ id?: string; _id?: string; type?: string }> = []
): ItineraryDay[] {
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const location = destinationStr ? destinationStr.split(',')[0].trim() : '';

  return (backendDays || []).map((dayPlan: BackendDayPlan, dayIdx: number) => {
    const dayNumber = dayPlan.dayNumber ?? dayIdx + 1;

    let dateStr = '';
    if (startDate && !isNaN(startDate.getTime())) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + (dayNumber - 1));
      dateStr = dayDate.toISOString().split('T')[0];
    }

    const placeTitles = (dayPlan.activities || [])
      .filter((a) => (a as any).kind === 'place' || (a.location && a.location.lat != null))
      .map((a) => a.title);
    const derivedTheme =
      dayPlan.theme && dayPlan.theme.trim()
        ? dayPlan.theme.trim()
        : placeTitles.length > 0
        ? placeTitles.slice(0, 2).join(' and ')
        : location
        ? `Highlights of ${location}`
        : `Day ${dayNumber}`;
    const dayTitle = `Day ${dayNumber} · ${derivedTheme}`;

    const activities: ItineraryActivity[] = (dayPlan.activities || []).map(
      (act: BackendActivity, actIdx: number) => {
        // Keep backend suggestedTime verbatim without synthesizing clock times
        const time = act.suggestedTime ? String(act.suggestedTime).trim() : '';
        const rawType = (act as any).type?.toLowerCase();
        const type: ItineraryActivity['type'] =
          rawType === 'meal'
            ? 'meal'
            : rawType === 'flight'
            ? 'flight'
            : rawType === 'hotel'
            ? 'hotel'
            : rawType === 'transfer'
            ? 'transfer'
            : 'activity';

        const rawId =
          (act as any).id ??
          (act as any)._id?.toString() ??
          (act as any).placeId ??
          (act as any).activityId;
        const actId =
          rawId != null && String(rawId).trim()
            ? String(rawId).trim()
            : `act-${dayNumber}-${actIdx + 1}`;

        const matchedBooking = matchingBookings.find(
          (b) => b.type === type || (b as any).activityId === actId
        );

        return {
          id: actId,
          time,
          title: act.title || act.name || 'Planned Activity',
          type,
          duration: '',
          notes: act.description || undefined,
          cost: 0,
          status: matchedBooking ? ('booked' as const) : ('unbooked' as const),
          bookingId: matchedBooking
            ? String(matchedBooking._id || matchedBooking.id || '')
            : undefined,
          location: act.location,
          kind: (act as any).kind || ((act as any).type === 'activity' ? 'place' : undefined),
        };
      }
    );

    return {
      day: dayNumber,
      date: dateStr,
      location,
      title: dayTitle,
      activities,
    };
  });
}

/**
 * Pure adapter converting the backend raw generation response into the GeneratedJourney structure.
 * Maps only real fields returned by the backend.
 */
export function toGeneratedJourney(
  response: BackendGenerateResponse,
  dna: JourneyDNA
): GeneratedJourney {
  const backendDays = response?.itinerary || [];
  const itineraryDays = backendDaysToItineraryDays(backendDays, dna.startDate, dna.destination);

  const days: JourneyDay[] = itineraryDays.map((d, dayIdx) => {
    const rawDayPlan = backendDays[dayIdx];
    const items: JourneyItem[] = d.activities.map((act, actIdx) => {
      const rawAct = rawDayPlan?.activities?.[actIdx];
      return {
        id: act.id,
        time: act.time,
        title: act.title,
        type: act.type,
        duration: act.duration,
        cost: act.cost ?? 0,
        costKnown: false,
        status: 'planned' as const,
        note: act.notes,
        location: act.location,
        kind: (rawAct as any)?.kind,
        placeRef: (rawAct as any)?.placeRef,
      };
    });

    return {
      day: d.day,
      date: d.date,
      location: d.location,
      title: d.title,
      theme: rawDayPlan?.theme || d.title.replace(/^Day \d+ · /, ''),
      items,
      estimatedCostINR: rawDayPlan?.estimatedCostINR,
      accommodationSuggestion: rawDayPlan?.accommodationSuggestion,
    };
  });

  // Real budget total derived from dayPlan.estimatedCostINR sum
  const totalEstimatedCost = backendDays.reduce(
    (sum, d) => sum + (d.estimatedCostINR || 0),
    0
  );

  return {
    dna,
    title: `${dna.nights} Days in ${dna.destination.split(',')[0].trim()}`,
    route: [dna.origin || 'Origin', dna.destination.split(',')[0].trim()],
    days,
    budget: {
      flights: 0,
      hotels: 0,
      transport: 0,
      experiences: 0,
      food: 0,
      buffer: 0,
      total: totalEstimatedCost,
    },
    health: {
      overall: 0,
      budget: 0,
      pace: 0,
      interests: 0,
      convenience: 0,
      travelTime: 0,
      hotels: 0,
    },
    primaryHotelId: '',
    primaryFlightId: '',
    version: 1,
    savedJourneyId: response.itineraryId,
    itineraryId: response.itineraryId,
    grounding: response.grounding,
  };
}
