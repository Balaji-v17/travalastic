import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePassenger,
  validateContact,
  validateAllPassengers,
  comparePrices,
  bookingReducer,
  initialBookingState,
} from '../src/lib/passengerValidation.ts';

const FIXED_TODAY = '2026-11-02';

test('validatePassenger tests', async (t) => {
  await t.test('valid passenger with standard fields', () => {
    const p = {
      givenName: 'John',
      familyName: 'Doe',
      dateOfBirth: '1990-05-15',
      title: 'mr',
      gender: 'm',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.deepEqual(errors, {});
  });

  await t.test('empty names are rejected', () => {
    const p = {
      givenName: '   ',
      familyName: '',
      dateOfBirth: '1990-05-15',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.givenName, /required/i);
    assert.match(errors.familyName, /required/i);
  });

  await t.test('digits in name are rejected', () => {
    const p = {
      givenName: 'John2',
      familyName: 'Doe99',
      dateOfBirth: '1990-05-15',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.givenName, /only contain letters/i);
    assert.match(errors.familyName, /only contain letters/i);
  });

  await t.test('apostrophe and hyphen names are accepted', () => {
    const p = {
      givenName: "Mary-Jane",
      familyName: "O'Connor",
      dateOfBirth: '1995-08-20',
      title: 'ms',
      gender: 'f',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.deepEqual(errors, {});

    const p2 = {
      givenName: "Jean-Luc",
      familyName: "d'Estaing",
      dateOfBirth: '1985-01-10',
    };
    const errors2 = validatePassenger(p2, FIXED_TODAY);
    assert.deepEqual(errors2, {});
  });

  await t.test('names with Unicode accented letters are accepted', () => {
    const p = {
      givenName: 'François',
      familyName: 'Müller',
      dateOfBirth: '1992-03-12',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.deepEqual(errors, {});
  });

  await t.test('very long names (> 40 characters) are rejected', () => {
    const p = {
      givenName: 'A'.repeat(41),
      familyName: 'B'.repeat(41),
      dateOfBirth: '1990-05-15',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.givenName, /40 characters or fewer/i);
    assert.match(errors.familyName, /40 characters or fewer/i);
  });

  await t.test('exactly 40 character names are accepted', () => {
    const p = {
      givenName: 'A'.repeat(40),
      familyName: 'B'.repeat(40),
      dateOfBirth: '1990-05-15',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.deepEqual(errors, {});
  });

  await t.test('future date of birth is rejected', () => {
    const p = {
      givenName: 'John',
      familyName: 'Doe',
      dateOfBirth: '2027-01-01',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.dateOfBirth, /future/i);
  });

  await t.test('non-calendar date like 2026-02-30 is rejected', () => {
    const p = {
      givenName: 'John',
      familyName: 'Doe',
      dateOfBirth: '2026-02-30',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.dateOfBirth, /valid calendar date/i);
  });

  await t.test('leap day in leap year (2000-02-29 and 2024-02-29) is accepted', () => {
    const p1 = {
      givenName: 'John',
      familyName: 'Doe',
      dateOfBirth: '2000-02-29',
    };
    assert.deepEqual(validatePassenger(p1, FIXED_TODAY), {});

    const p2 = {
      givenName: 'Jane',
      familyName: 'Doe',
      dateOfBirth: '2004-02-29',
    };
    assert.deepEqual(validatePassenger(p2, FIXED_TODAY), {});
  });

  await t.test('leap day in non-leap year (2023-02-29) is rejected', () => {
    const p = {
      givenName: 'John',
      familyName: 'Doe',
      dateOfBirth: '2023-02-29',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.dateOfBirth, /valid calendar date/i);
  });

  await t.test('underage passenger (< 18) for adult fare is rejected', () => {
    const p = {
      givenName: 'Young',
      familyName: 'Traveler',
      dateOfBirth: '2015-05-15',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.dateOfBirth, /at least 18 years old/i);
  });

  await t.test('implausible age (> 120) is rejected', () => {
    const p = {
      givenName: 'Ancient',
      familyName: 'Traveler',
      dateOfBirth: '1890-01-01',
    };
    const errors = validatePassenger(p, FIXED_TODAY);
    assert.match(errors.dateOfBirth, /plausible/i);
  });
});

test('validateContact tests', async (t) => {
  await t.test('valid email and phone are accepted', () => {
    const contact = {
      email: 'traveler@example.com',
      phone: '+919876543210',
    };
    const errors = validateContact(contact);
    assert.deepEqual(errors, {});
  });

  await t.test('phone with spaces "+91 98765 43210" is accepted and normalized', () => {
    const contact = {
      email: 'traveler@example.com',
      phone: '+91 98765 43210',
    };
    const errors = validateContact(contact);
    assert.deepEqual(errors, {});
  });

  await t.test('phone without leading "+" is rejected', () => {
    const contact = {
      email: 'traveler@example.com',
      phone: '9876543210',
    };
    const errors = validateContact(contact);
    assert.match(errors.phone, /must start with '\+'/i);
  });

  await t.test('phone too short (< 8 digits) is rejected', () => {
    const contact = {
      email: 'traveler@example.com',
      phone: '+12345',
    };
    const errors = validateContact(contact);
    assert.match(errors.phone, /too short/i);
  });

  await t.test('phone too long (> 15 digits) is rejected', () => {
    const contact = {
      email: 'traveler@example.com',
      phone: '+1234567890123456',
    };
    const errors = validateContact(contact);
    assert.match(errors.phone, /too long/i);
  });

  await t.test('empty contact fields are rejected', () => {
    const contact = {
      email: '',
      phone: '',
    };
    const errors = validateContact(contact);
    assert.match(errors.email, /required/i);
    assert.match(errors.phone, /required/i);
  });

  await t.test('malformed emails are rejected', () => {
    for (const badEmail of ['notanemail', 'user@', '@domain.com', 'user@domain']) {
      const errors = validateContact({ email: badEmail, phone: '+12025550199' });
      assert.match(errors.email, /valid email/i);
    }
  });
});

test('validateAllPassengers aggregation', async () => {
  const passengers = [
    { givenName: 'John', familyName: 'Doe', dateOfBirth: '1990-01-01' },
    { givenName: 'Jane2', familyName: '', dateOfBirth: '2030-01-01' },
  ];
  const contact = { email: 'bademail', phone: '123' };

  const result = validateAllPassengers(passengers, contact, FIXED_TODAY);
  assert.equal(result.isValid, false);
  assert.equal(result.passengerErrors.length, 2);
  assert.deepEqual(result.passengerErrors[0], {});
  assert.ok(result.passengerErrors[1].givenName);
  assert.ok(result.passengerErrors[1].familyName);
  assert.ok(result.passengerErrors[1].dateOfBirth);
  assert.ok(result.contactErrors.email);
  assert.ok(result.contactErrors.phone);
  assert.ok(result.allErrors.length >= 5);
});

test('comparePrices decimal string and object comparisons', async (t) => {
  await t.test('"100.00" vs "100" returns "same"', () => {
    assert.equal(comparePrices('100.00', '100'), 'same');
    assert.equal(comparePrices('100', '100.00'), 'same');
    assert.equal(comparePrices('100.0', '100.000'), 'same');
  });

  await t.test('"99.99" vs "100.00" returns "higher" (new price is higher)', () => {
    assert.equal(comparePrices('99.99', '100.00'), 'higher');
  });

  await t.test('"100.00" vs "99.99" returns "lower" (new price is lower)', () => {
    assert.equal(comparePrices('100.00', '99.99'), 'lower');
  });

  await t.test('object format with currencies', () => {
    assert.equal(
      comparePrices({ amount: '150.50', currency: 'USD' }, { amount: '150.50', currency: 'USD' }),
      'same'
    );
    assert.equal(
      comparePrices({ amount: '150.50', currency: 'USD' }, { amount: '175.00', currency: 'USD' }),
      'higher'
    );
    assert.equal(
      comparePrices({ amount: '175.00', currency: 'USD' }, { amount: '150.50', currency: 'USD' }),
      'lower'
    );
  });

  await t.test('different currencies return "currency_changed"', () => {
    assert.equal(
      comparePrices({ amount: '100', currency: 'USD' }, { amount: '100', currency: 'EUR' }),
      'currency_changed'
    );
    assert.equal(
      comparePrices({ amount: '90', currency: 'GBP' }, { amount: '120', currency: 'USD' }),
      'currency_changed'
    );
  });

  await t.test('arbitrarily large amounts handled safely with BigInt', () => {
    const huge1 = '999999999999999999.50';
    const huge2 = '999999999999999999.51';
    assert.equal(comparePrices(huge1, huge2), 'higher');
    assert.equal(comparePrices(huge2, huge1), 'lower');
    assert.equal(comparePrices(huge1, huge1), 'same');
  });

  await t.test('malformed inputs return null without throwing', () => {
    assert.equal(comparePrices('abc', '100'), null);
    assert.equal(comparePrices('100', 'xyz'), null);
    assert.equal(comparePrices(null, '100'), null);
    assert.equal(comparePrices(undefined, undefined), null);
    assert.equal(comparePrices('', '100'), null);
  });
});

test('bookingReducer state machine rules and transitions', async (t) => {
  const samplePassengers = [
    { givenName: 'John', familyName: 'Doe', dateOfBirth: '1990-01-01', title: 'mr', gender: 'm' },
  ];
  const sampleContact = { email: 'john@example.com', phone: '+12025550199' };
  const basePrice = { amount: '250.00', currency: 'USD' };

  await t.test('submit is ignored unless state is "review"', () => {
    // In editing state
    let state = initialBookingState;
    assert.equal(state.status, 'editing');
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'editing');

    // In repricing state
    state = bookingReducer(state, {
      type: 'START_REPRICE',
      passengers: samplePassengers,
      contact: sampleContact,
      originalPrice: basePrice,
    });
    assert.equal(state.status, 'repricing');
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'repricing');

    // In failed state
    state = bookingReducer(state, {
      type: 'REPRICE_FAILED',
      error: { status: 409, message: 'Expired' },
    });
    assert.equal(state.status, 'failed');
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'failed');
  });

  await t.test('double submit while submitting is ignored', () => {
    let state = bookingReducer(initialBookingState, {
      type: 'START_REPRICE',
      passengers: samplePassengers,
      contact: sampleContact,
      originalPrice: basePrice,
    });
    // Reprice success with same price
    state = bookingReducer(state, { type: 'REPRICE_SUCCESS', newPrice: basePrice });
    assert.equal(state.status, 'review');

    // First submit
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'submitting');

    // Double submit attempt
    const stateBeforeDouble = state;
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'submitting');
    assert.equal(state, stateBeforeDouble);
  });

  await t.test('timeout/network error/5xx during submitting goes to "unknown"', () => {
    const setupSubmitting = () => {
      let s = bookingReducer(initialBookingState, {
        type: 'START_REPRICE',
        passengers: samplePassengers,
        contact: sampleContact,
        originalPrice: basePrice,
      });
      s = bookingReducer(s, { type: 'REPRICE_SUCCESS', newPrice: basePrice });
      return bookingReducer(s, { type: 'SUBMIT_BOOKING' });
    };

    // Timeout (status 408)
    let s1 = setupSubmitting();
    s1 = bookingReducer(s1, {
      type: 'BOOKING_FAILURE',
      error: { status: 408, code: 'TIMEOUT', message: 'Timeout' },
    });
    assert.equal(s1.status, 'unknown');

    // Network error (status 0)
    let s2 = setupSubmitting();
    s2 = bookingReducer(s2, {
      type: 'BOOKING_FAILURE',
      error: { status: 0, code: 'NETWORK_ERROR', message: 'Network failed' },
    });
    assert.equal(s2.status, 'unknown');

    // Server 502
    let s3 = setupSubmitting();
    s3 = bookingReducer(s3, {
      type: 'BOOKING_FAILURE',
      error: { status: 502, code: 'PROVIDER_ERROR', message: 'Bad Gateway' },
    });
    assert.equal(s3.status, 'unknown');
  });

  await t.test('definite server rejections (400, 409, 410, 422) go to "failed"', () => {
    const setupSubmitting = () => {
      let s = bookingReducer(initialBookingState, {
        type: 'START_REPRICE',
        passengers: samplePassengers,
        contact: sampleContact,
        originalPrice: basePrice,
      });
      s = bookingReducer(s, { type: 'REPRICE_SUCCESS', newPrice: basePrice });
      return bookingReducer(s, { type: 'SUBMIT_BOOKING' });
    };

    for (const status of [400, 409, 410, 422]) {
      let s = setupSubmitting();
      s = bookingReducer(s, {
        type: 'BOOKING_FAILURE',
        error: { status, message: `Rejection with status ${status}` },
      });
      assert.equal(s.status, 'failed', `Status ${status} must transition to failed`);
    }
  });

  await t.test('from "unknown", submit is ignored and only RESET is allowed', () => {
    let state = bookingReducer(initialBookingState, {
      type: 'START_REPRICE',
      passengers: samplePassengers,
      contact: sampleContact,
      originalPrice: basePrice,
    });
    state = bookingReducer(state, { type: 'REPRICE_SUCCESS', newPrice: basePrice });
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    state = bookingReducer(state, {
      type: 'BOOKING_FAILURE',
      error: { status: 408, message: 'Timed out' },
    });
    assert.equal(state.status, 'unknown');

    // Submit is ignored
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'unknown');

    // Reset works
    state = bookingReducer(state, { type: 'RESET' });
    assert.equal(state.status, 'editing');
  });

  await t.test('from "confirmed", everything except reset is ignored', () => {
    let state = bookingReducer(initialBookingState, {
      type: 'START_REPRICE',
      passengers: samplePassengers,
      contact: sampleContact,
      originalPrice: basePrice,
    });
    state = bookingReducer(state, { type: 'REPRICE_SUCCESS', newPrice: basePrice });
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    state = bookingReducer(state, {
      type: 'BOOKING_SUCCESS',
      confirmation: { bookingReference: 'ABC123XYZ' },
    });
    assert.equal(state.status, 'confirmed');

    // All passenger and contact data in state must be purged
    assert.deepEqual(state.passengers, []);
    assert.deepEqual(state.contact, { email: '', phone: '' });

    // Actions ignored
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'confirmed');
    state = bookingReducer(state, { type: 'BACK_TO_EDIT' });
    assert.equal(state.status, 'confirmed');

    // Reset transitions to initial
    state = bookingReducer(state, { type: 'RESET' });
    assert.equal(state.status, 'editing');
  });

  await t.test('price-higher repricing requires acceptPrice before submit is allowed', () => {
    let state = bookingReducer(initialBookingState, {
      type: 'START_REPRICE',
      passengers: samplePassengers,
      contact: sampleContact,
      originalPrice: { amount: '200.00', currency: 'USD' },
    });

    // Reprice returns a HIGHER price: 250.00 vs 200.00
    state = bookingReducer(state, {
      type: 'REPRICE_SUCCESS',
      newPrice: { amount: '250.00', currency: 'USD' },
    });
    assert.equal(state.status, 'review');
    assert.equal(state.priceComparison, 'higher');
    assert.equal(state.priceAccepted, false);

    // Attempting submit without accepting price MUST BE IGNORED
    const stateUnaccepted = state;
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'review');
    assert.equal(state, stateUnaccepted);

    // Now accept price
    state = bookingReducer(state, { type: 'ACCEPT_PRICE' });
    assert.equal(state.priceAccepted, true);

    // Now submit transitions to submitting
    state = bookingReducer(state, { type: 'SUBMIT_BOOKING' });
    assert.equal(state.status, 'submitting');
  });
});

