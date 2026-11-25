export type RecordedBookingKind = 'hotel' | 'bus' | 'train' | 'cab' | 'car_rental';
export type RecordedBookingStatus = 'booked' | 'cancelled';

export interface RecordedBookingFormInput {
  kind: RecordedBookingKind;
  title: string;
  provider: string;
  startAt: string;
  endAt?: string;
  reference?: string;
  amount?: string;
  currency?: string;
  status?: RecordedBookingStatus;
  notes?: string;
  tripId?: string | null;
}

export const RECORDED_BOOKING_KINDS: RecordedBookingKind[] = [
  'hotel',
  'bus',
  'train',
  'cab',
  'car_rental',
];

export const AMOUNT_REGEX = /^\d{1,9}(\.\d{1,2})?$/;
export const CURRENCY_REGEX = /^[A-Z]{3}$/;
export const HTML_TAG_REGEX = /<[^>]*>|[<>]/;
export const LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

export function parseLocalDateTimeString(input: string): {
  ok: boolean;
  normalized?: string;
  datePart?: string;
  timePart?: string;
  error?: string;
} {
  if (typeof input !== 'string') return { ok: false, error: 'Date must be text' };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Date is required' };

  const match = trimmed.match(LOCAL_DATETIME_REGEX);
  if (!match) {
    return {
      ok: false,
      error: 'Use YYYY-MM-DD or YYYY-MM-DDTHH:mm (no timezone offset)',
    };
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
      return { ok: false, error: 'Invalid clock time' };
    }
    timePart = secs !== null ? `${match[4]}:${match[5]}:${match[6]}` : `${match[4]}:${match[5]}`;
  }

  return {
    ok: true,
    normalized: timePart ? `${datePart}T${timePart}` : datePart,
    datePart,
    timePart,
  };
}

/**
 * Client-side validation mirroring backend/src/services/tripBookingService.js.
 */
export function validateRecordedBookingForm(input: RecordedBookingFormInput): {
  ok: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!RECORDED_BOOKING_KINDS.includes(input.kind)) {
    errors.kind = 'Choose a valid booking type';
  }

  const checkText = (field: string, val: string | undefined, maxLen: number, required: boolean) => {
    const trimmed = (val || '').trim();
    if (required && !trimmed) {
      errors[field] = `${field === 'title' ? 'Title' : 'Provider'} is required`;
      return;
    }
    if (trimmed.length > maxLen) {
      errors[field] = `Must be ${maxLen} characters or fewer`;
      return;
    }
    if (trimmed && HTML_TAG_REGEX.test(trimmed)) {
      errors[field] = 'HTML tags and < > characters are not allowed';
    }
  };

  checkText('title', input.title, 120, true);
  checkText('provider', input.provider, 80, true);
  checkText('reference', input.reference, 60, false);
  checkText('notes', input.notes, 300, false);

  const startParsed = parseLocalDateTimeString(input.startAt || '');
  if (!startParsed.ok) {
    errors.startAt = startParsed.error || 'Start date is required';
  }

  const cleanEnd = (input.endAt || '').trim();
  if (cleanEnd) {
    const endParsed = parseLocalDateTimeString(cleanEnd);
    if (!endParsed.ok) {
      errors.endAt = endParsed.error || 'Invalid end date';
    } else if (startParsed.ok && startParsed.datePart && endParsed.datePart) {
      if (endParsed.datePart < startParsed.datePart) {
        errors.endAt = 'End date must be on or after start date';
      } else if (
        endParsed.datePart === startParsed.datePart &&
        startParsed.timePart &&
        endParsed.timePart
      ) {
        const sTime = startParsed.timePart.length === 5 ? `${startParsed.timePart}:00` : startParsed.timePart;
        const eTime = endParsed.timePart.length === 5 ? `${endParsed.timePart}:00` : endParsed.timePart;
        if (eTime < sTime) {
          errors.endAt = 'End time must be on or after start time';
        }
      }
    }
  }

  const cleanAmount = (input.amount || '').trim();
  if (cleanAmount && !AMOUNT_REGEX.test(cleanAmount)) {
    errors.amount = 'Enter a valid amount (e.g. 1250 or 1250.50, max 2 decimals)';
  }

  const cleanCurrency = (input.currency || '').trim().toUpperCase();
  if (cleanCurrency && !CURRENCY_REGEX.test(cleanCurrency)) {
    errors.currency = 'Currency must be a 3-letter ISO code (e.g. INR, USD)';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

