import { isRouteAllowed, type AdminRole, type AdminRoute } from './permissions.ts';

export interface RouteItem {
  id: string;
  path: AdminRoute;
  label: string;
}

/**
 * Registry containing central navigation routes that exist in the admin panel.
 * Shown in sidebar navigation based on role permissions and account state.
 */
export const AVAILABLE_ROUTES: readonly RouteItem[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
  },
  {
    id: 'places',
    path: '/places',
    label: 'Places',
  },
  {
    id: 'hotels',
    path: '/hotels',
    label: 'Hotels',
  },
  {
    id: 'collections',
    path: '/collections',
    label: 'Collections',
  },
  {
    id: 'support',
    path: '/support',
    label: 'Support',
  },
  {
    id: 'admins',
    path: '/admins',
    label: 'Admins',
  },
  {
    id: 'audit',
    path: '/audit',
    label: 'Audit log',
  },
];

/**
 * Returns the list of navigation routes that a given role is permitted to see.
 * When mustChangePassword is true, returns an empty array to hide navigation.
 */
export function getNavRoutes(
  role: AdminRole | string | null | undefined,
  mustChangePassword?: boolean
): RouteItem[] {
  if (!role || mustChangePassword === true) {
    return [];
  }
  return AVAILABLE_ROUTES.filter((item) => isRouteAllowed(role, item.path));
}
