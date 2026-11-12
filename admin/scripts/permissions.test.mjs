import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRouteAllowed,
  isRouteAllowedForAdmin,
  ROUTE_PERMISSIONS,
} from '../src/lib/permissions.ts';

describe('permissions helper', () => {
  it('correctly maps super_admin to all routes including /admins and /change-password', () => {
    assert.equal(isRouteAllowed('super_admin', '/'), true);
    assert.equal(isRouteAllowed('super_admin', '/audit'), true);
    assert.equal(isRouteAllowed('super_admin', '#/audit'), true);
    assert.equal(isRouteAllowed('super_admin', '/admins'), true);
    assert.equal(isRouteAllowed('super_admin', '#/admins'), true);
    assert.equal(isRouteAllowed('super_admin', '/places'), true);
    assert.equal(isRouteAllowed('super_admin', '#/places'), true);
    assert.equal(isRouteAllowed('super_admin', '/places/new'), true);
    assert.equal(isRouteAllowed('super_admin', '/places/6abb3f711d4fb0f0d98a0ae6'), true);
    assert.equal(isRouteAllowed('super_admin', '/hotels'), true);
    assert.equal(isRouteAllowed('super_admin', '#/hotels'), true);
    assert.equal(isRouteAllowed('super_admin', '/hotels/new'), true);
    assert.equal(isRouteAllowed('super_admin', '/hotels/6abb3f711d4fb0f0d98a0ae6'), true);
    assert.equal(isRouteAllowed('super_admin', '/collections'), true);
    assert.equal(isRouteAllowed('super_admin', '#/collections'), true);
    assert.equal(isRouteAllowed('super_admin', '/collections/honeymoons'), true);
    assert.equal(isRouteAllowed('super_admin', '/support'), true);
    assert.equal(isRouteAllowed('super_admin', '#/support'), true);
    assert.equal(isRouteAllowed('super_admin', '/change-password'), true);
  });

  it('allows content_editor on Dashboard, Places, Hotels, Collections, and /change-password, forbids on /support, /audit and /admins', () => {
    assert.equal(isRouteAllowed('content_editor', '/'), true);
    assert.equal(isRouteAllowed('content_editor', '/places'), true);
    assert.equal(isRouteAllowed('content_editor', '#/places'), true);
    assert.equal(isRouteAllowed('content_editor', '/places/new'), true);
    assert.equal(isRouteAllowed('content_editor', '/places/6abb3f711d4fb0f0d98a0ae6'), true);
    assert.equal(isRouteAllowed('content_editor', '/hotels'), true);
    assert.equal(isRouteAllowed('content_editor', '#/hotels'), true);
    assert.equal(isRouteAllowed('content_editor', '/hotels/new'), true);
    assert.equal(isRouteAllowed('content_editor', '/hotels/6abb3f711d4fb0f0d98a0ae6'), true);
    assert.equal(isRouteAllowed('content_editor', '/collections'), true);
    assert.equal(isRouteAllowed('content_editor', '#/collections'), true);
    assert.equal(isRouteAllowed('content_editor', '/collections/wellness'), true);
    assert.equal(isRouteAllowed('content_editor', '/change-password'), true);
    assert.equal(isRouteAllowed('content_editor', '/support'), false);
    assert.equal(isRouteAllowed('content_editor', '#/support'), false);
    assert.equal(isRouteAllowed('content_editor', '/audit'), false);
    assert.equal(isRouteAllowed('content_editor', '#/audit'), false);
    assert.equal(isRouteAllowed('content_editor', '/admins'), false);
    assert.equal(isRouteAllowed('content_editor', '#/admins'), false);
  });

  it('allows support_agent on Dashboard, Support, and /change-password, forbids on /places, /hotels, /collections, /audit, and /admins', () => {
    assert.equal(isRouteAllowed('support_agent', '/'), true);
    assert.equal(isRouteAllowed('support_agent', '/support'), true);
    assert.equal(isRouteAllowed('support_agent', '#/support'), true);
    assert.equal(isRouteAllowed('support_agent', '/change-password'), true);
    assert.equal(isRouteAllowed('support_agent', '/places'), false);
    assert.equal(isRouteAllowed('support_agent', '#/places'), false);
    assert.equal(isRouteAllowed('support_agent', '/places/new'), false);
    assert.equal(isRouteAllowed('support_agent', '/places/6abb3f711d4fb0f0d98a0ae6'), false);
    assert.equal(isRouteAllowed('support_agent', '/hotels'), false);
    assert.equal(isRouteAllowed('support_agent', '#/hotels'), false);
    assert.equal(isRouteAllowed('support_agent', '/hotels/new'), false);
    assert.equal(isRouteAllowed('support_agent', '/hotels/6abb3f711d4fb0f0d98a0ae6'), false);
    assert.equal(isRouteAllowed('support_agent', '/collections'), false);
    assert.equal(isRouteAllowed('support_agent', '#/collections'), false);
    assert.equal(isRouteAllowed('support_agent', '/collections/adventure'), false);
    assert.equal(isRouteAllowed('support_agent', '/audit'), false);
    assert.equal(isRouteAllowed('support_agent', '#/audit'), false);
    assert.equal(isRouteAllowed('support_agent', '/admins'), false);
    assert.equal(isRouteAllowed('support_agent', '#/admins'), false);
  });

  it('returns false for unknown roles, null, or undefined', () => {
    assert.equal(isRouteAllowed(null, '/'), false);
    assert.equal(isRouteAllowed(undefined, '/'), false);
    assert.equal(isRouteAllowed('', '/'), false);
    assert.equal(isRouteAllowed('hacker', '/'), false);
    assert.equal(isRouteAllowed('guest', '/admins'), false);
    assert.equal(isRouteAllowed('guest', '/places'), false);
    assert.equal(isRouteAllowed('guest', '/hotels'), false);
    assert.equal(isRouteAllowed('guest', '/collections'), false);
  });

  it('returns false for unrecognized routes', () => {
    assert.equal(isRouteAllowed('super_admin', '/unknown-route'), false);
    assert.equal(isRouteAllowed('super_admin', '/pricing'), false);
    assert.equal(isRouteAllowed('super_admin', '/tours'), false);
  });

  describe('isRouteAllowedForAdmin (forced password change lockdown)', () => {
    it('when mustChangePassword is true, allows ONLY /change-password and blocks all other routes', () => {
      const superAdminPending = { role: 'super_admin', mustChangePassword: true };
      assert.equal(isRouteAllowedForAdmin(superAdminPending, '/change-password'), true);
      assert.equal(isRouteAllowedForAdmin(superAdminPending, '#/change-password'), true);
      assert.equal(isRouteAllowedForAdmin(superAdminPending, '/'), false);
      assert.equal(isRouteAllowedForAdmin(superAdminPending, '/audit'), false);
      assert.equal(isRouteAllowedForAdmin(superAdminPending, '/admins'), false);

      const editorPending = { role: 'content_editor', mustChangePassword: true };
      assert.equal(isRouteAllowedForAdmin(editorPending, '/change-password'), true);
      assert.equal(isRouteAllowedForAdmin(editorPending, '/'), false);
      assert.equal(isRouteAllowedForAdmin(editorPending, '/admins'), false);
    });

    it('when mustChangePassword is false, respects normal role permissions', () => {
      const superAdminOk = { role: 'super_admin', mustChangePassword: false };
      assert.equal(isRouteAllowedForAdmin(superAdminOk, '/'), true);
      assert.equal(isRouteAllowedForAdmin(superAdminOk, '/admins'), true);
      assert.equal(isRouteAllowedForAdmin(superAdminOk, '/audit'), true);

      const editorOk = { role: 'content_editor', mustChangePassword: false };
      assert.equal(isRouteAllowedForAdmin(editorOk, '/'), true);
      assert.equal(isRouteAllowedForAdmin(editorOk, '/admins'), false);
      assert.equal(isRouteAllowedForAdmin(editorOk, '/audit'), false);
    });
  });
});
