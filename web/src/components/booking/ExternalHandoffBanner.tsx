import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import {
  clearExternalHandoff,
  getActiveExternalHandoff,
  type ExternalHandoffRecord,
} from '../../lib/handoff';

export default function ExternalHandoffBanner() {
  const { openBookingsWithPrefill } = useApp();
  const [handoff, setHandoff] = useState<ExternalHandoffRecord | null>(() =>
    getActiveExternalHandoff(Date.now())
  );

  const checkHandoff = useCallback(() => {
    setHandoff(getActiveExternalHandoff(Date.now()));
  }, []);

  useEffect(() => {
    checkHandoff();

    const onFocus = () => checkHandoff();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkHandoff();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkHandoff]);

  if (!handoff) return null;

  function handleSaveDetails() {
    if (!handoff) return;
    clearExternalHandoff();
    setHandoff(null);
    openBookingsWithPrefill({
      kind: handoff.kind,
      provider: handoff.providerLabel,
    });
  }

  function handleDismiss() {
    clearExternalHandoff();
    setHandoff(null);
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-[#111111] text-white border border-[#C9A96E]/50 p-4 shadow-2xl"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-[#C9A96E] uppercase tracking-wider mb-0.5">
            External Booking Check
          </p>
          <p className="text-sm font-medium text-white">
            Did you book {handoff.providerLabel}? Save it to Bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDetails}
            className="px-3.5 py-1.5 bg-[#C9A96E] hover:bg-[#B8985D] text-[#111111] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            style={{ borderRadius: '2px' }}
          >
            Save details
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3.5 py-1.5 border border-white/20 hover:bg-white/10 text-white/80 text-xs font-semibold transition-colors cursor-pointer"
            style={{ borderRadius: '2px' }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

