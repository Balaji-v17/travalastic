import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { searchCuratedRoutes, type CuratedRouteItem } from '../../lib/bookingsApi';
import {
  buildRailBusUrl,
  getRailBusDisclosure,
  getRailBusProviderLabel,
  type RailBusMode,
} from '../../lib/railBusLinks';
import { rememberExternalHandoff } from '../../lib/handoff';

const QUICK_PAIRS = [
  { o: 'Bengaluru', d: 'Goa' },
  { o: 'Mumbai', d: 'Pune' },
  { o: 'Delhi', d: 'Jaipur' },
];

export default function TrainsAndBusesPanel({ mode }: { mode: RailBusMode }) {
  const { railBusPrefill } = useApp();

  const [origin, setOrigin] = useState<string>(() => railBusPrefill?.origin || 'Bengaluru');
  const [destination, setDestination] = useState<string>(() => railBusPrefill?.destination || 'Goa');
  const [loading, setLoading] = useState<boolean>(false);
  const [routes, setRoutes] = useState<CuratedRouteItem[] | null>(null);
  const [serverBookingUrl, setServerBookingUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchedPair, setSearchedPair] = useState<{ origin: string; destination: string } | null>(null);

  useEffect(() => {
    if (railBusPrefill?.origin) setOrigin(railBusPrefill.origin);
    if (railBusPrefill?.destination) setDestination(railBusPrefill.destination);
  }, [railBusPrefill]);

  const providerLabel = getRailBusProviderLabel(mode);
  const disclosure = getRailBusDisclosure(mode);
  const targetUrl = buildRailBusUrl(mode, serverBookingUrl);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanOrigin = origin.trim();
    const cleanDest = destination.trim();

    if (!cleanOrigin) {
      setErrorMessage('Please enter an origin city.');
      return;
    }
    if (!cleanDest) {
      setErrorMessage('Please enter a destination city.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    setRoutes(null);
    setServerBookingUrl(null);
    setSearchedPair({ origin: cleanOrigin, destination: cleanDest });

    try {
      const res = await searchCuratedRoutes({
        mode,
        origin: cleanOrigin,
        destination: cleanDest,
      });
      setRoutes(Array.isArray(res.routes) ? res.routes : []);
      setServerBookingUrl(res.bookingLinkUrl || null);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to load curated routes right now. You can still open the official booking portal below.'
      );
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-[#E8E4DC] p-6 sm:p-8 shadow-sm space-y-5" style={{ borderRadius: '2px' }}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C9A96E] mb-1">
            {mode === 'train' ? 'Indian Railways' : 'Intercity Coaches'}
          </p>
          <h2 className="font-serif text-xl sm:text-2xl text-[#111111]">
            {mode === 'train' ? 'Trains via IRCTC' : 'Buses via RedBus'}
          </h2>
          <p className="text-xs text-[#77736C] mt-1 leading-relaxed">
            Discover curated intercity routes, then continue to {providerLabel} to check live availability and book tickets.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between" style={{ borderRadius: '2px' }}>
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage('')} className="underline ml-3 font-semibold">
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Origin City
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Bengaluru, Mumbai, Delhi"
                className="w-full px-3.5 py-2.5 border border-[#E8E4DC] text-sm text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                style={{ borderRadius: '2px' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Destination City
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Goa, Pune, Jaipur"
                className="w-full px-3.5 py-2.5 border border-[#E8E4DC] text-sm text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                style={{ borderRadius: '2px' }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#77736C]">Popular routes:</span>
            {QUICK_PAIRS.map((p) => (
              <button
                key={`${p.o}-${p.d}`}
                type="button"
                onClick={() => {
                  setOrigin(p.o);
                  setDestination(p.d);
                }}
                className="px-2.5 py-1 text-xs border border-[#E8E4DC] bg-[#F7F5F0] hover:bg-[#EDE9E0] text-[#111111] transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                {p.o} → {p.d}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#111111] hover:bg-[#252525] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            style={{ borderRadius: '2px' }}
          >
            {loading ? 'Checking curated routes…' : `Find ${mode === 'train' ? 'train' : 'bus'} routes`}
          </button>
        </form>
      </div>

      {/* Curated Routes Output */}
      {routes !== null && searchedPair && (
        <div className="space-y-4">
          {routes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#77736C]">
                Curated {mode === 'train' ? 'Rail' : 'Bus'} Connections ({searchedPair.origin} → {searchedPair.destination})
              </p>
              {routes.map((r, i) => (
                <div
                  key={r._id || i}
                  className="bg-white border border-[#E8E4DC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ borderRadius: '2px' }}
                >
                  <div>
                    <p className="font-semibold text-sm text-[#111111]">
                      {r.name || `${r.origin} → ${r.destination}`}
                    </p>
                    <p className="text-xs text-[#77736C] mt-0.5">
                      {[
                        r.approxDurationHours ? `~${r.approxDurationHours}h` : null,
                        r.frequency || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {r.note && <p className="text-xs text-[#55524C] mt-1">{r.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-[#E8E4DC] p-5 text-xs text-[#77736C]" style={{ borderRadius: '2px' }}>
              No editorial schedule listed for {searchedPair.origin} → {searchedPair.destination}, but live tickets are available directly on {providerLabel}.
            </div>
          )}
        </div>
      )}

      {/* Honest Official Portal Card */}
      <div className="bg-white border border-[#E8E4DC] p-6 space-y-4 shadow-sm" style={{ borderRadius: '2px' }}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-base text-[#111111]">
            {mode === 'train' ? 'IRCTC NextGen' : 'RedBus India'}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#F7F5F0] text-[#77736C] px-2.5 py-1 border border-[#E8E4DC]">
            Official Portal
          </span>
        </div>

        <p className="text-xs text-[#55524C] leading-relaxed">{disclosure.detail}</p>

        <div className="space-y-2 pt-1">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => rememberExternalHandoff(mode, providerLabel)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] hover:bg-[#252525] text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <span>Search on {providerLabel}</span>
            <span>↗</span>
          </a>
          <p className="text-center text-xs font-medium text-[#77736C]">
            {disclosure.headline}
          </p>
        </div>
      </div>
    </div>
  );
}

