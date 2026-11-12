export interface PlaceFormValues {
  name: string;
  city: string;
  state: string;
  type: string;
  latitude: string;
  longitude: string;
  zone?: string;
  significance?: string;
  bestTimeToVisit?: string;
  googleRating?: string;
  entranceFeeINR?: string;
  timeNeededHours?: string;
}

export interface PlaceValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const HTML_TAG_REGEX = /<[^>]*>/;

/**
 * Validates place form values for fast client-side feedback.
 * Mirrors the server-side validation rules exactly:
 * - name: 2-120 characters, required, no HTML
 * - city, state, type: 1-100 characters, required, no HTML
 * - latitude & longitude: required together, -90..90 and -180..180, cannot be 0, 0
 * - googleRating: 0-5
 * - entranceFeeINR: >= 0
 * - timeNeededHours: 0-48
 * - zone, bestTimeToVisit: <= 100 characters, no HTML
 * - significance: <= 500 characters, no HTML
 */
export function validatePlaceForm(
  values: PlaceFormValues,
  mode: 'create' | 'edit' = 'create'
): PlaceValidationResult {
  const errors: Record<string, string> = {};

  // Name validation
  const nameTrimmed = (values.name || '').trim();
  if (!nameTrimmed) {
    errors.name = 'Name is required';
  } else if (HTML_TAG_REGEX.test(values.name)) {
    errors.name = 'HTML tags are not allowed in name';
  } else if (nameTrimmed.length < 2 || nameTrimmed.length > 120) {
    errors.name = 'Name must be between 2 and 120 characters';
  }

  // City validation
  const cityTrimmed = (values.city || '').trim();
  if (!cityTrimmed) {
    errors.city = 'City is required';
  } else if (HTML_TAG_REGEX.test(values.city)) {
    errors.city = 'HTML tags are not allowed in city';
  } else if (cityTrimmed.length > 100) {
    errors.city = 'City must be between 1 and 100 characters';
  }

  // State validation
  const stateTrimmed = (values.state || '').trim();
  if (!stateTrimmed) {
    errors.state = 'State is required';
  } else if (HTML_TAG_REGEX.test(values.state)) {
    errors.state = 'HTML tags are not allowed in state';
  } else if (stateTrimmed.length > 100) {
    errors.state = 'State must be between 1 and 100 characters';
  }

  // Type validation
  const typeTrimmed = (values.type || '').trim();
  if (!typeTrimmed) {
    errors.type = 'Type is required';
  } else if (HTML_TAG_REGEX.test(values.type)) {
    errors.type = 'HTML tags are not allowed in type';
  } else if (typeTrimmed.length > 100) {
    errors.type = 'Type must be between 1 and 100 characters';
  }

  // Coordinates validation
  const latStr = (values.latitude ?? '').toString().trim();
  const lonStr = (values.longitude ?? '').toString().trim();
  const hasLat = latStr.length > 0;
  const hasLon = lonStr.length > 0;

  if (mode === 'create') {
    if (!hasLat && !hasLon) {
      errors.latitude = 'Latitude is required';
      errors.longitude = 'Longitude is required';
    } else if (!hasLat) {
      errors.latitude = 'Latitude and longitude must be entered together';
    } else if (!hasLon) {
      errors.longitude = 'Latitude and longitude must be entered together';
    }
  } else {
    // Edit mode: if either coordinate is entered, both must be entered together
    if ((hasLat && !hasLon) || (!hasLat && hasLon)) {
      if (!hasLat) errors.latitude = 'Latitude and longitude must be updated together';
      if (!hasLon) errors.longitude = 'Latitude and longitude must be updated together';
    }
  }

  if (hasLat && hasLon) {
    const latNum = Number(latStr);
    const lonNum = Number(lonStr);

    let latValid = true;
    let lonValid = true;

    if (!Number.isFinite(latNum)) {
      errors.latitude = 'Latitude must be a valid number';
      latValid = false;
    } else if (latNum < -90 || latNum > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
      latValid = false;
    }

    if (!Number.isFinite(lonNum)) {
      errors.longitude = 'Longitude must be a valid number';
      lonValid = false;
    } else if (lonNum < -180 || lonNum > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
      lonValid = false;
    }

    if (latValid && lonValid && latNum === 0 && lonNum === 0) {
      errors.latitude = 'Coordinates cannot be 0, 0';
      errors.longitude = 'Coordinates cannot be 0, 0';
    }
  }

  // Optional: Zone
  if (values.zone !== undefined && values.zone !== null) {
    const zoneTrimmed = values.zone.trim();
    if (HTML_TAG_REGEX.test(values.zone)) {
      errors.zone = 'HTML tags are not allowed in zone';
    } else if (zoneTrimmed.length > 100) {
      errors.zone = 'Zone cannot exceed 100 characters';
    }
  }

  // Optional: Significance
  if (values.significance !== undefined && values.significance !== null) {
    const sigTrimmed = values.significance.trim();
    if (HTML_TAG_REGEX.test(values.significance)) {
      errors.significance = 'HTML tags are not allowed in significance';
    } else if (sigTrimmed.length > 500) {
      errors.significance = 'Significance cannot exceed 500 characters';
    }
  }

  // Optional: Best Time to Visit
  if (values.bestTimeToVisit !== undefined && values.bestTimeToVisit !== null) {
    const timeTrimmed = values.bestTimeToVisit.trim();
    if (HTML_TAG_REGEX.test(values.bestTimeToVisit)) {
      errors.bestTimeToVisit = 'HTML tags are not allowed in bestTimeToVisit';
    } else if (timeTrimmed.length > 100) {
      errors.bestTimeToVisit = 'Best time to visit cannot exceed 100 characters';
    }
  }

  // Optional: Google Rating
  if (values.googleRating !== undefined && values.googleRating !== null) {
    const ratingStr = values.googleRating.toString().trim();
    if (ratingStr.length > 0) {
      const ratingNum = Number(ratingStr);
      if (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 5) {
        errors.googleRating = 'Google rating must be between 0 and 5';
      }
    }
  }

  // Optional: Entrance Fee INR
  if (values.entranceFeeINR !== undefined && values.entranceFeeINR !== null) {
    const feeStr = values.entranceFeeINR.toString().trim();
    if (feeStr.length > 0) {
      const feeNum = Number(feeStr);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        errors.entranceFeeINR = 'Entrance fee must be 0 or greater';
      }
    }
  }

  // Optional: Time Needed Hours
  if (values.timeNeededHours !== undefined && values.timeNeededHours !== null) {
    const hoursStr = values.timeNeededHours.toString().trim();
    if (hoursStr.length > 0) {
      const hoursNum = Number(hoursStr);
      if (!Number.isFinite(hoursNum) || hoursNum < 0 || hoursNum > 48) {
        errors.timeNeededHours = 'Time needed must be between 0 and 48 hours';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

