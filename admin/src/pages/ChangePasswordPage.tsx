import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, ApiError } from '../lib/api.ts';
import { validatePasswordRules } from '../lib/passwordRules.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';

interface ChangePasswordResponse {
  ok: boolean;
  token: string;
}

export function ChangePasswordPage() {
  const { admin, completePasswordChange, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fast client-side validation for immediate feedback
  const validation = validatePasswordRules(
    currentPassword,
    newPassword,
    confirmPassword,
    admin?.email
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all password fields.');
      return;
    }

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || 'Please fix the password requirements.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiFetch<ChangePasswordResponse>('/admin/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword,
          newPassword,
        },
      });

      // Clear input fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      completePasswordChange(data.token);
    } catch (err: unknown) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Change your password
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {admin?.mustChangePassword
              ? 'A password change is required before you can access the admin console.'
              : 'Update your administrative account password.'}
          </p>
        </div>

        {errorMessage && (
          <div
            className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
            aria-live="polite"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Current Password */}
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Current password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
              >
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
              >
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 text-slate-600">
            <span className="font-semibold text-slate-700 block mb-1">
              Password requirements:
            </span>
            <div className="flex items-center space-x-2">
              <span className={newPassword.length >= 12 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {newPassword.length >= 12 ? '✓' : '•'}
              </span>
              <span>At least 12 characters long</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={newPassword && currentPassword && newPassword !== currentPassword ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {newPassword && currentPassword && newPassword !== currentPassword ? '✓' : '•'}
              </span>
              <span>Must differ from your current password</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={newPassword && admin?.email && !newPassword.toLowerCase().includes(admin.email.split('@')[0].toLowerCase()) ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {newPassword && admin?.email && !newPassword.toLowerCase().includes(admin.email.split('@')[0].toLowerCase()) ? '✓' : '•'}
              </span>
              <span>Cannot contain parts of your email address</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={newPassword && confirmPassword && newPassword === confirmPassword ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '•'}
              </span>
              <span>Confirmation must match</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Cancel and sign out
          </button>
        </div>
      </div>
    </div>
  );
}

