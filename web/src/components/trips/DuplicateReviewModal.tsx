import { useState, useEffect } from 'react';
import type { Journey } from '../../data/mockData';
import {
  getTripSummaryMetrics,
  validateGroupKeepSelection,
  type DuplicateTripGroup,
  type SequentialDeleteOutcome,
  type TripExtrasCount,
} from '../../lib/duplicateTrips';

interface DuplicateReviewModalProps {
  open: boolean;
  exactGroups: DuplicateTripGroup[];
  similarGroups: DuplicateTripGroup[];
  extrasByTripId: Record<string, TripExtrasCount | undefined>;
  loadingExtras: boolean;
  lastOutcome: SequentialDeleteOutcome | null;
  onRequestDeleteGroup: (params: {
    group: DuplicateTripGroup;
    keepTrips: Journey[];
    deleteTrips: Journey[];
  }) => void;
  onClose: () => void;
}

function formatDateBadge(isoOrDate?: string | null): string {
  if (!isoOrDate) return 'Unknown';
  const str = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DuplicateReviewModal({
  open,
  exactGroups,
  similarGroups,
  extrasByTripId,
  loadingExtras,
  lastOutcome,
  onRequestDeleteGroup,
  onClose,
}: DuplicateReviewModalProps) {
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string[]>>({});

  // Default every group to keeping ALL trips (nothing preselected for deletion),
  // and cleanly prune deleted trip IDs when groups update after refreshJourneys.
  useEffect(() => {
    if (!open) return;
    const allGroups = [...exactGroups, ...similarGroups];
    setKeepByGroup((prev) => {
      const next: Record<string, string[]> = {};
      for (const group of allGroups) {
        const validIds = new Set(group.trips.map((t) => t.id));
        const existing = prev[group.key];
        if (existing) {
          const kept = existing.filter((id) => validIds.has(id));
          next[group.key] = kept.length > 0 ? kept : group.trips.map((t) => t.id);
        } else {
          next[group.key] = group.trips.map((t) => t.id);
        }
      }
      return next;
    });
  }, [open, exactGroups, similarGroups]);

  if (!open) return null;

  const allGroupsCount = exactGroups.length + similarGroups.length;

  const toggleKeep = (group: DuplicateTripGroup, tripId: string) => {
    setKeepByGroup((prev) => {
      const current = new Set(prev[group.key] ?? group.trips.map((t) => t.id));
      if (current.has(tripId)) current.delete(tripId);
      else current.add(tripId);
      return { ...prev, [group.key]: Array.from(current) };
    });
  };

  const renderGroup = (group: DuplicateTripGroup) => {
    const keepIds = new Set(keepByGroup[group.key] ?? group.trips.map((t) => t.id));
    const validation = validateGroupKeepSelection(group.trips, keepIds);
    const noneKept = validation.keptTrips.length === 0;

    return (
      <div
        key={group.key}
        data-testid={`duplicate-group-${group.key}`}
        className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-base font-bold text-slate-900">
                {group.destination}
              </h4>
              <span className="text-xs text-slate-500">
                {group.startDate} – {group.endDate}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  group.kind === 'exact'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {group.kind === 'exact'
                  ? `${group.trips.length} exact duplicates`
                  : `${group.trips.length} overlapping trips`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              All trips stay checked to keep by default. Uncheck any duplicates you want to remove.
            </p>
          </div>
          <button
            type="button"
            disabled={!validation.valid}
            onClick={() =>
              onRequestDeleteGroup({
                group,
                keepTrips: validation.keptTrips,
                deleteTrips: validation.deleteTrips,
              })
            }
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {validation.deleteTrips.length > 0
              ? `Delete the others (${validation.deleteTrips.length})`
              : 'Delete the others'}
          </button>
        </div>

        {noneKept && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-800"
          >
            At least one trip must remain kept. You cannot delete all trips in a group.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {group.trips.map((trip) => {
            const kept = keepIds.has(trip.id);
            const isMostComplete = group.mostCompleteTripId === trip.id;
            const m = getTripSummaryMetrics(trip, extrasByTripId[trip.id]);
            const expensesLabel =
              m.expensesCount !== null
                ? String(m.expensesCount)
                : loadingExtras
                ? 'Loading...'
                : 'unknown';
            const lastEditedLabel = trip.lastEditedAt
              ? `${formatDateBadge(trip.lastEditedAt)}${m.editCount > 0 ? ` (${m.editCount} edit${m.editCount > 1 ? 's' : ''})` : ''}`
              : m.editCount > 0
              ? `${m.editCount} edit${m.editCount > 1 ? 's' : ''}`
              : 'No edits recorded';
            const bookingParts: string[] = [];
            if (m.flightBookingsCount > 0) {
              bookingParts.push(`${m.flightBookingsCount} flight`);
            }
            if (m.recordedBookingsCount > 0) {
              bookingParts.push(`${m.recordedBookingsCount} recorded`);
            }
            const bookingsLabel = bookingParts.length > 0 ? bookingParts.join(', ') : 'None';

            return (
              <div
                key={trip.id}
                data-testid={`review-trip-card-${trip.id}`}
                className={`rounded-xl border p-3.5 bg-white flex flex-col justify-between gap-3 transition-colors ${
                  kept
                    ? 'border-emerald-300 ring-1 ring-emerald-200/70'
                    : 'border-red-300 bg-red-50/20'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {trip.title || trip.destination || 'Untitled trip'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {trip.destination} · {formatDateBadge(trip.startDate)} – {formatDateBadge(trip.endDate)}
                      </p>
                    </div>
                    {isMostComplete && (
                      <span
                        title="Suggestion only — based on itinerary items, done marks, and edits"
                        className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wide shrink-0"
                      >
                        Most complete
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] pt-2 border-t border-slate-100">
                    <div>
                      <dt className="text-slate-400">Created</dt>
                      <dd className="font-medium text-slate-700">{formatDateBadge(trip.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Last edited</dt>
                      <dd className="font-medium text-slate-700">{lastEditedLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Itinerary items</dt>
                      <dd className="font-medium text-slate-700">
                        {m.itemsCount} ({m.doneCount} done)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Expenses</dt>
                      <dd className="font-medium text-slate-700">{expensesLabel}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-400">Bookings linked</dt>
                      <dd
                        className={`font-medium ${
                          m.hasConfirmedDuffelBooking ? 'text-amber-800 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {bookingsLabel}
                      </dd>
                    </div>
                  </dl>
                </div>

                <label className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={kept}
                      onChange={() => toggleKeep(group, trip.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    Keep this trip
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      kept ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {kept ? 'Kept' : 'Will delete'}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-review-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100">
          <div>
            <h3 id="duplicate-review-modal-title" className="font-display text-xl font-bold text-slate-900">
              Review duplicate and similar trips
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Compare your trips side by side before deleting anything. Nothing is preselected for removal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review panel"
            className="text-slate-400 hover:text-slate-700 px-2.5 py-1.5 rounded-lg text-sm font-medium"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {lastOutcome && lastOutcome.results.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                lastOutcome.failedItems.length > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <p className="font-semibold">
                {lastOutcome.succeededIds.length} deleted
                {lastOutcome.failedItems.length > 0
                  ? `, ${lastOutcome.failedItems.length} failed`
                  : ''}
              </p>
              {lastOutcome.results.map((r) => (
                <div key={r.id} className="flex justify-between gap-2">
                  <span className="truncate">{r.title}</span>
                  <span>{r.ok ? 'Removed' : `Failed: ${r.error || 'Error'}`}</span>
                </div>
              ))}
            </div>
          )}

          {allGroupsCount === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500">
              No duplicate or similar trip groups remain.
            </div>
          ) : (
            <>
              {exactGroups.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Exact duplicates ({exactGroups.length})
                    </h4>
                    <span className="text-[11px] text-slate-400">Same destination & exact dates</span>
                  </div>
                  <div className="space-y-4">{exactGroups.map(renderGroup)}</div>
                </section>
              )}

              {similarGroups.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Similar trips ({similarGroups.length})
                    </h4>
                    <span className="text-[11px] text-amber-700">
                      Information only — same destination with overlapping dates
                    </span>
                  </div>
                  <div className="space-y-4">{similarGroups.map(renderGroup)}</div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Done reviewing
          </button>
        </div>
      </div>
    </div>
  );
}

