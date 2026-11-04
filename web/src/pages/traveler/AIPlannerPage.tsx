import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { hotels, activities } from '../../data/mockData';
import { generateItinerary, type JourneyDNA } from '../../lib/itineraryApi';
import {
  toGeneratedJourney,
  type GeneratedJourney,
  type JourneyDay,
  type JourneyItem,
} from '../../lib/itineraryAdapter';
import { makeDefaultDna, validateDna, formatLocalDate } from '../../lib/plannerForm';

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthBar({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-6 text-right">{score}</span>
    </div>
  );
}

const itemTypeColors: Record<string, string> = {
  flight: 'bg-sky-50 text-sky-700 border-sky-100',
  hotel: 'bg-blue-50 text-blue-700 border-blue-100',
  activity: 'bg-violet-50 text-violet-700 border-violet-100',
  transfer: 'bg-slate-50 text-slate-500 border-slate-200',
  meal: 'bg-amber-50 text-amber-700 border-amber-100',
  free: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const itemTypeIcons: Record<string, string> = {
  flight: '✈', hotel: '🏨', activity: '⭐', transfer: '🚗', meal: '🍽', free: '☀',
};

const INTERESTS = ['Food', 'Culture', 'Nature', 'Adventure', 'Shopping', 'Photography', 'Nightlife', 'Wellness', 'History'];

const BUILD_MSGS = [
  'Analysing your Journey DNA...',
  'Matching destinations to your interests...',
  'Selecting hotels by comfort preference...',
  'Building your daily schedule...',
  'Calculating Journey Health score...',
  'Optimising route for minimal transit...',
  'Adding local hidden gems...',
  'Finalising your complete journey...',
];

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'dna' | 'building' | 'result';

export default function AIPlannerPage() {
  const {
    navigate,
    refreshJourneys,
    plannerDestination,
    plannerDestinationId,
    navigateToHotel,
    navigateToExperience,
    startBookingFlow,
  } = useApp();

  const [phase, setPhase] = useState<Phase>('dna');
  const [buildMsgIdx, setBuildMsgIdx] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [journey, setJourney] = useState<GeneratedJourney | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [showWhyId, setShowWhyId] = useState<string | null>(null);
  const [controlMsg, setControlMsg] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonScenario, setComparisonScenario] = useState<string>('reduceBudget');
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [addActivityDayId, setAddActivityDayId] = useState<number | null>(null);

  const [dna, setDna] = useState<JourneyDNA>(() =>
    makeDefaultDna(new Date(), {
      destination: plannerDestination,
      destinationId: plannerDestinationId,
    })
  );

  const lastAppliedPrefillRef = useRef<string | undefined>(plannerDestination);

  useEffect(() => {
    if (plannerDestination) {
      setDna((prev) => {
        // Apply prefill only if destination field is still empty or still equals the previous prefill value.
        // This ensures what the user has already typed is never overwritten.
        if (!prev.destination || prev.destination === lastAppliedPrefillRef.current) {
          lastAppliedPrefillRef.current = plannerDestination;
          return {
            ...prev,
            destination: plannerDestination,
            destinationId: plannerDestinationId || '',
          };
        }
        return prev;
      });
    }
  }, [plannerDestination, plannerDestinationId]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleBuildJourney = async () => {
    // Abort any prior in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPhase('building');
    setBuildError(null);
    setBuildMsgIdx(0);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setBuildMsgIdx((i) => (i + 1) % BUILD_MSGS.length);
    }, 1200);

    try {
      const rawResponse = await generateItinerary(dna, controller.signal);
      if (intervalRef.current) clearInterval(intervalRef.current);

      const generated = toGeneratedJourney(rawResponse, dna);
      setJourney(generated);
      setSavedJourneyId(rawResponse.itineraryId);
      refreshJourneys();
      setExpandedDay(1);
      setControlMsg(null);
      setShowComparison(false);
      setPhase('result');
    } catch (err: any) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (controller.signal.aborted) {
        return;
      }
      const message = err?.message || 'Failed to generate itinerary. Please try again.';
      setBuildError(message);
    }
  };

  const handleTryAgain = () => {
    setBuildError(null);
    setPhase('dna');
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const toggleInterest = (interest: string) => {
    setDna((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  if (phase === 'dna') return <DNAForm dna={dna} setDna={setDna} onBuild={handleBuildJourney} toggleInterest={toggleInterest} />;
  if (phase === 'building') {
    return (
      <BuildingScreen
        msgIdx={buildMsgIdx}
        destination={dna.destination}
        error={buildError}
        onTryAgain={handleTryAgain}
      />
    );
  }

  if (!journey) return null;

  const hotelRecs = journey.days.flatMap((d) => d.items).filter((it) => it.entityType === 'hotel' && it.entityId);
  const expRecs = journey.days.flatMap((d) => d.items).filter((it) => it.entityType === 'activity' && it.entityId);
  const uniqueHotels = hotelRecs.filter((h, i) => hotelRecs.findIndex((x) => x.entityId === h.entityId) === i);
  const uniqueExps = expRecs.filter((e, i) => expRecs.findIndex((x) => x.entityId === e.entityId) === i);

  // hidden until backed by real data
  const showUnsupported: boolean = false;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">J</span>
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Journey AI</span>
          </div>
          <h1 className="font-display text-3xl text-slate-900 mb-0.5">{journey.title}</h1>
          <p className="text-slate-500 text-sm">{journey.dna.nights} nights · {journey.dna.travelers} travelers · {journey.route.join(' → ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { setPhase('dna'); setJourney(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Rebuild
          </button>
          {savedJourneyId ? (
            <button onClick={() => navigate('my-trips')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Saved to My Trips
            </button>
          ) : null}
        </div>
      </div>

      {/* AI control message */}
      {controlMsg && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">J</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-800 mb-0.5">Journey AI</p>
            <p className="text-sm text-blue-900 leading-relaxed">{controlMsg}</p>
          </div>
          <button onClick={() => setControlMsg(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* hidden until backed by real data */}
          {showUnsupported && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Journey Health</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl text-slate-900">{journey.health.overall}</span>
                    <span className="text-slate-400 text-lg">/100</span>
                  </div>
                </div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${journey.health.overall >= 90 ? 'bg-emerald-50' : journey.health.overall >= 80 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4l2.5 5.5L22 11l-5.5 2.5L14 19l-2.5-5.5L6 11l5.5-2.5L14 4z" fill={journey.health.overall >= 90 ? '#10b981' : journey.health.overall >= 80 ? '#3b82f6' : '#f59e0b'} opacity="0.8"/>
                  </svg>
                </div>
              </div>
              <div className="space-y-2.5">
                <HealthBar score={journey.health.budget} label="Budget fit" />
                <HealthBar score={journey.health.pace} label="Pace" />
                <HealthBar score={journey.health.interests} label="Interests" />
                <HealthBar score={journey.health.convenience} label="Convenience" />
                <HealthBar score={journey.health.travelTime} label="Travel time" />
                <HealthBar score={journey.health.hotels} label="Hotels" />
              </div>
            </div>
          )}

          {/* Daily Itinerary */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Daily Itinerary</h2>
              <p className="text-xs text-slate-400 mt-0.5">{journey.dna.nights} days · {journey.days.flatMap((d) => d.items).length} planned items</p>
            </div>
            <div className="divide-y divide-slate-50">
              {journey.days.map((day) => {
                const isOpen = expandedDay === day.day;
                const visibleItems = day.items.filter((it) => !removedItems.has(it.id));
                const dayCost = day.estimatedCostINR ?? visibleItems.reduce((s, it) => s + it.cost, 0);
                return (
                  <div key={day.day}>
                    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <button
                        onClick={() => setExpandedDay(isOpen ? null : day.day)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {day.day}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{day.title}</p>
                          <p className="text-xs text-slate-400">{day.location} · {day.date}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {dayCost > 0 && <span className="text-xs text-slate-500">₹{dayCost.toLocaleString()}</span>}
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddActivityDayId(addActivityDayId === day.day ? null : day.day); }}
                            className="flex items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-md transition-colors"
                          >
                            <span className="text-sm leading-none">+</span> Add
                          </button>
                          {addActivityDayId === day.day && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                              {['Flight', 'Hotel', 'Experience', 'Note'].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => { alert('Feature in development'); setAddActivityDayId(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  Add {type}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setExpandedDay(isOpen ? null : day.day)} className="p-1">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                            <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-slate-50 bg-slate-50/30">
                        {visibleItems.length === 0 && (
                          <p className="px-5 py-4 text-xs text-slate-400 italic">No items — use + Add to plan this day.</p>
                        )}
                        {visibleItems.map((item) => {
                          const hotel = item.entityType === 'hotel' ? hotels.find((h) => h.id === item.entityId) : null;
                          const activity = item.entityType === 'activity' ? activities.find((a) => a.id === item.entityId) : null;
                          const isBooked = item.status === 'booked';
                          return (
                            <div key={item.id} className="flex items-start gap-3 px-5 py-3 group">
                              <span className="text-xs font-mono text-slate-400 min-w-[3.5rem] flex-shrink-0 pt-0.5">{item.time}</span>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-white border border-slate-100">
                                {itemTypeIcons[item.type] || '•'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize ${itemTypeColors[item.type] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {item.type}
                                  </span>
                                  {isBooked && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-50 text-emerald-700 border-emerald-100">✓ Booked</span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                {item.duration && <p className="text-xs text-slate-400">{item.duration}</p>}
                                {item.note && <p className="text-xs text-slate-500 italic mt-0.5">{item.note}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {item.costKnown === false ? (
                                  <span className="text-xs text-slate-400 font-mono">-</span>
                                ) : item.cost > 0 ? (
                                  <span className="text-xs text-slate-500">₹{item.cost.toLocaleString()}</span>
                                ) : (
                                  <span className="text-xs text-emerald-600 font-medium">Free</span>
                                )}
                                {/* hidden until backed by real data */}
                                {showUnsupported && item.aiReason && (
                                  <button
                                    onClick={() => setShowWhyId(showWhyId === item.id ? null : item.id)}
                                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200 px-1.5 py-0.5 rounded-md"
                                  >
                                    Why?
                                  </button>
                                )}
                                {hotel && !isBooked && (
                                  <button onClick={() => navigateToHotel(hotel.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all">
                                    View →
                                  </button>
                                )}
                                {activity && !isBooked && (
                                  <button onClick={() => navigateToExperience(activity.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all">
                                    View →
                                  </button>
                                )}
                                {/* Book buttons */}
                                {!isBooked && item.type === 'flight' && item.entityId && (
                                  <button
                                    onClick={() => startBookingFlow({ type: 'flight', itemId: item.entityId!, source: savedJourneyId ? 'journey' : 'ai-planner', journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  >
                                    Book Flight
                                  </button>
                                )}
                                {!isBooked && item.type === 'hotel' && item.entityId && (
                                  <button
                                    onClick={() => navigateToHotel(item.entityId!, { journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  >
                                    Book Hotel
                                  </button>
                                )}
                                {!isBooked && item.type === 'activity' && item.entityId && (
                                  <button
                                    onClick={() => navigateToExperience(item.entityId!, { journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-violet-600 text-white text-[10px] font-semibold rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap"
                                  >
                                    Book
                                  </button>
                                )}
                                {!isBooked && !['flight', 'hotel', 'activity', 'experience'].includes(item.type) && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 rounded-md">Keep</span>
                                )}
                                {/* Remove button */}
                                <button
                                  onClick={() => setRemovedItems((prev) => { const n = new Set(prev); n.add(item.id); return n; })}
                                  title="Remove from itinerary"
                                  className="w-6 h-6 rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-sm transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {/* hidden until backed by real data */}
                        {showUnsupported && visibleItems.some((it) => it.id === showWhyId) && (() => {
                          const item = visibleItems.find((it) => it.id === showWhyId)!;
                          return (
                            <div className="px-5 py-3 mx-3 mb-3 bg-blue-50 border border-blue-100 rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[8px] font-bold">J</span>
                                </div>
                                <span className="text-xs font-bold text-blue-800">Journey AI — Why this?</span>
                              </div>
                              <p className="text-sm text-blue-900 leading-relaxed">{item.aiReason}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Itinerary customization strip */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Customize</span>
              <button
                disabled
                title="Editing with AI comes in a later update"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                ⇅ Reorder days
              </button>
              <button
                disabled
                title="Editing with AI comes in a later update"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                + Add a day
              </button>
              <button
                disabled
                title="Editing with AI comes in a later update"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                − Remove a day
              </button>
              <button
                disabled
                title="Editing with AI comes in a later update"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg opacity-50 cursor-not-allowed"
              >
                ⚡ Optimize route
              </button>
            </div>
          </div>

          {/* hidden until backed by real data */}
          {showUnsupported && uniqueHotels.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Selected Hotels</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {uniqueHotels.map((item) => {
                  const hotel = hotels.find((h) => h.id === item.entityId);
                  if (!hotel) return null;
                  return (
                    <div key={item.entityId} className="group border border-slate-100 rounded-xl overflow-hidden hover:border-blue-200 transition-colors">
                      <div className="h-32 bg-slate-100 overflow-hidden relative">
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3">
                          <p className="text-white text-sm font-semibold leading-tight">{hotel.name}</p>
                          <p className="text-white/70 text-xs">{hotel.location}</p>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: hotel.stars }).map((_, i) => <span key={i} className="text-amber-400 text-[10px]">★</span>)}
                            <span className="text-xs font-semibold text-slate-700 ml-1">{hotel.rating}</span>
                          </div>
                          <span className="text-xs text-slate-600 font-semibold">₹{hotel.pricePerNight.toLocaleString()}/night</span>
                        </div>
                        {item.aiReason && (
                          <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{item.aiReason}</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => navigateToHotel(hotel.id)} className="flex-1 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              const itinItem = savedJourneyId && journey
                                ? journey.days.flatMap((d) => d.items).find((it) => it.entityId === hotel.id && it.entityType === 'hotel')
                                : undefined;
                              startBookingFlow({
                                type: 'hotel',
                                itemId: hotel.id,
                                source: savedJourneyId ? 'journey' : 'ai-planner',
                                journeyId: savedJourneyId ?? undefined,
                                itineraryItemId: itinItem?.id,
                              });
                            }}
                            className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* hidden until backed by real data */}
          {showUnsupported && uniqueExps.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Included Experiences</h2>
              <div className="space-y-3">
                {uniqueExps.map((item) => {
                  const act = activities.find((a) => a.id === item.entityId);
                  if (!act) return null;
                  return (
                    <div key={item.entityId} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:border-blue-100 transition-colors group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                        <img src={act.imageUrl} alt={act.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{act.name}</p>
                        <p className="text-xs text-slate-500">{act.category} · {act.duration}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-xs font-medium text-slate-700">{act.rating}</span>
                          <span className="text-xs text-slate-400">({act.reviewCount.toLocaleString()})</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-sm font-bold text-slate-800">₹{act.price.toLocaleString()}/person</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => navigateToExperience(act.id)} className="px-2.5 py-1 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                            Details
                          </button>
                          <button
                            onClick={() => {
                              const itinItem = savedJourneyId && journey
                                ? journey.days.flatMap((d) => d.items).find((it) => it.entityId === act.id && it.entityType === 'activity')
                                : undefined;
                              startBookingFlow({
                                type: 'activity',
                                itemId: act.id,
                                source: savedJourneyId ? 'journey' : 'ai-planner',
                                journeyId: savedJourneyId ?? undefined,
                                itineraryItemId: itinItem?.id,
                              });
                            }}
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          {/* Budget overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Budget Overview</h3>
            {/* hidden until backed by real data */}
            {showUnsupported && (
              <div className="space-y-3">
                {[
                  { label: 'Flights', value: journey.budget.flights, color: 'bg-sky-500' },
                  { label: 'Hotels', value: journey.budget.hotels, color: 'bg-blue-500' },
                  { label: 'Transport', value: journey.budget.transport, color: 'bg-slate-400' },
                  { label: 'Experiences', value: journey.budget.experiences, color: 'bg-violet-500' },
                  { label: 'Food', value: journey.budget.food, color: 'bg-amber-500' },
                  { label: 'Buffer', value: journey.budget.buffer, color: 'bg-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                    <span className="text-xs text-slate-500 flex-1">{label}</span>
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((value / journey.budget.total) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-16 text-right">₹{(value / 1000).toFixed(0)}k</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total estimated</span>
                <span className="font-bold text-slate-900">₹{journey.budget.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Your budget</span>
                <span className="font-semibold text-slate-700">₹{journey.dna.budget.toLocaleString()}</span>
              </div>
              {Number(journey.dna.budget) - journey.budget.total > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 font-medium">Remaining</span>
                  <span className="font-bold text-emerald-600">₹{(Number(journey.dna.budget) - journey.budget.total).toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 font-medium">Over budget</span>
                  <span className="font-bold text-amber-600">₹{(journey.budget.total - Number(journey.dna.budget)).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-bold">J</span>
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Change my journey</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Make it cheaper', control: 'cheaper', icon: '↓' },
                { label: 'More luxurious', control: 'luxurious', icon: '✦' },
                { label: 'Slow pace down', control: 'slowpace', icon: '◌' },
                { label: 'Add more food', control: 'morefood', icon: '🍜' },
                { label: 'Add more culture', control: 'moreculture', icon: '🏛' },
                { label: 'Add 2 days', control: 'add2days', icon: '+2' },
                { label: 'Reduce transit', control: 'reducetransit', icon: '⇢' },
                { label: 'Surprise me', control: 'morefood', icon: '✨' },
              ].map(({ label, control, icon }) => (
                <button
                  key={control + label}
                  disabled
                  title="Editing with AI comes in a later update"
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 border border-slate-100 text-slate-400 text-xs font-medium rounded-lg opacity-50 cursor-not-allowed text-left"
                >
                  <span className="text-sm leading-none flex-shrink-0">{icon}</span>
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* hidden until backed by real data */}
          {showUnsupported && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">What if?</h3>
              <div className="space-y-2 mb-3">
                {[
                  { label: 'I reduce my budget?', scenario: 'reduceBudget' },
                  { label: 'I add 2 more days?', scenario: 'add2days' },
                  { label: 'I want more luxury?', scenario: 'luxury' },
                ].map(({ label, scenario }) => (
                  <button
                    key={scenario}
                    onClick={() => { setComparisonScenario(scenario); setShowComparison(true); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${comparisonScenario === scenario && showComparison ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                  >
                    "{label}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Journey DNA summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Journey DNA</p>
            <div className="space-y-1.5 text-xs">
              {[
                ['Route', journey.route.join(' → ')],
                ['Duration', `${journey.dna.nights} nights`],
                ['Travelers', `${journey.dna.travelers}`],
                ['Pace', journey.dna.pace],
                ['Comfort', journey.dna.comfort],
                ['Interests', journey.dna.interests.join(', ') || 'Not specified'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-medium text-slate-700 text-right capitalize">{value}</span>
                </div>
              ))}
              {journey.dna.mustHave && (
                <div className="pt-2 mt-1 border-t border-slate-200">
                  <p className="text-slate-400">Must have</p>
                  <p className="text-slate-700 font-medium mt-0.5">{journey.dna.mustHave}</p>
                </div>
              )}
            </div>
          </div>

          {savedJourneyId && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#059669" strokeWidth="2"><path d="M2 7l3.5 3.5L12 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Journey saved</p>
                <p className="text-xs text-emerald-700">Find it in My Trips to manage and book.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── DNA Form ─────────────────────────────────────────────────────────────────

function DNAForm({ dna, setDna, onBuild, toggleInterest }: {
  dna: JourneyDNA;
  setDna: React.Dispatch<React.SetStateAction<JourneyDNA>>;
  onBuild: () => void;
  toggleInterest: (i: string) => void;
}) {
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const { ok, errors } = validateDna(dna, today);

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display text-2xl text-slate-900">Journey AI</h1>
          <p className="text-slate-500 text-sm">Build your journey, not just an itinerary.</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Destination + Origin */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Where & When</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Destination
              </label>
              <input
                value={dna.destination}
                onChange={(e) =>
                  // When user edits the destination text, set destination AND reset destinationId to ''.
                  // This prevents the stale-destination bug where destinationId remained stuck (e.g. 'tokyo')
                  // from a prior prefill or default, causing every destination to select the wrong template.
                  setDna((p) => ({
                    ...p,
                    destination: e.target.value,
                    destinationId: '',
                  }))
                }
                placeholder="Where do you want to go?"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none transition-colors ${
                  errors.destination
                    ? 'border-red-300 focus:border-red-500 bg-red-50/20'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              />
              {errors.destination && (
                <p className="text-xs text-red-500 mt-1">{errors.destination}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Flying from
              </label>
              <input
                value={dna.origin}
                onChange={(e) => setDna((p) => ({ ...p, origin: e.target.value }))}
                placeholder="City you're flying from"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Start date
              </label>
              <input
                type="date"
                min={todayStr}
                value={dna.startDate}
                onChange={(e) => setDna((p) => ({ ...p, startDate: e.target.value }))}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none transition-colors ${
                  errors.startDate
                    ? 'border-red-300 focus:border-red-500 bg-red-50/20'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              />
              {errors.startDate && (
                <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Nights
              </label>
              <select
                value={dna.nights}
                onChange={(e) => setDna((p) => ({ ...p, nights: Number(e.target.value) }))}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none transition-colors bg-white ${
                  errors.nights
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'night' : 'nights'}</option>
                ))}
              </select>
              {errors.nights && (
                <p className="text-xs text-red-500 mt-1">{errors.nights}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Travelers
              </label>
              <select
                value={dna.travelers}
                onChange={(e) => setDna((p) => ({ ...p, travelers: Number(e.target.value) }))}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none transition-colors bg-white ${
                  errors.travelers
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'traveler' : 'travelers'}</option>
                ))}
              </select>
              {errors.travelers && (
                <p className="text-xs text-red-500 mt-1">{errors.travelers}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Total budget (₹)
              </label>
              <input
                type="number"
                value={dna.budget}
                onChange={(e) =>
                  setDna((p) => ({
                    ...p,
                    budget: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                placeholder="Optional, in ₹"
                step={10000}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none transition-colors ${
                  errors.budget
                    ? 'border-red-300 focus:border-red-500 bg-red-50/20'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
              />
              {errors.budget && (
                <p className="text-xs text-red-500 mt-1">{errors.budget}</p>
              )}
            </div>
          </div>
        </div>

        {/* Style & Comfort */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Travel Style</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pace</label>
              <div className="flex gap-2">
                {(['relaxed', 'balanced', 'packed'] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setDna((prev) => ({ ...prev, pace: p }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize border transition-all ${dna.pace === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Comfort level</label>
              <div className="flex gap-2">
                {(['smart', 'comfortable', 'premium', 'luxury'] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setDna((prev) => ({ ...prev, comfort: c }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize border transition-all ${dna.comfort === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Interests</label>
              <span className="text-xs text-slate-400 font-normal">Pick a few (optional)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  type="button"
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${dna.interests.includes(interest) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Your Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Must-have experiences</label>
              <input
                value={dna.mustHave}
                onChange={(e) => setDna((p) => ({ ...p, mustHave: e.target.value }))}
                placeholder="e.g. a sunrise viewpoint, local street food"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Things to avoid</label>
              <input
                value={dna.avoid}
                onChange={(e) => setDna((p) => ({ ...p, avoid: e.target.value }))}
                placeholder="e.g. early mornings, crowded tourist sites"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Anything else? (free form)</label>
              <textarea
                value={dna.notes}
                onChange={(e) => setDna((p) => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Celebrating an anniversary, prefer walking tours, need vegetarian options"
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none resize-none transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onBuild}
          disabled={!ok}
          className={`w-full py-4 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 text-base ${
            ok
              ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/20 cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/>
          </svg>
          Build my journey
        </button>
      </div>
    </div>
  );
}

// ─── Building screen ──────────────────────────────────────────────────────────

function BuildingScreen({
  msgIdx,
  destination,
  error,
  onTryAgain,
}: {
  msgIdx: number;
  destination: string;
  error?: string | null;
  onTryAgain?: () => void;
}) {
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 max-w-md mx-auto px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-2xl text-slate-900 mb-2">Failed to Generate Journey</h2>
          <p className="text-sm text-slate-600 leading-relaxed bg-red-50/50 border border-red-100 rounded-xl p-3 mb-4">
            {error}
          </p>
        </div>
        <button
          onClick={onTryAgain}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4l2.5 6L25 12l-6 2.5L16 21l-2.5-6.5L7 12l6.5-2.5L16 4z" fill="white"/>
          </svg>
        </div>
        <div className="absolute -inset-2 rounded-xl border-2 border-blue-400/30 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      <div className="text-center max-w-md">
        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Journey AI</p>
        <h2 className="font-display text-2xl text-slate-900 mb-2">Building your {destination.split(',')[0]} journey</h2>
        <p className="text-blue-600 text-sm font-medium min-h-[1.5em] transition-all">{BUILD_MSGS[msgIdx]}</p>
      </div>
      <div className="flex flex-col gap-2 w-64">
        {BUILD_MSGS.slice(0, 5).map((msg, i) => (
          <div key={msg} className={`flex items-center gap-2 transition-all duration-500 ${i <= msgIdx ? 'opacity-100' : 'opacity-20'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${i < msgIdx ? 'bg-emerald-500' : i === msgIdx ? 'bg-blue-600 animate-pulse' : 'bg-slate-200'}`}>
              {i < msgIdx && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5"><path d="M1.5 4l2 2 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
            <span className="text-xs text-slate-600">{msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
