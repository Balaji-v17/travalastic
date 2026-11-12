import { ApiError } from './api.ts';

/**
 * Maps HTTP status codes and API error details to plain, human-readable user messages.
 */
export function getApiErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  if (error instanceof ApiError) {
    const status = error.status;
    const msg = error.message || '';
    const code = error.code || '';

    if (code === 'PASSWORD_CHANGE_REQUIRED' || (status === 403 && /password change/i.test(msg))) {
      return 'Password change required before accessing administrative resources.';
    }

    if (status === 401) {
      return 'Your session ended. Please sign in again.';
    }

    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (status === 404) {
      if (/collection|style/i.test(msg)) {
        return 'Style collection not found.';
      }
      if (/hotel/i.test(msg)) {
        return 'Hotel not found.';
      }
      if (/place/i.test(msg)) {
        return 'Place not found.';
      }
      if (/admin/i.test(msg)) {
        return 'Admin account not found.';
      }
      if (/user/i.test(msg)) {
        return 'This account no longer exists.';
      }
      return msg || 'Resource not found.';
    }

    if (status === 409) {
      if (/collection/i.test(msg) || /changed/i.test(msg)) {
        return 'This collection changed while you were editing. Reload to see the latest version.';
      }
      if (/last active super admin/i.test(msg)) {
        return 'Cannot demote or deactivate the last active Super Admin.';
      }
      if (/email/i.test(msg) || /admin/i.test(msg)) {
        return 'An admin account with this email already exists.';
      }
      return msg || 'This action conflicts with current state.';
    }

    if (status === 429) {
      if (/deletion/i.test(msg)) {
        return 'Too many deletions. Try again later.';
      }
      if (/preview/i.test(msg)) {
        return 'Too many previews. Wait a minute and try again.';
      }
      if (/lookup/i.test(msg)) {
        return 'Too many lookup requests. Please slow down.';
      }
      return 'Too many administrative requests. Please slow down.';
    }

    if (status === 400) {
      if (/preview token/i.test(msg)) {
        return 'The preview expired. Start again.';
      }
      if (/email does not match/i.test(msg)) {
        return 'The email does not match.';
      }
      if (/html tag/i.test(msg)) {
        return 'Reason cannot contain HTML tags.';
      }
      if (/reason must be between/i.test(msg)) {
        return 'Reason must be between 5 and 200 characters.';
      }
      if (/own role/i.test(msg)) {
        return 'You cannot change your own role.';
      }
      if (/deactivate your own/i.test(msg)) {
        return 'You cannot deactivate your own account.';
      }
      if (/reset your own/i.test(msg)) {
        return 'You cannot reset your own password. Use change password instead.';
      }
      if (/different/i.test(msg)) {
        return 'New password must be different from current password.';
      }
      if (/parts of your email/i.test(msg)) {
        return 'New password must not contain parts of your email address.';
      }
      if (/12 characters/i.test(msg)) {
        return 'Password must be at least 12 characters long.';
      }
      if (/incorrect/i.test(msg)) {
        return 'Current password is incorrect.';
      }
      if (/email/i.test(msg)) {
        return 'Please enter a valid email address.';
      }
      return msg || 'Invalid request parameters.';
    }

    if (status === 408 || status === 0) {
      return 'The server may be waking up. Retrying can take up to a minute.';
    }

    if (status >= 500) {
      return 'An internal server error occurred. Please try again.';
    }

    return msg || 'Request failed. Please try again.';
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || /network|failed to fetch|load failed/i.test(error.message)) {
      return 'The server may be waking up. Retrying can take up to a minute.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

