import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { flights, hotels, activities } from '../../data/mockData';

type SearchTab = 'flights' | 'hotels' | 'experiences';
type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'reviews';
type StopsFilter = 'any' | 'nonstop' | '1stop';
type DepartureTime = 'morning' | 'afternoon' | 'evening' | 'night';
type ExperienceDuration = 'under2h' | 'halfday' | 'fullday';

// ─── Destination keyword → normalised id map ────────────────────────────────
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
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-48 bg-slate-200" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-5 bg-slate-200 rounded w-1/4" />
          <div className="h-8 bg-slate-200 rounded-lg w-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Flight card ─────────────────────────────────────────────────────────────
function FlightCard({ flight, onSelect }: { flight: typeof flights[0]; onSelect: () => void }) {
  const statusColors: Record<string, string> = {
    scheduled: 'bg-emerald-50 text-emerald-700',
    delayed: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    boarding: 'bg-blue-50 text-blue-700',
    departed: 'bg-slate-50 text-slate-600',
    landed: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-xs border border-blue-100">
            {flight.airline.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{flight.airline}</p>
            <p className="text-slate-400 text-xs font-mono">{flight.flightNumber}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900">₹{flight.price.toLocaleString()}</p>
          <p className="text-xs text-slate-500">per person</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 bg-slate-50 rounded-xl p-3">
        <div>
          <p className="text-2xl font-bold text-slate-900">{flight.fromCode}</p>
          <p className="text-xs text-slate-500 mt-0.5">{new Date(flight.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <p className="text-xs text-slate-400 mb-1.5">{flight.duration}</p>
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px bg-slate-300" />
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-blue-500">
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop`}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{flight.toCode}</p>
          <p className="text-xs text-slate-500 mt-0.5">{new Date(flight.arrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[flight.status] ?? 'bg-slate-100 text-slate-500'}`}>
            {flight.status}
          </span>
          <span className="text-xs text-slate-400">{flight.aircraft}</span>
          <span className={`text-xs font-medium ${flight.seatsLeft < 10 ? 'text-red-600' : 'text-slate-500'}`}>
            {flight.seatsLeft < 10 ? `Only ${flight.seatsLeft} seats left!` : `${flight.seatsLeft} seats`}
          </span>
        </div>
        <button
          onClick={onSelect}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors group-hover:shadow-md"
        >
          View flight
        </button>
      </div>
    </div>
  );
}

// ─── Hotel card ───────────────────────────────────────────────────────────────
function HotelCard({ hotel, onSelect }: { hotel: typeof hotels[0]; onSelect: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all group">
      <div className="h-48 bg-slate-100 overflow-hidden relative">
        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {hotel.availableRooms <= 3 && (
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow">
            Only {hotel.availableRooms} left!
          </span>
        )}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm">
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-xs">★</span>
            <span className="text-xs font-bold text-slate-800">{hotel.rating}</span>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="font-semibold text-slate-900 truncate">{hotel.name}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{hotel.address}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-slate-900">₹{hotel.pricePerNight.toLocaleString()}</p>
            <p className="text-xs text-slate-500">per night</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex">{Array.from({ length: hotel.stars }).map((_, i) => <span key={i} className="text-amber-400 text-xs">★</span>)}</div>
          <span className="text-xs text-slate-400">({hotel.reviewCount.toLocaleString()} reviews)</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hotel.amenities.slice(0, 4).map((a) => (
            <span key={a} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">{a}</span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-emerald-600 font-medium">{hotel.availableRooms} rooms available</span>
          <button
            onClick={onSelect}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors group-hover:shadow-md"
          >
            View hotel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity card ────────────────────────────────────────────────────────────
function ActivityCard({ activity, onSelect }: { activity: typeof activities[0]; onSelect: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all group">
      <div className="h-44 bg-slate-100 overflow-hidden relative">
        <img src={activity.imageUrl} alt={activity.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute bottom-3 left-3">
          <span className="text-xs font-semibold text-blue-700 bg-blue-50/90 backdrop-blur-sm px-2.5 py-1 rounded-full border border-blue-100 shadow-sm">{activity.category}</span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-900 mt-0.5">{activity.name}</h3>
        <p className="text-slate-500 text-xs mt-0.5">{activity.duration} · {activity.destination || activity.meetingPoint}</p>
        <p className="text-slate-600 text-sm leading-relaxed mt-2 line-clamp-2">{activity.description}</p>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-sm">★</span>
              <span className="text-sm font-semibold text-slate-800">{activity.rating}</span>
              <span className="text-xs text-slate-400">({activity.reviewCount.toLocaleString()})</span>
            </div>
            <p className="text-base font-bold text-slate-900 mt-0.5">₹{activity.price.toLocaleString()}<span className="text-xs font-normal text-slate-500">/person</span></p>
          </div>
          <button
            onClick={onSelect}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors group-hover:shadow-md"
          >
            View experience
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function FilterLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">{children}</p>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const { startBookingFlow, searchQuery, setSearchQuery, navigateToHotel, navigateToExperience, navigateToFlight } = useApp();
  const [tab, setTab] = useState<SearchTab>(
    (searchQuery.type === 'experiences' ? 'experiences' : searchQuery.type === 'hotels' ? 'hotels' : 'flights') as SearchTab
  );
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Price
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Flights
  const [stops, setStops] = useState<StopsFilter>('any');
  const [airlineFilter, setAirlineFilter] = useState<string[]>([]);
  const [departureTimes, setDepartureTimes] = useState<DepartureTime[]>([]);

  // Hotels
  const [minStars, setMinStars] = useState(0);
  const [cancellationFilter, setCancellationFilter] = useState<'free' | 'any'>('any');
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);

  // Experiences
  const [expDuration, setExpDuration] = useState<ExperienceDuration | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);

  const destName = searchQuery.destination || '';

  // Derived airline list from data
  const allAirlines = useMemo(() => [...new Set(flights.map((f) => f.airline))].sort(), []);
  const allCategories = useMemo(() => [...new Set(activities.map((a) => a.category))].sort(), []);

  // Loading simulation
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(t);
  }, [destName, tab]);

  // Clear tab-specific filters when switching tabs
  function clearFilters() {
    setMinPrice('');
    setMaxPrice('');
    setStops('any');
    setAirlineFilter([]);
    setDepartureTimes([]);
    setMinStars(0);
    setCancellationFilter('any');
    setAmenityFilter([]);
    setExpDuration('');
    setCategoryFilter([]);
    setMinRating(0);
  }

  function toggleArr<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredFlights = useMemo(() => {
    let result = flights.filter((f) => matchesDest(f.to, destName) || !destName);
    if (stops === 'nonstop') result = result.filter((f) => f.stops === 0);
    else if (stops === '1stop') result = result.filter((f) => f.stops === 1);
    if (airlineFilter.length > 0) result = result.filter((f) => airlineFilter.includes(f.airline));
    if (departureTimes.length > 0) {
      result = result.filter((f) => {
        const h = new Date(f.departureTime).getHours();
        return departureTimes.some((dt) => {
          if (dt === 'morning') return h >= 5 && h < 12;
          if (dt === 'afternoon') return h >= 12 && h < 17;
          if (dt === 'evening') return h >= 17 && h < 21;
          return h >= 21 || h < 5;
        });
      });
    }
    if (minPrice) result = result.filter((f) => f.price >= Number(minPrice));
    if (maxPrice) result = result.filter((f) => f.price <= Number(maxPrice));
    if (sortBy === 'price_asc') result = [...result].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') result = [...result].sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') result = [...result].sort((a, b) => (b.seatsLeft < a.seatsLeft ? 1 : -1));
    return result;
  }, [destName, stops, airlineFilter, departureTimes, minPrice, maxPrice, sortBy]);

  const filteredHotels = useMemo(() => {
    let result = hotels.filter((h) => matchesDest(h.destinationId, destName) || matchesDest(h.location, destName) || !destName);
    if (minStars > 0) result = result.filter((h) => h.stars >= minStars);
    if (minPrice) result = result.filter((h) => h.pricePerNight >= Number(minPrice));
    if (maxPrice) result = result.filter((h) => h.pricePerNight <= Number(maxPrice));
    if (amenityFilter.length > 0) result = result.filter((h) => amenityFilter.every((a) => h.amenities.some((ha) => ha.toLowerCase().includes(a.toLowerCase()))));
    if (sortBy === 'rating') result = [...result].sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'price_asc') result = [...result].sort((a, b) => a.pricePerNight - b.pricePerNight);
    else if (sortBy === 'price_desc') result = [...result].sort((a, b) => b.pricePerNight - a.pricePerNight);
    else if (sortBy === 'reviews') result = [...result].sort((a, b) => b.reviewCount - a.reviewCount);
    return result;
  }, [destName, minStars, minPrice, maxPrice, amenityFilter, sortBy]);

  const filteredActivities = useMemo(() => {
    let result = activities.filter((a) => matchesDest(a.destinationId, destName) || !destName);
    if (minPrice) result = result.filter((a) => a.price >= Number(minPrice));
    if (maxPrice) result = result.filter((a) => a.price <= Number(maxPrice));
    if (categoryFilter.length > 0) result = result.filter((a) => categoryFilter.includes(a.category));
    if (minRating > 0) result = result.filter((a) => a.rating >= minRating);
    if (expDuration) {
      result = result.filter((a) => {
        const dur = a.duration.toLowerCase();
        if (expDuration === 'under2h') return dur.includes('1 hour') || dur.includes('1h') || dur.includes('90') || (dur.includes('2') && dur.includes('hour') && !dur.includes('3') && !dur.includes('4') && !dur.includes('5') && !dur.includes('6'));
        if (expDuration === 'halfday') return dur.includes('3') || dur.includes('4') || dur.includes('half');
        return dur.includes('full') || dur.includes('6') || dur.includes('7') || dur.includes('8') || dur.includes('day');
      });
    }
    if (sortBy === 'rating') result = [...result].sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'price_asc') result = [...result].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') result = [...result].sort((a, b) => b.price - a.price);
    else if (sortBy === 'reviews') result = [...result].sort((a, b) => b.reviewCount - a.reviewCount);
    return result;
  }, [destName, minPrice, maxPrice, categoryFilter, minRating, expDuration, sortBy]);

  const resultCount =
    tab === 'flights' ? filteredFlights.length : tab === 'hotels' ? filteredHotels.length : filteredActivities.length;

  const loadingLabel = (() => {
    const d = destName || 'all destinations';
    if (tab === 'flights') return `Searching ${flights.length * 12} flights to ${d}...`;
    if (tab === 'hotels') return `Searching ${hotels.length * 3} hotels in ${d}...`;
    return `Finding ${activities.length * 4} experiences in ${d}...`;
  })();

  const resultLabel = (() => {
    if (tab === 'flights') return `${resultCount} flight${resultCount !== 1 ? 's' : ''} · Prices in ₹`;
    if (tab === 'hotels') return `${resultCount} hotel${resultCount !== 1 ? 's' : ''}${destName ? ` in ${destName}` : ''} · Prices in ₹`;
    return `${resultCount} experience${resultCount !== 1 ? 's' : ''}${destName ? ` in ${destName}` : ''} · Prices in ₹`;
  })();

  const tabs: { key: SearchTab; label: string; icon: string }[] = [
    { key: 'flights', label: 'Flights', icon: '✈' },
    { key: 'hotels', label: 'Hotels', icon: '🏨' },
    { key: 'experiences', label: 'Experiences', icon: '🎯' },
  ];

  // ── Filters panel (shared between sidebar and mobile sheet) ─────────────────
  function FiltersPanel() {
    return (
      <div className="space-y-6">
        {/* Price Range */}
        <div>
          <FilterLabel>Price Range</FilterLabel>
          <div className="flex gap-2">
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors"
              placeholder="₹ Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))}
            />
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors"
              placeholder="₹ Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {/* Flights: Stops */}
        {tab === 'flights' && (
          <div>
            <FilterLabel>Stops</FilterLabel>
            <div className="flex flex-col gap-1.5">
              {([['any', 'Any stops'], ['nonstop', 'Non-stop only'], ['1stop', '1 stop']] as [StopsFilter, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStops(val)}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                    stops === val ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${stops === val ? 'border-blue-600' : 'border-slate-300'}`}>
                    {stops === val && <span className="w-2 h-2 rounded-full bg-blue-600 block" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Flights: Airlines */}
        {tab === 'flights' && (
          <div>
            <FilterLabel>Airlines</FilterLabel>
            <div className="flex flex-col gap-1.5">
              {allAirlines.map((airline) => (
                <label key={airline} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-600"
                    checked={airlineFilter.includes(airline)}
                    onChange={() => toggleArr(airlineFilter, airline, setAirlineFilter)}
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{airline}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Flights: Departure time */}
        {tab === 'flights' && (
          <div>
            <FilterLabel>Departure Time</FilterLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ['morning', '🌅 Morning', '5 – 12'],
                ['afternoon', '☀️ Afternoon', '12 – 17'],
                ['evening', '🌆 Evening', '17 – 21'],
                ['night', '🌙 Night', '21 – 5'],
              ] as [DepartureTime, string, string][]).map(([val, label, time]) => (
                <button
                  key={val}
                  onClick={() => toggleArr(departureTimes, val, setDepartureTimes)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl border text-xs transition-all ${
                    departureTimes.includes(val) ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-blue-200'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-slate-400 text-[10px] mt-0.5">{time}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hotels: Star rating */}
        {tab === 'hotels' && (
          <div>
            <FilterLabel>Star Rating</FilterLabel>
            <div className="flex gap-1.5">
              {[0, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setMinStars(s)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                    minStars === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {s === 0 ? 'Any' : `${'★'.repeat(s)}+`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hotels: Amenities */}
        {tab === 'hotels' && (
          <div>
            <FilterLabel>Amenities</FilterLabel>
            <div className="flex flex-wrap gap-1.5">
              {['Pool', 'Spa', 'Breakfast', 'Gym', 'Bar'].map((a) => (
                <FilterChip
                  key={a}
                  label={a}
                  active={amenityFilter.includes(a)}
                  onClick={() => toggleArr(amenityFilter, a, setAmenityFilter)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Experiences: Duration */}
        {tab === 'experiences' && (
          <div>
            <FilterLabel>Duration</FilterLabel>
            <div className="flex flex-col gap-1.5">
              {([['', 'Any duration'], ['under2h', 'Under 2 hours'], ['halfday', 'Half-day (3–4h)'], ['fullday', 'Full day (6h+)']] as [ExperienceDuration | '', string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setExpDuration(val)}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                    expDuration === val ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${expDuration === val ? 'border-blue-600' : 'border-slate-300'}`}>
                    {expDuration === val && <span className="w-2 h-2 rounded-full bg-blue-600 block" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Experiences: Category */}
        {tab === 'experiences' && (
          <div>
            <FilterLabel>Category</FilterLabel>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={categoryFilter.includes(c)}
                  onClick={() => toggleArr(categoryFilter, c, setCategoryFilter)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Experiences: Min rating */}
        {tab === 'experiences' && (
          <div>
            <FilterLabel>Minimum Rating</FilterLabel>
            <div className="flex gap-1.5">
              {[0, 3, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                    minRating === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {r === 0 ? 'Any' : `${r}★+`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clear filters */}
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  // ── Empty states ───────────────────────────────────────────────────────────
  function EmptyState() {
    if (tab === 'flights') {
      return (
        <div className="text-center py-20 px-4">
          <div className="text-5xl mb-4">✈️</div>
          <h3 className="font-semibold text-xl text-slate-800 mb-2">No flights found</h3>
          <p className="text-slate-500 text-sm mb-6">Try adjusting your dates, origin, or stops filter.</p>
          <button onClick={clearFilters} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
            Clear filters
          </button>
        </div>
      );
    }
    if (tab === 'hotels') {
      return (
        <div className="text-center py-20 px-4">
          <div className="text-5xl mb-4">🏨</div>
          <h3 className="font-semibold text-xl text-slate-800 mb-2">No stays match your filters</h3>
          <p className="text-slate-500 text-sm mb-6">Try a lower star rating, different price range, or fewer amenities.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={clearFilters} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              Clear filters
            </button>
            <button className="px-5 py-2.5 border border-blue-600 text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors">
              Ask Journey AI
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center py-20 px-4">
        <div className="text-5xl mb-4">🎯</div>
        <h3 className="font-semibold text-xl text-slate-800 mb-2">No experiences found</h3>
        <p className="text-slate-500 text-sm mb-6">Try another date, category, or experience type.</p>
        <button onClick={clearFilters} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); clearFilters(); }}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contextual search form ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
        {tab === 'flights' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">From</label>
              <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" placeholder="Origin city" />
            </div>
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">To</label>
              <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" placeholder="Destination" defaultValue={destName} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Departure</label>
              <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Return</label>
              <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Travelers</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} traveler{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Cabin</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                <option>Economy</option>
                <option>Premium Economy</option>
                <option>Business</option>
                <option>First</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'hotels' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Destination</label>
              <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" placeholder="City or hotel" defaultValue={destName} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Check-in</label>
              <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Check-out</label>
              <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Rooms</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                {[1,2,3,4].map((n) => <option key={n} value={n}>{n} room{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Guests</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
        )}

        {tab === 'experiences' && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Destination</label>
              <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" placeholder="City or region" defaultValue={destName} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Participants</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                {[1,2,3,4,5,6,8,10].map((n) => <option key={n} value={n}>{n} person{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Experience type</label>
              <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:border-blue-400 focus:outline-none bg-slate-50 focus:bg-white transition-colors">
                <option value="">All types</option>
                {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-semibold text-slate-900 text-lg">
            {destName ? `Results for "${destName}"` : 'All results'}
          </h1>
          {loading ? (
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-blue-600 font-medium">{loadingLabel}</p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mt-0.5">{resultLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filters button */}
          <button
            onClick={() => setShowMobileFilters(true)}
            className="lg:hidden flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors bg-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-500">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Filters
          </button>
          {/* Sort */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M2 3.5h10M4 7h6M6 10.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-sm bg-transparent text-slate-700 outline-none cursor-pointer"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Rating</option>
              <option value="reviews">Best Reviewed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Filters sidebar (desktop) ── */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sticky top-20">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-900">Filters</h2>
            </div>
            <FiltersPanel />
          </div>
        </aside>

        {/* ── Results grid ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className={`grid gap-4 ${tab === 'flights' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : resultCount === 0 ? (
            <EmptyState />
          ) : (
            <div className={`grid gap-4 ${tab === 'flights' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {tab === 'flights' && filteredFlights.map((f) => (
                <FlightCard key={f.id} flight={f} onSelect={() => navigateToFlight(f.id)} />
              ))}
              {tab === 'hotels' && filteredHotels.map((h) => (
                <HotelCard key={h.id} hotel={h} onSelect={() => navigateToHotel(h.id)} />
              ))}
              {tab === 'experiences' && filteredActivities.map((a) => (
                <ActivityCard key={a.id} activity={a} onSelect={() => navigateToExperience(a.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile filters slide-up panel ── */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="font-semibold text-slate-900 text-lg">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <FiltersPanel />
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Show {resultCount} result{resultCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
