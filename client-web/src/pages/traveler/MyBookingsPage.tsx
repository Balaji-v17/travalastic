import { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import type { Booking, Journey } from '../../data/mockData';

// ─── Types ────────────────────────────────────────────────────
type ServiceTab =
  | 'all' | 'flights' | 'hotels' | 'experiences'
  | 'transfers' | 'trains' | 'buses' | 'camps' | 'insurance' | 'visa';

type StatusFilter = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'needs-attention';

type DetailTab = 'overview' | 'details' | 'travelers' | 'documents' | 'payment' | 'cancellation';

const SERVICE_TABS: { id: ServiceTab; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '📋' },
  { id: 'flights', label: 'Flights', emoji: '✈️' },
  { id: 'hotels', label: 'Hotels', emoji: '🏨' },
  { id: 'experiences', label: 'Experiences', emoji: '🎫' },
  { id: 'transfers', label: 'Transfers', emoji: '🚗' },
  { id: 'trains', label: 'Trains', emoji: '🚂' },
  { id: 'buses', label: 'Buses', emoji: '🚌' },
  { id: 'camps', label: 'Camps', emoji: '⛺' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { id: 'visa', label: 'Visa', emoji: '🛂' },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'needs-attention', label: 'Needs Attention' },
];

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'travelers', label: 'Travelers' },
  { id: 'documents', label: 'Documents' },
  { id: 'payment', label: 'Payment' },
  { id: 'cancellation', label: 'Cancellation' },
];

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

function bookingDate(b: Booking): Date {
  return new Date(b.departureDate || b.checkIn || b.experienceDate || b.createdAt);
}

function isUpcoming(b: Booking): boolean {
  return bookingDate(b) >= new Date() && b.status !== 'cancelled' && b.status !== 'refunded';
}

function isPast(b: Booking): boolean {
  return bookingDate(b) < new Date() && b.status !== 'cancelled' && b.status !== 'refunded';
}

function needsAttention(b: Booking): boolean {
  return b.paymentStatus === 'failed' || b.status === 'pending';
}

function matchesServiceTab(b: Booking, tab: ServiceTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'flights') return b.type === 'flight';
  if (tab === 'hotels') return b.type === 'hotel';
  if (tab === 'experiences') return b.type === 'activity';
  return false;
}

function matchesStatusFilter(b: Booking, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'upcoming') return isUpcoming(b);
  if (filter === 'completed') return isPast(b);
  if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'refunded';
  if (filter === 'needs-attention') return needsAttention(b);
  return true;
}

function matchesSearch(b: Booking, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    b.referenceId.toLowerCase().includes(lower) ||
    b.supplierName.toLowerCase().includes(lower) ||
    b.itemName.toLowerCase().includes(lower) ||
    (b.pnr || '').toLowerCase().includes(lower) ||
    (b.itemDetails || '').toLowerCase().includes(lower)
  );
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ booking }: { booking: Booking }) {
  const attention = needsAttention(booking);
  if (attention) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ borderRadius: '2px', border: '1px solid #fecaca' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        Needs Attention
      </span>
    );
  }
  const map: Record<string, string> = {
    confirmed: 'bg-[#F7F5F0] text-[#252525] border border-[#E8E4DC]',
    pending: 'bg-amber-50 text-amber-700 border border-amber-100',
    cancelled: 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]',
    refunded: 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]',
  };
  const label: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${map[booking.status] || 'bg-[#F7F5F0] text-[#77736C] border border-[#E8E4DC]'}`} style={{ borderRadius: '2px' }}>
      {label[booking.status] || booking.status}
    </span>
  );
}

// ─── Next Upcoming Hero ───────────────────────────────────────
function NextUpcomingHero({
  booking,
  journey,
  onOpen,
  onJourneyClick,
}: {
  booking: Booking;
  journey: Journey | undefined;
  onOpen: () => void;
  onJourneyClick: (id: string) => void;
}) {
  const isHotel = booking.type === 'hotel';
  const isFlight = booking.type === 'flight';

  const primaryDate = isHotel
    ? `${formatDateShort(booking.checkIn)} – ${formatDateShort(booking.checkOut)}`
    : formatDate(booking.departureDate || booking.experienceDate || booking.createdAt);

  // Parse origin → destination from itemDetails for flights
  const [origin, destination] = (booking.itemDetails || '').split(' → ').map((s) => s.trim());

  return (
    <div className="relative overflow-hidden p-6 mb-8 text-white" style={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)', borderRadius: '2px' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#C9A96E]" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-[#C9A96E]" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#C9A96E]">Next Up</span>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          {journey && (
            <>
              <button
                onClick={() => onJourneyClick(journey.id)}
                className="text-[10px] font-semibold text-white/60 hover:text-white/90 transition-colors uppercase tracking-[0.12em]"
              >
                {journey.title}
              </button>
            </>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isFlight && origin && destination ? (
              <div className="flex items-center gap-3 mb-2">
                <span className="font-display font-bold text-3xl text-white">{origin}</span>
                <div className="flex items-center gap-1 text-white/30">
                  <div className="w-6 h-px bg-white/20" />
                  <span className="text-lg">✈️</span>
                  <div className="w-6 h-px bg-white/20" />
                </div>
                <span className="font-display font-bold text-3xl text-white">{destination}</span>
              </div>
            ) : (
              <h3 className="font-display text-2xl text-white mb-1">{booking.itemName}</h3>
            )}
            <p className="text-sm text-slate-300 mb-1">
              {booking.supplierName}
              {booking.pnr && <span className="ml-2 text-slate-400 font-mono text-xs">PNR: {booking.pnr}</span>}
            </p>
            <p className="text-base font-medium text-white/80">{primaryDate}</p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="font-sans font-bold text-2xl text-white">₹{formatAmount(booking.totalAmount)}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{booking.referenceId}</p>
          </div>
        </div>

        {/* Journey bookings summary */}
        {journey && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 mb-3">Journey includes</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Flight', emoji: '✈️', sub: booking.type === 'flight' ? booking.supplierName : null },
                { label: 'Hotel', emoji: '🏨', sub: null },
                { label: 'Experience', emoji: '🎫', sub: null },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-xs text-white/70" style={{ borderRadius: '2px' }}>
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onOpen}
            className="px-5 py-2 bg-white text-[#111111] text-sm font-semibold hover:bg-[#F7F5F0] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            View Details
          </button>
          {journey && (
            <button
              onClick={() => onJourneyClick(journey.id)}
              className="px-5 py-2 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors border border-white/30"
              style={{ borderRadius: '2px' }}
            >
              Open Journey →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Flight Card ──────────────────────────────────────────────
function FlightCard({ booking, journey, selected, onClick, onJourneyClick }: {
  booking: Booking; journey?: Journey; selected: boolean; onClick: () => void; onJourneyClick: (id: string) => void;
}) {
  const parts = (booking.itemDetails || '').split(' → ');
  const origin = parts[0]?.trim() || '—';
  const destination = parts[1]?.trim() || '—';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border transition-all ${
        selected
          ? 'border-[#C9A96E] bg-white hover:border-[#C9A96E]'
          : 'border-[#E8E4DC] bg-white hover:border-[#77736C]'
      }`}
      style={{
        borderRadius: '2px',
        backgroundColor: selected ? 'rgba(201,169,110,0.04)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>✈️</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display font-semibold text-[#111111] text-sm">{origin}</span>
                <span className="text-[#E8E4DC] text-xs">→</span>
                <span className="font-display font-semibold text-[#111111] text-sm">{destination}</span>
              </div>
              <p className="text-xs text-[#77736C] mb-1.5">
                {booking.supplierName}
                {booking.itemName.includes('·') ? ' · ' + booking.itemName.split('·')[1]?.trim() : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#77736C]">{formatDate(booking.departureDate)}</span>
                {booking.pnr && (
                  <span className="font-mono text-[10px] bg-[#F7F5F0] text-[#252525] px-1.5 py-0.5 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                    PNR: {booking.pnr}
                  </span>
                )}
                {booking.seat && (
                  <span className="text-[10px] text-[#77736C]">Seat {booking.seat}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-[#111111] text-sm">₹{formatAmount(booking.totalAmount)}</p>
              <StatusBadge booking={booking} />
            </div>
          </div>
          {journey && (
            <button
              onClick={(e) => { e.stopPropagation(); onJourneyClick(journey.id); }}
              className="mt-2 flex items-center gap-1 text-[10px] text-[#C9A96E] hover:text-[#b8955a] font-medium"
            >
              <span>🗺</span> {journey.title} →
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Hotel Card ───────────────────────────────────────────────
function HotelCard({ booking, journey, selected, onClick, onJourneyClick }: {
  booking: Booking; journey?: Journey; selected: boolean; onClick: () => void; onJourneyClick: (id: string) => void;
}) {
  const nights = booking.nights ||
    (booking.checkIn && booking.checkOut
      ? Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000)
      : null);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border transition-all ${
        selected
          ? 'border-[#C9A96E] bg-white hover:border-[#C9A96E]'
          : 'border-[#E8E4DC] bg-white hover:border-[#77736C]'
      }`}
      style={{
        borderRadius: '2px',
        backgroundColor: selected ? 'rgba(201,169,110,0.04)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>🏨</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-sans font-semibold text-[#111111] text-sm mb-0.5">{booking.supplierName}</p>
              {booking.roomType && (
                <p className="text-xs text-[#77736C] mb-1">{booking.roomType}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {booking.checkIn && booking.checkOut && (
                  <span className="text-xs text-[#77736C]">
                    {formatDateShort(booking.checkIn)} – {formatDateShort(booking.checkOut)}
                  </span>
                )}
                {nights && (
                  <span className="text-[10px] bg-[#F7F5F0] text-[#252525] px-1.5 py-0.5 border border-[#E8E4DC] font-medium" style={{ borderRadius: '2px' }}>
                    {nights} night{nights > 1 ? 's' : ''}
                  </span>
                )}
                {booking.passengers && (
                  <span className="text-[10px] text-[#77736C]">{booking.passengers} guest{booking.passengers > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-[#111111] text-sm">₹{formatAmount(booking.totalAmount)}</p>
              <StatusBadge booking={booking} />
            </div>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-[#77736C]">{booking.referenceId}</p>
          {journey && (
            <button
              onClick={(e) => { e.stopPropagation(); onJourneyClick(journey.id); }}
              className="mt-1 flex items-center gap-1 text-[10px] text-[#C9A96E] hover:text-[#b8955a] font-medium"
            >
              <span>🗺</span> {journey.title} →
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Experience Card ──────────────────────────────────────────
function ExperienceCard({ booking, journey, selected, onClick, onJourneyClick }: {
  booking: Booking; journey?: Journey; selected: boolean; onClick: () => void; onJourneyClick: (id: string) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border transition-all ${
        selected
          ? 'border-[#C9A96E] bg-white hover:border-[#C9A96E]'
          : 'border-[#E8E4DC] bg-white hover:border-[#77736C]'
      }`}
      style={{
        borderRadius: '2px',
        backgroundColor: selected ? 'rgba(201,169,110,0.04)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>🎫</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-sans font-semibold text-[#111111] text-sm mb-0.5">{booking.itemName}</p>
              <p className="text-xs text-[#77736C] mb-1">{booking.supplierName}</p>
              <div className="flex flex-wrap items-center gap-2">
                {(booking.experienceDate || booking.departureDate) && (
                  <span className="text-xs text-[#77736C]">{formatDate(booking.experienceDate || booking.departureDate)}</span>
                )}
                {booking.experienceTime && (
                  <span className="text-[10px] bg-[#F7F5F0] text-[#252525] px-1.5 py-0.5 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>{booking.experienceTime}</span>
                )}
                {booking.participants && (
                  <span className="text-[10px] text-[#77736C]">{booking.participants} participant{booking.participants > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-[#111111] text-sm">₹{formatAmount(booking.totalAmount)}</p>
              <StatusBadge booking={booking} />
            </div>
          </div>
          {booking.meetingPoint && (
            <p className="mt-1.5 text-[10px] text-[#77736C]">📍 {booking.meetingPoint}</p>
          )}
          {journey && (
            <button
              onClick={(e) => { e.stopPropagation(); onJourneyClick(journey.id); }}
              className="mt-1 flex items-center gap-1 text-[10px] text-[#C9A96E] hover:text-[#b8955a] font-medium"
            >
              <span>🗺</span> {journey.title} →
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Generic Card ─────────────────────────────────────────────
function GenericCard({ booking, journey, selected, onClick, onJourneyClick }: {
  booking: Booking; journey?: Journey; selected: boolean; onClick: () => void; onJourneyClick: (id: string) => void;
}) {
  const emojiMap: Record<string, string> = { flight: '✈️', hotel: '🏨', activity: '🎫', package: '📦' };
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border transition-all ${
        selected ? 'border-[#C9A96E] bg-white hover:border-[#C9A96E]' : 'border-[#E8E4DC] bg-white hover:border-[#77736C]'
      }`}
      style={{
        borderRadius: '2px',
        backgroundColor: selected ? 'rgba(201,169,110,0.04)' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
          {emojiMap[booking.type] || '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-sans font-semibold text-[#111111] text-sm mb-0.5">{booking.itemName}</p>
              <p className="text-xs text-[#77736C] mb-1">{booking.supplierName}</p>
              <span className="text-xs text-[#77736C]">{formatDate(booking.departureDate || booking.checkIn || booking.createdAt)}</span>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-[#111111] text-sm">₹{formatAmount(booking.totalAmount)}</p>
              <StatusBadge booking={booking} />
            </div>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-[#77736C]">{booking.referenceId}</p>
          {journey && (
            <button
              onClick={(e) => { e.stopPropagation(); onJourneyClick(journey.id); }}
              className="mt-1 flex items-center gap-1 text-[10px] text-[#C9A96E] hover:text-[#b8955a] font-medium"
            >
              <span>🗺</span> {journey.title} →
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Booking Card Router ──────────────────────────────────────
function BookingCard({ booking, journey, selected, onClick, onJourneyClick }: {
  booking: Booking; journey?: Journey; selected: boolean; onClick: () => void; onJourneyClick: (id: string) => void;
}) {
  const props = { booking, journey, selected, onClick, onJourneyClick };
  if (booking.type === 'flight') return <FlightCard {...props} />;
  if (booking.type === 'hotel') return <HotelCard {...props} />;
  if (booking.type === 'activity') return <ExperienceCard {...props} />;
  return <GenericCard {...props} />;
}

// ─── Detail Panel ─────────────────────────────────────────────
function DetailPanel({
  booking,
  journey,
  onClose,
  onJourneyClick,
  onNavigate,
}: {
  booking: Booking;
  journey?: Journey;
  onClose: () => void;
  onJourneyClick: (id: string) => void;
  onNavigate: (page: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');

  const origin = booking.type === 'flight' ? (booking.itemDetails || '').split(' → ')[0]?.trim() : null;
  const dest = booking.type === 'flight' ? (booking.itemDetails || '').split(' → ')[1]?.trim() : null;
  const nights = booking.nights ||
    (booking.checkIn && booking.checkOut
      ? Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000)
      : null);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-start gap-3 p-5 border-b border-[#E8E4DC]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge booking={booking} />
            <span className="text-[10px] text-slate-400 font-mono">{booking.referenceId}</span>
          </div>
          {booking.type === 'flight' && origin && dest ? (
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-xl text-slate-900">{origin}</span>
              <span className="text-slate-300">→</span>
              <span className="font-sans font-bold text-xl text-slate-900">{dest}</span>
            </div>
          ) : (
            <h2 className="font-sans font-bold text-xl text-slate-900 leading-tight">{booking.itemName}</h2>
          )}
          <p className="text-sm text-slate-500 mt-0.5">{booking.supplierName}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-[#77736C] hover:text-[#252525] hover:bg-[#F7F5F0] transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-[#E8E4DC] overflow-x-auto px-4 gap-1 flex-shrink-0">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#C9A96E] text-[#111111]'
                : 'border-transparent text-[#77736C] hover:text-[#252525]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Status', value: booking.status },
                { label: 'Booking Ref', value: booking.referenceId, mono: true },
                { label: 'Total Amount', value: `₹${formatAmount(booking.totalAmount)}` },
                { label: 'Booked On', value: formatDate(booking.createdAt) },
              ].map((item) => (
                <div key={item.label} className="bg-[#F7F5F0] p-3 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                  <p className="text-[10px] text-[#77736C] uppercase tracking-[0.12em] mb-1">{item.label}</p>
                  <p className={`text-sm font-semibold text-[#111111] ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#F7F5F0] p-4 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
              <p className="text-[10px] text-[#77736C] uppercase tracking-[0.12em] mb-2">Journey Connection</p>
              {journey ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">Part of {journey.title}</p>
                    <p className="text-xs text-[#77736C]">{journey.destination}</p>
                  </div>
                  <button
                    onClick={() => onJourneyClick(journey.id)}
                    className="text-xs text-[#C9A96E] font-semibold hover:text-[#b8955a]"
                  >
                    Open Journey →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#77736C]">Standalone booking</p>
              )}
            </div>
          </div>
        )}

        {tab === 'details' && (
          <div className="space-y-3">
            {booking.type === 'flight' && (
              <>
                <DetailRow label="Route" value={`${origin} → ${dest}`} />
                <DetailRow label="Airline" value={booking.supplierName} />
                <DetailRow label="Flight Number" value={booking.itemName.split('·')[0]?.trim() || booking.itemName} />
                <DetailRow label="Departure" value={formatDate(booking.departureDate)} />
                {booking.pnr && <DetailRow label="PNR" value={booking.pnr} mono />}
                {booking.seat && <DetailRow label="Seat" value={booking.seat} />}
                {booking.baggage && <DetailRow label="Baggage" value={booking.baggage} />}
                {booking.meal && <DetailRow label="Meal" value={booking.meal} />}
                {booking.passengers && <DetailRow label="Passengers" value={`${booking.passengers}`} />}
              </>
            )}
            {booking.type === 'hotel' && (
              <>
                <DetailRow label="Hotel" value={booking.supplierName} />
                {booking.roomType && <DetailRow label="Room Type" value={booking.roomType} />}
                <DetailRow label="Check-in" value={formatDate(booking.checkIn)} />
                <DetailRow label="Check-out" value={formatDate(booking.checkOut)} />
                {nights && <DetailRow label="Nights" value={`${nights} night${nights > 1 ? 's' : ''}`} />}
                {booking.passengers && <DetailRow label="Guests" value={`${booking.passengers}`} />}
                <DetailRow label="Confirmation" value={booking.referenceId} mono />
              </>
            )}
            {booking.type === 'activity' && (
              <>
                <DetailRow label="Experience" value={booking.itemName} />
                <DetailRow label="Operator" value={booking.supplierName} />
                <DetailRow label="Date" value={formatDate(booking.experienceDate || booking.departureDate)} />
                {booking.experienceTime && <DetailRow label="Time" value={booking.experienceTime} />}
                {booking.participants && <DetailRow label="Participants" value={`${booking.participants}`} />}
                {booking.meetingPoint && <DetailRow label="Meeting Point" value={booking.meetingPoint} />}
                <DetailRow label="Confirmation" value={booking.referenceId} mono />
              </>
            )}
          </div>
        )}

        {tab === 'travelers' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
              <div className="w-10 h-10 flex items-center justify-center bg-[#111111] text-white font-bold text-sm" style={{ borderRadius: '2px' }}>
                AR
              </div>
              <div>
                <p className="font-semibold text-[#111111] text-sm">Arjun Reddy</p>
                <p className="text-xs text-[#77736C]">Lead Traveler · Passport: A1234567</p>
              </div>
              <span className="ml-auto text-[10px] bg-[#F7F5F0] text-[#252525] border border-[#E8E4DC] px-2 py-0.5 font-bold uppercase tracking-[0.12em]" style={{ borderRadius: '2px' }}>Primary</span>
            </div>
            {(booking.passengers || 1) > 1 && (
              <div className="flex items-center gap-3 p-4 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                <div className="w-10 h-10 flex items-center justify-center bg-[#252525] text-white font-bold text-sm" style={{ borderRadius: '2px' }}>
                  +{(booking.passengers || 1) - 1}
                </div>
                <div>
                  <p className="font-semibold text-[#111111] text-sm">{(booking.passengers || 1) - 1} more traveler{(booking.passengers || 1) - 1 > 1 ? 's' : ''}</p>
                  <p className="text-xs text-[#77736C]">Details on record</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-3">
            {[
              {
                icon: booking.type === 'flight' ? '🎫' : '📄',
                label: booking.type === 'flight' ? 'E-Ticket' : booking.type === 'hotel' ? 'Hotel Voucher' : 'Booking Voucher',
                sub: booking.referenceId,
                action: 'Download PDF',
              },
              { icon: '🧾', label: 'Payment Receipt', sub: `₹${formatAmount(booking.totalAmount)}`, action: 'Download' },
            ].map((doc) => (
              <div key={doc.label} className="flex items-center gap-3 p-4 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                <span className="text-2xl">{doc.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[#111111] text-sm">{doc.label}</p>
                  <p className="text-xs text-[#77736C] font-mono">{doc.sub}</p>
                </div>
                <button className="text-xs text-[#C9A96E] font-semibold hover:text-[#b8955a] px-3 py-1.5 bg-[#F7F5F0] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                  {doc.action}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'payment' && (
          <div className="space-y-3">
            <div className="bg-[#F7F5F0] p-4 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
              <p className="text-[10px] text-[#77736C] uppercase tracking-[0.12em] mb-3">Payment Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#77736C]">Base fare</span>
                  <span className="font-medium text-[#111111]">₹{formatAmount(Math.round(booking.totalAmount * 0.85))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#77736C]">Taxes & fees</span>
                  <span className="font-medium text-[#111111]">₹{formatAmount(Math.round(booking.totalAmount * 0.15))}</span>
                </div>
                <div className="border-t border-[#E8E4DC] pt-2 flex justify-between">
                  <span className="font-semibold text-[#111111]">Total</span>
                  <span className="font-bold text-[#111111]">₹{formatAmount(booking.totalAmount)}</span>
                </div>
              </div>
            </div>
            <DetailRow label="Payment Status" value={booking.paymentStatus} />
            <DetailRow label="Currency" value={booking.currency} />
          </div>
        )}

        {tab === 'cancellation' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="font-semibold text-amber-800 text-sm mb-1">Cancellation Policy</p>
              <p className="text-xs text-amber-700">
                {booking.type === 'flight'
                  ? 'Free cancellation up to 24 hours before departure. Cancellation fee of ₹3,500 applies within 24 hours.'
                  : booking.type === 'hotel'
                  ? 'Free cancellation up to 48 hours before check-in. No refund for late cancellations.'
                  : 'Non-refundable. Cancellation may be possible up to 48 hours before the activity.'}
              </p>
            </div>
            {booking.status !== 'cancelled' && (
              <button className="w-full py-3 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-100" style={{ borderRadius: '2px' }}>
                Cancel This Booking
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="p-4 border-t border-[#E8E4DC] flex-shrink-0">
        <p className="text-[10px] text-[#77736C] uppercase tracking-[0.12em] mb-3">Actions</p>
        <div className="flex flex-wrap gap-2">
          {booking.type === 'flight' && <>
            <ActionBtn label="View Ticket" icon="🎫" />
            <ActionBtn label="Manage Seat" icon="💺" />
            <ActionBtn label="Manage Baggage" icon="🧳" />
            <ActionBtn label="Contact Support" icon="💬" onClick={() => onNavigate('support')} />
          </>}
          {booking.type === 'hotel' && <>
            <ActionBtn label="View Voucher" icon="📄" />
            <ActionBtn label="Get Directions" icon="📍" />
            <ActionBtn label="Contact Hotel" icon="📞" />
            <ActionBtn label="Contact Support" icon="💬" onClick={() => onNavigate('support')} />
          </>}
          {booking.type === 'activity' && <>
            <ActionBtn label="View Voucher" icon="📄" />
            <ActionBtn label="Add to Calendar" icon="📅" />
            <ActionBtn label="Directions" icon="📍" />
            <ActionBtn label="Contact Host" icon="💬" />
          </>}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#E8E4DC] last:border-0">
      <span className="text-xs text-[#77736C]">{label}</span>
      <span className={`text-sm font-medium text-[#111111] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ActionBtn({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 bg-[#F7F5F0] hover:bg-[#E8E4DC] text-xs font-medium text-[#252525] transition-colors border border-[#E8E4DC]"
      style={{ borderRadius: '2px' }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}

// ─── Travel Documents Section ─────────────────────────────────
function TravelDocumentsSection({ bookings, onSelect }: { bookings: Booking[]; onSelect: (b: Booking) => void }) {
  const docs = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  if (docs.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-[#252525] mb-3 flex items-center gap-2">
        <span>📁</span> Travel Documents
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {docs.map((b) => {
          const icon = b.type === 'flight' ? '🎫' : b.type === 'hotel' ? '🏷️' : '📄';
          const label = b.type === 'flight' ? 'E-Ticket' : b.type === 'hotel' ? 'Hotel Voucher' : 'Experience Voucher';
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="flex items-center gap-3 p-3 bg-white border border-[#E8E4DC] hover:border-[#77736C] transition-all text-left"
              style={{ borderRadius: '2px' }}
            >
              <span className="text-xl">{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#252525] truncate">{label}</p>
                <p className="text-[10px] text-[#77736C] truncate">{b.supplierName} · {b.referenceId}</p>
              </div>
              <span className="text-xs text-[#C9A96E] flex-shrink-0">View →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="mb-6">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#77736C]">
          <rect x="8" y="18" width="32" height="22" rx="0" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M16 18V14C16 11.8 17.8 10 20 10H28C30.2 10 32 11.8 32 14V18" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <line x1="8" y1="28" x2="40" y2="28" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="24" y1="28" x2="24" y2="40" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </div>
      <h3 className="font-display text-2xl text-[#111111] mb-2">Your journey starts here.</h3>
      <p className="text-[#77736C] text-sm mb-8">You haven't booked anything yet.</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {[
          { label: 'Find a Flight', emoji: '✈️', page: 'search' },
          { label: 'Find a Hotel', emoji: '🏨', page: 'search' },
          { label: 'Explore Experiences', emoji: '🎫', page: 'explore' },
          { label: 'Plan with Journey AI', emoji: '🤖', page: 'ai-planner' },
        ].map((cta) => (
          <button
            key={cta.label}
            onClick={() => onNavigate(cta.page)}
            className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-[#F7F5F0] border border-[#E8E4DC] hover:border-[#77736C] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            <span className="text-2xl">{cta.emoji}</span>
            <span className="text-xs font-semibold text-[#252525]">{cta.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function MyBookingsPage() {
  const { bookings, journeys, navigate } = useApp();
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailTab] = useState<DetailTab>('overview');

  void detailTab;

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const upcoming = bookings.filter(isUpcoming).length;
    const completed = bookings.filter(isPast).length;
    const attention = bookings.filter(needsAttention).length;
    return { total, upcoming, completed, attention };
  }, [bookings]);

  // Next upcoming
  const nextUpcoming = useMemo(() => {
    const upcoming = bookings
      .filter((b) => isUpcoming(b) && b.status !== 'cancelled')
      .sort((a, b) => bookingDate(a).getTime() - bookingDate(b).getTime());
    return upcoming[0] || null;
  }, [bookings]);

  // Filtered list
  const filtered = useMemo(() => {
    return bookings
      .filter((b) => matchesServiceTab(b, serviceTab))
      .filter((b) => matchesStatusFilter(b, statusFilter))
      .filter((b) => matchesSearch(b, searchQuery))
      .sort((a, b) => bookingDate(b).getTime() - bookingDate(a).getTime());
  }, [bookings, serviceTab, statusFilter, searchQuery]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) || null;

  function getJourney(booking: Booking): Journey | undefined {
    if (!booking.journeyId || booking.journeyId === 'standalone') return undefined;
    return journeys.find((j) => j.id === booking.journeyId);
  }

  function handleJourneyClick(journeyId: string) {
    navigate('journey', { selectedJourneyId: journeyId });
  }

  function handleNavigate(page: string) {
    navigate(page as Parameters<typeof navigate>[0]);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F5F0' }}>
      {/* Hero */}
      <div className="border-b border-[#E8E4DC]" style={{ backgroundColor: '#F7F5F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="font-display text-3xl text-[#111111] mb-1">My Bookings</h1>
          <p className="text-sm text-[#77736C] mb-6">Everything you've reserved, in one place.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'Total', value: stats.total, numColor: 'text-[#111111]', warn: false },
              { label: 'Upcoming', value: stats.upcoming, numColor: 'text-[#C9A96E]', warn: false },
              { label: 'Completed', value: stats.completed, numColor: 'text-[#111111]', warn: false },
              { label: 'Needs Attention', value: stats.attention, numColor: stats.attention > 0 ? 'text-red-600' : 'text-[#77736C]', warn: stats.attention > 0 },
            ] as { label: string; value: number; numColor: string; warn: boolean }[]).map((s) => (
              <div
                key={s.label}
                className={`p-3 border cursor-pointer transition-all ${
                  s.warn ? 'bg-red-50 border-red-100' : 'bg-white border-[#E8E4DC] hover:border-[#77736C]'
                }`}
                style={{ borderRadius: '2px' }}
                onClick={() => {
                  if (s.label === 'Upcoming') setStatusFilter('upcoming');
                  else if (s.label === 'Completed') setStatusFilter('completed');
                  else if (s.label === 'Needs Attention') setStatusFilter('needs-attention');
                  else setStatusFilter('all');
                }}
              >
                <p className={`text-2xl font-bold ${s.numColor}`}>{s.value}</p>
                <p className="text-[10px] text-[#77736C] mt-0.5 uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
          {SERVICE_TABS.map((t) => {
            const count = t.id === 'all' ? bookings.length
              : t.id === 'flights' ? bookings.filter((b) => b.type === 'flight').length
              : t.id === 'hotels' ? bookings.filter((b) => b.type === 'hotel').length
              : t.id === 'experiences' ? bookings.filter((b) => b.type === 'activity').length
              : 0;
            return (
              <button
                key={t.id}
                onClick={() => setServiceTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-all ${
                  serviceTab === t.id
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#77736C] border border-[#E8E4DC] hover:border-[#77736C]'
                }`}
                style={{ borderRadius: '2px' }}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                    serviceTab === t.id ? 'bg-white/20 text-white' : 'bg-[#F7F5F0] text-[#77736C]'
                  }`} style={{ borderRadius: '2px' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Status filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#77736C] text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by reference, destination, hotel, airline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E8E4DC] text-sm text-[#111111] placeholder:text-[#77736C] focus:outline-none focus:ring-2 focus:border-[#C9A96E]"
              style={{ borderRadius: '2px', boxShadow: 'none' }}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`flex-shrink-0 px-3 py-2 text-xs font-semibold transition-all ${
                  statusFilter === f.id
                    ? f.id === 'needs-attention'
                      ? 'bg-red-600 text-white'
                      : 'bg-[#111111] text-white'
                    : 'bg-white border border-[#E8E4DC] text-[#77736C] hover:border-[#77736C]'
                }`}
                style={{ borderRadius: '2px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content: list + detail panel */}
        {bookings.length === 0 ? (
          <EmptyState onNavigate={handleNavigate} />
        ) : (
          <div className={`flex gap-6 ${selectedBooking ? 'items-start' : ''}`}>
            {/* Left: List */}
            <div className={`flex-1 min-w-0 ${selectedBooking ? 'lg:max-w-[420px]' : ''}`}>
              {/* Next upcoming featured card */}
              {nextUpcoming && statusFilter === 'all' && serviceTab === 'all' && !searchQuery && (
                <NextUpcomingHero
                  booking={nextUpcoming}
                  journey={getJourney(nextUpcoming)}
                  onOpen={() => setSelectedBookingId(nextUpcoming.id)}
                  onJourneyClick={handleJourneyClick}
                />
              )}

              {/* Booking list */}
              {filtered.length > 0 ? (
                <div className="space-y-2">
                  {filtered.map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      journey={getJourney(b)}
                      selected={b.id === selectedBookingId}
                      onClick={() => setSelectedBookingId(b.id === selectedBookingId ? null : b.id)}
                      onJourneyClick={handleJourneyClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-slate-400 text-sm">No bookings match this filter.</p>
                  <button
                    onClick={() => { setStatusFilter('all'); setServiceTab('all'); setSearchQuery(''); }}
                    className="mt-3 text-xs text-[#C9A96E] font-semibold hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              <TravelDocumentsSection bookings={bookings} onSelect={(b) => setSelectedBookingId(b.id)} />
            </div>

            {/* Right: Detail panel */}
            {selectedBooking && (
              <div className="hidden lg:flex flex-col flex-shrink-0 w-[400px] bg-white border border-[#E8E4DC] shadow-sm overflow-hidden max-h-[calc(100vh-160px)] sticky top-[80px]" style={{ borderRadius: '2px' }}>
                <DetailPanel
                  booking={selectedBooking}
                  journey={getJourney(selectedBooking)}
                  onClose={() => setSelectedBookingId(null)}
                  onJourneyClick={handleJourneyClick}
                  onNavigate={handleNavigate}
                />
              </div>
            )}
          </div>
        )}

        {/* Mobile detail drawer */}
        {selectedBooking && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSelectedBookingId(null)}>
            <div
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <DetailPanel
                booking={selectedBooking}
                journey={getJourney(selectedBooking)}
                onClose={() => setSelectedBookingId(null)}
                onJourneyClick={handleJourneyClick}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
