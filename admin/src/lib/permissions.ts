export type AdminRole = 'super_admin' | 'content_editor' | 'support_agent';

export type AdminRoute =
  | '/'
  | '/places'
  | '/places/new'
  | '/hotels'
  | '/hotels/new'
  | '/collections'
  | '/support'
  | '/audit'
  | '/admins'
  | '/change-password';

/**
 * Route-to-role permissions matrix.
 * Defines which roles are authorized to access each route.
 */
export const ROUTE_PERMISSIONS: Record<AdminRoute, readonly AdminRole[]> = {
  '/': ['super_admin', 'content_editor', 'support_agent'],
  '/places': ['super_admin', 'content_editor'],
  '/places/new': ['super_admin', 'content_editor'],
  '/hotels': ['super_admin', 'content_editor'],
  '/hotels/new': ['super_admin', 'content_editor'],
  '/collections': ['super_admin', 'content_editor'],
  '/support': ['super_admin', 'support_agent'],
  '/audit': ['super_admin'],
  '/admins': ['super_admin'],
  '/change-password': ['super_admin', 'content_editor', 'support_agent'],
};

/**
 * Normalizes a route string: strips hash, query params, and trailing slashes.
 */
export function normalizeRoute(route: string): string {
  let cleanRoute = route.trim();
  if (cleanRoute.startsWith('#')) {
    cleanRoute = cleanRoute.slice(1);
  }
  const queryIndex = cleanRoute.indexOf('?');
  if (queryIndex !== -1) {
    cleanRoute = cleanRoute.slice(0, queryIndex);
  }
  cleanRoute = cleanRoute.replace(/\/+$/, '') || '/';
  if (!cleanRoute.startsWith('/')) {
    cleanRoute = `/${cleanRoute}`;
  }
  return cleanRoute;
}

/**
 * Checks if a given role is allowed to access the specified route.
 * Returns false if role or route is unknown or unauthorized.
 */
export function isRouteAllowed(
  role: string | null | undefined,
  route: string
): boolean {
  if (!role || typeof role !== 'string') {
    return false;
  }

  const cleanRoute = normalizeRoute(route);

  // Dynamic parameterized routes matching (e.g. /places/:id, /hotels/:id, /collections/:key)
  let lookupKey = cleanRoute as AdminRoute;
  if (cleanRoute.startsWith('/places/') && cleanRoute !== '/places/new') {
    lookupKey = '/places';
  } else if (cleanRoute.startsWith('/hotels/') && cleanRoute !== '/hotels/new') {
    lookupKey = '/hotels';
  } else if (cleanRoute.startsWith('/collections/')) {
    lookupKey = '/collections';
  }

  const allowedRoles = ROUTE_PERMISSIONS[lookupKey];
  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(role as AdminRole);
}

/**
 * Checks route access considering both role and mustChangePassword state.
 * If mustChangePassword is true, ONLY /change-password is permitted.
 */
export function isRouteAllowedForAdmin(
  admin: { role?: string; mustChangePassword?: boolean } | null | undefined,
  route: string
): boolean {
  if (!admin || !admin.role) {
    return false;
  }

  const cleanRoute = normalizeRoute(route);

  // Forced password change lockdown
  if (admin.mustChangePassword === true) {
    return cleanRoute === '/change-password';
  }

  return isRouteAllowed(admin.role, cleanRoute);
}
