import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import { validateHotelForm, type HotelFormValues } from '../lib/hotelForm.ts';
import { diffHotel, type HotelModel } from '../lib/diffHotel.ts';
import { computePriceAge } from '../lib/priceAge.ts';
import { Modal } from '../components/Modal.tsx';

interface HotelFormPageProps {
  mode: 'create' | 'edit';
  hotelId?: string;
}

const INITIAL_HOTEL_FORM_VALUES: HotelFormValues = {
  name: '',
  destination: '',
  budgetTier: 'mid',
  priceRangeINR: '',
  rating: '',
};

export function HotelFormPage({ mode, hotelId }: HotelFormPageProps) {
  const [originalHotel, setOriginalHotel] = useState<HotelModel | null>(null);
  const [values, setValues] = useState<HotelFormValues>(INITIAL_HOTEL_FORM_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(mode === 'edit');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Hide modal state
  const [isHideModalOpen, setIsHideModalOpen] = useState<boolean>(false);
  const [hideReason, setHideReason] = useState<string>('');
  const [isHiding, setIsHiding] = useState<boolean>(false);
  const [hideError, setHideError] = useState<string | null>(null);

  // Restore action state
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Unsaved changes confirmation dialog
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [pendingLeavePath, setPendingLeavePath] = useState<string | null>(null);

  // Load hotel data in edit mode
  const fetchHotel = useCallback(async () => {
    if (mode !== 'edit' || !hotelId) return;
    setIsLoading(true);
    setServerError(null);

    try {
      const data = await apiFetch<HotelModel>(`/admin/hotels/${hotelId}`);
      setOriginalHotel(data);
      setValues({
        name: data.name || '',
        destination: data.destination || '',
        budgetTier: data.budgetTier || 'mid',
        priceRangeINR: data.priceRangeINR || '',
        rating: data.rating !== null && data.rating !== undefined ? String(data.rating) : '',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to load hotel details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [mode, hotelId]);

  useEffect(() => {
    fetchHotel();
  }, [fetchHotel]);

  // Compute diff against original (in edit mode)
  const diff = useMemo(() => {
    if (mode === 'create') return null;
    return diffHotel(originalHotel, values);
  }, [mode, originalHotel, values]);

  const hasUnsavedChanges = useMemo(() => {
    if (mode === 'create') {
      return (
        values.name.trim().length > 0 ||
        values.destination.trim().length > 0 ||
        values.priceRangeINR.trim().length > 0 ||
        values.rating.trim().length > 0
      );
    }
    return diff !== null && Object.keys(diff).length > 0;
  }, [mode, values, diff]);

  // Prompt before unload when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
    setServerError(null);
  };

  // Safe navigation with unsaved changes check
  const handleNavigateAway = (targetHash: string) => {
    if (hasUnsavedChanges) {
      setPendingLeavePath(targetHash);
      setIsLeaveModalOpen(true);
    } else {
      window.location.hash = targetHash;
    }
  };

  // Submit handler (Create or Patch)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    // Client-side validation
    const validation = validateHotelForm(values);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});

    // If edit mode and no changes made, save is a no-op
    if (mode === 'edit') {
      if (!diff || Object.keys(diff).length === 0) {
        return;
      }
    }

    setIsSaving(true);

    try {
      if (mode === 'create') {
        const payload = diffHotel(null, values);
        const created = await apiFetch<HotelModel>('/admin/hotels', {
          method: 'POST',
          body: payload,
        });
        setSuccessMessage(`Hotel "${created.name}" created successfully.`);
        setTimeout(() => {
          window.location.hash = '#/hotels';
        }, 600);
      } else if (mode === 'edit' && hotelId && diff) {
        const updated = await apiFetch<HotelModel>(`/admin/hotels/${hotelId}`, {
          method: 'PATCH',
          body: diff,
        });
        setOriginalHotel(updated);
        setSuccessMessage('Hotel updated successfully.');
        await fetchHotel();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.message || '';
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('name')) {
          setFieldErrors({ name: msg });
        } else if (lowerMsg.includes('destination') || lowerMsg.includes('city')) {
          setFieldErrors({ destination: msg });
        } else if (lowerMsg.includes('budget') || lowerMsg.includes('tier')) {
          setFieldErrors({ budgetTier: msg });
        } else if (lowerMsg.includes('price') || lowerMsg.includes('pricerangeinr')) {
          setFieldErrors({ priceRangeINR: msg });
        } else if (lowerMsg.includes('rating')) {
          setFieldErrors({ rating: msg });
        } else {
          setServerError(getApiErrorMessage(err));
        }
      } else {
        setServerError('An unexpected error occurred while saving.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Hide Hotel action
  const handleConfirmHide = async () => {
    if (!hotelId) return;
    setIsHiding(true);
    setHideError(null);

    try {
      await apiFetch<HotelModel>(`/admin/hotels/${hotelId}/hide`, {
        method: 'POST',
        body: { reason: hideReason.trim() || undefined },
      });
      setIsHideModalOpen(false);
      setHideReason('');
      setSuccessMessage('Hotel has been hidden.');
      await fetchHotel();
    } catch (err) {
      if (err instanceof ApiError) {
        setHideError(getApiErrorMessage(err));
      } else {
        setHideError('Failed to hide hotel.');
      }
    } finally {
      setIsHiding(false);
    }
  };

  // Restore Hotel action
  const handleRestore = async () => {
    if (!hotelId) return;
    setIsRestoring(true);
    setServerError(null);

    try {
      await apiFetch<HotelModel>(`/admin/hotels/${hotelId}/restore`, {
        method: 'POST',
      });
      setSuccessMessage('Hotel has been restored and is now visible.');
      await fetchHotel();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to restore hotel.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const isHidden = originalHotel?.hidden === true;
  const priceAge = computePriceAge(originalHotel?.priceReviewedAt);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-slate-500">
        <button
          type="button"
          onClick={() => handleNavigateAway('#/hotels')}
          className="hover:text-indigo-600 focus:outline-hidden underline"
        >
          Hotels
        </button>
        <span>/</span>
        <span className="text-slate-900 font-medium truncate">
          {mode === 'create' ? 'New Hotel' : originalHotel?.name || 'Edit Hotel'}
        </span>
      </nav>

      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'create' ? 'Add Curated Hotel' : `Edit: ${originalHotel?.name || 'Hotel'}`}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'create'
              ? 'Add a new verified accommodation to the curated catalog.'
              : 'Modify hotel tier, pricing, or visibility status. All updates are audited.'}
          </p>
        </div>

        {mode === 'edit' && originalHotel && (
          <div className="flex items-center space-x-3">
            {isHidden ? (
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleRestore}
                className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isRestoring ? 'Restoring...' : 'Restore Hotel'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHideReason('');
                  setHideError(null);
                  setIsHideModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-red-200 shadow-xs text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
                Hide Hotel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden Status Banner (if hidden) */}
      {mode === 'edit' && isHidden && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start space-x-3">
          <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-semibold">This hotel is currently hidden from travelers.</span>
            <p className="mt-0.5 text-xs text-amber-800">
              {originalHotel.hiddenReason
                ? `Reason: ${originalHotel.hiddenReason}`
                : 'No specific reason was recorded.'}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Hidden hotels do not appear in public searches or new itineraries. Saved trips retain their booked reference.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-2"
        >
          <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center space-x-2"
        >
          <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm">Loading hotel data...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200">
          {/* Main Info Section */}
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Hotel Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Hotel Name */}
              <div className="sm:col-span-2">
                <label htmlFor="field-name" className="block text-sm font-medium text-slate-700">
                  Hotel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="field-name"
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  maxLength={120}
                  className={`mt-1 block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.name ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                  }`}
                  placeholder="e.g. Taj Fort Aguada Resort & Spa"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.name}</p>
                )}
              </div>

              {/* Destination / City */}
              <div>
                <label htmlFor="field-destination" className="block text-sm font-medium text-slate-700">
                  Destination / City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="field-destination"
                  name="destination"
                  value={values.destination}
                  onChange={handleChange}
                  maxLength={60}
                  className={`mt-1 block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.destination ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                  }`}
                  placeholder="e.g. Goa, Jaipur, Munnar"
                />
                {fieldErrors.destination && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.destination}</p>
                )}
              </div>

              {/* Budget Tier */}
              <div>
                <label htmlFor="field-budgetTier" className="block text-sm font-medium text-slate-700">
                  Budget Tier <span className="text-red-500">*</span>
                </label>
                <select
                  id="field-budgetTier"
                  name="budgetTier"
                  value={values.budgetTier}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.budgetTier ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                  }`}
                >
                  <option value="budget">Budget</option>
                  <option value="mid">Mid-Range</option>
                  <option value="luxury">Luxury</option>
                </select>
                {fieldErrors.budgetTier && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.budgetTier}</p>
                )}
              </div>

              {/* Price Range INR */}
              <div>
                <label htmlFor="field-priceRangeINR" className="block text-sm font-medium text-slate-700">
                  Price Range (INR)
                </label>
                <input
                  type="text"
                  id="field-priceRangeINR"
                  name="priceRangeINR"
                  value={values.priceRangeINR}
                  onChange={handleChange}
                  maxLength={80}
                  className={`mt-1 block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.priceRangeINR ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                  }`}
                  placeholder="e.g. ₹8,000 - ₹14,000"
                />
                {/* Specific Helper text required by prompt */}
                <p className="mt-1.5 text-xs text-slate-500">
                  Prices here are indicative and not live. Changing a price updates &apos;Price reviewed&apos;.
                </p>
                {fieldErrors.priceRangeINR && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.priceRangeINR}</p>
                )}
              </div>

              {/* Rating */}
              <div>
                <label htmlFor="field-rating" className="block text-sm font-medium text-slate-700">
                  Curated Rating (0 - 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  id="field-rating"
                  name="rating"
                  value={values.rating}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                    fieldErrors.rating ? 'border-red-300 bg-red-50/50' : 'border-slate-300'
                  }`}
                  placeholder="e.g. 4.6"
                />
                {fieldErrors.rating && (
                  <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.rating}</p>
                )}
              </div>
            </div>
          </div>

          {/* Audit & Price Review Information (Edit mode only) */}
          {mode === 'edit' && originalHotel && (
            <div className="border-t border-slate-100 pt-6">
              <h2 className="text-base font-semibold text-slate-900 pb-3">
                Review & Audit Record
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <dt className="text-slate-500 font-medium">Price Reviewed</dt>
                  <dd className="mt-1 font-semibold text-slate-900 flex items-center gap-1.5">
                    {priceAge.isStale ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                        {priceAge.label}
                      </span>
                    ) : (
                      <span>{priceAge.label}</span>
                    )}
                  </dd>
                  {originalHotel.priceReviewedAt && (
                    <dd className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(originalHotel.priceReviewedAt)}
                    </dd>
                  )}
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Last Modified</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatDate(originalHotel.updatedAt || originalHotel.createdAt)}
                  </dd>
                  <dd className="text-[11px] text-slate-400 mt-0.5 truncate" title={originalHotel.updatedByEmail || ''}>
                    by {originalHotel.updatedByEmail || 'system / seed'}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Visibility Status</dt>
                  <dd className="mt-1">
                    {isHidden ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800">
                        Hidden
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        Visible
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => handleNavigateAway('#/hotels')}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 underline focus:outline-hidden"
            >
              Cancel
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={isSaving || (mode === 'edit' && (!diff || Object.keys(diff).length === 0))}
                className="inline-flex items-center px-5 py-2 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isSaving
                  ? 'Saving...'
                  : mode === 'create'
                  ? 'Create Hotel'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Hide Confirmation Modal */}
      <Modal
        isOpen={isHideModalOpen}
        onClose={() => setIsHideModalOpen(false)}
        title="Hide Hotel from Catalog"
        titleId="hide-hotel-modal-title"
      >
        <div className="space-y-4">
          {/* Exact impact text required by prompt */}
          <p className="text-sm text-slate-700">
            Hidden hotels no longer appear in hotel results or new itineraries. Trips and bookings users already saved keep them.
          </p>

          <div>
            <label htmlFor="hide-reason-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for hiding (Optional, max 200 characters)
            </label>
            <input
              type="text"
              id="hide-reason-input"
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value.slice(0, 200))}
              maxLength={200}
              placeholder="e.g. Under renovation, pricing inaccurate, discontinued partner"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {hideError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
              {hideError}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isHiding}
              onClick={() => setIsHideModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isHiding}
              onClick={handleConfirmHide}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors"
            >
              {isHiding ? 'Hiding...' : 'Confirm Hide'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unsaved Changes Confirmation Dialog */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Discard Unsaved Changes?"
        titleId="leave-hotel-modal-title"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            You have unsaved changes on this hotel. If you leave now, your changes will be discarded.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Stay on Page
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLeaveModalOpen(false);
                if (pendingLeavePath) {
                  window.location.hash = pendingLeavePath;
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

