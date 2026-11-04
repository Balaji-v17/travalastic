import type { JourneyDNA } from './itineraryApi';

export interface DnaValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/**
 * Formats a Date object into 'YYYY-MM-DD' using local date components.
 * Avoids toISOString() to prevent timezone off-by-one errors.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates the default Journey DNA object.
 *
 * Rules:
 * - destination = prefill.destination ?? ''
 * - destinationId = prefill.destinationId ?? '' (NEVER hardcoded to 'tokyo')
 * - origin = ''
 * - startDate = today + 30 days as 'YYYY-MM-DD' (computed from local date parts)
 * - nights = 3
 * - travelers = 1
 * - budget = '' (not set)
 * - pace = 'balanced'
 * - comfort = 'comfortable'
 * - interests = []
 * - mustHave / avoid / notes = ''
 */
export function makeDefaultDna(
  today: Date,
  prefill?: { destination?: string; destinationId?: string }
): JourneyDNA {
  const targetDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 30
  );

  return {
    destination: prefill?.destination ?? '',
    destinationId: prefill?.destinationId ?? '',
    origin: '',
    startDate: formatLocalDate(targetDate),
    nights: 3,
    travelers: 1,
    budget: '',
    pace: 'balanced',
    comfort: 'comfortable',
    interests: [],
    mustHave: '',
    avoid: '',
    notes: '',
  };
}

/**
 * Validates the Journey DNA form state against input rules.
 *
 * Rules:
 * - destination: required (trim, >= 2 chars, <= 80 chars)
 * - startDate: required and not before today
 * - nights: integer 1–14
 * - travelers: integer 1–9
 * - budget: empty or positive integer
 */
export function validateDna(
  dna: JourneyDNA | Partial<JourneyDNA>,
  today: Date
): DnaValidationResult {
  const errors: Record<string, string> = {};

  // 1. Destination
  const destination =
    typeof dna?.destination === 'string' ? dna.destination.trim() : '';
  if (!destination) {
    errors.destination = 'Destination is required';
  } else if (destination.length < 2) {
    errors.destination = 'Destination must be at least 2 characters';
  } else if (destination.length > 80) {
    errors.destination = 'Destination must not exceed 80 characters';
  }

  // 2. Start Date
  const todayStr = formatLocalDate(today);
  const startDate =
    typeof dna?.startDate === 'string' ? dna.startDate.trim() : '';
  if (!startDate) {
    errors.startDate = 'Pick a start date';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    errors.startDate = 'Pick a valid start date';
  } else if (startDate < todayStr) {
    errors.startDate = "Pick a start date that isn't in the past";
  }

  // 3. Nights (integer 1–14)
  const nights = dna?.nights;
  if (
    typeof nights !== 'number' ||
    !Number.isInteger(nights) ||
    nights < 1 ||
    nights > 14
  ) {
    errors.nights = 'Trip length must be between 1 and 14 nights';
  }

  // 4. Travelers (integer 1–9)
  const travelers = dna?.travelers;
  if (
    typeof travelers !== 'number' ||
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > 9
  ) {
    errors.travelers = 'Travelers must be between 1 and 9';
  }

  // 5. Budget (empty or positive integer)
  const budget = dna?.budget;
  if (budget !== '' && budget != null) {
    const budgetNum = Number(budget);
    if (!Number.isInteger(budgetNum) || budgetNum <= 0) {
      errors.budget = 'Budget must be a positive whole number';
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

