import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, ApiError } from '../lib/api.ts';
import { buildAuditQuery } from '../lib/auditQuery.ts';

export interface AuditChangeItem {
  field: string;
  before: any;
  after: any;
}

export interface AuditLogItem {
  id: string;
  _id: string;
  at: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  changes: AuditChangeItem[];
}

interface AuditApiResponse {
  items: AuditLogItem[];
  nextCursor: string | null;
}

export function AuditLogPage() {
  const { admin } = useAuth();

  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [appliedFilters, setAppliedFilters] = useState<{
    actor: string;
    action: string;
    targetType: string;
    from: string;
    to: string;
  }>({
    actor: '',
    action: '',
    targetType: '',
    from: '',
    to: '',
  });

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Role check guard: super_admin only
  if (admin && admin.role !== 'super_admin') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-600">
          You don't have permission to view this.
        </p>
      </div>
    );
  }

  const fetchLogs = useCallback(
    async (cursorToUse: string | null = null, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const queryString = buildAuditQuery({
          actor: appliedFilters.actor,
          action: appliedFilters.action,
          targetType: appliedFilters.targetType,
          from: appliedFilters.from ? new Date(appliedFilters.from).toISOString() : null,
          to: appliedFilters.to ? new Date(appliedFilters.to).toISOString() : null,
          limit: 50,
          cursor: cursorToUse,
        });

        const data = await apiFetch<AuditApiResponse>(`/admin/audit${queryString}`);

        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view this.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load audit logs. Please try again.');
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      actor: actor.trim(),
      action: action.trim(),
      targetType: targetType.trim(),
      from: from.trim(),
      to: to.trim(),
    });
  };

  const handleResetFilters = () => {
    setActor('');
    setAction('');
    setTargetType('');
    setFrom('');
    setTo('');
    setAppliedFilters({
      actor: '',
      action: '',
      targetType: '',
      from: '',
      to: '',
    });
  };

  const toggleRow = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">System Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Immutable, append-only record of administrative operations, logins, and access events.
        </p>

        {/* Filter Form */}
        <form onSubmit={handleApplyFilters} className="mt-5 pt-5 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="filter-actor" className="block text-xs font-medium text-slate-700 mb-1">
                Actor Email
              </label>
              <input
                id="filter-actor"
                type="text"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="e.g. admin@travalastic.com"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="filter-action" className="block text-xs font-medium text-slate-700 mb-1">
                Action
              </label>
              <input
                id="filter-action"
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. admin.login"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="filter-target" className="block text-xs font-medium text-slate-700 mb-1">
                Target Type
              </label>
              <input
                id="filter-target"
                type="text"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                placeholder="e.g. AdminUser, Route"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="filter-from" className="block text-xs font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                id="filter-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="filter-to" className="block text-xs font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                id="filter-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-end space-x-2">
              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">Actor</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Target</th>
                <th scope="col" className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center space-x-2">
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
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Loading audit entries...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isExpanded = expandedRowIds.has(item.id);
                  const hasChanges = item.changes && item.changes.length > 0;
                  const dateObj = new Date(item.at);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => toggleRow(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleRow(item.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                        className="hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50 transition-colors"
                      >
                        <td
                          className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap"
                          title={dateObj.toISOString()}
                        >
                          {dateObj.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {item.actorEmail}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-200">
                            {item.actorRole}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">
                          {item.action}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {item.targetType ? `${item.targetType}${item.targetId ? `:${item.targetId}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="truncate max-w-md">{item.summary}</span>
                            {hasChanges && (
                              <span className="ml-2 text-xs font-semibold text-blue-600 shrink-0">
                                {isExpanded ? 'Hide changes' : `View changes (${item.changes.length})`}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Document Changes / Payload Differences
                              </div>
                              {hasChanges ? (
                                <div className="space-y-2">
                                  {item.changes.map((c, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-white rounded border border-slate-200 font-mono text-xs"
                                    >
                                      <div className="font-semibold text-slate-900 mb-1">
                                        Field: {c.field}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700">
                                        <div className="p-2 bg-red-50 text-red-900 rounded border border-red-100 break-words">
                                          <span className="font-bold">Before:</span>{' '}
                                          {formatValue(c.before)}
                                        </div>
                                        <div className="p-2 bg-green-50 text-green-900 rounded border border-green-100 break-words">
                                          <span className="font-bold">After:</span>{' '}
                                          {formatValue(c.after)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">
                                  No field-level mutations recorded for this event.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {nextCursor && !isLoading && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
            <button
              type="button"
              onClick={() => fetchLogs(nextCursor, true)}
              disabled={isLoadingMore}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoadingMore ? 'Loading more...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

