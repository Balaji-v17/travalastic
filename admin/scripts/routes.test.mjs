import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_ROUTES,
  getNavRoutes,
} from '../src/lib/routes.ts';

describe('routes helper', () => {
  it('contains ONLY routes that currently exist (Dashboard, Places, Hotels, Collections, Support, Admins, and Audit Log)', () => {
    const paths = AVAILABLE_ROUTES.map((r) => r.path);
    assert.deepEqual(paths, ['/', '/places', '/hotels', '/collections', '/support', '/admins', '/audit']);

    // Ensure built sections are present
    const allLabels = AVAILABLE_ROUTES.map((r) => r.label.toLowerCase());
    assert.equal(allLabels.includes('places'), true);
    assert.equal(allLabels.includes('hotels'), true);
    assert.equal(allLabels.includes('collections'), true);
    assert.equal(allLabels.includes('support'), true);
  });

  it('super_admin receives Dashboard, Places, Hotels, Collections, Support, Admins, and Audit Log in nav', () => {
    const nav = getNavRoutes('super_admin');
    const paths = nav.map((r) => r.path);
    assert.deepEqual(paths, ['/', '/places', '/hotels', '/collections', '/support', '/admins', '/audit']);
  });

  it('content_editor receives Dashboard, Places, Hotels, and Collections in nav', () => {
    const nav = getNavRoutes('content_editor');
    const paths = nav.map((r) => r.path);
    assert.deepEqual(paths, ['/', '/places', '/hotels', '/collections']);
  });

  it('support_agent receives Dashboard and Support in nav', () => {
    const nav = getNavRoutes('support_agent');
    const paths = nav.map((r) => r.path);
    assert.deepEqual(paths, ['/', '/support']);
  });

  it('unknown or missing role receives empty nav', () => {
    assert.deepEqual(getNavRoutes(null), []);
    assert.deepEqual(getNavRoutes(undefined), []);
    assert.deepEqual(getNavRoutes(''), []);
    assert.deepEqual(getNavRoutes('anonymous'), []);
  });

  it('hides all navigation when mustChangePassword is true', () => {
    assert.deepEqual(getNavRoutes('super_admin', true), []);
    assert.deepEqual(getNavRoutes('content_editor', true), []);
    assert.deepEqual(getNavRoutes('support_agent', true), []);
  });
});
