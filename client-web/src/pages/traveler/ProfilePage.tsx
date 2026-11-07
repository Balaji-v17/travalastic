import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth, type User } from '../../store/AuthContext';
import { apiFetch, ApiError } from '../../lib/api';
import { SHOW_SAMPLE_PAGES } from '../../config/features';
import { getAvatarInitial } from '../../lib/pageStatus';

type ProfileTab = 'account' | 'travel-identity' | 'preferences' | 'security' | 'loyalty';

export default function ProfilePage() {
  const { journeys, journeysStatus } = useApp();
  const { user, logout, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('account');

  // Name edit state
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Sync name input if user changes
  useEffect(() => {
    if (user?.name !== undefined) {
      setNameInput(user.name);
    }
  }, [user?.name]);

  // Account deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape
  useEffect(() => {
    if (!isDeleteModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        handleCloseDeleteModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleteModalOpen, isDeleting]);

  // Trap focus or focus first input on modal open
  useEffect(() => {
    if (isDeleteModalOpen) {
      const emailInput = document.getElementById('delete-confirm-email');
      emailInput?.focus();
    }
  }, [isDeleteModalOpen]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingName(true);
    setNameError(null);
    setNameSuccess(null);

    const trimmedName = nameInput.trim();

    try {
      const res = await apiFetch<{ user: User; message: string }>('/auth/me', {
        method: 'PATCH',
        body: { name: trimmedName },
      });
      updateUser(res.user);
      setNameSuccess('Profile name updated successfully');
      setTimeout(() => setNameSuccess(null), 3000);
    } catch (err: any) {
      setNameError(err instanceof ApiError ? err.message : 'Failed to update profile name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setConfirmEmail('');
    setDeletePassword('');
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setConfirmEmail('');
    setDeletePassword('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || isDeleting) return;
    if (confirmEmail.trim().toLowerCase() !== (user?.email || '').toLowerCase()) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch<{ message: string }>('/auth/me', {
        method: 'DELETE',
        body: { password: deletePassword },
      });
      setIsDeleteModalOpen(false);
      logout();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setDeleteError('Incorrect password');
        } else if (err.status === 429) {
          setDeleteError('Too many attempts. Please try again later.');
        } else {
          setDeleteError(err.message || 'Failed to delete account. Please try again.');
        }
      } else {
        setDeleteError('Unable to connect to the server. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const memberSinceYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;
  const isDeleteEnabled =
    confirmEmail.trim().toLowerCase() === (user?.email || '').toLowerCase() &&
    deletePassword.length > 0 &&
    !isDeleting;

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8">

      {/* ── Profile Header ── */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar initial */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-inner ring-4 ring-white/10"
              style={{ backgroundColor: '#77736C' }}
            >
              {getAvatarInitial(user?.name, user?.email)}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-sans font-bold text-2xl text-white">
              {user?.name?.trim() || 'Traveler Account'}
            </h1>
            <p className="text-white/60 text-sm mt-1">{user?.email || '—'}</p>
            {memberSinceYear && !isNaN(memberSinceYear) && (
              <p className="text-xs text-white/40 mt-1.5 flex items-center gap-1.5">
                <span>Member since {memberSinceYear}</span>
              </p>
            )}
          </div>
        </div>

        {/* Real Stats Row */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/10">
          <div>
            <p className="text-2xl font-bold text-white">
              {journeysStatus === 'loading' ? '—' : journeys.length}
            </p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-0.5">Saved trips</p>
          </div>
          {SHOW_SAMPLE_PAGES && (
            <>
              <div>
                <p className="text-2xl font-bold text-white/40">3</p>
                <p className="text-xs text-white/30 uppercase tracking-wider mt-0.5">Countries (sample)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white/40">12,400</p>
                <p className="text-xs text-white/30 uppercase tracking-wider mt-0.5">Miles (sample)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white/40">Silver</p>
                <p className="text-xs text-white/30 uppercase tracking-wider mt-0.5">Tier (sample)</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation if SHOW_SAMPLE_PAGES is true */}
      {SHOW_SAMPLE_PAGES && (
        <div className="flex gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto">
          {[
            { key: 'account' as const, label: 'Account' },
            { key: 'travel-identity' as const, label: 'Travel Identity' },
            { key: 'preferences' as const, label: 'Preferences' },
            { key: 'security' as const, label: 'Security' },
            { key: 'loyalty' as const, label: 'Loyalty' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Account Details & Name Editing */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Personal Details</h2>
            <p className="text-xs text-slate-500 mb-6">
              Update your personal information associated with your account.
            </p>

            <form onSubmit={handleSaveName} className="space-y-5">
              <div>
                <label htmlFor="account-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Name
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full sm:max-w-md px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="account-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address
                </label>
                <input
                  id="account-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  disabled
                  className="w-full sm:max-w-md px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Email address is permanently linked to your account.
                </p>
              </div>

              {nameError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {nameError}
                </div>
              )}

              {nameSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                  {nameSuccess}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="px-6 py-2.5 rounded-lg bg-[#111111] hover:bg-[#252525] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isSavingName ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-red-600 mb-1">Danger Zone</h2>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Permanently delete your Travalastic account and all associated travel records. This action cannot be reversed.
            </p>

            <button
              onClick={handleOpenDeleteModal}
              type="button"
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {/* Sample Tabs (only visible when SHOW_SAMPLE_PAGES is true) */}
      {SHOW_SAMPLE_PAGES && activeTab !== 'account' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-6">
            <strong>Sample Feature:</strong> The {activeTab.replace('-', ' ')} settings are mock data and are not saved to the server.
          </div>
          <p className="text-sm text-slate-600">
            Previewing sample settings for {activeTab}. Enable real sync in future iterations.
          </p>
        </div>
      )}

      {/* ── Account Deletion Modal ── */}
      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) handleCloseDeleteModal();
          }}
        >
          <div
            ref={deleteModalRef}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up"
          >
            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-lg font-bold">
                  ⚠️
                </div>
                <h3 id="delete-account-title" className="text-lg font-bold text-slate-900">
                  Permanently Delete Account?
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                All your itineraries, chat logs, expenses, bookings, packing templates, disruptions, and account data will be permanently removed from our servers. This action cannot be undone.
              </p>

              <div className="space-y-4 mb-5">
                <div>
                  <label
                    htmlFor="delete-confirm-email"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    To confirm, type your account email (<strong className="text-slate-900">{user?.email}</strong>):
                  </label>
                  <input
                    id="delete-confirm-email"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={user?.email || 'your-email@example.com'}
                    disabled={isDeleting}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="delete-confirm-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Enter your account password:
                  </label>
                  <input
                    id="delete-confirm-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Password"
                    disabled={isDeleting}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {deleteError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!isDeleteEnabled}
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
