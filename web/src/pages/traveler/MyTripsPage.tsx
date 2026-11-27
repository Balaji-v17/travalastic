import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import type { Journey } from '../../data/mockData';
import TripChatPanel from '../../components/chat/TripChatPanel';
import TripCoverVisual from '../../components/trips/TripCoverVisual';
import DuplicateReviewModal from '../../components/trips/DuplicateReviewModal';
import PermanentDeleteConfirmModal from '../../components/trips/PermanentDeleteConfirmModal';
import { apiFetch } from '../../lib/api';
import { fetchTripCover } from '../../lib/itineraryApi';
import { backfillMissingTripCovers } from '../../lib/tripCoverBackfill';
import { getBookablePlanItems } from '../../lib/tripStatus';
import { limitConcurrency } from '../../lib/stylePicks';
import {
  deleteTripsSequentially,
  groupDuplicateTrips,
  readDuplicateNoticeDismissed,
  writeDuplicateNoticeDismissed,
  type DuplicateTripGroup,
  type SequentialDeleteOutcome,
  type TripExtrasCount,
} from '../../lib/duplicateTrips';

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  discovering: { label: 'Planning', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  planning: { label: 'Planning', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  upcoming: { label: 'Upcoming', color: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  booked: { label: 'Booked', color: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  'pre-travel': { label: 'Pre-Travel', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'in-travel': { label: 'In Progress', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'in-progress': { label: 'In Progress', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', color: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' },
  'post-travel': { label: 'Completed', color: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' },
  past: { label: 'Past', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
};

const upcomingStatuses = new Set(['upcoming', 'booked', 'pre-travel']);
const planningStatuses = new Set(['planning', 'discovering']);
const completedStatuses = new Set(['completed', 'post-travel']);
const inProgressStatuses = new Set(['in-progress', 'in-travel']);
const pastStatuses = new Set(['past']);

type FilterTab = 'all' | 'planning' | 'upcoming' | 'in-progress' | 'completed' | 'past';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBookingProgress(journey: Journey) {
  const all = journey.itinerary.flatMap((d) => d.activities);
  const booked = all.filter((a) => a.status === 'booked');
  return { booked: booked.length, total: all.length };
}

function getBudget(journey: Journey) {
  const total = journey.totalBudget;
  return { spent: journey.totalSpend, total };
}

function fmtDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—';
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return date;
}

function fmtAmount(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
}

// ─── Featured Journey card ────────────────────────────────────────────────────

function FeaturedJourney({ journey, onAskAI }: { journey: Journey; onAskAI: () => void }) {
  const { navigate } = useApp();
  const { booked, total } = getBookingProgress(journey);
  const { spent, total: budget } = getBudget(journey);
  const hasBudget = typeof budget === 'number' && budget > 0;
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  const budgetPct = hasBudget && budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const isActive = journey.status === 'in-progress' || journey.status === 'in-travel';

  return (
    <div className="relative rounded-xl overflow-hidden mb-8 min-h-[340px] sm:min-h-[400px] flex flex-col justify-end group bg-slate-900">
      <TripCoverVisual
        journey={journey}
        width={1200}
        height={675}
        imgClassName="transition-transform duration-700 group-hover:scale-105"
        creditPosition="top-right"
      />

      {/* Status pill */}
      <div className="absolute top-5 left-5 flex items-center gap-1.5 z-10">
        {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${statusConfig[journey.status]?.color ?? 'bg-white/20 text-white'}`}>
          {statusConfig[journey.status]?.label}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">
        <p className="text-white/80 text-xs uppercase tracking-widest mb-2 font-medium">
          {isActive ? 'Currently Travelling' : 'Featured Journey'}
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight mb-1">{journey.title || journey.destination || '—'}</h2>
        <p className="text-white/95 text-sm mb-5">
          {journey.destination} &middot; {fmtDate(journey.startDate, { day: 'numeric', month: 'short' })} – {fmtDate(journey.endDate)} &middot; {journey.travelers} traveler{journey.travelers > 1 ? 's' : ''}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Booking progress */}
          <div className="flex-1 min-w-[140px]">
            <p className="text-white/50 text-[11px] uppercase tracking-wide mb-1.5">Booking progress</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-white text-xs font-semibold shrink-0">{booked}/{total}</span>
            </div>
          </div>

          {/* Budget */}
          <div className="flex-1 min-w-[140px]">
            <p className="text-white/50 text-[11px] uppercase tracking-wide mb-1.5">Budget</p>
            {hasBudget && budget ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${budgetPct > 85 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${budgetPct}%` }} />
                </div>
                <span className="text-white text-xs font-semibold shrink-0">{fmtAmount(spent)} / {fmtAmount(budget)}</span>
              </div>
            ) : (
              <span className="text-white text-xs font-semibold shrink-0">No budget set</span>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate('journey', { selectedJourneyId: journey.id })}
            className="px-5 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Open Journey →
          </button>
          <button
            onClick={onAskAI}
            className="px-5 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/></svg>
            Ask Journey AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upcoming Timeline ────────────────────────────────────────────────────────

function UpcomingTimeline({ journey }: { journey: Journey }) {
  const days = journey.itinerary.slice(0, 5);
  if (days.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8">
      <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide">Upcoming Timeline</h3>
      <div className="space-y-3">
        {days.map((day, idx) => {
          const bookedActs = day.activities.filter((a) => a.status === 'booked');
          return (
            <div key={idx} className="flex gap-4">
              {/* Day indicator */}
              <div className="flex flex-col items-center shrink-0 w-10">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                {idx < days.length - 1 && <div className="flex-1 w-px bg-slate-200 mt-1" />}
              </div>
              <div className="pb-3 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-slate-700">{day.title}</p>
                  <span className="text-[10px] text-slate-400">{fmtDate(day.date ?? journey.startDate, { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {day.activities.slice(0, 4).map((act, ai) => (
                    <span key={ai} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${act.status === 'booked' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {act.status === 'booked' ? '✓' : '·'} {act.title}
                    </span>
                  ))}
                  {day.activities.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] text-slate-400 bg-slate-100">+{day.activities.length - 4}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{bookedActs.length}/{day.activities.length} confirmed</p>
              </div>
            </div>
          );
        })}
      </div>
      {journey.itinerary.length > 5 && (
        <p className="text-xs text-slate-400 mt-2 pl-14">+{journey.itinerary.length - 5} more days in itinerary</p>
      )}
    </div>
  );
}

// ─── Continue Planning section ────────────────────────────────────────────────


function ContinuePlanning({ journey, onNavigate }: { journey: Journey; onNavigate: () => void }) {
  const bookableItems = getBookablePlanItems(journey).slice(0, 3);
  if (bookableItems.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Continue planning</h3>
          <p className="text-xs text-slate-500 mt-0.5">{journey.destination} — items waiting to be booked</p>
        </div>
        <button onClick={onNavigate} className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Continue →
        </button>
      </div>
      <div className="space-y-2">
        {bookableItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-white rounded-xl border border-slate-100">
            <span className="text-base w-6 text-center">{item.icon}</span>
            <span className="text-sm text-slate-700 flex-1">{item.title}</span>
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Not booked</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Journey card ─────────────────────────────────────────────────────────────

function JourneyCard({ journey, onAskAI }: { journey: Journey; onAskAI: () => void }) {
  const { navigate } = useApp();
  const cfg = statusConfig[journey.status] ?? statusConfig['planning'];
  const { booked, total } = getBookingProgress(journey);
  const { spent, total: budget } = getBudget(journey);
  const hasBudget = typeof budget === 'number' && budget > 0;
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  const isTravelling = journey.status === 'in-progress' || journey.status === 'in-travel';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover:-translate-y-0.5 group flex flex-col">
      {/* Image */}
      <div className="relative h-44 bg-slate-900 overflow-hidden shrink-0">
        <TripCoverVisual
          journey={journey}
          width={800}
          height={448}
          imgClassName="transition-transform duration-700 group-hover:scale-110"
          creditPosition="top-right"
        />
        <div className="absolute top-3 left-3 z-10">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isTravelling ? 'animate-pulse' : ''}`} />
            {cfg.label}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <p className="text-white/95 text-xs font-medium">{fmtDate(journey.startDate, { day: 'numeric', month: 'short' })} – {fmtDate(journey.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">{journey.title || journey.destination || '—'}</h3>
        <p className="text-slate-500 text-xs mt-0.5">{journey.destination} &middot; {journey.travelers} traveler{journey.travelers > 1 ? 's' : ''}</p>

        {/* Booking progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">Booked</span>
            <span className="text-[11px] font-semibold text-slate-600">{booked}/{total} items</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Budget */}
        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">{fmtAmount(spent)}</p>
            <p className="text-[11px] text-slate-400">
              {hasBudget && budget ? `of ${fmtAmount(budget)} budget` : 'No budget set'}
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-auto pt-4 flex gap-2">
          <button
            onClick={() => navigate('journey', { selectedJourneyId: journey.id })}
            className="flex-1 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Open Trip
          </button>
          <button
            onClick={() => navigate('my-bookings')}
            className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Bookings
          </button>
          <button
            onClick={onAskAI}
            className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/></svg>
            AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter, onPlan, onExplore }: { filter: FilterTab; onPlan: () => void; onExplore: () => void }) {
  const messages: Record<FilterTab, [string, string]> = {
    all: ["No trips yet", "Start by exploring destinations or letting AI plan your next adventure."],
    upcoming: ["No upcoming trips.", "Book a journey to see it here."],
    planning: ["Nothing in planning.", "Start planning your next escape."],
    'in-progress': ["No active journeys.", "When you start travelling, your journey appears here."],
    completed: ["No completed trips yet.", "Complete a journey to build your travel history."],
    past: ["No past trips.", "Trips whose dates passed without bookings will appear here."],
  };
  const [title, sub] = messages[filter] || messages.all;
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-slate-400">
          <path d="M14 3l2 5.5L21.5 10l-5.5 2L14 17.5l-2-5.5L6.5 10l5.5-2L14 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M22 19l1.5 3.5L27 24l-3.5 1.5L22 29l-1.5-3.5L17 24l3.5-1.5L22 19z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className="font-display text-xl text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">{sub}</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onExplore} className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
          Explore destinations
        </button>
        <button onClick={onPlan} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/></svg>
          Build with Journey AI
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyTripsPage() {
  const { journeys, journeysStatus, refreshJourneys, updateJourneyCover, navigate } = useApp();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [aiJourney, setAiJourney] = useState<Journey | null>(null);
  const attemptedCoverIdsRef = useRef<Set<string>>(new Set());

  // Duplicates review & safe deletion state (dismissal stored in sessionStorage only)
  const [dismissDuplicatesNotice, setDismissDuplicatesNotice] = useState<boolean>(() =>
    typeof window !== 'undefined' ? readDuplicateNoticeDismissed(window.sessionStorage) : false
  );
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [expensesByTripId, setExpensesByTripId] = useState<Record<string, TripExtrasCount | undefined>>({});
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    mode: 'duplicates' | 'past';
    title: string;
    subtitle: string;
    keepTrips: Journey[];
    deleteTrips: Journey[];
    confirmButtonLabel?: string;
  } | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [deleteOutcome, setDeleteOutcome] = useState<SequentialDeleteOutcome | null>(null);

  // Compute status counts using pure tripStatus
  const upcomingCount = journeys.filter((j) => upcomingStatuses.has(j.status)).length;
  const planningCount = journeys.filter((j) => planningStatuses.has(j.status)).length;
  const completedCount = journeys.filter((j) => completedStatuses.has(j.status)).length;
  const inProgressCount = journeys.filter((j) => inProgressStatuses.has(j.status)).length;
  const pastJourneys = journeys.filter((j) => pastStatuses.has(j.status));
  const pastCount = pastJourneys.length;

  // Detect exact duplicate & overlapping-date similar trip groups (pure helper)
  const duplicateGrouping = useMemo(
    () => groupDuplicateTrips(journeys, expensesByTripId),
    [journeys, expensesByTripId]
  );

  // Featured journey: first active (in-progress), then upcoming
  const featuredJourney =
    journeys.find((j) => inProgressStatuses.has(j.status)) ??
    journeys.find((j) => upcomingStatuses.has(j.status)) ??
    null;

  // Planning journey
  const planningJourney =
    journeys.find((j) => planningStatuses.has(j.status)) ??
    null;

  // Filter tabs: Show "Past" tab ONLY when pastCount > 0
  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: journeys.length },
    { key: 'planning', label: 'Planning', count: planningCount },
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { key: 'in-progress', label: 'In Progress', count: inProgressCount },
    { key: 'completed', label: 'Completed', count: completedCount },
    ...(pastCount > 0 ? [{ key: 'past' as FilterTab, label: 'Past', count: pastCount }] : []),
  ];

  const filtered = journeys.filter((j) => {
    if (filter === 'upcoming') return upcomingStatuses.has(j.status);
    if (filter === 'planning') return planningStatuses.has(j.status);
    if (filter === 'in-progress') return inProgressStatuses.has(j.status);
    if (filter === 'completed') return completedStatuses.has(j.status);
    if (filter === 'past') return pastStatuses.has(j.status);
    return true;
  });

  useEffect(() => {
    if (journeysStatus !== 'ready') return;
    const visibleMap = new Map<string, Journey>();
    if (featuredJourney) visibleMap.set(featuredJourney.id, featuredJourney);
    if (planningJourney) visibleMap.set(planningJourney.id, planningJourney);
    for (const j of filtered) visibleMap.set(j.id, j);

    let cancelled = false;
    backfillMissingTripCovers({
      journeys: Array.from(visibleMap.values()),
      attemptedIds: attemptedCoverIdsRef.current,
      fetchCover: fetchTripCover,
      onCoverResolved: (tripId, coverImage) => updateJourneyCover(tripId, coverImage),
      concurrency: 3,
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [journeysStatus, filtered, featuredJourney, planningJourney, updateJourneyCover]);

  const loadExpensesForTrips = useCallback(
    async (trips: Journey[]) => {
      const missingIds = Array.from(new Set(trips.map((t) => t.id))).filter(
        (id) => !(id in expensesByTripId)
      );
      if (missingIds.length === 0) return;

      setLoadingExtras(true);
      try {
        const updates: Record<string, TripExtrasCount> = {};
        await limitConcurrency(
          missingIds.map((id) => async () => {
            try {
              const res = await apiFetch<{ expenses?: unknown[] }>(
                `/itinerary/${encodeURIComponent(id)}/expenses`
              );
              updates[id] = {
                expensesCount: Array.isArray(res?.expenses) ? res.expenses.length : 0,
              };
            } catch {
              updates[id] = { expensesCount: null };
            }
          }),
          3
        );
        setExpensesByTripId((prev) => ({ ...prev, ...updates }));
      } finally {
        setLoadingExtras(false);
      }
    },
    [expensesByTripId]
  );

  const handleDismissNotice = () => {
    setDismissDuplicatesNotice(true);
    if (typeof window !== 'undefined') {
      writeDuplicateNoticeDismissed(window.sessionStorage, true);
    }
  };

  const handleOpenReviewModal = () => {
    setDeleteOutcome(null);
    setReviewModalOpen(true);
    const groupTrips = [
      ...duplicateGrouping.exactGroups.flatMap((g) => g.trips),
      ...duplicateGrouping.similarGroups.flatMap((g) => g.trips),
    ];
    void loadExpensesForTrips(groupTrips);
  };

  const handleOpenClearPastModal = () => {
    setDeleteOutcome(null);
    setDeleteConfirmState({
      mode: 'past',
      title: 'Clear past trips without bookings',
      subtitle: `Review the ${pastJourneys.length} past trip${pastJourneys.length > 1 ? 's' : ''} below before permanently deleting them.`,
      keepTrips: [],
      deleteTrips: pastJourneys,
      confirmButtonLabel: `Clear ${pastJourneys.length} trip${pastJourneys.length > 1 ? 's' : ''}`,
    });
    void loadExpensesForTrips(pastJourneys);
  };

  const handleRequestDeleteGroup = ({
    group,
    keepTrips,
    deleteTrips,
  }: {
    group: DuplicateTripGroup;
    keepTrips: Journey[];
    deleteTrips: Journey[];
  }) => {
    setDeleteOutcome(null);
    setDeleteConfirmState({
      mode: 'duplicates',
      title: 'Delete selected duplicate trips',
      subtitle: `${group.destination} (${group.startDate} – ${group.endDate}) — keeping ${keepTrips.length} and removing ${deleteTrips.length}.`,
      keepTrips,
      deleteTrips,
      confirmButtonLabel: `Delete ${deleteTrips.length} trip${deleteTrips.length > 1 ? 's' : ''}`,
    });
    void loadExpensesForTrips(deleteTrips);
  };

  const handleConfirmDeleteBatch = async () => {
    if (!deleteConfirmState || deleteConfirmState.deleteTrips.length === 0) return;
    setIsDeletingBatch(true);
    try {
      const outcome = await deleteTripsSequentially(deleteConfirmState.deleteTrips, async (id) => {
        await apiFetch(`/itineraries/${encodeURIComponent(id)}`, { method: 'DELETE' });
      });
      setDeleteOutcome(outcome);
      await refreshJourneys();

      if (outcome.failedItems.length === 0) {
        if (deleteConfirmState.mode === 'past') {
          setFilter('all');
        }
        setDeleteConfirmState(null);
      } else {
        const failedIds = new Set(outcome.failedItems.map((f) => f.id));
        const remainingFailed = deleteConfirmState.deleteTrips.filter((t) => failedIds.has(t.id));
        setDeleteConfirmState((prev) =>
          prev ? { ...prev, deleteTrips: remainingFailed } : null
        );
      }
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900 leading-tight">My Trips</h1>
          <p className="text-slate-500 text-sm mt-1">Everything you are planning, booking and experiencing.</p>
        </div>
        <button
          onClick={() => navigate('ai-planner')}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg width="12" height="12" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/></svg>
          Plan New Trip
        </button>
      </div>

      {journeysStatus === 'loading' ? (
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Loading your trips…</p>
        </div>
      ) : journeysStatus === 'error' ? (
        <div className="py-16 px-6 bg-red-50/50 border border-red-100 rounded-2xl text-center my-8 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Failed to load trips</h2>
          <p className="text-slate-500 text-sm mb-6">We couldn't retrieve your saved journeys. Please check your connection and try again.</p>
          <button
            onClick={() => refreshJourneys()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : journeys.length === 0 ? (
        <EmptyState filter="all" onPlan={() => navigate('ai-planner')} onExplore={() => navigate('explore')} />
      ) : (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Upcoming', value: upcomingCount, sub: 'confirmed bookings', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
              { label: 'Planning', value: planningCount, sub: 'future trips without bookings', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
              { label: 'Completed', value: completedCount, sub: 'finished journeys', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-xl p-4`}>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{stat.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Dismissible duplicate & similar trips review banner (session-only dismissal) */}
          {duplicateGrouping.totalSets > 0 && !dismissDuplicatesNotice && (
            <div
              data-testid="duplicates-review-banner"
              className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 mb-8 shadow-sm flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-950">
                    You have {duplicateGrouping.totalSets} set{duplicateGrouping.totalSets > 1 ? 's' : ''} of similar trips. Review them.
                  </p>
                  <p className="text-xs text-blue-800 mt-0.5">
                    {duplicateGrouping.exactGroups.length > 0 &&
                      `${duplicateGrouping.exactGroups.length} exact duplicate group${duplicateGrouping.exactGroups.length > 1 ? 's' : ''}`}
                    {duplicateGrouping.exactGroups.length > 0 &&
                      duplicateGrouping.similarGroups.length > 0 &&
                      ' · '}
                    {duplicateGrouping.similarGroups.length > 0 &&
                      `${duplicateGrouping.similarGroups.length} overlapping-date similar group${duplicateGrouping.similarGroups.length > 1 ? 's' : ''}`}
                    {' — compare trips side by side before deleting anything.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleOpenReviewModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shadow-sm"
                >
                  Review duplicates
                </button>
                <button
                  type="button"
                  onClick={handleDismissNotice}
                  className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1.5 rounded-lg"
                  aria-label="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Featured / active journey */}
          {featuredJourney && (
            <FeaturedJourney journey={featuredJourney} onAskAI={() => setAiJourney(featuredJourney)} />
          )}

          {/* Upcoming timeline */}
          {featuredJourney && <UpcomingTimeline journey={featuredJourney} />}

          {/* Continue planning */}
          {planningJourney && (
            <ContinuePlanning
              journey={planningJourney}
              onNavigate={() => navigate('journey', { selectedJourneyId: planningJourney.id })}
            />
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit overflow-x-auto">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1.5 text-xs opacity-60">({t.count})</span>}
              </button>
            ))}
          </div>

          {/* Past tab note & clear button */}
          {filter === 'past' && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-amber-900">Trips whose dates passed without a booking.</p>
                <p className="text-xs text-amber-700 mt-0.5">These trips were planned but dates have now elapsed with no confirmed bookings.</p>
              </div>
              <button
                type="button"
                onClick={handleOpenClearPastModal}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                Clear past trips without bookings
              </button>
            </div>
          )}

          {/* Journey grid or empty state */}
          {filtered.length === 0 ? (
            <EmptyState filter={filter} onPlan={() => navigate('ai-planner')} onExplore={() => navigate('explore')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} onAskAI={() => setAiJourney(journey)} />
              ))}

              {/* Add trip slot */}
              <button
                onClick={() => navigate('ai-planner')}
                className="text-left border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-blue-300 hover:bg-blue-50/50 transition-all group flex flex-col items-center justify-center gap-3 min-h-[280px]"
              >
                <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400 group-hover:text-blue-600 transition-colors">
                    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-blue-700 transition-colors">Plan a new trip</p>
                  <p className="text-xs text-slate-400 mt-0.5">AI creates your itinerary in seconds</p>
                </div>
              </button>
            </div>
          )}
        </>
      )}

      {/* Review Duplicates & Similar Trips Panel */}
      <DuplicateReviewModal
        open={reviewModalOpen}
        exactGroups={duplicateGrouping.exactGroups}
        similarGroups={duplicateGrouping.similarGroups}
        extrasByTripId={expensesByTripId}
        loadingExtras={loadingExtras}
        lastOutcome={!deleteConfirmState ? deleteOutcome : null}
        onRequestDeleteGroup={handleRequestDeleteGroup}
        onClose={() => {
          setReviewModalOpen(false);
          setDeleteOutcome(null);
        }}
      />

      {/* Shared Permanent Deletion Confirmation Dialog (Duplicates & Clear Past) */}
      <PermanentDeleteConfirmModal
        open={Boolean(deleteConfirmState)}
        title={deleteConfirmState?.title || ''}
        subtitle={deleteConfirmState?.subtitle || ''}
        keepTrips={deleteConfirmState?.keepTrips || []}
        deleteTrips={deleteConfirmState?.deleteTrips || []}
        extrasByTripId={expensesByTripId}
        loadingExtras={loadingExtras}
        isDeleting={isDeletingBatch}
        outcome={deleteOutcome}
        confirmButtonLabel={deleteConfirmState?.confirmButtonLabel}
        onCancel={() => {
          setDeleteConfirmState(null);
          setDeleteOutcome(null);
        }}
        onConfirm={handleConfirmDeleteBatch}
      />

      {/* Trip Chat Panel */}
      {aiJourney && <TripChatPanel journey={aiJourney} onClose={() => setAiJourney(null)} />}
    </div>
  );
}
