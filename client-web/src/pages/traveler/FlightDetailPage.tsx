import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { flights } from '../../data/mockData';

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const airlineColors: Record<string, string> = {
  IN: 'bg-orange-100 text-orange-700',
  AI: 'bg-blue-100 text-blue-700',
  SG: 'bg-red-100 text-red-700',
  UK: 'bg-purple-100 text-purple-700',
  G8: 'bg-yellow-100 text-yellow-700',
  QR: 'bg-indigo-100 text-indigo-700',
  EK: 'bg-rose-100 text-rose-700',
};

function getAirlineColor(code: string): string {
  return airlineColors[code] ?? 'bg-slate-100 text-slate-700';
}

interface FareTier {
  name: string;
  price: number;
  cabinBag: string;
  checkedBag: string;
  seatSelection: boolean;
  meal: boolean;
  cancellation: string;
}

function buildFares(basePrice: number): FareTier[] {
  return [
    {
      name: 'Basic',
      price: basePrice,
      cabinBag: '7 kg',
      checkedBag: '15 kg',
      seatSelection: false,
      meal: false,
      cancellation: 'Non-refundable',
    },
    {
      name: 'Standard',
      price: Math.round(basePrice * 1.15),
      cabinBag: '7 kg',
      checkedBag: '20 kg',
      seatSelection: true,
      meal: true,
      cancellation: 'Partial refund',
    },
    {
      name: 'Flex',
      price: Math.round(basePrice * 1.3),
      cabinBag: '7 kg',
      checkedBag: '23 kg',
      seatSelection: true,
      meal: true,
      cancellation: 'Full refund',
    },
  ];
}

function CheckIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function FlightDetailPage() {
  const { selectedFlightId, navigate, startBookingFlow, bookingFlow } = useApp();
  const [selectedFareIdx, setSelectedFareIdx] = useState(0);

  const flight = flights.find((f) => f.id === selectedFlightId);

  if (!flight) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600">
        <p className="text-lg font-semibold">Flight not found.</p>
        <button
          onClick={() => navigate('search')}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Back to Search
        </button>
      </div>
    );
  }

  const fares = buildFares(flight.price);
  const selectedFare = fares[selectedFareIdx];

  const baseFare = selectedFare.price;
  const taxes = Math.round(baseFare * 0.18);
  const fees = 299;
  const total = baseFare + taxes + fees;

  // Alternate flights for same destination
  const alternates = flights.filter(
    (f) => f.id !== flight.id && f.destinationId === flight.destinationId && f.price < flight.price
  );

  const handleBack = () => {
    if (bookingFlow?.source === 'journey' && bookingFlow.journeyId) {
      navigate('journey', { selectedJourneyId: bookingFlow.journeyId });
    } else {
      navigate('search');
    }
  };

  const handleContinue = () => {
    startBookingFlow({
      type: 'flight',
      itemId: flight.id,
      source: bookingFlow?.source ?? 'search',
      journeyId: bookingFlow?.journeyId,
      itineraryItemId: bookingFlow?.itineraryItemId,
    });
  };

  const depTime = formatTime(flight.departureTime);
  const arrTime = formatTime(flight.arrivalTime);
  const abbrev = flight.airline.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <button onClick={() => navigate('home')} className="hover:text-blue-600 transition-colors">Home</button>
            <span>›</span>
            <button onClick={() => navigate('search')} className="hover:text-blue-600 transition-colors">Search</button>
            <span>›</span>
            <span className="text-slate-900 font-medium">Flight Detail</span>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Hero card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${getAirlineColor(flight.airlineCode)}`}>
                    {abbrev}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">{flight.airline}</h1>
                    <p className="text-slate-500 text-sm font-mono">{flight.flightNumber} · {flight.aircraft}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium capitalize">
                      {flight.class}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">{formatINR(flight.price)}</p>
                  <p className="text-xs text-slate-500">per person</p>
                  {flight.seatsLeft < 10 && (
                    <p className="text-xs text-red-600 font-medium mt-1">{flight.seatsLeft} seats left!</p>
                  )}
                </div>
              </div>

              {/* Flight timeline */}
              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  {/* Departure */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900 font-mono">{depTime}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{flight.fromCode}</p>
                    <p className="text-sm text-slate-500 mt-1">{flight.from}</p>
                  </div>

                  {/* Middle */}
                  <div className="flex-1 mx-6">
                    <p className="text-center text-xs text-slate-400 mb-2">{flight.duration}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-0.5 bg-slate-300" />
                      <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2h0A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                      </svg>
                      <div className="flex-1 h-0.5 bg-slate-300" />
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                      {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}${flight.stopCity ? ` · via ${flight.stopCity}` : ''}`}
                    </p>
                  </div>

                  {/* Arrival */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900 font-mono">{arrTime}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{flight.toCode}</p>
                    <p className="text-sm text-slate-500 mt-1">{flight.to}</p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {flight.baggageIncluded} baggage
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${flight.refundable ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {flight.refundable ? 'Refundable' : 'Non-refundable'}
                </span>
                <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                  {flight.fareType}
                </span>
              </div>
            </div>

            {/* Fare options */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Your Fare</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {fares.map((fare, idx) => {
                  const isSelected = idx === selectedFareIdx;
                  return (
                    <button
                      key={fare.name}
                      onClick={() => setSelectedFareIdx(idx)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-900">{fare.name}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold text-blue-600 mb-3">{formatINR(fare.price)}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H3M21 10a9 9 0 0 0-18 0M21 10v4a9 9 0 0 1-18 0v-4" />
                          </svg>
                          <span>Cabin: {fare.cabinBag}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="6" width="18" height="14" rx="2" />
                            <path strokeLinecap="round" d="M8 6V4a2 2 0 0 1 4 0v2" />
                          </svg>
                          <span>Checked: {fare.checkedBag}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <CheckIcon ok={fare.seatSelection} />
                          <span>Seat selection</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <CheckIcon ok={fare.meal} />
                          <span>Meal included</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4m0 0l4-4m-4 4h11" />
                          </svg>
                          <span className="text-xs">{fare.cancellation}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Why this flight */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Why this flight?</h2>
              <div className="space-y-3">
                {(() => {
                  const depHour = new Date(flight.departureTime).getHours();
                  const facts: { icon: string; text: string }[] = [];

                  if (depHour < 9) {
                    facts.push({ icon: '🌅', text: 'Early morning departure — beat the crowds and arrive with the day ahead of you.' });
                  } else if (depHour >= 22 || depHour < 4) {
                    facts.push({ icon: '🌙', text: 'Overnight flight — sleep on board and wake up at your destination.' });
                  } else {
                    facts.push({ icon: '☀️', text: 'Convenient daytime departure with flexible onward connections.' });
                  }

                  if (flight.stops === 0) {
                    facts.push({ icon: '✈️', text: `Non-stop route from ${flight.from} to ${flight.to}. No layovers, no hassle.` });
                  } else {
                    facts.push({ icon: '🔄', text: `${flight.stops} stop${flight.stops > 1 ? 's' : ''}${flight.stopCity ? ` via ${flight.stopCity}` : ''} — more affordable than direct routes.` });
                  }

                  facts.push({ icon: '💰', text: `${formatINR(flight.price)} in Economy — competitive pricing for this route.` });

                  if (alternates.length > 0) {
                    const cheapest = alternates.reduce((a, b) => (a.price < b.price ? a : b));
                    facts.push({ icon: '💡', text: `Cheaper alternative: ${cheapest.airline} at ${formatINR(cheapest.price)} — but fewer amenities.` });
                  }

                  return facts.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="text-lg leading-none mt-0.5">{f.icon}</span>
                      <p className="text-sm text-slate-700">{f.text}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>

          {/* Sticky sidebar */}
          <div className="lg:w-80 shrink-0">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-lg mb-1">Booking Summary</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {flight.fromCode} → {flight.toCode} · {selectedFare.name} fare
                </p>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Base fare</span>
                    <span className="font-medium text-slate-900">{formatINR(baseFare)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Taxes (18%)</span>
                    <span className="font-medium text-slate-900">{formatINR(taxes)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Convenience fee</span>
                    <span className="font-medium text-slate-900">{formatINR(fees)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="font-bold text-blue-600 text-lg">{formatINR(total)}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{selectedFare.checkedBag} checked baggage</span>
                  </div>
                  {selectedFare.seatSelection && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Free seat selection</span>
                    </div>
                  )}
                  {selectedFare.meal && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Meal included</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleContinue}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                >
                  Continue to Booking
                </button>
                <p className="text-center text-xs text-slate-400 mt-3">
                  Price per person · {selectedFare.cancellation}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
