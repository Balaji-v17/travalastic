/**
 * getOsmLink
 *
 * Builds an OpenStreetMap marker link for the given coordinates.
 * Validates coordinate ranges:
 * - Latitude must be finite number between -90 and 90
 * - Longitude must be finite number between -180 and 180
 * - Rejects 0, 0 (Null Island) or non-numeric/empty values
 *
 * @param lat Latitude (number or string)
 * @param lon Longitude (number or string)
 * @returns OSM URL string, or null if coordinates are invalid
 */
export function getOsmLink(
  lat: number | string | null | undefined,
  lon: number | string | null | undefined
): string | null {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return null;
  }
  const strLat = String(lat).trim();
  const strLon = String(lon).trim();
  if (!strLat || !strLon) {
    return null;
  }

  const numLat = Number(strLat);
  const numLon = Number(strLon);

  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
    return null;
  }

  if (numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
    return null;
  }

  // Reject Null Island (0, 0)
  if (numLat === 0 && numLon === 0) {
    return null;
  }

  return `https://www.openstreetmap.org/?mlat=${numLat}&mlon=${numLon}#map=16/${numLat}/${numLon}`;
}

