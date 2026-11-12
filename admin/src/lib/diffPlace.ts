import type { PlaceFormValues } from './placeForm.ts';

export interface PlaceModel {
  _id?: string;
  id?: string;
  name: string;
  city: string;
  state: string;
  type: string;
  zone?: string | null;
  significance?: string | null;
  bestTimeToVisit?: string | null;
  latitude: number | null;
  longitude: number | null;
  googleRating?: number | null;
  entranceFeeINR?: number | null;
  timeNeededHours?: number | null;
  hidden?: boolean;
  hiddenReason?: string | null;
  source?: string;
  isCurated?: boolean;
  embeddingStale?: boolean;
  updatedByEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * diffPlace(original, edited)
 *
 * Computes the minimal update payload containing ONLY fields that changed.
 * Key constraints:
 * - Latitude and longitude must always be sent together if either changed.
 * - Clearing an optional field sends null so the server clears it.
 * - Returns empty object {} if no changes were made.
 */
export function diffPlace(
  original: PlaceModel | null | undefined,
  values: PlaceFormValues
): Record<string, any> {
  const diff: Record<string, any> = {};

  // Create mode: return all defined fields formatted for POST /admin/places
  if (!original) {
    const payload: Record<string, any> = {
      name: (values.name || '').trim(),
      city: (values.city || '').trim(),
      state: (values.state || '').trim(),
      type: (values.type || '').trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };

    if (values.zone && values.zone.trim().length > 0) {
      payload.zone = values.zone.trim();
    }
    if (values.significance && values.significance.trim().length > 0) {
      payload.significance = values.significance.trim();
    }
    if (values.bestTimeToVisit && values.bestTimeToVisit.trim().length > 0) {
      payload.bestTimeToVisit = values.bestTimeToVisit.trim();
    }
    if (values.googleRating !== undefined && values.googleRating !== '' && values.googleRating !== null) {
      payload.googleRating = Number(values.googleRating);
    }
    if (values.entranceFeeINR !== undefined && values.entranceFeeINR !== '' && values.entranceFeeINR !== null) {
      payload.entranceFeeINR = Number(values.entranceFeeINR);
    }
    if (values.timeNeededHours !== undefined && values.timeNeededHours !== '' && values.timeNeededHours !== null) {
      payload.timeNeededHours = Number(values.timeNeededHours);
    }

    return payload;
  }

  // Edit mode: compare against original
  // Required text fields
  const stringFields = ['name', 'city', 'state', 'type'] as const;
  for (const field of stringFields) {
    const current = (values[field] || '').trim();
    const orig = (original[field] || '').trim();
    if (current !== orig) {
      diff[field] = current;
    }
  }

  // Optional text fields (clearing sends null)
  const optionalStringFields = ['zone', 'significance', 'bestTimeToVisit'] as const;
  for (const field of optionalStringFields) {
    const current = values[field] !== undefined ? values[field]!.trim() : '';
    const orig = (original[field] || '').trim();
    if (current !== orig) {
      diff[field] = current.length > 0 ? current : null;
    }
  }

  // Optional numeric fields (googleRating, timeNeededHours)
  const optionalNumberFields = ['googleRating', 'timeNeededHours'] as const;
  for (const field of optionalNumberFields) {
    const rawVal = values[field];
    const currentVal = rawVal !== undefined && rawVal !== '' && rawVal !== null ? Number(rawVal) : null;
    const origVal = original[field] !== undefined && original[field] !== null ? Number(original[field]) : null;
    if (currentVal !== origVal) {
      diff[field] = currentVal;
    }
  }

  // entranceFeeINR
  const rawFee = values.entranceFeeINR;
  const currentFee = rawFee !== undefined && rawFee !== '' && rawFee !== null ? Number(rawFee) : 0;
  const origFee = original.entranceFeeINR !== undefined && original.entranceFeeINR !== null ? Number(original.entranceFeeINR) : 0;
  if (currentFee !== origFee) {
    diff.entranceFeeINR = currentFee;
  }

  // Coordinates: latitude and longitude MUST be sent together if either changed
  const rawLat = values.latitude;
  const rawLon = values.longitude;
  const currentLat = rawLat !== undefined && rawLat !== '' && rawLat !== null ? Number(rawLat) : null;
  const currentLon = rawLon !== undefined && rawLon !== '' && rawLon !== null ? Number(rawLon) : null;
  const origLat = original.latitude !== undefined && original.latitude !== null ? Number(original.latitude) : null;
  const origLon = original.longitude !== undefined && original.longitude !== null ? Number(original.longitude) : null;

  const latChanged = currentLat !== origLat;
  const lonChanged = currentLon !== origLon;

  if (latChanged || lonChanged) {
    diff.latitude = currentLat;
    diff.longitude = currentLon;
  }

  return diff;
}

