import { useState } from 'react';
import { useApp } from '../../../store/AppContext';
import { activities, currentTraveler, type ExperienceTimeSlot } from '../../../data/mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_NAMES[d.getDay()];
}

function displayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function generateRef(): string {
  return 'EXP-' + Math.random().toString(36).toUpperCase().slice(2, 8);
}

// ─── Step labels ──────────────────────────────────────────────────────────────

const STEP_LABELS = ['Overview', 'Date & Slot', 'Participants', 'Details', 'Review & Pay'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  if (step === 0 || step === 5) return null;
  const visibleStep = step - 1;
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const active = i === visibleStep;
        const done = i < visibleStep;
        return (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : done
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {done && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {label}
            </div>
            {i < STEP_LABELS.length - 1 && <div className="w-4 h-px bg-slate-200 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function ActivityHero({ imageUrl, name, category, rating, reviewCount, destination }: {
  imageUrl: string; name: string; category: string;
  rating: number; reviewCount: number; destination?: string;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden h-56 md:h-72 mb-6 shadow-lg">
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
            {category}
          </span>
          {destination && (
            <span className="text-white/80 text-xs">📍 {destination}</span>
          )}
        </div>
        <h1 className="font-display text-2xl md:text-3xl text-white font-normal leading-tight">{name}</h1>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-amber-400 text-sm">★</span>
          <span className="text-white text-sm font-medium">{rating}</span>
          <span className="text-white/70 text-sm">· {reviewCount.toLocaleString()} reviews</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  activity, selectedDate, selectedSlot, adults, children, childPrice, step,
}: {
  activity: { name: string; price: number; meetingPoint: string };
  selectedDate: string; selectedSlot: ExperienceTimeSlot | null;
  adults: number; children: number; childPrice: number; step: number;
}) {
  const subtotal = adults * activity.price + children * childPrice;
  const taxes = Math.round(subtotal * 0.18);
  const total = subtotal + taxes;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sticky top-6">
      <h3 className="font-medium text-slate-900 text-sm mb-4">Booking Summary</h3>
      <div className="border-b border-slate-100 pb-4 mb-4">
        <p className="font-medium text-slate-800 text-sm leading-snug">{activity.name}</p>
        {selectedDate && (
          <p className="text-slate-500 text-xs mt-1">
            {displayDate(selectedDate)}
            {selectedSlot ? ` · ${selectedSlot.time}` : ''}
          </p>
        )}
      </div>
      {(adults > 0 || children > 0) && (
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Adults × {adults}</span>
            <span>{formatINR(adults * activity.price)}</span>
          </div>
          {children > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Children × {children}</span>
              <span>{formatINR(children * childPrice)}</span>
            </div>
          )}
          {step >= 2 && (
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Taxes & fees (18%)</span>
              <span>{formatINR(taxes)}</span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatINR(step >= 2 ? total : subtotal)}</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2.5">
        <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-emerald-700 text-xs font-medium">Secure Booking</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExperienceBookingFlow() {
  const { bookingFlow, confirmBooking, navigate, updateItineraryItemStatus, journeys } = useApp();

  const [step, setStep] = useState(0);
  const defaultDate = formatDate(addDays(new Date(), 7));
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedSlot, setSelectedSlot] = useState<ExperienceTimeSlot | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [leadName, setLeadName] = useState(currentTraveler.name ?? 'Arjun Mehta');
  const [email, setEmail] = useState('arjun.mehta@email.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [country, setCountry] = useState('India');
  const [dietary, setDietary] = useState('none');
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [pickupOption, setPickupOption] = useState<'meeting-point' | 'hotel-pickup'>('meeting-point');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [confirmationRef, setConfirmationRef] = useState('');

  if (!bookingFlow) return null;
  const _activity = activities.find((a) => a.id === bookingFlow.itemId);
  if (!_activity) return <div className="p-8 text-center text-slate-500">Experience not found.</div>;

  // Non-nullable aliases so closures see narrowed types
  const activity = _activity;
  const flow = bookingFlow;

  const childPrice = activity.pricePerChild ?? Math.round(activity.price * 0.6);
  const pickupExtra = pickupOption === 'hotel-pickup' ? 800 * (adults + children) : 0;
  const subtotal = adults * activity.price + children * childPrice + pickupExtra;
  const taxes = Math.round(subtotal * 0.18);
  const total = subtotal + taxes;

  const journey = journeys.find((j) => j.id === flow.journeyId);

  const today = new Date();
  const next14Days = Array.from({ length: 14 }, (_, i) => formatDate(addDays(today, i + 1)));

  function isDateAvailable(dateStr: string): boolean {
    if (!activity.availableDays || activity.availableDays.length === 0) return true;
    const dayName = getDayName(dateStr);
    return activity.availableDays.includes(dayName);
  }

  function handlePayNow() {
    setPaymentProcessing(true);
    setTimeout(() => {
      const ref = generateRef();
      const booking = {
        id: 'booking-' + Date.now(),
        journeyId: flow.journeyId ?? 'standalone',
        travelerId: currentTraveler.id,
        type: 'activity' as const,
        status: 'confirmed' as const,
        referenceId: ref,
        supplierId: activity.id,
        supplierName: activity.name,
        itemName: activity.name,
        itemDetails: `${displayDate(selectedDate)} · ${selectedSlot?.time ?? ''} · ${adults + children} participants`,
        totalAmount: total,
        currency: 'INR' as const,
        paymentStatus: 'successful' as const,
        createdAt: new Date().toISOString(),
        passengers: adults + children,
      };
      setConfirmedBooking(booking);
      setConfirmationRef(ref);
      setPaymentProcessing(false);
      setStep(5);
    }, 1500);
  }

  function handleConfirmNavigate() {
    if (!confirmedBooking) return;
    if (flow.journeyId && flow.itineraryItemId) {
      updateItineraryItemStatus(flow.journeyId, flow.itineraryItemId, 'booked', confirmedBooking.id);
    }
    confirmBooking(confirmedBooking);
  }

  // ── Step 0: Overview ────────────────────────────────────────────────────────

  function renderOverview() {
    const isFreeCancel = activity.cancellationPolicy.toLowerCase().startsWith('free');
    return (
      <div>
        <ActivityHero
          imageUrl={activity.imageUrl}
          name={activity.name}
          category={activity.category}
          rating={activity.rating}
          reviewCount={activity.reviewCount}
          destination={activity.destination}
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { icon: '⏱', text: activity.duration },
            { icon: '📍', text: activity.meetingPoint },
            { icon: '👥', text: `Up to ${activity.maxParticipants} people` },
            { icon: '🗣', text: 'English, Japanese' },
          ].map((chip) => (
            <span
              key={chip.text}
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-1.5 rounded-full"
            >
              <span>{chip.icon}</span>
              <span>{chip.text}</span>
            </span>
          ))}
        </div>

        <p className="text-slate-600 text-sm leading-relaxed mb-6">{activity.longDescription || activity.description}</p>

        {activity.includedItems.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">{"What's included"}</h3>
            <ul className="space-y-2">
              {activity.includedItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activity.excludedItems.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">{"What's not included"}</h3>
            <ul className="space-y-2">
              {activity.excludedItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 ml-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`rounded-xl p-4 mb-6 ${isFreeCancel ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg">{isFreeCancel ? '✅' : '⚠️'}</span>
            <div>
              <p className={`text-sm font-semibold ${isFreeCancel ? 'text-emerald-800' : 'text-amber-800'}`}>
                Cancellation Policy
              </p>
              <p className={`text-sm mt-0.5 ${isFreeCancel ? 'text-emerald-700' : 'text-amber-700'}`}>
                {activity.cancellationPolicy}
              </p>
            </div>
          </div>
        </div>

        {activity.requirements && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-lg">ℹ️</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">Important Information</p>
                <p className="text-sm text-blue-700 mt-0.5">{activity.requirements}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-6">
          <div>
            <span className="text-slate-500 text-sm">From</span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl text-slate-900">{formatINR(activity.price)}</span>
              <span className="text-slate-500 text-sm">per adult</span>
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-blue-200"
          >
            Book this experience →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Date & Time Slot ─────────────────────────────────────────────────

  function renderDateSlot() {
    return (
      <div>
        <h2 className="font-display text-2xl text-slate-900 mb-1">When would you like to go?</h2>
        <p className="text-slate-500 text-sm mb-6">Select an available date and time slot.</p>

        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Date</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {next14Days.map((dateStr) => {
              const available = isDateAvailable(dateStr);
              const selected = dateStr === selectedDate;
              const d = new Date(dateStr + 'T00:00:00');
              const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
              const dayNum = d.getDate();
              const mon = d.toLocaleDateString('en-IN', { month: 'short' });
              return (
                <button
                  key={dateStr}
                  disabled={!available}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setSelectedSlot(null);
                  }}
                  className={`flex flex-col items-center shrink-0 w-14 py-2.5 rounded-xl border text-xs transition-all ${
                    !available
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                      : selected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className="font-medium">{dayLabel}</span>
                  <span className="text-base font-bold leading-tight">{dayNum}</span>
                  <span className="opacity-70">{mon}</span>
                </button>
              );
            })}
          </div>
          {selectedDate && isDateAvailable(selectedDate) && (
            <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Available on {displayDate(selectedDate)} ({getDayName(selectedDate)})
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Time Slot</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activity.timeSlots.map((slot) => {
              const soldOut = slot.availableSpots === 0;
              const limited = slot.availableSpots > 0 && slot.availableSpots <= 3;
              const selected = selectedSlot?.id === slot.id;
              return (
                <button
                  key={slot.id}
                  disabled={soldOut}
                  onClick={() => setSelectedSlot(slot)}
                  className={`relative text-left p-4 rounded-xl border transition-all ${
                    soldOut
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : selected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : limited
                      ? 'bg-white border-amber-300 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  {limited && !selected && (
                    <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Only {slot.availableSpots} left!
                    </span>
                  )}
                  <p className={`text-lg font-bold ${selected ? 'text-white' : 'text-slate-900'}`}>{slot.time}</p>
                  <div className={`flex items-center gap-3 mt-2 text-xs ${selected ? 'text-blue-100' : 'text-slate-500'}`}>
                    <span>⏱ {activity.duration}</span>
                    <span>👥 {soldOut ? 'Sold out' : `${slot.availableSpots} spots left`}</span>
                  </div>
                  <p className={`text-sm font-semibold mt-2 ${selected ? 'text-white' : 'text-blue-600'}`}>
                    {formatINR(activity.price)}/person
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mt-8">
          <button onClick={() => setStep(0)} className="text-slate-500 text-sm hover:text-slate-700">← Back</button>
          <button
            disabled={!selectedDate || !selectedSlot}
            onClick={() => setStep(2)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Participants ──────────────────────────────────────────────────────

  function Stepper({ label, sublabel, value, min, max, onChange }: {
    label: string; sublabel: string; value: number; min: number; max: number;
    onChange: (v: number) => void;
  }) {
    return (
      <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
        <div>
          <p className="font-medium text-slate-900 text-sm">{label}</p>
          <p className="text-slate-500 text-xs mt-0.5">{sublabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors text-lg font-light"
          >
            −
          </button>
          <span className="text-slate-900 font-semibold w-6 text-center">{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  function renderParticipants() {
    const atMax = adults + children >= activity.maxParticipants;
    return (
      <div>
        <h2 className="font-display text-2xl text-slate-900 mb-1">{"Who's joining?"}</h2>
        <p className="text-slate-500 text-sm mb-6">Up to {activity.maxParticipants} participants per booking.</p>

        <div className="bg-white border border-slate-200 rounded-2xl px-5 mb-6">
          <Stepper
            label="Adults"
            sublabel={formatINR(activity.price) + ' per adult'}
            value={adults}
            min={1}
            max={activity.maxParticipants - children}
            onChange={setAdults}
          />
          <Stepper
            label="Children"
            sublabel={formatINR(childPrice) + ' per child'}
            value={children}
            min={0}
            max={activity.maxParticipants - adults}
            onChange={setChildren}
          />
          {activity.minAge > 0 && (
            <div className="py-3 text-xs text-slate-500 flex items-start gap-2">
              <span>ℹ️</span>
              <span>Minimum age {activity.minAge} years. Infants must be held by an adult.</span>
            </div>
          )}
        </div>

        {atMax && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
            Maximum group size of {activity.maxParticipants} reached.
          </div>
        )}

        <div className="bg-slate-50 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Price Breakdown</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-700">
              <span>Adults {adults} × {formatINR(activity.price)}</span>
              <span>{formatINR(adults * activity.price)}</span>
            </div>
            {children > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Children {children} × {formatINR(childPrice)}</span>
                <span>{formatINR(children * childPrice)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
              <span>Subtotal</span>
              <span>{formatINR(adults * activity.price + children * childPrice)}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Meeting & Pickup</p>
          <div className="space-y-2">
            {[
              { value: 'meeting-point', label: `Meet at ${activity.meetingPoint}`, sublabel: 'Included in price' },
              { value: 'hotel-pickup', label: 'Hotel pickup', sublabel: `+${formatINR(800)} per person` },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  pickupOption === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="pickup"
                  value={opt.value}
                  checked={pickupOption === opt.value}
                  onChange={() => setPickupOption(opt.value as 'meeting-point' | 'hotel-pickup')}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.sublabel}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(1)} className="text-slate-500 text-sm hover:text-slate-700">← Back</button>
          <button
            onClick={() => setStep(3)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            Continue to Details
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Traveler Details ─────────────────────────────────────────────────

  const dietaryOptions = ['none', 'vegetarian', 'vegan', 'gluten-free', 'halal', 'other'];

  function renderDetails() {
    const canContinue = leadName.trim() && email.trim() && phone.trim();
    return (
      <div>
        <h2 className="font-display text-2xl text-slate-900 mb-1">Tell us about your group</h2>
        <p className="text-slate-500 text-sm mb-6">Pre-filled from your Travel Identity.</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Lead Traveler</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { label: 'Full Name', value: leadName, onChange: setLeadName, type: 'text', placeholder: 'Arjun Mehta' },
              { label: 'Email', value: email, onChange: setEmail, type: 'email', placeholder: 'arjun.mehta@email.com' },
              { label: 'Phone', value: phone, onChange: setPhone, type: 'tel', placeholder: '+91 98765 43210' },
              { label: 'Country', value: country, onChange: setCountry, type: 'text', placeholder: 'India' },
            ] as const).map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Dietary Requirements</p>
          <div className="flex flex-wrap gap-2">
            {dietaryOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setDietary(opt)}
                className={`px-4 py-2 rounded-full text-sm border transition-all capitalize ${
                  dietary === opt
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {opt === 'none' ? 'No restrictions' : opt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">Accessibility needs</p>
            <button
              onClick={() => setAccessibilityEnabled(!accessibilityEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${accessibilityEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${accessibilityEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {accessibilityEnabled && (
            <textarea
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
              placeholder="Please describe any accessibility requirements..."
              rows={3}
              className="w-full mt-3 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Special Requests</p>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Any special requests or notes for the host..."
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(2)} className="text-slate-500 text-sm hover:text-slate-700">← Back</button>
          <button
            disabled={!canContinue}
            onClick={() => setStep(4)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            Continue to Review
          </button>
        </div>
      </div>
    );
  }

  // ── Step 4: Review & Payment ──────────────────────────────────────────────────

  function EditLink({ onClick }: { onClick: () => void }) {
    return (
      <button onClick={onClick} className="text-blue-600 text-xs hover:underline ml-2">Edit</button>
    );
  }

  function renderReviewPayment() {
    const isFreeCancel = activity.cancellationPolicy.toLowerCase().startsWith('free');
    return (
      <div>
        <h2 className="font-display text-2xl text-slate-900 mb-1">Review & Payment</h2>
        <p className="text-slate-500 text-sm mb-6">Confirm your details and complete your booking.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Experience</p>
                <EditLink onClick={() => setStep(0)} />
              </div>
              <p className="font-semibold text-slate-900 text-sm">{activity.name}</p>
              <p className="text-slate-600 text-sm mt-1">{activity.category} · {activity.duration}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</p>
                <EditLink onClick={() => setStep(1)} />
              </div>
              <p className="text-slate-900 text-sm font-medium">{displayDate(selectedDate)} ({getDayName(selectedDate)})</p>
              {selectedSlot && <p className="text-slate-600 text-sm mt-0.5">{selectedSlot.time}</p>}
            </div>

            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Participants</p>
                <EditLink onClick={() => setStep(2)} />
              </div>
              <p className="text-slate-900 text-sm">{adults} Adult{adults !== 1 ? 's' : ''}{children > 0 ? `, ${children} Child${children !== 1 ? 'ren' : ''}` : ''}</p>
              <p className="text-slate-600 text-sm mt-0.5">
                {pickupOption === 'hotel-pickup' ? 'Hotel pickup' : `Meet at ${activity.meetingPoint}`}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead Traveler</p>
                <EditLink onClick={() => setStep(3)} />
              </div>
              <p className="text-slate-900 text-sm font-medium">{leadName}</p>
              <p className="text-slate-600 text-sm">{email}</p>
              <p className="text-slate-600 text-sm">{phone}</p>
              {dietary !== 'none' && <p className="text-slate-500 text-xs mt-1 capitalize">Dietary: {dietary}</p>}
              {specialRequests && <p className="text-slate-500 text-xs mt-1">Requests: {specialRequests}</p>}
            </div>

            {activity.includedItems.length > 0 && (
              <div className="bg-emerald-50 rounded-2xl p-5">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Included</p>
                <p className="text-emerald-800 text-sm">{activity.includedItems.join(' · ')}</p>
              </div>
            )}

            <div className={`rounded-2xl p-5 ${isFreeCancel ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isFreeCancel ? 'text-emerald-700' : 'text-amber-700'}`}>
                Cancellation
              </p>
              <p className={`text-sm ${isFreeCancel ? 'text-emerald-800' : 'text-amber-800'}`}>
                {activity.cancellationPolicy}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Price Breakdown</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>Adults {adults} × {formatINR(activity.price)}</span>
                  <span>{formatINR(adults * activity.price)}</span>
                </div>
                {children > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Children {children} × {formatINR(childPrice)}</span>
                    <span>{formatINR(children * childPrice)}</span>
                  </div>
                )}
                {pickupExtra > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Hotel pickup ({adults + children} pax)</span>
                    <span>{formatINR(pickupExtra)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Taxes & fees (18%)</span>
                  <span>{formatINR(taxes)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-base">
                  <span>Total</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Payment Method</p>

              <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-5">
                {(['card', 'upi', 'netbanking'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      paymentMethod === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'card' ? 'Card' : m === 'upi' ? 'UPI' : 'Net Banking'}
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-700 text-sm font-mono tracking-widest">•••• •••• •••• 4242</span>
                      <span className="text-blue-700 font-bold text-xs bg-blue-100 px-2 py-0.5 rounded">VISA</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Arjun Mehta</span>
                      <span>12/28</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">Saved card · Tap to change</p>
                </div>
              )}

              {paymentMethod === 'upi' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Enter UPI ID (e.g. arjun@ybl)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    {['GPay', 'PhonePe', 'Paytm'].map((app) => (
                      <button key={app} className="flex-1 border border-slate-200 rounded-lg py-2 text-xs text-slate-600 hover:border-slate-300">
                        {app}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Select your bank</option>
                  {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank'].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-2 mt-5 text-slate-500 text-xs">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                256-bit SSL encrypted · PCI DSS compliant
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isFreeCancel ? 'Free cancellation available. ' : ''}
                By proceeding you agree to our Terms.
              </p>
            </div>

            <button
              onClick={handlePayNow}
              disabled={paymentProcessing}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-4 rounded-2xl font-bold text-base transition-colors shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
            >
              {paymentProcessing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                `Pay ${formatINR(total)}`
              )}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={() => setStep(3)} className="text-slate-500 text-sm hover:text-slate-700">← Back</button>
        </div>
      </div>
    );
  }

  // ── Step 5: Confirmation ──────────────────────────────────────────────────────

  function renderConfirmation() {
    return (
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-display text-3xl text-slate-900 mb-2">{"You're booked! 🎟️"}</h1>
        <p className="text-slate-600 text-lg mb-2">{activity.name}</p>

        {journey && (
          <span className="inline-block bg-emerald-100 text-emerald-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            Added to {journey.title}
          </span>
        )}

        <div className="bg-slate-900 text-white rounded-2xl px-8 py-4 inline-block mb-8">
          <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Confirmation Number</p>
          <p className="font-mono text-2xl font-bold tracking-widest">{confirmationRef}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left mb-8 max-w-lg mx-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Booking Details</p>
          <div className="space-y-3 text-sm">
            {([
              { label: 'Experience', value: activity.name },
              { label: 'Date', value: displayDate(selectedDate) + ' (' + getDayName(selectedDate) + ')' },
              { label: 'Time', value: selectedSlot?.time ?? '—' },
              { label: 'Duration', value: activity.duration },
              { label: 'Participants', value: `${adults} Adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} Child${children !== 1 ? 'ren' : ''}` : ''}` },
              { label: 'Meeting Point', value: activity.meetingPoint },
              { label: 'Cancellation', value: activity.cancellationPolicy },
              { label: 'Amount Paid', value: formatINR(total) },
            ] as const).map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">{label}</span>
                <span className="text-slate-900 font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mb-8">
          {[
            { label: 'View Booking', icon: '🎫', onClick: () => navigate('my-bookings') },
            { label: 'Get Directions', icon: '🗺️', onClick: () => alert(`Opening maps to ${activity.meetingPoint}`) },
            { label: 'Add to Calendar', icon: '📅', onClick: () => alert('Calendar invite sent') },
            { label: 'Contact Host', icon: '💬', onClick: () => alert('Connecting you to the host...') },
          ].map(({ label, icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-medium text-slate-700">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirmNavigate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-xl font-semibold text-sm transition-colors"
        >
          {flow.journeyId ? 'View Journey' : 'View All Bookings'}
        </button>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  const showSummary = step >= 1 && step <= 4;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {step === 0 && (
          <button
            onClick={() => navigate('explore')}
            className="flex items-center gap-2 text-slate-500 text-sm mb-6 hover:text-slate-700"
          >
            ← Back to experiences
          </button>
        )}

        <StepIndicator step={step} />

        {step === 5 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            {renderConfirmation()}
          </div>
        ) : (
          <div className={showSummary ? 'grid grid-cols-1 lg:grid-cols-3 gap-8' : ''}>
            <div className={showSummary ? 'lg:col-span-2' : ''}>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {step === 0 && renderOverview()}
                {step === 1 && renderDateSlot()}
                {step === 2 && renderParticipants()}
                {step === 3 && renderDetails()}
                {step === 4 && renderReviewPayment()}
              </div>
            </div>

            {showSummary && (
              <div className="lg:col-span-1">
                <SummaryCard
                  activity={activity}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  adults={adults}
                  children={children}
                  childPrice={childPrice}
                  step={step}
                />
              </div>
            )}
          </div>
        )}

        {showSummary && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between lg:hidden z-10">
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="font-bold text-slate-900">{formatINR(step >= 2 ? total : adults * activity.price + children * childPrice)}</p>
            </div>
            <p className="text-xs text-slate-400">{step < STEP_LABELS.length ? STEP_LABELS[step] : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}
