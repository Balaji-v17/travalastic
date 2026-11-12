import TouristPlace from '../models/TouristPlace.js';
import { searchPlaces } from './placesService.js';
import { findTaggedPlaces } from './overpassService.js';

/**
 * Retrieves grounded candidate places for a destination:
 * (a) Curated places from TouristPlace by exact or fuzzy city match
 * (b) If fewer than 8, Overpass tourism/viewpoint/beach/temple/fort tags around destination centre (India restriction)
 * (c) Dedupe by name and rounded coordinates (3 decimal places)
 * Each candidate: { id, name, type, lat, lon, source: 'curated' | 'osm', note? }
 * Capped at ~30.
 *
 * @param {string} destination - Destination name (e.g. "Varkala")
 * @returns {Promise<Array<{id: string, name: string, type: string, lat: number, lon: number, source: 'curated'|'osm', note?: string}>>}
 */
export async function retrieveCandidates(destination) {
  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return [];
  }

  const cleanDest = destination.trim();
  const candidates = [];
  const seenKeys = new Set();
  const seenNames = new Set();

  // Geocode destination centre with India restriction (Nominatim)
  let destGeo = null;
  try {
    const geoResults = await searchPlaces(cleanDest, { countrycodes: 'in' });
    if (Array.isArray(geoResults) && geoResults.length > 0 && geoResults[0].latitude != null && geoResults[0].longitude != null) {
      destGeo = geoResults[0];
    }
  } catch (err) {
    console.warn('[CandidateRetrieval] Destination geocoding failed:', err.message);
  }

  // (a) Curated places from TouristPlace by exact/fuzzy city
  // Must use hidden: { $ne: true } so legacy records lacking the field are included, but hidden places are excluded.
  try {
    const textRegex = new RegExp(cleanDest, 'i');
    const curatedMatches = await TouristPlace.find({
      hidden: { $ne: true },
      $or: [{ city: textRegex }, { name: textRegex }],
    })
      .select('-embedding')
      .sort({ googleRating: -1 })
      .limit(30)
      .lean();

    for (const cp of curatedMatches) {
      if (!cp || !cp.name) continue;

      let lat = cp.lat != null ? Number(cp.lat) : cp.latitude != null ? Number(cp.latitude) : null;
      let lon = cp.lon != null ? Number(cp.lon) : cp.longitude != null ? Number(cp.longitude) : null;

      // If coordinates not stored on curated record, geocode place or fallback to destination centre
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        if (destGeo) {
          lat = Number(destGeo.latitude);
          lon = Number(destGeo.longitude);
        }
      }

      if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
        const roundedLat = Math.round(lat * 1000) / 1000;
        const roundedLon = Math.round(lon * 1000) / 1000;
        const normName = cp.name.toLowerCase().trim();
        const coordKey = `${roundedLat},${roundedLon}`;
        const key = `${normName}::${coordKey}`;

        if (!seenKeys.has(key) && !seenNames.has(normName)) {
          seenKeys.add(key);
          seenNames.add(normName);
          candidates.push({
            id: cp._id ? cp._id.toString() : `curated-${candidates.length + 1}`,
            name: cp.name.trim(),
            type: cp.type || 'Attraction',
            lat,
            lon,
            source: 'curated',
            note: cp.significance || cp.bestTimeToVisit || undefined,
          });
        }
      }
    }
  } catch (dbErr) {
    console.warn('[CandidateRetrieval] Curated places query failed:', dbErr.message);
  }

  // (b) If fewer than 8, query Overpass tourism/viewpoint/beach/temple/fort tags around destination centre
  if (candidates.length < 8 && destGeo) {
    try {
      const osmPlaces = await findTaggedPlaces(destGeo.latitude, destGeo.longitude, 'all', cleanDest);
      if (Array.isArray(osmPlaces)) {
        for (const op of osmPlaces) {
          if (candidates.length >= 30) break;
          if (!op || !op.name) continue;

          const lat = Number(op.lat);
          const lon = Number(op.lon);
          if (isNaN(lat) || isNaN(lon)) continue;

          const roundedLat = Math.round(lat * 1000) / 1000;
          const roundedLon = Math.round(lon * 1000) / 1000;
          const normName = op.name.toLowerCase().trim();
          const coordKey = `${roundedLat},${roundedLon}`;
          const key = `${normName}::${coordKey}`;

          if (!seenKeys.has(key) && !seenNames.has(normName)) {
            seenKeys.add(key);
            seenNames.add(normName);
            candidates.push({
              id: op.placeId || op.id || `osm-${candidates.length + 1}`,
              name: op.name.trim(),
              type: op.type || op.category || 'Attraction',
              lat,
              lon,
              source: 'osm',
              note: op.note || op.category || undefined,
            });
          }
        }
      }
    } catch (osmErr) {
      console.warn('[CandidateRetrieval] Overpass retrieval failed:', osmErr.message);
    }
  }

  // (c) If still fewer than 8, query OpenStreetMap Nominatim for attractions and beaches
  if (candidates.length < 8) {
    try {
      const queries = [`attractions in ${cleanDest}`, `beaches in ${cleanDest}`];
      for (const q of queries) {
        if (candidates.length >= 20) break;
        const nomResults = await searchPlaces(q, { countrycodes: 'in' });
        if (Array.isArray(nomResults)) {
          for (const np of nomResults) {
            if (candidates.length >= 30) break;
            if (!np || !np.name) continue;

            const lat = Number(np.latitude);
            const lon = Number(np.longitude);
            if (isNaN(lat) || isNaN(lon)) continue;

            const roundedLat = Math.round(lat * 1000) / 1000;
            const roundedLon = Math.round(lon * 1000) / 1000;
            const normName = np.name.toLowerCase().trim();
            const coordKey = `${roundedLat},${roundedLon}`;
            const key = `${normName}::${coordKey}`;

            if (!seenKeys.has(key) && !seenNames.has(normName)) {
              seenKeys.add(key);
              seenNames.add(normName);
              candidates.push({
                id: `nom-${candidates.length + 1}`,
                name: np.name.trim(),
                type: q.includes('beach') ? 'Beach' : 'Attraction',
                lat,
                lon,
                source: 'osm',
                note: np.address || undefined,
              });
            }
          }
        }
      }
    } catch (nomErr) {
      console.warn('[CandidateRetrieval] Nominatim candidate search failed:', nomErr.message);
    }
  }

  // Cap at ~30
  return candidates.slice(0, 30);
}

export default retrieveCandidates;
