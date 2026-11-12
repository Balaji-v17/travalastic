import type { AdminRole } from './permissions.ts';
export type { AdminRole };

export interface RoleConfig {
  role: AdminRole;
  label: string;
  description: string;
}

export const ADMIN_ROLES: readonly RoleConfig[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Manages admins, settings and the audit log',
  },
  {
    role: 'content_editor',
    label: 'Content Editor',
    description: 'Manages places, hotels and collections as those screens are added',
  },
  {
    role: 'support_agent',
    label: 'Support Agent',
    description: 'Looks up accounts and handles deletion requests as that screen is added',
  },
] as const;

export function getRoleConfig(role: string | null | undefined): RoleConfig | undefined {
  if (!role) return undefined;
  return ADMIN_ROLES.find((r) => r.role === role);
}

export function isValidRole(role: unknown): role is AdminRole {
  return typeof role === 'string' && ADMIN_ROLES.some((r) => r.role === role);
}
