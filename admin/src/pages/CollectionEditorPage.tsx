import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import { getStyleLabel, type ValidStyleKey } from '../lib/styleLabels.ts';
import {
  type PickItem,
  validatePicks,
  addPick,
  removePick,
  movePick,
} from '../lib/collectionEditor.ts';
import { diffPicks, type DiffPicksResult } from '../lib/diffPicks.ts';
import { Modal } from '../components/Modal.tsx';

// Third-party image host: images.pexels.com is the only external image origin permitted
// for displaying manual destination photo previews in this admin interface.

interface CollectionDetailResponse {
  key: string;
  picks: PickItem[];
  version: number;
  updatedAt: string;
  updatedByEmail: string | null;
}

interface PhotoPreviewResponse {
  photoUrl: string;
  photographerName: string;
  photographerUrl: string;
}

interface PhotoPreviewState {
  status: 'idle' | 'loading' | 'success' | 'not_found' | 'rate_limited' | 'error';
  photoUrl?: string;
  photographerName?: string;
  photographerUrl?: string;
  errorMessage?: string;
}

interface EditorPickItem extends PickItem {
  id: string; // stable client key for React keys and preview tracking
}

interface CollectionEditorPageProps {
  collectionKey: string;
}

export function CollectionEditorPage({ collectionKey }: CollectionEditorPageProps) {
  const collectionLabel = getStyleLabel(collectionKey);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Version and server snapshot
  const [serverVersion, setServerVersion] = useState<number>(1);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string>('');
  const [serverUpdatedByEmail, setServerUpdatedByEmail] = useState<string | null>(null);
  const [originalPicks, setOriginalPicks] = useState<PickItem[]>([]);

  // Current editable picks
  const [picks, setPicks] = useState<EditorPickItem[]>([]);

  // Stable ID generator
  const nextIdRef = useRef<number>(1);
  const createEditorPick = useCallback((item: PickItem): EditorPickItem => {
    return {
      name: item.name || '',
      imageQuery: item.imageQuery || '',
      id: `pick-${nextIdRef.current++}`,
    };
  }, []);

  // In-memory photo preview cache (persists for the component session)
  const previewCacheRef = useRef<Map<string, PhotoPreviewState>>(new Map());
  // Per-pick preview state keyed by pick.id
  const [previews, setPreviews] = useState<Record<string, PhotoPreviewState>>({});

  // Conflict modal state (HTTP 409)
  const [conflictModalOpen, setConflictModalOpen] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);

  // Unsaved changes leave confirmation dialog
  const [leaveModalOpen, setLeaveModalOpen] = useState<boolean>(false);
  const [pendingLeaveHash, setPendingLeaveHash] = useState<string | null>(null);

  // Fetch single collection
  const fetchCollection = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<CollectionDetailResponse>(`/admin/styles/${collectionKey}`);
      const rawPicks = data.picks || [];
      setOriginalPicks(rawPicks.map((p) => ({ name: p.name, imageQuery: p.imageQuery || '' })));
      setPicks(
        rawPicks.map((p) =>
          createEditorPick({ name: p.name, imageQuery: p.imageQuery || '' })
        )
      );
      setServerVersion(data.version);
      setServerUpdatedAt(data.updatedAt);
      setServerUpdatedByEmail(data.updatedByEmail || null);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(getApiErrorMessage(err));
      } else {
        setLoadError('Failed to load collection details. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [collectionKey, createEditorPick]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // Strip client IDs for pure comparison and submission
  const rawCurrentPicks: PickItem[] = useMemo(() => {
    return picks.map((p) => ({
      name: p.name,
      imageQuery: p.imageQuery || '',
    }));
  }, [picks]);

  // Validation as you type
  const validation = useMemo(() => {
    return validatePicks(rawCurrentPicks);
  }, [rawCurrentPicks]);

  // Diff against original version
  const diff: DiffPicksResult = useMemo(() => {
    return diffPicks(originalPicks, rawCurrentPicks);
  }, [originalPicks, rawCurrentPicks]);

  const hasUnsavedChanges = diff.hasChanges;

  // Window beforeunload prompt when unsaved changes exist
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

  // Intercept navigation back to list
  const handleNavigateAway = (targetHash: string) => {
    if (hasUnsavedChanges) {
      setPendingLeaveHash(targetHash);
      setLeaveModalOpen(true);
    } else {
      window.location.hash = targetHash;
    }
  };

  const handleConfirmLeave = () => {
    setLeaveModalOpen(false);
    if (pendingLeaveHash) {
      window.location.hash = pendingLeaveHash;
    }
  };

  // Modify individual pick field
  const handlePickChange = (index: number, field: 'name' | 'imageQuery', value: string) => {
    setSaveSuccessMessage(null);
    setPicks((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Move pick up
  const handleMoveUp = (index: number) => {
    setSaveSuccessMessage(null);
    setPicks((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const copy = [...prev];
      const item = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = item;
      return copy;
    });
  };

  // Move pick down
  const handleMoveDown = (index: number) => {
    setSaveSuccessMessage(null);
    setPicks((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev;
      const copy = [...prev];
      const item = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = item;
      return copy;
    });
  };

  // Remove pick
  const handleRemove = (index: number) => {
    setSaveSuccessMessage(null);
    setPicks((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add pick
  const handleAddPick = () => {
    if (picks.length >= 12) return;
    setSaveSuccessMessage(null);
    const newPick = createEditorPick({ name: '', imageQuery: '' });
    setPicks((prev) => [...prev, newPick]);
  };

  // Preview photo handler (per pick, on manual button click)
  const handlePreviewPhoto = async (pick: EditorPickItem) => {
    const rawSearch = (pick.imageQuery || '').trim();
    const rawName = (pick.name || '').trim();
    const query = rawSearch || rawName;

    if (!query) {
      setPreviews((prev) => ({
        ...prev,
        [pick.id]: {
          status: 'error',
          errorMessage: 'Enter a destination name or search term first.',
        },
      }));
      return;
    }

    // Check memory cache
    const cached = previewCacheRef.current.get(query);
    if (cached) {
      setPreviews((prev) => ({ ...prev, [pick.id]: cached }));
      return;
    }

    // Set loading
    setPreviews((prev) => ({
      ...prev,
      [pick.id]: { status: 'loading' },
    }));

    try {
      const data = await apiFetch<PhotoPreviewResponse>(
        `/admin/styles/preview-photo?query=${encodeURIComponent(query)}`
      );

      const successState: PhotoPreviewState = {
        status: 'success',
        photoUrl: data.photoUrl,
        photographerName: data.photographerName,
        photographerUrl: data.photographerUrl,
      };

      previewCacheRef.current.set(query, successState);
      setPreviews((prev) => ({ ...prev, [pick.id]: successState }));
    } catch (err) {
      let state: PhotoPreviewState;
      if (err instanceof ApiError) {
        if (err.status === 404) {
          state = {
            status: 'not_found',
            errorMessage: 'No photo found for this search',
          };
          previewCacheRef.current.set(query, state);
        } else if (err.status === 429) {
          state = {
            status: 'rate_limited',
            errorMessage: 'Too many previews. Wait a minute and try again.',
          };
        } else {
          state = {
            status: 'error',
            errorMessage: getApiErrorMessage(err),
          };
        }
      } else {
        state = {
          status: 'error',
          errorMessage: 'Failed to preview photo. Check connection.',
        };
      }
      setPreviews((prev) => ({ ...prev, [pick.id]: state }));
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!validation.isValid || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    setSaveSuccessMessage(null);

    const payload = {
      picks: rawCurrentPicks.map((p) => ({
        name: p.name.trim(),
        ...(p.imageQuery?.trim() ? { imageQuery: p.imageQuery.trim() } : {}),
      })),
      expectedVersion: serverVersion,
    };

    try {
      const updated = await apiFetch<CollectionDetailResponse>(
        `/admin/styles/${collectionKey}`,
        {
          method: 'PUT',
          body: payload,
        }
      );

      // Re-fetch to confirm latest state
      const reloadedPicks = updated.picks || [];
      setOriginalPicks(reloadedPicks.map((p) => ({ name: p.name, imageQuery: p.imageQuery || '' })));
      setPicks(
        reloadedPicks.map((p) =>
          createEditorPick({ name: p.name, imageQuery: p.imageQuery || '' })
        )
      );
      setServerVersion(updated.version);
      setServerUpdatedAt(updated.updatedAt);
      setServerUpdatedByEmail(updated.updatedByEmail || null);

      setSaveSuccessMessage('Saved. The site shows this within about a minute.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictModalOpen(true);
      } else {
        alert(getApiErrorMessage(err));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Reload after 409 conflict
  const handleReloadConflict = async () => {
    setIsReloading(true);
    try {
      await fetchCollection();
      setConflictModalOpen(false);
    } finally {
      setIsReloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 text-center my-8">
        <div className="inline-flex items-center space-x-2 text-slate-500 text-sm font-medium">
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
          <span>Loading collection editor...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 my-6">
        <div
          role="alert"
          className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={fetchCollection}
            className="ml-4 font-semibold text-red-700 hover:text-red-900 underline text-xs"
          >
            Retry
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleNavigateAway('#/collections')}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center space-x-1"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to Collections</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={() => handleNavigateAway('#/collections')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1 mb-2"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to Collections</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {collectionLabel} Picks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Internal key: <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{collectionKey}</code>
            {serverUpdatedAt && (
              <span className="ml-3 text-slate-400">
                &bull; Version {serverVersion} &bull; Last updated {new Date(serverUpdatedAt).toLocaleDateString()}
                {serverUpdatedByEmail && ` by ${serverUpdatedByEmail}`}
              </span>
            )}
          </p>
        </div>

        {/* Changes summary and Save button in header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || !validation.isValid || isSaving}
            className={`inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white transition-colors ${
              hasUnsavedChanges && validation.isValid && !isSaving
                ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <span className="inline-flex items-center space-x-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
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
                <span>Saving...</span>
              </span>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {saveSuccessMessage && (
        <div
          role="status"
          className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="h-5 w-5 text-green-500 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">{saveSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMessage(null)}
            className="text-green-600 hover:text-green-800 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* General validation error (e.g. over 12 picks) */}
      {validation.generalError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium"
        >
          {validation.generalError}
        </div>
      )}

      {/* Changes preview bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between text-slate-700">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800">Changes:</span>
          <span className={hasUnsavedChanges ? 'text-indigo-900 font-medium' : 'text-slate-500 italic'}>
            {diff.summary}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {picks.length} of 12 picks
        </span>
      </div>

      {/* Empty collection message */}
      {picks.length === 0 && (
        <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl space-y-3">
          <p className="text-sm font-medium text-slate-600">
            The page will show &apos;More coming soon.&apos;
          </p>
          <button
            type="button"
            onClick={handleAddPick}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 shadow-xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            + Add pick
          </button>
        </div>
      )}

      {/* Ordered list of picks */}
      {picks.length > 0 && (
        <div className="space-y-4" role="list" aria-label={`${collectionLabel} picks`}>
          {picks.map((pick, idx) => {
            const errs = validation.fieldErrors[idx] || {};
            const isDuplicate = validation.duplicateIndices.has(idx);
            const preview = previews[pick.id] || { status: 'idle' };

            return (
              <div
                key={pick.id}
                role="listitem"
                className={`bg-white rounded-xl shadow-xs border p-4 transition-colors space-y-3 ${
                  isDuplicate || errs.name || errs.imageQuery
                    ? 'border-red-300 bg-red-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Position {idx + 1}
                    </span>
                  </div>

                  {/* Actions: Move Up, Move Down, Remove */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      aria-label={`Move ${pick.name || `item ${idx + 1}`} up`}
                      className={`p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors ${
                        idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === picks.length - 1}
                      aria-label={`Move ${pick.name || `item ${idx + 1}`} down`}
                      className={`p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors ${
                        idx === picks.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      aria-label={`Remove ${pick.name || `item ${idx + 1}`}`}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer transition-colors"
                      title="Remove pick"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Name input */}
                  <div className="md:col-span-5 space-y-1">
                    <label htmlFor={`pick-name-${pick.id}`} className="block text-xs font-medium text-slate-700">
                      Destination name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={`pick-name-${pick.id}`}
                      type="text"
                      value={pick.name}
                      onChange={(e) => handlePickChange(idx, 'name', e.target.value)}
                      placeholder="e.g. Udaipur"
                      maxLength={80}
                      className={`block w-full px-3 py-2 text-sm rounded-lg border focus:ring-1 focus:outline-hidden ${
                        errs.name
                          ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
                          : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                    />
                    {errs.name && (
                      <p className="text-xs text-red-600 font-medium">{errs.name}</p>
                    )}
                  </div>

                  {/* Search query input */}
                  <div className="md:col-span-5 space-y-1">
                    <label htmlFor={`pick-query-${pick.id}`} className="block text-xs font-medium text-slate-700">
                      Photo search term <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id={`pick-query-${pick.id}`}
                      type="text"
                      value={pick.imageQuery}
                      onChange={(e) => handlePickChange(idx, 'imageQuery', e.target.value)}
                      placeholder="e.g. Lake Pichola Udaipur"
                      maxLength={100}
                      className={`block w-full px-3 py-2 text-sm rounded-lg border focus:ring-1 focus:outline-hidden ${
                        errs.imageQuery
                          ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
                          : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                    />
                    {errs.imageQuery && (
                      <p className="text-xs text-red-600 font-medium">{errs.imageQuery}</p>
                    )}
                  </div>

                  {/* Preview photo button */}
                  <div className="md:col-span-2 pt-5">
                    <button
                      type="button"
                      onClick={() => handlePreviewPhoto(pick)}
                      disabled={preview.status === 'loading'}
                      className="w-full inline-flex items-center justify-center px-3 py-2 border border-slate-300 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {preview.status === 'loading' ? (
                        <span className="inline-flex items-center space-x-1">
                          <svg className="animate-spin h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Loading...</span>
                        </span>
                      ) : (
                        'Preview photo'
                      )}
                    </button>
                  </div>
                </div>

                {/* Helper text */}
                <p className="text-xs text-slate-500 italic">
                  If a photo doesn&apos;t match the place, use a more specific search, for example &apos;Kabini wildlife forest Karnataka&apos;.
                </p>

                {/* Photo preview container */}
                {preview.status !== 'idle' && (
                  <div className="pt-2 border-t border-slate-100">
                    {preview.status === 'success' && preview.photoUrl && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <img
                          src={preview.photoUrl}
                          alt={pick.name ? `Preview for ${pick.name}` : 'Photo preview'}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full sm:w-[160px] h-[100px] object-cover rounded shadow-xs"
                        />
                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="font-medium text-slate-800">
                            Photo preview
                          </p>
                          <p>
                            Photo:{' '}
                            {preview.photographerUrl ? (
                              <a
                                href={preview.photographerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-indigo-600 hover:underline"
                              >
                                {preview.photographerName || 'Photographer'}
                              </a>
                            ) : (
                              <span className="font-semibold text-slate-800">
                                {preview.photographerName || 'Photographer'}
                              </span>
                            )}{' '}
                            /{' '}
                            <a
                              href="https://www.pexels.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-indigo-600 hover:underline"
                            >
                              Pexels
                            </a>
                          </p>
                        </div>
                      </div>
                    )}

                    {preview.status === 'not_found' && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        {preview.errorMessage || 'No photo found for this search'}
                      </div>
                    )}

                    {preview.status === 'rate_limited' && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        {preview.errorMessage || 'Too many previews. Wait a minute and try again.'}
                      </div>
                    )}

                    {preview.status === 'error' && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                        {preview.errorMessage || 'Failed to load preview.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add pick button and counter at bottom */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddPick}
              disabled={picks.length >= 12}
              className={`inline-flex items-center px-4 py-2 border border-slate-300 shadow-xs text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors ${
                picks.length >= 12
                  ? 'opacity-40 cursor-not-allowed bg-slate-100'
                  : 'cursor-pointer'
              }`}
            >
              + Add pick
            </button>
            <span className="text-xs font-medium text-slate-500">
              {picks.length} of 12 picks
            </span>
          </div>
        </div>
      )}

      {/* 409 Conflict Modal */}
      <Modal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Collection Version Conflict"
        titleId="conflict-modal-title"
        closeOnEsc={false}
        closeOnBackdrop={false}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This collection changed while you were editing. Reload to see the latest version.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
            Warning: Reloading will discard your current unsaved modifications.
          </p>
          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={handleReloadConflict}
              disabled={isReloading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              {isReloading ? 'Reloading...' : 'Reload latest version'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Leave with Unsaved Changes Modal */}
      <Modal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Unsaved changes"
        titleId="leave-modal-title"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            You have unsaved changes that will be lost if you leave this page. Are you sure you want to discard them?
          </p>
          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setLeaveModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Stay on page
            </button>
            <button
              type="button"
              onClick={handleConfirmLeave}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              Discard changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

