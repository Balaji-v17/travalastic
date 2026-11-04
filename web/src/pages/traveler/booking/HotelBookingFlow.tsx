import { useState, useEffect, useCallback } from 'react';
import { useApp, type Page } from '../../../store/AppContext';
import { hotels, currentTraveler, type RoomType } from '../../../data/mockData';
import type { Booking, Hotel } from '../../../data/mockData';

// ─── Helpers ────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDate(str: string): Date {
  return new Date(str + 'T00:00:00');
}

function diffDays(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function fmtDateDisplay(str: string): string {
  return parseDate(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDateFull(str: string): string {
  return parseDate(str).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function rupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function genRef(): string {
  return 'HTL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Rate plans ─────────────────────────────────────────────

type RatePlan = 'room-only' | 'breakfast' | 'free-cancel' | 'non-refundable';

interface PlanInfo {
  id: RatePlan;
  label: string;
  multiplier: number;
  breakfast: boolean;
  cancellation: 'free' | 'standard' | 'none';
  bullets: string[];
}

const RATE_PLANS: PlanInfo[] = [
  {
    id: 'room-only',
    label: 'Room Only',
    multiplier: 1,
    breakfast: false,
    cancellation: 'standard',
    bullets: ['No meals included', 'Standard cancellation policy', 'Best value base rate'],
  },
  {
    id: 'breakfast',
    label: 'Breakfast Included',
    multiplier: 1.15,
    breakfast: true,
    cancellation: 'standard',
    bullets: ['Daily breakfast for all guests', 'Standard cancellation policy', 'Save on dining expenses'],
  },
  {
    id: 'free-cancel',
    label: 'Free Cancellation',
    multiplier: 1.08,
    breakfast: false,
    cancellation: 'free',
    bullets: ['Cancel free up to 48 hrs before check-in', 'No meals included', 'Peace of mind flexibility'],
  },
  {
    id: 'non-refundable',
    label: 'Non-refundable',
    multiplier: 0.95,
    breakfast: false,
    cancellation: 'none',
    bullets: ['Lowest price guaranteed', 'No cancellation or changes', 'Pay now, no refunds'],
  },
];

// ─── Pricing helpers ─────────────────────────────────────────

function computePrice(room: RoomType | null, plan: RatePlan, nights: number) {
  if (!room) return { base: 0, rateAdj: 0, taxes: 0, total: 0, perNight: 0 };
  const info = RATE_PLANS.find((p) => p.id === plan)!;
  const perNight = Math.round(room.pricePerNight * info.multiplier);
  const base = perNight * nights;
  const rateAdj = base - room.pricePerNight * nights;
  const taxes = Math.round(base * 0.18);
  const total = base + taxes;
  return { base, rateAdj: Math.round(rateAdj), taxes, total, perNight };
}

// ─── Step labels ─────────────────────────────────────────────

const STEP_LABELS = ['Room', 'Guests', 'Preferences', 'Review', 'Payment'];

// ─── Main Component ──────────────────────────────────────────

export default function HotelBookingFlow() {
  const { bookingFlow, confirmBooking, navigate, updateItineraryItemStatus, journeys } = useApp();

  const hotel = hotels.find((h) => h.id === bookingFlow?.itemId) ?? hotels[0];

  // Dates
  const today = new Date();
  const [checkIn, setCheckIn] = useState(formatDate(addDays(today, 3)));
  const [checkOut, setCheckOut] = useState(formatDate(addDays(today, 6)));
  const nights = diffDays(checkIn, checkOut);

  // Room & rate
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<RatePlan>('room-only');

  // Guests
  const [guestCount, setGuestCount] = useState(2);
  const [leadGuest, setLeadGuest] = useState({
    name: currentTraveler.name ?? 'Arjun Mehta',
    email: currentTraveler.email ?? 'arjun.mehta@example.com',
    phone: currentTraveler.phone ?? '+91 98765 43210',
    country: 'India',
    specialRequests: '',
  });
  const [additionalGuests, setAdditionalGuests] = useState<string[]>(['']);

  // Preferences
  const [prefs, setPrefs] = useState<{
    floor: 'high' | 'low' | 'any';
    bed: 'king' | 'twin' | 'any';
    arrival: string;
    quiet: boolean;
    awayFromElevator: boolean;
    earlyCheckIn: boolean;
    lateCheckOut: boolean;
  }>({
    floor: 'any',
    bed: 'any',
    arrival: '15:00–18:00',
    quiet: false,
    awayFromElevator: false,
    earlyCheckIn: false,
    lateCheckOut: false,
  });

  // Review confirmation
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  // Payment
  const [paymentTab, setPaymentTab] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);

  // Confirmation
  const [step, setStep] = useState(0);
  const [confirmationRef, setConfirmationRef] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Sync additional guests array with guestCount
  useEffect(() => {
    const extras = guestCount - 1;
    setAdditionalGuests((prev) => {
      const next = Array(extras).fill('');
      for (let i = 0; i < Math.min(prev.length, extras); i++) next[i] = prev[i];
      return next;
    });
  }, [guestCount]);

  const pricing = computePrice(selectedRoom, selectedPlan, nights);
  const planInfo = RATE_PLANS.find((p) => p.id === selectedPlan)!;

  const journeyObj = journeys.find((j) => j.id === bookingFlow?.journeyId);

  // ─── Guest validation ─────────────────────────────────────

  const guestValid =
    leadGuest.name.trim().length > 0 &&
    leadGuest.email.trim().length > 0 &&
    leadGuest.phone.trim().length > 0;

  // ─── Payment handler ──────────────────────────────────────

  const handlePay = useCallback(() => {
    if (!selectedRoom) return;
    setProcessing(true);
    setTimeout(() => {
      const ref = genRef();
      const booking: Booking = {
        id: 'bkg-' + Date.now(),
        journeyId: bookingFlow?.journeyId ?? 'standalone',
        travelerId: currentTraveler.id,
        type: 'hotel',
        status: 'confirmed',
        referenceId: ref,
        supplierId: hotel.id,
        supplierName: hotel.name,
        itemName: `${hotel.name} — ${selectedRoom.name}`,
        itemDetails: `${fmtDateDisplay(checkIn)} – ${fmtDateDisplay(checkOut)} · ${nights} night${nights !== 1 ? 's' : ''}`,
        checkIn,
        checkOut,
        totalAmount: pricing.total,
        currency: 'INR',
        paymentStatus: 'successful',
        createdAt: new Date().toISOString(),
        passengers: guestCount,
        nights,
        roomType: selectedRoom.name,
      };
      setConfirmationRef(ref);
      setConfirmedBooking(booking);
      setProcessing(false);
      setStep(5);
    }, 1500);
  }, [selectedRoom, hotel, checkIn, checkOut, nights, pricing.total, guestCount, bookingFlow]);

  // ─── Confirm navigate ─────────────────────────────────────

  function handleConfirmNavigate() {
    if (!confirmedBooking) return;
    if (bookingFlow?.journeyId && bookingFlow?.itineraryItemId) {
      updateItineraryItemStatus(bookingFlow.journeyId, bookingFlow.itineraryItemId, 'booked', confirmedBooking.id);
    }
    confirmBooking(confirmedBooking);
  }

  // ─── Render helpers ───────────────────────────────────────

  const hotelImage = hotel.imageUrl || hotel.images?.[0] || hotel.galleryUrls?.[0] || '';

  // ─── Layout ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Progress bar ── */}
      {step < 5 && (
        <div className="bg-white border-b border-stone-100 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-1">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => i < step && setStep(i)}
                    className={`flex items-center gap-2 group ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                        ${i < step ? 'bg-blue-600 border-blue-600 text-white' : ''}
                        ${i === step ? 'bg-white border-blue-600 text-blue-600' : ''}
                        ${i > step ? 'bg-white border-stone-300 text-stone-400' : ''}
                      `}
                    >
                      {i < step ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-sm hidden sm:block font-medium ${
                        i === step ? 'text-blue-600' : i < step ? 'text-stone-700' : 'text-stone-400'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded ${i < step ? 'bg-blue-600' : 'bg-stone-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {step < 5 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Left / main content ── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hotel context header */}
              {step < 5 && (
                <div className="bg-white rounded-2xl border border-stone-100 p-4 flex gap-4 items-center shadow-sm">
                  <img
                    src={hotelImage}
                    alt={hotel.name}
                    className="w-20 h-16 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-stone-900 text-base truncate">{hotel.name}</h2>
                      <div className="flex items-center gap-1 text-amber-500 text-sm">
                        {'★'.repeat(hotel.stars)}
                      </div>
                      <span className="text-stone-600 text-sm font-medium">{hotel.rating}</span>
                    </div>
                    <p className="text-stone-500 text-sm mt-0.5">{hotel.location}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-stone-600">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {fmtDateDisplay(checkIn)} – {fmtDateDisplay(checkOut)}
                      </span>
                      <span>·</span>
                      <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{guestCount} guest{guestCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step content ── */}
              {step === 0 && (
                <StepRooms
                  hotel={hotel}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  setCheckIn={setCheckIn}
                  setCheckOut={setCheckOut}
                  nights={nights}
                  guestCount={guestCount}
                  setGuestCount={setGuestCount}
                  selectedRoom={selectedRoom}
                  setSelectedRoom={setSelectedRoom}
                  selectedPlan={selectedPlan}
                  setSelectedPlan={setSelectedPlan}
                  pricing={pricing}
                  onNext={() => setStep(1)}
                />
              )}
              {step === 1 && (
                <StepGuests
                  guestCount={guestCount}
                  leadGuest={leadGuest}
                  setLeadGuest={setLeadGuest}
                  additionalGuests={additionalGuests}
                  setAdditionalGuests={setAdditionalGuests}
                  guestValid={guestValid}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <StepPreferences
                  prefs={prefs}
                  setPrefs={setPrefs}
                  onNext={() => setStep(3)}
                />
              )}
              {step === 3 && (
                <StepReview
                  hotel={hotel}
                  selectedRoom={selectedRoom!}
                  planInfo={planInfo}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  nights={nights}
                  guestCount={guestCount}
                  leadGuest={leadGuest}
                  prefs={prefs}
                  pricing={pricing}
                  reviewConfirmed={reviewConfirmed}
                  setReviewConfirmed={setReviewConfirmed}
                  goToStep={setStep}
                  onNext={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <StepPayment
                  paymentTab={paymentTab}
                  setPaymentTab={setPaymentTab}
                  upiId={upiId}
                  setUpiId={setUpiId}
                  pricing={pricing}
                  planInfo={planInfo}
                  processing={processing}
                  checkIn={checkIn}
                  onPay={handlePay}
                />
              )}
            </div>

            {/* ── Right / sticky summary ── */}
            <div className="hidden lg:block">
              <PriceSummary
                hotel={hotel}
                selectedRoom={selectedRoom}
                planInfo={planInfo}
                checkIn={checkIn}
                checkOut={checkOut}
                nights={nights}
                pricing={pricing}
              />
            </div>
          </div>
        ) : (
          <StepConfirmation
            hotel={hotel}
            selectedRoom={confirmedBooking ? hotel.rooms.find((r) => r.id === (selectedRoom?.id ?? '')) ?? selectedRoom! : selectedRoom!}
            planInfo={planInfo}
            checkIn={checkIn}
            checkOut={checkOut}
            nights={nights}
            guestCount={guestCount}
            pricing={pricing}
            confirmationRef={confirmationRef}
            journeyObj={journeyObj}
            bookingFlow={bookingFlow}
            onNavigate={handleConfirmNavigate}
            navigate={navigate}
          />
        )}
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      {step < 5 && selectedRoom && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 flex items-center justify-between z-40">
          <div>
            <p className="text-xs text-stone-500">Total (incl. taxes)</p>
            <p className="text-lg font-bold text-stone-900">{rupee(pricing.total)}</p>
          </div>
          <div className="text-xs text-stone-500">
            {nights} nights · {selectedRoom.name}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 0: Room Selection ──────────────────────────────────

interface StepRoomsProps {
  hotel: Hotel;
  checkIn: string;
  checkOut: string;
  setCheckIn: (v: string) => void;
  setCheckOut: (v: string) => void;
  nights: number;
  guestCount: number;
  setGuestCount: (v: number) => void;
  selectedRoom: RoomType | null;
  setSelectedRoom: (r: RoomType | null) => void;
  selectedPlan: RatePlan;
  setSelectedPlan: (p: RatePlan) => void;
  pricing: ReturnType<typeof computePrice>;
  onNext: () => void;
}

function StepRooms({
  hotel, checkIn, checkOut, setCheckIn, setCheckOut, nights, guestCount, setGuestCount,
  selectedRoom, setSelectedRoom, selectedPlan, setSelectedPlan, pricing, onNext,
}: StepRoomsProps) {
  return (
    <div className="space-y-6">
      {/* Date + guests row */}
      <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">Stay details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Check-in</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Check-out</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Guests</label>
            <select
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Room heading */}
      <div>
        <h1 className="font-display text-3xl text-stone-900">Choose your room</h1>
        <p className="text-stone-500 mt-1">{hotel.rooms.length} room types available</p>
      </div>

      {/* Room cards */}
      <div className="space-y-4">
        {hotel.rooms.map((room) => {
          const isSelected = selectedRoom?.id === room.id;
          const roomTotal = rupee(room.pricePerNight * nights);
          return (
            <div
              key={room.id}
              className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
                isSelected ? 'border-blue-500 shadow-blue-100' : 'border-stone-100 hover:border-stone-300'
              }`}
            >
              {/* Room image */}
              <div className="relative">
                <img src={room.imageUrl} alt={room.name} className="w-full h-52 object-cover" />
                {room.breakfastIncluded && (
                  <span className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    Breakfast included
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-900 text-lg">{room.name}</h3>
                    <p className="text-stone-500 text-sm mt-0.5">
                      {room.bedType} · {room.size} · Up to {room.maxOccupancy} guests
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-stone-900">{rupee(room.pricePerNight)}</p>
                    <p className="text-xs text-stone-500">per night</p>
                    <p className="text-sm text-stone-600 font-medium mt-1">{roomTotal} total</p>
                  </div>
                </div>

                {/* Amenity chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {room.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>

                {/* Cancellation */}
                <div className="mt-3">
                  {room.cancellationPolicy.toLowerCase().includes('free') ? (
                    <span className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {room.cancellationPolicy}
                    </span>
                  ) : (
                    <span className="text-amber-600 text-xs font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {room.cancellationPolicy}
                    </span>
                  )}
                </div>

                {/* Select button */}
                <button
                  onClick={() => setSelectedRoom(room)}
                  className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {isSelected ? '✓ Room selected' : 'Select Room'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rate plan picker */}
      {selectedRoom && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl text-stone-900">Choose your rate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RATE_PLANS.map((plan) => {
              const perNight = Math.round(selectedRoom.pricePerNight * plan.multiplier);
              const total = perNight * nights;
              const isActive = selectedPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                    isActive ? 'border-blue-500 shadow-blue-100 shadow-md' : 'border-stone-100 hover:border-stone-300'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-stone-900 text-sm">{plan.label}</span>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isActive ? 'border-blue-600 bg-blue-600' : 'border-stone-300'
                      }`}
                    >
                      {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xl font-bold text-stone-900">{rupee(perNight)} <span className="text-sm font-normal text-stone-500">/night</span></p>
                  <p className="text-sm text-stone-500 mb-3">{rupee(total)} total</p>
                  <ul className="space-y-1">
                    {plan.bullets.map((b) => (
                      <li key={b} className="text-xs text-stone-600 flex items-start gap-1.5">
                        <span className="text-stone-400 mt-0.5">·</span>{b}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan.id); }}
                    className={`mt-4 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {isActive ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        disabled={!selectedRoom}
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl font-semibold text-base bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
      >
        Continue to Guest Details
      </button>
    </div>
  );
}

// ─── Step 1: Guest Details ───────────────────────────────────

interface StepGuestsProps {
  guestCount: number;
  leadGuest: { name: string; email: string; phone: string; country: string; specialRequests: string };
  setLeadGuest: (v: StepGuestsProps['leadGuest']) => void;
  additionalGuests: string[];
  setAdditionalGuests: (v: string[]) => void;
  guestValid: boolean;
  onNext: () => void;
}

function StepGuests({ guestCount, leadGuest, setLeadGuest, additionalGuests, setAdditionalGuests, guestValid, onNext }: StepGuestsProps) {
  function updateAdditional(idx: number, val: string) {
    const next = [...additionalGuests];
    next[idx] = val;
    setAdditionalGuests(next);
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">"Who's staying?"</h1>
        <p className="text-stone-500 mt-1 text-sm">Details pre-filled from your Travel Identity. Review and confirm.</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-stone-800">Lead guest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Full name *</label>
            <input
              type="text"
              value={leadGuest.name}
              onChange={(e) => setLeadGuest({ ...leadGuest, name: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Email address *</label>
            <input
              type="email"
              value={leadGuest.email}
              onChange={(e) => setLeadGuest({ ...leadGuest, email: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Phone number *</label>
            <input
              type="tel"
              value={leadGuest.phone}
              onChange={(e) => setLeadGuest({ ...leadGuest, phone: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Country</label>
            <input
              type="text"
              value={leadGuest.country}
              onChange={(e) => setLeadGuest({ ...leadGuest, country: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {additionalGuests.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-stone-800">Additional guests</h3>
          {additionalGuests.map((name, idx) => (
            <div key={idx}>
              <label className="block text-xs font-medium text-stone-500 mb-1">Guest {idx + 2} name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => updateAdditional(idx, e.target.value)}
                placeholder={`Guest ${idx + 2} full name`}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        <label className="block text-sm font-semibold text-stone-800 mb-2">Special requests</label>
        <textarea
          value={leadGuest.specialRequests}
          onChange={(e) => setLeadGuest({ ...leadGuest, specialRequests: e.target.value })}
          rows={3}
          placeholder="Anniversary setup, dietary requirements, high floor preference, etc."
          className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-stone-400 mt-1">Special requests are not guaranteed but the hotel will try their best.</p>
      </div>

      <button
        disabled={!guestValid}
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl font-semibold text-base bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
      >
        Continue to Preferences
      </button>
    </div>
  );
}

// ─── Step 2: Preferences ────────────────────────────────────

type PrefsState = {
  floor: 'high' | 'low' | 'any';
  bed: 'king' | 'twin' | 'any';
  arrival: string;
  quiet: boolean;
  awayFromElevator: boolean;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
};

interface StepPreferencesProps {
  prefs: PrefsState;
  setPrefs: (p: PrefsState) => void;
  onNext: () => void;
}

function StepPreferences({ prefs, setPrefs, onNext }: StepPreferencesProps) {
  const arrivalOptions = ['Before 12:00', '12:00–15:00', '15:00–18:00', 'After 18:00', 'Late arrival (past midnight)'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Customize your stay</h1>
        <p className="text-stone-500 mt-1 text-sm">Preferences are requests subject to hotel availability.</p>
      </div>

      {/* Floor preference */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-3">Floor preference</h3>
        <div className="flex gap-3">
          {(['high', 'low', 'any'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setPrefs({ ...prefs, floor: v })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                prefs.floor === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {v === 'high' ? 'High Floor' : v === 'low' ? 'Low Floor' : 'No Preference'}
            </button>
          ))}
        </div>
      </div>

      {/* Bed preference */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-3">Bed configuration</h3>
        <div className="flex gap-3">
          {(['king', 'twin', 'any'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setPrefs({ ...prefs, bed: v })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                prefs.bed === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {v === 'king' ? 'King Bed' : v === 'twin' ? 'Twin Beds' : 'No Preference'}
            </button>
          ))}
        </div>
      </div>

      {/* Arrival time */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-3">Estimated arrival time</h3>
        <div className="flex flex-wrap gap-2">
          {arrivalOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setPrefs({ ...prefs, arrival: opt })}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                prefs.arrival === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Room location + extras */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-stone-800">Room location & extras</h3>
        {[
          { key: 'quiet' as const, label: 'Quiet room', desc: 'Away from noise sources' },
          { key: 'awayFromElevator' as const, label: 'Away from elevator', desc: 'Avoid elevator noise' },
          { key: 'earlyCheckIn' as const, label: 'Early check-in', desc: 'Subject to availability · Extra charges may apply' },
          { key: 'lateCheckOut' as const, label: 'Late check-out', desc: 'Subject to availability · Extra charges may apply' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-800">{label}</p>
              <p className="text-xs text-stone-500">{desc}</p>
            </div>
            <button
              onClick={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs[key] ? 'bg-blue-600' : 'bg-stone-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  prefs[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl font-semibold text-base bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
      >
        Continue to Review
      </button>
    </div>
  );
}

// ─── Step 3: Review ──────────────────────────────────────────

interface StepReviewProps {
  hotel: Hotel;
  selectedRoom: RoomType;
  planInfo: PlanInfo;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  leadGuest: { name: string; email: string; phone: string; specialRequests: string };
  prefs: PrefsState;
  pricing: ReturnType<typeof computePrice>;
  reviewConfirmed: boolean;
  setReviewConfirmed: (v: boolean) => void;
  goToStep: (s: number) => void;
  onNext: () => void;
}

function StepReview({ hotel, selectedRoom, planInfo, checkIn, checkOut, nights, guestCount, leadGuest, prefs, pricing, reviewConfirmed, setReviewConfirmed, goToStep, onNext }: StepReviewProps) {
  const freeCancelDate = formatDate(addDays(parseDate(checkIn), -2));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Review your booking</h1>
        <p className="text-stone-500 mt-1 text-sm">Confirm everything looks right before payment.</p>
      </div>

      {/* Hotel card */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm flex gap-4 items-center">
        <img src={hotel.imageUrl} alt={hotel.name} className="w-16 h-14 rounded-xl object-cover flex-shrink-0" />
        <div>
          <p className="font-semibold text-stone-900">{hotel.name}</p>
          <p className="text-xs text-stone-500">{hotel.location}</p>
          <p className="text-xs text-stone-600 mt-0.5">{fmtDateDisplay(checkIn)} – {fmtDateDisplay(checkOut)} · {nights} nights</p>
        </div>
      </div>

      {/* Stay details */}
      <SectionCard title="Stay details" onEdit={() => goToStep(0)}>
        <Row label="Room" value={selectedRoom.name} />
        <Row label="Rate plan" value={planInfo.label} />
        <Row label="Guests" value={`${guestCount} adult${guestCount !== 1 ? 's' : ''}`} />
        <Row label="Check-in" value={`${fmtDateFull(checkIn)} · from ${hotel.checkInTime}`} />
        <Row label="Check-out" value={`${fmtDateFull(checkOut)} · by ${hotel.checkOutTime}`} />
      </SectionCard>

      {/* Guest */}
      <SectionCard title="Lead guest" onEdit={() => goToStep(1)}>
        <Row label="Name" value={leadGuest.name} />
        <Row label="Email" value={leadGuest.email} />
        <Row label="Phone" value={leadGuest.phone} />
        {leadGuest.specialRequests && <Row label="Requests" value={leadGuest.specialRequests} />}
      </SectionCard>

      {/* Preferences */}
      <SectionCard title="Preferences" onEdit={() => goToStep(2)}>
        <Row label="Floor" value={prefs.floor === 'high' ? 'High floor' : prefs.floor === 'low' ? 'Low floor' : 'No preference'} />
        <Row label="Arrival" value={prefs.arrival} />
        {prefs.quiet && <Row label="Quiet room" value="Requested" />}
        {prefs.awayFromElevator && <Row label="Away from elevator" value="Requested" />}
      </SectionCard>

      {/* Cancellation policy */}
      {planInfo.cancellation === 'free' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-emerald-800">Free cancellation</p>
              <p className="text-sm text-emerald-700 mt-0.5">Cancel for free until {fmtDateDisplay(freeCancelDate)}. After that, standard charges apply.</p>
            </div>
          </div>
        </div>
      ) : planInfo.cancellation === 'none' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800">Non-refundable</p>
              <p className="text-sm text-amber-700 mt-0.5">This rate cannot be cancelled or modified. No refund will be provided.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-semibold text-amber-800 text-sm">Standard cancellation policy</p>
          <p className="text-sm text-amber-700 mt-0.5">{hotel.cancellationPolicy}</p>
        </div>
      )}

      {/* Price breakdown */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">Price breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-stone-700">
            <span>Room × {nights} nights</span>
            <span>{rupee(selectedRoom.pricePerNight * nights)}</span>
          </div>
          {pricing.rateAdj !== 0 && (
            <div className="flex justify-between text-stone-700">
              <span>Rate adjustment</span>
              <span className={pricing.rateAdj > 0 ? 'text-stone-700' : 'text-emerald-600'}>
                {pricing.rateAdj > 0 ? '+' : ''}{rupee(pricing.rateAdj)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-stone-700">
            <span>Taxes & fees (18%)</span>
            <span>{rupee(pricing.taxes)}</span>
          </div>
          <div className="border-t border-stone-100 pt-3 flex justify-between font-bold text-stone-900 text-base">
            <span>Total</span>
            <span>{rupee(pricing.total)}</span>
          </div>
        </div>
      </div>

      {/* Confirm checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => setReviewConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-blue-600"
        />
        <span className="text-sm text-stone-700">I confirm all details are correct and I agree to the cancellation and hotel policies.</span>
      </label>

      <button
        disabled={!reviewConfirmed}
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl font-semibold text-base bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
      >
        Continue to Payment
      </button>
    </div>
  );
}

// ─── Step 4: Payment ─────────────────────────────────────────

interface StepPaymentProps {
  paymentTab: 'card' | 'upi' | 'netbanking';
  setPaymentTab: (t: 'card' | 'upi' | 'netbanking') => void;
  upiId: string;
  setUpiId: (v: string) => void;
  pricing: ReturnType<typeof computePrice>;
  planInfo: PlanInfo;
  processing: boolean;
  checkIn: string;
  onPay: () => void;
}

function StepPayment({ paymentTab, setPaymentTab, upiId, setUpiId, pricing, planInfo, processing, checkIn, onPay }: StepPaymentProps) {
  const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda'];
  const freeCancelDate = formatDate(addDays(parseDate(checkIn), -2));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Complete your reservation</h1>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-stone-900">{rupee(pricing.total)}</span>
          <span className="text-stone-500 text-sm">total incl. taxes</span>
        </div>
      </div>

      {/* Payment tabs */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-100">
          {(['card', 'upi', 'netbanking'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPaymentTab(tab)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                paymentTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-stone-600 hover:text-stone-800'
              }`}
            >
              {tab === 'card' ? 'Credit / Debit Card' : tab === 'upi' ? 'UPI' : 'Net Banking'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {paymentTab === 'card' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
                <p className="text-xs text-slate-400 mb-4">Saved card</p>
                <p className="text-xl font-mono tracking-widest mb-4">•••• •••• •••• 4242</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-slate-400">Card holder</p>
                    <p className="font-medium">Arjun Mehta</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Expires</p>
                    <p className="font-medium">12/28</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">VISA</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">CVV</label>
                <input type="password" maxLength={4} placeholder="•••" className="w-28 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest" />
              </div>
            </div>
          )}

          {paymentTab === 'upi' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">UPI ID</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-stone-400">Or pay with</p>
              <div className="flex gap-3">
                {['GPay', 'PhonePe', 'Paytm'].map((app) => (
                  <button
                    key={app}
                    className="flex-1 py-2.5 border-2 border-stone-200 rounded-xl text-sm font-semibold text-stone-700 hover:border-blue-400 hover:text-blue-700 transition-all"
                  >
                    {app}
                  </button>
                ))}
              </div>
            </div>
          )}

          {paymentTab === 'netbanking' && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Select bank</label>
              <select className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Choose your bank</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation reminder */}
      {planInfo.cancellation === 'free' ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Free cancellation until {fmtDateDisplay(freeCancelDate)}
        </div>
      ) : planInfo.cancellation === 'none' ? (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Non-refundable — no cancellation allowed
        </div>
      ) : null}

      {/* Secure indicator */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        256-bit SSL encryption · PCI DSS compliant · Your payment is secure
      </div>

      <button
        onClick={onPay}
        disabled={processing}
        className="w-full py-4 rounded-2xl font-bold text-base bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </>
        ) : (
          `Pay ${rupee(pricing.total)}`
        )}
      </button>
    </div>
  );
}

// ─── Step 5: Confirmation ────────────────────────────────────

interface StepConfirmationProps {
  hotel: Hotel;
  selectedRoom: RoomType;
  planInfo: PlanInfo;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  pricing: ReturnType<typeof computePrice>;
  confirmationRef: string;
  journeyObj: { id: string; title: string } | undefined;
  bookingFlow: { journeyId?: string } | null;
  onNavigate: () => void;
  navigate: (page: Page) => void;
}

function StepConfirmation({ hotel, selectedRoom, planInfo, checkIn, checkOut, nights, guestCount, pricing, confirmationRef, journeyObj, bookingFlow, onNavigate, navigate }: StepConfirmationProps) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-8 py-4">
      {/* Animated checkmark */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center animate-[scale-in_0.4s_ease-out]">
          <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <div>
        <h1 className="font-display text-4xl text-stone-900">Your stay is confirmed. 🏨</h1>
        <p className="text-stone-600 mt-2 text-lg">{hotel.name} · {hotel.location}</p>
        {journeyObj && (
          <span className="inline-flex items-center gap-1.5 mt-3 bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Added to {journeyObj.title}
          </span>
        )}
      </div>

      {/* Confirmation number */}
      <div className="bg-stone-900 text-white rounded-2xl px-8 py-5 inline-block mx-auto">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Confirmation number</p>
        <p className="text-2xl font-mono font-bold tracking-widest text-emerald-400">{confirmationRef}</p>
      </div>

      {/* Stay summary */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 text-left shadow-sm space-y-3">
        <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
          <img src={hotel.imageUrl} alt={hotel.name} className="w-14 h-12 rounded-xl object-cover flex-shrink-0" />
          <div>
            <p className="font-semibold text-stone-900">{hotel.name}</p>
            <div className="flex gap-0.5 text-amber-400 text-xs">{'★'.repeat(hotel.stars)}</div>
          </div>
        </div>
        <Row label="Check-in" value={`${fmtDateFull(checkIn)} · from ${hotel.checkInTime}`} />
        <Row label="Check-out" value={`${fmtDateFull(checkOut)} · by ${hotel.checkOutTime}`} />
        <Row label="Duration" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
        <Row label="Room" value={selectedRoom.name} />
        <Row label="Guests" value={`${guestCount} adult${guestCount !== 1 ? 's' : ''}`} />
        <Row label="Rate" value={planInfo.label} />
        <div className="border-t border-stone-100 pt-3 flex justify-between font-bold text-stone-900">
          <span>Amount paid</span>
          <span>{rupee(pricing.total)}</span>
        </div>
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigate}
          className="col-span-2 py-3.5 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          {bookingFlow?.journeyId ? `View Journey — ${journeyObj?.title ?? ''}` : 'View All Bookings'}
        </button>
        <button
          onClick={() => navigate('my-bookings')}
          className="py-3 rounded-2xl border-2 border-stone-200 text-stone-700 font-medium text-sm hover:border-stone-300 transition-all"
        >
          My Bookings
        </button>
        <button
          onClick={() => alert('Opening maps...')}
          className="py-3 rounded-2xl border-2 border-stone-200 text-stone-700 font-medium text-sm hover:border-stone-300 transition-all"
        >
          Get Directions
        </button>
        <button
          onClick={() => alert('Connecting you to the hotel...')}
          className="py-3 rounded-2xl border-2 border-stone-200 text-stone-700 font-medium text-sm hover:border-stone-300 transition-all"
        >
          Contact Hotel
        </button>
        <button
          onClick={() => alert('Calendar invite sent!')}
          className="py-3 rounded-2xl border-2 border-stone-200 text-stone-700 font-medium text-sm hover:border-stone-300 transition-all"
        >
          Add to Calendar
        </button>
      </div>
    </div>
  );
}

// ─── Price Summary (sidebar) ─────────────────────────────────

interface PriceSummaryProps {
  hotel: Hotel;
  selectedRoom: RoomType | null;
  planInfo: PlanInfo;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricing: ReturnType<typeof computePrice>;
}

function PriceSummary({ hotel, selectedRoom, planInfo, checkIn, checkOut, nights, pricing }: PriceSummaryProps) {
  return (
    <div className="sticky top-24">
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800">Price Summary</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="font-semibold text-stone-900 text-sm">{hotel.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {fmtDateDisplay(checkIn)} – {fmtDateDisplay(checkOut)} · {nights} nights
            </p>
          </div>

          {selectedRoom ? (
            <>
              <div className="text-xs text-stone-500 space-y-0.5">
                <p>Room: <span className="text-stone-700 font-medium">{selectedRoom.name}</span></p>
                <p>Rate: <span className="text-stone-700 font-medium">{planInfo.label}</span></p>
              </div>

              <div className="space-y-2 text-sm border-t border-stone-100 pt-3">
                <div className="flex justify-between text-stone-600">
                  <span>{rupee(pricing.perNight)}/night</span>
                  <span>× {nights}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>{rupee(selectedRoom.pricePerNight * nights)}</span>
                </div>
                {pricing.rateAdj !== 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Rate adj.</span>
                    <span className={pricing.rateAdj > 0 ? '' : 'text-emerald-600'}>
                      {pricing.rateAdj > 0 ? '+' : ''}{rupee(pricing.rateAdj)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>Taxes (18%)</span>
                  <span>{rupee(pricing.taxes)}</span>
                </div>
                <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-stone-900 text-base">
                  <span>Total</span>
                  <span>{rupee(pricing.total)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-400 italic">Select a room to see pricing</p>
          )}

          <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 rounded-xl px-3 py-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure booking · Best price guaranteed
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI: Section card ─────────────────────────────────

function SectionCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-stone-800">{title}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-blue-600 font-medium hover:underline">Edit</button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-stone-500 min-w-24 flex-shrink-0">{label}</span>
      <span className="text-stone-800 font-medium">{value}</span>
    </div>
  );
}
