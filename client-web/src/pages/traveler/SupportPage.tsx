import { useState } from 'react';
import { useApp } from '../../store/AppContext';

// ─── FAQ data ────────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  {
    id: 'bookings',
    label: 'Bookings',
    items: [
      {
        q: 'How do I cancel my booking?',
        a: 'Go to My Bookings, select the booking you want to cancel, and tap "Cancel booking". Cancellations are subject to the fare rules of your ticket. Free cancellation is available on eligible fares within 24 hours of booking.',
      },
      {
        q: 'What is the refund policy?',
        a: 'Refunds depend on the fare type selected at booking. Fully flexible fares are refunded within 5–7 business days. Non-refundable fares may be eligible for a credit voucher. Taxes and surcharges are typically refundable.',
      },
      {
        q: 'Can I change my travel dates?',
        a: 'Yes — date changes are allowed on most fares for a fee. Log in, go to My Bookings, select your trip, and choose "Change dates". Fare differences may apply.',
      },
    ],
  },
  {
    id: 'flights',
    label: 'Flights',
    items: [
      {
        q: 'What happens if my flight is delayed?',
        a: 'You will receive an instant push notification and email if your flight is delayed. For delays over 3 hours, you are entitled to meals and lounge access at the airport per DGCA guidelines. Our team can help you rebook at no extra charge.',
      },
      {
        q: 'How do I manage my seat selection?',
        a: 'Seat selection is available in My Bookings → select your flight → Manage Seats. Seat maps are shown at the time of booking and can be changed up to 4 hours before departure (subject to availability).',
      },
      {
        q: "What's included in my fare?",
        a: 'Fare inclusions vary by class and airline. Economy fares typically include 1 cabin bag (7kg) and 1 checked bag (15–23kg). Business class includes 2 checked bags, lounge access, and priority boarding. Full details are shown at checkout.',
      },
    ],
  },
  {
    id: 'hotels',
    label: 'Hotels',
    items: [
      {
        q: 'What does free cancellation mean?',
        a: 'Free cancellation means you can cancel your hotel reservation at no charge up to the cancellation deadline shown on the property page (usually 24–48 hours before check-in). After the deadline, the full booking amount is charged.',
      },
      {
        q: 'How do I request early check-in?',
        a: 'Early check-in requests can be added in My Bookings → select your hotel → "Special requests". Availability is subject to the hotel and cannot be guaranteed, but we forward your request on your behalf.',
      },
    ],
  },
  {
    id: 'visa',
    label: 'Visa',
    items: [
      {
        q: 'How long does visa processing take?',
        a: 'Processing times vary by country. Most tourist visas take 5–15 business days. Some destinations offer e-visa approval within 24–72 hours. Check the Visa Center for up-to-date timelines specific to your destination.',
      },
      {
        q: 'What documents do I need for a visa application?',
        a: 'Typically: valid passport (6+ months validity), passport-size photos, confirmed flight and hotel bookings, bank statements (last 3 months), travel insurance, and a completed application form. Requirements differ by country — see Visa Center for the exact checklist.',
      },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { journeys, traveler, navigate } = useApp();

  const activeJourney =
    journeys.find((j) => j.status === 'in-travel') ??
    journeys.find((j) => ['booked', 'pre-travel', 'planning'].includes(j.status)) ??
    null;

  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showDisruptionForm, setShowDisruptionForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: `Hi ${traveler.name.split(' ')[0]}! How can I help you today? I can see your upcoming trips and bookings.` },
  ]);
  const [chatInput, setChatInput] = useState('');

  function handleChatSend() {
    if (!chatInput.trim()) return;
    const next = [
      ...chatMessages,
      { role: 'user' as const, text: chatInput },
      { role: 'agent' as const, text: "Thanks for reaching out! I'm looking into that for you right now. Typical resolution time is under 2 minutes." },
    ];
    setChatMessages(next);
    setChatInput('');
  }

  const filteredFaq = search.trim()
    ? FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0)
    : FAQ_CATEGORIES;

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* ── Hero ── */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
          <h1 className="font-sans font-bold text-3xl sm:text-4xl mb-3">How can we help you today?</h1>
          <p className="text-white/50 text-base mb-8">We know your booking — no need to repeat yourself.</p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
            >
              <circle cx="8" cy="8" r="5.5"/><path d="M13.5 13.5l2.5 2.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers..."
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/12 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/15 transition-all"
            />
          </div>

          {/* Quick topic chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {['Booking', 'Refunds', 'Visa', 'Flight delays', 'Hotels'].map((topic) => (
              <button
                key={topic}
                onClick={() => setSearch(topic)}
                className="px-3.5 py-1.5 rounded-full bg-white/8 border border-white/12 text-white/60 text-xs font-medium hover:bg-white/15 hover:text-white transition-all"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Active journey contextual card ── */}
        {activeJourney && (
          <div className="bg-white border border-blue-100 rounded-xl p-5 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M9 2L11 7H16L12 10.5L13.5 16L9 12.5L4.5 16L6 10.5L2 7H7L9 2Z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Help for your upcoming trip</p>
              <p className="text-sm font-semibold text-slate-900">{activeJourney.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeJourney.startDate} – {activeJourney.endDate} · {activeJourney.bookings.length} bookings
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => navigate('my-bookings')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View bookings →
                </button>
                <button
                  onClick={() => setShowChat(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Chat with support →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="font-sans font-semibold text-slate-900 text-lg mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M7 2v4M13 2v4M3 10h14" strokeLinecap="round"/></svg>
                ),
                label: 'Track my booking',
                color: 'text-blue-600 bg-blue-50',
                action: () => navigate('my-bookings'),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2l8 4-8 4-8-4 8-4z" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10l8 4 8-4" strokeLinecap="round"/><path d="M2 14l8 4 8-4" strokeLinecap="round"/></svg>
                ),
                label: 'Flight disruption',
                color: 'text-red-600 bg-red-50',
                action: () => setShowDisruptionForm(true),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"/><path d="M10 6v4l3 3" strokeLinecap="round"/></svg>
                ),
                label: 'Request a refund',
                color: 'text-amber-600 bg-amber-50',
                action: () => setShowRefundForm(true),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="8"/><path d="M7 10l3 3 3-3M10 7v6" strokeLinecap="round"/></svg>
                ),
                label: 'Cancel a booking',
                color: 'text-slate-600 bg-slate-100',
                action: () => navigate('my-bookings'),
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-center group"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform`}>
                  {action.icon}
                </div>
                <span className="text-sm font-medium text-slate-700 leading-tight">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Inline forms */}
          {showDisruptionForm && (
            <div className="mt-4 bg-white border border-red-100 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-sm">Report a Flight Disruption</h3>
                <button onClick={() => setShowDisruptionForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="space-y-3">
                <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-red-300">
                  <option>Select affected booking...</option>
                  {activeJourney && <option>{activeJourney.title}</option>}
                </select>
                <textarea placeholder="Describe the disruption..." rows={3} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-red-300 resize-none" />
                <button className="px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Submit Report</button>
              </div>
            </div>
          )}

          {showRefundForm && (
            <div className="mt-4 bg-white border border-amber-100 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-sm">Request a Refund</h3>
                <button onClick={() => setShowRefundForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="space-y-3">
                <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-amber-300">
                  <option>Select booking to refund...</option>
                  {activeJourney && <option>{activeJourney.title} (₹{activeJourney.totalSpend.toLocaleString()})</option>}
                </select>
                <textarea placeholder="Reason for refund..." rows={3} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-amber-300 resize-none" />
                <button className="px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors">Request Refund</button>
              </div>
            </div>
          )}
        </div>

        {/* ── FAQ Accordion ── */}
        <div>
          <h2 className="font-sans font-semibold text-slate-900 text-lg mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {filteredFaq.map((cat) => (
              <div key={cat.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">{cat.label}</p>
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                  {cat.items.map((item, idx) => {
                    const id = `${cat.id}-${idx}`;
                    const isOpen = openFaq === id;
                    return (
                      <div key={id} className="border-b border-slate-50 last:border-0">
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : id)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-slate-800 pr-4">{item.q}</span>
                          <svg
                            width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"
                            className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          >
                            <path d="M2.5 5L7 9.5L11.5 5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4">
                            <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contact Strip ── */}
        <div>
          <h2 className="font-sans font-semibold text-slate-900 text-lg mb-4">Contact Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15.5a2 2 0 01-2 2 19 19 0 01-17-17 2 2 0 012-2h3a2 2 0 012 1.7 12 12 0 00.7 2.8 2 2 0 01-.5 2L8 6.5a16 16 0 006.5 6.5l1.5-1.5a2 2 0 012-.5c.9.3 1.9.6 2.8.7A2 2 0 0121 13.5v2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ),
                label: 'Live Chat',
                sub: 'Average response under 1 minute',
                cta: 'Chat now',
                action: () => setShowChat(true),
                color: 'text-blue-600 bg-blue-50',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4h14a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><polyline points="2,6 11,13 20,6" strokeLinecap="round"/></svg>
                ),
                label: 'Email',
                sub: 'support@travalastic.com',
                cta: 'Send email',
                action: () => {},
                color: 'text-violet-600 bg-violet-50',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>
                ),
                label: 'Call Us',
                sub: '+91 1800 XXX XXXX · Mon–Sat 9AM–9PM',
                cta: 'View number',
                action: () => {},
                color: 'text-emerald-600 bg-emerald-50',
              },
            ].map((contact) => (
              <div key={contact.label} className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 flex flex-col gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${contact.color}`}>
                  {contact.icon}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{contact.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{contact.sub}</p>
                </div>
                <button
                  onClick={contact.action}
                  className="mt-auto px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 transition-all self-start"
                >
                  {contact.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Chat Widget (floating) ── */}
      {showChat && (
        <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col" style={{ maxHeight: 480 }}>
          <div className="flex items-center gap-3 p-4 bg-slate-950 text-white">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">T</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Travalastic Support</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400">Online</span>
              </div>
            </div>
            <button onClick={() => setShowChat(false)} className="text-white/40 hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50" style={{ maxHeight: 300 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'agent' && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">T</div>
                )}
                <div className={`rounded-xl px-3.5 py-2.5 text-xs max-w-[200px] leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-100 bg-white">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={handleChatSend}
                className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 6L2 2l1.5 4L2 10l8-4z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat open button (when closed) */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center justify-center z-40"
          aria-label="Open chat"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
