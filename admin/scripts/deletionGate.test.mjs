import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canDelete } from '../src/lib/deletionGate.ts';

describe('deletionGate helper', () => {
  const validParams = {
    targetEmail: 'traveler@example.com',
    confirmEmail: 'Traveler@Example.Com',
    reason: 'Customer requested account erasure via email ticket.',
    confirmedCheckbox: true,
    isExpired: false,
    isPending: false,
    hasPreviewToken: true,
  };

  it('allows deletion when all criteria are strictly satisfied', () => {
    assert.equal(canDelete(validParams), true);
  });

  it('blocks deletion when emails do not match', () => {
    assert.equal(canDelete({ ...validParams, confirmEmail: 'wrong@example.com' }), false);
    assert.equal(canDelete({ ...validParams, confirmEmail: '' }), false);
    assert.equal(canDelete({ ...validParams, confirmEmail: undefined }), false);
  });

  it('blocks deletion when reason is invalid (too short, too long, HTML)', () => {
    assert.equal(canDelete({ ...validParams, reason: 'nope' }), false);
    assert.equal(canDelete({ ...validParams, reason: 'a'.repeat(201) }), false);
    assert.equal(canDelete({ ...validParams, reason: '<b>Bold reason</b>' }), false);
    assert.equal(canDelete({ ...validParams, reason: '' }), false);
  });

  it('blocks deletion when confirmation checkbox is unchecked', () => {
    assert.equal(canDelete({ ...validParams, confirmedCheckbox: false }), false);
  });

  it('blocks deletion when preview token is expired', () => {
    assert.equal(canDelete({ ...validParams, isExpired: true }), false);
  });

  it('blocks deletion when request is pending (prevents double submits)', () => {
    assert.equal(canDelete({ ...validParams, isPending: true }), false);
  });

  it('blocks deletion when preview token is missing', () => {
    assert.equal(canDelete({ ...validParams, hasPreviewToken: false }), false);
  });
});

