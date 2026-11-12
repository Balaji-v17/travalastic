import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, ApiError } from '../lib/api.ts';
import { ADMIN_ROLES, type RoleConfig } from '../lib/roles.ts';
import { validateCreateAdminForm } from '../lib/adminForm.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import { Modal } from '../components/Modal.tsx';
import { TemporaryPasswordDialog } from '../components/TemporaryPasswordDialog.tsx';
import type { AdminRole } from '../lib/permissions.ts';

export interface AdminUserItem {
  id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  createdByEmail: string | null;
}

interface AdminsListResponse {
  items: AdminUserItem[];
}

interface CreateAdminResponse {
  admin: {
    id: string;
    email: string;
    role: AdminRole;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: string;
  };
  temporaryPassword: string;
}

interface ResetPasswordResponse {
  temporaryPassword: string;
}

export function AdminsPage() {
  const { admin: currentAdmin } = useAuth();

  const [admins, setAdmins] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<AdminRole>('content_editor');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Row Action Dialog states
  const [roleTarget, setRoleTarget] = useState<AdminUserItem | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<AdminRole>('content_editor');
  const [roleActionError, setRoleActionError] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<AdminUserItem | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminUserItem | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Temporary password dialog state
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    isOpen: boolean;
    password: string | null;
    email: string;
  }>({
    isOpen: false,
    password: null,
    email: '',
  });

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiFetch<AdminsListResponse>('/admin/admins');
      setAdmins(data.items || []);
    } catch (err: unknown) {
      setFetchError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Handle Create Admin
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const validation = validateCreateAdminForm(createEmail, createRole);
    if (!validation.isValid) {
      setCreateError(validation.errors.email || validation.errors.role || 'Validation failed');
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiFetch<CreateAdminResponse>('/admin/admins', {
        method: 'POST',
        body: {
          email: createEmail.trim().toLowerCase(),
          role: createRole,
        },
      });

      const tempPwd = res.temporaryPassword;
      const targetEmail = res.admin.email;

      // Close create modal and open temporary password modal
      setIsCreateOpen(false);
      setCreateEmail('');
      setCreateRole('content_editor');
      setStatusMessage(`Admin account ${targetEmail} created successfully.`);

      setTempPasswordModal({
        isOpen: true,
        password: tempPwd,
        email: targetEmail,
      });

      // Re-fetch list
      await fetchAdmins();
    } catch (err: unknown) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Change Role
  const handleChangeRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget) return;

    if (selectedNewRole === roleTarget.role) {
      setRoleActionError('Selected role is already assigned to this admin.');
      return;
    }

    setIsUpdatingRole(true);
    setRoleActionError(null);
    try {
      await apiFetch<{ admin: any }>(`/admin/admins/${roleTarget.id}`, {
        method: 'PATCH',
        body: { role: selectedNewRole },
      });

      setStatusMessage(`Role for ${roleTarget.email} updated to ${selectedNewRole.replace('_', ' ')}.`);
      setRoleTarget(null);
      await fetchAdmins();
    } catch (err: unknown) {
      setRoleActionError(getApiErrorMessage(err));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Deactivate / Reactivate
  const handleToggleActiveSubmit = async () => {
    if (!deactivateTarget) return;

    setIsDeactivating(true);
    setDeactivateError(null);
    const newActiveState = !deactivateTarget.active;

    try {
      await apiFetch<{ admin: any }>(`/admin/admins/${deactivateTarget.id}`, {
        method: 'PATCH',
        body: { active: newActiveState },
      });

      setStatusMessage(
        newActiveState
          ? `Admin ${deactivateTarget.email} reactivated.`
          : `Admin ${deactivateTarget.email} deactivated.`
      );
      setDeactivateTarget(null);
      await fetchAdmins();
    } catch (err: unknown) {
      setDeactivateError(getApiErrorMessage(err));
    } finally {
      setIsDeactivating(false);
    }
  };

  // Handle Reset Password
  const handleResetPasswordSubmit = async () => {
    if (!resetTarget) return;

    setIsResetting(true);
    setResetError(null);
    try {
      const res = await apiFetch<ResetPasswordResponse>(
        `/admin/admins/${resetTarget.id}/reset-password`,
        { method: 'POST' }
      );

      const tempPwd = res.temporaryPassword;
      const targetEmail = resetTarget.email;

      setResetTarget(null);
      setStatusMessage(`Password for ${targetEmail} reset successfully.`);

      setTempPasswordModal({
        isOpen: true,
        password: tempPwd,
        email: targetEmail,
      });

      await fetchAdmins();
    } catch (err: unknown) {
      setResetError(getApiErrorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'content_editor':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'support_agent':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return 'Never';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Never';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live status announcements for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* Header and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Admin Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage administrative credentials, role assignments, and account access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateEmail('');
            setCreateRole('content_editor');
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors shrink-0"
        >
          <span className="mr-1.5 text-base leading-none">+</span> Create admin
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between"
          role="status"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && admins.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="inline-flex items-center space-x-2">
            <svg
              className="animate-spin h-5 w-5 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span className="text-sm font-medium">Loading admin accounts...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm text-red-700 font-medium mb-3">{fetchError}</p>
          <button
            type="button"
            onClick={fetchAdmins}
            className="px-3.5 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table view */}
      {!isLoading && !fetchError && admins.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          No admin accounts found.
        </div>
      )}

      {admins.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Admin Email</th>
                  <th scope="col" className="px-4 py-3.5">Role</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-4 py-3.5">Created</th>
                  <th scope="col" className="px-4 py-3.5">Last Sign-in</th>
                  <th scope="col" className="px-4 py-3.5">Created By</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {admins.map((item) => {
                  const isSelf = Boolean(currentAdmin && (item.id === currentAdmin.id || item.email.toLowerCase() === currentAdmin.email.toLowerCase()));
                  const selfTooltip = 'You cannot change your own role, deactivate, or reset your own password.';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Email */}
                      <td className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span>{item.email}</span>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getRoleBadge(
                            item.role
                          )}`}
                        >
                          {item.role.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                          <span
                            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${
                              item.active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                                item.active ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {item.active ? 'Active' : 'Inactive'}
                          </span>

                          {item.mustChangePassword && (
                            <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                              Password change pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Last Sign-in */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                        {formatDate(item.lastLoginAt)}
                      </td>

                      {/* Created By */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                        {item.createdByEmail || 'Initial setup'}
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap text-xs space-x-2">
                        {/* Change Role */}
                        <button
                          type="button"
                          disabled={isSelf}
                          title={isSelf ? selfTooltip : 'Change role'}
                          onClick={() => {
                            setRoleTarget(item);
                            setSelectedNewRole(item.role);
                            setRoleActionError(null);
                          }}
                          className={`font-semibold px-2 py-1 rounded-md transition-colors ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                          }`}
                        >
                          Change role
                        </button>

                        {/* Deactivate / Reactivate */}
                        <button
                          type="button"
                          disabled={isSelf}
                          title={isSelf ? selfTooltip : item.active ? 'Deactivate account' : 'Reactivate account'}
                          onClick={() => {
                            setDeactivateTarget(item);
                            setDeactivateError(null);
                          }}
                          className={`font-semibold px-2 py-1 rounded-md transition-colors ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : item.active
                              ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          {item.active ? 'Deactivate' : 'Reactivate'}
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          disabled={isSelf}
                          title={isSelf ? selfTooltip : 'Reset account password'}
                          onClick={() => {
                            setResetTarget(item);
                            setResetError(null);
                          }}
                          className={`font-semibold px-2 py-1 rounded-md transition-colors ${
                            isSelf
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ADMIN MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Admin"
        titleId="create-admin-title"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg" role="alert">
              {createError}
            </div>
          )}

          <div>
            <label htmlFor="create-admin-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Email address
            </label>
            <input
              id="create-admin-email"
              type="email"
              required
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              disabled={isCreating}
              placeholder="colleague@travalastic.com"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label htmlFor="create-admin-role" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Role assignment
            </label>
            <select
              id="create-admin-role"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as AdminRole)}
              disabled={isCreating}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            >
              {ADMIN_ROLES.map((r: RoleConfig) => (
                <option key={r.role} value={r.role}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5 leading-normal">
              {ADMIN_ROLES.find((r) => r.role === createRole)?.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE ROLE MODAL */}
      <Modal
        isOpen={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        title="Change Admin Role"
        titleId="change-role-title"
        maxWidthClass="max-w-md"
      >
        {roleTarget && (
          <form onSubmit={handleChangeRoleSubmit} className="space-y-4">
            {roleActionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg" role="alert">
                {roleActionError}
              </div>
            )}

            <p className="text-sm text-slate-600">
              Select a new role for <span className="font-semibold text-slate-900">{roleTarget.email}</span>:
            </p>

            <div>
              <label htmlFor="edit-role-select" className="sr-only">
                New role
              </label>
              <select
                id="edit-role-select"
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value as AdminRole)}
                disabled={isUpdatingRole}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                {ADMIN_ROLES.map((r: RoleConfig) => (
                  <option key={r.role} value={r.role}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                {ADMIN_ROLES.find((r) => r.role === selectedNewRole)?.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                disabled={isUpdatingRole}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingRole}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isUpdatingRole ? 'Updating...' : 'Confirm role change'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* DEACTIVATE / REACTIVATE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={deactivateTarget?.active ? 'Deactivate Admin' : 'Reactivate Admin'}
        titleId="toggle-active-title"
        maxWidthClass="max-w-md"
      >
        {deactivateTarget && (
          <div className="space-y-4">
            {deactivateError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg" role="alert">
                {deactivateError}
              </div>
            )}

            <p className="text-sm text-slate-600 leading-relaxed">
              {deactivateTarget.active
                ? `Deactivating signs this admin out immediately. Are you sure you want to deactivate ${deactivateTarget.email}?`
                : `Are you sure you want to reactivate ${deactivateTarget.email}?`}
            </p>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                disabled={isDeactivating}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleActiveSubmit}
                disabled={isDeactivating}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm disabled:opacity-50 transition-colors ${
                  deactivateTarget.active
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isDeactivating
                  ? 'Saving...'
                  : deactivateTarget.active
                  ? 'Deactivate admin'
                  : 'Reactivate admin'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* RESET PASSWORD CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        titleId="reset-password-title"
        maxWidthClass="max-w-md"
      >
        {resetTarget && (
          <div className="space-y-4">
            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg" role="alert">
                {resetError}
              </div>
            )}

            <p className="text-sm text-slate-600 leading-relaxed">
              Signs this admin out everywhere and gives them a new temporary password. Are you sure you want to reset the password for{' '}
              <span className="font-semibold text-slate-900">{resetTarget.email}</span>?
            </p>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                disabled={isResetting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPasswordSubmit}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isResetting ? 'Resetting...' : 'Reset password'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* TEMPORARY PASSWORD MODAL */}
      <TemporaryPasswordDialog
        isOpen={tempPasswordModal.isOpen}
        temporaryPassword={tempPasswordModal.password}
        adminEmail={tempPasswordModal.email}
        onClose={() =>
          setTempPasswordModal({
            isOpen: false,
            password: null,
            email: '',
          })
        }
      />
    </div>
  );
}
