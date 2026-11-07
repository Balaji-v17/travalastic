import React, { useState } from 'react';
import { simulateDisruptionApi } from '../../lib/disruptionsApi';
import { formatDelay } from '../../lib/disruptionView';

interface SimulateDelayControlProps {
  itineraryId: string;
  days?: Array<{ day?: number; dayNumber?: number } | any>;
  onSimulated: (disruptionId: string) => void;
}

export default function SimulateDelayControl({
  itineraryId,
  days = [],
  onSimulated,
}: SimulateDelayControlProps) {
  const isSimulatorEnabled = import.meta.env?.VITE_ENABLE_SIMULATOR === 'true';

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedDelay, setSelectedDelay] = useState<number>(120);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isSimulatorEnabled) {
    return null;
  }

  const availableDays: number[] =
    Array.isArray(days) && days.length > 0
      ? days.map((d, idx) => Number(d?.day ?? d?.dayNumber ?? idx + 1))
      : [1, 2, 3];

  const handleOpen = () => {
    setErrorMessage(null);
    setSelectedDay(availableDays[0] || 1);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await simulateDisruptionApi({
        itineraryId,
        dayNumber: selectedDay,
        delayMinutes: selectedDelay,
      });

      const disruptionId = res?.disruptionId || res?.id || res?.disruption?._id;
      setIsOpen(false);

      if (disruptionId) {
        onSimulated(String(disruptionId));
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.code === 'not_found') {
        setErrorMessage("The simulator isn't enabled on this server.");
      } else {
        setErrorMessage(err?.message || 'Could not simulate disruption.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Demo tools trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors shadow-2xs"
        aria-label="Open demo tools: simulate a flight delay"
      >
        <span>🧪</span>
        <span>Demo tools: Simulate delay</span>
      </button>

      {/* Simulator Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) {
              handleClose();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulate-delay-title"
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🧪</span>
                <h3 id="simulate-delay-title" className="font-semibold text-slate-900 text-base">
                  Simulate a flight delay
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                Demo tool. Creates a SIMULATED disruption. Not a real airline event.
              </div>

              {errorMessage && (
                <div
                  aria-live="polite"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
                >
                  {errorMessage}
                </div>
              )}

              {/* Day selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Day
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableDays.map((d) => (
                    <button
                      key={`sim-day-${d}`}
                      type="button"
                      disabled={loading}
                      onClick={() => setSelectedDay(d)}
                      className={`px-3.5 py-2 min-h-[44px] text-xs font-semibold rounded-xl border transition-colors ${
                        selectedDay === d
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Day {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delay duration chips */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Delay Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 90, 120, 200].map((mins) => (
                    <button
                      key={`sim-delay-${mins}`}
                      type="button"
                      disabled={loading}
                      onClick={() => setSelectedDelay(mins)}
                      className={`px-3 py-2 min-h-[44px] text-xs font-semibold rounded-xl border transition-colors ${
                        selectedDelay === mins
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {formatDelay(mins)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Simulating…' : 'Simulate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

