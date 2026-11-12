import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validateRole,
  validateCreateAdminForm,
} from '../src/lib/adminForm.ts';

describe('adminForm helper', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      assert.equal(validateEmail('test@travalastic.com'), null);
      assert.equal(validateEmail('first.last@domain.co.uk'), null);
      assert.equal(validateEmail('support+agent1@travalastic.com'), null);
    });

    it('rejects missing or empty email', () => {
      assert.match(validateEmail(''), /required/i);
      assert.match(validateEmail('   '), /required/i);
      assert.match(validateEmail(null), /required/i);
      assert.match(validateEmail(undefined), /required/i);
    });

    it('rejects malformed email formats', () => {
      assert.match(validateEmail('notanemail'), /format/i);
      assert.match(validateEmail('missingdomain@'), /format/i);
      assert.match(validateEmail('@missinguser.com'), /format/i);
      assert.match(validateEmail('user@domain'), /format/i);
      assert.match(validateEmail('user with spaces@domain.com'), /format/i);
    });
  });

  describe('validateRole', () => {
    it('accepts valid admin roles', () => {
      assert.equal(validateRole('super_admin'), null);
      assert.equal(validateRole('content_editor'), null);
      assert.equal(validateRole('support_agent'), null);
    });

    it('rejects unknown or invalid roles', () => {
      assert.match(validateRole('admin'), /invalid/i);
      assert.match(validateRole('viewer'), /invalid/i);
      assert.match(validateRole('moderator'), /invalid/i);
    });

    it('rejects missing or empty roles', () => {
      assert.match(validateRole(''), /required/i);
      assert.match(validateRole(null), /required/i);
      assert.match(validateRole(undefined), /required/i);
    });
  });

  describe('validateCreateAdminForm', () => {
    it('returns isValid: true and empty errors for valid inputs', () => {
      const res = validateCreateAdminForm('newadmin@travalastic.com', 'content_editor');
      assert.equal(res.isValid, true);
      assert.deepEqual(res.errors, {});
    });

    it('returns validation errors when inputs are invalid', () => {
      const res = validateCreateAdminForm('bademail', 'invalid_role');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.email);
      assert.ok(res.errors.role);
    });
  });
});

