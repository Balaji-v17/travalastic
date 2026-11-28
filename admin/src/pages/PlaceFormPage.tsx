import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import { validatePlaceForm, type PlaceFormValues } from '../lib/placeForm.ts';
import { diffPlace, type PlaceModel } from '../lib/diffPlace.ts';
import { getOsmLink } from '../lib/osmLink.ts';
import {
  FLAG_LABELS,
  buildOsmEmbedUrl,
  canPublishPlace,
  getPlaceBlockingFlags,
  hasCuratedOverlap,
} from '../lib/heritageReview.ts';
import { Modal } from '../components/Modal.tsx';

interface PlaceFormPageProps {
  mode: 'create' | 'edit';
  placeId?: string;
}

const INITIAL_FORM_VALUES: PlaceFormValues = {
  name: '',
  city: '',
  state: '',
  type: '',
  zone: '',
  latitude: '',
  longitude: '',
  googleRating: '',
  entranceFeeINR: '',
  timeNeededHours: '',
  bestTimeToVisit: '',
  significance: '',
};

export function PlaceFormPage({ mode, placeId }: PlaceFormPageProps) {
  const [originalPlace, setOriginalPlace] = useState<PlaceModel | null>(null);
  const [values, setValues] = useState<PlaceFormValues>(INITIAL_FORM_VALUES);
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

  // Restore / Publish / Reject / Skip-curated action state
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isSkippingCurated, setIsSkippingCurated] = useState<boolean>(false);
  const [isOverlapPublishModalOpen, setIsOverlapPublishModalOpen] = useState<boolean>(false);
  const [showMapPreview, setShowMapPreview] = useState<boolean>(false);

  // Unsaved changes leave confirmation dialog
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [pendingLeavePath, setPendingLeavePath] = useState<string | null>(null);

  // Load place data in edit mode
  const fetchPlace = useCallback(async () => {
    if (mode !== 'edit' || !placeId) return;
    setIsLoading(true);
    setServerError(null);

    try {
      const data = await apiFetch<PlaceModel>(`/admin/places/${placeId}`);
      setOriginalPlace(data);
      setValues({
        name: data.name || '',
        city: data.city || '',
        state: data.state || '',
        type: data.type || '',
        zone: data.zone || '',
        latitude: data.latitude !== null && data.latitude !== undefined ? String(data.latitude) : '',
        longitude: data.longitude !== null && data.longitude !== undefined ? String(data.longitude) : '',
        googleRating: data.googleRating !== null && data.googleRating !== undefined ? String(data.googleRating) : '',
        entranceFeeINR: data.entranceFeeINR !== null && data.entranceFeeINR !== undefined ? String(data.entranceFeeINR) : '',
        timeNeededHours: data.timeNeededHours !== null && data.timeNeededHours !== undefined ? String(data.timeNeededHours) : '',
        bestTimeToVisit: data.bestTimeToVisit || '',
        significance: data.significance || '',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to load place details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [mode, placeId]);

  useEffect(() => {
    fetchPlace();
  }, [fetchPlace]);

  // Compute diff against original (in edit mode)
  const diff = useMemo(() => {
    if (mode === 'create') return null;
    return diffPlace(originalPlace, values);
  }, [mode, originalPlace, values]);

  const hasUnsavedChanges = useMemo(() => {
    if (mode === 'create') {
      return (
        values.name.trim().length > 0 ||
        values.city.trim().length > 0 ||
        values.state.trim().length > 0 ||
        values.type.trim().length > 0 ||
        values.latitude.trim().length > 0 ||
        values.longitude.trim().length > 0
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
    setServerError(null);
  };

  // OpenStreetMap link preview
  const osmUrl = useMemo(() => {
    return getOsmLink(values.latitude, values.longitude);
  }, [values.latitude, values.longitude]);

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
    const validation = validatePlaceForm(values, mode);
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
        const payload = diffPlace(null, values);
        const created = await apiFetch<PlaceModel>('/admin/places', {
          method: 'POST',
          body: payload,
        });
        setSuccessMessage(`Place "${created.name}" created successfully.`);
        // Redirect to places list after short notice
        setTimeout(() => {
          window.location.hash = '#/places';
        }, 600);
      } else if (mode === 'edit' && placeId && diff) {
        const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}`, {
          method: 'PATCH',
          body: {
            ...diff,
            expectedVersion: originalPlace?.version,
            expectedUpdatedAt: originalPlace?.updatedAt,
          },
        });
        setOriginalPlace(updated);
        setSuccessMessage('Place updated successfully.');
        // Re-fetch record to ensure fresh server state
        await fetchPlace();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setServerError(err.message || 'This place was modified elsewhere. Please reload and try again.');
          return;
        }
        const msg = err.message || '';
        // Map field-specific server errors if message points to a known field
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('name')) {
          setFieldErrors({ name: msg });
        } else if (lowerMsg.includes('coordinate') || lowerMsg.includes('latitude') || lowerMsg.includes('longitude')) {
          setFieldErrors({ latitude: msg, longitude: msg });
        } else if (lowerMsg.includes('city')) {
          setFieldErrors({ city: msg });
        } else if (lowerMsg.includes('state')) {
          setFieldErrors({ state: msg });
        } else if (lowerMsg.includes('type')) {
          setFieldErrors({ type: msg });
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

  // Hide Place action
  const handleConfirmHide = async () => {
    if (!placeId) return;
    setIsHiding(true);
    setHideError(null);

    try {
      await apiFetch<PlaceModel>(`/admin/places/${placeId}/hide`, {
        method: 'POST',
        body: { reason: hideReason.trim() || undefined },
      });
      setIsHideModalOpen(false);
      setHideReason('');
      setSuccessMessage('Place has been hidden.');
      await fetchPlace();
    } catch (err) {
      if (err instanceof ApiError) {
        setHideError(getApiErrorMessage(err));
      } else {
        setHideError('Failed to hide place.');
      }
    } finally {
      setIsHiding(false);
    }
  };

  // Restore Place action
  const handleRestorePlace = async () => {
    if (!placeId) return;
    setIsRestoring(true);
    setServerError(null);

    try {
      await apiFetch<PlaceModel>(`/admin/places/${placeId}/restore`, {
        method: 'POST',
      });
      setSuccessMessage('Place has been restored and is now visible.');
      await fetchPlace();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to restore place.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Publish heritage / pending_review place action
  const handlePublishPlace = async (confirmOverlap: boolean = false) => {
    if (!placeId) return;
    if (!confirmOverlap && hasCuratedOverlap(originalPlace)) {
      setIsOverlapPublishModalOpen(true);
      return;
    }
    setIsPublishing(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}/publish`, {
        method: 'POST',
        body: {
          expectedVersion: originalPlace?.version,
          expectedUpdatedAt: originalPlace?.updatedAt,
          ...(confirmOverlap ? { confirmCuratedOverlap: true } : {}),
        },
      });
      setIsOverlapPublishModalOpen(false);
      setOriginalPlace(updated);
      setSuccessMessage('Place published and now visible in Explore & search.');
      await fetchPlace();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to publish place.');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Reject heritage / pending_review place action
  const handleRejectPlace = async () => {
    if (!placeId) return;
    setIsRejecting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}/reject`, {
        method: 'POST',
        body: {
          expectedVersion: originalPlace?.version,
          expectedUpdatedAt: originalPlace?.updatedAt,
        },
      });
      setOriginalPlace(updated);
      setSuccessMessage('Place marked as rejected (remains hidden).');
      await fetchPlace();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to reject place.');
      }
    } finally {
      setIsRejecting(false);
    }
  };

  // Skip heritage record that overlaps with an existing curated place
  const handleSkipCuratedPlace = async () => {
    if (!placeId) return;
    setIsSkippingCurated(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}/skip-curated`, {
        method: 'POST',
        body: {
          expectedVersion: originalPlace?.version,
          expectedUpdatedAt: originalPlace?.updatedAt,
        },
      });
      setOriginalPlace(updated);
      setSuccessMessage('Place skipped as already curated (remains hidden).');
      await fetchPlace();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(getApiErrorMessage(err));
      } else {
        setServerError('Failed to skip place as already curated.');
      }
    } finally {
      setIsSkippingCurated(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center space-y-3">
        <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span>Loading place details...</span>
      </div>
    );
  }

  const isHidden = originalPlace?.hidden === true;
  const isHeritage = originalPlace?.source === 'asi-soi-heritage';
  const blockingFlags = originalPlace ? getPlaceBlockingFlags(originalPlace) : [];
  const canPublish = originalPlace ? canPublishPlace(originalPlace) : false;
  const matchedCurated = originalPlace?.heritage?.matchedCuratedPlace || null;
  const parsedLat = values.latitude.trim() ? Number(values.latitude) : NaN;
  const parsedLng = values.longitude.trim() ? Number(values.longitude) : NaN;
  const osmEmbedUrl = buildOsmEmbedUrl(parsedLat, parsedLng);
  const isSaveDisabled = mode === 'edit' && (!diff || Object.keys(diff).length === 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNavigateAway('#/places')}
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to places
        </button>

        {mode === 'edit' && originalPlace && !isHidden && (
          <button
            type="button"
            onClick={() => {
              setHideReason('');
              setHideError(null);
              setIsHideModalOpen(true);
            }}
            className="inline-flex items-center px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors focus:outline-hidden"
          >
            Hide place
          </button>
        )}
      </div>

      {/* Heritage Review Banner */}
      {mode === 'edit' && originalPlace && (isHeritage || (originalPlace.reviewFlags?.length ?? 0) > 0) && (
        <div
          role="region"
          aria-label="Heritage review status"
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-900">
                {originalPlace.heritage?.protectedBy === 'ASI'
                  ? 'Protected monument — Archaeological Survey of India (ASI)'
                  : originalPlace.heritage?.protectedBy === 'SOI'
                    ? 'Protected monument — Survey of India (SOI)'
                    : 'Heritage review record'}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                {originalPlace.sourceId && <span>Source ID: {originalPlace.sourceId}</span>}
                {originalPlace.heritage?.location && <span>Location: {originalPlace.heritage.location}</span>}
                {originalPlace.heritage?.asiCircle && <span>Circle: {originalPlace.heritage.asiCircle}</span>}
                {originalPlace.heritage?.coordsApprox && <span>Coordinates approximate (bbox centroid)</span>}
              </div>
              {matchedCurated && (
                <div className="text-xs text-indigo-800 mt-1.5">
                  Possible overlap with curated place:{' '}
                  <a
                    href={`#/places/${matchedCurated.placeId}`}
                    className="font-semibold underline hover:text-indigo-950"
                  >
                    {matchedCurated.name}
                  </a>
                  {matchedCurated.city ? ` (${matchedCurated.city}${matchedCurated.state ? `, ${matchedCurated.state}` : ''})` : ''}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isHidden && originalPlace.hiddenReason !== 'rejected' && (
                <button
                  type="button"
                  disabled={isPublishing || !canPublish}
                  onClick={() => handlePublishPlace(false)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={!canPublish ? `Resolve blocking flags before publishing: ${blockingFlags.join(', ')}` : 'Publish to Explore & search'}
                >
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
              )}
              {(hasCuratedOverlap(originalPlace) || originalPlace.hiddenReason === 'pending_review') &&
                originalPlace.hiddenReason !== 'already_curated' && (
                  <button
                    type="button"
                    disabled={isSkippingCurated}
                    onClick={handleSkipCuratedPlace}
                    className="inline-flex items-center px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {isSkippingCurated ? 'Skipping...' : 'Skip - already curated'}
                  </button>
                )}
              {originalPlace.hiddenReason !== 'rejected' && (
                <button
                  type="button"
                  disabled={isRejecting}
                  onClick={handleRejectPlace}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {isRejecting ? 'Rejecting...' : 'Reject'}
                </button>
              )}
            </div>
          </div>

          {originalPlace.reviewFlags && originalPlace.reviewFlags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {originalPlace.reviewFlags.map((flag) => {
                const isBlocking = blockingFlags.includes(flag);
                return (
                  <span
                    key={flag}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isBlocking
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {FLAG_LABELS[flag] || flag}
                    {isBlocking ? ' (blocks publish)' : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hidden Status Banner */}
      {mode === 'edit' && isHidden && (
        <div
          role="region"
          aria-label="Place visibility notice"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="font-semibold flex items-center space-x-1.5 text-amber-900">
              <svg className="h-4 w-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>This place is currently hidden</span>
            </div>
            <p className="text-xs text-amber-800">
              Reason: {originalPlace?.hiddenReason || 'Hidden by admin'}
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={isRestoring}
              onClick={handleRestorePlace}
              className="inline-flex items-center px-3 py-1.5 border border-amber-400 rounded-lg text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              {isRestoring ? 'Restoring...' : 'Restore place'}
            </button>
          </div>
        </div>
      )}

      {/* AI Embedding Stale Banner */}
      {mode === 'edit' && originalPlace?.embeddingStale && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center space-x-2">
          <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
          </svg>
          <span>This place's AI search data will refresh later.</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'create' ? 'Add New Place' : `Edit ${originalPlace?.name || 'Place'}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'create'
            ? 'Add a verified destination to Travalastic catalog with accurate grounding coordinates.'
            : `Update details, coordinates, or visibility for ${originalPlace?.name || 'this location'}.`}
        </p>
      </div>

      {/* Status or error banners */}
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

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 space-y-6">
        {/* Core Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="sm:col-span-2">
            <label htmlFor="place-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Place Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="place-name"
              name="name"
              value={values.name}
              onChange={handleChange}
              maxLength={120}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.name ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="e.g. Amber Fort"
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* City */}
          <div>
            <label htmlFor="place-city" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="place-city"
              name="city"
              value={values.city}
              onChange={handleChange}
              maxLength={100}
              aria-describedby={fieldErrors.city ? 'city-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.city ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="e.g. Jaipur"
            />
            {fieldErrors.city && (
              <p id="city-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.city}
              </p>
            )}
          </div>

          {/* State */}
          <div>
            <label htmlFor="place-state" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              State <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="place-state"
              name="state"
              value={values.state}
              onChange={handleChange}
              maxLength={100}
              aria-describedby={fieldErrors.state ? 'state-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.state ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="e.g. Rajasthan"
            />
            {fieldErrors.state && (
              <p id="state-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.state}
              </p>
            )}
          </div>

          {/* Type */}
          <div>
            <label htmlFor="place-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="place-type"
              name="type"
              value={values.type}
              onChange={handleChange}
              maxLength={100}
              aria-describedby={fieldErrors.type ? 'type-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.type ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="e.g. Fort, Beach, Monument, Temple"
            />
            {fieldErrors.type && (
              <p id="type-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.type}
              </p>
            )}
          </div>

          {/* Zone (Optional) */}
          <div>
            <label htmlFor="place-zone" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Zone <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              id="place-zone"
              name="zone"
              value={values.zone || ''}
              onChange={handleChange}
              maxLength={100}
              aria-describedby={fieldErrors.zone ? 'zone-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.zone ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
              }`}
              placeholder="e.g. Northern, Western, Southern, Eastern"
            />
            {fieldErrors.zone && (
              <p id="zone-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.zone}
              </p>
            )}
          </div>
        </div>

        {/* Coordinates Section */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Grounding Coordinates</h2>
          <p className="text-xs text-slate-500 mb-4">
            Coordinates are verified real-world points used to calculate routes and map pins.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Latitude */}
            <div>
              <label htmlFor="place-lat" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Latitude <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="place-lat"
                name="latitude"
                value={values.latitude}
                onChange={handleChange}
                aria-describedby={fieldErrors.latitude ? 'lat-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.latitude ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="e.g. 26.9855 (-90 to 90)"
              />
              {fieldErrors.latitude && (
                <p id="lat-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.latitude}
                </p>
              )}
            </div>

            {/* Longitude */}
            <div>
              <label htmlFor="place-lon" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Longitude <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="place-lon"
                name="longitude"
                value={values.longitude}
                onChange={handleChange}
                aria-describedby={fieldErrors.longitude ? 'lon-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.longitude ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="e.g. 75.8513 (-180 to 180)"
              />
              {fieldErrors.longitude && (
                <p id="lon-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.longitude}
                </p>
              )}
            </div>
          </div>

          {/* OpenStreetMap External Link & Optional Preview */}
          <div className="mt-3 space-y-2">
            {osmUrl ? (
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-hidden underline"
                >
                  <span>Check this location on OpenStreetMap</span>
                  <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                {osmEmbedUrl && (
                  <button
                    type="button"
                    onClick={() => setShowMapPreview((prev) => !prev)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                  >
                    {showMapPreview ? 'Hide map preview' : 'Show map preview'}
                  </button>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Enter valid coordinates to preview location on OpenStreetMap
              </span>
            )}
            {showMapPreview && osmEmbedUrl && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <iframe
                  title={`OpenStreetMap preview for ${values.name || 'place'}`}
                  src={osmEmbedUrl}
                  className="w-full h-48 border-0"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tourism Attributes Section */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Tourism Attributes</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Google Rating */}
            <div>
              <label htmlFor="place-rating" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Google Rating <span className="text-slate-400 font-normal">(0 - 5)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                id="place-rating"
                name="googleRating"
                value={values.googleRating || ''}
                onChange={handleChange}
                aria-describedby={fieldErrors.googleRating ? 'rating-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.googleRating ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="Not listed"
              />
              {fieldErrors.googleRating && (
                <p id="rating-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.googleRating}
                </p>
              )}
            </div>

            {/* Entrance Fee INR */}
            <div>
              <label htmlFor="place-fee" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Entrance Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                id="place-fee"
                name="entranceFeeINR"
                value={values.entranceFeeINR ?? ''}
                onChange={handleChange}
                aria-describedby={fieldErrors.entranceFeeINR ? 'fee-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.entranceFeeINR ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="Not listed"
              />
              {fieldErrors.entranceFeeINR && (
                <p id="fee-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.entranceFeeINR}
                </p>
              )}
            </div>

            {/* Time Needed Hours */}
            <div>
              <label htmlFor="place-hours" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Time Needed (Hours)
              </label>
              <input
                type="number"
                min="0"
                max="48"
                step="0.5"
                id="place-hours"
                name="timeNeededHours"
                value={values.timeNeededHours || ''}
                onChange={handleChange}
                aria-describedby={fieldErrors.timeNeededHours ? 'hours-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.timeNeededHours ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="Not listed"
              />
              {fieldErrors.timeNeededHours && (
                <p id="hours-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.timeNeededHours}
                </p>
              )}
            </div>

            {/* Best Time To Visit */}
            <div className="sm:col-span-3">
              <label htmlFor="place-time" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Best Time to Visit <span className="text-slate-400 font-normal">(Optional, max 100 chars)</span>
              </label>
              <input
                type="text"
                id="place-time"
                name="bestTimeToVisit"
                value={values.bestTimeToVisit || ''}
                onChange={handleChange}
                maxLength={100}
                aria-describedby={fieldErrors.bestTimeToVisit ? 'time-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.bestTimeToVisit ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="e.g. October to March, Morning, Sunset"
              />
              {fieldErrors.bestTimeToVisit && (
                <p id="time-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.bestTimeToVisit}
                </p>
              )}
            </div>

            {/* Significance */}
            <div className="sm:col-span-3">
              <label htmlFor="place-significance" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Significance & Description <span className="text-slate-400 font-normal">(Optional, max 500 chars)</span>
              </label>
              <textarea
                id="place-significance"
                name="significance"
                rows={3}
                value={values.significance || ''}
                onChange={handleChange}
                maxLength={500}
                aria-describedby={fieldErrors.significance ? 'sig-error' : undefined}
                className={`block w-full px-3 py-2 text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  fieldErrors.significance ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-white'
                }`}
                placeholder="Key architectural, cultural, or historical highlights..."
              />
              {fieldErrors.significance && (
                <p id="sig-error" className="mt-1 text-xs text-red-600">
                  {fieldErrors.significance}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleNavigateAway('#/places')}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving || isSaveDisabled}
            className="inline-flex items-center px-5 py-2 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : mode === 'create' ? (
              'Create place'
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>

      {/* Hide Confirmation Modal */}
      <Modal
        isOpen={isHideModalOpen}
        onClose={() => setIsHideModalOpen(false)}
        title="Hide Tourist Place"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Hidden places no longer appear in Explore, search or new itineraries. Trips users already saved keep them.
          </p>

          <div>
            <label htmlFor="hide-reason-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason <span className="text-slate-400 font-normal">(Optional, max 200 chars)</span>
            </label>
            <textarea
              id="hide-reason-input"
              rows={3}
              maxLength={200}
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              placeholder="e.g. Closed for seasonal monsoon repairs, under restoration..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          {hideError && (
            <p className="text-xs text-red-600" role="alert">
              {hideError}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsHideModalOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isHiding}
              onClick={handleConfirmHide}
              className="px-3 py-1.5 border border-transparent rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {isHiding ? 'Hiding...' : 'Confirm hide'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Unsaved Changes"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            You have unsaved changes on this place. If you navigate away now, your edits will be discarded.
          </p>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Stay on page
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLeaveModalOpen(false);
                if (pendingLeavePath) {
                  window.location.hash = pendingLeavePath;
                }
              }}
              className="px-3 py-1.5 border border-transparent rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Discard and leave
            </button>
          </div>
        </div>
      </Modal>

      {/* Curated Overlap Publish Confirmation Modal */}
      <Modal
        isOpen={isOverlapPublishModalOpen}
        onClose={() => setIsOverlapPublishModalOpen(false)}
        title="Confirm Publishing Curated Overlap"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This heritage monument appears to overlap with existing curated place{' '}
            <strong className="text-slate-900">
              {matchedCurated?.name || 'an existing curated record'}
            </strong>
            {matchedCurated?.city ? ` (${matchedCurated.city})` : ''}. Publishing will keep both records visible publicly.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOverlapPublishModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPublishing}
              onClick={() => handlePublishPlace(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPublishing ? 'Publishing...' : 'Publish anyway'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
