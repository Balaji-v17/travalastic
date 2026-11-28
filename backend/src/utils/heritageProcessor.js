/**
 * Pure processing, validation, flag detection, state normalization, and duplicate grouping
 * helpers for ASI / Survey of India heritage monuments.
 */

export const HERITAGE_SOURCE = 'asi-soi-heritage';
export const HERITAGE_TYPE = 'Heritage monument';

export const INDIA_BBOX = {
  minLat: 6.5,
  maxLat: 37.5,
  minLng: 68.0,
  maxLng: 97.5,
};

export const BLOCKING_PUBLISH_FLAGS = [
  'coords_outside_india',
  'broken_text',
  'generic_name',
  'state_unmapped',
];

export const ALL_REVIEW_FLAGS = [
  'coords_outside_india',
  'broken_text',
  'no_description',
  'possible_duplicate',
  'state_unmapped',
  'generic_name',
  'matches_curated',
];

export const GENERIC_NAME_WORDS = new Set([
  'fort',
  'temple',
  'mosque',
  'tomb',
  'tombs',
  'church',
  'gate',
  'well',
  'pillar',
  'stambha',
  'mound',
  'inscription',
  'cave',
  'caves',
  'palace',
  'ruins',
  'building',
  'monument',
]);

const CANONICAL_STATES = new Set([
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli',
  'Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]);

const STATE_ALIASES = {
  'chhatisgarh': 'Chhattisgarh',
  'chhattisgarh': 'Chhattisgarh',
  'dadar & nagar haveli': 'Dadra and Nagar Haveli',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli',
  'daman & diu': 'Daman and Diu',
  'daman and diu': 'Daman and Diu',
  'jammu & kashmir': 'Jammu and Kashmir',
  'jammu and kashmir': 'Jammu and Kashmir',
  'andaman & nicobar': 'Andaman and Nicobar Islands',
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  'andaman and nicobar islands': 'Andaman and Nicobar Islands',
  'orissa': 'Odisha',
  'uttaranchal': 'Uttarakhand',
  'pondicherry': 'Puducherry',
  'maharastra': 'Maharashtra',
};

/**
 * Strips ASCII/C1 control characters (preserving U+FFFD so broken_text detection works),
 * collapses internal whitespace, and trims. Never rewrites names beyond that.
 */
export function cleanHeritageText(input) {
  if (input == null) return '';
  return String(input)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasBrokenText(input) {
  if (input == null) return false;
  return String(input).includes('\uFFFD');
}

export function normalizeCompareKey(input) {
  return cleanHeritageText(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (word === 'and' || word === 'of') return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Normalizes a heritage state name to the spelling used in TouristPlace.
 * Empty state returns { state: null, unmapped: true }.
 */
export function normalizeHeritageState(rawState) {
  const cleaned = cleanHeritageText(rawState);
  if (!cleaned) {
    return { state: null, unmapped: true };
  }

  const key = cleaned.toLowerCase();
  if (STATE_ALIASES[key]) {
    return { state: STATE_ALIASES[key], unmapped: false };
  }

  const titled = toTitleCase(cleaned);
  if (CANONICAL_STATES.has(titled)) {
    return { state: titled, unmapped: false };
  }

  for (const canonical of CANONICAL_STATES) {
    if (canonical.toLowerCase() === key) {
      return { state: canonical, unmapped: false };
    }
  }

  return { state: titled, unmapped: true };
}

/**
 * Flags generic 1- or 2-word monument names (e.g. "Fort", "Siva Temple").
 */
export function isGenericHeritageName(name) {
  const cleaned = normalizeCompareKey(name);
  if (!cleaned) return false;
  const tokens = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.length >= 1 && tokens.length <= 2 && tokens.every((t) => GENERIC_NAME_WORDS.has(t));
}

export function isWithinIndiaBbox(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= INDIA_BBOX.minLat &&
    lat <= INDIA_BBOX.maxLat &&
    lng >= INDIA_BBOX.minLng &&
    lng <= INDIA_BBOX.maxLng
  );
}

/**
 * Computes approximate Haversine distance in meters between two lat/lng pairs.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isAsiRecord(rowOrDoc) {
  const sourceId = String(rowOrDoc?.sourceId || rowOrDoc?.entity_uid || '').toLowerCase();
  const rawSource = String(rowOrDoc?.rawSource || rowOrDoc?.source || '').toLowerCase();
  return sourceId.startsWith('asi:') || rawSource.includes('asi');
}

/**
 * Re-evaluates quality flags on a place after an admin edit.
 * Preserves 'possible_duplicate' if already present unless name/city changed away.
 */
export function recomputeHeritageFlags(doc, { preservePossibleDuplicate = true } = {}) {
  const flags = new Set();

  const lat = Number(doc.latitude);
  const lng = Number(doc.longitude);
  if (!isWithinIndiaBbox(lat, lng)) {
    flags.add('coords_outside_india');
  }

  const textFields = [
    doc.name,
    doc.city,
    doc.state,
    doc.significance,
    doc.heritage?.location,
  ];
  if (textFields.some((f) => hasBrokenText(f))) {
    flags.add('broken_text');
  }

  if (!cleanHeritageText(doc.significance)) {
    flags.add('no_description');
  }

  if (!cleanHeritageText(doc.state)) {
    flags.add('state_unmapped');
  } else {
    const stateNorm = normalizeHeritageState(doc.state);
    if (stateNorm.unmapped) {
      flags.add('state_unmapped');
    }
  }

  if (isGenericHeritageName(doc.name)) {
    flags.add('generic_name');
  }

  if (
    preservePossibleDuplicate &&
    Array.isArray(doc.reviewFlags) &&
    doc.reviewFlags.includes('possible_duplicate')
  ) {
    flags.add('possible_duplicate');
  }

  if (
    Array.isArray(doc.reviewFlags) &&
    doc.reviewFlags.includes('matches_curated')
  ) {
    flags.add('matches_curated');
  }

  return Array.from(flags);
}

/**
 * Returns unresolved blocking flags that prohibit publishing.
 */
export function getBlockingPublishFlags(doc) {
  const flags = Array.isArray(doc?.reviewFlags) ? doc.reviewFlags : [];
  const blocking = flags.filter((f) => BLOCKING_PUBLISH_FLAGS.includes(f));
  if (!cleanHeritageText(doc?.state) && !blocking.includes('state_unmapped')) {
    blocking.push('state_unmapped');
  }
  return blocking;
}

/**
 * Validates and transforms a single CSV row from heritage_sites.csv into a TouristPlace candidate.
 */
export function transformHeritageRow(row) {
  if (!row || typeof row !== 'object') {
    return { valid: false, reason: 'empty_row' };
  }

  const sourceId = cleanHeritageText(row.entity_uid);
  const name = cleanHeritageText(row.site_name);
  if (!sourceId || !name) {
    return { valid: false, reason: 'missing_identity' };
  }

  const rawLat = cleanHeritageText(row.latitude);
  const rawLng = cleanHeritageText(row.longitude);
  if (!rawLat || !rawLng) {
    return { valid: false, reason: 'missing_coordinates' };
  }
  const latitude = Number(rawLat);
  const longitude = Number(rawLng);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return { valid: false, reason: 'invalid_coordinates' };
  }

  const district = cleanHeritageText(row.district);
  const location = cleanHeritageText(row.location);
  const { state, unmapped: stateUnmapped } = normalizeHeritageState(row.state);

  // Map district to city, fallback to location, state, or 'Unknown' so city is never blank
  const city = district || location || state || 'Unknown';

  const cleanedDesc = cleanHeritageText(row.description);
  const significance = cleanedDesc ? cleanedDesc : null;

  const protectedBy = cleanHeritageText(row.protected_by) || null;
  const asiCircle = cleanHeritageText(row.asi_circle) || null;
  const rawSource = cleanHeritageText(row.source);

  const reviewFlags = [];
  if (!isWithinIndiaBbox(latitude, longitude)) {
    reviewFlags.push('coords_outside_india');
  }
  if (
    hasBrokenText(row.site_name) ||
    hasBrokenText(row.description) ||
    hasBrokenText(row.district) ||
    hasBrokenText(row.location) ||
    hasBrokenText(row.state)
  ) {
    reviewFlags.push('broken_text');
  }
  if (!significance) {
    reviewFlags.push('no_description');
  }
  if (stateUnmapped) {
    reviewFlags.push('state_unmapped');
  }
  if (isGenericHeritageName(name)) {
    reviewFlags.push('generic_name');
  }

  return {
    valid: true,
    _meta: {
      isAsi: isAsiRecord({ sourceId, rawSource }),
      normName: normalizeCompareKey(name),
      normDistrict: normalizeCompareKey(district),
      normState: normalizeCompareKey(state || ''),
      rawDistrict: district,
    },
    doc: {
      sourceId,
      name,
      city,
      state,
      zone: null,
      type: HERITAGE_TYPE,
      significance,
      googleRating: null,
      entranceFeeINR: null,
      timeNeededHours: null,
      bestTimeToVisit: null,
      hidden: true,
      hiddenReason: 'pending_review',
      isCurated: false,
      source: HERITAGE_SOURCE,
      placeId: null,
      latitude,
      longitude,
      embeddingStale: true,
      reviewFlags,
      heritage: {
        protectedBy,
        asiCircle,
        location: location || null,
        coordsApprox: true,
        mergedSourceIds: [],
        extraCoords: [],
        matchedCuratedPlace: null,
      },
    },
  };
}

function chooseRepresentativeCompare(a, b) {
  // 1. Prefer ASI over SOI
  if (a._meta.isAsi !== b._meta.isAsi) {
    return a._meta.isAsi ? -1 : 1;
  }
  // 2. Prefer non-empty description
  const aHasDesc = Boolean(a.doc.significance);
  const bHasDesc = Boolean(b.doc.significance);
  if (aHasDesc !== bHasDesc) {
    return aHasDesc ? -1 : 1;
  }
  // 3. Lowest entity_uid
  return a.doc.sourceId.localeCompare(b.doc.sourceId);
}

function areNamesSimilarForProximity(normA, normB) {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }
  return false;
}

/**
 * Groups transformed candidates by (normalised name, district, state):
 * - Keeps ONE representative (ASI > SOI, description > empty, lowest entity_uid) with hiddenReason 'pending_review'
 *   and stores merged sourceIds in heritage.mergedSourceIds.
 * - Marks the other group members hiddenReason 'duplicate' and flags 'possible_duplicate'.
 * - Also flags 'possible_duplicate' on distinct records within the same district & state whose names are similar within 150m.
 */
export function resolveHeritageGroupsAndDuplicates(candidates) {
  const groups = new Map();

  for (const item of candidates) {
    const key = `${item._meta.normName}|${item._meta.normDistrict}|${item._meta.normState}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  const representatives = [];
  const allDocs = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      representatives.push(group[0]);
      allDocs.push(group[0].doc);
      continue;
    }

    const sorted = [...group].sort(chooseRepresentativeCompare);
    const rep = sorted[0];
    const others = sorted.slice(1);

    rep.doc.heritage.mergedSourceIds = others.map((o) => o.doc.sourceId);
    representatives.push(rep);
    allDocs.push(rep.doc);

    for (const dup of others) {
      dup.doc.hidden = true;
      dup.doc.hiddenReason = 'duplicate';
      if (!dup.doc.reviewFlags.includes('possible_duplicate')) {
        dup.doc.reviewFlags.push('possible_duplicate');
      }
      allDocs.push(dup.doc);
    }
  }

  // Proximity check within same (district, state) for similar names within 150 m
  const districtBuckets = new Map();
  for (const rep of representatives) {
    if (!rep._meta.normDistrict) continue;
    const bKey = `${rep._meta.normDistrict}|${rep._meta.normState}`;
    if (!districtBuckets.has(bKey)) {
      districtBuckets.set(bKey, []);
    }
    districtBuckets.get(bKey).push(rep);
  }

  for (const bucket of districtBuckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (!areNamesSimilarForProximity(a._meta.normName, b._meta.normName)) continue;
        const dist = haversineMeters(
          a.doc.latitude,
          a.doc.longitude,
          b.doc.latitude,
          b.doc.longitude
        );
        if (dist <= 150) {
          if (!a.doc.reviewFlags.includes('possible_duplicate')) {
            a.doc.reviewFlags.push('possible_duplicate');
          }
          if (!b.doc.reviewFlags.includes('possible_duplicate')) {
            b.doc.reviewFlags.push('possible_duplicate');
          }
        }
      }
    }
  }

  return allDocs;
}

function sameCoreIdentityText(a, b) {
  return (
    normalizeCompareKey(a.doc.name) === normalizeCompareKey(b.doc.name) &&
    cleanHeritageText(a.doc.significance) === cleanHeritageText(b.doc.significance) &&
    normalizeCompareKey(a._meta?.rawDistrict ?? '') === normalizeCompareKey(b._meta?.rawDistrict ?? '') &&
    normalizeCompareKey(a.doc.heritage?.location ?? '') === normalizeCompareKey(b.doc.heritage?.location ?? '')
  );
}

function addExtraCoordIfDistinct(doc, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (doc.latitude === lat && doc.longitude === lng) return false;
  if (!Array.isArray(doc.heritage.extraCoords)) {
    doc.heritage.extraCoords = [];
  }
  const exists = doc.heritage.extraCoords.some((c) => c.lat === lat && c.lng === lng);
  if (!exists) {
    doc.heritage.extraCoords.push({ lat, lng });
  }
  return true;
}

/**
 * Resolves repeated `entity_uid` rows by CSV order:
 * - Identical non-coordinate identity + same coordinates -> skipped (`skippedExactRepeats`).
 * - Identical name/description/district/location + different coordinates -> kept first, extra centroids appended to `heritage.extraCoords` (`coordinateOnlyRepeats`).
 * - Differing name, description, district, or location -> stored as distinct record with `sourceId = ${entity_uid}#${n}` (`addedDistinctRepeats`).
 */
export function resolveRepeatedEntityUids(candidates) {
  const byUid = new Map();
  const resolved = [];
  let skippedExactRepeats = 0;
  let coordinateOnlyRepeats = 0;
  let addedDistinctRepeats = 0;

  for (const item of candidates) {
    const baseUid = item.doc.sourceId;
    if (!byUid.has(baseUid)) {
      if (!Array.isArray(item.doc.heritage.extraCoords)) {
        item.doc.heritage.extraCoords = [];
      }
      byUid.set(baseUid, [item]);
      resolved.push(item);
      continue;
    }

    const keptEntries = byUid.get(baseUid);
    const matchingTextEntry = keptEntries.find((prev) => sameCoreIdentityText(prev, item));

    if (matchingTextEntry) {
      const sameCoords =
        matchingTextEntry.doc.latitude === item.doc.latitude &&
        matchingTextEntry.doc.longitude === item.doc.longitude;

      if (sameCoords) {
        skippedExactRepeats++;
      } else {
        addExtraCoordIfDistinct(matchingTextEntry.doc, item.doc.latitude, item.doc.longitude);
        coordinateOnlyRepeats++;
      }
      continue;
    }

    const repeatIndex = keptEntries.length + 1;
    item.doc.sourceId = `${baseUid}#${repeatIndex}`;
    if (!Array.isArray(item.doc.heritage.extraCoords)) {
      item.doc.heritage.extraCoords = [];
    }
    keptEntries.push(item);
    resolved.push(item);
    addedDistinctRepeats++;
  }

  return {
    candidates: resolved,
    stats: {
      totalInput: candidates.length,
      uniqueRecords: resolved.length,
      skippedExactRepeats,
      coordinateOnlyRepeats,
      addedDistinctRepeats,
    },
  };
}

function normCuratedBase(input) {
  return cleanHeritageText(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`¦]s\b/g, 's')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getNameAliases(name) {
  const base = normCuratedBase(name);
  if (!base) return [];
  const aliases = new Set([base]);

  const stripped = base
    .replace(/^(the|a|an)\s+/g, '')
    .replace(/\b(complex|group of monuments|archaeological ruins|monuments|monument|ruins|remains|site)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length >= 4) {
    aliases.add(stripped);
  }

  const knownAsMatch = base.match(/\bknown as\s+(.+)$/);
  if (knownAsMatch && knownAsMatch[1].trim().length >= 4) {
    aliases.add(knownAsMatch[1].trim());
  }

  return Array.from(aliases);
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

function namesMatchNearIdentical(nameA, nameB) {
  const aliasesA = getNameAliases(nameA);
  const aliasesB = getNameAliases(nameB);

  for (const x of aliasesA) {
    for (const y of aliasesB) {
      if (x === y) return true;
      const maxLen = Math.max(x.length, y.length);
      if (maxLen >= 6) {
        const dist = levenshteinDistance(x, y);
        if (1 - dist / maxLen >= 0.88) return true;
      }

      const shorter = x.length <= y.length ? x : y;
      const longer = x.length <= y.length ? y : x;
      if (shorter.length >= 8 && (longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`))) {
        const extraTokens = longer.slice(shorter.length).trim().split(' ').filter(Boolean);
        if (extraTokens.length <= 3) return true;
      }

      const tokX = x.split(' ').filter((t) => t.length > 1);
      const tokY = y.split(' ').filter((t) => t.length > 1);
      if (tokX.length >= 2 && tokX.length === tokY.length) {
        if ([...tokX].sort().join(' ') === [...tokY].sort().join(' ')) return true;
      }
    }
  }
  return false;
}

function namesMatchSimilarNearby(nameA, nameB) {
  if (namesMatchNearIdentical(nameA, nameB)) return true;
  const aliasesA = getNameAliases(nameA);
  const aliasesB = getNameAliases(nameB);
  for (const x of aliasesA) {
    for (const y of aliasesB) {
      const tokX = new Set(x.split(' ').filter((t) => t.length > 2));
      const tokY = new Set(y.split(' ').filter((t) => t.length > 2));
      if (tokX.size === 0 || tokY.size === 0) continue;
      let shared = 0;
      for (const t of tokX) {
        if (tokY.has(t)) shared++;
      }
      if (shared >= 1 && shared / Math.min(tokX.size, tokY.size) >= 0.5) {
        return true;
      }
    }
  }
  return false;
}

function normalizeStateForCuratedCompare(rawState) {
  const { state } = normalizeHeritageState(rawState);
  return normCuratedBase(state || rawState || '');
}

/**
 * Finds the best matching non-heritage TouristPlace when either:
 * - Same normalized state AND near-identical normalized name (`same_state_name`)
 * - Within 500 m AND similar name (`within_500m_similar_name`)
 */
export function findCuratedOverlap(heritageDoc, curatedPlaces = []) {
  if (!heritageDoc || !Array.isArray(curatedPlaces) || curatedPlaces.length === 0) {
    return null;
  }

  const hState = normalizeStateForCuratedCompare(heritageDoc.state);
  const hLat = Number(heritageDoc.latitude);
  const hLng = Number(heritageDoc.longitude);
  const hasHCoords =
    heritageDoc.latitude !== null &&
    heritageDoc.latitude !== undefined &&
    heritageDoc.longitude !== null &&
    heritageDoc.longitude !== undefined &&
    Number.isFinite(hLat) &&
    Number.isFinite(hLng) &&
    !(hLat === 0 && hLng === 0);

  for (const curated of curatedPlaces) {
    if (!curated || curated.source === HERITAGE_SOURCE) continue;
    const placeId = curated._id ? String(curated._id) : curated.id ? String(curated.id) : null;
    if (!placeId || !curated.name) continue;

    const cState = normalizeStateForCuratedCompare(curated.state);
    if (hState && cState && hState === cState && namesMatchNearIdentical(heritageDoc.name, curated.name)) {
      return {
        placeId,
        name: curated.name,
        city: curated.city || null,
        state: curated.state || null,
        reason: 'same_state_name',
        distanceMeters: null,
      };
    }

    const cLat = Number(curated.latitude);
    const cLng = Number(curated.longitude);
    const hasCCoords =
      curated.latitude !== null &&
      curated.latitude !== undefined &&
      curated.longitude !== null &&
      curated.longitude !== undefined &&
      Number.isFinite(cLat) &&
      Number.isFinite(cLng) &&
      !(cLat === 0 && cLng === 0);

    if (hasHCoords && hasCCoords) {
      const dist = Math.round(haversineMeters(hLat, hLng, cLat, cLng));
      if (dist <= 500 && namesMatchSimilarNearby(heritageDoc.name, curated.name)) {
        return {
          placeId,
          name: curated.name,
          city: curated.city || null,
          state: curated.state || null,
          reason: 'within_500m_similar_name',
          distanceMeters: dist,
        };
      }
    }
  }

  return null;
}

/**
 * Annotates heritage docs with `'matches_curated'` and `heritage.matchedCuratedPlace`.
 */
export function applyCuratedOverlapFlags(docs, curatedPlaces = []) {
  let matchedCount = 0;
  for (const doc of docs) {
    const match = findCuratedOverlap(doc, curatedPlaces);
    if (!doc.heritage) doc.heritage = {};
    if (!Array.isArray(doc.reviewFlags)) doc.reviewFlags = [];
    if (match) {
      doc.heritage.matchedCuratedPlace = match;
      if (!doc.reviewFlags.includes('matches_curated')) {
        doc.reviewFlags.push('matches_curated');
      }
      matchedCount++;
    } else {
      doc.heritage.matchedCuratedPlace = null;
      doc.reviewFlags = doc.reviewFlags.filter((f) => f !== 'matches_curated');
    }
  }
  return matchedCount;
}
