import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import {
  listAllBookings,
  createRecordedBooking,
  updateRecordedBooking,
  deleteRecordedBooking,
  type MergedBookingItem,
  type MergedBookingsResponse,
} from '../../lib/bookingsApi';
import { toBookingView, formatDateLabel, extractLocalDatePart } from '../../lib/bookingView';
import { formatLocalTime } from '../../lib/flightAdapter';
import {
  RECORDED_BOOKING_KINDS,
  validateRecordedBookingForm,
  type RecordedBookingKind,
  type RecordedBookingStatus,
} from '../../lib/recordedBookingValidation';

type KindFilter = 'all' | 'flight' | RecordedBookingKind;
type WhenFilter = 'all' | 'upcoming' | 'past' | 'cancelled';

const KIND_META: Record<'flight' | RecordedBookingKind, { label: string; plural: string; icon: string }> = {
  flight: { label: 'Flight', plural: 'Flights', icon: '✈' },
  hotel: { label: 'Hotel', plural: 'Hotels', icon: '🏨' },
  bus: { label: 'Bus', plural: 'Buses', icon: '🚌' },
  train: { label: 'Train', plural: 'Trains', icon: '🚆' },
  cab: { label: 'Cab', plural: 'Cabs', icon: '🚕' },
  car_rental: { label: 'Car rental', plural: 'Car rentals', icon: '🚗' },
};

const KIND_FILTERS: Array<{ id: KindFilter; label: string; icon?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'flight', label: 'Flights', icon: '✈' },
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
  { id: 'bus', label: 'Buses', icon: '🚌' },
  { id: 'train', label: 'Trains', icon: '🚆' },
  { id: 'cab', label: 'Cabs', icon: '🚕' },
  { id: 'car_rental', label: 'Car rentals', icon: '🚗' },
];

const WHEN_FILTERS: Array<{ id: WhenFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

function formatDisplayDateTime(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const datePart = extractLocalDatePart(raw);
  const dateLabel = datePart ? formatDateLabel(datePart) : '';
  const timeMatch = raw.match(/(?:[T\s])(\d{2}:\d{2})/);
  const timePart = timeMatch ? formatLocalTime(raw) : null;
  if (dateLabel && timePart) return `${dateLabel} at ${timePart}`;
  return dateLabel || raw;
}

interface FormState {
  kind: RecordedBookingKind;
  title: string;
  provider: string;
  startAt: string;
  endAt: string;
  reference: string;
  amount: string;
  currency: string;
  status: RecordedBookingStatus;
  notes: string;
  tripId: string;
}

function emptyFormState(prefill?: { kind?: RecordedBookingKind; provider?: string } | null): FormState {
  return {
    kind: prefill?.kind && RECORDED_BOOKING_KINDS.includes(prefill.kind) ? prefill.kind : 'hotel',
    title: '',
    provider: prefill?.provider || '',
    startAt: '',
    endAt: '',
    reference: '',
    amount: '',
    currency: '',
    status: 'booked',
    notes: '',
    tripId: '',
  };
}

export default function MyBookingsPage() {
  const {
    navigate,
    openBook,
    journeys,
    refreshJourneys,
    pendingRecordedBookingPrefill,
    clearRecordedBookingPrefill,
  } = useApp();

  const [data, setData] = useState<MergedBookingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [whenFilter, setWhenFilter] = useState<WhenFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add / Edit Form modal state
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyFormState(null));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formServerError, setFormServerError] = useState<string>('');
  const [formSaving, setFormSaving] = useState<boolean>(false);

  // Delete confirmation modal state
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MergedBookingItem | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const fetchBookings = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listAllBookings({
          kind: kindFilter,
          when: whenFilter,
          limit: 100,
          signal,
        });
        setData(res);
      } catch (err: any) {
        if (signal?.aborted) return;
        setError(err?.message || 'Could not load your bookings. Please check your connection.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [kindFilter, whenFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  // Consume external hand-off prefill if user clicked [Save details] on banner
  useEffect(() => {
    if (pendingRecordedBookingPrefill) {
      const preKind = pendingRecordedBookingPrefill.kind as RecordedBookingKind;
      setEditingId(null);
      setForm(
        emptyFormState({
          kind: RECORDED_BOOKING_KINDS.includes(preKind) ? preKind : 'hotel',
          provider: pendingRecordedBookingPrefill.provider,
        })
      );
      setFormErrors({});
      setFormServerError('');
      setFormOpen(true);
      clearRecordedBookingPrefill();
    }
  }, [pendingRecordedBookingPrefill, clearRecordedBookingPrefill]);

  const items = useMemo(() => {
    const rawItems = data?.items || [];
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.trim().toLowerCase();
    return rawItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const selectedItem = useMemo(() => {
    if (items.length === 0) return null;
    if (selectedId) {
      const found = items.find((i) => i.id === selectedId);
      if (found) return found;
    }
    return items[0];
  }, [items, selectedId]);

  const selectedFlightView = useMemo(() => {
    if (!selectedItem || selectedItem.source !== 'duffel' || !selectedItem.flight) return null;
    return toBookingView(selectedItem.flight);
  }, [selectedItem]);

  const linkedJourney = useMemo(() => {
    if (!selectedItem?.tripId) return null;
    return journeys.find((j) => String(j.id) === String(selectedItem.tripId)) || null;
  }, [selectedItem, journeys]);

  function openNewForm() {
    setEditingId(null);
    setForm(emptyFormState(null));
    setFormErrors({});
    setFormServerError('');
    setFormOpen(true);
  }

  function openEditForm(item: MergedBookingItem) {
    if (item.source !== 'recorded') return;
    setEditingId(item.id);
    setForm({
      kind: item.kind as RecordedBookingKind,
      title: item.title,
      provider: item.provider,
      startAt: item.startAt,
      endAt: item.endAt || '',
      reference: item.reference || '',
      amount: item.amount || '',
      currency: item.currency || '',
      status: item.status === 'cancelled' ? 'cancelled' : 'booked',
      notes: item.notes || '',
      tripId: item.tripId || '',
    });
    setFormErrors({});
    setFormServerError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateRecordedBookingForm({
      kind: form.kind,
      title: form.title,
      provider: form.provider,
      startAt: form.startAt,
      endAt: form.endAt,
      reference: form.reference,
      amount: form.amount,
      currency: form.currency,
      status: form.status,
      notes: form.notes,
      tripId: form.tripId || null,
    });

    if (!validation.ok) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    setFormServerError('');
    setFormSaving(true);

    try {
      const payload = {
        kind: form.kind,
        title: form.title.trim(),
        provider: form.provider.trim(),
        startAt: form.startAt.trim(),
        endAt: form.endAt.trim(),
        reference: form.reference.trim(),
        amount: form.amount.trim(),
        currency: form.currency.trim().toUpperCase(),
        status: form.status,
        notes: form.notes.trim(),
        tripId: form.tripId ? form.tripId : null,
      };

      let saved: MergedBookingItem;
      if (editingId) {
        saved = await updateRecordedBooking(editingId, payload);
      } else {
        saved = await createRecordedBooking(payload);
      }

      setFormOpen(false);
      setSelectedId(saved.id);
      await Promise.all([fetchBookings(), refreshJourneys()]);
    } catch (err: any) {
      setFormServerError(err?.message || 'Could not save booking. Please check your inputs.');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleToggleCancel(item: MergedBookingItem) {
    if (item.source !== 'recorded') return;
    setActionBusyId(item.id);
    try {
      const nextStatus: RecordedBookingStatus = item.status === 'cancelled' ? 'booked' : 'cancelled';
      await updateRecordedBooking(item.id, { status: nextStatus });
      await Promise.all([fetchBookings(), refreshJourneys()]);
    } catch (err: any) {
      setError(err?.message || 'Could not update booking status.');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteItem) return;
    const id = confirmDeleteItem.id;
    setActionBusyId(id);
    try {
      await deleteRecordedBooking(id);
      setConfirmDeleteItem(null);
      if (selectedId === id) setSelectedId(null);
      await Promise.all([fetchBookings(), refreshJourneys()]);
    } catch (err: any) {
      setError(err?.message || 'Could not delete booking.');
    } finally {
      setActionBusyId(null);
    }
  }

  const totalOverall = data?.counts?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#77736C] mb-1">
              Reservations & Self-Recorded Itinerary Items
            </p>
            <h1 className="text-3xl font-bold text-[#111111] font-serif">
              My Bookings
            </h1>
            <p className="text-xs text-[#77736C] mt-1">
              Flights are booked directly on Travalastic. Hotels, buses, trains, cabs, and car rentals below are recorded by you.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openNewForm}
              className="px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#252525] transition-colors cursor-pointer"
              style={{ borderRadius: '2px' }}
            >
              + Add booking
            </button>
          </div>
        </div>

        {/* Book Something Quick Links */}
        <div className="bg-white border border-[#E8E4DC] px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3" style={{ borderRadius: '2px' }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#77736C]">
            Book something:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { tab: 'flights', label: 'Flights', icon: '✈' },
              { tab: 'hotels', label: 'Hotels', icon: '🏨' },
              { tab: 'cab', label: 'Cab', icon: '🚕' },
              { tab: 'rental', label: 'Car rental', icon: '🚗' },
              { tab: 'trains', label: 'Trains', icon: '🚆' },
              { tab: 'buses', label: 'Buses', icon: '🚌' },
            ] as const).map((b) => (
              <button
                key={b.tab}
                type="button"
                onClick={() => openBook(b.tab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E4DC] bg-[#FAFAF8] hover:bg-[#111111] hover:text-white hover:border-[#111111] text-xs font-medium text-[#111111] transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-[#E8E4DC] p-4" style={{ borderRadius: '2px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#77736C]">Total</p>
            <p className="text-2xl font-bold font-serif text-[#111111] mt-1">{totalOverall}</p>
          </div>
          <div className="bg-white border border-[#E8E4DC] p-4" style={{ borderRadius: '2px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#77736C]">Upcoming</p>
            <p className="text-2xl font-bold font-serif text-[#16A34A] mt-1">{data?.counts?.byWhen?.upcoming ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E8E4DC] p-4" style={{ borderRadius: '2px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#77736C]">Past</p>
            <p className="text-2xl font-bold font-serif text-[#111111] mt-1">{data?.counts?.byWhen?.past ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E8E4DC] p-4" style={{ borderRadius: '2px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#77736C]">Cancelled</p>
            <p className="text-2xl font-bold font-serif text-[#77736C] mt-1">{data?.counts?.byWhen?.cancelled ?? 0}</p>
          </div>
        </div>

        {/* Filter Bar (Kind tabs + When tabs + Search) */}
        <div className="bg-white border border-[#E8E4DC] p-3 mb-6 space-y-3" style={{ borderRadius: '2px' }}>
          {/* Kind Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-[#E8E4DC]/70 pb-3">
            {KIND_FILTERS.map((kf) => {
              const isActive = kindFilter === kf.id;
              const count =
                kf.id === 'all'
                  ? data?.counts?.total
                  : data?.counts?.byKind?.[kf.id];
              return (
                <button
                  key={kf.id}
                  type="button"
                  onClick={() => setKindFilter(kf.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#111111] text-white'
                      : 'text-[#77736C] hover:text-[#111111] bg-[#FAFAF8]'
                  }`}
                  style={{ borderRadius: '2px' }}
                >
                  {kf.icon && <span>{kf.icon}</span>}
                  <span>{kf.label}</span>
                  {typeof count === 'number' && (
                    <span className={`text-[10px] ${isActive ? 'text-white/75' : 'text-[#77736C]'}`}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* When Filter Tabs + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {WHEN_FILTERS.map((wf) => {
                const isActive = whenFilter === wf.id;
                return (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => setWhenFilter(wf.id)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#C9A96E]/20 text-[#111111] border border-[#C9A96E]'
                        : 'text-[#77736C] hover:text-[#111111] border border-transparent'
                    }`}
                    style={{ borderRadius: '2px' }}
                  >
                    {wf.label}
                  </button>
                );
              })}
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search title, provider, reference…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#FAFAF8] border border-[#E8E4DC] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                style={{ borderRadius: '2px' }}
              />
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-white border border-[#FCA5A5] p-6 text-center my-6" style={{ borderRadius: '2px' }}>
            <p className="text-sm text-[#B91C1C] mb-3">{error}</p>
            <button
              type="button"
              onClick={() => fetchBookings()}
              className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold"
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

        {/* Empty State (zero bookings overall) */}
        {!loading && !error && totalOverall === 0 && (
          <div className="bg-white border border-[#E8E4DC] p-10 text-center my-6" style={{ borderRadius: '2px' }}>
            <div className="w-12 h-12 rounded-full bg-[#F7F5F0] border border-[#E8E4DC] flex items-center justify-center text-xl text-[#77736C] mx-auto mb-4">
              🎫
            </div>
            <h2 className="text-lg font-bold text-[#111111] font-serif mb-2">
              No bookings yet
            </h2>
            <p className="text-xs text-[#77736C] max-w-md mx-auto mb-6 leading-relaxed">
              Book real-time flights directly on Travalastic, browse partner sites for stays and ground transport, or record bookings you made elsewhere.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => openBook('flights')}
                className="px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Find flights
              </button>
              <button
                type="button"
                onClick={() => openBook('hotels')}
                className="px-4 py-2.5 border border-[#E8E4DC] bg-white text-[#111111] text-xs font-semibold hover:bg-[#F7F5F0] transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Find hotels
              </button>
              <button
                type="button"
                onClick={() => openBook('cab')}
                className="px-4 py-2.5 border border-[#E8E4DC] bg-white text-[#111111] text-xs font-semibold hover:bg-[#F7F5F0] transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Cab or car rental
              </button>
              <button
                type="button"
                onClick={openNewForm}
                className="px-4 py-2.5 border border-[#C9A96E] bg-[#C9A96E]/10 text-[#111111] text-xs font-semibold hover:bg-[#C9A96E]/20 transition-colors cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                + Record external booking
              </button>
            </div>
          </div>
        )}

        {/* Empty Filter Results */}
        {!loading && !error && totalOverall > 0 && items.length === 0 && (
          <div className="bg-white border border-[#E8E4DC] p-10 text-center my-6" style={{ borderRadius: '2px' }}>
            <p className="text-sm text-[#77736C] mb-5">
              No bookings match the current filter.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setKindFilter('all');
                  setWhenFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 bg-white border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#FAFAF8] cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => openBook('flights')}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Find flights
              </button>
              <button
                type="button"
                onClick={() => openBook('hotels')}
                className="px-4 py-2 border border-[#E8E4DC] bg-white text-[#111111] text-xs font-semibold cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Find hotels
              </button>
              <button
                type="button"
                onClick={() => openBook('cab')}
                className="px-4 py-2 border border-[#E8E4DC] bg-white text-[#111111] text-xs font-semibold cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Cab or car rental
              </button>
            </div>
          </div>
        )}

        {/* Main Split List + Detail View */}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* List Column */}
            <div className="lg:col-span-7 space-y-3">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const meta = KIND_META[item.kind] || KIND_META.hotel;
                const isCancelled = item.status === 'cancelled';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`bg-white border transition-all p-5 cursor-pointer ${
                      isSelected ? 'border-[#111111] shadow-sm' : 'border-[#E8E4DC] hover:border-[#77736C]'
                    }`}
                    style={{ borderRadius: '2px' }}
                  >
                    {/* Top row: kind icon + provider + badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{meta.icon}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#77736C]">
                          {meta.label}
                        </span>
                        {item.provider && (
                          <span className="text-xs text-[#111111] font-medium">
                            · {item.provider}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.source === 'recorded' && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200"
                            style={{ borderRadius: '2px' }}
                          >
                            Recorded by you
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            isCancelled
                              ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]'
                              : 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                          }`}
                          style={{ borderRadius: '2px' }}
                        >
                          {isCancelled ? 'Cancelled' : item.source === 'duffel' ? 'Confirmed' : 'Booked'}
                        </span>
                      </div>
                    </div>

                    {/* Title & Dates */}
                    <h3 className="font-semibold text-base text-[#111111] mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#77736C] mb-2">
                      {formatDisplayDateTime(item.startAt)}
                      {item.endAt ? ` → ${formatDisplayDateTime(item.endAt)}` : ''}
                    </p>

                    {item.source === 'recorded' && (
                      <p className="text-[11px] text-[#77736C] italic mb-2">
                        Travalastic did not make this booking and can't verify it.
                      </p>
                    )}

                    {/* Reference & Amount */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DC]/60 text-xs">
                      <div>
                        {item.reference ? (
                          <>
                            <span className="text-[#77736C]">Ref: </span>
                            <span className="font-mono font-bold text-[#111111]">{item.reference}</span>
                          </>
                        ) : (
                          <span className="text-[#77736C]">No reference added</span>
                        )}
                      </div>
                      {item.amount ? (
                        <span className="font-serif text-sm font-bold text-[#111111]">
                          {item.currency ? `${item.currency} ` : ''}{item.amount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel Column */}
            {selectedItem && (
              <div className="lg:col-span-5 bg-white border border-[#E8E4DC] p-6 sticky top-24" style={{ borderRadius: '2px' }}>
                {/* FLIGHT DETAIL (Preserved Real Duffel Details) */}
                {selectedItem.source === 'duffel' && selectedFlightView ? (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#77736C] block mb-1">
                          Flight Booking · Made via Travalastic
                        </span>
                        <h2 className="text-xl font-bold font-serif text-[#111111]">
                          {selectedFlightView.route.origin} → {selectedFlightView.route.destination}
                        </h2>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                          selectedFlightView.statusTone === 'success'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                            : selectedFlightView.statusTone === 'danger'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]'
                            : 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        {selectedFlightView.statusLabel}
                      </span>
                    </div>

                    {selectedFlightView.isTest && (
                      <div className="mb-5 p-3 bg-[#F7F5F0] border border-[#E8E4DC] text-xs text-[#77736C] leading-relaxed" style={{ borderRadius: '2px' }}>
                        <span className="font-semibold text-[#111111]">Test booking. </span>
                        No real ticket was issued.
                      </div>
                    )}

                    <div className="space-y-3.5 py-4 border-y border-[#E8E4DC] text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#77736C]">Booking Reference (PNR)</span>
                        <span className="font-mono text-sm font-bold text-[#111111]">
                          {selectedFlightView.reference}
                        </span>
                      </div>

                      {selectedFlightView.orderId && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Duffel Order ID</span>
                          <span className="font-mono text-[11px] text-[#77736C]">
                            {selectedFlightView.orderId}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-baseline">
                        <span className="text-[#77736C]">Airline</span>
                        <span className="font-medium text-[#111111]">{selectedFlightView.carrier}</span>
                      </div>

                      {selectedFlightView.flightNumbers.length > 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Flight Numbers</span>
                          <span className="font-mono text-[#111111]">
                            {selectedFlightView.flightNumbers.join(', ')}
                          </span>
                        </div>
                      )}

                      {selectedFlightView.departureDate && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Departure</span>
                          <span className="font-medium text-[#111111]">
                            {selectedFlightView.departureDate}
                            {selectedFlightView.departureTime ? ` at ${selectedFlightView.departureTime}` : ''}
                          </span>
                        </div>
                      )}

                      {selectedFlightView.arrivalTime && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Arrival Time</span>
                          <span className="font-medium text-[#111111]">{selectedFlightView.arrivalTime}</span>
                        </div>
                      )}

                      {selectedFlightView.duration && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Flight Duration</span>
                          <span className="text-[#111111]">{selectedFlightView.duration}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#E8E4DC]/60">
                        <span className="text-[#77736C] block mb-1">Travelers</span>
                        {selectedFlightView.passengerNames.length > 0 ? (
                          <ul className="space-y-0.5">
                            {selectedFlightView.passengerNames.map((name, i) => (
                              <li key={i} className="font-medium text-[#111111]">{name}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="font-medium text-[#111111]">Confirmed Traveler</span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#E8E4DC]/60 flex items-center justify-between">
                        <div>
                          <span className="text-[#77736C] block mb-0.5">Linked Trip</span>
                          {linkedJourney ? (
                            <span className="font-semibold text-[#111111]">{linkedJourney.destination}</span>
                          ) : selectedFlightView.itineraryId ? (
                            <span className="text-[#77736C] italic">Trip no longer available</span>
                          ) : (
                            <span className="text-[#77736C]">Not linked to a trip</span>
                          )}
                        </div>
                        {linkedJourney && (
                          <button
                            type="button"
                            onClick={() => navigate('journey', { selectedJourneyId: linkedJourney.id })}
                            className="px-3 py-1 bg-[#FAFAF8] border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#F2EFE9]"
                            style={{ borderRadius: '2px' }}
                          >
                            View Trip
                          </button>
                        )}
                      </div>

                      <div className="flex justify-between items-baseline pt-2 border-t border-[#E8E4DC]/60">
                        <span className="font-bold text-[#111111]">Total Amount</span>
                        <span className="font-serif text-base font-bold text-[#111111]">
                          {selectedFlightView.formattedTotal}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => openBook('flights')}
                        className="w-full px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors text-center cursor-pointer"
                        style={{ borderRadius: '2px' }}
                      >
                        Search More Flights
                      </button>
                    </div>
                  </>
                ) : (
                  /* RECORDED BOOKING DETAIL */
                  <>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 mb-2">
                          Recorded by you
                        </span>
                        <h2 className="text-xl font-bold font-serif text-[#111111]">
                          {selectedItem.title}
                        </h2>
                        <p className="text-xs text-[#77736C] mt-0.5">
                          {KIND_META[selectedItem.kind]?.icon} {KIND_META[selectedItem.kind]?.label} · {selectedItem.provider}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                          selectedItem.status === 'cancelled'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]'
                            : 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                        }`}
                        style={{ borderRadius: '2px' }}
                      >
                        {selectedItem.status === 'cancelled' ? 'Cancelled' : 'Booked'}
                      </span>
                    </div>

                    <div className="mb-5 p-3 bg-[#FAFAF8] border border-[#E8E4DC] text-xs text-[#77736C]" style={{ borderRadius: '2px' }}>
                      Travalastic did not make this booking and can't verify it.
                    </div>

                    <div className="space-y-3 py-4 border-y border-[#E8E4DC] text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#77736C]">Provider</span>
                        <span className="font-medium text-[#111111]">{selectedItem.provider}</span>
                      </div>

                      <div className="flex justify-between items-baseline">
                        <span className="text-[#77736C]">Starts</span>
                        <span className="font-medium text-[#111111]">{formatDisplayDateTime(selectedItem.startAt)}</span>
                      </div>

                      {selectedItem.endAt && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Ends</span>
                          <span className="font-medium text-[#111111]">{formatDisplayDateTime(selectedItem.endAt)}</span>
                        </div>
                      )}

                      {selectedItem.reference && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Reference</span>
                          <span className="font-mono font-bold text-[#111111]">{selectedItem.reference}</span>
                        </div>
                      )}

                      {selectedItem.amount && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[#77736C]">Amount</span>
                          <span className="font-serif font-bold text-sm text-[#111111]">
                            {selectedItem.currency ? `${selectedItem.currency} ` : ''}{selectedItem.amount}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#E8E4DC]/60 flex items-center justify-between">
                        <div>
                          <span className="text-[#77736C] block mb-0.5">Linked Trip</span>
                          {linkedJourney ? (
                            <span className="font-semibold text-[#111111]">{linkedJourney.destination}</span>
                          ) : selectedItem.tripId ? (
                            <span className="text-[#77736C] italic">Trip no longer available</span>
                          ) : (
                            <span className="text-[#77736C]">Not linked to a trip</span>
                          )}
                        </div>
                        {linkedJourney && (
                          <button
                            type="button"
                            onClick={() => navigate('journey', { selectedJourneyId: linkedJourney.id })}
                            className="px-3 py-1 bg-[#FAFAF8] border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#F2EFE9]"
                            style={{ borderRadius: '2px' }}
                          >
                            View Trip
                          </button>
                        )}
                      </div>

                      {selectedItem.notes && (
                        <div className="pt-2 border-t border-[#E8E4DC]/60">
                          <span className="text-[#77736C] block mb-1">Notes</span>
                          <p className="text-[#111111] leading-relaxed whitespace-pre-line">{selectedItem.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(selectedItem)}
                        className="flex-1 px-3 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] cursor-pointer"
                        style={{ borderRadius: '2px' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === selectedItem.id}
                        onClick={() => handleToggleCancel(selectedItem)}
                        className="flex-1 px-3 py-2 border border-[#E8E4DC] bg-white text-[#111111] text-xs font-semibold hover:bg-[#FAFAF8] cursor-pointer"
                        style={{ borderRadius: '2px' }}
                      >
                        {selectedItem.status === 'cancelled' ? 'Mark booked' : 'Mark cancelled'}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === selectedItem.id}
                        onClick={() => setConfirmDeleteItem(selectedItem)}
                        className="px-3 py-2 border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] text-xs font-semibold hover:bg-red-100 cursor-pointer"
                        style={{ borderRadius: '2px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Recorded Booking Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E8E4DC] max-w-lg w-full p-6 shadow-xl my-8" style={{ borderRadius: '2px' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-[#111111]">
                  {editingId ? 'Edit Recorded Booking' : 'Add Recorded Booking'}
                </h2>
                <p className="text-xs text-[#77736C] mt-0.5">
                  Travalastic did not make this booking and can't verify it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-sm text-[#77736C] hover:text-[#111111]"
              >
                ✕
              </button>
            </div>

            {formServerError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700">
                {formServerError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Kind */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Booking Type *
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {RECORDED_BOOKING_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kind: k }))}
                      className={`py-2 px-1 text-[11px] font-semibold border text-center cursor-pointer ${
                        form.kind === k
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#77736C] border-[#E8E4DC] hover:text-[#111111]'
                      }`}
                      style={{ borderRadius: '2px' }}
                    >
                      <span className="block text-sm mb-0.5">{KIND_META[k].icon}</span>
                      {KIND_META[k].label}
                    </button>
                  ))}
                </div>
                {formErrors.kind && <p className="text-xs text-red-600 mt-1">{formErrors.kind}</p>}
              </div>

              {/* Title & Provider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Title * <span className="text-[#77736C] font-normal">(max 120)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="e.g. Palolem Beach Resort"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Provider * <span className="text-[#77736C] font-normal">(max 80)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Booking.com, Uber, IRCTC"
                    value={form.provider}
                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.provider && <p className="text-xs text-red-600 mt-1">{formErrors.provider}</p>}
                </div>
              </div>

              {/* Dates / Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Start Date / Time *
                  </label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:mm"
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.startAt && <p className="text-xs text-red-600 mt-1">{formErrors.startAt}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    End Date / Time <span className="text-[#77736C] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD or YYYY-MM-DDTHH:mm"
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.endAt && <p className="text-xs text-red-600 mt-1">{formErrors.endAt}</p>}
                </div>
              </div>

              {/* Reference, Amount, Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Reference <span className="text-[#77736C] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="Confirmation #"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.reference && <p className="text-xs text-red-600 mt-1">{formErrors.reference}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Amount <span className="text-[#77736C] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 4500.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.amount && <p className="text-xs text-red-600 mt-1">{formErrors.amount}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Currency <span className="text-[#77736C] font-normal">(3 letters)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="INR"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111] uppercase"
                    style={{ borderRadius: '2px' }}
                  />
                  {formErrors.currency && <p className="text-xs text-red-600 mt-1">{formErrors.currency}</p>}
                </div>
              </div>

              {/* Trip link & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Link to Trip <span className="text-[#77736C] font-normal">(optional)</span>
                  </label>
                  <select
                    value={form.tripId}
                    onChange={(e) => setForm((f) => ({ ...f, tripId: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111] bg-white"
                    style={{ borderRadius: '2px' }}
                  >
                    <option value="">Not linked</option>
                    {journeys.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.destination} ({j.startDate} – {j.endDate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RecordedBookingStatus }))}
                    className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111] bg-white"
                    style={{ borderRadius: '2px' }}
                  >
                    <option value="booked">Booked</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Notes <span className="text-[#77736C] font-normal">(plain text, max 300)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="Check-in info, seat number, pickup instructions…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E8E4DC] text-xs text-[#111111]"
                  style={{ borderRadius: '2px' }}
                />
                {formErrors.notes && <p className="text-xs text-red-600 mt-1">{formErrors.notes}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 border border-[#E8E4DC] text-xs font-semibold text-[#77736C] hover:text-[#111111] cursor-pointer"
                  style={{ borderRadius: '2px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] disabled:opacity-50 cursor-pointer"
                  style={{ borderRadius: '2px' }}
                >
                  {formSaving ? 'Saving…' : editingId ? 'Save changes' : 'Save booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E4DC] max-w-sm w-full p-6 shadow-xl" style={{ borderRadius: '2px' }}>
            <h3 className="text-lg font-bold font-serif text-[#111111] mb-2">
              Delete recorded booking?
            </h3>
            <p className="text-xs text-[#77736C] mb-5 leading-relaxed">
              This removes <strong>{confirmDeleteItem.title}</strong> ({confirmDeleteItem.provider}) from your Travalastic list. Your actual reservation with the provider is unaffected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 border border-[#E8E4DC] text-xs font-semibold text-[#77736C] cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusyId === confirmDeleteItem.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                style={{ borderRadius: '2px' }}
              >
                {actionBusyId === confirmDeleteItem.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
