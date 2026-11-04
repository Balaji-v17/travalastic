import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { listBookings } from '../../lib/bookingsApi';
import { toBookingView, isUpcoming, matchesSearch, formatDateLabel, type BookingView } from '../../lib/bookingView';

type FilterTab = 'all' | 'upcoming' | 'completed' | 'cancelled';

export default function MyBookingsPage() {
  const { navigate, journeys } = useApp();

  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const rawList = await listBookings({ signal });
      const views = rawList.map(toBookingView);
      setBookings(views);
      if (views.length > 0 && !selectedBookingId) {
        setSelectedBookingId(views[0].id);
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      setError(err?.message || 'Could not load your flight bookings. Please check your network connection.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [selectedBookingId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  // Derived stats from REAL bookings only
  const stats = useMemo(() => {
    const total = bookings.length;
    let upcomingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    for (const b of bookings) {
      if (b.status === 'cancelled') {
        cancelledCount++;
      } else if (isUpcoming(b.rawDepartureTime)) {
        upcomingCount++;
      } else if (b.rawDepartureTime) {
        completedCount++;
      }
    }

    return { total, upcomingCount, completedCount, cancelledCount };
  }, [bookings]);

  // Filter and search
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Status filter
      if (activeFilter === 'upcoming') {
        if (b.status === 'cancelled' || !isUpcoming(b.rawDepartureTime)) return false;
      } else if (activeFilter === 'completed') {
        if (b.status === 'cancelled' || isUpcoming(b.rawDepartureTime) || !b.rawDepartureTime) return false;
      } else if (activeFilter === 'cancelled') {
        if (b.status !== 'cancelled') return false;
      }

      // Search filter
      if (!matchesSearch(b, searchQuery)) {
        return false;
      }

      return true;
    });
  }, [bookings, activeFilter, searchQuery]);

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return filteredBookings[0] || null;
    return bookings.find((b) => b.id === selectedBookingId) || filteredBookings[0] || null;
  }, [bookings, filteredBookings, selectedBookingId]);

  // Linked Journey lookup
  const linkedJourney = useMemo(() => {
    if (!selectedBooking?.itineraryId) return null;
    return journeys.find((j) => String(j.id) === String(selectedBooking.itineraryId)) || null;
  }, [selectedBooking, journeys]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] font-serif mb-1">
            My Bookings
          </h1>
          <p className="text-xs sm:text-sm text-[#77736C]">
            Flights you booked with Travalastic.
          </p>
        </div>

        {/* Real Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white border border-[#E8E4DC] p-4 sm:p-5" style={{ borderRadius: '2px' }}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#77736C] block mb-1">
              Total Bookings
            </span>
            <span className="text-2xl font-serif font-bold text-[#111111]">
              {loading ? '—' : stats.total}
            </span>
          </div>

          <div className="bg-white border border-[#E8E4DC] p-4 sm:p-5" style={{ borderRadius: '2px' }}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#77736C] block mb-1">
              Upcoming
            </span>
            <span className="text-2xl font-serif font-bold text-[#111111]">
              {loading ? '—' : stats.upcomingCount}
            </span>
          </div>

          <div className="bg-white border border-[#E8E4DC] p-4 sm:p-5" style={{ borderRadius: '2px' }}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#77736C] block mb-1">
              Completed
            </span>
            <span className="text-2xl font-serif font-bold text-[#111111]">
              {loading ? '—' : stats.completedCount}
            </span>
          </div>

          {stats.cancelledCount > 0 && (
            <div className="bg-white border border-[#E8E4DC] p-4 sm:p-5" style={{ borderRadius: '2px' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626] block mb-1">
                Cancelled
              </span>
              <span className="text-2xl font-serif font-bold text-[#DC2626]">
                {loading ? '—' : stats.cancelledCount}
              </span>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-[#E8E4DC] p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderRadius: '2px' }}>
          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === 'all'
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#FAFAF8] text-[#77736C] hover:bg-[#F2EFE9] hover:text-[#111111]'
              }`}
              style={{ borderRadius: '2px' }}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setActiveFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === 'upcoming'
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#FAFAF8] text-[#77736C] hover:bg-[#F2EFE9] hover:text-[#111111]'
              }`}
              style={{ borderRadius: '2px' }}
            >
              Upcoming ({stats.upcomingCount})
            </button>
            <button
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === 'completed'
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#FAFAF8] text-[#77736C] hover:bg-[#F2EFE9] hover:text-[#111111]'
              }`}
              style={{ borderRadius: '2px' }}
            >
              Completed ({stats.completedCount})
            </button>
            {stats.cancelledCount > 0 && (
              <button
                onClick={() => setActiveFilter('cancelled')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === 'cancelled'
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#FAFAF8] text-[#DC2626] hover:bg-[#FEF2F2]'
                }`}
                style={{ borderRadius: '2px' }}
              >
                Cancelled ({stats.cancelledCount})
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by reference, route, airline…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#FAFAF8] border border-[#E8E4DC] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
              style={{ borderRadius: '2px' }}
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-white border border-[#FCA5A5] p-8 text-center my-6" style={{ borderRadius: '2px' }}>
            <p className="text-sm text-[#B91C1C] mb-4">{error}</p>
            <button
              onClick={() => fetchBookings()}
              className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
              style={{ borderRadius: '2px' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E8E4DC] p-6 animate-pulse" style={{ borderRadius: '2px' }}>
                <div className="h-4 bg-[#E8E4DC] w-1/4 mb-3" />
                <div className="h-6 bg-[#E8E4DC] w-1/2 mb-2" />
                <div className="h-3 bg-[#E8E4DC] w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="bg-white border border-[#E8E4DC] p-12 text-center my-6" style={{ borderRadius: '2px' }}>
            <div className="w-12 h-12 rounded-full bg-[#F7F5F0] border border-[#E8E4DC] flex items-center justify-center text-xl text-[#77736C] mx-auto mb-4">
              ✈
            </div>
            <h2 className="text-lg font-bold text-[#111111] font-serif mb-2">
              No bookings yet
            </h2>
            <p className="text-xs text-[#77736C] max-w-sm mx-auto mb-6 leading-relaxed">
              You haven't booked any flights with Travalastic yet. Search real-time flights and book directly.
            </p>
            <button
              onClick={() => navigate('search')}
              className="px-6 py-3 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
              style={{ borderRadius: '2px' }}
            >
              Search Flights
            </button>
          </div>
        )}

        {/* Empty Search Results */}
        {!loading && !error && bookings.length > 0 && filteredBookings.length === 0 && (
          <div className="bg-white border border-[#E8E4DC] p-8 text-center my-6" style={{ borderRadius: '2px' }}>
            <p className="text-sm text-[#77736C] mb-4">
              No bookings match your selected filter or search query.
            </p>
            <button
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-white border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#FAFAF8]"
              style={{ borderRadius: '2px' }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Main Content: List + Detail Split View */}
        {!loading && !error && filteredBookings.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Bookings List Column */}
            <div className="lg:col-span-7 space-y-3">
              {filteredBookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBookingId(b.id)}
                    className={`bg-white border transition-all p-5 cursor-pointer ${
                      isSelected
                        ? 'border-[#111111] shadow-sm'
                        : 'border-[#E8E4DC] hover:border-[#77736C]'
                    }`}
                    style={{ borderRadius: '2px' }}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#111111]">
                          {b.carrier}
                        </span>
                        {b.flightNumbers.length > 0 && (
                          <span className="text-xs font-mono text-[#77736C]">
                            {b.flightNumbers.join(', ')}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                          b.statusTone === 'success'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                            : b.statusTone === 'danger'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]'
                            : 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        {b.statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#77736C] mb-3">
                      <span className="font-bold text-[#111111] font-mono text-sm">
                        {b.route.origin} → {b.route.destination}
                      </span>
                      {b.departureDate && <span>•</span>}
                      {b.departureDate && <span>{b.departureDate}</span>}
                      {b.departureTime && <span>at {b.departureTime}</span>}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC]/60 text-xs">
                      <div>
                        <span className="text-[#77736C]">Reference: </span>
                        <span className="font-mono font-bold text-[#111111]">
                          {b.reference}
                        </span>
                      </div>
                      <span className="font-serif text-sm font-bold text-[#111111]">
                        {b.formattedTotal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel Column */}
            {selectedBooking && (
              <div className="lg:col-span-5 bg-white border border-[#E8E4DC] p-6 sticky top-24" style={{ borderRadius: '2px' }}>
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#77736C] block mb-1">
                      Flight Booking
                    </span>
                    <h2 className="text-xl font-bold font-serif text-[#111111]">
                      {selectedBooking.route.origin} → {selectedBooking.route.destination}
                    </h2>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                      selectedBooking.statusTone === 'success'
                        ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                        : selectedBooking.statusTone === 'danger'
                        ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]'
                        : 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]'
                    }`}
                    style={{ borderRadius: '2px' }}
                  >
                    {selectedBooking.statusLabel}
                  </span>
                </div>

                {selectedBooking.isTest && (
                  <div className="mb-5 p-3 bg-[#F7F5F0] border border-[#E8E4DC] text-xs text-[#77736C] leading-relaxed" style={{ borderRadius: '2px' }}>
                    <span className="font-semibold text-[#111111]">Test booking. </span>
                    No real ticket was issued.
                  </div>
                )}

                <div className="space-y-3.5 py-4 border-y border-[#E8E4DC] text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[#77736C]">Booking Reference (PNR)</span>
                    <span className="font-mono text-sm font-bold text-[#111111]">
                      {selectedBooking.reference}
                    </span>
                  </div>

                  {selectedBooking.orderId && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#77736C]">Duffel Order ID</span>
                      <span className="font-mono text-[11px] text-[#77736C]">
                        {selectedBooking.orderId}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline">
                    <span className="text-[#77736C]">Airline</span>
                    <span className="font-medium text-[#111111]">{selectedBooking.carrier}</span>
                  </div>

                  {selectedBooking.flightNumbers.length > 0 && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#77736C]">Flight Numbers</span>
                      <span className="font-mono text-[#111111]">
                        {selectedBooking.flightNumbers.join(', ')}
                      </span>
                    </div>
                  )}

                  {selectedBooking.departureDate && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#77736C]">Departure</span>
                      <span className="font-medium text-[#111111]">
                        {selectedBooking.departureDate}
                        {selectedBooking.departureTime ? ` at ${selectedBooking.departureTime}` : ''}
                      </span>
                    </div>
                  )}

                  {selectedBooking.arrivalTime && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#77736C]">Arrival Time</span>
                      <span className="font-medium text-[#111111]">{selectedBooking.arrivalTime}</span>
                    </div>
                  )}

                  {selectedBooking.duration && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#77736C]">Flight Duration</span>
                      <span className="text-[#111111]">{selectedBooking.duration}</span>
                    </div>
                  )}

                  {/* Travelers (Names only — NEVER DOB, phone, email, or documents) */}
                  <div className="pt-2 border-t border-[#E8E4DC]/60">
                    <span className="text-[#77736C] block mb-1">Travelers</span>
                    {selectedBooking.passengerNames.length > 0 ? (
                      <ul className="space-y-0.5">
                        {selectedBooking.passengerNames.map((name, i) => (
                          <li key={i} className="font-medium text-[#111111]">
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="font-medium text-[#111111]">Confirmed Traveler</span>
                    )}
                  </div>

                  {/* Linked trip row */}
                  <div className="pt-2 border-t border-[#E8E4DC]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[#77736C] block mb-0.5">Linked Trip</span>
                      {linkedJourney ? (
                        <span className="font-semibold text-[#111111]">
                          {linkedJourney.destination}
                        </span>
                      ) : selectedBooking.itineraryId ? (
                        <span className="text-[#77736C] italic">Trip no longer available</span>
                      ) : (
                        <span className="text-[#77736C]">Not linked to a trip</span>
                      )}
                    </div>
                    {linkedJourney && (
                      <button
                        onClick={() => navigate('journey', { selectedJourneyId: linkedJourney.id })}
                        className="px-3 py-1 bg-[#FAFAF8] border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#F2EFE9] transition-colors"
                        style={{ borderRadius: '2px' }}
                      >
                        View Trip
                      </button>
                    )}
                  </div>

                  {selectedBooking.createdAt && (
                    <div className="flex justify-between items-baseline pt-2 border-t border-[#E8E4DC]/60">
                      <span className="text-[#77736C]">Booked On</span>
                      <span className="text-[#77736C]">
                        {formatDateLabel(selectedBooking.createdAt) || selectedBooking.createdAt}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-2 border-t border-[#E8E4DC]/60">
                    <span className="font-bold text-[#111111]">Total Amount</span>
                    <span className="font-serif text-base font-bold text-[#111111]">
                      {selectedBooking.formattedTotal}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => navigate('search')}
                    className="w-full px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors text-center"
                    style={{ borderRadius: '2px' }}
                  >
                    Search More Flights
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
