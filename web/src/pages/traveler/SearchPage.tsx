import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { hotels, activities } from '../../data/mockData';
import { SHOW_SAMPLE_PAGES, FLIGHTS_TEST_MODE } from '../../config/features';
import { searchFlights } from '../../lib/flightsApi';
import {
  toFlightOffer,
  filterOffers,
  sortOffers,
  formatLocalTime,
  formatDateLabel,
  formatDuration,
  formatMoney,
  layoverMinutes,
  type FlightOffer,
  type StopsFilter,
  type DepartureTimeBand,
  type FlightSortKey,
} from '../../lib/flightAdapter';
import AirportInput from '../../components/flights/AirportInput';
import SampleDataBanner from '../../components/common/SampleDataBanner';

type SearchTab = 'flights' | 'hotels' | 'experiences';
type HotelSortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'reviews';
type ExperienceDuration = 'under2h' | 'halfday' | 'fullday';

function getTodayLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Destination keyword → normalised id map (for sample hotels/activities) ──
const destKeywords: Record<string, string> = {
  tokyo: 'tokyo', japan: 'tokyo',
  bali: 'bali', ubud: 'bali', seminyak: 'bali', indonesia: 'bali',
  paris: 'paris', france: 'paris',
  dubai: 'dubai', uae: 'dubai',
  maldives: 'maldives',
};

function matchesDest(text: string | undefined, query: string): boolean {
  if (!text) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  for (const [kw, id] of Object.entries(destKeywords)) {
    if (q.includes(kw) && t.includes(id)) return true;
    if (q.includes(id) && t.includes(kw)) return true;
  }
  return false;
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="bg-white border border-[#E8E4DC] p-5 animate-pulse"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F7F5F0] rounded" />
          <div className="space-y-2">
            <div className="h-4 bg-[#F7F5F0] rounded w-28" />
            <div className="h-3 bg-[#F7F5F0] rounded w-16" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="h-5 bg-[#F7F5F0] rounded w-20" />
          <div className="h-3 bg-[#F7F5F0] rounded w-14" />
        </div>
      </div>
      <div className="h-16 bg-[#FAFAF8] rounded mb-3" />
      <div className="h-4 bg-[#F7F5F0] rounded w-1/3" />
    </div>
  );
}

// ─── Real Flight Card ─────────────────────────────────────────────────────────
function RealFlightCard({
  offer,
  adults,
  onSelect,
}: {
  offer: FlightOffer;
  adults: number;
  onSelect: () => void;
}) {
  const depTime = formatLocalTime(offer.departureTime);
  const arrTime = formatLocalTime(offer.arrivalTime);
  const depDate = formatDateLabel(offer.departureTime);
  const arrDate = formatDateLabel(offer.arrivalTime);

  const firstSlice = offer.slices[0];
  const segments = firstSlice?.segments || [];
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  // Layover info for 1-stop flights
  let layoverSummary: string | null = null;
  if (segments.length === 2) {
    const mins = layoverMinutes(
      segments[0].arrivingAt,
      segments[1].departingAt,
      segments[0].destinationIata,
      segments[1].originIata
    );
    if (mins != null) {
      layoverSummary = `${segments[0].destinationIata} (${formatDuration(mins)})`;
    }
  }

  const originCode = firstSeg?.originIata || offer.originIata;
  const destCode = lastSeg?.destinationIata || offer.destinationIata;

  return (
    <div
      onClick={onSelect}
      className="bg-white border border-[#E8E4DC] hover:border-[#C9A96E] p-5 cursor-pointer transition-all hover:shadow-md group"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 bg-[#111111] text-[#C9A96E] font-bold text-xs flex items-center justify-center tracking-wider"
            style={{ borderRadius: '2px' }}
          >
            {offer.carrier.code || offer.carrier.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[#111111] text-sm group-hover:text-[#C9A96E] transition-colors">
              {offer.carrier.name}
            </p>
            {offer.flightNumbers.length > 0 && (
              <p className="text-[#77736C] text-xs font-mono">
                {offer.flightNumbers.join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-display font-bold text-[#111111]">
            {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency)}
          </p>
          <p className="text-[11px] text-[#77736C]">
            {offer.perAdultApprox
              ? `${formatMoney(offer.perAdultApprox.amount, offer.perAdultApprox.currency)} approx. per traveler`
              : `Total for ${adults} traveler${adults > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 bg-[#FAFAF8] border border-[#E8E4DC]/60 rounded p-3.5">
        <div>
          <p className="text-2xl font-bold font-mono text-[#111111]">{originCode}</p>
          <p className="text-xs font-semibold text-[#111111] mt-0.5">{depTime}</p>
          {depDate && <p className="text-[10px] text-[#77736C]">{depDate}</p>}
        </div>
        <div className="flex-1 flex flex-col items-center">
          <p className="text-xs text-[#77736C] mb-1 font-medium">
            {formatDuration(offer.durationMinutes)}
          </p>
          <div className="w-full flex items-center gap-1.5">
            <div className="flex-1 h-px bg-[#E8E4DC]" />
            <span className="text-xs text-[#C9A96E]">✈</span>
            <div className="flex-1 h-px bg-[#E8E4DC]" />
          </div>
          <p className="text-[11px] text-[#77736C] mt-1 font-medium">
            {offer.stops === 0 ? (
              'Non-stop'
            ) : (
              <span>
                {offer.stops} stop{offer.stops > 1 ? 's' : ''}{' '}
                {layoverSummary ? `via ${layoverSummary}` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-[#111111]">{destCode}</p>
          <p className="text-xs font-semibold text-[#111111] mt-0.5">{arrTime}</p>
          {arrDate && <p className="text-[10px] text-[#77736C]">{arrDate}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC] text-xs">
        <div className="flex items-center gap-3 text-[#77736C]">
          {offer.baggage && (
            <span className="inline-flex items-center gap-1">
              <span>🧳</span> {offer.baggage}
            </span>
          )}
          {offer.refundConditions && (
            <span className="inline-flex items-center gap-1">
              <span>📋</span> {offer.refundConditions}
            </span>
          )}
        </div>
        <span className="text-[#C9A96E] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          View details <span>→</span>
        </span>
      </div>
    </div>
  );
}

// ─── Hotel Card (sample) ──────────────────────────────────────────────────────
function HotelCard({ hotel, onSelect }: { hotel: typeof hotels[0]; onSelect: () => void }) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-xl overflow-hidden hover:shadow-lg transition-all group">
      <div className="h-48 bg-slate-100 overflow-hidden relative">
        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-900">{hotel.name}</h3>
        <p className="text-slate-500 text-xs mt-0.5">{hotel.location}</p>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
          <span className="text-base font-bold text-slate-900">₹{hotel.pricePerNight.toLocaleString()}<span className="text-xs font-normal text-slate-500">/night</span></span>
          <button onClick={onSelect} className="px-4 py-1.5 bg-[#111111] text-white text-xs font-semibold rounded hover:bg-[#252525]">
            View hotel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Card (sample) ───────────────────────────────────────────────────
function ActivityCard({ activity, onSelect }: { activity: typeof activities[0]; onSelect: () => void }) {
  return (
    <div className="bg-white border border-[#E8E4DC] rounded-xl overflow-hidden hover:shadow-lg transition-all group">
      <div className="h-44 bg-slate-100 overflow-hidden relative">
        <img src={activity.imageUrl} alt={activity.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-900">{activity.name}</h3>
        <p className="text-slate-500 text-xs mt-0.5">{activity.duration} · {activity.destination}</p>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
          <span className="text-base font-bold text-slate-900">₹{activity.price.toLocaleString()}</span>
          <button onClick={onSelect} className="px-4 py-1.5 bg-[#111111] text-white text-xs font-semibold rounded hover:bg-[#252525]">
            View experience
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Label ─────────────────────────────────────────────────────────────
function FilterLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[#77736C] uppercase tracking-wider mb-2.5">{children}</p>;
}

// ─── Main Search Page ─────────────────────────────────────────────────────────
export default function SearchPage() {
  const {
    searchQuery,
    setSearchQuery,
    openOffer,
    navigateToHotel,
    navigateToExperience,
  } = useApp();

  const [tab, setTab] = useState<SearchTab>(() => {
    if (!SHOW_SAMPLE_PAGES) return 'flights';
    return (searchQuery.type === 'experiences' ? 'experiences' : searchQuery.type === 'hotels' ? 'hotels' : 'flights') as SearchTab;
  });

  // Flight form state
  const [originIata, setOriginIata] = useState<string | null>(() => searchQuery.from || null);
  const [destIata, setDestIata] = useState<string | null>(() => {
    if (searchQuery.destinationId && /^[A-Za-z]{3}$/.test(searchQuery.destinationId)) {
      return searchQuery.destinationId.toUpperCase();
    }
    if (searchQuery.destination && /^[A-Za-z]{3}$/.test(searchQuery.destination)) {
      return searchQuery.destination.toUpperCase();
    }
    return null;
  });

  const [departureDate, setDepartureDate] = useState<string>(() => {
    if (searchQuery.dates && /^\d{4}-\d{2}-\d{2}$/.test(searchQuery.dates)) {
      return searchQuery.dates;
    }
    return '';
  });
  const [adults, setAdults] = useState<number>(() => Math.max(1, Math.min(9, searchQuery.travelers || 1)));

  // Flight results state
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'results' | 'empty' | 'error'>('idle');
  const [rawOffers, setRawOffers] = useState<FlightOffer[]>([]);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string>('');
  const [formValidationError, setFormValidationError] = useState<string>('');

  // Flight filter & sort state
  const [flightSort, setFlightSort] = useState<FlightSortKey>('cheapest');
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>('any');
  const [airlineFilters, setAirlineFilters] = useState<string[]>([]);
  const [timeBandFilters, setTimeBandFilters] = useState<DepartureTimeBand[]>([]);
  const [minPriceInput, setMinPriceInput] = useState<string>('');
  const [maxPriceInput, setMaxPriceInput] = useState<string>('');

  // Mobile filters sheet
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Auto-search once when navigated from Home with complete parameters
  const autoSearchRef = useRef(false);
  useEffect(() => {
    if (
      !autoSearchRef.current &&
      originIata &&
      destIata &&
      departureDate &&
      originIata !== destIata
    ) {
      autoSearchRef.current = true;
      executeFlightSearch();
    }
  }, [originIata, destIata, departureDate]);

  const todayLocalDate = useMemo(() => getTodayLocalDate(), []);

  // Execute Flight Search
  const executeFlightSearch = async () => {
    setFormValidationError('');
    setSearchErrorMessage('');

    if (!originIata) {
      setFormValidationError('Please choose a departure airport from the suggestions.');
      return;
    }
    if (!destIata) {
      setFormValidationError('Please choose an arrival airport from the suggestions.');
      return;
    }
    if (originIata === destIata) {
      setFormValidationError('Origin and destination cannot be the same airport.');
      return;
    }
    if (!departureDate) {
      setFormValidationError('Please choose a departure date.');
      return;
    }
    if (departureDate < todayLocalDate) {
      setFormValidationError('Departure date cannot be in the past.');
      return;
    }

    setSearchStatus('loading');
    setRawOffers([]);

    try {
      const data = await searchFlights({
        origin: originIata,
        destination: destIata,
        departureDate,
        adults,
      });

      const normalized = (data || []).map((raw) =>
        toFlightOffer(raw, { origin: originIata, destination: destIata, adults })
      );

      if (normalized.length === 0) {
        setSearchStatus('empty');
      } else {
        setRawOffers(normalized);
        setSearchStatus('results');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to search flights. Please try again.';
      setSearchErrorMessage(msg);
      setSearchStatus('error');
    }
  };

  // Derive unique airlines dynamically from real search results
  const availableAirlines = useMemo(() => {
    const set = new Set<string>();
    for (const o of rawOffers) {
      if (o.carrier.name) set.add(o.carrier.name);
    }
    return Array.from(set).sort();
  }, [rawOffers]);

  // Filtered & sorted flight offers
  const displayedFlights = useMemo(() => {
    const minP = minPriceInput ? parseFloat(minPriceInput) : null;
    const maxP = maxPriceInput ? parseFloat(maxPriceInput) : null;

    const filtered = filterOffers(rawOffers, {
      stops: stopsFilter,
      airlines: airlineFilters,
      minPrice: isNaN(minP as number) ? null : minP,
      maxPrice: isNaN(maxP as number) ? null : maxP,
      timeBands: timeBandFilters,
    });

    return sortOffers(filtered, flightSort);
  }, [rawOffers, stopsFilter, airlineFilters, minPriceInput, maxPriceInput, timeBandFilters, flightSort]);

  const hasTestOffer = useMemo(() => {
    return rawOffers.some((o) => o.isTest);
  }, [rawOffers]);

  // Tab definitions
  const availableTabs: { key: SearchTab; label: string; icon: string }[] = useMemo(() => {
    if (!SHOW_SAMPLE_PAGES) {
      return [{ key: 'flights', label: 'Flights', icon: '✈' }];
    }
    return [
      { key: 'flights', label: 'Flights', icon: '✈' },
      { key: 'hotels', label: 'Hotels', icon: '🏨' },
      { key: 'experiences', label: 'Experiences', icon: '🎯' },
    ];
  }, []);

  const clearFlightFilters = () => {
    setStopsFilter('any');
    setAirlineFilters([]);
    setTimeBandFilters([]);
    setMinPriceInput('');
    setMaxPriceInput('');
  };

  const toggleAirline = (name: string) => {
    setAirlineFilters((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const toggleTimeBand = (band: DepartureTimeBand) => {
    setTimeBandFilters((prev) =>
      prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band]
    );
  };

  // ── Filters panel component ─────────────────────────────────────────────────
  function FiltersPanel() {
    return (
      <div className="space-y-6">
        {/* Stops Filter */}
        <div>
          <FilterLabel>Stops</FilterLabel>
          <div className="flex flex-col gap-1.5">
            {([
              ['any', 'Any stops'],
              ['nonstop', 'Non-stop only'],
              ['1stop', '1 stop'],
              ['2plus', '2+ stops'],
            ] as [StopsFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStopsFilter(val)}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 border text-xs transition-all ${
                  stopsFilter === val
                    ? 'bg-[#111111] text-white border-[#111111] font-semibold'
                    : 'border-[#E8E4DC] text-[#252525] hover:bg-[#F7F5F0]'
                }`}
                style={{ borderRadius: '2px' }}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    stopsFilter === val ? 'border-white' : 'border-[#A8A49C]'
                  }`}
                >
                  {stopsFilter === val && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Airlines Filter */}
        {availableAirlines.length > 0 && (
          <div>
            <FilterLabel>Airlines ({availableAirlines.length})</FilterLabel>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {availableAirlines.map((airline) => (
                <label key={airline} className="flex items-center gap-2.5 cursor-pointer text-xs text-[#252525] hover:text-[#111111]">
                  <input
                    type="checkbox"
                    className="accent-[#111111]"
                    checked={airlineFilters.includes(airline)}
                    onChange={() => toggleAirline(airline)}
                  />
                  <span>{airline}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Departure Time Bands Filter */}
        <div>
          <FilterLabel>Departure Time</FilterLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ['morning', '🌅 Morning', '05:00 – 11:59'],
              ['afternoon', '☀️ Afternoon', '12:00 – 17:59'],
              ['evening', '🌆 Evening', '18:00 – 21:59'],
              ['night', '🌙 Night', '22:00 – 04:59'],
            ] as [DepartureTimeBand, string, string][]).map(([band, label, range]) => {
              const active = timeBandFilters.includes(band);
              return (
                <button
                  key={band}
                  type="button"
                  onClick={() => toggleTimeBand(band)}
                  className={`p-2 text-left border text-xs transition-all ${
                    active
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'border-[#E8E4DC] text-[#252525] hover:bg-[#F7F5F0]'
                  }`}
                  style={{ borderRadius: '2px' }}
                >
                  <p className="font-medium truncate">{label}</p>
                  <p className={`text-[10px] ${active ? 'text-white/70' : 'text-[#77736C]'}`}>{range}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Range Filter */}
        <div>
          <FilterLabel>Price Range</FilterLabel>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111] bg-white outline-none focus:border-[#111111]"
              style={{ borderRadius: '2px' }}
            />
            <input
              type="number"
              placeholder="Max"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111] bg-white outline-none focus:border-[#111111]"
              style={{ borderRadius: '2px' }}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <button
          type="button"
          onClick={clearFlightFilters}
          className="w-full py-2 border border-[#E8E4DC] text-xs font-semibold text-[#77736C] hover:text-[#111111] hover:bg-[#F7F5F0] transition-colors"
          style={{ borderRadius: '2px' }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Tab Switcher ── */}
        {availableTabs.length > 1 && (
          <div className="flex gap-1 bg-white border border-[#E8E4DC] p-1 w-fit" style={{ borderRadius: '2px' }}>
            {availableTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  tab === t.key
                    ? 'bg-[#111111] text-white shadow-sm'
                    : 'text-[#77736C] hover:text-[#111111]'
                }`}
                style={{ borderRadius: '2px' }}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Flight Search Form ── */}
        {tab === 'flights' && (
          <div className="bg-white border border-[#E8E4DC] p-6 shadow-sm" style={{ borderRadius: '2px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <AirportInput
                label="From"
                value={originIata}
                onChange={(code) => setOriginIata(code)}
                placeholder="Origin airport or city"
              />
              <AirportInput
                label="To"
                value={destIata}
                onChange={(code) => setDestIata(code)}
                placeholder="Destination airport or city"
              />
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-[#77736C] mb-1.5">
                  Departure Date
                </label>
                <input
                  type="date"
                  min={todayLocalDate}
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E8E4DC] text-sm text-[#111111] focus:border-[#C9A96E] outline-none"
                  style={{ borderRadius: '2px' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-[#77736C] mb-1.5">
                  Travelers
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E8E4DC] text-sm text-[#111111] focus:border-[#C9A96E] outline-none cursor-pointer"
                  style={{ borderRadius: '2px' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n} adult{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formValidationError && (
              <p className="mt-3 text-xs text-rose-600 font-medium animate-fade-in">
                ⚠️ {formValidationError}
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-[#E8E4DC] flex justify-end">
              <button
                type="button"
                onClick={executeFlightSearch}
                disabled={searchStatus === 'loading'}
                className="px-8 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#252525] transition-colors disabled:opacity-50"
                style={{ borderRadius: '2px' }}
              >
                {searchStatus === 'loading' ? 'Searching…' : 'Search Flights'}
              </button>
            </div>
          </div>
        )}

        {/* ── Sample Tabs (Hotels & Experiences) with Local Sample Banner ── */}
        {tab !== 'flights' && (
          <div className="space-y-4">
            <SampleDataBanner />
            {tab === 'hotels' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {hotels.map((h) => (
                  <HotelCard key={h.id} hotel={h} onSelect={() => navigateToHotel(h.id)} />
                ))}
              </div>
            )}
            {tab === 'experiences' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((a) => (
                  <ActivityCard key={a.id} activity={a} onSelect={() => navigateToExperience(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Flight Results Section ── */}
        {tab === 'flights' && (
          <>
            {/* Test Fares Notice */}
            {(hasTestOffer || FLIGHTS_TEST_MODE) && searchStatus === 'results' && (
              <div
                className="p-3.5 bg-[#FFF9F0] border border-[#C9A96E]/40 text-[#6B5324] text-xs font-medium flex items-center gap-2.5 animate-fade-in"
                style={{ borderRadius: '2px' }}
              >
                <span className="text-sm">🧪</span>
                <span>
                  <strong>Test fares:</strong> These are sandbox fares from our test airline connection. No real tickets are issued.
                </span>
              </div>
            )}

            {/* Results Header bar */}
            {searchStatus === 'results' && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm font-semibold text-[#111111]">
                  {displayedFlights.length} flight{displayedFlights.length !== 1 ? 's' : ''} found
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(true)}
                    className="lg:hidden px-3.5 py-1.5 border border-[#E8E4DC] text-xs font-semibold text-[#111111] bg-white"
                    style={{ borderRadius: '2px' }}
                  >
                    Filters
                  </button>

                  <div className="flex items-center gap-2 bg-white border border-[#E8E4DC] px-3 py-1.5" style={{ borderRadius: '2px' }}>
                    <span className="text-xs text-[#77736C]">Sort by:</span>
                    <select
                      value={flightSort}
                      onChange={(e) => setFlightSort(e.target.value as FlightSortKey)}
                      className="text-xs font-semibold text-[#111111] bg-transparent outline-none cursor-pointer"
                    >
                      <option value="cheapest">Cheapest</option>
                      <option value="fastest">Fastest</option>
                      <option value="earliest">Earliest Departure</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area: Sidebar + Grid */}
            <div className="flex gap-6 items-start">
              {/* Desktop Sidebar Filters */}
              {searchStatus === 'results' && (
                <aside className="hidden lg:block w-64 shrink-0">
                  <div className="bg-white border border-[#E8E4DC] p-5 sticky top-20" style={{ borderRadius: '2px' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display text-sm font-bold text-[#111111]">Filters</h2>
                    </div>
                    <FiltersPanel />
                  </div>
                </aside>
              )}

              {/* Center Results Pane */}
              <div className="flex-1 min-w-0">
                {/* Idle State */}
                {searchStatus === 'idle' && (
                  <div
                    className="bg-white border border-[#E8E4DC] p-12 text-center text-[#77736C]"
                    style={{ borderRadius: '2px' }}
                  >
                    <div className="text-3xl mb-3">✈</div>
                    <h3 className="font-display text-lg font-bold text-[#111111] mb-1">
                      Choose where you're going to see real fares
                    </h3>
                    <p className="text-xs max-w-sm mx-auto text-[#77736C]">
                      Select an origin airport, destination airport, and departure date to query global airline availability.
                    </p>
                  </div>
                )}

                {/* Loading State (Skeletons) */}
                {searchStatus === 'loading' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 text-xs text-[#77736C] font-medium py-1">
                      <div className="w-3.5 h-3.5 border-2 border-[#E8E4DC] border-t-[#111111] rounded-full animate-spin" />
                      <span>Searching airlines…</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {searchStatus === 'empty' && (
                  <div
                    className="bg-white border border-[#E8E4DC] p-12 text-center text-[#77736C]"
                    style={{ borderRadius: '2px' }}
                  >
                    <div className="text-3xl mb-3">🛫</div>
                    <h3 className="font-display text-lg font-bold text-[#111111] mb-1">
                      No flights found
                    </h3>
                    <p className="text-xs max-w-sm mx-auto text-[#77736C] mb-4">
                      No flights found for these dates. Try nearby dates or airports.
                    </p>
                  </div>
                )}

                {/* Error State with Retry */}
                {searchStatus === 'error' && (
                  <div
                    className="bg-white border border-rose-200 p-8 text-center text-[#77736C]"
                    style={{ borderRadius: '2px' }}
                  >
                    <div className="text-3xl mb-2">⚠️</div>
                    <h3 className="font-display text-lg font-bold text-[#111111] mb-1">
                      Search could not be completed
                    </h3>
                    <p className="text-xs text-rose-600 mb-5 max-w-md mx-auto">
                      {searchErrorMessage}
                    </p>
                    <button
                      type="button"
                      onClick={executeFlightSearch}
                      className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#252525] transition-colors"
                      style={{ borderRadius: '2px' }}
                    >
                      Retry Search
                    </button>
                  </div>
                )}

                {/* Results List */}
                {searchStatus === 'results' && displayedFlights.length === 0 ? (
                  <div
                    className="bg-white border border-[#E8E4DC] p-10 text-center text-[#77736C]"
                    style={{ borderRadius: '2px' }}
                  >
                    <p className="text-sm font-semibold text-[#111111] mb-1">
                      No flights match your filter selection
                    </p>
                    <p className="text-xs mb-4">
                      Try clearing or loosening your stops, airline, or departure time filters.
                    </p>
                    <button
                      type="button"
                      onClick={clearFlightFilters}
                      className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold rounded"
                      style={{ borderRadius: '2px' }}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  searchStatus === 'results' && (
                    <div className="grid grid-cols-1 gap-4">
                      {displayedFlights.map((flight) => (
                        <RealFlightCard
                          key={flight.id}
                          offer={flight}
                          adults={adults}
                          onSelect={() => openOffer(flight)}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Mobile Filters Slide-over / Sheet */}
            {showMobileFilters && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => setShowMobileFilters(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-white max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
                  <div className="flex items-center justify-between pb-4 border-b border-[#E8E4DC] mb-4">
                    <h2 className="font-display font-bold text-base text-[#111111]">Filters</h2>
                    <button
                      onClick={() => setShowMobileFilters(false)}
                      className="text-sm font-bold text-[#77736C] hover:text-[#111111]"
                    >
                      ✕
                    </button>
                  </div>
                  <FiltersPanel />
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="w-full mt-6 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                    style={{ borderRadius: '2px' }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
