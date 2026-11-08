import { useState, useEffect, useRef } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import type { JourneyDay, GeneratedJourney } from '../../lib/itineraryAdapter';

export interface ChangeJourneyPanelProps {
  itineraryId: string | null;
  journey: GeneratedJourney;
  onItineraryUpdated: (updatedResponse: any, newPace?: string) => void;
}

interface ChangeItem {
  type: 'removed' | 'added' | 'moved';
  day: number;
  before?: string;
  after?: string;
  reason?: string;
}

interface PreviewMetrics {
  beforeKm: number;
  afterKm: number;
  label: string;
}

interface PreviewData {
  baseHash: string;
  seed?: number;
  changes: ChangeItem[];
  summary: string;
  metrics?: PreviewMetrics;
}

interface ActionConfig {
  label: string;
  action: 'slow_pace' | 'reduce_transit' | 'surprise_me' | string;
  icon: string;
  active: boolean;
}

const JOURNEY_ACTIONS: ActionConfig[] = [
  { label: 'Make it cheaper', action: 'cheaper', icon: '↓', active: false },
  { label: 'More luxurious', action: 'luxurious', icon: '✦', active: false },
  { label: 'Slow pace down', action: 'slow_pace', icon: '◌', active: true },
  { label: 'Add more food', action: 'morefood', icon: '🍜', active: false },
  { label: 'Add more culture', action: 'moreculture', icon: '🏛', active: false },
  { label: 'Add 2 days', action: 'add2days', icon: '+2', active: false },
  { label: 'Reduce transit', action: 'reduce_transit', icon: '⇢', active: true },
  { label: 'Surprise me', action: 'surprise_me', icon: '✨', active: true },
];

export default function ChangeJourneyPanel({
  itineraryId,
  journey,
  onItineraryUpdated,
}: ChangeJourneyPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Modal preview state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionConfig | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    showUndo: boolean;
    editId?: string;
  } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleActionClick = async (actionConfig: ActionConfig) => {
    if (!actionConfig.active || loadingAction) return;

    if (!itineraryId) {
      setPanelError('Please wait for the itinerary to finish saving before adjusting.');
      return;
    }

    setLoadingAction(actionConfig.action);
    setPanelError(null);
    setModalError(null);

    try {
      const data = await apiFetch<PreviewData>(
        `/itineraries/${itineraryId}/adjust/preview`,
        {
          method: 'POST',
          body: { action: actionConfig.action },
        }
      );

      setCurrentAction(actionConfig);
      setPreviewData(data);
      setIsModalOpen(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setPanelError(err.message);
        } else if (err.status === 409) {
          setPanelError('Your trip changed, preview again');
        } else {
          setPanelError(err.message || 'Failed to calculate changes.');
        }
      } else {
        setPanelError(err?.message || 'Failed to calculate changes. Please try again.');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApply = async () => {
    if (!itineraryId || !currentAction || !previewData || isApplying) return;

    setIsApplying(true);
    setModalError(null);

    try {
      const result = await apiFetch<any>(
        `/itineraries/${itineraryId}/adjust/apply`,
        {
          method: 'POST',
          body: {
            action: currentAction.action,
            seed: previewData.seed,
            baseHash: previewData.baseHash,
          },
        }
      );

      setIsModalOpen(false);
      onItineraryUpdated(result, result.pace);

      // Trigger Toast with Undo
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({
        message: 'Applied.',
        showUndo: true,
        editId: result.editId,
      });

      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 10000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setModalError('Your trip changed, preview again');
        } else if (err.status === 422) {
          setModalError(err.message);
        } else {
          setModalError(err.message || 'Failed to apply changes.');
        }
      } else {
        setModalError(err?.message || 'Failed to apply changes. Please try again.');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = async () => {
    if (!itineraryId || isUndoing) return;

    setIsUndoing(true);
    try {
      const undoResult = await apiFetch<any>(`/itineraries/${itineraryId}/undo`, {
        method: 'POST',
        body: toast?.editId ? { expectedEditId: toast.editId } : {},
      });

      onItineraryUpdated(undoResult, undoResult.pace);
      setToast({
        message: 'Plan restored.',
        showUndo: false,
      });

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 3000);
    } catch (err: any) {
      setToast({
        message: err?.message || 'Failed to undo.',
        showUndo: false,
      });
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">J</span>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Change my journey</h3>
        </div>

        {panelError && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between">
            <span>{panelError}</span>
            <button
              onClick={() => setPanelError(null)}
              className="text-amber-500 hover:text-amber-700 ml-2 font-bold"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {JOURNEY_ACTIONS.map((item) => {
            if (!item.active) {
              return (
                <button
                  key={item.action + item.label}
                  disabled
                  title="Coming next"
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 border border-slate-100 text-slate-400 text-xs font-medium rounded-lg opacity-50 cursor-not-allowed text-left transition-opacity"
                >
                  <span className="text-sm leading-none flex-shrink-0">{item.icon}</span>
                  <span className="leading-tight">{item.label}</span>
                </button>
              );
            }

            const isLoading = loadingAction === item.action;
            const isAnyLoading = Boolean(loadingAction);

            return (
              <button
                key={item.action + item.label}
                disabled={isAnyLoading}
                onClick={() => handleActionClick(item)}
                className={`flex items-center gap-1.5 px-2.5 py-2 border text-xs font-medium rounded-lg text-left transition-all ${
                  isAnyLoading
                    ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer shadow-xs'
                }`}
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0 mr-0.5" />
                ) : (
                  <span className="text-sm leading-none flex-shrink-0">{item.icon}</span>
                )}
                <span className="leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Modal: "Here's what would change" */}
      {isModalOpen && previewData && currentAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentAction.icon}</span>
                <h3 className="font-semibold text-slate-900 text-base">
                  Here's what would change
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Error inside modal */}
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
                <span>{modalError}</span>
                <button
                  onClick={() => setModalError(null)}
                  className="text-red-400 hover:text-red-600 font-bold ml-2"
                >
                  ×
                </button>
              </div>
            )}

            {/* Summary */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900 text-sm">
              <p className="font-medium">{previewData.summary}</p>
            </div>

            {/* Metrics (e.g. for reduce_transit) */}
            {previewData.metrics && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>Transit Distance</span>
                  <span>
                    {previewData.metrics.beforeKm} km → {previewData.metrics.afterKm} km
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  {previewData.metrics.label}
                </p>
              </div>
            )}

            {/* Changes list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Proposed Changes ({previewData.changes.length})
              </p>
              {previewData.changes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No modifications necessary.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {previewData.changes.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs flex items-start gap-2.5"
                    >
                      {ch.type === 'removed' && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-700 shrink-0">
                          − Remove
                        </span>
                      )}
                      {ch.type === 'added' && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-700 shrink-0">
                          + Add
                        </span>
                      )}
                      {ch.type === 'moved' && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-700 shrink-0">
                          ⇄ Reorder
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          Day {ch.day}: {ch.type === 'removed' ? ch.before : ch.type === 'added' ? ch.after : `${ch.before} → ${ch.after}`}
                        </p>
                        {ch.reason && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {ch.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isApplying}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
              >
                {isApplying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Apply</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification with Undo */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-800 text-sm animate-fade-in">
          <span>{toast.message}</span>
          {toast.showUndo && (
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-semibold text-xs rounded-lg transition-colors border border-slate-700 flex items-center gap-1"
            >
              {isUndoing ? (
                <>
                  <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Restoring...</span>
                </>
              ) : (
                <span>Undo</span>
              )}
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white text-base ml-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

