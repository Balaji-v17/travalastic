import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { listCuratedHotels, type CuratedHotelItem } from '../../lib/hotelsApi';
import CuratedHotelCard, { isAffiliateUrl } from '../../components/hotels/CuratedHotelCard';
import { validateStay, buildBookingUrl } from '../../lib/stay';

function getTodayLocalDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDates(): { checkIn: string; checkOut: string } {
  const d1 = new Date();
  d1.setDate(d1.getDate() + 7);
  const d2 = new Date(d1);
  d2.setDate(d2.getDate() + 4);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    checkIn: format(d1),
    checkOut: format(d2),
  };
}

export default function HotelsPage() {
  const { hotelsQuery, setHotelsQuery } = useApp();

  const today = getTodayLocalDate();
  const defaultDates = getDefaultDates();

  // Form state prefilled from hotelsQuery or sensible defaults
  const [destination, setDestination] = useState<string>(() => hotelsQuery?.destination || '');
  const [checkIn, setCheckIn] = useState<string>(() => hotelsQuery?.checkIn || defaultDates.checkIn);
  const [checkOut, setCheckOut] = useState<string>(() => hotelsQuery?.checkOut || defaultDates.checkOut);
  const [guests, setGuests] = useState<number>(() => hotelsQuery?.guests || 2);
  const [rooms, setRooms] = useState<number>(() => hotelsQuery?.rooms || 1);

  // Search execution & results state
  const [searchedDest, setSearchedDest] = useState<string>('');
  const [hotels, setHotels] = useState<CuratedHotelItem[] | null>(null); // null = unsearched
  const [serverBookingUrl, setServerBookingUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Sync state if hotelsQuery updates externally
  useEffect(() => {
    if (hotelsQuery) {
      if (hotelsQuery.destination) setDestination(hotelsQuery.destination);
      if (hotelsQuery.checkIn) setCheckIn(hotelsQuery.checkIn);
      if (hotelsQuery.checkOut) setCheckOut(hotelsQuery.checkOut);
      if (hotelsQuery.guests) setGuests(hotelsQuery.guests);
      if (hotelsQuery.rooms) setRooms(hotelsQuery.rooms);
    }
  }, [hotelsQuery]);

  const executeSearch = useCallback(
    async (
      destToSearch: string,
      cin: string,
      cout: string,
      gCount: number,
      rCount: number
    ) => {
      const val = validateStay(
        { destination: destToSearch, checkIn: cin, checkOut: cout, guests: gCount, rooms: rCount },
        today
      );

      if (!val.ok) {
        setValidationErrors(val.errors);
        return;
      }

      setValidationErrors({});
      setErrorMessage(null);
      setLoading(true);
      setSearchedDest(destToSearch.trim());

      try {
        const res = await listCuratedHotels({
          destination: destToSearch.trim(),
          checkinDate: cin,
          checkoutDate: cout,
        });

        setHotels(res.hotels);
        setServerBookingUrl(res.bookingComSearchUrl || '');
      } catch (err: any) {
        setErrorMessage(
          err?.message || 'Unable to connect to hotels service. Please check your network connection.'
        );
        setHotels([]);
      } finally {
        setLoading(false);
      }
    },
    [today]
  );

  // Auto-search once if prefilled with a destination
  const autoSearchedRef = useRef(false);
  useEffect(() => {
    if (!autoSearchedRef.current && hotelsQuery?.destination) {
      autoSearchedRef.current = true;
      executeSearch(
        hotelsQuery.destination,
        hotelsQuery.checkIn || checkIn,
        hotelsQuery.checkOut || checkOut,
        hotelsQuery.guests || guests,
        hotelsQuery.rooms || rooms
      );
    }
  }, [hotelsQuery, checkIn, checkOut, guests, rooms, executeSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(destination, checkIn, checkOut, guests, rooms);
  };

  // Derive effective Booking.com search URL
  // If the server returned an affiliate search URL, augment it with guests/rooms;
  // otherwise fallback to client buildBookingUrl.
  const effectiveBookingUrl = serverBookingUrl
    ? buildBookingUrl({
        baseUrl: serverBookingUrl,
        destination: searchedDest || destination,
        checkIn,
        checkOut,
        guests,
        rooms,
      })
    : buildBookingUrl({
        destination: searchedDest || destination,
        checkIn,
        checkOut,
        guests,
        rooms,
      });

  const isAffiliate = isAffiliateUrl(effectiveBookingUrl);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#111111]">
      {/* ── Page Header ── */}
      <section className="border-b border-[#E8E4DC] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C9A96E] mb-2">
            Accommodations
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-[#111111] tracking-tight">
            Curated Hotels & Stays
          </h1>
          <p className="text-sm text-[#77736C] mt-2 max-w-2xl">
            Browse hand-picked stays vetted for character and quality, or check real-time availability and book directly on Booking.com.
          </p>
        </div>
      </section>

      {/* ── Search Form Section ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className="bg-white border border-[#E8E4DC] p-5 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
          style={{ borderRadius: '2px' }}
        >
          <form onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Destination Input */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Destination <span className="text-[#C9A96E]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Goa, Paris, Tokyo, Jaipur"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (validationErrors.destination) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.destination;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm border ${
                    validationErrors.destination ? 'border-rose-400 bg-rose-50/20' : 'border-[#E8E4DC]'
                  } bg-[#FAFAF8] text-[#111111] focus:bg-white focus:outline-none focus:border-[#C9A96E] transition-colors`}
                  style={{ borderRadius: '2px' }}
                />
                {validationErrors.destination && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {validationErrors.destination}
                  </p>
                )}
              </div>

              {/* Check-in Date */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Check-in <span className="text-[#C9A96E]">*</span>
                </label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (validationErrors.checkIn) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.checkIn;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm border ${
                    validationErrors.checkIn ? 'border-rose-400 bg-rose-50/20' : 'border-[#E8E4DC]'
                  } bg-[#FAFAF8] text-[#111111] focus:bg-white focus:outline-none focus:border-[#C9A96E] transition-colors`}
                  style={{ borderRadius: '2px' }}
                />
                {validationErrors.checkIn && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {validationErrors.checkIn}
                  </p>
                )}
              </div>

              {/* Check-out Date */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Check-out <span className="text-[#C9A96E]">*</span>
                </label>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    if (validationErrors.checkOut || validationErrors.nights) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.checkOut;
                        delete next.nights;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm border ${
                    validationErrors.checkOut || validationErrors.nights
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-[#E8E4DC]'
                  } bg-[#FAFAF8] text-[#111111] focus:bg-white focus:outline-none focus:border-[#C9A96E] transition-colors`}
                  style={{ borderRadius: '2px' }}
                />
                {(validationErrors.checkOut || validationErrors.nights) && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {validationErrors.checkOut || validationErrors.nights}
                  </p>
                )}
              </div>

              {/* Guests & Rooms */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setGuests(val);
                      if (rooms > val) setRooms(val);
                    }}
                    className="w-full px-2 py-2.5 text-sm border border-[#E8E4DC] bg-[#FAFAF8] text-[#111111] focus:bg-white focus:outline-none focus:border-[#C9A96E]"
                    style={{ borderRadius: '2px' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Rooms
                  </label>
                  <select
                    value={rooms}
                    onChange={(e) => setRooms(parseInt(e.target.value, 10))}
                    className="w-full px-2 py-2.5 text-sm border border-[#E8E4DC] bg-[#FAFAF8] text-[#111111] focus:bg-white focus:outline-none focus:border-[#C9A96E]"
                    style={{ borderRadius: '2px' }}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n} disabled={n > guests}>
                        {n} {n === 1 ? 'Room' : 'Rooms'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Validation Errors List if rooms/guests conflict */}
            {validationErrors.rooms && (
              <p className="text-xs text-rose-600 mt-2 font-medium">
                ⚠️ {validationErrors.rooms}
              </p>
            )}

            {/* Action Row */}
            <div className="mt-5 pt-4 border-t border-[#E8E4DC]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[#77736C]">
                Curated recommendations from our editors with live inventory on Booking.com.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#252525] disabled:opacity-50 transition-colors shadow-sm"
                style={{ borderRadius: '2px' }}
              >
                {loading ? 'Finding hotels…' : 'Find hotels'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Results Section ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Loading Shimmer */}
        {loading && (
          <div>
            <div className="h-5 bg-[#E8E4DC] w-48 mb-6 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-5 border border-[#E8E4DC] bg-white animate-pulse"
                  style={{ borderRadius: '2px' }}
                >
                  <div className="w-full h-40 bg-[#FAFAF8] mb-4" />
                  <div className="h-4 bg-[#E8E4DC] w-1/3 mb-2" />
                  <div className="h-5 bg-[#E8E4DC] w-2/3 mb-4" />
                  <div className="h-8 bg-[#FAFAF8] w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State with Retry */}
        {!loading && errorMessage && (
          <div
            className="p-6 border border-rose-200 bg-rose-50/40 text-center max-w-xl mx-auto"
            style={{ borderRadius: '2px' }}
          >
            <p className="text-sm font-semibold text-rose-900 mb-1">
              Unable to load curated hotels
            </p>
            <p className="text-xs text-rose-700 mb-4">{errorMessage}</p>
            <button
              onClick={() => executeSearch(destination, checkIn, checkOut, guests, rooms)}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
              style={{ borderRadius: '2px' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Results Available */}
        {!loading && !errorMessage && hotels !== null && hotels.length > 0 && (
          <div>
            {/* Results Header with Disclosure */}
            <div className="mb-6 pb-4 border-b border-[#E8E4DC]">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#111111]">
                  Hotels we've picked for {searchedDest}. Prices and availability are on Booking.com.
                </h2>
                <span className="text-xs font-mono text-[#77736C]">
                  {hotels.length} {hotels.length === 1 ? 'curated stay' : 'curated stays'}
                </span>
              </div>
              {/* Affiliate disclosure shown strictly when an affiliate id is in use */}
              {isAffiliate && (
                <p className="text-xs text-[#77736C] mt-2 italic">
                  We may earn a commission if you book through these links.
                </p>
              )}
            </div>

            {/* Hotel Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {hotels.map((h, i) => (
                <CuratedHotelCard
                  key={h._id || h.id || i}
                  hotel={h}
                  bookingUrl={effectiveBookingUrl}
                />
              ))}
            </div>

            {/* Prominent Booking.com Live Availability Card */}
            {effectiveBookingUrl && (
              <div
                className="p-6 sm:p-8 bg-[#003580] text-white flex flex-col md:flex-row md:items-center justify-between gap-6"
                style={{ borderRadius: '2px' }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg tracking-tight">Booking.com</span>
                    <span className="text-[10px] uppercase font-semibold bg-white/20 text-white px-2 py-0.5 rounded-sm">
                      Live Rates
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-normal mb-1">
                    Compare all rooms & verified reviews in {searchedDest}
                  </h3>
                  <p className="text-xs text-white/80 max-w-xl">
                    Check real-time rates, cancellation options, and instant confirmation for {searchedDest} ({checkIn} to {checkOut}).
                  </p>
                </div>
                <a
                  href={effectiveBookingUrl}
                  target="_blank"
                  rel={isAffiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
                  className="shrink-0 px-6 py-3 bg-[#FFB700] hover:bg-[#F2AE00] text-[#003580] text-xs font-bold uppercase tracking-wider text-center transition-colors shadow-sm"
                  style={{ borderRadius: '2px' }}
                >
                  See all live rates on Booking.com ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Empty State (0 curated hotels) */}
        {!loading && !errorMessage && hotels !== null && hotels.length === 0 && (
          <div
            className="p-8 sm:p-12 border border-[#E8E4DC] bg-white text-center max-w-xl mx-auto"
            style={{ borderRadius: '2px' }}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#FAFAF8] flex items-center justify-center text-xl">
              🏨
            </div>
            <h3 className="font-serif text-xl font-normal text-[#111111] mb-2">
              We don't have curated hotels for {searchedDest} yet.
            </h3>
            <p className="text-xs text-[#77736C] mb-6 leading-relaxed">
              Our travel editors haven't added custom picks for this destination yet, but live rooms and instant bookings are ready on Booking.com.
            </p>
            {effectiveBookingUrl && (
              <a
                href={effectiveBookingUrl}
                target="_blank"
                rel={isAffiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
                className="inline-block px-6 py-3 bg-[#111111] hover:bg-[#252525] text-white text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
                style={{ borderRadius: '2px' }}
              >
                Search {searchedDest} on Booking.com ↗
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

