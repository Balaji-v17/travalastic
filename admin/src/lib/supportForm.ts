/**
 * Support Account Deletion form validation and normalization helpers.
 */

const HTML_TAG_REGEX = /<[^>]*>/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes an email address: trims whitespace and converts to lowercase.
 */
export function normalizeEmail(s?: string | null): string {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

/**
 * Validates an email address against length and format rules.
 */
export function validateEmail(s?: string | null): EmailValidationResult {
  if (!s || typeof s !== 'string' || !s.trim()) {
    return {
      isValid: false,
      error: 'Please enter an email address.',
      normalized: '',
    };
  }

  const normalized = normalizeEmail(s);

  if (normalized.length > 254) {
    return {
      isValid: false,
      error: 'Email cannot exceed 254 characters.',
      normalized,
    };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address.',
      normalized,
    };
  }

  return {
    isValid: true,
    normalized,
  };
}

export interface ReasonValidationResult {
  isValid: boolean;
  error?: string;
  cleanReason: string;
}

/**
 * Validates an account deletion reason:
 * - Must be 5 to 200 characters in trimmed length.
 * - Must be plain text (no HTML tags permitted).
 */
export function validateReason(reason?: string | null): ReasonValidationResult {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return {
      isValid: false,
      error: 'Reason is required.',
      cleanReason: '',
    };
  }

  const clean = reason.trim();

  if (clean.length < 5) {
    return {
      isValid: false,
      error: 'Reason must be at least 5 characters.',
      cleanReason: clean,
    };
  }

  if (clean.length > 200) {
    return {
      isValid: false,
      error: 'Reason cannot exceed 200 characters.',
      cleanReason: clean,
    };
  }

  if (HTML_TAG_REGEX.test(clean)) {
    return {
      isValid: false,
      error: 'Reason cannot contain HTML tags.',
      cleanReason: clean,
    };
  }

  return {
    isValid: true,
    cleanReason: clean,
  };
}

/**
 * Compares two emails case-insensitively and space-insensitively.
 */
export function emailsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeEmail(a) === normalizeEmail(b);
}

