export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates password criteria for admin accounts:
 * - >= 12 characters
 * - Differs from current password
 * - Does not contain the local part of email before "@" (case-insensitive)
 * - Confirmation matches
 */
export function validatePasswordRules(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  email?: string | null
): PasswordValidationResult {
  const errors: string[] = [];

  if (!newPassword || newPassword.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (currentPassword && newPassword && newPassword === currentPassword) {
    errors.push('New password must be different from current password');
  }

  if (email && typeof email === 'string' && email.includes('@')) {
    const localPart = email.split('@')[0].trim().toLowerCase();
    if (localPart.length > 0 && newPassword.toLowerCase().includes(localPart)) {
      errors.push('New password must not contain parts of your email address');
    }
  }

  if (newPassword !== confirmPassword) {
    errors.push('New password confirmation does not match');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

