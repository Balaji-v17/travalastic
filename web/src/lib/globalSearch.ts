import type { PlaceResult } from './destinationView.ts';
import {
  CITY_SEARCH_DEBOUNCE_MS,
  CITY_SEARCH_MIN_CHARS,
  formatCitySecondary,
  type CitySuggestion,
} from './citySearch.ts';

export const GLOBAL_SEARCH_MIN_CHARS = 3;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 400;
export { CITY_SEARCH_MIN_CHARS, CITY_SEARCH_DEBOUNCE_MS };

export interface TripSearchEntry {
  id: string;
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
}

export interface GlobalSearchPlaceItem {
  id: string;
  name: string;
  subtitle: string;
  photoUrl?: string;
  raw: PlaceResult;
}

export interface GlobalSearchCityItem {
  id: string;
  name: string;
  subtitle: string;
  isRegion: boolean;
  raw: CitySuggestion;
}

export type GlobalSearchGroup =
  | {
      key: 'trips';
      label: 'My trips';
      items: TripSearchEntry[];
    }
  | {
      key: 'cities';
      label: 'Cities';
      items: GlobalSearchCityItem[];
    }
  | {
      key: 'places';
      label: 'Places';
      items: GlobalSearchPlaceItem[];
    };

export function shouldTriggerTypeahead(query: string): boolean {
  return query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;
}

export function shouldTriggerCityTypeahead(query: string): boolean {
  return query.trim().length >= CITY_SEARCH_MIN_CHARS;
}

export function filterUserTrips<T extends TripSearchEntry>(
  trips: readonly T[],
  query: string,
  isSignedIn: boolean
): T[] {
  if (!isSignedIn || !shouldTriggerTypeahead(query)) {
    return [];
  }
  const q = query.trim().toLowerCase();
  return trips.filter((t) => {
    const dest = (t.destination || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    return dest.includes(q) || title.includes(q);
  });
}

function getPlacePhoto(place: PlaceResult): string | undefined {
  const candidate = place.photoUrl || place.image || place.imageUrl;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

function formatPlaceSubtitle(place: PlaceResult): string {
  const locationParts = [place.city, place.state].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
  const typeLabel =
    typeof place.type === 'string' && place.type.trim().length > 0 ? place.type.trim() : '';

  if (locationParts.length > 0 && typeLabel) {
    return `${locationParts.join(', ')} · ${typeLabel}`;
  }
  if (locationParts.length > 0) {
    return locationParts.join(', ');
  }
  if (typeLabel) {
    return typeLabel;
  }
  return typeof place.address === 'string' ? place.address : '';
}

export function buildGlobalSearchGroups(params: {
  query: string;
  isSignedIn: boolean;
  trips: readonly TripSearchEntry[];
  places: readonly PlaceResult[];
  cities?: readonly CitySuggestion[];
}): GlobalSearchGroup[] {
  const tripsAndPlacesReady = shouldTriggerTypeahead(params.query);
  const citiesReady = shouldTriggerCityTypeahead(params.query);

  if (!tripsAndPlacesReady && !citiesReady) {
    return [];
  }

  const groups: GlobalSearchGroup[] = [];

  if (tripsAndPlacesReady) {
    const matchingTrips = filterUserTrips(params.trips, params.query, params.isSignedIn);
    if (params.isSignedIn && matchingTrips.length > 0) {
      groups.push({
        key: 'trips',
        label: 'My trips',
        items: matchingTrips.slice(0, 6),
      });
    }
  }

  if (citiesReady && Array.isArray(params.cities) && params.cities.length > 0) {
    const seenCities = new Set<string>();
    const cityItems: GlobalSearchCityItem[] = [];
    for (const city of params.cities) {
      if (!city || typeof city.name !== 'string' || !city.name.trim()) continue;
      const dedupeKey = `${city.name.trim().toLowerCase()}::${(city.admin || '').trim().toLowerCase()}::${(city.country || '').trim().toLowerCase()}`;
      if (seenCities.has(dedupeKey)) continue;
      seenCities.add(dedupeKey);

      cityItems.push({
        id: city.id || dedupeKey,
        name: city.name.trim(),
        subtitle: formatCitySecondary(city),
        isRegion: city.type === 'region',
        raw: city,
      });
      if (cityItems.length >= 6) break;
    }

    if (cityItems.length > 0) {
      groups.push({
        key: 'cities',
        label: 'Cities',
        items: cityItems,
      });
    }
  }

  if (tripsAndPlacesReady) {
    const seen = new Set<string>();
    const placeItems: GlobalSearchPlaceItem[] = [];
    for (const place of params.places) {
      if (!place || typeof place.name !== 'string' || !place.name.trim()) continue;
      const dedupeKey = `${place.name.trim().toLowerCase()}::${(place.city || '').trim().toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      placeItems.push({
        id: place.placeId || place._id || dedupeKey,
        name: place.name.trim(),
        subtitle: formatPlaceSubtitle(place),
        photoUrl: getPlacePhoto(place),
        raw: place,
      });
      if (placeItems.length >= 10) break;
    }

    if (placeItems.length > 0) {
      groups.push({
        key: 'places',
        label: 'Places',
        items: placeItems,
      });
    }
  }

  return groups;
}

export function isExternalOpenStreetMapResult(
  places: readonly PlaceResult[],
  externalFallbackUsed?: boolean
): boolean {
  if (externalFallbackUsed) return true;
  return places.some(
    (p) => p?.source === 'overpass' || p?.source === 'nominatim'
  );
}

export function nextSearchHighlightIndex(
  currentIndex: number,
  key: string,
  totalCount: number
): number {
  if (totalCount <= 0) return -1;
  if (key === 'ArrowDown') {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % totalCount;
  }
  if (key === 'ArrowUp') {
    return currentIndex <= 0 ? totalCount - 1 : currentIndex - 1;
  }
  return currentIndex;
}

export function isSlashShortcutTarget(target: {
  tagName?: string;
  isContentEditable?: boolean;
} | null): boolean {
  if (!target) return true;
  if (target.isContentEditable) return false;
  const tag = (target.tagName || '').toUpperCase();
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
}
