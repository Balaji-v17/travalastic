import { isValidRole, type AdminRole } from './roles.ts';

export interface AdminFormValidationResult {
  isValid: boolean;
  errors: {
    email?: string;
    role?: string;
  };
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) {
    return 'Email address is required';
  }
  const clean = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(clean)) {
    return 'Invalid email address format';
  }
  return null;
}

export function validateRole(role: unknown): string | null {
  if (!role || typeof role !== 'string') {
    return 'Role is required';
  }
  if (!isValidRole(role)) {
    return 'Invalid role selected';
  }
  return null;
}

export function validateCreateAdminForm(email: unknown, role: unknown): AdminFormValidationResult {
  const emailError = validateEmail(email);
  const roleError = validateRole(role);

  const errors: { email?: string; role?: string } = {};
  if (emailError) errors.email = emailError;
  if (roleError) errors.role = roleError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

