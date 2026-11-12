import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordRules } from '../src/lib/passwordRules.ts';

describe('passwordRules helper', () => {
  it('rejects passwords shorter than 12 characters (length 11 fails, 12 passes)', () => {
    const res11 = validatePasswordRules('OldPassword123!', 'ShortPass1!', 'ShortPass1!', 'admin@travalastic.com');
    assert.equal(res11.isValid, false);
    assert.ok(res11.errors.some((e) => e.includes('12 characters')));

    const res12 = validatePasswordRules('OldPassword123!', 'ValidPass12!', 'ValidPass12!', 'admin@travalastic.com');
    assert.equal(res12.isValid, true);
    assert.deepEqual(res12.errors, []);
  });

  it('rejects new password if it is identical to current password', () => {
    const res = validatePasswordRules('SamePassword123!', 'SamePassword123!', 'SamePassword123!', 'admin@travalastic.com');
    assert.equal(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('different from current')));
  });

  it('rejects new password if it contains email local part before @ (case-insensitively)', () => {
    // Email: john.doe@travalastic.com, password contains JOHN.DOE
    const res = validatePasswordRules(
      'OldPassword123!',
      'Secret_JOHN.DOE_2026!',
      'Secret_JOHN.DOE_2026!',
      'John.Doe@travalastic.com'
    );
    assert.equal(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('parts of your email')));
  });

  it('rejects when new password and confirm password do not match', () => {
    const res = validatePasswordRules(
      'OldPassword123!',
      'BrandNewPass123!',
      'MismatchPass123!',
      'admin@travalastic.com'
    );
    assert.equal(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('confirmation does not match')));
  });

  it('passes when all rules are satisfied', () => {
    const res = validatePasswordRules(
      'CurrentValidPass123!',
      'SuperStrongNewPassword2026!',
      'SuperStrongNewPassword2026!',
      'editor@travalastic.com'
    );
    assert.equal(res.isValid, true);
    assert.deepEqual(res.errors, []);
  });
});

