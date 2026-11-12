import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import { Modal } from '../components/Modal.tsx';
import {
  normalizeEmail,
  validateEmail,
  validateReason,
  emailsMatch,
} from '../lib/supportForm.ts';
import { canDelete } from '../lib/deletionGate.ts';
import {
  isTokenExpired,
  getRemainingSeconds,
  formatRemainingTime,
} from '../lib/previewExpiry.ts';

export interface FoundUser {
  id: string;
  email: string;
  createdAt: string;
  status: string;
}

export interface DeletionPreviewItem {
  item: string;
  count?: number;
  reason?: string;
}

export interface DeletionPreviewResponse {
  willRemove: Array<{ item: string; count: number }>;
  willRetain: Array<{ item: string; reason: string }>;
  previewToken: string;
}

export interface DeletionSuccessResult {
  deleted: boolean;
  userId: string;
  deletedCounts: Record<string, number>;
}

export function SupportPage() {
  // Lookup state
  const [lookupEmail, setLookupEmail] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  // Deletion modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'preview' | 'confirm' | 'success'>('preview');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DeletionPreviewResponse | null>(null);
  const [previewReceivedAt, setPreviewReceivedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [isExpired, setIsExpired] = useState(false);

  // Confirmation form fields
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success summary
  const [deletionTime, setDeletionTime] = useState<string | null>(null);
  const [finalRecap, setFinalRecap] = useState<{
    willRemove: Array<{ item: string; count: number }>;
    willRetain: Array<{ item: string; reason: string }>;
  } | null>(null);

  // Clean state reset on unmount
  useEffect(() => {
    return () => {
      setLookupEmail('');
      setFoundUser(null);
      setPreviewData(null);
      setPreviewReceivedAt(null);
      setConfirmEmail('');
      setReason('');
    };
  }, []);

  // Live countdown timer for preview token expiry
  useEffect(() => {
    if (!isModalOpen || modalStep !== 'confirm' || !previewReceivedAt) {
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expired = isTokenExpired(previewReceivedAt, now);
      setIsExpired(expired);
      const remaining = getRemainingSeconds(previewReceivedAt, now);
      setRemainingSeconds(remaining);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [isModalOpen, modalStep, previewReceivedAt]);

  // Reset modal state
  const resetModalState = useCallback(() => {
    setIsModalOpen(false);
    setModalStep('preview');
    setIsPreviewLoading(false);
    setPreviewError(null);
    setPreviewData(null);
    setPreviewReceivedAt(null);
    setRemainingSeconds(300);
    setIsExpired(false);
    setConfirmEmail('');
    setReason('');
    setConfirmedCheckbox(false);
    setIsDeleting(false);
    setDeleteError(null);
    setDeletionTime(null);
    setFinalRecap(null);
  }, []);

  // Fetch deletion preview
  const fetchPreview = useCallback(async (userId: string) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await apiFetch<DeletionPreviewResponse>(
        `/admin/support/users/${userId}/deletion-preview`,
        { method: 'POST' }
      );
      setPreviewData(data);
      const receivedAt = Date.now();
      setPreviewReceivedAt(receivedAt);
      setRemainingSeconds(300);
      setIsExpired(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        setPreviewError('This account no longer exists.');
      } else {
        setPreviewError(getApiErrorMessage(err));
      }
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  // Open deletion modal and trigger preview
  const handleOpenDeletionModal = () => {
    if (!foundUser) return;
    setModalStep('preview');
    setConfirmEmail('');
    setReason('');
    setConfirmedCheckbox(false);
    setDeleteError(null);
    setIsModalOpen(true);
    fetchPreview(foundUser.id);
  };

  // Email Lookup handler
  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    setSearchError(null);
    setNoMatchFound(false);

    const validation = validateEmail(lookupEmail);
    if (!validation.isValid) {
      setInputError(validation.error || 'Please enter a valid email address.');
      return;
    }

    // Looking up a new email clears previous results and deletion state
    setFoundUser(null);
    resetModalState();
    setIsSearching(true);

    try {
      const user = await apiFetch<FoundUser>(
        `/admin/support/users?email=${encodeURIComponent(validation.normalized)}`,
        { method: 'GET' }
      );
      setFoundUser(user);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        setNoMatchFound(true);
      } else {
        setSearchError(getApiErrorMessage(err));
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Execute deletion
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser || !previewData?.previewToken) return;

    if (
      !canDelete({
        targetEmail: foundUser.email,
        confirmEmail,
        reason,
        confirmedCheckbox,
        isExpired,
        isPending: isDeleting,
        hasPreviewToken: Boolean(previewData.previewToken),
      })
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch<DeletionSuccessResult>(
        `/admin/support/users/${foundUser.id}/delete`,
        {
          method: 'POST',
          body: {
            confirmEmail: confirmEmail.trim(),
            reason: reason.trim(),
            previewToken: previewData.previewToken,
          },
        }
      );

      // Deletion succeeded
      setDeletionTime(new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
      setFinalRecap({
        willRemove: previewData.willRemove,
        willRetain: previewData.willRetain,
      });
      setModalStep('success');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setDeleteError('This account no longer exists.');
        } else if (err.status === 429) {
          setDeleteError('Too many deletions. Try again later.');
        } else if (/preview token/i.test(err.message)) {
          setIsExpired(true);
          setDeleteError('The preview expired. Start again.');
        } else if (/email does not match/i.test(err.message)) {
          setDeleteError('The email does not match.');
        } else {
          setDeleteError(getApiErrorMessage(err));
        }
      } else {
        setDeleteError(getApiErrorMessage(err));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Complete done flow: clear all lookup and modal state
  const handleDone = () => {
    resetModalState();
    setLookupEmail('');
    setFoundUser(null);
    setInputError(null);
    setSearchError(null);
    setNoMatchFound(false);
  };

  const reasonValidation = validateReason(reason);
  const emailMismatch =
    confirmEmail.trim().length > 0 &&
    foundUser &&
    !emailsMatch(foundUser.email, confirmEmail);

  const isDeleteButtonEnabled = canDelete({
    targetEmail: foundUser?.email,
    confirmEmail,
    reason,
    confirmedCheckbox,
    isExpired,
    isPending: isDeleting,
    hasPreviewToken: Boolean(previewData?.previewToken),
  });

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support</h1>
        <p className="text-sm text-slate-600 mt-1">
          Look up traveler accounts by exact email to view account status or assist with account deletion requests.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Find traveler account</h2>
        <p id="lookup-hint" className="text-xs text-slate-500 mb-4">
          Search by exact email address. Wildcards and partial matches are not supported.
        </p>

        <form onSubmit={handleLookupSubmit} className="space-y-4" noValidate>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="user-email-lookup" className="sr-only">
                Traveler email address
              </label>
              <input
                id="user-email-lookup"
                type="email"
                autoComplete="off"
                maxLength={254}
                value={lookupEmail}
                onChange={(e) => {
                  setLookupEmail(e.target.value);
                  if (inputError) setInputError(null);
                }}
                placeholder="traveler@example.com"
                aria-describedby="lookup-hint"
                aria-invalid={Boolean(inputError)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                disabled={isSearching}
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !lookupEmail.trim()}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {isSearching ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  <span>Searching...</span>
                </>
              ) : (
                'Look up'
              )}
            </button>
          </div>

          {inputError && (
            <p className="text-xs text-rose-600 font-medium" role="alert">
              {inputError}
            </p>
          )}
        </form>

        {/* Search status / alerts */}
        <div aria-live="polite" className="mt-4">
          {searchError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-start space-x-2">
              <svg
                className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{searchError}</span>
            </div>
          )}

          {noMatchFound && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm">
              <p className="font-semibold text-slate-900">No account with that exact email.</p>
              <p className="text-xs text-slate-500 mt-1">
                Partial matches and wildcards are not supported. Verify the spelling and try again.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Found Account Result Card */}
      {foundUser && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Account details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Found active traveler profile</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              {foundUser.status || 'Active'}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-xs font-medium text-slate-500">Email address</dt>
              <dd className="font-semibold text-slate-900 break-all mt-1">{foundUser.email}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-xs font-medium text-slate-500">Account ID</dt>
              <dd className="font-mono text-xs text-slate-700 mt-1 break-all">{foundUser.id}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <dt className="text-xs font-medium text-slate-500">Member since</dt>
              <dd className="text-slate-800 mt-1">
                {foundUser.createdAt
                  ? new Date(foundUser.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleOpenDeletionModal}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4 text-rose-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Delete this account...</span>
            </button>
          </div>
        </div>
      )}

      {/* Deletion Dialog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={resetModalState}
        title={
          modalStep === 'preview'
            ? 'Account Deletion Preview'
            : modalStep === 'confirm'
            ? 'Confirm Account Deletion'
            : 'Account Deleted'
        }
        titleId="support-modal-title"
        closeOnEsc={!isDeleting && modalStep !== 'success'}
        closeOnBackdrop={!isDeleting && modalStep !== 'success'}
        maxWidthClass="max-w-lg"
      >
        {/* STEP 1: PREVIEW */}
        {modalStep === 'preview' && (
          <div className="space-y-5">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-start space-x-2">
              <svg
                className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-semibold">Deleting is permanent and cannot be undone.</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Review the summary below to understand what will be permanently removed and what is legally retained.
                </p>
              </div>
            </div>

            {isPreviewLoading && (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 space-y-3">
                <svg
                  className="animate-spin h-6 w-6 text-slate-600"
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
                <span className="text-sm font-medium">Calculating deletion preview...</span>
              </div>
            )}

            {previewError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg space-y-3">
                <p>{previewError}</p>
                <div className="flex space-x-2">
                  {foundUser && (
                    <button
                      type="button"
                      onClick={() => fetchPreview(foundUser.id)}
                      className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 text-xs font-medium rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Retry preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetModalState}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {previewData && !isPreviewLoading && (
              <div className="space-y-4">
                {/* Will Remove */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Will be removed
                  </h3>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                    {previewData.willRemove.map((item, idx) => (
                      <li key={idx} className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{item.item}</span>
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-semibold rounded-full border border-rose-200">
                          {item.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Will Retain */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Will be kept
                  </h3>
                  <ul className="space-y-2">
                    {previewData.willRetain.map((item, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600"
                      >
                        <p className="font-semibold text-slate-800">{item.item}</p>
                        <p className="text-slate-500 mt-0.5">{item.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetModalState}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalStep('confirm');
                      setConfirmEmail('');
                      setReason('');
                      setConfirmedCheckbox(false);
                      setDeleteError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Continue to confirmation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CONFIRM */}
        {modalStep === 'confirm' && (
          <form onSubmit={handleDeleteSubmit} className="space-y-5" noValidate>
            {/* Account highlight callout */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 font-medium">Target account to permanently delete:</p>
              <p className="text-sm font-bold text-slate-900 break-all mt-0.5">{foundUser?.email}</p>
            </div>

            {/* Live Expiry Countdown */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Security authorization window:</span>
              {isExpired ? (
                <span className="font-semibold text-rose-600">Expired</span>
              ) : (
                <span className="font-medium text-slate-700">
                  Expires in{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {formatRemainingTime(remainingSeconds)}
                  </span>
                </span>
              )}
            </div>

            {isExpired && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg space-y-2">
                <p className="font-semibold">The preview expired. Start again.</p>
                <p>The 5-minute security window has elapsed. A fresh preview must be calculated before proceeding.</p>
                <button
                  type="button"
                  onClick={() => {
                    setModalStep('preview');
                    if (foundUser) fetchPreview(foundUser.id);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md transition-colors cursor-pointer"
                >
                  Start again
                </button>
              </div>
            )}

            {!isExpired && (
              <>
                {/* Field 1: Confirmation Email */}
                <div>
                  <label htmlFor="confirm-email-input" className="block text-xs font-medium text-slate-700 mb-1">
                    Type account email to confirm <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="confirm-email-input"
                    type="email"
                    autoComplete="off"
                    maxLength={254}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={foundUser?.email}
                    disabled={isDeleting}
                    aria-describedby="confirm-email-hint"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  {emailMismatch && (
                    <p id="confirm-email-hint" className="text-xs text-rose-600 mt-1 font-medium">
                      Email does not match target account.
                    </p>
                  )}
                </div>

                {/* Field 2: Reason */}
                <div>
                  <label htmlFor="deletion-reason-input" className="block text-xs font-medium text-slate-700 mb-1">
                    Reason for deletion <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="deletion-reason-input"
                    rows={3}
                    maxLength={200}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Traveler requested account deletion under GDPR Article 17 via support ticket #1234"
                    disabled={isDeleting}
                    aria-describedby="reason-hint"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  <div id="reason-hint" className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>Plain text only, 5 to 200 characters, no HTML tags.</span>
                    <span className="font-mono">{reason.length}/200</span>
                  </div>
                  {reason.trim().length > 0 && !reasonValidation.isValid && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{reasonValidation.error}</p>
                  )}
                </div>

                {/* Field 3: Checkbox */}
                <div className="pt-2">
                  <label
                    htmlFor="deletion-confirm-checkbox"
                    className="flex items-start space-x-2.5 text-xs text-slate-700 cursor-pointer select-none"
                  >
                    <input
                      id="deletion-confirm-checkbox"
                      type="checkbox"
                      checked={confirmedCheckbox}
                      onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                      disabled={isDeleting}
                      className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-slate-900">
                      I understand this cannot be undone
                    </span>
                  </label>
                </div>
              </>
            )}

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start space-x-2">
                <svg
                  className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{deleteError}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalStep('preview')}
                disabled={isDeleting}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                &larr; Back to preview
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={resetModalState}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!isDeleteButtonEnabled}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {isDeleting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                      <span>Deleting account...</span>
                    </>
                  ) : (
                    'Delete account'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS */}
        {modalStep === 'success' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Account deleted</h3>
              <p className="text-xs text-slate-500 mt-1">
                Completed at <span className="font-mono font-semibold text-slate-800">{deletionTime}</span>
              </p>
            </div>

            {finalRecap && (
              <div className="text-left space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Removed items
                  </h4>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50 text-xs">
                    {finalRecap.willRemove.map((item, idx) => (
                      <li key={idx} className="px-3 py-1.5 flex items-center justify-between">
                        <span className="text-slate-700">{item.item}</span>
                        <span className="font-semibold text-rose-600">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Retained items
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {finalRecap.willRetain.map((item, idx) => (
                      <li key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-md">
                        <span className="font-semibold text-slate-800">{item.item}: </span>
                        <span className="text-slate-500">{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleDone}
                className="w-full sm:w-auto px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
