import { useState, useMemo } from 'react';
import { useApp } from '../../../store/AppContext';
import { flights, currentTraveler, type Flight, type Booking } from '../../../data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TravelerForm {
  fullName: string;
  dob: string;
  gender: string;
  nationality: string;
  passport: string;
  passportExpiry: string;
  email: string;
  phone: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['Summary', 'Fare', 'Travelers', 'Seats', 'Baggage', 'Meals & Extras', 'Review', 'Payment', 'Confirmation'];

const OCCUPIED_SEATS = new Set([
  '1A','1D','2C','2F','3B','4A','4F',
  '5A','6C',
  '7B','7E','8A','8D','9C','9F','10B','10E',
  '11A','11D','12C','13B','13E','14A','14F',
  '15C','16D','17A','17E','18B','18F','19C',
  '20A','20D','21B','21E','22C','22F','23A',
  '24D','25B','25E','26A','26F','27C','28D',
  '29B','29E','30A','30F',
]);

const AIRLINE_COLORS: Record<string, string> = {
  '6E': 'bg-indigo-600',
  'AI': 'bg-red-600',
  'SG': 'bg-orange-500',
  'UK': 'bg-purple-600',
  'G8': 'bg-green-600',
  'QR': 'bg-violet-700',
  'EK': 'bg-rose-600',
  'SQ': 'bg-yellow-600',
};

const EXTRA_PRICES: Record<string, number> = {
  'priority-boarding': 699,
  'lounge-access': 1500,
  'travel-insurance': 999,
  'airport-transfer': 1800,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function generatePNR(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getSeatRow(seat: string): number {
  return parseInt(seat.replace(/[A-F]/g, ''), 10);
}

function getSeatPrice(seat: string): number {
  const row = getSeatRow(seat);
  if (row >= 1 && row <= 4) return 0;
  if (row >= 5 && row <= 6) return 800;
  if (row >= 7 && row <= 15) return 500;
  return 0;
}

function getSeatLabel(seat: string): string {
  const col = seat.slice(-1);
  const row = getSeatRow(seat);
  const colLabel = col === 'A' || col === 'F' ? 'Window' : col === 'B' || col === 'E' ? 'Middle' : 'Aisle';
  const type = row <= 4 ? 'Business' : row <= 6 ? 'Exit row · Extra legroom' : 'Standard';
  return `${colLabel} · Row ${row} · ${type}`;
}

function getBaggageIncluded(fare: string): number {
  if (fare === 'saver') return 15;
  if (fare === 'standard') return 20;
  if (fare === 'flex') return 25;
  return 35; // business
}

function getExtraKgPrice(kg: number): number {
  if (kg === 5) return 500;
  if (kg === 10) return 900;
  if (kg === 15) return 1300;
  if (kg === 20) return 1700;
  return 0;
}

function defaultTravelerForm(): TravelerForm {
  return {
    fullName: currentTraveler.name,
    dob: '1988-05-15',
    gender: 'Male',
    nationality: currentTraveler.nationality || 'Indian',
    passport: currentTraveler.passportNumber,
    passportExpiry: '2030-05-14',
    email: currentTraveler.email,
    phone: currentTraveler.phone,
  };
}

function emptyTravelerForm(): TravelerForm {
  return { fullName: '', dob: '', gender: 'Male', nationality: 'Indian', passport: '', passportExpiry: '', email: '', phone: '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepProgress({ step, onStepClick }: { step: number; onStepClick: (s: number) => void }) {
  if (step === 8) return null;
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center gap-1 min-w-max px-4">
        {STEPS.slice(0, 8).map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={i} className="flex items-center gap-1">
              <button
                onClick={() => done ? onStepClick(i) : undefined}
                disabled={!done}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  done ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' :
                  current ? 'border-2 border-blue-600 text-blue-600 bg-blue-50 cursor-default' :
                  'border border-slate-200 text-slate-400 bg-white cursor-not-allowed opacity-60'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  done ? 'bg-white text-blue-600' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {done ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < 7 && <div className={`w-4 h-px ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AirlineBadge({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' }) {
  const bg = AIRLINE_COLORS[code] || 'bg-slate-600';
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} ${bg} rounded-xl flex items-center justify-center text-white font-bold font-mono shrink-0`}>
      {code}
    </div>
  );
}

function PriceSummary({
  flight, fare, farePrice, seats, baggage, extras, travelers,
}: {
  flight: Flight; fare: string; farePrice: number;
  seats: Record<number, string>; baggage: Record<number, number>;
  extras: Set<string>; travelers: TravelerForm[];
}) {
  const count = travelers.length;
  const base = farePrice * count;
  const taxes = Math.round(base * 0.18);
  const seatTotal = Object.values(seats).reduce((s, seat) => s + getSeatPrice(seat), 0);
  const baggageTotal = Object.values(baggage).reduce((s, kg) => s + getExtraKgPrice(kg), 0) * count;
  const extrasTotal = [...extras].reduce((s, e) => s + (EXTRA_PRICES[e] || 0), 0) * count;
  const total = base + taxes + seatTotal + baggageTotal + extrasTotal;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">Price Summary</h3>
      <div className="text-xs text-slate-500 space-y-0.5">
        <div className="font-medium text-slate-700">{flight.airline} {flight.flightNumber}</div>
        <div>{flight.fromCode} → {flight.toCode}</div>
      </div>
      <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Fare ({fare}) × {count}</span>
          <span className="font-medium">{formatINR(base)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Taxes & fees (18%)</span>
          <span className="font-medium">{formatINR(taxes)}</span>
        </div>
        {seatTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Seats</span>
            <span className="font-medium">{formatINR(seatTotal)}</span>
          </div>
        )}
        {baggageTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Extra baggage</span>
            <span className="font-medium">{formatINR(baggageTotal)}</span>
          </div>
        )}
        {extrasTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Extras</span>
            <span className="font-medium">{formatINR(extrasTotal)}</span>
          </div>
        )}
        <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-sm">
          <span>Total</span>
          <span className="text-blue-600">{formatINR(total)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded-lg px-3 py-2">
        <span>🔒</span>
        <span>Secure Booking · 256-bit SSL</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FlightBookingFlow() {
  const { bookingFlow, confirmBooking, navigate, updateItineraryItemStatus, journeys } = useApp();

  // Resolve flight
  const flightOrNull: Flight | undefined = useMemo(() => {
    if (!bookingFlow || bookingFlow.type !== 'flight') return undefined;
    return flights.find(f => f.id === bookingFlow.itemId) || flights[0];
  }, [bookingFlow]);

  // Step state
  const [step, setStep] = useState(0);

  // Fare selection
  const [selectedFare, setSelectedFare] = useState<'saver' | 'standard' | 'flex' | 'business'>('standard');

  // Traveler forms
  const [travelers, setTravelers] = useState<TravelerForm[]>([defaultTravelerForm()]);

  // Seat selection
  const [seats, setSeats] = useState<Record<number, string>>({});
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  // Baggage (extra kg per traveler)
  const [baggage, setBaggage] = useState<Record<number, number>>({});

  // Meals per traveler
  const [meals, setMeals] = useState<Record<number, string>>({ 0: 'Vegetarian Indian' });

  // Extras
  const [extras, setExtras] = useState<Set<string>>(new Set());

  // Review confirm checkbox
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking' | 'wallet'>('card');
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('SBI');

  // Confirmation state
  const [pnr, setPnr] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Seat map expanded details
  const [showFlightDetails, setShowFlightDetails] = useState(false);

  if (!flightOrNull) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No flight selected.
      </div>
    );
  }

  const flight: Flight = flightOrNull;

  // ── Fare prices ──────────────────────────────────────────────
  const farePrices = {
    saver: Math.round(flight.price * 0.9),
    standard: flight.price,
    flex: Math.round(flight.price * 1.35),
    business: flight.businessPrice || Math.round(flight.price * 2.8),
  };
  const farePrice = farePrices[selectedFare];

  // ── Totals ───────────────────────────────────────────────────
  const count = travelers.length;
  const base = farePrice * count;
  const taxes = Math.round(base * 0.18);
  const seatTotal = Object.values(seats).reduce((s, seat) => s + getSeatPrice(seat), 0);
  const baggageTotal = Object.values(baggage).reduce((s, kg) => s + getExtraKgPrice(kg), 0) * count;
  const extrasTotal = [...extras].reduce((s, e) => s + (EXTRA_PRICES[e] || 0), 0) * count;
  const totalPrice = base + taxes + seatTotal + baggageTotal + extrasTotal;

  // ── Navigation helpers ────────────────────────────────────────
  function goNext() { setStep(s => Math.min(s + 1, 8)); }
  function goBack() { setStep(s => Math.max(s - 1, 0)); }

  // ── Traveler helpers ─────────────────────────────────────────
  function updateTraveler(idx: number, field: keyof TravelerForm, value: string) {
    setTravelers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }

  function travelersValid(): boolean {
    return travelers.every(t => t.fullName.trim() && t.dob);
  }

  // ── Payment submit ────────────────────────────────────────────
  function handlePay() {
    const newPnr = generatePNR();
    const bookingId = 'bk-' + newPnr;
    const booking: Booking = {
      id: bookingId,
      journeyId: bookingFlow?.journeyId || 'standalone',
      travelerId: 'traveler-1',
      type: 'flight',
      status: 'confirmed',
      referenceId: newPnr,
      supplierId: flight.airlineCode,
      supplierName: flight.airline,
      itemName: `${flight.airline} ${flight.flightNumber} · ${flight.fromCode} → ${flight.toCode}`,
      itemDetails: `${flight.departureTime} → ${flight.arrivalTime} · ${flight.duration}`,
      totalAmount: totalPrice,
      currency: 'INR',
      paymentStatus: 'successful',
      createdAt: new Date().toISOString(),
      passengers: travelers.length,
    };
    setPnr(newPnr);
    setConfirmedBooking(booking);
    setStep(8);
  }

  // ── Confirmation navigation ───────────────────────────────────
  function handleConfirmNavigate() {
    if (!confirmedBooking) return;
    if (bookingFlow?.journeyId && bookingFlow?.itineraryItemId) {
      updateItineraryItemStatus(bookingFlow.journeyId, bookingFlow.itineraryItemId, 'booked', confirmedBooking.id);
    }
    confirmBooking(confirmedBooking);
  }

  // ─── Step 0: Summary ──────────────────────────────────────────────────────
  function renderSummary() {
    const airlineColor = AIRLINE_COLORS[flight.airlineCode] || 'bg-slate-600';
    return (
      <div className="space-y-6">
        {/* Airline header */}
        <div className="flex items-center gap-4">
          <AirlineBadge code={flight.airlineCode} size="lg" />
          <div>
            <div className="text-lg font-semibold text-slate-900">{flight.airline}</div>
            <div className="text-sm text-slate-500">{flight.flightNumber} · {flight.aircraft}</div>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${airlineColor}`}>
              {flight.status.charAt(0).toUpperCase() + flight.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Route timeline */}
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-slate-900">{flight.departureTime}</div>
              <div className="text-2xl font-display font-bold text-blue-600 mt-1">{flight.fromCode}</div>
              <div className="text-sm text-slate-500 mt-0.5">{flight.from}</div>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-slate-500 font-medium">{flight.duration}</div>
              <div className="w-full flex items-center gap-1">
                <div className="h-px flex-1 bg-slate-300" />
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
                <div className="h-px flex-1 bg-slate-300" />
              </div>
              <div className="text-xs text-slate-400">
                {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}${flight.stopCity ? ` · ${flight.stopCity}` : ''}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-slate-900">{flight.arrivalTime}</div>
              <div className="text-2xl font-display font-bold text-blue-600 mt-1">{flight.toCode}</div>
              <div className="text-sm text-slate-500 mt-0.5">{flight.to}</div>
            </div>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
            ✈ {flight.aircraft}
          </span>
          <span className="px-3 py-1.5 bg-blue-50 rounded-full text-xs font-medium text-blue-700">
            💼 {flight.baggageIncluded}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${flight.refundable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {flight.refundable ? '✓ Refundable' : '✗ Non-refundable'}
          </span>
          <span className="px-3 py-1.5 bg-violet-50 rounded-full text-xs font-medium text-violet-700">
            {flight.fareType}
          </span>
          {flight.seatsLeft < 10 && (
            <span className="px-3 py-1.5 bg-amber-50 rounded-full text-xs font-medium text-amber-700">
              ⚠ Only {flight.seatsLeft} seats left
            </span>
          )}
        </div>

        {/* Expandable flight details */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowFlightDetails(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>Flight details</span>
            <span className={`transition-transform ${showFlightDetails ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showFlightDetails && (
            <div className="border-t border-slate-100 px-4 py-4 space-y-3 text-sm text-slate-600 bg-slate-50">
              <div className="flex justify-between">
                <span className="text-slate-500">Aircraft</span>
                <span>{flight.aircraft}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class</span>
                <span>{flight.class}</span>
              </div>
              {flight.stops > 0 && flight.stopCity && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Layover</span>
                  <span>{flight.stopCity}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in</span>
                <span>Opens 24h before departure</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal</span>
                <span>T2 (Chhatrapati Shivaji Maharaj)</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={goNext}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
        >
          Continue to Fare Selection →
        </button>
      </div>
    );
  }

  // ─── Step 1: Fare Selection ───────────────────────────────────────────────
  function renderFareSelection() {
    type FareKey = 'saver' | 'standard' | 'flex' | 'business';
    const fares: { key: FareKey; name: string; tag?: string; price: number; cabin: string; checkedBag: string; seat: string; meals: string; cancellation: string; dateChange: string; refund: string; lounge: boolean }[] = [
      {
        key: 'saver', name: 'Saver', price: farePrices.saver,
        cabin: 'Economy', checkedBag: '15 kg', seat: 'Not included',
        meals: 'Not included', cancellation: 'Non-refundable', dateChange: 'Not allowed', refund: 'No refund', lounge: false,
      },
      {
        key: 'standard', name: 'Standard', tag: 'Most Popular', price: farePrices.standard,
        cabin: 'Economy', checkedBag: '20 kg', seat: 'Included',
        meals: 'Included', cancellation: 'Non-refundable', dateChange: '₹3,000 fee', refund: 'No refund', lounge: false,
      },
      {
        key: 'flex', name: 'Flex', price: farePrices.flex,
        cabin: 'Economy', checkedBag: '25 kg', seat: 'Included + Lounge',
        meals: 'Included', cancellation: 'Partial refund', dateChange: 'Free', refund: 'Partial', lounge: true,
      },
      ...(flight.businessPrice ? [{
        key: 'business' as FareKey, name: 'Business', tag: 'Premium', price: farePrices.business,
        cabin: 'Business', checkedBag: '35 kg', seat: 'Lie-flat included',
        meals: 'Premium dining', cancellation: 'Fully refundable', dateChange: 'Free', refund: 'Full refund', lounge: true,
      }] : []),
    ];

    const rows: { label: string; key: keyof typeof fares[0] }[] = [
      { label: 'Cabin', key: 'cabin' },
      { label: 'Checked Bag', key: 'checkedBag' },
      { label: 'Seat Selection', key: 'seat' },
      { label: 'Meals', key: 'meals' },
      { label: 'Cancellation', key: 'cancellation' },
      { label: 'Date Change', key: 'dateChange' },
      { label: 'Refund', key: 'refund' },
    ];

    function cellStyle(val: string) {
      if (val === 'Not included' || val === 'Not allowed' || val === 'Non-refundable' || val === 'No refund') {
        return 'text-rose-500 text-xs';
      }
      if (val.includes('₹') || val === 'Partial' || val === 'Partial refund') {
        return 'text-amber-600 text-xs font-medium';
      }
      return 'text-emerald-600 text-xs font-medium';
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Choose Your Fare</h2>
          <p className="text-sm text-slate-500 mt-1">Select the fare that suits your travel needs</p>
        </div>

        <div className={`grid gap-4 ${fares.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {fares.map(fare => {
            const active = selectedFare === fare.key;
            return (
              <div
                key={fare.key}
                onClick={() => setSelectedFare(fare.key)}
                className={`relative rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${
                  active ? 'border-blue-600 bg-blue-50 shadow-blue-100 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {fare.tag && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                    fare.key === 'business' ? 'bg-violet-600' : 'bg-blue-600'
                  }`}>
                    {fare.tag}
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div>
                    <div className={`font-bold text-base ${active ? 'text-blue-700' : 'text-slate-800'}`}>{fare.name}</div>
                    <div className={`text-lg font-semibold mt-1 ${active ? 'text-blue-600' : 'text-slate-900'}`}>
                      {formatINR(fare.price)}
                    </div>
                    <div className="text-[10px] text-slate-400">per person</div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    {rows.map(row => (
                      <div key={row.key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{row.label}</span>
                        <span className={cellStyle(String(fare[row.key]))}>{String(fare[row.key])}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFare(fare.key); goNext(); }}
                    className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {active ? 'Selected ✓' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button onClick={goNext} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">Continue →</button>
        </div>
      </div>
    );
  }

  // ─── Step 2: Traveler Details ─────────────────────────────────────────────
  function renderTravelers() {
    const isInternational = flight.stops > 0 || !['BOM','DEL','BLR','MAA','HYD','CCU','PNQ','GOI'].includes(flight.toCode);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Traveler Details</h2>
          <p className="text-sm text-slate-500 mt-1">Please enter details exactly as they appear on your travel documents</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
          ℹ Details for Adult 1 pre-filled from your Travel Identity. Please verify before proceeding.
        </div>

        {travelers.map((t, idx) => (
          <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="font-semibold text-slate-800 text-sm">Adult {idx + 1}</span>
              {idx > 0 && (
                <button
                  onClick={() => setTravelers(prev => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-rose-500 hover:text-rose-700"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={t.fullName}
                    onChange={e => updateTraveler(idx, 'fullName', e.target.value)}
                    placeholder="As on passport"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={t.dob}
                    onChange={e => updateTraveler(idx, 'dob', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                  <div className="flex gap-2">
                    {['Male', 'Female', 'Other'].map(g => (
                      <button
                        key={g}
                        onClick={() => updateTraveler(idx, 'gender', g)}
                        className={`flex-1 py-2 text-xs rounded-lg border font-medium transition-colors ${
                          t.gender === g ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={t.nationality}
                    onChange={e => updateTraveler(idx, 'nationality', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {isInternational && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Passport Number</label>
                      <input
                        type="text"
                        value={t.passport}
                        onChange={e => updateTraveler(idx, 'passport', e.target.value)}
                        placeholder="P1234567"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono uppercase focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Passport Expiry</label>
                      <input
                        type="date"
                        value={t.passportExpiry}
                        onChange={e => updateTraveler(idx, 'passportExpiry', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {idx === 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Details</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={t.email}
                        onChange={e => updateTraveler(idx, 'email', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={t.phone}
                        onChange={e => updateTraveler(idx, 'phone', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => setTravelers(prev => [...prev, emptyTravelerForm()])}
          className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          + Add Another Traveler
        </button>

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button
            onClick={goNext}
            disabled={!travelersValid()}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            Continue to Seat Selection →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Seat Map ──────────────────────────────────────────────────────
  function renderSeats() {
    const showBusiness = selectedFare === 'business';
    const allRows = [
      ...(showBusiness ? [1, 2, 3, 4] : []),
      5, 6,
      ...Array.from({ length: 24 }, (_, i) => i + 7),
    ];

    function getSeatBg(seat: string, row: number): string {
      const selectedBy = Object.entries(seats).find(([, s]) => s === seat);
      if (selectedBy) return 'bg-blue-600 text-white border-blue-600';
      if (OCCUPIED_SEATS.has(seat)) return 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-200';
      if (row <= 4) return 'border-violet-300 hover:bg-violet-50 text-slate-700 cursor-pointer';
      if (row <= 6) return 'border-amber-300 hover:bg-amber-50 text-slate-700 cursor-pointer';
      if (row <= 15) return 'border-blue-200 hover:bg-blue-50 text-slate-700 cursor-pointer';
      return 'border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer';
    }

    function handleSeatClick(seat: string) {
      if (OCCUPIED_SEATS.has(seat)) return;
      // Find which traveler is being assigned (cycle through)
      const assignedCount = Object.keys(seats).length;
      const nextTravelerIdx = assignedCount < travelers.length ? assignedCount : 0;
      // If seat already selected by someone, deselect
      const existingEntry = Object.entries(seats).find(([, s]) => s === seat);
      if (existingEntry) {
        setSeats(prev => {
          const next = { ...prev };
          delete next[Number(existingEntry[0])];
          return next;
        });
        return;
      }
      setSeats(prev => ({ ...prev, [nextTravelerIdx]: seat }));
    }

    const seatPrice = (row: number) => row <= 4 ? 0 : row <= 6 ? 800 : row <= 15 ? 500 : 0;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Select Your Seats</h2>
          <p className="text-sm text-slate-500 mt-1">Click a seat to select. Each traveler gets one seat.</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { color: 'bg-white border-slate-200', label: 'Available' },
            { color: 'bg-blue-600 border-blue-600', label: 'Selected' },
            { color: 'bg-slate-200 border-slate-200', label: 'Occupied' },
            { color: 'bg-amber-50 border-amber-300', label: 'Exit row +₹800' },
            { color: 'bg-blue-50 border-blue-200', label: 'Preferred +₹500' },
            ...(showBusiness ? [{ color: 'bg-violet-50 border-violet-300', label: 'Business' }] : []),
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded border ${l.color}`} />
              <span className="text-slate-600">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Selected seats summary */}
        {Object.keys(seats).length > 0 && (
          <div className="bg-blue-50 rounded-xl p-3 flex flex-wrap gap-2">
            {travelers.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">Adult {i + 1}:</span>
                <span className="font-semibold text-blue-700">{seats[i] || 'Not selected'}</span>
                {seats[i] && <span className="text-slate-400">({getSeatLabel(seats[i])})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Seat map */}
        <div className="overflow-x-auto">
          <div className="min-w-[340px] mx-auto max-w-md">
            {/* Cabin labels */}
            <div className="text-center text-xs text-slate-400 font-medium mb-2">← Front of Aircraft</div>

            {/* Column headers */}
            <div className="flex justify-center mb-2">
              <div className="flex items-center gap-1">
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">A</div>
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">B</div>
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">C</div>
                <div className="w-5" />
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">D</div>
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">E</div>
                <div className="w-7 text-center text-[10px] text-slate-400 font-medium">F</div>
              </div>
            </div>

            <div className="space-y-1">
              {allRows.map(row => {
                const isBusiness = row <= 4;
                const isExit = row === 5 || row === 6;
                const cols = isBusiness ? ['A', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E', 'F'];
                const leftCols = isBusiness ? ['A', 'C'] : ['A', 'B', 'C'];
                const rightCols = isBusiness ? ['D', 'F'] : ['D', 'E', 'F'];

                return (
                  <div key={row}>
                    {isExit && row === 5 && (
                      <div className="flex items-center gap-2 my-1">
                        <div className="flex-1 h-px bg-amber-200" />
                        <span className="text-[10px] text-amber-500 font-medium">⚡ Emergency Exit</span>
                        <div className="flex-1 h-px bg-amber-200" />
                      </div>
                    )}
                    {row === 7 && (
                      <div className="flex items-center gap-2 my-1">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-medium">Economy Cabin</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1">
                      {leftCols.map(col => {
                        const seat = `${row}${col}`;
                        const isOccupied = OCCUPIED_SEATS.has(seat);
                        const isSelected = Object.values(seats).includes(seat);
                        return (
                          <button
                            key={col}
                            disabled={isOccupied}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            onClick={() => handleSeatClick(seat)}
                            title={isOccupied ? 'Occupied' : `${getSeatLabel(seat)} · ${seatPrice(row) > 0 ? formatINR(seatPrice(row)) : 'Free'}`}
                            className={`w-7 h-7 rounded text-[10px] font-mono border transition-all ${getSeatBg(seat, row)} ${isSelected ? 'scale-110 shadow-md' : ''}`}
                          >
                            {isSelected ? '✓' : col}
                          </button>
                        );
                      })}
                      <div className="w-5 flex items-center justify-center">
                        <span className="text-[9px] text-slate-300 font-mono">{row}</span>
                      </div>
                      {rightCols.map(col => {
                        const seat = `${row}${col}`;
                        const isOccupied = OCCUPIED_SEATS.has(seat);
                        const isSelected = Object.values(seats).includes(seat);
                        return (
                          <button
                            key={col}
                            disabled={isOccupied}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            onClick={() => handleSeatClick(seat)}
                            title={isOccupied ? 'Occupied' : `${getSeatLabel(seat)} · ${seatPrice(row) > 0 ? formatINR(seatPrice(row)) : 'Free'}`}
                            className={`w-7 h-7 rounded text-[10px] font-mono border transition-all ${getSeatBg(seat, row)} ${isSelected ? 'scale-110 shadow-md' : ''}`}
                          >
                            {isSelected ? '✓' : col}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {hoveredSeat && !OCCUPIED_SEATS.has(hoveredSeat) && (
              <div className="mt-3 text-center text-xs text-slate-500 bg-slate-50 rounded-lg py-2 px-3">
                Seat {hoveredSeat} · {getSeatLabel(hoveredSeat)} · {seatPrice(getSeatRow(hoveredSeat)) > 0 ? formatINR(seatPrice(getSeatRow(hoveredSeat))) : 'Free'}
              </div>
            )}
          </div>
        </div>

        {/* Auto-assign */}
        <button
          onClick={() => {
            const available: string[] = [];
            for (let r = 16; r <= 30; r++) {
              for (const c of ['A','B','C','D','E','F']) {
                if (!OCCUPIED_SEATS.has(`${r}${c}`)) available.push(`${r}${c}`);
              }
            }
            const newSeats: Record<number, string> = {};
            travelers.forEach((_, i) => {
              if (available[i]) newSeats[i] = available[i];
            });
            setSeats(newSeats);
          }}
          className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          Auto-assign seats (free standard seats)
        </button>

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button onClick={goNext} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">Continue →</button>
        </div>
      </div>
    );
  }

  // ─── Step 4: Baggage ──────────────────────────────────────────────────────
  function renderBaggage() {
    const included = getBaggageIncluded(selectedFare);
    const extraOptions = [
      { kg: 5, price: 500 },
      { kg: 10, price: 900 },
      { kg: 15, price: 1300 },
      { kg: 20, price: 1700 },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Baggage Allowance</h2>
          <p className="text-sm text-slate-500 mt-1">Add extra baggage if needed. Checked in at the airport.</p>
        </div>

        {travelers.map((t, idx) => (
          <div key={idx} className="border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 text-sm">Adult {idx + 1} — {t.fullName || 'Traveler'}</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                ✓ {included} kg included
              </span>
            </div>
            <div className="text-xs text-slate-500">{included} kg checked + 7 kg cabin</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {extraOptions.map(opt => (
                <button
                  key={opt.kg}
                  onClick={() => setBaggage(prev => ({
                    ...prev,
                    [idx]: prev[idx] === opt.kg ? 0 : opt.kg,
                  }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    baggage[idx] === opt.kg
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">+{opt.kg} kg</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatINR(opt.price)}</div>
                </button>
              ))}
            </div>
            {baggage[idx] > 0 && (
              <div className="text-xs text-blue-600 font-medium">
                Total: {included + baggage[idx]} kg checked · +{formatINR(getExtraKgPrice(baggage[idx]))}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button onClick={goNext} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">Continue →</button>
        </div>
      </div>
    );
  }

  // ─── Step 5: Meals & Extras ───────────────────────────────────────────────
  function renderMealsExtras() {
    const mealOptions = ['Vegetarian Indian', 'Jain Meal', 'Vegan', 'Non-Vegetarian', 'No Meal'];
    const mealsIncluded = selectedFare !== 'saver';

    const extrasConfig = [
      { id: 'priority-boarding', label: 'Priority Boarding', desc: 'Board before general passengers', price: 699, icon: '⚡' },
      { id: 'lounge-access', label: 'Lounge Access', desc: 'Departure lounge access', price: 1500, icon: '🛋', hidden: selectedFare === 'business' },
      { id: 'travel-insurance', label: 'Travel Insurance', desc: 'Comprehensive travel protection', price: 999, icon: '🛡' },
      { id: 'airport-transfer', label: 'Airport Transfer', desc: 'One-way pick-up to airport', price: 1800, icon: '🚗', perPerson: false },
    ].filter(e => !e.hidden);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Meals & Extras</h2>
          <p className="text-sm text-slate-500 mt-1">Customize your in-flight experience</p>
        </div>

        {/* Meals */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700 text-sm">Meal Preference</h3>
          {!mealsIncluded && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Meals are not included in the Saver fare. Selection is for preference only.
            </div>
          )}
          {travelers.map((t, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium text-slate-700">Adult {idx + 1} — {t.fullName || 'Traveler'}</div>
              <div className="flex flex-wrap gap-2">
                {mealOptions.map(meal => (
                  <button
                    key={meal}
                    onClick={() => setMeals(prev => ({ ...prev, [idx]: meal }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      meals[idx] === meal
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {meal}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Extras */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm">Add-ons</h3>
          {extrasConfig.map(extra => {
            const active = extras.has(extra.id);
            const priceLabel = extra.perPerson === false
              ? `${formatINR(extra.price)} one-time`
              : `${formatINR(extra.price)} × ${travelers.length} person${travelers.length > 1 ? 's' : ''}`;
            return (
              <div
                key={extra.id}
                onClick={() => setExtras(prev => {
                  const next = new Set(prev);
                  if (next.has(extra.id)) next.delete(extra.id);
                  else next.add(extra.id);
                  return next;
                })}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">{extra.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{extra.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{extra.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{formatINR(extra.price)}</div>
                  <div className="text-[10px] text-slate-400">{extra.perPerson === false ? 'one-time' : 'per person'}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                }`}>
                  {active && <span className="text-[10px]">✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button onClick={goNext} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">Review Booking →</button>
        </div>
      </div>
    );
  }

  // ─── Step 6: Review ───────────────────────────────────────────────────────
  function renderReview() {
    const included = getBaggageIncluded(selectedFare);

    const section = (label: string, jumpStep: number, children: React.ReactNode) => (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
          <button onClick={() => setStep(jumpStep)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
        </div>
        <div className="px-4 py-4 text-sm text-slate-700 space-y-1">{children}</div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Review Your Booking</h2>
          <p className="text-sm text-slate-500 mt-1">Please verify all details before proceeding to payment</p>
        </div>

        {/* Flight */}
        {section('Flight', 0, (
          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900">{flight.from} → {flight.to}</div>
            <div className="text-slate-600">{flight.airline} {flight.flightNumber} · {flight.aircraft}</div>
            <div className="text-slate-500">{flight.departureTime} → {flight.arrivalTime} · {flight.duration}</div>
            <div className="text-slate-500">Fare: <span className="font-medium capitalize">{selectedFare}</span> · {formatINR(farePrice)} per person</div>
          </div>
        ))}

        {/* Travelers */}
        {section('Travelers', 2, (
          <>
            {travelers.map((t, i) => (
              <div key={i} className="flex flex-col">
                <span className="font-medium">Adult {i + 1} — {t.fullName}</span>
                {t.passport && <span className="text-xs text-slate-500">Passport {t.passport}</span>}
              </div>
            ))}
          </>
        ))}

        {/* Seats */}
        {section('Seats', 3, (
          <>
            {travelers.map((_, i) => (
              <div key={i}>Adult {i + 1} — {seats[i] ? `${seats[i]} (${getSeatLabel(seats[i])})` : 'Auto-assigned'}</div>
            ))}
          </>
        ))}

        {/* Baggage */}
        {section('Baggage', 4, (
          <>
            {travelers.map((_, i) => (
              <div key={i}>Adult {i + 1} — {included + (baggage[i] || 0)} kg checked + 7 kg cabin</div>
            ))}
          </>
        ))}

        {/* Meals */}
        {section('Meals', 5, (
          <>
            {travelers.map((_, i) => (
              <div key={i}>Adult {i + 1} — {meals[i] || 'Vegetarian Indian'}</div>
            ))}
          </>
        ))}

        {/* Extras */}
        {extras.size > 0 && section('Extras', 5, (
          <>
            {[...extras].map(e => {
              const labels: Record<string, string> = {
                'priority-boarding': 'Priority Boarding',
                'lounge-access': 'Lounge Access',
                'travel-insurance': 'Travel Insurance',
                'airport-transfer': 'Airport Transfer',
              };
              return <div key={e}>{labels[e]} — {formatINR(EXTRA_PRICES[e] || 0)} × {travelers.length}</div>;
            })}
          </>
        ))}

        {/* Price breakdown */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="font-semibold text-slate-700 mb-3">Price Breakdown</div>
          {[
            { label: `Base fare (${selectedFare}) × ${count}`, value: base },
            { label: 'Taxes & fees (18%)', value: taxes },
            ...(seatTotal > 0 ? [{ label: 'Seat upgrades', value: seatTotal }] : []),
            ...(baggageTotal > 0 ? [{ label: 'Extra baggage', value: baggageTotal }] : []),
            ...(extrasTotal > 0 ? [{ label: 'Add-ons', value: extrasTotal }] : []),
          ].map(row => (
            <div key={row.label} className="flex justify-between text-slate-600">
              <span>{row.label}</span>
              <span>{formatINR(row.value)}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-blue-600">{formatINR(totalPrice)}</span>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={e => setReviewConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-slate-600">
            I confirm all details are correct and match my travel documents. I agree to the fare conditions and cancellation policy.
          </span>
        </label>

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button
            onClick={goNext}
            disabled={!reviewConfirmed}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            Proceed to Payment →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 7: Payment ──────────────────────────────────────────────────────
  function renderPayment() {
    const tabs = [
      { key: 'card', label: 'Card' },
      { key: 'upi', label: 'UPI' },
      { key: 'netbanking', label: 'Net Banking' },
      { key: 'wallet', label: 'Wallet' },
    ] as const;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Secure Payment</h2>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1">
            <span>🔒</span>
            <span>256-bit encryption · PCI DSS compliant</span>
          </div>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-5 text-white">
          <div className="text-sm opacity-80 mb-1">Amount to Pay</div>
          <div className="text-3xl font-bold">{formatINR(totalPrice)}</div>
          <div className="text-xs opacity-70 mt-1">{flight.airline} {flight.flightNumber} · {travelers.length} passenger{travelers.length > 1 ? 's' : ''}</div>
        </div>

        {/* Payment method tabs */}
        <div className="flex border border-slate-200 rounded-xl overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setPaymentMethod(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                paymentMethod === tab.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Payment forms */}
        {paymentMethod === 'card' && (
          <div className="space-y-4 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Saved Card</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded">VISA</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Card Number</label>
              <input readOnly value="•••• •••• •••• 4242" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry</label>
                <input readOnly value="12/28" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CVV</label>
                <input type="password" placeholder="•••" maxLength={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name on Card</label>
              <input readOnly value="Arjun Mehta" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50" />
            </div>
          </div>
        )}

        {paymentMethod === 'upi' && (
          <div className="space-y-4 border border-slate-200 rounded-xl p-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="yourname@upi"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 text-center">Or pay using</div>
            <div className="flex gap-3 justify-center">
              {['GPay', 'PhonePe', 'Paytm'].map(app => (
                <button key={app} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  {app}
                </button>
              ))}
            </div>
          </div>
        )}

        {paymentMethod === 'netbanking' && (
          <div className="space-y-4 border border-slate-200 rounded-xl p-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Select Bank</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak'].map(bank => (
                  <button
                    key={bank}
                    onClick={() => setSelectedBank(bank)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      selectedBank === bank ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
              <select
                onChange={e => setSelectedBank(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Other banks...</option>
                {['Yes Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {paymentMethod === 'wallet' && (
          <div className="space-y-3 border border-slate-200 rounded-xl p-5">
            {[
              { name: 'Paytm Wallet', balance: '₹0', color: 'bg-blue-50 text-blue-700' },
              { name: 'Amazon Pay', balance: '₹0', color: 'bg-amber-50 text-amber-700' },
            ].map(w => (
              <div key={w.name} className={`flex items-center justify-between p-3 rounded-xl border border-slate-200 ${w.color}`}>
                <span className="text-sm font-semibold">{w.name}</span>
                <div className="text-right">
                  <div className="text-xs font-mono">Balance: {w.balance}</div>
                  <button className="text-[10px] underline mt-0.5">Top up</button>
                </div>
              </div>
            ))}
            <div className="text-xs text-slate-500 text-center">Insufficient wallet balance. Please top up or choose another method.</div>
          </div>
        )}

        {/* Fare conditions */}
        <details className="border border-slate-200 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
            Fare Conditions & Cancellation
          </summary>
          <div className="px-4 py-3 text-xs text-slate-500 space-y-1 border-t border-slate-100">
            <div>· {selectedFare === 'flex' ? 'Partially refundable' : selectedFare === 'business' ? 'Fully refundable' : 'Non-refundable'}</div>
            <div>· Date change: {selectedFare === 'saver' ? 'Not allowed' : selectedFare === 'standard' ? '₹3,000 fee' : 'Free'}</div>
            <div>· Valid on {flight.airline} only</div>
            <div>· Cancellation: Up to 24h before departure</div>
          </div>
        </details>

        <div className="flex gap-3">
          <button onClick={goBack} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">← Back</button>
          <button
            onClick={handlePay}
            className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors shadow-lg shadow-blue-200"
          >
            Pay {formatINR(totalPrice)}
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 8: Confirmation ─────────────────────────────────────────────────
  function renderConfirmation() {
    const included = getBaggageIncluded(selectedFare);

    return (
      <div className="flex flex-col items-center space-y-8 py-4">
        {/* Animated checkmark */}
        <div className="relative">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-emerald-500" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" strokeDasharray="157" strokeDashoffset="0" />
              <path
                d="M14 26l8 8 16-16"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 30,
                  strokeDashoffset: 0,
                  animation: 'none',
                }}
              />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-900">{"You're going to " + flight.to + "! ✈️"}</h2>
          <p className="text-slate-500 text-sm">Your flight has been booked successfully. A confirmation email has been sent.</p>
          {bookingFlow?.journeyId && (() => {
            const linkedJourney = journeys.find(j => j.id === bookingFlow.journeyId);
            return linkedJourney ? (
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span>✓</span>
                <span>Added to {linkedJourney.title}</span>
              </div>
            ) : null;
          })()}
        </div>

        {/* PNR */}
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200 rounded-2xl px-8 py-5 text-center w-full max-w-sm">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-2">Booking Reference (PNR)</div>
          <div className="text-4xl font-mono font-bold text-blue-700 tracking-widest">{pnr}</div>
          <div className="text-xs text-slate-400 mt-2">Show this at the airport</div>
        </div>

        {/* Flight details */}
        <div className="w-full border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flight Details</span>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <div className="flex items-center gap-4">
              <AirlineBadge code={flight.airlineCode} size="sm" />
              <div>
                <div className="font-semibold text-slate-800">{flight.airline} {flight.flightNumber}</div>
                <div className="text-slate-500 text-xs">{flight.aircraft}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="font-bold font-mono text-lg">{flight.departureTime}</div>
                <div className="text-blue-600 font-bold">{flight.fromCode}</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-xs text-slate-400">{flight.duration}</div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="text-[10px] text-slate-400">{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop`}</div>
              </div>
              <div className="text-center">
                <div className="font-bold font-mono text-lg">{flight.arrivalTime}</div>
                <div className="text-blue-600 font-bold">{flight.toCode}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400">Fare</span>
                <div className="font-medium capitalize">{selectedFare}</div>
              </div>
              <div>
                <span className="text-slate-400">Passengers</span>
                <div className="font-medium">{travelers.length}</div>
              </div>
              {travelers.map((t, i) => (
                <div key={i}>
                  <span className="text-slate-400">Adult {i + 1}</span>
                  <div className="font-medium">{t.fullName}</div>
                  {seats[i] && <div className="text-slate-500">Seat {seats[i]}</div>}
                  <div className="text-slate-500">Meal: {meals[i] || 'Vegetarian Indian'}</div>
                  <div className="text-slate-500">Bag: {included + (baggage[i] || 0)} kg</div>
                </div>
              ))}
              <div>
                <span className="text-slate-400">Amount Paid</span>
                <div className="font-bold text-blue-600">{formatINR(totalPrice)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={() => alert('PDF download coming soon!')}
            className="py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            📄 Download Ticket
          </button>
          <button
            onClick={() => alert('Calendar invite sent!')}
            className="py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            📅 Add to Calendar
          </button>
          <button
            onClick={() => {
              if (bookingFlow?.journeyId) {
                handleConfirmNavigate();
              } else {
                navigate('my-bookings');
              }
            }}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {bookingFlow?.journeyId ? 'View Journey →' : 'View All Bookings →'}
          </button>
          <button
            onClick={() => navigate('support')}
            className="py-2.5 border border-blue-200 bg-blue-50 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  // ─── Mobile bottom price bar ──────────────────────────────────────────────
  const [mobilePriceExpanded, setMobilePriceExpanded] = useState(false);

  // ─── Render ───────────────────────────────────────────────────────────────
  const stepRenderers = [
    renderSummary,
    renderFareSelection,
    renderTravelers,
    renderSeats,
    renderBaggage,
    renderMealsExtras,
    renderReview,
    renderPayment,
    renderConfirmation,
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => step === 0 ? navigate('search') : goBack()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            ←
          </button>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {step === 8 ? 'Booking Confirmed' : `Book Flight · ${flight.fromCode} → ${flight.toCode}`}
            </div>
            {step < 8 && (
              <div className="text-xs text-slate-500">Step {step + 1} of 8 · {STEPS[step]}</div>
            )}
          </div>
          {step < 8 && (
            <div className="ml-auto text-sm font-semibold text-blue-600">{formatINR(totalPrice)}</div>
          )}
        </div>
        {step < 8 && (
          <div className="pb-2">
            <StepProgress step={step} onStepClick={setStep} />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {step === 8 ? (
          <div className="max-w-xl mx-auto">
            {renderConfirmation()}
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left: step content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                {stepRenderers[step]?.()}
              </div>
            </div>

            {/* Right: sticky price summary (desktop) */}
            <div className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-32">
                <PriceSummary
                  flight={flight}
                  fare={selectedFare}
                  farePrice={farePrice}
                  seats={seats}
                  baggage={baggage}
                  extras={extras}
                  travelers={travelers}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky bottom bar */}
      {step < 8 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
          {mobilePriceExpanded && (
            <div className="p-4 border-b border-slate-100">
              <PriceSummary
                flight={flight}
                fare={selectedFare}
                farePrice={farePrice}
                seats={seats}
                baggage={baggage}
                extras={extras}
                travelers={travelers}
              />
            </div>
          )}
          <button
            onClick={() => setMobilePriceExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm text-slate-500">Total</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-600">{formatINR(totalPrice)}</span>
              <span className="text-slate-400 text-xs">{mobilePriceExpanded ? '▼' : '▲'}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
