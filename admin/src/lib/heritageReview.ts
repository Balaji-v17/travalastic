import type { PlaceModel } from './diffPlace.ts';

export const MAX_BULK_HERITAGE_SELECTION = 50;

export const BLOCKING_PUBLISH_FLAGS = [
  'coords_outside_india',
  'broken_text',
  'generic_name',
  'state_unmapped',
] as const;

export const FLAG_LABELS: Record<string, string> = {
  coords_outside_india: 'Coords outside India',
  broken_text: 'Broken text',
  generic_name: 'Generic name',
  state_unmapped: 'State unmapped',
  no_description: 'No description',
  possible_duplicate: 'Possible duplicate',
  matches_curated: 'Matches curated',
};

export interface HeritageFilterState {
  q: string;
  state: string;
  hiddenReason: string;
  flag: string;
  protectedBy: string;
}

export const DEFAULT_HERITAGE_FILTERS: HeritageFilterState = {
  q: '',
  state: '',
  hiddenReason: 'pending_review',
  flag: 'no_blocking',
  protectedBy: 'all',
};

export function getPlaceBlockingFlags(place: Partial<PlaceModel> | null | undefined): string[] {
  if (!place) return [];
  const flags = Array.isArray(place.reviewFlags) ? place.reviewFlags : [];
  const blocking = flags.filter((f) =>
    (BLOCKING_PUBLISH_FLAGS as readonly string[]).includes(f)
  );
  if ((!place.state || !place.state.trim()) && !blocking.includes('state_unmapped')) {
    blocking.push('state_unmapped');
  }
  return blocking;
}

export function canPublishPlace(place: Partial<PlaceModel> | null | undefined): boolean {
  return getPlaceBlockingFlags(place).length === 0;
}

export function hasCuratedOverlap(place: Partial<PlaceModel> | null | undefined): boolean {
  if (!place) return false;
  return Boolean(
    (Array.isArray(place.reviewFlags) && place.reviewFlags.includes('matches_curated')) ||
      place.heritage?.matchedCuratedPlace?.name
  );
}

export function toggleBulkSelection(
  currentIds: readonly string[],
  targetId: string,
  maxCount: number = MAX_BULK_HERITAGE_SELECTION
): { ids: string[]; capped: boolean } {
  const exists = currentIds.includes(targetId);
  if (exists) {
    return {
      ids: currentIds.filter((id) => id !== targetId),
      capped: false,
    };
  }
  if (currentIds.length >= maxCount) {
    return {
      ids: [...currentIds],
      capped: true,
    };
  }
  return {
    ids: [...currentIds, targetId],
    capped: false,
  };
}

/**
 * Builds an OpenStreetMap embed iframe URL for a small coordinate preview.
 */
export function buildOsmEmbedUrl(
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;

  const delta = 0.012;
  const minLng = (lng - delta).toFixed(5);
  const minLat = (lat - delta).toFixed(5);
  const maxLng = (lng + delta).toFixed(5);
  const maxLat = (lat + delta).toFixed(5);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}
