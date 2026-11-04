import type { Journey } from '../data/mockData';

export interface PlaceResult {
  _id?: string;
  placeId?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zone?: string;
  type?: string;
  category?: string | null;
  significance?: string;
  description?: string;
  rating?: number;
  googleRating?: number;
  entranceFeeINR?: number;
  timeNeededHours?: number;
  bestTimeToVisit?: string;
  lat?: number | string | null;
  lon?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isCurated?: boolean;
  source?: string;
  notice?: string;
  fallbackNotice?: string;
  photoUrl?: string;
  image?: string;
  imageUrl?: string;
}

export type DestinationViewDecision = 'live' | 'sample' | 'notfound';

export interface DestinationViewParams {
  selectedPlace?: PlaceResult | null;
  selectedDestinationId?: string | null;
  mockIds: string[];
  showSample: boolean;
}

export function destinationView({
  selectedPlace,
  selectedDestinationId,
  mockIds,
  showSample,
}: DestinationViewParams): DestinationViewDecision {
  if (selectedPlace && typeof selectedPlace === 'object') {
    return 'live';
  }
  if (
    showSample &&
    selectedDestinationId &&
    mockIds.includes(selectedDestinationId)
  ) {
    return 'sample';
  }
  return 'notfound';
}

export function findTripForPlace(
  journeys: Journey[] | undefined | null,
  name: string | undefined | null
): Journey | null {
  if (!name || typeof name !== 'string' || !journeys || !Array.isArray(journeys)) {
    return null;
  }

  const normalize = (str: string): string =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const target = normalize(name);
  if (!target) return null;

  for (const j of journeys) {
    if (j && j.destination && typeof j.destination === 'string') {
      if (normalize(j.destination) === target) {
        return j;
      }
    }
  }

  return null;
}

export function buildMapsUrl(
  name?: string | null,
  lat?: number | string | null,
  lon?: number | string | null
): string | null {
  if (lat == null || lon == null) return null;
  if (typeof lat === 'string' && lat.trim() === '') return null;
  if (typeof lon === 'string' && lon.trim() === '') return null;

  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (isNaN(latNum) || isNaN(lonNum)) return null;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const queryStr = cleanName ? `${cleanName} ${latNum},${lonNum}` : `${latNum},${lonNum}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
}

