import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getApiErrorMessage } from '../src/lib/apiErrors.ts';
import { ApiError } from '../src/lib/api.ts';

describe('apiErrors helper', () => {
  it('maps 401 to session ended message', () => {
    const err = new ApiError(401, 'Unauthorized');
    assert.equal(getApiErrorMessage(err), 'Your session ended. Please sign in again.');
  });

  it('maps 403 with PASSWORD_CHANGE_REQUIRED code to password change required message', () => {
    const err = new ApiError(403, 'Forbidden', 'PASSWORD_CHANGE_REQUIRED');
    assert.match(getApiErrorMessage(err), /Password change required/i);
  });

  it('maps 403 with password change text to password change required message', () => {
    const err = new ApiError(403, 'Password change required before accessing administrative resources');
    assert.match(getApiErrorMessage(err), /Password change required/i);
  });

  it('maps generic 403 to permission denied message', () => {
    const err = new ApiError(403, 'Forbidden: requires super_admin');
    assert.match(getApiErrorMessage(err), /permission to perform this action/i);
  });

  it('maps 404 to admin, user, or collection not found', () => {
    const err = new ApiError(404, 'Admin not found');
    assert.match(getApiErrorMessage(err), /Admin account not found/i);

    const userErr = new ApiError(404, 'User not found');
    assert.equal(getApiErrorMessage(userErr), 'This account no longer exists.');

    const collectionErr = new ApiError(404, 'Style collection not found.');
    assert.equal(getApiErrorMessage(collectionErr), 'Style collection not found.');
  });

  it('maps 409 last active super admin, already exists, and collection conflict messages', () => {
    const err = new ApiError(409, 'Cannot demote or deactivate the last active super admin');
    assert.equal(getApiErrorMessage(err), 'Cannot demote or deactivate the last active Super Admin.');

    const existsErr = new ApiError(409, 'Admin with this email already exists');
    assert.equal(getApiErrorMessage(existsErr), 'An admin account with this email already exists.');

    const conflictErr = new ApiError(409, 'This collection changed. Reload and try again.');
    assert.equal(
      getApiErrorMessage(conflictErr),
      'This collection changed while you were editing. Reload to see the latest version.'
    );
  });

  it('maps 429 to rate limit message, including preview photo and deletion rate limits', () => {
    const err = new ApiError(429, 'Too many requests');
    assert.match(getApiErrorMessage(err), /Too many administrative requests.*slow down/i);

    const previewErr = new ApiError(429, 'Too many preview requests. Please wait a moment.');
    assert.equal(getApiErrorMessage(previewErr), 'Too many previews. Wait a minute and try again.');

    const deletionErr = new ApiError(429, 'Too many account deletions. Please wait before attempting another deletion.');
    assert.equal(getApiErrorMessage(deletionErr), 'Too many deletions. Try again later.');

    const lookupErr = new ApiError(429, 'Too many lookup requests. Please slow down.');
    assert.equal(getApiErrorMessage(lookupErr), 'Too many lookup requests. Please slow down.');
  });

  it('maps 400 self-actions and validation messages cleanly', () => {
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Invalid or expired preview token')),
      'The preview expired. Start again.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'The email does not match.')),
      'The email does not match.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Reason cannot contain HTML tags')),
      'Reason cannot contain HTML tags.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Reason must be between 5 and 200 characters')),
      'Reason must be between 5 and 200 characters.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Cannot change your own role')),
      'You cannot change your own role.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Cannot deactivate your own account')),
      'You cannot deactivate your own account.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Cannot reset your own password. Use change-password instead.')),
      'You cannot reset your own password. Use change password instead.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'New password must be different from current password')),
      'New password must be different from current password.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'New password must not contain parts of your email address')),
      'New password must not contain parts of your email address.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'New password must be at least 12 characters long')),
      'Password must be at least 12 characters long.'
    );
    assert.equal(
      getApiErrorMessage(new ApiError(400, 'Current password is incorrect')),
      'Current password is incorrect.'
    );
  });

  it('maps network and timeout errors to server wake-up message', () => {
    assert.match(getApiErrorMessage(new ApiError(408, 'Timeout')), /server may be waking up/i);
    assert.match(getApiErrorMessage(new ApiError(0, 'Failed to fetch')), /server may be waking up/i);
  });

  it('maps 500 status to internal server error', () => {
    assert.match(getApiErrorMessage(new ApiError(500, 'Internal Server Error')), /internal server error/i);
  });
});

