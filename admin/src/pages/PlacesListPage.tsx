import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import {
  parsePlaceQuery,
  buildPlaceQuery,
  buildPlaceHash,
  DEFAULT_PLACE_FILTERS,
  type PlaceFilterState,
  type VisibilityFilter,
} from '../lib/placeQuery.ts';
import type { PlaceModel } from '../lib/diffPlace.ts';

interface PlacesResponse {
  places: PlaceModel[];
  nextCursor: string | null;
}

export function PlacesListPage() {
  // Read initial filter state from current URL hash
  const [filters, setFilters] = useState<PlaceFilterState>(() =>
    parsePlaceQuery(window.location.hash)
  );

  // Search input local state for debouncing
  const [searchInput, setSearchInput] = useState<string>(filters.q);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [places, setPlaces] = useState<PlaceModel[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize URL hash when filters change
  const updateHashUrl = useCallback((newFilters: PlaceFilterState) => {
    const newHash = buildPlaceHash(newFilters);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, []);

  // Listen to browser Back / Forward events to update filter state
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parsePlaceQuery(window.location.hash);
      setFilters((prev) => {
        if (
          prev.q === parsed.q &&
          prev.city === parsed.city &&
          prev.state === parsed.state &&
          prev.type === parsed.type &&
          prev.hidden === parsed.hidden
        ) {
          return prev;
        }
        setSearchInput(parsed.q);
        return parsed;
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch places (initial or filter change)
  const fetchPlaces = useCallback(
    async (currentFilters: PlaceFilterState) => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (currentFilters.q.trim()) queryParams.set('q', currentFilters.q.trim().slice(0, 60));
        if (currentFilters.city.trim()) queryParams.set('city', currentFilters.city.trim());
        if (currentFilters.state.trim()) queryParams.set('state', currentFilters.state.trim());
        if (currentFilters.type.trim()) queryParams.set('type', currentFilters.type.trim());
        if (currentFilters.hidden === 'true' || currentFilters.hidden === 'false') {
          queryParams.set('hidden', currentFilters.hidden);
        }
        queryParams.set('limit', '25');

        const qs = queryParams.toString();
        const endpoint = `/admin/places${qs ? `?${qs}` : ''}`;
        const data = await apiFetch<PlacesResponse>(endpoint);

        setPlaces(data.places || []);
        setNextCursor(data.nextCursor || null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(getApiErrorMessage(err));
        } else {
          setError('Failed to load places. Please check your connection.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Fetch more places (cursor pagination)
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (filters.q.trim()) queryParams.set('q', filters.q.trim().slice(0, 60));
      if (filters.city.trim()) queryParams.set('city', filters.city.trim());
      if (filters.state.trim()) queryParams.set('state', filters.state.trim());
      if (filters.type.trim()) queryParams.set('type', filters.type.trim());
      if (filters.hidden === 'true' || filters.hidden === 'false') {
        queryParams.set('hidden', filters.hidden);
      }
      queryParams.set('limit', '25');
      queryParams.set('cursor', nextCursor);

      const qs = queryParams.toString();
      const endpoint = `/admin/places?${qs}`;
      const data = await apiFetch<PlacesResponse>(endpoint);

      setPlaces((prev) => [...prev, ...(data.places || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError('Failed to load more places.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Re-fetch whenever filters change
  useEffect(() => {
    fetchPlaces(filters);
  }, [filters, fetchPlaces]);

  // Handle Search input change with 400ms debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 60);
    setSearchInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setFilters((prev) => {
        const next = { ...prev, q: val };
        updateHashUrl(next);
        return next;
      });
    }, 400);
  };

  // Immediate filter changes for city, state, type, visibility
  const handleFilterChange = (field: keyof PlaceFilterState, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      updateHashUrl(next);
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters(DEFAULT_PLACE_FILTERS);
    updateHashUrl(DEFAULT_PLACE_FILTERS);
  };

  const getSourceLabel = (place: PlaceModel) => {
    if (place.source === 'admin' || (place.isCurated && place.source === 'admin')) {
      return 'Added by admin';
    }
    if (place.isCurated && place.source !== 'admin') {
      return 'Curated';
    }
    return place.source || 'Standard';
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Places</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, search and manage tourist destinations across India.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/places/new';
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add place
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-4">
            <label htmlFor="search-places" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search name or city
            </label>
            <div className="relative rounded-lg shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="search-places"
                value={searchInput}
                onChange={handleSearchChange}
                maxLength={60}
                placeholder="Search by name or city..."
                className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* City Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-city" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              City
            </label>
            <input
              type="text"
              id="filter-city"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              placeholder="Filter city..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            />
          </div>

          {/* State Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-state" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              State
            </label>
            <input
              type="text"
              id="filter-state"
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              placeholder="Filter state..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            />
          </div>

          {/* Type Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Type
            </label>
            <input
              type="text"
              id="filter-type"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              placeholder="Filter type..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            />
          </div>

          {/* Visibility Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-visibility" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Visibility
            </label>
            <select
              id="filter-visibility"
              value={filters.hidden}
              onChange={(e) => handleFilterChange('hidden', e.target.value as VisibilityFilter)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            >
              <option value="all">All visibility</option>
              <option value="false">Visible only</option>
              <option value="true">Hidden only</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Helper Link */}
        {(filters.q || filters.city || filters.state || filters.type || filters.hidden !== 'all') && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-hidden underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between"
        >
          <div className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchPlaces(filters)}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Places Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center space-y-3">
            <svg
              className="animate-spin h-6 w-6 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Loading places...</span>
          </div>
        ) : places.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="text-base font-semibold text-slate-700">No places match</p>
            <p className="text-sm text-slate-500">
              Try adjusting your search terms or clearing current filter criteria.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3">Place Name</th>
                  <th scope="col" className="px-6 py-3">Location</th>
                  <th scope="col" className="px-6 py-3">Type</th>
                  <th scope="col" className="px-6 py-3">Source</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {places.map((place) => {
                  const placeId = place.id || place._id;
                  const isHidden = place.hidden === true;

                  return (
                    <tr
                      key={placeId}
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        window.location.hash = `#/places/${placeId}`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.location.hash = `#/places/${placeId}`;
                        }
                      }}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors focus:outline-hidden focus:bg-indigo-50/50"
                    >
                      {/* Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600">
                          {place.name}
                        </div>
                        {place.googleRating !== undefined && place.googleRating !== null && (
                          <div className="text-xs text-amber-600 flex items-center mt-0.5">
                            ★ {place.googleRating.toFixed(1)}
                            {place.entranceFeeINR !== undefined && place.entranceFeeINR !== null && place.entranceFeeINR > 0 && (
                              <span className="text-slate-400 ml-2">₹{place.entranceFeeINR}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {place.city}, {place.state}
                        {place.zone && <span className="text-slate-400 text-xs block">{place.zone}</span>}
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {place.type}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {getSourceLabel(place)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isHidden ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Hidden
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Visible
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <div>{formatDate(place.updatedAt)}</div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[150px]" title={place.updatedByEmail || ''}>
                          {place.updatedByEmail || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {nextCursor && !isLoading && (
          <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isLoadingMore ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Loading more...</span>
                </>
              ) : (
                'Load more places'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
