import mongoose from 'mongoose';
import { getLocalDateString } from './tripStatus.js';

export const RECORDED_KINDS = ['hotel', 'bus', 'train', 'cab', 'car_rental'];
export const ALL_BOOKING_KINDS = ['flight', ...RECORDED_KINDS];
export const RECORDED_STATUSES = ['booked', 'cancelled'];
export const AMOUNT_REGEX = /^\d{1,9}(\.\d{1,2})?$/;
export const CURRENCY_REGEX = /^[A-Z]{3}$/;
export const HTML_TAG_REGEX = /<[^>]*>|[<>]/;
export const LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Checks whether a string contains HTML tags or angle brackets.
 * Rejects all HTML content; only plain text is allowed.
 */
export function containsHtml(text) {
  return typeof text === 'string' && HTML_TAG_REGEX.test(text);
}

/**
 * Validates and normalizes a local date or local date+time string without timezone conversion.
 * Accepted: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss", or "YYYY-MM-DD HH:mm".
 * Rejects strings with UTC offsets ('Z', '+05:30', etc.) or invalid calendar dates (e.g. Feb 30).
 *
 * @param {string} input
 * @returns {{ ok: boolean, normalized?: string, datePart?: string, timePart?: string, error?: string }}
 */
export function parseLocalDateTimeString(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Date must be a string' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Date is required' };
  }

  const match = trimmed.match(LOCAL_DATETIME_REGEX);
  if (!match) {
    return { ok: false, error: 'Date must be YYYY-MM-DD or YYYY-MM-DDTHH:mm (no timezone offset)' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, error: 'Invalid calendar month or day' };
  }

  const utcCheck = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    utcCheck.getUTCFullYear() !== year ||
    utcCheck.getUTCMonth() !== month - 1 ||
    utcCheck.getUTCDate() !== day
  ) {
    return { ok: false, error: 'Invalid calendar date' };
  }

  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  let timePart = '';

  if (match[4] !== undefined && match[5] !== undefined) {
    const hours = parseInt(match[4], 10);
    const mins = parseInt(match[5], 10);
    const secs = match[6] !== undefined ? parseInt(match[6], 10) : null;
    if (hours < 0 || hours > 23 || mins < 0 || mins > 59 || (secs !== null && (secs < 0 || secs > 59))) {
      return { ok: false, error: 'Invalid time of day' };
    }
    timePart = secs !== null ? `${match[4]}:${match[5]}:${match[6]}` : `${match[4]}:${match[5]}`;
  }

  const normalized = timePart ? `${datePart}T${timePart}` : datePart;
  return { ok: true, normalized, datePart, timePart };
}

/**
 * Returns true if end >= start using pure date and clock parts.
 */
export function isEndOnOrAfterStart(startParsed, endParsed) {
  if (endParsed.datePart > startParsed.datePart) return true;
  if (endParsed.datePart < startParsed.datePart) return false;
  // Same date: if both specify times, compare time parts padded to seconds
  if (startParsed.timePart && endParsed.timePart) {
    const sTime = startParsed.timePart.length === 5 ? `${startParsed.timePart}:00` : startParsed.timePart;
    const eTime = endParsed.timePart.length === 5 ? `${endParsed.timePart}:00` : endParsed.timePart;
    return eTime >= sTime;
  }
  return true;
}

/**
 * Validates create or partial update payload for a recorded TripBooking.
 * For partial updates (PATCH), pass `existing` so endAt >= startAt and required fields remain valid.
 *
 * @param {Object} payload
 * @param {Object|null} [existing=null]
 * @returns {{ ok: true, data: Object } | { ok: false, errors: Record<string, string>, message: string }}
 */
export function validateTripBookingInput(payload, existing = null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: { body: 'Request body must be an object' }, message: 'Request body must be an object' };
  }

  const isPatch = Boolean(existing);
  const errors = {};
  const data = {};

  const checkPlainText = (field, rawVal, maxLen, required) => {
    if (rawVal === undefined) {
      if (!isPatch && required) {
        errors[field] = `${field} is required`;
      }
      return undefined;
    }
    if (rawVal === null) {
      if (required) {
        errors[field] = `${field} is required`;
      } else {
        return '';
      }
      return undefined;
    }
    if (typeof rawVal !== 'string') {
      errors[field] = `${field} must be plain text`;
      return undefined;
    }
    const trimmed = rawVal.trim();
    if (required && !trimmed) {
      errors[field] = `${field} is required`;
      return undefined;
    }
    if (trimmed.length > maxLen) {
      errors[field] = `${field} must be ${maxLen} characters or fewer`;
      return undefined;
    }
    if (containsHtml(trimmed)) {
      errors[field] = `${field} cannot contain HTML tags`;
      return undefined;
    }
    return trimmed;
  };

  // kind
  const rawKind = payload.kind !== undefined ? payload.kind : existing?.kind;
  if (!rawKind || typeof rawKind !== 'string' || !RECORDED_KINDS.includes(rawKind.trim())) {
    errors.kind = `kind must be one of: ${RECORDED_KINDS.join(', ')}`;
  } else if (payload.kind !== undefined || !isPatch) {
    data.kind = rawKind.trim();
  }

  // title
  const titleVal = checkPlainText('title', payload.title, 120, true);
  if (titleVal !== undefined) data.title = titleVal;

  // provider
  const providerVal = checkPlainText('provider', payload.provider, 80, true);
  if (providerVal !== undefined) data.provider = providerVal;

  // reference (optional)
  const refVal = checkPlainText('reference', payload.reference, 60, false);
  if (refVal !== undefined) data.reference = refVal;

  // notes (optional)
  const notesVal = checkPlainText('notes', payload.notes, 300, false);
  if (notesVal !== undefined) data.notes = notesVal;

  // startAt & endAt
  const effectiveStartInput = payload.startAt !== undefined ? payload.startAt : existing?.startAt;
  const effectiveEndInput = payload.endAt !== undefined ? payload.endAt : existing?.endAt;

  let startParsed = null;
  if (!effectiveStartInput || (typeof effectiveStartInput === 'string' && !effectiveStartInput.trim())) {
    errors.startAt = 'startAt is required';
  } else {
    startParsed = parseLocalDateTimeString(effectiveStartInput);
    if (!startParsed.ok) {
      errors.startAt = startParsed.error;
    } else if (payload.startAt !== undefined || !isPatch) {
      data.startAt = startParsed.normalized;
    }
  }

  if (effectiveEndInput !== undefined && effectiveEndInput !== null && String(effectiveEndInput).trim() !== '') {
    const endParsed = parseLocalDateTimeString(effectiveEndInput);
    if (!endParsed.ok) {
      errors.endAt = endParsed.error;
    } else {
      if (startParsed?.ok && !isEndOnOrAfterStart(startParsed, endParsed)) {
        errors.endAt = 'endAt must be on or after startAt';
      } else if (payload.endAt !== undefined || !isPatch) {
        data.endAt = endParsed.normalized;
      }
    }
  } else if (payload.endAt !== undefined) {
    data.endAt = '';
  }

  // amount (strictly decimal string matching ^\d{1,9}(\.\d{1,2})?$, never float)
  if (payload.amount !== undefined) {
    if (payload.amount === null || payload.amount === '') {
      data.amount = '';
    } else if (typeof payload.amount !== 'string') {
      errors.amount = 'amount must be a decimal string';
    } else {
      const trimmedAmt = payload.amount.trim();
      if (trimmedAmt === '') {
        data.amount = '';
      } else if (!AMOUNT_REGEX.test(trimmedAmt)) {
        errors.amount = 'amount must match up to 9 digits with optional 1–2 decimals (e.g. 1250.50)';
      } else {
        data.amount = trimmedAmt;
      }
    }
  }

  // currency (optional ISO 3 letters)
  if (payload.currency !== undefined) {
    if (payload.currency === null || payload.currency === '') {
      data.currency = '';
    } else if (typeof payload.currency !== 'string') {
      errors.currency = 'currency must be a 3-letter ISO code';
    } else {
      const trimmedCur = payload.currency.trim().toUpperCase();
      if (trimmedCur === '') {
        data.currency = '';
      } else if (!CURRENCY_REGEX.test(trimmedCur)) {
        errors.currency = 'currency must be a 3-letter ISO code (e.g. INR, USD)';
      } else {
        data.currency = trimmedCur;
      }
    }
  }

  // status
  if (payload.status !== undefined) {
    if (typeof payload.status !== 'string' || !RECORDED_STATUSES.includes(payload.status.trim())) {
      errors.status = 'status must be booked or cancelled';
    } else {
      data.status = payload.status.trim();
    }
  } else if (!isPatch) {
    data.status = 'booked';
  }

  // tripId
  if (payload.tripId !== undefined) {
    if (payload.tripId === null || payload.tripId === '') {
      data.tripId = null;
    } else if (typeof payload.tripId !== 'string' || !mongoose.Types.ObjectId.isValid(payload.tripId.trim())) {
      errors.tripId = 'Invalid tripId';
    } else {
      data.tripId = payload.tripId.trim();
    }
  }

  const firstMsg = Object.values(errors)[0];
  if (firstMsg) {
    return { ok: false, errors, message: firstMsg };
  }

  return { ok: true, data };
}

/**
 * Extracts airport-local departure/arrival string for a Duffel Booking document
 * without shifting timezone via Date.toLocaleString.
 */
function extractDuffelFlightTime(booking, which = 'departure') {
  const slices = Array.isArray(booking?.slices) ? booking.slices : [];
  if (which === 'departure') {
    const firstSeg = slices[0]?.segments?.[0];
    if (firstSeg?.departing_at && typeof firstSeg.departing_at === 'string') {
      return firstSeg.departing_at.trim();
    }
  } else {
    const lastSlice = slices[slices.length - 1];
    const lastSegs = lastSlice?.segments || [];
    const lastSeg = lastSegs[lastSegs.length - 1];
    if (lastSeg?.arriving_at && typeof lastSeg.arriving_at === 'string') {
      return lastSeg.arriving_at.trim();
    }
  }

  const raw = which === 'departure' ? booking?.departureTime : booking?.arrivalTime;
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    // Strip millisecond/Z suffix only as fallback when stored as Date object
    return raw.toISOString().slice(0, 19);
  }
  return '';
}

/**
 * Normalizes a Duffel Booking document into the unified /bookings/all shape.
 */
export function normalizeDuffelBookingItem(rawBooking) {
  const b = typeof rawBooking.toObject === 'function' ? rawBooking.toObject() : rawBooking;
  const origin = b.origin ? String(b.origin).trim().toUpperCase() : '';
  const destination = b.destination ? String(b.destination).trim().toUpperCase() : '';
  const airline = b.airline ? String(b.airline).trim() : 'Flight';
  const startAt = extractDuffelFlightTime(b, 'departure');
  const endAt = extractDuffelFlightTime(b, 'arrival');
  const rawStatus = b.status ? String(b.status).trim().toLowerCase() : 'confirmed';
  const status = rawStatus === 'cancelled' ? 'cancelled' : 'booked';

  return {
    id: String(b._id || b.id || ''),
    kind: 'flight',
    source: 'duffel',
    title: origin && destination ? `${origin} → ${destination}` : airline,
    subtitle: airline,
    provider: airline,
    startAt,
    endAt,
    status,
    rawStatus,
    reference: b.bookingReference ? String(b.bookingReference).trim() : '',
    amount: b.totalAmount != null ? String(b.totalAmount) : '',
    currency: b.currency ? String(b.currency).trim().toUpperCase() : '',
    notes: '',
    tripId: b.itineraryId ? String(b.itineraryId) : null,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : '',
    flight: b,
  };
}

/**
 * Normalizes a user-recorded TripBooking document into the unified /bookings/all shape.
 */
export function normalizeRecordedBookingItem(rawRecorded) {
  const r = typeof rawRecorded.toObject === 'function' ? rawRecorded.toObject() : rawRecorded;
  return {
    id: String(r._id || r.id || ''),
    kind: r.kind,
    source: 'recorded',
    title: r.title || '',
    subtitle: r.provider || '',
    provider: r.provider || '',
    startAt: r.startAt || '',
    endAt: r.endAt || '',
    status: r.status === 'cancelled' ? 'cancelled' : 'booked',
    rawStatus: r.status === 'cancelled' ? 'cancelled' : 'booked',
    reference: r.reference || '',
    amount: r.amount || '',
    currency: r.currency || '',
    notes: r.notes || '',
    tripId: r.tripId ? String(r.tripId) : null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
  };
}

/**
 * Maps filter aliases (e.g. 'flights' -> 'flight') to canonical kind keys.
 */
export function normalizeKindFilter(rawKind) {
  if (!rawKind || typeof rawKind !== 'string') return 'all';
  const k = rawKind.trim().toLowerCase();
  if (!k || k === 'all') return 'all';
  const aliases = {
    flight: 'flight',
    flights: 'flight',
    hotel: 'hotel',
    hotels: 'hotel',
    bus: 'bus',
    buses: 'bus',
    train: 'train',
    trains: 'train',
    cab: 'cab',
    cabs: 'cab',
    car_rental: 'car_rental',
    car_rentals: 'car_rental',
    rental: 'car_rental',
  };
  return aliases[k] || null;
}

/**
 * Classifies a unified booking item into upcoming | past | cancelled using date-only comparisons.
 */
export function classifyBookingWhen(item, todayLocal = getLocalDateString()) {
  if (!item) return 'past';
  if (item.status === 'cancelled' || item.rawStatus === 'cancelled') {
    return 'cancelled';
  }
  const refStr = item.endAt || item.startAt || '';
  const dateMatch = typeof refStr === 'string' ? refStr.match(/^(\d{4}-\d{2}-\d{2})/) : null;
  if (!dateMatch) {
    return 'upcoming';
  }
  return dateMatch[1] >= todayLocal ? 'upcoming' : 'past';
}

/**
 * Merges Duffel flight orders and recorded bookings, applies filters, sorts by startAt ascending, and paginates.
 */
export function buildMergedBookingsResponse({
  duffelBookings = [],
  recordedBookings = [],
  kind = 'all',
  when = 'all',
  page = 1,
  limit = 50,
  todayLocal = getLocalDateString(),
}) {
  const allMerged = [
    ...duffelBookings.map(normalizeDuffelBookingItem),
    ...recordedBookings.map(normalizeRecordedBookingItem),
  ];

  // Sort chronologically by startAt ascending; empty startAt sorted after dated items; tie-break by createdAt desc
  allMerged.sort((a, b) => {
    const aStart = a.startAt || '';
    const bStart = b.startAt || '';
    if (aStart && !bStart) return -1;
    if (!aStart && bStart) return 1;
    if (aStart !== bStart) {
      return aStart < bStart ? -1 : 1;
    }
    const aCreated = a.createdAt || '';
    const bCreated = b.createdAt || '';
    if (aCreated === bCreated) return 0;
    return aCreated > bCreated ? -1 : 1;
  });

  // Compute summary counts before filtering
  const counts = {
    total: allMerged.length,
    byKind: {
      flight: 0,
      hotel: 0,
      bus: 0,
      train: 0,
      cab: 0,
      car_rental: 0,
    },
    byWhen: {
      upcoming: 0,
      past: 0,
      cancelled: 0,
    },
  };

  for (const item of allMerged) {
    if (counts.byKind[item.kind] !== undefined) {
      counts.byKind[item.kind] += 1;
    }
    const w = classifyBookingWhen(item, todayLocal);
    if (counts.byWhen[w] !== undefined) {
      counts.byWhen[w] += 1;
    }
  }

  // Apply kind & when filters
  const filtered = allMerged.filter((item) => {
    if (kind && kind !== 'all' && item.kind !== kind) {
      return false;
    }
    if (when && when !== 'all') {
      return classifyBookingWhen(item, todayLocal) === when;
    }
    return true;
  });

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const offset = (safePage - 1) * safeLimit;
  const items = filtered.slice(offset, offset + safeLimit);

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    counts,
  };
}

