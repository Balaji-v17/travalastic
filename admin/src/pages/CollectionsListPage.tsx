import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '../lib/api.ts';
import { getApiErrorMessage } from '../lib/apiErrors.ts';
import {
  VALID_STYLE_KEYS,
  getStyleLabel,
  type ValidStyleKey,
} from '../lib/styleLabels.ts';

interface StyleCollectionSummary {
  key: string;
  picksCount: number;
  version: number;
  updatedAt: string;
  updatedByEmail: string | null;
}

interface StylesResponse {
  collections: StyleCollectionSummary[];
}

export function CollectionsListPage() {
  const [collections, setCollections] = useState<StyleCollectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StylesResponse>('/admin/styles');
      const incoming = data.collections || [];

      // Ensure all 6 standard collections are accounted for in canonical order
      const map = new Map<string, StyleCollectionSummary>(
        incoming.map((c) => [c.key, c])
      );

      const canonicalList: StyleCollectionSummary[] = VALID_STYLE_KEYS.map((k) => {
        const found = map.get(k);
        if (found) return found;
        return {
          key: k,
          picksCount: 0,
          version: 1,
          updatedAt: '',
          updatedByEmail: null,
        };
      });

      setCollections(canonicalList);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError('Failed to load collections. Please check your network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleRowClick = (key: string) => {
    window.location.hash = `#/collections/${encodeURIComponent(key)}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(key);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Style Collections
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Curate destination picks for the six themed collections featured on the homepage.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start justify-between"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="h-5 w-5 text-red-500 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchCollections}
            className="ml-4 font-semibold text-red-700 hover:text-red-900 underline text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 text-center">
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
            <span>Loading collections...</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th scope="col" className="px-6 py-3.5">
                  Collection
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Picks
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Last updated
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Updated by
                </th>
                <th scope="col" className="px-6 py-3.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {collections.map((col) => {
                const label = getStyleLabel(col.key);
                const updatedDate = col.updatedAt
                  ? new Date(col.updatedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';
                const updatedBy = col.updatedByEmail || '—';

                return (
                  <tr
                    key={col.key}
                    onClick={() => handleRowClick(col.key)}
                    onKeyDown={(e) => handleKeyDown(e, col.key)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit ${label} collection`}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors focus:outline-hidden focus:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-900 font-semibold">{label}</span>
                        <span className="text-xs text-slate-400 font-mono">({col.key})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {col.picksCount} of 12 picks
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {updatedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                      {updatedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <a
                        href={`#/collections/${col.key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="font-medium text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1"
                        aria-label={`Edit ${label}`}
                      >
                        <span>Edit</span>
                        <span aria-hidden="true">&rarr;</span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

