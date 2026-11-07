// Pure helpers for generating ground transport redirect URLs (Uber and Rentalcars.com).

export interface CoordinatePoint {
  latitude?: number | string | null;
  longitude?: number | string | null;
  nickname?: string | null;
  formatted_address?: string | null;
}

export interface UberUrlOptions {
  pickup?: CoordinatePoint | null;
  dropoff?: CoordinatePoint | null;
  clientId?: string | null;
}

/**
 * Builds an Uber Universal Link for launching rides in the Uber app or m.uber.com.
 * Default pickup is "my_location" (Uber automatically resolves user GPS without our app needing permission).
 *
 * NOTE ON BRACKET ENCODING:
 * Standard URLSearchParams encodes brackets as %5B and %5D (e.g. dropoff%5Blatitude%5D=...).
 * Standard HTTP services and modern browsers decode this seamlessly.
 */
export function buildUberUrl(options: UberUrlOptions = {}): string {
  const url = new URL('https://m.uber.com/ul/');
  url.searchParams.set('action', 'setPickup');

  const { pickup, dropoff, clientId } = options;

  let hasExplicitPickup = false;
  if (pickup) {
    const pLat = typeof pickup.latitude === 'string' ? parseFloat(pickup.latitude) : Number(pickup.latitude);
    const pLon = typeof pickup.longitude === 'string' ? parseFloat(pickup.longitude) : Number(pickup.longitude);
    if (
      Number.isFinite(pLat) &&
      Number.isFinite(pLon) &&
      pLat >= -90 &&
      pLat <= 90 &&
      pLon >= -180 &&
      pLon <= 180
    ) {
      url.searchParams.set('pickup[latitude]', String(pLat));
      url.searchParams.set('pickup[longitude]', String(pLon));
      const pNick = (pickup.nickname || pickup.formatted_address || '').trim();
      if (pNick.length > 0) {
        url.searchParams.set('pickup[nickname]', pNick.slice(0, 100));
      }
      hasExplicitPickup = true;
    }
  }

  if (!hasExplicitPickup) {
    url.searchParams.set('pickup', 'my_location');
  }

  if (dropoff) {
    const dLat = typeof dropoff.latitude === 'string' ? parseFloat(dropoff.latitude) : Number(dropoff.latitude);
    const dLon = typeof dropoff.longitude === 'string' ? parseFloat(dropoff.longitude) : Number(dropoff.longitude);
    const nick = (dropoff.nickname || dropoff.formatted_address || '').trim();

    if (
      Number.isFinite(dLat) &&
      Number.isFinite(dLon) &&
      dLat >= -90 &&
      dLat <= 90 &&
      dLon >= -180 &&
      dLon <= 180 &&
      nick.length > 0
    ) {
      url.searchParams.set('dropoff[latitude]', String(dLat));
      url.searchParams.set('dropoff[longitude]', String(dLon));
      url.searchParams.set('dropoff[nickname]', nick.slice(0, 100));
    }
  }

  if (clientId && typeof clientId === 'string' && clientId.trim().length > 0) {
    url.searchParams.set('client_id', clientId.trim());
  }

  return url.toString();
}

export interface RentalInput {
  location?: string | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  driverAge?: number | string | null;
}

export interface RentalValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  errorList: string[];
}

export function validateRental(
  input: RentalInput,
  now: Date = new Date()
): RentalValidationResult {
  const errors: Record<string, string> = {};

  // Location validation: 2 to 80 chars
  const loc = (input.location || '').trim();
  if (!loc) {
    errors.location = 'Pickup location is required.';
  } else if (loc.length < 2) {
    errors.location = 'Pickup location must be at least 2 characters.';
  } else if (loc.length > 80) {
    errors.location = 'Pickup location cannot exceed 80 characters.';
  }

  // Today reference string YYYY-MM-DD in local time
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const pickup = (input.pickupAt || '').trim();
  const dropoff = (input.dropoffAt || '').trim();

  let pickupValid = false;
  let dropoffValid = false;

  if (!pickup) {
    errors.pickupAt = 'Pickup date is required.';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(pickup) || isNaN(Date.parse(pickup))) {
    errors.pickupAt = 'Please enter a valid pickup date (YYYY-MM-DD).';
  } else if (pickup < todayStr) {
    errors.pickupAt = 'Pickup date cannot be in the past.';
  } else {
    pickupValid = true;
  }

  if (!dropoff) {
    errors.dropoffAt = 'Drop-off date is required.';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dropoff) || isNaN(Date.parse(dropoff))) {
    errors.dropoffAt = 'Please enter a valid drop-off date (YYYY-MM-DD).';
  } else {
    dropoffValid = true;
  }

  if (pickupValid && dropoffValid) {
    if (dropoff <= pickup) {
      errors.dropoffAt = 'Drop-off date must be after pickup date.';
    } else {
      const pDate = new Date(pickup);
      const dDate = new Date(dropoff);
      const diffMs = dDate.getTime() - pDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        errors.dropoffAt = 'Rental duration cannot exceed 30 days.';
      }
    }
  }

  // Driver age: optional, but if provided must be 21 to 75
  if (input.driverAge !== undefined && input.driverAge !== null && String(input.driverAge).trim() !== '') {
    const rawAge = String(input.driverAge).trim();
    const ageNum = Number(rawAge);
    if (!Number.isInteger(ageNum) || isNaN(ageNum)) {
      errors.driverAge = 'Please enter a valid driver age.';
    } else if (ageNum < 21 || ageNum > 75) {
      errors.driverAge = 'Driver age must be between 21 and 75.';
    }
  }

  const errorList = Object.values(errors);
  return {
    valid: errorList.length === 0,
    errors,
    errorList,
  };
}

export interface RentalUrlOptions {
  location: string;
  pickupDate?: string | null;
  dropoffDate?: string | null;
  affiliateId?: string | null;
}

export function buildRentalUrl(options: RentalUrlOptions): string {
  const url = new URL('https://www.rentalcars.com/search-results');
  const loc = (options.location || '').trim();
  url.searchParams.set('locationName', loc);
  url.searchParams.set('dropLocationName', loc);

  if (options.pickupDate && options.pickupDate.trim()) {
    url.searchParams.set('pickupDate', options.pickupDate.trim());
  }
  if (options.dropoffDate && options.dropoffDate.trim()) {
    url.searchParams.set('dropoffDate', options.dropoffDate.trim());
  }

  const aid = (options.affiliateId || '').trim();
  if (aid) {
    url.searchParams.set('affiliateCode', aid);
    url.searchParams.set('aid', aid);
  }

  return url.toString();
}

/**
 * Extracts normalized geographic coordinates and name from an activity or place object.
 * Returns null if missing, non-finite, out of range, or without a valid coordinate.
 *
 * COORDINATE DECISION:
 * 0,0 (Null Island: equator/prime meridian) is treated as valid if and only if both latitude and
 * longitude are explicitly set as finite numeric values within the standard range (-90..90, -180..180).
 */
export function extractActivityCoordinates(
  activity?: any
): { latitude: number; longitude: number; name: string } | null {
  if (!activity || typeof activity !== 'object') return null;

  const loc = activity.location ?? activity;
  const rawLat = loc.lat != null ? loc.lat : loc.latitude;
  const rawLon = loc.lon != null ? loc.lon : loc.longitude;

  if (rawLat == null || rawLon == null) return null;

  const lat = typeof rawLat === 'string' ? parseFloat(rawLat) : Number(rawLat);
  const lon = typeof rawLon === 'string' ? parseFloat(rawLon) : Number(rawLon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const name = String(
    activity.title || activity.name || loc.placeName || loc.name || 'Activity'
  ).trim();

  return { latitude: lat, longitude: lon, name };
}

export function activityHasCoordinates(activity?: any): boolean {
  return extractActivityCoordinates(activity) !== null;
}

/**
 * Checks whether a booking or rental URL includes an affiliate identifier (`aid` or `affiliateCode`).
 */
export function isAffiliateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const aid = parsed.searchParams.get('aid') || parsed.searchParams.get('affiliateCode');
    return Boolean(aid && aid.trim().length > 0);
  } catch {
    return false;
  }
}
