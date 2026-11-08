import { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import type { Journey } from '../../data/mockData';
import { visaRequirements } from '../../data/mockData';
import TripChatPanel from '../../components/chat/TripChatPanel';
import DisruptionBanner from '../../components/disruptions/DisruptionBanner';
import DisruptionReviewModal from '../../components/disruptions/DisruptionReviewModal';
import SimulateDelayControl from '../../components/disruptions/SimulateDelayControl';
import { tripStayDates } from '../../lib/stay';
import ItineraryMap from '../../components/itinerary/ItineraryMap';

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
  const { journeys, journeysStatus, refreshJourneys, bookings, selectedJourneyId, navigate, navigateToHotel, navigateToExperience, navigateToFlight, openHotels, visaApplications } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'bookings' | 'documents' | 'expenses' | 'journey-ai'>('overview');
  const [showAI, setShowAI] = useState(false);
  const [removedJourneyItems, setRemovedJourneyItems] = useState<Set<string>>(new Set());
  const [selectedDisruptionId, setSelectedDisruptionId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [disruptionsRefreshKey, setDisruptionsRefreshKey] = useState(0);
  const reviewButtonRef = useRef<HTMLButtonElement | null>(null);

  const journey = journeys.find((j) => j.id === selectedJourneyId);

  if (journeysStatus === 'loading' && !journey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading journey details…</p>
      </div>
    );
  }

  if (journeysStatus === 'error' && !journey) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">
          ⚠️
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Failed to load journey</h2>
        <p className="text-slate-500 text-sm mb-6">We couldn't retrieve the details for this journey. Please try again.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => navigate('my-trips')} className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
            Go to My Trips
          </button>
          <button onClick={() => refreshJourneys()} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🗺️</p>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Trip not found</h2>
        <p className="text-slate-500 mb-6">This journey may have been removed or the link is invalid.</p>
        <button onClick={() => navigate('my-trips')} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Go to My Trips
        </button>
      </div>
    );
  }

  const journeyBookings = bookings.filter((b) => journey.bookings.includes(b.id));
  const hasBudget = typeof journey.totalBudget === 'number' && journey.totalBudget > 0;
  const totalBudget = journey.totalBudget;
  const budgetPct = hasBudget && totalBudget ? Math.min(100, Math.round((journey.totalSpend / totalBudget) * 100)) : 0;
  const budgetWarning = hasBudget && budgetPct >= 85;

  // Journey Health score (simplified from 6 factors)
  const allItems = journey.itinerary.flatMap((d) => d.activities);
  const bookedItems = allItems.filter((a) => a.status === 'booked');
  const bookingProgress = allItems.length > 0 ? Math.round((bookedItems.length / allItems.length) * 100) : 0;
  const healthScore = Math.min(100, Math.round(
    (bookingProgress * 0.4) +
    (!hasBudget ? 20 : budgetPct < 85 ? 30 : budgetPct < 100 ? 15 : 0) +
    (journey.itinerary.length > 0 ? 20 : 0) +
    (journeyBookings.length > 0 ? 10 : 0)
  ));

  // Today's items for travel day mode
  const today = new Date().toISOString().split('T')[0];
  const todayItinerary = journey.itinerary.find((d) => d.date.startsWith(today));
  const isTravelDay = journey.status === 'in-travel';

  // Visa readiness
  const visaReq = visaRequirements.find((r) => r.destinationId === journey.destinationId || journey.destination.toLowerCase().includes(r.country.toLowerCase().split(' ')[0].toLowerCase()));
  const journeyVisaApp = visaApplications.find((a) => a.journeyId === journey.id || (visaReq && a.country === visaReq.country));
  const visaNeeded = visaReq && visaReq.requiresVisa && visaReq.visaType !== 'visa-free';

  const statusConf = statusConfig[journey.status];
  const unreadNotifications = journey.notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Disruption Guardian banner */}
      <DisruptionBanner
        journeyId={journey.id}
        refreshKey={disruptionsRefreshKey}
        reviewButtonRef={reviewButtonRef}
        onReview={(disruptionId) => {
          setSelectedDisruptionId(disruptionId);
          setIsReviewModalOpen(true);
        }}
      />

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
            <h1 className="font-display text-2xl sm:text-3xl text-white">{journey.title || journey.destination || '—'}</h1>
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
            <p className="text-xs text-slate-400">
              {hasBudget && totalBudget ? `of ₹${(totalBudget / 1000).toFixed(0)}k` : 'No budget set'}
            </p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">Remaining</p>
            <p className={`text-xl font-bold ${budgetWarning ? 'text-amber-600' : 'text-slate-900'}`}>
              {hasBudget && totalBudget ? `₹${Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}` : '—'}
            </p>
            <p className={`text-xs ${budgetWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              {hasBudget ? `${budgetPct}% used` : 'No budget set'}
            </p>
          </div>
        </div>
        {/* Budget bar */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-slate-100 flex-wrap">
          {hasBudget ? (
            <div className="flex-1 min-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">No budget set</span>
          )}
          <span className="text-xs text-slate-500">Budget</span>
          <div className="ml-auto flex items-center gap-2">
            <SimulateDelayControl
              itineraryId={journey.id}
              days={journey.itinerary}
              onSimulated={() => {
                setDisruptionsRefreshKey((k) => k + 1);
              }}
            />
            <button
              onClick={() => {
                const stay = tripStayDates(journey.itinerary);
                if (stay) {
                  openHotels({
                    destination: journey.destination,
                    checkIn: stay.checkIn,
                    checkOut: stay.checkOut,
                    guests: journey.travelers,
                  });
                } else {
                  openHotels({
                    destination: journey.destination,
                    guests: journey.travelers,
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 bg-white text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors min-h-[36px]"
            >
              <span>🏨</span>
              <span>Find hotels for this trip</span>
            </button>
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity min-h-[36px]"
            >
              <svg width="10" height="10" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
              Ask Journey AI
            </button>
            <button onClick={() => navigate('my-trips')} className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors min-h-[36px]">
              My Trips
            </button>
          </div>
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
                  { label: 'Budget Fit', value: !hasBudget ? 'No budget' : budgetPct < 85 ? 'Excellent' : budgetPct < 100 ? 'Tight' : 'Over', score: !hasBudget ? 3 : budgetPct < 85 ? 5 : budgetPct < 100 ? 3 : 1 },
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
                  <span>{hasBudget && totalBudget ? `₹${totalBudget.toLocaleString()}` : '—'}</span>
                </div>
                <div className={`flex justify-between text-xs font-medium ${budgetWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span>Remaining</span>
                  <span>{hasBudget && totalBudget ? `₹${Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}` : '—'}</span>
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
        <div>
          {journey.itinerary.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 mb-4">No itinerary yet</p>
              <button onClick={() => navigate('ai-planner')} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Plan with AI ✨
              </button>
            </div>
          ) : (
            <div>
              {/* Mobile Collapsible Map */}
              <div className="block lg:hidden mb-4">
                <details className="bg-white border border-slate-200 rounded-xl overflow-hidden group">
                  <summary className="px-5 py-3.5 font-semibold text-slate-900 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors list-none">
                    <span className="flex items-center gap-2">
                      <span>🗺️</span>
                      <span>Trip Map</span>
                    </span>
                    <span className="text-xs text-blue-600 font-medium group-open:hidden">Show map</span>
                    <span className="text-xs text-slate-400 font-medium hidden group-open:inline">Hide map</span>
                  </summary>
                  <div className="p-3 pt-0 border-t border-slate-100">
                    <ItineraryMap itinerary={journey.itinerary} />
                  </div>
                </details>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {journey.itinerary.map((day) => (
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
              ))}
            </div>

            {/* Desktop Sticky Map in Right Column */}
            <div className="hidden lg:block space-y-4">
              <div className="sticky top-20">
                <ItineraryMap itinerary={journey.itinerary} />
              </div>
            </div>
          </div>
        </div>
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
          {/* Identity & travel documents notice */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">🛂</div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Travel Identity — {user?.name || 'Traveler'}</p>
                <p className="text-xs text-slate-500">Keep physical and digital copies ready for border control</p>
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
                  <p className="text-2xl font-bold text-slate-900">
                    {hasBudget && totalBudget ? `₹${totalBudget.toLocaleString()}` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Total Budget</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">₹{journey.totalSpend.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Committed</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${budgetWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {hasBudget && totalBudget ? `₹${Math.max(0, totalBudget - journey.totalSpend).toLocaleString()}` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Remaining</p>
                </div>
              </div>
              {hasBudget ? (
                <>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{budgetPct}% of budget used</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">No budget set for this trip.</p>
              )}
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

      {/* Trip Chat floating button (positioned above Travel Assistant FAB) */}
      <div className="fixed bottom-22 right-6 z-30">
        <button
          onClick={() => setShowAI(true)}
          aria-label="Ask about your trip"
          className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-105 min-h-[48px]"
        >
          <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/></svg>
          </div>
          <span>Ask about your trip</span>
        </button>
      </div>

      {/* Journey AI tab */}
      {activeTab === 'journey-ai' && (
        <div className="max-w-2xl mx-auto">
          <TripChatPanel journey={journey} onClose={() => setActiveTab('overview')} isInline />
        </div>
      )}

      {/* Trip Chat panel (floating modal) */}
      {showAI && <TripChatPanel journey={journey} onClose={() => setShowAI(false)} />}

      {/* Disruption Review Modal */}
      {isReviewModalOpen && selectedDisruptionId && (
        <DisruptionReviewModal
          isOpen={isReviewModalOpen}
          disruptionId={selectedDisruptionId}
          itineraryDays={journey.itinerary}
          triggerRef={reviewButtonRef}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedDisruptionId(null);
          }}
          onDisruptionUpdated={() => {
            setDisruptionsRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
