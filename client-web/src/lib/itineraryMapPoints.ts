/**
 * itineraryMapPoints.ts
 * Pure, erasable utility to extract grounded map coordinate points from an itinerary.
 *
 * Rules:
 * - Only includes activities with kind === 'place'
 * - Coordinates must be finite numbers within valid ranges (-90..90 lat, -180..180 lon)
 * - Coordinates at (0, 0) ("Null Island") are treated as invalid/uninitialized defaults and skipped.
 * - 'order' is the 1-indexed visit order of valid place stops within that day.
 * - 'skipped' counts place activities that lack valid geographic coordinates.
 */

export interface MapPoint {
  day: number;
  order: number;
  title: string;
  lat: number;
  lon: number;
}

export interface MapPointsResult {
  points: MapPoint[];
  skipped: number;
}

export type LatLngBounds = [[number, number], [number, number]];

/**
 * Validates whether latitude and longitude are finite, within legal bounds,
 * and not the uninitialized (0, 0) default.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  // Null Island (0, 0) indicates absent or uninitialized coordinates in our dataset
  if (lat === 0 && lon === 0) {
    return false;
  }
  return true;
}

/**
 * Extracts valid map points from an itinerary (array of days or journey object).
 */
export function itineraryMapPoints(itineraryInput: unknown): MapPointsResult {
  if (!itineraryInput) {
    return { points: [], skipped: 0 };
  }

  // Normalize days array from array or wrapper object (.days or .itinerary)
  let rawDays: unknown[] = [];
  if (Array.isArray(itineraryInput)) {
    rawDays = itineraryInput;
  } else if (typeof itineraryInput === 'object') {
    const obj = itineraryInput as Record<string, unknown>;
    if (Array.isArray(obj.days)) {
      rawDays = obj.days;
    } else if (Array.isArray(obj.itinerary)) {
      rawDays = obj.itinerary;
    }
  }

  const points: MapPoint[] = [];
  let skipped = 0;

  for (let dIdx = 0; dIdx < rawDays.length; dIdx++) {
    const rawDay = rawDays[dIdx];
    if (!rawDay || typeof rawDay !== 'object') continue;

    const dayObj = rawDay as Record<string, unknown>;
    const dayNum =
      typeof dayObj.day === 'number'
        ? dayObj.day
        : typeof dayObj.dayNumber === 'number'
        ? dayObj.dayNumber
        : dIdx + 1;

    // Daily activities can be named .items (GeneratedJourney) or .activities (Journey)
    const rawActivities: unknown[] = Array.isArray(dayObj.items)
      ? dayObj.items
      : Array.isArray(dayObj.activities)
      ? dayObj.activities
      : [];

    let dayOrder = 1;

    for (const rawAct of rawActivities) {
      if (!rawAct || typeof rawAct !== 'object') continue;
      const act = rawAct as Record<string, unknown>;

      // Determine kind: strictly match 'place'
      const rawKind =
        typeof act.kind === 'string'
          ? act.kind.toLowerCase().trim()
          : act.type === 'activity'
          ? 'place'
          : undefined;

      if (rawKind !== 'place') {
        // Non-place activities (meals, transit, rest, flights, etc.) are neither included nor counted as skipped
        continue;
      }

      // Extract latitude & longitude
      let lat: unknown = undefined;
      let lon: unknown = undefined;

      if (act.location && typeof act.location === 'object') {
        const loc = act.location as Record<string, unknown>;
        lat = loc.lat != null ? loc.lat : loc.latitude;
        lon = loc.lon != null ? loc.lon : loc.longitude;
      } else {
        lat = act.lat != null ? act.lat : act.latitude;
        lon = act.lon != null ? act.lon : act.longitude;
      }

      // Convert numeric strings if applicable, but reject NaN
      const numLat = typeof lat === 'number' ? lat : typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : NaN;
      const numLon = typeof lon === 'number' ? lon : typeof lon === 'string' && lon.trim() !== '' ? Number(lon) : NaN;

      if (isValidCoordinate(numLat, numLon)) {
        const title = typeof act.title === 'string' && act.title.trim() ? act.title.trim() : (act.name as string) || 'Activity';
        points.push({
          day: dayNum,
          order: dayOrder++,
          title,
          lat: numLat,
          lon: numLon,
        });
      } else {
        skipped++;
      }
    }
  }

  return { points, skipped };
}

/**
 * Calculates [[minLat, minLon], [maxLat, maxLon]] bounding box of points.
 * Returns null if points array is empty.
 */
export function boundsOf(points: MapPoint[]): LatLngBounds | null {
  if (!points || points.length === 0) {
    return null;
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lon < minLon) minLon = pt.lon;
    if (pt.lon > maxLon) maxLon = pt.lon;
  }

  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}
