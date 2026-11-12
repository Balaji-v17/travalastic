import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  validateEmail,
  validateReason,
  emailsMatch,
} from '../src/lib/supportForm.ts';

describe('supportForm helper', () => {
  describe('normalizeEmail', () => {
    it('trims whitespace and lowercases', () => {
      assert.equal(normalizeEmail('  Traveler@Example.COM  '), 'traveler@example.com');
      assert.equal(normalizeEmail('USER@DOMAIN.ORG'), 'user@domain.org');
    });

    it('handles null, undefined, and non-strings safely', () => {
      assert.equal(normalizeEmail(null), '');
      assert.equal(normalizeEmail(undefined), '');
      assert.equal(normalizeEmail(''), '');
    });
  });

  describe('validateEmail', () => {
    it('rejects empty or whitespace-only email', () => {
      assert.equal(validateEmail('').isValid, false);
      assert.equal(validateEmail('   ').isValid, false);
      assert.equal(validateEmail(null).isValid, false);
    });

    it('rejects email exceeding 254 characters', () => {
      const longPrefix = 'a'.repeat(245);
      const longEmail = `${longPrefix}@example.com`; // 257 chars
      const res = validateEmail(longEmail);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /254 characters/i);
    });

    it('rejects malformed email formats', () => {
      assert.equal(validateEmail('notanemail').isValid, false);
      assert.equal(validateEmail('test@').isValid, false);
      assert.equal(validateEmail('@example.com').isValid, false);
      assert.equal(validateEmail('test@example').isValid, false);
      assert.equal(validateEmail('test @example.com').isValid, false);
    });

    it('accepts valid email and returns normalized value', () => {
      const res = validateEmail('  Alice.Bob@Example.Com  ');
      assert.equal(res.isValid, true);
      assert.equal(res.normalized, 'alice.bob@example.com');
      assert.equal(res.error, undefined);
    });
  });

  describe('validateReason', () => {
    it('rejects empty or whitespace-only reason', () => {
      assert.equal(validateReason('').isValid, false);
      assert.equal(validateReason('   ').isValid, false);
      assert.equal(validateReason(null).isValid, false);
    });

    it('rejects reason shorter than 5 characters', () => {
      assert.equal(validateReason('help').isValid, false);
      assert.equal(validateReason('  1234  ').isValid, false);
      const res = validateReason('test');
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /at least 5 characters/i);
    });

    it('accepts reason of exactly 5 characters', () => {
      const res = validateReason('valid');
      assert.equal(res.isValid, true);
      assert.equal(res.cleanReason, 'valid');
    });

    it('accepts reason of up to 200 characters', () => {
      const exact200 = 'a'.repeat(200);
      const res = validateReason(exact200);
      assert.equal(res.isValid, true);
      assert.equal(res.cleanReason, exact200);
    });

    it('rejects reason exceeding 200 characters', () => {
      const long201 = 'a'.repeat(201);
      const res = validateReason(long201);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /cannot exceed 200 characters/i);
    });

    it('rejects HTML tags in reason', () => {
      assert.equal(validateReason('Delete this <script>alert(1)</script>').isValid, false);
      assert.equal(validateReason('Please remove <b>all</b> data').isValid, false);
      assert.equal(validateReason('Break line <br/> now please').isValid, false);
      const res = validateReason('User requested <tag> deletion');
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /cannot contain HTML tags/i);
    });

    it('accepts legitimate plain text reasons with standard punctuation', () => {
      const valid = 'Customer requested GDPR Article 17 erasure via ticket #9482.';
      const res = validateReason(valid);
      assert.equal(res.isValid, true);
      assert.equal(res.cleanReason, valid);
    });
  });

  describe('emailsMatch', () => {
    it('returns true for case and space-insensitive matches', () => {
      assert.equal(emailsMatch('Alice@Example.com', 'alice@example.com'), true);
      assert.equal(emailsMatch('  alice@example.com  ', 'ALICE@EXAMPLE.COM'), true);
    });

    it('returns false for mismatched emails', () => {
      assert.equal(emailsMatch('alice@example.com', 'bob@example.com'), false);
    });

    it('returns false if either email is missing or empty', () => {
      assert.equal(emailsMatch('alice@example.com', null), false);
      assert.equal(emailsMatch(null, 'alice@example.com'), false);
      assert.equal(emailsMatch('', ''), false);
    });
  });
});

