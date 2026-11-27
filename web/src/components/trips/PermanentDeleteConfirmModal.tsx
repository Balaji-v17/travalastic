import { useState, useEffect } from 'react';
import type { Journey } from '../../data/mockData';
import {
  canConfirmPermanentDelete,
  getDeletionConfirmationRequirements,
  getTripSummaryMetrics,
  type SequentialDeleteOutcome,
  type TripExtrasCount,
} from '../../lib/duplicateTrips';

interface PermanentDeleteConfirmModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  keepTrips?: Journey[];
  deleteTrips: Journey[];
  extrasByTripId: Record<string, TripExtrasCount | undefined>;
  loadingExtras?: boolean;
  isDeleting: boolean;
  outcome: SequentialDeleteOutcome | null;
  confirmButtonLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function formatDateRange(startDate?: string, endDate?: string): string {
  const s = (startDate || '').slice(0, 10);
  const e = (endDate || '').slice(0, 10);
  if (s && e) return `${s} – ${e}`;
  return s || e || 'Unknown dates';
}

export default function PermanentDeleteConfirmModal({
  open,
  title,
  subtitle,
  keepTrips = [],
  deleteTrips,
  extrasByTripId,
  loadingExtras = false,
  isDeleting,
  outcome,
  confirmButtonLabel,
  onCancel,
  onConfirm,
}: PermanentDeleteConfirmModalProps) {
  const [ackCannotUndo, setAckCannotUndo] = useState(false);
  const [extraBookingConfirm, setExtraBookingConfirm] = useState(false);

  // Reset checkboxes whenever the confirmation batch opens or target IDs change
  const targetKey = deleteTrips.map((t) => t.id).join(',');
  useEffect(() => {
    setAckCannotUndo(false);
    setExtraBookingConfirm(false);
  }, [open, targetKey]);

  if (!open) return null;

  const reqs = getDeletionConfirmationRequirements(deleteTrips);
  const canConfirm = canConfirmPermanentDelete(
    { ackCannotUndo, extraBookingConfirm },
    deleteTrips
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permanent-delete-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100">
        <h3 id="permanent-delete-modal-title" className="font-display text-lg font-bold text-slate-900 mb-1.5">
          {title}
        </h3>
        <p className="text-slate-600 text-sm mb-4">{subtitle}</p>

        {keepTrips.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1.5">
              Keeping ({keepTrips.length}):
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {keepTrips.map((t) => (
                <div
                  key={t.id}
                  className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold truncate">{t.title || t.destination || 'Trip'}</span>
                  <span className="text-emerald-700 shrink-0">{formatDateRange(t.startDate, t.endDate)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">
            Deleting permanently ({deleteTrips.length}):
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {deleteTrips.map((trip) => {
              const m = getTripSummaryMetrics(trip, extrasByTripId[trip.id]);
              const expDisplay =
                m.expensesCount !== null
                  ? String(m.expensesCount)
                  : loadingExtras
                  ? 'Loading...'
                  : 'unknown';
              const chatDisplay = m.chatMessagesCount !== null ? String(m.chatMessagesCount) : 'unknown';

              return (
                <div
                  key={trip.id}
                  className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-xs text-slate-800 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-red-950">{trip.title || trip.destination || 'Untitled trip'}</p>
                      <p className="text-[11px] text-red-800">{formatDateRange(trip.startDate, trip.endDate)}</p>
                    </div>
                    {m.hasConfirmedDuffelBooking && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold shrink-0">
                        {m.flightBookingsCount} flight booking{m.flightBookingsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-red-200/70 text-[11px] text-red-900">
                    <span>
                      <strong className="font-semibold">{m.itemsCount}</strong> itinerary items
                    </span>
                    <span>
                      <strong className="font-semibold">{expDisplay}</strong> expenses
                    </span>
                    <span>
                      <strong className="font-semibold">{chatDisplay}</strong> chat messages
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-700 leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold text-red-800">What is removed permanently:</span>{' '}
            the selected trip itinerary/itineraries, AI chat history, expenses, packing data, and disruption alerts.
          </p>
          <p>
            <span className="font-semibold text-emerald-800">What is kept:</span>{' '}
            Flight bookings made through Travalastic and recorded bookings are kept in your Bookings history and NEVER deleted — they are only detached from the deleted trip.
          </p>
        </div>

        {reqs.requiresExtraBookingConfirm && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl mb-4 text-xs text-amber-950 space-y-2.5">
            <p className="font-bold text-amber-900">
              Confirmed Duffel flight booking warning
            </p>
            <p className="leading-relaxed">
              {reqs.duffelBookedTrips.length === 1
                ? `"${reqs.duffelBookedTrips[0].title || reqs.duffelBookedTrips[0].destination}" has a confirmed Duffel flight booking attached.`
                : `${reqs.duffelBookedTrips.length} selected trips have confirmed Duffel flight bookings attached.`}{' '}
              The booking will be kept safely in your Bookings page, but it will be detached from this trip.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={extraBookingConfirm}
                onChange={(e) => setExtraBookingConfirm(e.target.checked)}
                disabled={isDeleting}
                className="mt-0.5 rounded border-amber-400 text-amber-700 focus:ring-amber-600"
              />
              <span>
                I understand the confirmed flight booking will be kept but detached from the trip.
              </span>
            </label>
          </div>
        )}

        <label className="flex items-start gap-2.5 p-3 bg-red-50/50 border border-red-200 rounded-xl mb-4 text-xs text-red-900 font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ackCannotUndo}
            onChange={(e) => setAckCannotUndo(e.target.checked)}
            disabled={isDeleting}
            className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-600"
          />
          <span>I understand this can&apos;t be undone.</span>
        </label>

        {outcome && outcome.results.length > 0 && (
          <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
            <p className="font-semibold text-slate-800 mb-1">Deletion results:</p>
            {outcome.results.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between gap-2 ${
                  r.ok ? 'text-emerald-700' : 'text-red-700 font-medium'
                }`}
              >
                <span className="truncate">{r.title}</span>
                <span className="shrink-0">{r.ok ? 'Deleted' : `Failed: ${r.error || 'Error'}`}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!canConfirm || isDeleting}
            className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {isDeleting
              ? 'Deleting...'
              : confirmButtonLabel || `Delete ${deleteTrips.length} trip${deleteTrips.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
