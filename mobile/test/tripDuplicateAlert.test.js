import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDuplicateAlertConfig,
  buildGeneratePayload,
} from '../src/utils/tripDuplicateAlert.js';

describe('Mobile Trip Duplicate Alert and Payload Helpers', () => {
  describe('buildGeneratePayload', () => {
    it('returns rawRequest without onDuplicate or replaceTripId by default', () => {
      const payload = buildGeneratePayload({
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
      });
      assert.deepEqual(payload, {
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
      });
    });

    it('attaches onDuplicate and replaceTripId when replacing', () => {
      const payload = buildGeneratePayload({
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
        onDuplicate: 'replace',
        replaceTripId: 'trip-12345',
      });
      assert.deepEqual(payload, {
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
        onDuplicate: 'replace',
        replaceTripId: 'trip-12345',
      });
    });

    it('attaches onDuplicate when keeping both', () => {
      const payload = buildGeneratePayload({
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
        onDuplicate: 'keep_both',
      });
      assert.deepEqual(payload, {
        rawRequest: 'Plan a 3-day trip to Goa from 2026-12-01 to 2026-12-04.',
        onDuplicate: 'keep_both',
      });
    });

    it('ignores invalid onDuplicate values', () => {
      const payload = buildGeneratePayload({
        rawRequest: 'Plan a 3-day trip to Goa.',
        onDuplicate: 'invalid_mode',
      });
      assert.deepEqual(payload, {
        rawRequest: 'Plan a 3-day trip to Goa.',
      });
    });
  });

  describe('buildDuplicateAlertConfig', () => {
    it('constructs alert title, message and all four action buttons', () => {
      let openedId = null;
      let replacedId = null;
      let keptBoth = false;
      let cancelled = false;

      const config = buildDuplicateAlertConfig({
        data: {
          duplicate: true,
          existingTripId: 'trip-999',
          destination: 'Varkala',
          startDate: '2026-12-10',
          endDate: '2026-12-14',
        },
        destination: 'Varkala',
        startDate: '2026-12-10',
        endDate: '2026-12-14',
        onOpenExisting: (id) => {
          openedId = id;
        },
        onReplace: (id) => {
          replacedId = id;
        },
        onKeepBoth: () => {
          keptBoth = true;
        },
        onCancel: () => {
          cancelled = true;
        },
      });

      assert.equal(config.title, 'Existing Trip Found');
      assert.match(config.message, /already have a trip to Varkala/);
      assert.match(config.message, /2026-12-10 to 2026-12-14/);
      assert.equal(config.buttons.length, 4);

      // 1. Cancel
      const cancelBtn = config.buttons.find((b) => b.text === 'Cancel');
      assert.ok(cancelBtn);
      assert.equal(cancelBtn.style, 'cancel');
      cancelBtn.onPress();
      assert.equal(cancelled, true);

      // 2. Open Existing
      const openBtn = config.buttons.find((b) => b.text === 'Open Existing');
      assert.ok(openBtn);
      openBtn.onPress();
      assert.equal(openedId, 'trip-999');

      // 3. Replace with New Plan
      const replaceBtn = config.buttons.find((b) => b.text === 'Replace with New Plan');
      assert.ok(replaceBtn);
      replaceBtn.onPress();
      assert.equal(replacedId, 'trip-999');

      // 4. Keep Both
      const keepBtn = config.buttons.find((b) => b.text === 'Keep Both');
      assert.ok(keepBtn);
      keepBtn.onPress();
      assert.equal(keptBoth, true);
    });

    it('falls back gracefully when data fields are omitted', () => {
      const config = buildDuplicateAlertConfig({
        data: { duplicate: true, existingTripId: 'trip-abc' },
        destination: 'Goa',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        onOpenExisting: () => {},
        onReplace: () => {},
        onKeepBoth: () => {},
      });

      assert.match(config.message, /already have a trip to Goa/);
      assert.match(config.message, /2026-12-01 to 2026-12-05/);
    });
  });
});

