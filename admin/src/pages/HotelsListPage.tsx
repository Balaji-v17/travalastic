import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import {
  parseHotelQuery,
  buildHotelHash,
  type HotelFilterState,
  type BudgetTierFilter,
  type HotelVisibilityFilter,
} from '../lib/hotelQuery.ts';
import type { HotelModel } from '../lib/diffHotel.ts';
import { computePriceAge } from '../lib/priceAge.ts';

interface HotelsResponse {
  hotels: HotelModel[];
  nextCursor: string | null;
}

export function HotelsListPage() {
  const [filters, setFilters] = useState<HotelFilterState>(() =>
    parseHotelQuery(window.location.hash)
  );

  const [searchInput, setSearchInput] = useState<string>(filters.q);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [hotels, setHotels] = useState<HotelModel[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync hash when filters change
  const updateHashUrl = useCallback((newFilters: HotelFilterState) => {
    const newHash = buildHotelHash(newFilters);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, []);

  // Listen to browser Back / Forward events
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHotelQuery(window.location.hash);
      setFilters((prev) => {
        if (
          prev.q === parsed.q &&
          prev.city === parsed.city &&
          prev.budgetTier === parsed.budgetTier &&
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

  // Fetch hotels
  const fetchHotels = useCallback(
    async (currentFilters: HotelFilterState) => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (currentFilters.q.trim()) queryParams.set('q', currentFilters.q.trim().slice(0, 60));
        if (currentFilters.city.trim()) queryParams.set('destination', currentFilters.city.trim());
        if (currentFilters.budgetTier !== 'all') queryParams.set('budgetTier', currentFilters.budgetTier);
        if (currentFilters.hidden === 'true' || currentFilters.hidden === 'false') {
          queryParams.set('hidden', currentFilters.hidden);
        }
        queryParams.set('limit', '25');

        const qs = queryParams.toString();
        const endpoint = `/admin/hotels${qs ? `?${qs}` : ''}`;
        const data = await apiFetch<HotelsResponse>(endpoint);

        setHotels(data.hotels || []);
        setNextCursor(data.nextCursor || null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(getApiErrorMessage(err));
        } else {
          setError('Failed to load hotels. Please check your connection.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load more via cursor
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (filters.q.trim()) queryParams.set('q', filters.q.trim().slice(0, 60));
      if (filters.city.trim()) queryParams.set('destination', filters.city.trim());
      if (filters.budgetTier !== 'all') queryParams.set('budgetTier', filters.budgetTier);
      if (filters.hidden === 'true' || filters.hidden === 'false') {
        queryParams.set('hidden', filters.hidden);
      }
      queryParams.set('limit', '25');
      queryParams.set('cursor', nextCursor);

      const qs = queryParams.toString();
      const endpoint = `/admin/hotels?${qs}`;
      const data = await apiFetch<HotelsResponse>(endpoint);

      setHotels((prev) => [...prev, ...(data.hotels || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError('Failed to load more hotels.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHotels(filters);
  }, [filters, fetchHotels]);

  // Debounced search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 60);
    setSearchInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const updated: HotelFilterState = { ...filters, q: val.trim() };
      setFilters(updated);
      updateHashUrl(updated);
    }, 400);
  };

  const handleFilterChange = (
    key: 'city' | 'budgetTier' | 'hidden',
    val: string
  ) => {
    const updated: HotelFilterState = { ...filters, [key]: val };
    setFilters(updated);
    updateHashUrl(updated);
  };

  const handleResetFilters = () => {
    const reset: HotelFilterState = {
      q: '',
      city: '',
      budgetTier: 'all',
      hidden: 'all',
    };
    setSearchInput('');
    setFilters(reset);
    updateHashUrl(reset);
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

  const formatTierLabel = (tier?: string) => {
    if (!tier) return '—';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Curated Hotels</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, manage, and review pricing for vetted accommodations across destinations.
          </p>
        </div>
        <div>
          <a
            href="#/hotels/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Hotel
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5">
            <label htmlFor="hotel-search" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Search Hotels
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                id="hotel-search"
                value={searchInput}
                onChange={handleSearchChange}
                maxLength={60}
                placeholder="Search hotel name (debounced 400ms)..."
                className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* City / Destination Filter */}
          <div className="md:col-span-3">
            <label htmlFor="filter-hotel-city" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Destination / City
            </label>
            <input
              type="text"
              id="filter-hotel-city"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              placeholder="e.g. Goa, Jaipur..."
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            />
          </div>

          {/* Price Tier Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-hotel-tier" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Price Tier
            </label>
            <select
              id="filter-hotel-tier"
              value={filters.budgetTier}
              onChange={(e) => handleFilterChange('budgetTier', e.target.value as BudgetTierFilter)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            >
              <option value="all">All Tiers</option>
              <option value="budget">Budget</option>
              <option value="mid">Mid</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>

          {/* Visibility Filter */}
          <div className="md:col-span-2">
            <label htmlFor="filter-hotel-visibility" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Visibility
            </label>
            <select
              id="filter-hotel-visibility"
              value={filters.hidden}
              onChange={(e) => handleFilterChange('hidden', e.target.value as HotelVisibilityFilter)}
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"
            >
              <option value="all">All visibility</option>
              <option value="false">Visible only</option>
              <option value="true">Hidden only</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Helper Link */}
        {(filters.q || filters.city || filters.budgetTier !== 'all' || filters.hidden !== 'all') && (
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
            onClick={() => fetchHotels(filters)}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm">Loading hotels...</p>
          </div>
        ) : hotels.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No hotels found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {filters.q || filters.city || filters.budgetTier !== 'all' || filters.hidden !== 'all'
                ? 'Try adjusting your search criteria or clear your active filters.'
                : 'Get started by creating your first curated hotel.'}
            </p>
            {(filters.q || filters.city || filters.budgetTier !== 'all' || filters.hidden !== 'all') && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Hotel & Destination
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Price Tier
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Price Range
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Price Reviewed
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {hotels.map((hotel) => {
                  const priceAge = computePriceAge(hotel.priceReviewedAt);
                  const isHidden = hotel.hidden === true;

                  return (
                    <tr
                      key={hotel._id}
                      onClick={() => {
                        window.location.hash = `#/hotels/${hotel._id}`;
                      }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.location.hash = `#/hotels/${hotel._id}`;
                        }
                      }}
                      aria-label={`Edit ${hotel.name}`}
                    >
                      {/* Name & Destination */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {hotel.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{hotel.destination}</span>
                          {hotel.rating !== undefined && hotel.rating !== null && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center text-amber-600 font-medium">
                                ★ {Number(hotel.rating).toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Budget Tier */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          hotel.budgetTier === 'luxury'
                            ? 'bg-purple-100 text-purple-800'
                            : hotel.budgetTier === 'budget'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {formatTierLabel(hotel.budgetTier)}
                        </span>
                      </td>

                      {/* Price Range */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                        {hotel.priceRangeINR ? hotel.priceRangeINR : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Price Reviewed (Neutral warning if > 180 days or not recorded) */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {priceAge.isStale ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
                            title={hotel.priceReviewedAt ? `Reviewed ${formatDate(hotel.priceReviewedAt)}` : 'Review date not recorded'}
                          >
                            <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{priceAge.label}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs text-slate-600 bg-slate-50 border border-slate-200"
                            title={hotel.priceReviewedAt ? `Reviewed ${formatDate(hotel.priceReviewedAt)}` : ''}
                          >
                            {priceAge.label}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isHidden ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            Hidden
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Visible
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <div>{formatDate(hotel.updatedAt || hotel.createdAt)}</div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[150px]" title={hotel.updatedByEmail || ''}>
                          {hotel.updatedByEmail || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Pagination */}
        {nextCursor && !isLoading && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isLoadingMore ? 'Loading more hotels...' : 'Load more hotels'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

