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
  significance?: string | null;
  description?: string | null;
  rating?: number | null;
  googleRating?: number | null;
  entranceFeeINR?: number | null;
  timeNeededHours?: number | null;
  bestTimeToVisit?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isCurated?: boolean;
  source?: string | null;
  heritage?: {
    protectedBy?: string | null;
    asiCircle?: string | null;
    location?: string | null;
    coordsApprox?: boolean;
  } | null;
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

export function isHeritagePlace(place: Partial<PlaceResult> | null | undefined): boolean {
  if (!place) return false;
  return place.source === 'asi-soi-heritage' || Boolean(place.heritage?.protectedBy);
}

export function getPlaceAuthorityLabel(place: Partial<PlaceResult> | null | undefined): string | null {
  if (!isHeritagePlace(place)) return null;
  return 'Protected monument (ASI / Survey of India)';
}

export function formatPlaceRating(rating: number | null | undefined): string | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return null;
  return rating.toFixed(1);
}

export function formatEntranceFee(fee: number | null | undefined): string {
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) return 'Not listed';
  if (fee === 0) return 'Free';
  return `₹${fee}`;
}

export function formatTimeNeeded(hours: number | null | undefined): string {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return 'Time varies';
  return `${hours} hrs`;
}

