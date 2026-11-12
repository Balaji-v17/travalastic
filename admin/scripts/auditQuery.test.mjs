import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuditQuery,
  isValidDateString,
} from '../src/lib/auditQuery.ts';

describe('auditQuery helper', () => {
  it('returns empty string when no filters or empty filters are passed', () => {
    assert.equal(buildAuditQuery(null), '');
    assert.equal(buildAuditQuery({}), '');
    assert.equal(buildAuditQuery({ actor: '', action: '   ', targetType: null }), '');
  });

  it('builds query string and drops empty or whitespace-only values', () => {
    const query = buildAuditQuery({
      actor: 'admin@travalastic.com',
      action: 'admin.login',
      targetType: '   ',
      targetId: null,
      limit: 50,
    });

    assert.ok(query.startsWith('?'));
    const params = new URLSearchParams(query.slice(1));
    assert.equal(params.get('actor'), 'admin@travalastic.com');
    assert.equal(params.get('action'), 'admin.login');
    assert.equal(params.get('limit'), '50');
    assert.equal(params.has('targetType'), false);
    assert.equal(params.has('targetId'), false);
  });

  it('properly encodes special characters (emails, spaces, symbols)', () => {
    const query = buildAuditQuery({
      actor: 'super+admin@travalastic.com',
      action: 'place:update',
      targetId: 'id/with#special?char',
    });

    assert.ok(query.includes('actor=super%2Badmin%40travalastic.com'));
    assert.ok(query.includes('action=place%3Aupdate'));
    assert.ok(query.includes('targetId=id%2Fwith%23special%3Fchar'));
  });

  it('caps limit at 100 max', () => {
    const query = buildAuditQuery({ limit: 500 });
    const params = new URLSearchParams(query.slice(1));
    assert.equal(params.get('limit'), '100');
  });

  it('accepts valid dates and formats them', () => {
    assert.equal(isValidDateString('2026-11-01T12:00:00Z'), true);
    assert.equal(isValidDateString('2026-11-01'), true);

    const query = buildAuditQuery({
      from: '2026-11-01T12:00:00.000Z',
      to: '2026-11-02T12:00:00.000Z',
    });

    const params = new URLSearchParams(query.slice(1));
    assert.equal(params.get('from'), '2026-11-01T12:00:00.000Z');
    assert.equal(params.get('to'), '2026-11-02T12:00:00.000Z');
  });

  it('rejects invalid dates by throwing an error', () => {
    assert.equal(isValidDateString('not-a-valid-date'), false);

    assert.throws(
      () => {
        buildAuditQuery({ from: 'not-a-valid-date' });
      },
      {
        message: /Invalid date provided for "from"/,
      }
    );

    assert.throws(
      () => {
        buildAuditQuery({ to: 'invalid-date-format' });
      },
      {
        message: /Invalid date provided for "to"/,
      }
    );
  });
});

