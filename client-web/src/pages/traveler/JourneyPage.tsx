import { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import type { Journey } from '../../data/mockData';
import { visaRequirements } from '../../data/mockData';

// ─── Ask Journey AI panel ────────────────────────────────────────────────────

interface AIMessage {
  role: 'user' | 'ai';
  text: string;
}

function buildAIResponse(question: string, journey: Journey, bookedCount: number, totalSpend: number, totalBudget: number): string {
  const q = question.toLowerCase();
  const allItems = journey.itinerary.flatMap((d) => d.activities);
  const unbooked = allItems.filter((a) => a.status !== 'booked');
  const booked = allItems.filter((a) => a.status === 'booked');

  if (q.includes('budget') || q.includes('spent') || q.includes('left') || q.includes('remaining') || q.includes('money')) {
    const remaining = Math.max(0, totalBudget - totalSpend);
    return `You have spent ₹${totalSpend.toLocaleString()} of your ₹${totalBudget.toLocaleString()} budget. Remaining: ₹${remaining.toLocaleString()}. ${remaining > 0 ? "I can suggest experiences that fit within the remaining amount — would you like to see options?" : "Your budget is fully committed across confirmed bookings."}`;
  }
  if (q.includes('booked') || q.includes("what's confirmed") || q.includes('confirmed')) {
    if (bookedCount === 0) return "Nothing is booked yet. Your journey is in planning mode. I can help you start with the flight or hotel — which would you like to book first?";
    return `${bookedCount} item${bookedCount > 1 ? 's are' : ' is'} confirmed: ${booked.map((a) => a.title).slice(0, 3).join(', ')}${booked.length > 3 ? ` and ${booked.length - 3} more` : ''}. All confirmed bookings will appear in your Documents tab.`;
  }
  if (q.includes('unbooked') || q.includes("haven't booked") || q.includes('still need')) {
    if (unbooked.length === 0) return "Everything in your itinerary is confirmed. Your journey is fully booked!";
    return `${unbooked.length} item${unbooked.length > 1 ? 's' : ''} still need${unbooked.length === 1 ? 's' : ''} to be booked: ${unbooked.map((a) => a.title).slice(0, 4).join(', ')}. Head to the Itinerary tab to book them.`;
  }
  if (q.includes('hotel') && q.includes('cheaper')) {
    return `Your current hotel is among the top-rated in ${journey.destination}. For a more budget-friendly alternative, I'd recommend looking at 4-star properties in the same area — typically 30–40% less with similar access. Would you like me to find alternatives?`;
  }
  if (q.includes('busiest') || q.includes('densest') || q.includes('packed')) {
    const busiest = journey.itinerary.reduce((max, d) => d.activities.length > max.activities.length ? d : max, journey.itinerary[0]);
    if (!busiest) return "Your itinerary looks well-paced across all days.";
    return `Day ${busiest.day} (${busiest.title}) is your busiest with ${busiest.activities.length} activities: ${busiest.activities.map((a) => a.title).join(', ')}. Would you like to move one to another day?`;
  }
  if (q.includes('free time') || q.includes('how much time')) {
    const freeDays = journey.itinerary.filter((d) => d.activities.some((a) => a.type === 'free'));
    return freeDays.length > 0
      ? `You have free time on Day${freeDays.length > 1 ? 's' : ''} ${freeDays.map((d) => d.day).join(', ')}. These blocks are intentionally unstructured for spontaneous exploration.`
      : "Your itinerary is currently fully scheduled. I can create free time by moving an activity if you need breathing room.";
  }
  if (q.includes('delayed') || q.includes('flight delay') || q.includes('delay')) {
    return `If your outbound flight is delayed, here is the impact on your journey:\n\n✓ Hotel check-in is flexible until midnight — unaffected.\n⚠ Airport transfer should move by the same duration as the delay.\n✓ Day 1 evening dinner has no strict reservation — unaffected.\n\nWould you like me to flag this to your hotel and adjust the transfer timing?`;
  }
  if (q.includes('pack') || q.includes('bring') || q.includes('luggage')) {
    return `For ${journey.destination} at this time of year: lightweight layers for indoor/outdoor temperature changes, comfortable walking shoes (expect 8–12k steps/day), a compact umbrella, and any prescription medicine. If you're attending the tea ceremony, modest dress is recommended.`;
  }
  if (q.includes('food') || q.includes('eat') || q.includes('restaurant')) {
    return `${journey.destination} has excellent food options built into your itinerary. I've included market visits and local restaurants. If you want to add a dedicated food experience, the Tsukiji Market Tour or a ramen walking tour can slot into your free afternoons.`;
  }
  if (q.includes("what's next") || q.includes('whats next') || q.includes('next step') || q.includes('what should i do next')) {
    if (bookedCount === 0) return `Your next step is to confirm your flight — that locks in your travel dates and makes everything else bookable. Head to the Itinerary tab and look for the outbound flight.`;
    const nextUnbooked = unbooked[0];
    if (!nextUnbooked) return "All items are confirmed! Your journey is fully booked. Just make sure to check in for your flights 24 hours before departure.";
    return `Your next step is to book: ${nextUnbooked.title}. You have ${unbooked.length} item${unbooked.length > 1 ? 's' : ''} still unconfirmed. Tap on it in the Itinerary tab to continue.`;
  }
  if (q.includes('add') && (q.includes('food') || q.includes('restaurant') || q.includes('eat'))) {
    return `Great idea! For ${journey.destination}, I recommend the local food market tour — it usually runs 3–4 hours in the morning and covers street food, local produce, and cooking traditions. It slots well into a free morning. Go to Experiences in the destination page to browse and add it to your itinerary.`;
  }
  if (q.includes('food') || q.includes('eat') || q.includes('restaurant')) {
    return `${journey.destination} has excellent food options built into your itinerary. I've included market visits and local restaurants. If you want to add a dedicated food experience, browse the Experiences tab on the destination page — there are food tours and cooking classes available.`;
  }
  if (q.includes('weather')) {
    return `March in ${journey.destination} is typically cool (8–15°C), dry and clear — ideal travel weather. Cherry blossom season usually starts mid-March in Tokyo and reaches peak bloom around March 25–April 5. Kyoto follows about 1 week later.`;
  }

  return `I understand your question about "${question}". Based on your current ${journey.destination} journey (${journey.itinerary.length} days, ${journey.status} status), I'm here to help with anything from budget questions to itinerary adjustments. Could you be more specific about what you need?`;
}

function AskJourneyAI({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const { bookings } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'ai', text: `Hello! I know your ${journey.destination} journey inside out — ${journey.itinerary.length} days, ${journey.travelers} traveler${journey.travelers > 1 ? 's' : ''}, ${journey.status} status. Ask me anything.` },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const journeyBookings = bookings.filter((b) => journey.bookings.includes(b.id));
  const bookedCount = journey.itinerary.flatMap((d) => d.activities).filter((a) => a.status === 'booked').length;
  const totalSpend = journey.totalSpend;
  const totalBudget = journey.totalBudget ?? Math.max(totalSpend * 2, 350000);

  const QUICK = ["How much budget do I have left?", "What's booked already?", "Which day is the busiest?", "What's next?", "What if my flight is delayed?"];

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: AIMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      const response = buildAIResponse(text, journey, bookedCount, totalSpend, totalBudget);
      setMessages((prev) => [...prev, { role: 'ai', text: response }]);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:w-[480px] bg-white rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Ask Journey AI</p>
              <p className="text-xs text-slate-400">{journey.destination} · {journey.itinerary.length} days</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'ai' && (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-[8px] font-bold">J</span>
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[8px] font-bold">J</span>
              </div>
              <div className="flex gap-1 px-3.5 py-2.5 bg-slate-100 rounded-xl rounded-bl-sm">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} onClick={() => sendMessage(q)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 text-xs font-medium rounded-lg transition-all">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask about your journey..."
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7H2M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const statusConfig = {
  discovering: { label: 'Discovering', color: 'bg-slate-100 text-slate-600' },
  planning: { label: 'Planning', color: 'bg-blue-50 text-blue-700' },
  booked: { label: 'Booked', color: 'bg-violet-50 text-violet-700' },
  'pre-travel': { label: 'Pre-Travel', color: 'bg-amber-50 text-amber-700' },
  'in-travel': { label: 'Active Journey', color: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Completed', color: 'bg-slate-50 text-slate-500' },
  'post-travel': { label: 'Post Travel', color: 'bg-slate-50 text-slate-500' },
};

const typeIcons: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  activity: '⚡',
  transfer: '🚗',
  meal: '🍽️',
  free: '☀️',
};

export default function JourneyPage() {
  const { journeys, bookings, traveler, selectedJourneyId, resolveDisruption, activeDisruption, disruptionSimulated, navigate, dismissDisruption, navigateToHotel, navigateToExperience, navigateToFlight, visaApplications } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'bookings' | 'documents' | 'expenses' | 'journey-ai'>('overview');
  const [showAI, setShowAI] = useState(false);
  const [removedJourneyItems, setRemovedJourneyItems] = useState<Set<string>>(new Set());

  const journey = journeys.find((j) => j.id === selectedJourneyId);

  if (!journey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🗺️</p>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Journey not found</h2>
        <p className="text-slate-500 mb-6">This journey may have been removed or the link is invalid.</p>
        <button onClick={() => navigate('my-trips')} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Go to My Trips
        </button>
      </div>
    );
  }

  const journeyBookings = bookings.filter((b) => journey.bookings.includes(b.id));
  const totalBudget = journey.totalBudget ?? Math.max(journey.totalSpend * 2, 350000);
  const budgetPct = Math.min(100, Math.round((journey.totalSpend / totalBudget) * 100));
  const budgetWarning = budgetPct >= 85;

  // Journey Health score (simplified from 6 factors)
  const allItems = journey.itinerary.flatMap((d) => d.activities);
  const bookedItems = allItems.filter((a) => a.status === 'booked');
  const bookingProgress = allItems.length > 0 ? Math.round((bookedItems.length / allItems.length) * 100) : 0;
  const healthScore = Math.min(100, Math.round(
    (bookingProgress * 0.4) +
    (budgetPct < 85 ? 30 : budgetPct < 100 ? 15 : 0) +
    (journey.itinerary.length > 0 ? 20 : 0) +
    (journeyBookings.length > 0 ? 10 : 0)
  ));

  // Next unbooked item
  const nextUnbooked = allItems.find((a) => a.status !== 'booked' && ['flight', 'hotel', 'activity'].includes(a.type));

  // Today's items for travel day mode
  const today = new Date().toISOString().split('T')[0];
  const todayItinerary = journey.itinerary.find((d) => d.date.startsWith(today));
  const isTravelDay = journey.status === 'in-travel';

  const disruption = journey.disruptions[0];

  // Visa readiness
  const visaReq = visaRequirements.find((r) => r.destinationId === journey.destinationId || journey.destination.toLowerCase().includes(r.country.toLowerCase().split(' ')[0].toLowerCase()));
  const journeyVisaApp = visaApplications.find((a) => a.journeyId === journey.id || (visaReq && a.country === visaReq.country));
  const visaNeeded = visaReq && visaReq.requiresVisa && visaReq.visaType !== 'visa-free';
  const liveDisruption = activeDisruption || (disruptionSimulated && disruption ? { ...disruption, status: 'investigating' as const } : null);

  const statusConf = statusConfig[journey.status];
  const unreadNotifications = journey.notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Disruption banner */}
      {liveDisruption && liveDisruption.status !== 'resolved' && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-xl">✈️</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Travel Update</span>
              </div>
              <h3 className="font-semibold text-slate-900">Your flight has been delayed.</h3>
              <p className="text-slate-600 text-sm mt-1">IndiGo 6E-812 is delayed by 45 minutes. New departure time: <strong>03:15 IST</strong>.</p>
              <div className="mt-2.5 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-blue-800 text-sm"><span className="font-semibold">What this means for you:</span> {liveDisruption.impact}</p>
              </div>
              <p className="text-slate-600 text-sm mt-2">💡 {liveDisruption.recommendation}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0 sm:min-w-[140px]">
            <button
              onClick={() => navigate('support')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors text-center"
            >
              Get Help
            </button>
            <button
              onClick={dismissDisruption}
              className="px-4 py-2.5 border border-amber-200 text-amber-700 text-sm font-medium rounded-xl hover:bg-amber-50 transition-colors text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Travel Day Mode Banner */}
      {isTravelDay && todayItinerary && (
        <div className="mb-5 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl p-5 text-white animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Active Journey</span>
          </div>
          <h3 className="font-display text-lg mb-3">TODAY — {todayItinerary.title}</h3>
          <div className="space-y-2">
            {todayItinerary.activities.slice(0, 3).map((act) => (
              <div key={act.id} className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
                <span className="text-sm font-mono text-blue-100 w-10">{act.time}</span>
                <span>{typeIcons[act.type] || '📌'}</span>
                <span className="text-sm font-medium flex-1">{act.title}</span>
                {act.status === 'booked' && <span className="text-xs text-emerald-300 font-semibold">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="relative h-48 sm:h-56">
          <img src={journey.imageUrl} alt={journey.destination} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusConf.color}`}>
                {statusConf.label}
              </span>
              {unreadNotifications > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full">
                  {unreadNotifications} new alert{unreadNotifications > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-white">{journey.title}</h1>
            <p className="text-white/70 text-sm mt-1">
              {new Date(journey.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
              {new Date(journey.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{journey.travelers} traveler{journey.travelers > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
          <div className="bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">Journey Health</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{healthScore}</span>
              <span className="text-slate-400 text-xs">/100</span>
            </div>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">Booked</p>
            <p className="text-xl font-bold text-slate-900">{journeyBookings.length}</p>
            <p className="text-xs text-slate-400">{allItems.length - bookedItems.length} pending</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">Spent</p>
            <p className="text-xl font-bold text-slate-900">₹{(journey.totalSpend / 1000).toFixed(0)}k</p>
            <p className="text-xs text-slate-400">of ₹{(totalBudget / 1000).toFixed(0)}k</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">Remaining</p>
            <p className={`text-xl font-bold ${budgetWarning ? 'text-amber-600' : 'text-slate-900'}`}>
              ₹{Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}
            </p>
            <p className={`text-xs ${budgetWarning ? 'text-amber-500' : 'text-slate-400'}`}>{budgetPct}% used</p>
          </div>
        </div>
        {/* Budget bar */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-slate-100">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">Budget</span>
          <button
            onClick={() => setShowAI(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
            Ask Journey AI
          </button>
          <button onClick={() => navigate('my-trips')} className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            My Trips
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'itinerary', label: 'Itinerary' },
          { key: 'bookings', label: `Bookings (${journeyBookings.length})` },
          { key: 'documents', label: 'Documents' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'journey-ai', label: '✦ Journey AI' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Next up */}
            {nextUnbooked && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {typeIcons[nextUnbooked.type] || '📌'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Needs Booking</p>
                    <p className="font-semibold text-slate-900">{nextUnbooked.title}</p>
                    {nextUnbooked.notes && <p className="text-xs text-slate-500 mt-0.5">{nextUnbooked.notes}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('itinerary')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Book Now
                </button>
              </div>
            )}

            {/* Journey Health */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Journey Health</h3>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{healthScore}</span>
                  <span className="text-slate-400 text-sm">/100</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Budget Fit', value: budgetPct < 85 ? 'Excellent' : budgetPct < 100 ? 'Tight' : 'Over', score: budgetPct < 85 ? 5 : budgetPct < 100 ? 3 : 1 },
                  { label: 'Booking Progress', value: bookingProgress === 100 ? 'Complete' : bookingProgress > 50 ? 'Good' : 'Needs attention', score: bookingProgress === 100 ? 5 : bookingProgress > 50 ? 3 : 2 },
                  { label: 'Pace', value: journey.itinerary.length > 0 ? 'Balanced' : 'Not planned', score: journey.itinerary.length > 0 ? 4 : 1 },
                  { label: 'Hotels', value: journeyBookings.filter(b => b.type === 'hotel').length > 0 ? 'Confirmed' : 'Not booked', score: journeyBookings.filter(b => b.type === 'hotel').length > 0 ? 5 : 2 },
                  { label: 'Travel Time', value: journeyBookings.filter(b => b.type === 'flight').length > 0 ? 'Arranged' : 'Not booked', score: journeyBookings.filter(b => b.type === 'flight').length > 0 ? 5 : 2 },
                  { label: 'Experiences', value: journeyBookings.filter(b => b.type === 'activity').length > 0 ? 'Planned' : 'None added', score: journeyBookings.filter(b => b.type === 'activity').length > 0 ? 4 : 2 },
                ].map((factor) => (
                  <div key={factor.label} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-36 flex-shrink-0">{factor.label}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className={`w-6 h-1.5 rounded-full ${i <= factor.score ? (factor.score >= 4 ? 'bg-emerald-500' : factor.score >= 3 ? 'bg-amber-500' : 'bg-red-400') : 'bg-slate-100'}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ml-auto ${factor.score >= 4 ? 'text-emerald-600' : factor.score >= 3 ? 'text-amber-600' : 'text-red-600'}`}>{factor.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bars */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Trip Progress</h3>
              <div className="space-y-4">
                {[
                  { label: 'Planning', value: journey.itinerary.length > 0 ? 100 : 30, color: 'bg-blue-500' },
                  { label: 'Booking', value: bookingProgress, color: bookingProgress === 100 ? 'bg-emerald-500' : 'bg-amber-500' },
                ].map((p) => (
                  <div key={p.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-slate-600">{p.label}</span>
                      <span className="text-sm font-semibold text-slate-800">{p.value}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visa Readiness */}
            {visaReq && (
              <div className={`rounded-xl p-5 border ${journeyVisaApp?.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : visaNeeded && !journeyVisaApp ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{visaReq.flag}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">Visa for {visaReq.country}</h3>
                      <p className="text-xs text-slate-500 capitalize">{visaReq.visaType.replace('-', ' ')}</p>
                    </div>
                  </div>
                  {journeyVisaApp ? (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      journeyVisaApp.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      journeyVisaApp.status === 'submitted' || journeyVisaApp.status === 'under-review' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {journeyVisaApp.status === 'approved' ? '✓ Approved' :
                       journeyVisaApp.status === 'submitted' ? 'Submitted' :
                       journeyVisaApp.status === 'under-review' ? 'Under Review' :
                       journeyVisaApp.status === 'document-check' ? 'Doc Check' :
                       journeyVisaApp.status === 'decision-pending' ? 'Decision Pending' :
                       journeyVisaApp.status.replace(/-/g, ' ')}
                    </span>
                  ) : visaNeeded ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Action Required</span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">No Visa Required</span>
                  )}
                </div>
                {visaNeeded && !journeyVisaApp && (
                  <p className="text-xs text-violet-800 mb-3">
                    {visaReq.visaType === 'e-visa' ? `Apply for an e-visa online — takes ${visaReq.processingDays} business days. Fee: ₹${visaReq.fee?.toLocaleString()}.` :
                     visaReq.visaType === 'on-arrival' ? `Visa available on arrival. Prepare ₹${visaReq.fee?.toLocaleString()} and supporting documents.` :
                     `Visa required. Apply at the embassy — allow ${visaReq.processingDays} business days. Fee: ₹${visaReq.fee?.toLocaleString()}.`}
                  </p>
                )}
                <button
                  onClick={() => navigate('visa-center')}
                  className={`text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                    journeyVisaApp ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : visaNeeded ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {journeyVisaApp ? 'View Application' : visaNeeded ? 'Apply in Visa Center →' : 'View Details'}
                </button>
              </div>
            )}

            {/* Notifications */}
            {journey.notifications.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Recent Updates</h3>
                <div className="space-y-3">
                  {journey.notifications.slice(0, 3).map((n) => (
                    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border ${!n.read ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'alert' ? 'bg-red-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                {journeyBookings.length === 0 ? (
                  <p className="text-slate-400 text-sm">No bookings yet</p>
                ) : (
                  journeyBookings.map((b) => (
                    <div key={b.id} className="flex justify-between items-center">
                      <span className="text-slate-600 truncate max-w-[160px]">{b.itemName.split(':')[0]}</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${b.paymentStatus === 'successful' ? 'bg-emerald-500' : b.paymentStatus === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-slate-800">₹{b.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between font-semibold">
                  <span className="text-slate-900">Total spent</span>
                  <span className="text-blue-700">₹{journey.totalSpend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Budget</span>
                  <span>₹{totalBudget.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-xs font-medium ${budgetWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span>Remaining</span>
                  <span>₹{Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'View Itinerary', icon: '📅', action: () => setActiveTab('itinerary') },
                  { label: 'View Bookings', icon: '🎫', action: () => setActiveTab('bookings') },
                  { label: 'Contact Support', icon: '💬', action: () => navigate('support') },
                  { label: 'View Expenses', icon: '💳', action: () => setActiveTab('expenses') },
                ].map((a) => (
                  <button key={a.label} onClick={a.action} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <span>{a.icon}</span>
                    <span className="text-sm text-slate-700 font-medium">{a.label}</span>
                    <svg className="ml-auto" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Itinerary */}
      {activeTab === 'itinerary' && (
        <div className="space-y-4">
          {journey.itinerary.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 mb-4">No itinerary yet</p>
              <button onClick={() => navigate('ai-planner')} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Plan with AI ✨
              </button>
            </div>
          ) : (
            journey.itinerary.map((day) => (
              <div key={day.day} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-semibold text-blue-600">Day {day.day}</span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{day.title} — {day.location}</p>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {day.activities.filter((act) => !removedJourneyItems.has(act.id)).map((act) => (
                    <div key={act.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">
                      <span className="text-xs font-mono text-slate-400 w-10 flex-shrink-0">{act.time}</span>
                      <span className="text-base flex-shrink-0">{typeIcons[act.type] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{act.title}</p>
                        {act.notes && <p className="text-xs text-slate-500 mt-0.5">{act.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {act.cost !== undefined && act.cost > 0 && (
                          <span className="text-xs font-medium text-slate-600">₹{act.cost.toLocaleString()}</span>
                        )}
                        {act.status === 'booked' ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-100">✓ Confirmed</span>
                            <button
                              onClick={() => navigate('my-bookings')}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap"
                            >
                              View booking →
                            </button>
                          </div>
                        ) : act.type === 'hotel' && act.hotelId ? (
                          <button
                            onClick={() => navigateToHotel(act.hotelId!, { journeyId: journey.id, itineraryItemId: act.id })}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Book Hotel
                          </button>
                        ) : act.type === 'activity' && act.activityId ? (
                          <button
                            onClick={() => navigateToExperience(act.activityId!, { journeyId: journey.id, itineraryItemId: act.id })}
                            className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
                          >
                            Book
                          </button>
                        ) : act.type === 'flight' && act.flightId ? (
                          <button
                            onClick={() => navigateToFlight(act.flightId!, { journeyId: journey.id, itineraryItemId: act.id })}
                            className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors"
                          >
                            Book Flight
                          </button>
                        ) : null}
                        {/* Remove button */}
                        <button
                          onClick={() => setRemovedJourneyItems((prev) => { const n = new Set(prev); n.add(act.id); return n; })}
                          title="Remove from itinerary"
                          className="w-6 h-6 rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-sm transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {journeyBookings.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 mb-4">No bookings yet</p>
              <button onClick={() => navigate('search')} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">Search & Book</button>
            </div>
          ) : (
            journeyBookings.map((b) => (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      b.type === 'flight' ? 'bg-blue-50' : b.type === 'hotel' ? 'bg-violet-50' : 'bg-amber-50'
                    }`}>
                      {typeIcons[b.type] || '📌'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{b.itemName}</p>
                      <p className="text-slate-500 text-sm mt-0.5">{b.itemDetails}</p>
                      <p className="text-xs text-slate-400 mt-1 font-mono">{b.referenceId}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-900">₹{b.totalAmount.toLocaleString()}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                      b.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Supplier: {b.supplierName}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.paymentStatus === 'successful' ? 'bg-emerald-500' : b.paymentStatus === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span>Payment: {b.paymentStatus}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {/* Booking-derived documents */}
          {journeyBookings.length === 0 && (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
              <p className="text-3xl mb-3">📄</p>
              <p className="text-slate-500 font-medium">No travel documents yet.</p>
              <p className="text-slate-400 text-sm mt-1">Documents will appear here once you make bookings.</p>
            </div>
          )}
          {/* Passport always shown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">🛂</div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Indian Passport — {traveler.name}</p>
                <p className="text-xs text-slate-500">{traveler.passportNumber} · Expires Aug 2031</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Valid</span>
          </div>
          {/* Booking vouchers */}
          {journeyBookings.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#2563eb" strokeWidth="1.5">
                    <path d="M10 2H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V8L10 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 2v6h6" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">
                    {b.type === 'flight' ? 'Flight e-Ticket' : b.type === 'hotel' ? 'Hotel Voucher' : 'Experience Voucher'} — {b.supplierName}
                  </p>
                  <p className="text-xs text-slate-500">{b.referenceId} · {b.itemName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {b.status}
                </span>
                <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  Download
                </button>
              </div>
            </div>
          ))}
          {/* Travel Insurance placeholder */}
          <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center justify-between opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">🛡️</div>
              <div>
                <p className="font-semibold text-slate-700 text-sm">Travel Insurance</p>
                <p className="text-xs text-slate-400">Add travel insurance to protect your journey</p>
              </div>
            </div>
            <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Expenses */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Budget overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Budget Overview</h3>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">₹{totalBudget.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total Budget</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">₹{journey.totalSpend.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Committed</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${budgetWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ₹{Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Remaining</p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{budgetPct}% of budget used</p>
            </div>

            {/* Category breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">By Category</h3>
              {(() => {
                const flightSpend = journeyBookings.filter(b => b.type === 'flight').reduce((s, b) => s + b.totalAmount, 0);
                const hotelSpend = journeyBookings.filter(b => b.type === 'hotel').reduce((s, b) => s + b.totalAmount, 0);
                const activitySpend = journeyBookings.filter(b => b.type === 'activity').reduce((s, b) => s + b.totalAmount, 0);
                const categories = [
                  { label: 'Flights', icon: '✈️', amount: flightSpend, color: 'bg-blue-500' },
                  { label: 'Hotels', icon: '🏨', amount: hotelSpend, color: 'bg-violet-500' },
                  { label: 'Experiences', icon: '⚡', amount: activitySpend, color: 'bg-amber-500' },
                  { label: 'Other', icon: '💳', amount: 0, color: 'bg-slate-300' },
                ];
                const total = journey.totalSpend || 1;
                return (
                  <div className="space-y-3">
                    {categories.map((cat) => (
                      <div key={cat.label} className="flex items-center gap-3">
                        <span className="text-base w-6">{cat.icon}</span>
                        <span className="text-sm text-slate-600 w-24">{cat.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${Math.round((cat.amount / total) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium text-slate-800 w-24 text-right">
                          {cat.amount > 0 ? `₹${cat.amount.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Booking list */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">All Expenses</h3>
              </div>
              {journeyBookings.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-slate-400 text-sm">No expenses recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {journeyBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-base">{typeIcons[b.type] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{b.itemName}</p>
                        <p className="text-xs text-slate-400">{b.supplierName} · {b.referenceId}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-900">₹{b.totalAmount.toLocaleString()}</p>
                        <span className={`text-xs ${b.paymentStatus === 'successful' ? 'text-emerald-600' : 'text-amber-600'}`}>{b.paymentStatus}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-4 bg-slate-50">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="font-bold text-blue-700">₹{journey.totalSpend.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <h3 className="font-semibold text-blue-900 mb-2">Ask Journey AI</h3>
              <p className="text-sm text-blue-700 mb-4">"Can I save money on this trip?" or "Where am I spending the most?"</p>
              <button onClick={() => setShowAI(true)} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                Ask About Budget
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Ask Journey AI floating button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowAI(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-xl shadow-blue-500/25 transition-all hover:scale-105"
        >
          <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
          </div>
          Ask Journey AI
        </button>
      </div>

      {/* Journey AI tab */}
      {activeTab === 'journey-ai' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-950 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Journey AI</p>
                  <p className="text-slate-400 text-xs">Knows your {journey.destination} trip inside out</p>
                </div>
              </div>
            </div>
            <AskJourneyAI journey={journey} onClose={() => setActiveTab('overview')} />
          </div>
        </div>
      )}

      {/* Ask Journey AI panel (floating) */}
      {showAI && <AskJourneyAI journey={journey} onClose={() => setShowAI(false)} />}
    </div>
  );
}
