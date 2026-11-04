import { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import type { Journey } from '../../data/mockData';

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  discovering: { label: 'Discovering', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  planning: { label: 'Planning', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  booked: { label: 'Booked', color: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  'pre-travel': { label: 'Pre-Travel', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'in-travel': { label: 'In Travel', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', color: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' },
  'post-travel': { label: 'Post-Travel', color: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' },
};

const upcomingStatuses = new Set(['booked', 'pre-travel', 'in-travel']);
const planningStatuses = new Set(['planning', 'discovering']);
const completedStatuses = new Set(['completed', 'post-travel']);

type FilterTab = 'all' | 'upcoming' | 'planning' | 'in-progress' | 'completed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBookingProgress(journey: Journey) {
  const all = journey.itinerary.flatMap((d) => d.activities);
  const booked = all.filter((a) => a.status === 'booked');
  return { booked: booked.length, total: all.length };
}

function getBudget(journey: Journey) {
  const total = journey.totalBudget ?? Math.max(journey.totalSpend * 1.5, 350000);
  return { spent: journey.totalSpend, total };
}

function fmtDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
}

// ─── AI response builder ──────────────────────────────────────────────────────

interface AIMessage { role: 'user' | 'ai'; text: string; }

function buildAIResponse(question: string, journey: Journey): string {
  const q = question.toLowerCase();
  const allItems = journey.itinerary.flatMap((d) => d.activities);
  const booked = allItems.filter((a) => a.status === 'booked');
  const unbooked = allItems.filter((a) => a.status !== 'booked');
  const { spent, total } = getBudget(journey);
  const remaining = Math.max(0, total - spent);

  if (q.includes('budget') || q.includes('left') || q.includes('remaining') || q.includes('how much')) {
    return `You have spent ${fmtAmount(spent)} of your ${fmtAmount(total)} budget. Remaining: ${fmtAmount(remaining)}.${remaining > 0 ? " I can suggest experiences that fit within the remaining amount — would you like to see options?" : " Your budget is fully committed."}`;
  }
  if (q.includes("what's booked") || q.includes('confirmed') || q.includes('booked')) {
    if (booked.length === 0) return "Nothing is confirmed yet. Your journey is in planning mode. I can help you start with the flight or hotel — which first?";
    return `${booked.length} item${booked.length > 1 ? 's are' : ' is'} confirmed: ${booked.map((a) => a.title).slice(0, 3).join(', ')}${booked.length > 3 ? ` and ${booked.length - 3} more` : ''}.`;
  }
  if (q.includes('still need') || q.includes("needs booking")) {
    if (unbooked.length === 0) return "Everything in your itinerary is confirmed. Your journey is fully booked!";
    return `${unbooked.length} item${unbooked.length > 1 ? 's' : ''} still need booking: ${unbooked.map((a) => a.title).slice(0, 4).join(', ')}.`;
  }
  if (q.includes("what's next") || q.includes('whats next') || q.includes('next step')) {
    const next = unbooked[0];
    if (!next) return "All items are confirmed! Make sure to check in for your flights 24 hours before departure.";
    return `Your next step is to book: ${next.title}. You have ${unbooked.length} item${unbooked.length > 1 ? 's' : ''} still unconfirmed.`;
  }
  return `I know your ${journey.destination} journey inside out — ${journey.itinerary.length} days, ${journey.travelers} traveler${journey.travelers > 1 ? 's' : ''}, ${journey.status} status. Ask me anything about budget, bookings, or your itinerary.`;
}

// ─── Ask Journey AI panel ─────────────────────────────────────────────────────

function AskJourneyAI({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'ai', text: `Hello! I know your ${journey.destination} journey inside out — ${journey.itinerary.length} days, ${journey.travelers} traveler${journey.travelers > 1 ? 's' : ''}, ${journey.status} status. Ask me anything.` },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const QUICK = ["What's next?", "What's booked?", "How much left?", "What still needs booking?"];

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'ai', text: buildAIResponse(text, journey) }]);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] bg-white rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Ask Journey AI</p>
              <p className="text-xs text-slate-400">{journey.destination} · {journey.itinerary.length} days</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Quick prompts */}
        <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap border-b border-slate-100">
          {QUICK.map((q) => (
            <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-medium rounded-full transition-colors">
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 px-4 py-3 rounded-xl rounded-bl-sm flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ask anything about your journey…"
              className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button onClick={() => sendMessage(input)} disabled={!input.trim()} className="px-4 py-2.5 bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Featured Journey card ────────────────────────────────────────────────────

function FeaturedJourney({ journey, onAskAI }: { journey: Journey; onAskAI: () => void }) {
  const { navigate } = useApp();
  const { booked, total } = getBookingProgress(journey);
  const { spent, total: budget } = getBudget(journey);
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  const budgetPct = Math.min(100, Math.round((spent / budget) * 100));
  const isActive = journey.status === 'in-travel';

  return (
    <div className="relative rounded-xl overflow-hidden mb-8 min-h-[340px] sm:min-h-[400px] flex flex-col justify-end group">
      {/* Background image */}
      <img src={journey.imageUrl} alt={journey.destination} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      {/* Status pill */}
      <div className="absolute top-5 left-5 flex items-center gap-1.5">
        {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${statusConfig[journey.status]?.color ?? 'bg-white/20 text-white'}`}>
          {statusConfig[journey.status]?.label}
        </span>
      </div>

      {/* Content */}
      <div className="relative p-6 sm:p-8">
        <p className="text-white/60 text-xs uppercase tracking-widest mb-2 font-medium">
          {isActive ? 'Currently Travelling' : 'Featured Journey'}
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight mb-1">{journey.title}</h2>
        <p className="text-white/70 text-sm mb-5">
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
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${budgetPct > 85 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${budgetPct}%` }} />
              </div>
              <span className="text-white text-xs font-semibold shrink-0">{fmtAmount(spent)} / {fmtAmount(budget)}</span>
            </div>
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
  const unbooked = journey.itinerary.flatMap((d) => d.activities).filter((a) => a.status !== 'booked').slice(0, 3);
  if (unbooked.length === 0) return null;

  const typeIcon: Record<string, string> = { flight: '✈', hotel: '🏨', activity: '⚡', transport: '🚌', free: '☀', food: '🍜', experience: '🎭' };

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
        {unbooked.map((act, i) => (
          <div key={i} className="flex items-center gap-3 py-2 px-3 bg-white rounded-xl border border-slate-100">
            <span className="text-base w-6 text-center">{typeIcon[act.type] ?? '📌'}</span>
            <span className="text-sm text-slate-700 flex-1">{act.title}</span>
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Unbooked</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Journey card ─────────────────────────────────────────────────────────────

function JourneyCard({ journey, onAskAI }: { journey: Journey; onAskAI: () => void }) {
  const { navigate } = useApp();
  const cfg = statusConfig[journey.status] ?? statusConfig['discovering'];
  const { booked, total } = getBookingProgress(journey);
  const { spent, total: budget } = getBudget(journey);
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover:-translate-y-0.5 group flex flex-col">
      {/* Image */}
      <div className="relative h-44 bg-slate-200 overflow-hidden shrink-0">
        <img src={journey.imageUrl} alt={journey.destination} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${journey.status === 'in-travel' ? 'animate-pulse' : ''}`} />
            {cfg.label}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white/70 text-xs">{fmtDate(journey.startDate, { day: 'numeric', month: 'short' })} – {fmtDate(journey.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">{journey.title}</h3>
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
            <p className="text-[11px] text-slate-400">of {fmtAmount(budget)} budget</p>
          </div>
        </div>

        {/* Next up item */}
        {(() => {
          const nextUnbooked = journey.itinerary.flatMap((d) => d.activities).find((a) => a.status !== 'booked' && ['flight', 'hotel', 'activity'].includes(a.type));
          if (!nextUnbooked) return null;
          const typeIcon: Record<string, string> = { flight: '✈️', hotel: '🏨', activity: '🎫', transfer: '🚗' };
          return (
            <div className="mt-3 flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-sm">{typeIcon[nextUnbooked.type] ?? '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Next up</p>
                <p className="text-xs text-slate-700 truncate">{nextUnbooked.title}</p>
              </div>
            </div>
          );
        })()}

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
    all: ["Your next journey starts here.", "Start by exploring destinations or letting AI plan your next adventure."],
    upcoming: ["No upcoming trips.", "Book a journey to see it here."],
    planning: ["Nothing in planning.", "Start planning your next escape."],
    'in-progress': ["No active journeys.", "When you start travelling, your journey appears here."],
    completed: ["No completed trips yet.", "Complete a journey to build your travel history."],
  };
  const [title, sub] = messages[filter];
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
  const { journeys, navigate } = useApp();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [aiJourney, setAiJourney] = useState<Journey | null>(null);

  // Stats
  const upcomingCount = journeys.filter((j) => upcomingStatuses.has(j.status)).length;
  const planningCount = journeys.filter((j) => planningStatuses.has(j.status)).length;
  const completedCount = journeys.filter((j) => completedStatuses.has(j.status)).length;
  const inProgressCount = journeys.filter((j) => j.status === 'in-travel').length;

  // Featured journey: first in-travel, then pre-travel, then booked
  const featuredJourney =
    journeys.find((j) => j.status === 'in-travel') ??
    journeys.find((j) => j.status === 'pre-travel') ??
    journeys.find((j) => j.status === 'booked') ??
    null;

  // Planning journey
  const planningJourney =
    journeys.find((j) => j.status === 'planning') ??
    journeys.find((j) => j.status === 'discovering') ??
    null;

  // Filter tabs
  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: journeys.length },
    { key: 'planning', label: 'Planning', count: planningCount },
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { key: 'in-progress', label: 'In Progress', count: inProgressCount },
    { key: 'completed', label: 'Completed', count: completedCount },
  ];

  const filtered = journeys.filter((j) => {
    if (filter === 'upcoming') return upcomingStatuses.has(j.status);
    if (filter === 'planning') return planningStatuses.has(j.status);
    if (filter === 'in-progress') return j.status === 'in-travel';
    if (filter === 'completed') return completedStatuses.has(j.status);
    return true;
  });

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

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Upcoming', value: upcomingCount, sub: 'booked · pre-travel · active', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Planning', value: planningCount, sub: 'planning · discovering', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Completed', value: completedCount, sub: 'finished journeys', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">{stat.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{stat.sub}</p>
          </div>
        ))}
      </div>

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

      {/* Ask Journey AI panel */}
      {aiJourney && <AskJourneyAI journey={aiJourney} onClose={() => setAiJourney(null)} />}
    </div>
  );
}
