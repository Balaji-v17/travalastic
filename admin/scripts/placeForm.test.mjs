import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlaceForm } from '../src/lib/placeForm.ts';

describe('placeForm helper', () => {
  const validCreateValues = {
    name: 'Calangute Beach',
    city: 'Goa',
    state: 'Goa',
    type: 'Beach',
    latitude: '15.54',
    longitude: '73.75',
    zone: 'Western',
    significance: 'Popular tourist beach',
    bestTimeToVisit: 'November to February',
    googleRating: '4.5',
    entranceFeeINR: '0',
    timeNeededHours: '3.0',
  };

  it('passes validation with all valid fields', () => {
    const res = validatePlaceForm(validCreateValues, 'create');
    assert.equal(res.isValid, true);
    assert.deepEqual(res.errors, {});
  });

  describe('name validation', () => {
    it('rejects empty or whitespace-only name', () => {
      const res = validatePlaceForm({ ...validCreateValues, name: '   ' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /name is required/i);
    });

    it('rejects name shorter than 2 characters', () => {
      const res = validatePlaceForm({ ...validCreateValues, name: 'A' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /between 2 and 120 characters/i);
    });

    it('rejects name longer than 120 characters', () => {
      const res = validatePlaceForm({ ...validCreateValues, name: 'X'.repeat(121) });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /between 2 and 120 characters/i);
    });

    it('rejects HTML tags in name', () => {
      const res = validatePlaceForm({ ...validCreateValues, name: '<script>alert(1)</script>' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /HTML tags are not allowed/i);
    });
  });

  describe('city, state, and type validation', () => {
    it('rejects missing or empty city, state, or type', () => {
      const resCity = validatePlaceForm({ ...validCreateValues, city: '' });
      assert.equal(resCity.isValid, false);
      assert.match(resCity.errors.city, /city is required/i);

      const resState = validatePlaceForm({ ...validCreateValues, state: '' });
      assert.equal(resState.isValid, false);
      assert.match(resState.errors.state, /state is required/i);

      const resType = validatePlaceForm({ ...validCreateValues, type: '' });
      assert.equal(resType.isValid, false);
      assert.match(resType.errors.type, /type is required/i);
    });

    it('rejects HTML tags in city, state, or type', () => {
      const res = validatePlaceForm({ ...validCreateValues, city: '<b>Goa</b>' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.city, /HTML tags are not allowed/i);
    });
  });

  describe('coordinates validation (latitude & longitude)', () => {
    it('rejects coordinates out of valid range', () => {
      // Latitude > 90
      const res1 = validatePlaceForm({ ...validCreateValues, latitude: '95.5' });
      assert.equal(res1.isValid, false);
      assert.match(res1.errors.latitude, /between -90 and 90/i);

      // Latitude < -90
      const res2 = validatePlaceForm({ ...validCreateValues, latitude: '-91' });
      assert.equal(res2.isValid, false);
      assert.match(res2.errors.latitude, /between -90 and 90/i);

      // Longitude > 180
      const res3 = validatePlaceForm({ ...validCreateValues, longitude: '185' });
      assert.equal(res3.isValid, false);
      assert.match(res3.errors.longitude, /between -180 and 180/i);

      // Longitude < -180
      const res4 = validatePlaceForm({ ...validCreateValues, longitude: '-181' });
      assert.equal(res4.isValid, false);
      assert.match(res4.errors.longitude, /between -180 and 180/i);
    });

    it('rejects swapped coordinates where latitude exceeds 90', () => {
      // User accidentally entered lon (73.75) into lat and lat (15.54) into lon, but with 120 lat
      const res = validatePlaceForm({ ...validCreateValues, latitude: '120.5', longitude: '45.0' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.latitude, /between -90 and 90/i);
    });

    it('rejects Null Island (0, 0) coordinates', () => {
      const res = validatePlaceForm({ ...validCreateValues, latitude: '0', longitude: '0' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.latitude, /cannot be 0, 0/i);
    });

    it('rejects non-numeric coordinates', () => {
      const res = validatePlaceForm({ ...validCreateValues, latitude: 'not-a-number' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.latitude, /valid number/i);
    });

    it('rejects one missing coordinate in create mode', () => {
      const res = validatePlaceForm({ ...validCreateValues, latitude: '15.54', longitude: '' }, 'create');
      assert.equal(res.isValid, false);
      assert.match(res.errors.longitude, /entered together/i);
    });

    it('rejects one missing coordinate in edit mode when the other is modified', () => {
      const res = validatePlaceForm({ ...validCreateValues, latitude: '15.54', longitude: '' }, 'edit');
      assert.equal(res.isValid, false);
      assert.match(res.errors.longitude, /updated together/i);
    });
  });

  describe('numeric fields validation', () => {
    it('rejects googleRating > 5 or < 0 (e.g. 5.1)', () => {
      const resHigh = validatePlaceForm({ ...validCreateValues, googleRating: '5.1' });
      assert.equal(resHigh.isValid, false);
      assert.match(resHigh.errors.googleRating, /between 0 and 5/i);

      const resNeg = validatePlaceForm({ ...validCreateValues, googleRating: '-0.5' });
      assert.equal(resNeg.isValid, false);
      assert.match(resNeg.errors.googleRating, /between 0 and 5/i);
    });

    it('rejects negative entranceFeeINR', () => {
      const res = validatePlaceForm({ ...validCreateValues, entranceFeeINR: '-10' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.entranceFeeINR, /0 or greater/i);
    });

    it('rejects timeNeededHours > 48 or < 0', () => {
      const res = validatePlaceForm({ ...validCreateValues, timeNeededHours: '50' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.timeNeededHours, /between 0 and 48 hours/i);
    });
  });

  describe('optional text field limits', () => {
    it('rejects overlong zone (> 100) or overlong significance (> 500)', () => {
      const resZone = validatePlaceForm({ ...validCreateValues, zone: 'Z'.repeat(101) });
      assert.equal(resZone.isValid, false);
      assert.match(resZone.errors.zone, /cannot exceed 100 characters/i);

      const resSig = validatePlaceForm({ ...validCreateValues, significance: 'S'.repeat(501) });
      assert.equal(resSig.isValid, false);
      assert.match(resSig.errors.significance, /cannot exceed 500 characters/i);
    });
  });
});

