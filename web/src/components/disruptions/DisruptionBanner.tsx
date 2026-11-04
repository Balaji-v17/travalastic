import React, { useState, useEffect, useCallback } from 'react';
import { listDisruptionsApi, type DisruptionItem } from '../../lib/disruptionsApi';
import { formatDelay } from '../../lib/disruptionView';

interface DisruptionBannerProps {
  journeyId: string;
  onReview: (disruptionId: string) => void;
  refreshKey?: number;
  reviewButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function DisruptionBanner({
  journeyId,
  onReview,
  refreshKey = 0,
  reviewButtonRef,
}: DisruptionBannerProps) {
  const [activeDisruptions, setActiveDisruptions] = useState<DisruptionItem[]>([]);

  const fetchActiveDisruptions = useCallback(async () => {
    if (!journeyId) {
      setActiveDisruptions([]);
      return;
    }

    try {
      const list = await listDisruptionsApi();
      const filtered = list.filter((d) => {
        const matchesTrip = String(d.itineraryId) === String(journeyId);
        const isActiveStatus = d.status === 'new' || d.status === 'proposed';
        return matchesTrip && isActiveStatus;
      });
      setActiveDisruptions(filtered);
    } catch {
      // Fail softly: never render error banner or block JourneyPage
      setActiveDisruptions([]);
    }
  }, [journeyId]);

  useEffect(() => {
    fetchActiveDisruptions();
  }, [fetchActiveDisruptions, refreshKey]);

  if (activeDisruptions.length === 0) {
    return null;
  }

  const newest = activeDisruptions[0];
  const isSimulated = newest.simulated || newest.source === 'simulation';
  const delayStr =
    newest.details?.delayMinutes != null
      ? formatDelay(newest.details.delayMinutes)
      : '';
  const dayNumber = newest.dayNumber;

  const disruptionText =
    dayNumber && delayStr
      ? `Flight schedule change · Day ${dayNumber} · arrives about ${delayStr} later`
      : delayStr
      ? `Flight schedule change · arrives about ${delayStr} later`
      : dayNumber
      ? `Flight schedule change · Day ${dayNumber}`
      : 'Flight schedule change';

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xs animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
          ✈️
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              Travel Update
            </span>
            {isSimulated && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                SIMULATED
              </span>
            )}
            {activeDisruptions.length > 1 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                +{activeDisruptions.length - 1} more
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 text-base">{disruptionText}</h3>
          <p className="text-slate-600 text-sm mt-0.5">
            {isSimulated
              ? 'Demo delay simulated. Review proposed itinerary adjustments.'
              : 'Airline reported schedule change. Review proposed adjustments.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          ref={reviewButtonRef as any}
          type="button"
          onClick={() => onReview(newest.id)}
          className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs text-center flex items-center justify-center gap-1.5"
        >
          <span>Review</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

