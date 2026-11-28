import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import type { PlaceModel } from '../lib/diffPlace.ts';
import { getOsmLink } from '../lib/osmLink.ts';
import {
  DEFAULT_HERITAGE_FILTERS,
  FLAG_LABELS,
  MAX_BULK_HERITAGE_SELECTION,
  buildOsmEmbedUrl,
  canPublishPlace,
  getPlaceBlockingFlags,
  hasCuratedOverlap,
  toggleBulkSelection,
  type HeritageFilterState,
} from '../lib/heritageReview.ts';
import { Modal } from '../components/Modal.tsx';

interface HeritagePlacesResponse {
  places: PlaceModel[];
  nextCursor: string | null;
  nextOffset: number | null;
}

interface BulkActionResponse {
  action: 'publish' | 'reject' | 'skip_curated';
  succeededCount: number;
  succeeded: string[];
  blocked: { id: string; blockingFlags: string[] }[];
  conflicts: string[];
  notFound: string[];
}

interface QuickEditForm {
  name: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  significance: string;
}

function getPlaceId(place: PlaceModel): string {
  return place.id || place._id || '';
}

export function HeritageReviewPage() {
  const [filters, setFilters] = useState<HeritageFilterState>(DEFAULT_HERITAGE_FILTERS);
  const [searchInput, setSearchInput] = useState<string>('');
  const [stateInput, setStateInput] = useState<string>('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const stateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [places, setPlaces] = useState<PlaceModel[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null);
  const [mapPreviewPlace, setMapPreviewPlace] = useState<PlaceModel | null>(null);
  const [overlapConfirmPlace, setOverlapConfirmPlace] = useState<PlaceModel | null>(null);

  const [editingPlace, setEditingPlace] = useState<PlaceModel | null>(null);
  const [editForm, setEditForm] = useState<QuickEditForm>({
    name: '',
    city: '',
    state: '',
    latitude: '',
    longitude: '',
    significance: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [bulkConfirmAction, setBulkConfirmAction] = useState<'publish' | 'reject' | 'skip_curated' | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState<boolean>(false);

  const buildQueryParams = useCallback(
    (activeFilters: HeritageFilterState, offset: number): URLSearchParams => {
      const params = new URLSearchParams();
      params.set('source', 'asi-soi-heritage');
      params.set('sort', 'state_name');
      params.set('limit', '25');
      params.set('offset', String(offset));

      if (activeFilters.q.trim()) {
        params.set('q', activeFilters.q.trim().slice(0, 60));
      }
      if (activeFilters.state.trim()) {
        params.set('state', activeFilters.state.trim());
      }
      if (activeFilters.hiddenReason === 'published') {
        params.set('hidden', 'false');
        params.set('hiddenReason', 'none');
      } else if (activeFilters.hiddenReason && activeFilters.hiddenReason !== 'all') {
        params.set('hiddenReason', activeFilters.hiddenReason);
      }
      if (activeFilters.flag && activeFilters.flag !== 'all') {
        params.set('flag', activeFilters.flag);
      }
      if (activeFilters.protectedBy && activeFilters.protectedBy !== 'all') {
        params.set('protectedBy', activeFilters.protectedBy);
      }

      return params;
    },
    []
  );

  const fetchHeritagePlaces = useCallback(
    async (activeFilters: HeritageFilterState) => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = buildQueryParams(activeFilters, 0).toString();
        const data = await apiFetch<HeritagePlacesResponse>(`/admin/places?${qs}`);
        setPlaces(data.places || []);
        setNextOffset(typeof data.nextOffset === 'number' ? data.nextOffset : null);
        setSelectedIds([]);
        setSelectionWarning(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(getApiErrorMessage(err));
        } else {
          setError('Failed to load heritage monuments.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryParams]
  );

  useEffect(() => {
    fetchHeritagePlaces(filters);
  }, [filters, fetchHeritagePlaces]);

  const handleLoadMore = async () => {
    if (nextOffset === null || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const qs = buildQueryParams(filters, nextOffset).toString();
      const data = await apiFetch<HeritagePlacesResponse>(`/admin/places?${qs}`);
      setPlaces((prev) => [...prev, ...(data.places || [])]);
      setNextOffset(typeof data.nextOffset === 'number' ? data.nextOffset : null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError('Failed to load more heritage monuments.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 60);
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: val }));
    }, 300);
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStateInput(val);
    if (stateDebounceRef.current) clearTimeout(stateDebounceRef.current);
    stateDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, state: val }));
    }, 300);
  };

  const handleToggleSelect = (id: string) => {
    if (!id) return;
    const res = toggleBulkSelection(selectedIds, id, MAX_BULK_HERITAGE_SELECTION);
    setSelectedIds(res.ids);
    if (res.capped) {
      setSelectionWarning(`Bulk actions are capped at ${MAX_BULK_HERITAGE_SELECTION} places at a time.`);
    } else {
      setSelectionWarning(null);
    }
  };

  const handleToggleSelectVisible = () => {
    const visibleIds = places.map(getPlaceId).filter(Boolean);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      setSelectionWarning(null);
      return;
    }

    const merged = Array.from(new Set([...selectedIds, ...visibleIds]));
    if (merged.length > MAX_BULK_HERITAGE_SELECTION) {
      setSelectedIds(merged.slice(0, MAX_BULK_HERITAGE_SELECTION));
      setSelectionWarning(`Selected the first ${MAX_BULK_HERITAGE_SELECTION} places (bulk cap reached).`);
    } else {
      setSelectedIds(merged);
      setSelectionWarning(null);
    }
  };

  const openQuickEdit = (place: PlaceModel) => {
    setEditingPlace(place);
    setEditError(null);
    setEditForm({
      name: place.name || '',
      city: place.city || '',
      state: place.state || '',
      latitude: place.latitude !== null && place.latitude !== undefined ? String(place.latitude) : '',
      longitude: place.longitude !== null && place.longitude !== undefined ? String(place.longitude) : '',
      significance: place.significance || '',
    });
  };

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace) return;
    const placeId = getPlaceId(editingPlace);
    if (!placeId) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        city: editForm.city.trim(),
        state: editForm.state.trim() || null,
        significance: editForm.significance.trim() || null,
        expectedVersion: editingPlace.version,
        expectedUpdatedAt: editingPlace.updatedAt,
      };

      const latTrim = editForm.latitude.trim();
      const lngTrim = editForm.longitude.trim();
      if (latTrim || lngTrim) {
        payload.latitude = Number(latTrim);
        payload.longitude = Number(lngTrim);
      }

      const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}`, {
        method: 'PATCH',
        body: payload,
      });

      setPlaces((prev) => prev.map((p) => (getPlaceId(p) === placeId ? updated : p)));
      setEditingPlace(null);
      setNotice(`Saved changes to "${updated.name}".`);
    } catch (err) {
      if (err instanceof ApiError) {
        setEditError(getApiErrorMessage(err));
      } else {
        setEditError('Failed to save changes.');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSingleAction = async (
    place: PlaceModel,
    action: 'publish' | 'reject' | 'skip-curated',
    { confirmOverlap = false }: { confirmOverlap?: boolean } = {}
  ) => {
    const placeId = getPlaceId(place);
    if (!placeId) return;

    if (action === 'publish' && !confirmOverlap && hasCuratedOverlap(place)) {
      setOverlapConfirmPlace(place);
      return;
    }

    setBusyPlaceId(placeId);
    setError(null);
    setNotice(null);

    try {
      const updated = await apiFetch<PlaceModel>(`/admin/places/${placeId}/${action}`, {
        method: 'POST',
        body: {
          expectedVersion: place.version,
          expectedUpdatedAt: place.updatedAt,
          ...(action === 'publish' && confirmOverlap ? { confirmCuratedOverlap: true } : {}),
        },
      });
      setOverlapConfirmPlace(null);
      setNotice(
        action === 'publish'
          ? `Published "${updated.name}" to public Explore & search.`
          : action === 'skip-curated'
            ? `Skipped "${updated.name}" as already curated (remains hidden).`
            : `Rejected "${updated.name}" (remains hidden).`
      );
      await fetchHeritagePlaces(filters);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError(`Failed to ${action} place.`);
      }
    } finally {
      setBusyPlaceId(null);
    }
  };

  const handleConfirmBulkAction = async () => {
    if (!bulkConfirmAction || selectedIds.length === 0) return;
    setIsBulkRunning(true);
    setError(null);
    setNotice(null);

    try {
      const versions: Record<string, number> = {};
      for (const p of places) {
        const id = getPlaceId(p);
        if (id && selectedIds.includes(id) && typeof p.version === 'number') {
          versions[id] = p.version;
        }
      }

      const result = await apiFetch<BulkActionResponse>('/admin/places/bulk-action', {
        method: 'POST',
        body: {
          action: bulkConfirmAction,
          ids: selectedIds,
          versions,
        },
      });

      const details: string[] = [];
      if (result.blocked.length > 0) {
        details.push(`${result.blocked.length} blocked or requiring overlap confirmation`);
      }
      if (result.conflicts.length > 0) {
        details.push(`${result.conflicts.length} modified elsewhere (conflict)`);
      }
      const suffix = details.length > 0 ? ` (${details.join('; ')})` : '';
      const verb =
        bulkConfirmAction === 'publish'
          ? 'Published'
          : bulkConfirmAction === 'skip_curated'
            ? 'Skipped (already curated)'
            : 'Rejected';
      setNotice(`${verb} ${result.succeededCount} monument(s)${suffix}.`);
      setBulkConfirmAction(null);
      setSelectedIds([]);
      await fetchHeritagePlaces(filters);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError(`Bulk ${bulkConfirmAction} failed.`);
      }
      setBulkConfirmAction(null);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const mapPreviewUrl = mapPreviewPlace
    ? buildOsmEmbedUrl(mapPreviewPlace.latitude, mapPreviewPlace.longitude)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Heritage Review Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review ASI and Survey of India monuments before publishing them to Explore, search, and itineraries.
          </p>
        </div>
        <a
          href="#/places?source=asi-soi-heritage"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
        >
          View all places
        </a>
      </div>

      {/* Provenance & Approximate Coordinates Note */}
      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start space-x-2">
        <svg className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
        </svg>
        <span>
          Imported records remain hidden until published. Coordinates are approximate bounding-box centroids; verify names, states, and pins before publishing. Places with unresolved blocking flags cannot be published.
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label htmlFor="heritage-search" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search name, district, or location
            </label>
            <input
              id="heritage-search"
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              maxLength={60}
              placeholder='e.g. Hampi, Konark, Taj...'
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="heritage-state" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              State
            </label>
            <input
              id="heritage-state"
              type="text"
              value={stateInput}
              onChange={handleStateChange}
              placeholder="e.g. Karnataka"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="heritage-status" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              id="heritage-status"
              value={filters.hiddenReason}
              onChange={(e) => setFilters((prev) => ({ ...prev, hiddenReason: e.target.value }))}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            >
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="already_curated">Already curated</option>
              <option value="duplicate">Merged duplicates</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="heritage-flag" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Review flags
            </label>
            <select
              id="heritage-flag"
              value={filters.flag}
              onChange={(e) => setFilters((prev) => ({ ...prev, flag: e.target.value }))}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            >
              <option value="no_blocking">No blocking flags</option>
              <option value="all">All (including flagged)</option>
              <option value="clean">Clean only (no flags)</option>
              <option value="matches_curated">Matches curated</option>
              <option value="generic_name">Generic name</option>
              <option value="state_unmapped">State unmapped</option>
              <option value="coords_outside_india">Coords outside India</option>
              <option value="no_description">No description</option>
              <option value="possible_duplicate">Possible duplicate</option>
              <option value="broken_text">Broken text</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="heritage-source" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Authority
            </label>
            <select
              id="heritage-source"
              value={filters.protectedBy}
              onChange={(e) => setFilters((prev) => ({ ...prev, protectedBy: e.target.value }))}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            >
              <option value="all">ASI + SOI</option>
              <option value="asi">ASI only</option>
              <option value="soi">SOI only</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStateInput('__unmapped__');
                setFilters((prev) => ({ ...prev, state: '__unmapped__', flag: 'all' }));
              }}
              className="text-slate-600 hover:text-indigo-700 underline"
            >
              Show unmapped states
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setStateInput('');
                setFilters(DEFAULT_HERITAGE_FILTERS);
              }}
              className="text-indigo-600 hover:text-indigo-800 underline"
            >
              Reset defaults
            </button>
          </div>

          <span className="text-slate-500">
            Sorted alphabetically by State, then Name
          </span>
        </div>
      </div>

      {/* Notices & Errors */}
      {notice && (
        <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchHeritagePlaces(filters)}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {selectionWarning && (
        <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          {selectionWarning}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-indigo-900">
            {selectedIds.length} of max {MAX_BULK_HERITAGE_SELECTION} monument(s) selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirmAction('skip_curated')}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
            >
              Skip curated ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirmAction('reject')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Reject selected ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirmAction('publish')}
              className="px-3 py-1.5 rounded-lg border border-transparent bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Publish selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading heritage monuments...</div>
        ) : places.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-base font-semibold text-slate-700">No monuments match these filters</p>
            <p className="text-xs text-slate-500">
              Try changing the flag or status filter, or clearing your search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select visible monuments"
                      checked={places.length > 0 && places.every((p) => selectedIds.includes(getPlaceId(p)))}
                      onChange={handleToggleSelectVisible}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3">Monument & Location</th>
                  <th scope="col" className="px-4 py-3">State & Authority</th>
                  <th scope="col" className="px-4 py-3">Flags & Status</th>
                  <th scope="col" className="px-4 py-3">Coordinates</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {places.map((place) => {
                  const placeId = getPlaceId(place);
                  const isSelected = selectedIds.includes(placeId);
                  const blocking = getPlaceBlockingFlags(place);
                  const publishable = canPublishPlace(place);
                  const osmUrl =
                    typeof place.latitude === 'number' && typeof place.longitude === 'number'
                      ? getOsmLink(place.latitude, place.longitude)
                      : null;
                  const mergedCount = place.heritage?.mergedSourceIds?.length || 0;
                  const isBusy = busyPlaceId === placeId;

                  return (
                    <tr key={placeId} className={isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select ${place.name}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(placeId)}
                          className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="px-4 py-3 align-top max-w-xs">
                        <a
                          href={`#/places/${placeId}`}
                          className="font-semibold text-slate-900 hover:text-indigo-700 hover:underline block"
                        >
                          {place.name}
                        </a>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>District/City: {place.city || '—'}</span>
                          {place.heritage?.location && (
                            <span className="block text-slate-600">Site location: {place.heritage.location}</span>
                          )}
                        </div>
                        {place.significance ? (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{place.significance}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-1">Description not listed</p>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-xs">
                        <div className="font-medium text-slate-800">
                          {place.state || <span className="text-red-600">State unmapped</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                            {place.heritage?.protectedBy || 'Heritage'}
                          </span>
                          {place.heritage?.asiCircle && (
                            <span className="text-slate-400">{place.heritage.asiCircle}</span>
                          )}
                        </div>
                        {place.sourceId && (
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">{place.sourceId}</div>
                        )}
                        {mergedCount > 0 && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Grouped +{mergedCount} duplicate(s)
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="mb-1">
                          {place.hidden ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              {place.hiddenReason || 'hidden'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Published
                            </span>
                          )}
                        </div>
                        {place.reviewFlags && place.reviewFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {place.reviewFlags.map((flag) => {
                              const isBlock = blocking.includes(flag);
                              const isCuratedMatch = flag === 'matches_curated';
                              return (
                                <span
                                  key={flag}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                    isBlock
                                      ? 'bg-red-100 text-red-800'
                                      : isCuratedMatch
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {FLAG_LABELS[flag] || flag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {place.heritage?.matchedCuratedPlace?.name && (
                          <div className="text-[11px] text-indigo-700 mt-1">
                            Matches curated:{' '}
                            <a
                              href={`#/places/${place.heritage.matchedCuratedPlace.placeId}`}
                              className="font-semibold underline hover:text-indigo-900"
                            >
                              {place.heritage.matchedCuratedPlace.name}
                            </a>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-xs whitespace-nowrap">
                        {typeof place.latitude === 'number' && typeof place.longitude === 'number' ? (
                          <div className="space-y-1">
                            <div className="font-mono text-slate-600">
                              {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setMapPreviewPlace(place)}
                                className="text-indigo-600 hover:text-indigo-800 underline"
                              >
                                Preview map
                              </button>
                              {osmUrl && (
                                <a
                                  href={osmUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-slate-800 underline"
                                >
                                  OSM
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">No coords</span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openQuickEdit(place)}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {place.hidden && place.hiddenReason !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isBusy || !publishable}
                            onClick={() => handleSingleAction(place, 'publish')}
                            title={
                              !publishable
                                ? `Blocked by: ${blocking.join(', ')}`
                                : hasCuratedOverlap(place)
                                  ? 'Publish with curated overlap confirmation'
                                  : 'Publish monument'
                            }
                            className="px-2.5 py-1 rounded border border-transparent bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            Publish
                          </button>
                        )}
                        {(hasCuratedOverlap(place) || place.hiddenReason === 'pending_review') &&
                          place.hiddenReason !== 'already_curated' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSingleAction(place, 'skip-curated')}
                              className="px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-45"
                            >
                              Skip - already curated
                            </button>
                          )}
                        {place.hiddenReason !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSingleAction(place, 'reject')}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {nextOffset !== null && !isLoading && (
          <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading more...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Inline Quick Edit Modal */}
      <Modal
        isOpen={editingPlace !== null}
        onClose={() => setEditingPlace(null)}
        title={`Edit ${editingPlace?.name || 'Monument'}`}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSaveQuickEdit} className="space-y-3">
          {editError && (
            <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {editError}
            </div>
          )}

          <div>
            <label htmlFor="quick-edit-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Name
            </label>
            <input
              id="quick-edit-name"
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-edit-city" className="block text-xs font-semibold text-slate-700 mb-1">
                City / District
              </label>
              <input
                id="quick-edit-city"
                type="text"
                required
                value={editForm.city}
                onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="quick-edit-state" className="block text-xs font-semibold text-slate-700 mb-1">
                State
              </label>
              <input
                id="quick-edit-state"
                type="text"
                value={editForm.state}
                onChange={(e) => setEditForm((prev) => ({ ...prev, state: e.target.value }))}
                placeholder="e.g. Karnataka"
                className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-edit-lat" className="block text-xs font-semibold text-slate-700 mb-1">
                Latitude
              </label>
              <input
                id="quick-edit-lat"
                type="text"
                value={editForm.latitude}
                onChange={(e) => setEditForm((prev) => ({ ...prev, latitude: e.target.value }))}
                className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label htmlFor="quick-edit-lng" className="block text-xs font-semibold text-slate-700 mb-1">
                Longitude
              </label>
              <input
                id="quick-edit-lng"
                type="text"
                value={editForm.longitude}
                onChange={(e) => setEditForm((prev) => ({ ...prev, longitude: e.target.value }))}
                className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="quick-edit-sig" className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Significance
            </label>
            <textarea
              id="quick-edit-sig"
              rows={3}
              maxLength={500}
              value={editForm.significance}
              onChange={(e) => setEditForm((prev) => ({ ...prev, significance: e.target.value }))}
              className="block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {editingPlace ? (
              <a
                href={`#/places/${editingPlace.id || editingPlace._id}`}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
              >
                Open full editor
              </a>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingPlace(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Coordinate OSM Map Preview Modal */}
      <Modal
        isOpen={mapPreviewPlace !== null}
        onClose={() => setMapPreviewPlace(null)}
        title={`Coordinate preview: ${mapPreviewPlace?.name || ''}`}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Approximate bbox centroid ({mapPreviewPlace?.latitude}, {mapPreviewPlace?.longitude}). Verify against OpenStreetMap before publishing.
          </p>
          {mapPreviewUrl ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <iframe
                title={`OSM preview for ${mapPreviewPlace?.name || 'monument'}`}
                src={mapPreviewUrl}
                className="w-full h-64 border-0"
              />
            </div>
          ) : (
            <p className="text-xs text-red-600">Coordinates are not valid for map preview.</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMapPreviewPlace(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Action Confirmation Modal */}
      <Modal
        isOpen={bulkConfirmAction !== null}
        onClose={() => setBulkConfirmAction(null)}
        title={
          bulkConfirmAction === 'publish'
            ? `Publish ${selectedIds.length} monument(s)?`
            : bulkConfirmAction === 'skip_curated'
              ? `Skip ${selectedIds.length} already-curated monument(s)?`
              : `Reject ${selectedIds.length} monument(s)?`
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {bulkConfirmAction === 'publish'
              ? `You are about to publish ${selectedIds.length} selected monument(s). Items with blocking flags, curated overlap confirmation needed, or version conflicts will be skipped.`
              : bulkConfirmAction === 'skip_curated'
                ? `You are about to mark ${selectedIds.length} selected monument(s) as already curated. They will remain hidden.`
                : `You are about to reject ${selectedIds.length} selected monument(s). They will remain hidden.`}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkConfirmAction(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={handleConfirmBulkAction}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${
                bulkConfirmAction === 'publish'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : bulkConfirmAction === 'skip_curated'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {isBulkRunning
                ? 'Processing...'
                : bulkConfirmAction === 'publish'
                  ? `Confirm publish (${selectedIds.length})`
                  : bulkConfirmAction === 'skip_curated'
                    ? `Confirm skip (${selectedIds.length})`
                    : `Confirm reject (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Curated Overlap Publish Confirmation Modal */}
      <Modal
        isOpen={overlapConfirmPlace !== null}
        onClose={() => setOverlapConfirmPlace(null)}
        title="Confirm Publishing Curated Overlap"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{overlapConfirmPlace?.name}</strong> appears to overlap with existing curated place{' '}
            <strong className="text-slate-900">
              {overlapConfirmPlace?.heritage?.matchedCuratedPlace?.name || 'an existing curated record'}
            </strong>
            {overlapConfirmPlace?.heritage?.matchedCuratedPlace?.city
              ? ` (${overlapConfirmPlace.heritage.matchedCuratedPlace.city})`
              : ''}
            . Publish anyway, or cancel and mark it as already curated?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOverlapConfirmPlace(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              Cancel
            </button>
            {overlapConfirmPlace && (
              <button
                type="button"
                disabled={busyPlaceId === getPlaceId(overlapConfirmPlace)}
                onClick={() => handleSingleAction(overlapConfirmPlace, 'publish', { confirmOverlap: true })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                Publish anyway
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
