import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { apiFetch } from '../../lib/api';
import type { PlaceResult } from '../../lib/destinationView';
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_CHARS,
  buildGlobalSearchGroups,
  isExternalOpenStreetMapResult,
  isSlashShortcutTarget,
  nextSearchHighlightIndex,
  shouldTriggerTypeahead,
  type GlobalSearchPlaceItem,
  type TripSearchEntry,
} from '../../lib/globalSearch';

interface SearchResponsePayload {
  results?: PlaceResult[];
  destinations?: PlaceResult[];
  externalFallbackUsed?: boolean;
}

type FlatItem =
  | { type: 'trip'; trip: TripSearchEntry }
  | { type: 'place'; place: GlobalSearchPlaceItem };

export default function GlobalSearchOverlay() {
  const {
    isGlobalSearchOpen,
    globalSearchInitialQuery,
    openGlobalSearch,
    closeGlobalSearch,
    journeys,
    openPlace,
    navigate,
  } = useApp();
  const { status } = useAuth();
  const isSignedIn = status === 'authed';

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [usedExternalFallback, setUsedExternalFallback] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  // Global "/" shortcut to open overlay
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (isGlobalSearchOpen) return;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (isSlashShortcutTarget(target)) {
          e.preventDefault();
          openerRef.current = target;
          openGlobalSearch('');
        }
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [isGlobalSearchOpen, openGlobalSearch]);

  // Capture opener focus and initialize input when opening; restore focus when closing
  useEffect(() => {
    if (isGlobalSearchOpen) {
      if (
        !openerRef.current &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      ) {
        openerRef.current = document.activeElement;
      }
      setQuery(globalSearchInitialQuery || '');
      setPlaces([]);
      setErrorMsg('');
      setHasSearched(false);
      setUsedExternalFallback(false);
      setHighlightIndex(-1);

      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(t);
    }

    // Cleanup on close
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const restoreTarget =
      openerRef.current ||
      (document.querySelector('header button[aria-label="Search"]') as HTMLElement | null);
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
      restoreTarget.focus();
    }
    openerRef.current = null;
  }, [isGlobalSearchOpen, globalSearchInitialQuery]);

  async function executeSearch(searchTerm: string, allowExternalFallback: boolean) {
    const trimmed = searchTerm.trim();
    if (trimmed.length < GLOBAL_SEARCH_MIN_CHARS) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeqRef.current;

    setLoading(true);
    setErrorMsg('');

    try {
      const fallbackFlag = allowExternalFallback ? '1' : '0';
      const data = await apiFetch<SearchResponsePayload>(
        `/destinations/search?q=${encodeURIComponent(trimmed)}&fallback=${fallbackFlag}`,
        { signal: controller.signal }
      );

      if (seq !== requestSeqRef.current) return;

      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.destinations)
          ? data.destinations
          : [];
      setPlaces(list);
      setUsedExternalFallback(
        isExternalOpenStreetMapResult(list, Boolean(data?.externalFallbackUsed))
      );
      setHasSearched(true);
      setHighlightIndex(-1);
    } catch (err: unknown) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) {
        return;
      }
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
      if (name === 'AbortError') return;
      setPlaces([]);
      setUsedExternalFallback(false);
      setHasSearched(true);
      setErrorMsg("Couldn't search right now. Check your connection and try again.");
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }

  // Typeahead effect: min 3 chars, 400ms debounce, internal DB only (fallback=0)
  useEffect(() => {
    if (!isGlobalSearchOpen) return;
    const trimmed = query.trim();

    if (trimmed.length < GLOBAL_SEARCH_MIN_CHARS) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      requestSeqRef.current++;
      setLoading(false);
      setPlaces([]);
      setErrorMsg('');
      setHasSearched(false);
      setUsedExternalFallback(false);
      setHighlightIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(trimmed, false);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isGlobalSearchOpen]);

  const groups = useMemo(
    () =>
      buildGlobalSearchGroups({
        query,
        isSignedIn,
        trips: journeys,
        places,
      }),
    [query, isSignedIn, journeys, places]
  );

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const g of groups) {
      if (g.key === 'trips') {
        for (const trip of g.items) items.push({ type: 'trip', trip });
      } else {
        for (const place of g.items) items.push({ type: 'place', place });
      }
    }
    return items;
  }, [groups]);

  function selectFlatItem(item: FlatItem) {
    closeGlobalSearch();
    if (item.type === 'trip') {
      navigate('journey', { selectedJourneyId: item.trip.id });
    } else {
      openPlace(item.place.raw);
    }
  }

  // Dialog keyboard: Escape closes, Tab trap cycles focus inside dialog, Up/Down/Enter navigate results
  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeGlobalSearch();
      return;
    }

    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (flatItems.length > 0) {
        e.preventDefault();
        setHighlightIndex((prev) =>
          nextSearchHighlightIndex(prev, e.key, flatItems.length)
        );
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < flatItems.length) {
        selectFlatItem(flatItems[highlightIndex]);
      } else if (shouldTriggerTypeahead(query)) {
        executeSearch(query, true);
      }
    }
  }

  if (!isGlobalSearchOpen) return null;

  const ready = shouldTriggerTypeahead(query);
  const showEmpty = ready && !loading && !errorMsg && hasSearched && flatItems.length === 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeGlobalSearch();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-2xl bg-white border border-[#E8E4DC] shadow-2xl overflow-hidden"
        style={{ borderRadius: '2px' }}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E8E4DC] bg-[#FAFAF8]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="#77736C"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="5.5" />
            <path d="M13.5 13.5l2.5 2.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search places or your trips (type at least 3 characters)…"
            aria-label="Search places and trips"
            className="flex-1 bg-transparent text-sm sm:text-base text-[#111111] placeholder-[#77736C] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="px-2 py-1 text-xs font-medium text-[#77736C] hover:text-[#111111]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => closeGlobalSearch()}
            aria-label="Close search"
            className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#77736C] border border-[#E8E4DC] hover:text-[#111111] hover:bg-white transition-colors"
            style={{ borderRadius: '2px' }}
          >
            Esc
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
          {!ready && (
            <p className="text-xs text-[#77736C] py-4 text-center">
              Type at least {GLOBAL_SEARCH_MIN_CHARS} characters to search{isSignedIn ? ' your trips and ' : ' '}places. Press <kbd className="px-1.5 py-0.5 bg-[#F7F5F0] border border-[#E8E4DC] font-mono text-[11px]">Enter</kbd> to include OpenStreetMap worldwide results.
            </p>
          )}

          {ready && loading && (
            <p className="text-xs text-[#77736C] py-4 text-center">
              Searching…
            </p>
          )}

          {ready && !loading && errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {showEmpty && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm font-medium text-[#111111]">
                No matches for &ldquo;{query.trim()}&rdquo;
              </p>
              {!usedExternalFallback && (
                <button
                  type="button"
                  onClick={() => executeSearch(query, true)}
                  className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  Search places worldwide
                </button>
              )}
            </div>
          )}

          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736C] mb-2">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.key === 'trips' &&
                  group.items.map((trip) => {
                    const idx = flatItems.findIndex(
                      (f) => f.type === 'trip' && f.trip.id === trip.id
                    );
                    const isHi = idx === highlightIndex;
                    return (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => selectFlatItem({ type: 'trip', trip })}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors border ${
                          isHi
                            ? 'bg-[#F7F5F0] border-[#C9A96E]'
                            : 'bg-white border-transparent hover:bg-[#FAFAF8] hover:border-[#E8E4DC]'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111111] truncate">
                            {trip.title}
                          </p>
                          <p className="text-xs text-[#77736C] truncate">
                            {trip.destination}
                            {trip.startDate ? ` · ${trip.startDate}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-[#77736C] shrink-0">Open trip →</span>
                      </button>
                    );
                  })}

                {group.key === 'places' &&
                  group.items.map((place) => {
                    const idx = flatItems.findIndex(
                      (f) => f.type === 'place' && f.place.id === place.id
                    );
                    const isHi = idx === highlightIndex;
                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectFlatItem({ type: 'place', place })}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors border ${
                          isHi
                            ? 'bg-[#F7F5F0] border-[#C9A96E]'
                            : 'bg-white border-transparent hover:bg-[#FAFAF8] hover:border-[#E8E4DC]'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        {place.photoUrl && (
                          <img
                            src={place.photoUrl}
                            alt=""
                            className="w-10 h-10 object-cover shrink-0 border border-[#E8E4DC]"
                            style={{ borderRadius: '2px' }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#111111] truncate">
                            {place.name}
                          </p>
                          {place.subtitle && (
                            <p className="text-xs text-[#77736C] truncate">
                              {place.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-[#77736C] shrink-0">View →</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}

          {ready && !loading && !errorMsg && flatItems.length > 0 && !usedExternalFallback && (
            <div className="pt-2 border-t border-[#E8E4DC] flex items-center justify-between">
              <span className="text-[11px] text-[#77736C]">
                Showing Travalastic places{isSignedIn ? ' & your trips' : ''}.
              </span>
              <button
                type="button"
                onClick={() => executeSearch(query, true)}
                className="text-xs font-semibold text-[#111111] hover:text-[#C9A96E] transition-colors"
              >
                Search places worldwide →
              </button>
            </div>
          )}

          {usedExternalFallback && places.length > 0 && (
            <p className="pt-2 border-t border-[#E8E4DC] text-[11px] text-[#77736C]">
              Results from OpenStreetMap
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
