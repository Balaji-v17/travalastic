export type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
export type Gender = 'm' | 'f';

export interface PassengerInput {
  givenName: string;
  familyName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender?: Gender;
  title?: Title;
}

export interface ContactInput {
  email: string;
  phone: string;
}

export interface PassengerErrors {
  givenName?: string;
  familyName?: string;
  dateOfBirth?: string;
  gender?: string;
  title?: string;
}

export interface ContactErrors {
  email?: string;
  phone?: string;
}

export interface ValidationResult {
  isValid: boolean;
  passengerErrors: PassengerErrors[];
  contactErrors: ContactErrors;
  allErrors: string[];
}

export interface ValidationRules {
  minAdultAge?: number;
  maxAdultAge?: number;
}

const NAME_REGEX = /^[\p{L}\s'\-]+$/u;
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a single passenger according to backend & airline rules.
 * Default rules:
 * - Given & family names: 1-40 characters, Unicode letters, spaces, hyphens, and apostrophes.
 * - Date of birth: YYYY-MM-DD calendar date, not in the future, plausible adult age (18-120).
 * - Title & Gender: validated against allowed enums if provided.
 */
export function validatePassenger(
  p: PassengerInput,
  today?: string | Date,
  rules?: ValidationRules
): PassengerErrors {
  const errors: PassengerErrors = {};

  // Given Name
  if (!p.givenName || !p.givenName.trim()) {
    errors.givenName = 'Given name (first name) is required';
  } else {
    const trimmed = p.givenName.trim();
    if (trimmed.length > 40) {
      errors.givenName = 'Given name must be 40 characters or fewer';
    } else if (!NAME_REGEX.test(trimmed)) {
      errors.givenName = 'Given name can only contain letters, spaces, hyphens, and apostrophes';
    }
  }

  // Family Name
  if (!p.familyName || !p.familyName.trim()) {
    errors.familyName = 'Family name (last name) is required';
  } else {
    const trimmed = p.familyName.trim();
    if (trimmed.length > 40) {
      errors.familyName = 'Family name must be 40 characters or fewer';
    } else if (!NAME_REGEX.test(trimmed)) {
      errors.familyName = 'Family name can only contain letters, spaces, hyphens, and apostrophes';
    }
  }

  // Date of Birth
  if (!p.dateOfBirth || !p.dateOfBirth.trim()) {
    errors.dateOfBirth = 'Date of birth is required (YYYY-MM-DD)';
  } else {
    const dobStr = p.dateOfBirth.trim();
    if (!DATE_FORMAT_REGEX.test(dobStr)) {
      errors.dateOfBirth = 'Date of birth must be in YYYY-MM-DD format';
    } else {
      const parts = dobStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      const utcDate = new Date(Date.UTC(year, month - 1, day));
      if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
      ) {
        errors.dateOfBirth = 'Date of birth is not a valid calendar date';
      } else {
        const refDate = today ? new Date(today) : new Date();
        const refUTC = new Date(
          Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate())
        );

        if (utcDate > refUTC) {
          errors.dateOfBirth = 'Date of birth cannot be in the future';
        } else {
          let age = refUTC.getUTCFullYear() - year;
          const monthDiff = refUTC.getUTCMonth() - (month - 1);
          if (monthDiff < 0 || (monthDiff === 0 && refUTC.getUTCDate() < day)) {
            age--;
          }

          const minAge = rules?.minAdultAge ?? 18;
          const maxAge = rules?.maxAdultAge ?? 120;

          if (age < minAge) {
            errors.dateOfBirth = `Adult passenger must be at least ${minAge} years old`;
          } else if (age > maxAge) {
            errors.dateOfBirth = 'Please enter a plausible date of birth';
          }
        }
      }
    }
  }

  // Title validation
  if (p.title && !['mr', 'ms', 'mrs', 'miss', 'dr'].includes(p.title.toLowerCase())) {
    errors.title = 'Title must be one of: Mr, Ms, Mrs, Miss, Dr';
  }

  // Gender validation
  if (p.gender && !['m', 'f'].includes(p.gender.toLowerCase())) {
    errors.gender = 'Gender must be Male or Female';
  }

  return errors;
}

/**
 * Validates contact details (email and phone number).
 * Spaces and hyphens in phone numbers are stripped prior to checking E.164 compliance.
 * Requires '+' followed by 8 to 15 digits.
 */
export function validateContact(contact: ContactInput): ContactErrors {
  const errors: ContactErrors = {};

  if (!contact.email || !contact.email.trim()) {
    errors.email = 'Contact email is required';
  } else if (!EMAIL_REGEX.test(contact.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!contact.phone || !contact.phone.trim()) {
    errors.phone = 'Contact phone number is required';
  } else {
    const raw = contact.phone.trim();
    // Strip permissible spacing and dashes
    const stripped = raw.replace(/[\s\-().]/g, '');

    if (!stripped.startsWith('+')) {
      errors.phone = "Phone number must start with '+' and country code (e.g. +1)";
    } else {
      const digitsOnly = stripped.slice(1);
      if (!/^\d+$/.test(digitsOnly)) {
        errors.phone = 'Phone number can only contain digits, spaces, and hyphens';
      } else if (digitsOnly.length < 8) {
        errors.phone = 'Phone number is too short (minimum 8 digits including country code)';
      } else if (digitsOnly.length > 15) {
        errors.phone = 'Phone number is too long (maximum 15 digits)';
      } else if (digitsOnly.startsWith('0')) {
        errors.phone = 'Country code cannot start with 0';
      }
    }
  }

  return errors;
}

/**
 * Validates all passengers and contact information.
 * Returns aggregated per-field error maps and a human-readable list of errors.
 */
export function validateAllPassengers(
  passengers: PassengerInput[],
  contact: ContactInput,
  today?: string | Date,
  rules?: ValidationRules
): ValidationResult {
  const passengerErrors: PassengerErrors[] = [];
  const allErrors: string[] = [];

  let isAnyPassengerInvalid = false;

  passengers.forEach((p, idx) => {
    const errs = validatePassenger(p, today, rules);
    passengerErrors.push(errs);

    const pNum = idx + 1;
    if (errs.givenName) {
      allErrors.push(`Passenger ${pNum}: ${errs.givenName}`);
      isAnyPassengerInvalid = true;
    }
    if (errs.familyName) {
      allErrors.push(`Passenger ${pNum}: ${errs.familyName}`);
      isAnyPassengerInvalid = true;
    }
    if (errs.dateOfBirth) {
      allErrors.push(`Passenger ${pNum}: ${errs.dateOfBirth}`);
      isAnyPassengerInvalid = true;
    }
    if (errs.title) {
      allErrors.push(`Passenger ${pNum}: ${errs.title}`);
      isAnyPassengerInvalid = true;
    }
    if (errs.gender) {
      allErrors.push(`Passenger ${pNum}: ${errs.gender}`);
      isAnyPassengerInvalid = true;
    }
  });

  const contactErrors = validateContact(contact);
  if (contactErrors.email) {
    allErrors.push(`Contact: ${contactErrors.email}`);
  }
  if (contactErrors.phone) {
    allErrors.push(`Contact: ${contactErrors.phone}`);
  }

  const isValid = !isAnyPassengerInvalid && !contactErrors.email && !contactErrors.phone;

  return {
    isValid,
    passengerErrors,
    contactErrors,
    allErrors,
  };
}

/**
 * Converts a decimal string to integer minor units (scaled to 4 decimal places) using BigInt.
 * Avoids any floating-point representation or rounding errors.
 */
function parseToMinorUnits(amountStr: string): bigint | null {
  if (typeof amountStr !== 'string') return null;
  const trimmed = amountStr.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const isNegative = !!match[1];
  const whole = match[2];
  let fraction = match[3] || '';

  if (fraction.length > 4) {
    fraction = fraction.slice(0, 4);
  } else {
    fraction = fraction.padEnd(4, '0');
  }

  try {
    const rawDigits = `${whole}${fraction}`;
    const val = BigInt(rawDigits);
    return isNegative ? -val : val;
  } catch {
    return null;
  }
}

export type PriceComparisonResult = 'same' | 'higher' | 'lower' | 'currency_changed';

/**
 * Compares two monetary amounts exactly using BigInt integer minor units.
 * comparePrices(oldPrice, newPrice):
 * - returns 'higher' if newPrice > oldPrice
 * - returns 'lower' if newPrice < oldPrice
 * - returns 'same' if equal
 * - returns 'currency_changed' if currencies do not match
 * - returns null if either input is invalid/malformed without throwing
 */
export function comparePrices(
  a: string | { amount: string; currency?: string } | null | undefined,
  b: string | { amount: string; currency?: string } | null | undefined
): PriceComparisonResult | null {
  if (a == null || b == null) return null;

  const amountA = typeof a === 'object' ? a.amount : a;
  const amountB = typeof b === 'object' ? b.amount : b;

  const currencyA = typeof a === 'object' && a.currency ? a.currency.trim().toUpperCase() : undefined;
  const currencyB = typeof b === 'object' && b.currency ? b.currency.trim().toUpperCase() : undefined;

  if (currencyA && currencyB && currencyA !== currencyB) {
    return 'currency_changed';
  }

  const unitsA = parseToMinorUnits(amountA);
  const unitsB = parseToMinorUnits(amountB);

  if (unitsA === null || unitsB === null) {
    return null;
  }

  if (unitsB > unitsA) return 'higher';
  if (unitsB < unitsA) return 'lower';
  return 'same';
}

export type BookingStatus =
  | 'editing'
  | 'repricing'
  | 'review'
  | 'submitting'
  | 'confirmed'
  | 'failed'
  | 'unknown';

export interface BookingState {
  status: BookingStatus;
  passengers: PassengerInput[];
  contact: ContactInput;
  itineraryId: string | null;
  originalPrice: { amount: string; currency: string } | null;
  currentPrice: { amount: string; currency: string } | null;
  priceComparison: PriceComparisonResult | null;
  priceAccepted: boolean;
  confirmation: any | null;
  error: { status?: number; code?: string; message: string } | null;
}

export const initialBookingState: BookingState = {
  status: 'editing',
  passengers: [],
  contact: { email: '', phone: '' },
  itineraryId: null,
  originalPrice: null,
  currentPrice: null,
  priceComparison: null,
  priceAccepted: false,
  confirmation: null,
  error: null,
};

export type BookingAction =
  | {
      type: 'START_REPRICE';
      passengers: PassengerInput[];
      contact: ContactInput;
      itineraryId?: string | null;
      originalPrice: { amount: string; currency: string };
    }
  | {
      type: 'REPRICE_SUCCESS';
      newPrice: { amount: string; currency: string };
    }
  | {
      type: 'REPRICE_FAILED';
      error: { status?: number; code?: string; message: string };
    }
  | { type: 'ACCEPT_PRICE' }
  | { type: 'SUBMIT_BOOKING' }
  | {
      type: 'BOOKING_SUCCESS';
      confirmation: any;
    }
  | {
      type: 'BOOKING_FAILURE';
      error: { status?: number; code?: string; message: string };
    }
  | { type: 'BACK_TO_EDIT' }
  | { type: 'RESET' };

/**
 * Pure state machine reducer managing the flight booking lifecycle.
 * Rules:
 * - submit is ignored unless state is 'review'
 * - a network error/timeout/5xx during submitting goes to 'unknown' (NOT 'failed')
 * - 'failed' only for definite server rejections (400, 409, 410, 422)
 * - From 'unknown', submit is ignored (only Check Status and Back to search are supported)
 * - Double submit while submitting is ignored
 * - From confirmed, everything except reset is ignored
 * - Price-higher repricing requires acceptPrice before submit is allowed
 */
export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  if (action.type === 'RESET') {
    return initialBookingState;
  }

  // Once confirmed, ignore all actions except RESET
  if (state.status === 'confirmed') {
    return state;
  }

  // In unknown state, submit is ignored; only RESET (Back to search) or checking status is allowed
  if (state.status === 'unknown') {
    return state;
  }

  switch (state.status) {
    case 'editing': {
      if (action.type === 'START_REPRICE') {
        return {
          ...state,
          status: 'repricing',
          passengers: action.passengers,
          contact: action.contact,
          itineraryId: action.itineraryId ?? null,
          originalPrice: action.originalPrice,
          currentPrice: action.originalPrice,
          priceAccepted: false,
          error: null,
        };
      }
      // SUBMIT_BOOKING is ignored in editing state
      return state;
    }

    case 'repricing': {
      if (action.type === 'REPRICE_SUCCESS') {
        const comp = state.originalPrice
          ? comparePrices(state.originalPrice, action.newPrice)
          : 'same';
        const priceAccepted = comp !== 'higher' && comp !== 'currency_changed';
        return {
          ...state,
          status: 'review',
          currentPrice: action.newPrice,
          priceComparison: comp,
          priceAccepted,
          error: null,
        };
      }
      if (action.type === 'REPRICE_FAILED') {
        return {
          ...state,
          status: 'failed',
          error: action.error,
        };
      }
      if (action.type === 'BACK_TO_EDIT') {
        return {
          ...state,
          status: 'editing',
          error: null,
        };
      }
      return state;
    }

    case 'review': {
      if (action.type === 'ACCEPT_PRICE') {
        return {
          ...state,
          priceAccepted: true,
        };
      }
      if (action.type === 'SUBMIT_BOOKING') {
        // Higher price requires explicit user acceptance before submit is allowed
        if (state.priceComparison === 'higher' && !state.priceAccepted) {
          return state;
        }
        return {
          ...state,
          status: 'submitting',
          error: null,
        };
      }
      if (action.type === 'BACK_TO_EDIT') {
        return {
          ...state,
          status: 'editing',
          error: null,
        };
      }
      return state;
    }

    case 'submitting': {
      if (action.type === 'SUBMIT_BOOKING') {
        // Double submit while submitting is ignored
        return state;
      }
      if (action.type === 'BOOKING_SUCCESS') {
        // Immediate volatile memory purge of all passenger and contact data
        return {
          ...state,
          status: 'confirmed',
          passengers: [],
          contact: { email: '', phone: '' },
          confirmation: action.confirmation,
          error: null,
        };
      }
      if (action.type === 'BOOKING_FAILURE') {
        const status = action.error?.status;
        const isDefiniteRejection = status !== undefined && [400, 409, 410, 422].includes(status);
        if (isDefiniteRejection) {
          return {
            ...state,
            status: 'failed',
            error: action.error,
          };
        }
        // Network errors, timeouts (408), 5xx, or unconfirmed statuses go to 'unknown'
        return {
          ...state,
          status: 'unknown',
          error: action.error,
        };
      }
      return state;
    }

    case 'failed': {
      if (action.type === 'BACK_TO_EDIT') {
        return {
          ...state,
          status: 'editing',
          error: null,
        };
      }
      // SUBMIT_BOOKING is ignored in failed state
      return state;
    }

    default:
      return state;
  }
}

