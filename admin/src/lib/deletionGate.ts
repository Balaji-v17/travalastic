import { emailsMatch, validateReason } from './supportForm.ts';

export interface DeletionGateParams {
  targetEmail?: string | null;
  confirmEmail?: string | null;
  reason?: string | null;
  confirmedCheckbox?: boolean;
  isExpired?: boolean;
  isPending?: boolean;
  hasPreviewToken?: boolean;
}

/**
 * Determines whether the "Delete account" submission button should be enabled.
 * All criteria must strictly be satisfied:
 * - Target email and confirmed email match case-insensitively.
 * - Reason is plain text between 5 and 200 characters without HTML tags.
 * - Confirmation checkbox "I understand this cannot be undone" is checked.
 * - Preview token exists and has not expired.
 * - Request is not currently pending (prevents double submits).
 */
export function canDelete({
  targetEmail,
  confirmEmail,
  reason,
  confirmedCheckbox = false,
  isExpired = false,
  isPending = false,
  hasPreviewToken = true,
}: DeletionGateParams): boolean {
  if (isPending) return false;
  if (isExpired) return false;
  if (!hasPreviewToken) return false;
  if (!confirmedCheckbox) return false;

  if (!emailsMatch(targetEmail, confirmEmail)) {
    return false;
  }

  const reasonValidation = validateReason(reason);
  if (!reasonValidation.isValid) {
    return false;
  }

  return true;
}

