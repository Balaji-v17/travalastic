import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { deals } from '../../data/mockData';
import { allPackages, formatPackagePrice } from '../../data/packagesData';

type SearchTab = 'flights' | 'hotels' | 'experiences' | 'journey';

function StyleItem({ label, onNavigate }: { label: string; onNavigate: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left flex items-center justify-between py-5 lg:py-6 group transition-colors"
      style={{ borderColor: '#E8E4DC' }}
    >
      <span
        className="font-display transition-colors"
        style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.8rem)', letterSpacing: '-0.01em', color: hovered ? '#C9A96E' : '#252525' }}
      >
        {label}
      </span>
      <span
        className="text-lg transition-colors ml-4 shrink-0"
        style={{ color: hovered ? '#C9A96E' : '#77736C' }}
      >
        &rarr;
      </span>
    </button>
  );
}

export default function HomePage() {
  const { navigate, setSearchQuery, setPlannerDestination, journeys, navigateToPackage } = useApp();

  // Search state
  const [searchTab, setSearchTab] = useState<SearchTab>('flights');
  const [flightFrom, setFlightFrom] = useState('Mumbai (BOM)');
  const [flightTo, setFlightTo] = useState('Tokyo (NRT)');
  const [flightDep, setFlightDep] = useState('2027-03-15');
  const [flightRet, setFlightRet] = useState('2027-03-22');
  const [flightCabin, setFlightCabin] = useState('Business');
  const [hotelDest, setHotelDest] = useState('Tokyo');
  const [hotelCheckIn, setHotelCheckIn] = useState('2027-03-15');
  const [hotelCheckOut, setHotelCheckOut] = useState('2027-03-22');
  const [expDest, setExpDest] = useState('Tokyo');
  const [expDate, setExpDate] = useState('2027-03-17');
  const [expCategory, setExpCategory] = useState('Food & Culture');
  const [journeyDest, setJourneyDest] = useState('Japan');
  const [journeyWhen, setJourneyWhen] = useState('March 2027');
  const [journeyTravelers, setJourneyTravelers] = useState(2);
  const [journeyBudget, setJourneyBudget] = useState('₹2.5L–₹5L');
  const [journeyStyle, setJourneyStyle] = useState('Relaxed');

  const activeJourney =
    journeys.find((j) => j.status === 'in-travel') ??
    journeys.find((j) => j.status === 'pre-travel') ??
    journeys.find((j) => j.status === 'planning') ??
    journeys.find((j) => j.status === 'booked');

  const featuredDestinations = [
    { id: 'tokyo', name: 'Tokyo', country: 'Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1000&h=800&fit=crop&auto=format', tagline: 'Where ancient ritual meets total modernity' },
    { id: 'bali', name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=500&fit=crop&auto=format', tagline: 'Sacred temples in a tropical landscape' },
    { id: 'santorini', name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=600&h=500&fit=crop&auto=format', tagline: 'Sunsets at the edge of the caldera' },
  ];

  const featuredDeals = deals.slice(0, 3);

  function getJourneyProgress(journey: typeof journeys[0]) {
    const all = journey.itinerary.flatMap((d) => d.activities);
    const booked = all.filter((a) => a.status === 'booked').length;
    return { booked, total: all.length || 1, pct: Math.round((booked / (all.length || 1)) * 100) };
  }

  function getNextUnbooked(journey: typeof journeys[0]) {
    for (const day of journey.itinerary) {
      const item = day.activities.find((a) => a.status !== 'booked');
      if (item) return item;
    }
    return null;
  }

  function handleFlightSearch() {
    setSearchQuery({ from: flightFrom, destination: flightTo, dates: `${flightDep} – ${flightRet}`, checkIn: flightDep, checkOut: flightRet, type: 'flights', cabin: flightCabin, travelers: 2 });
    navigate('search');
  }
  function handleHotelSearch() {
    setSearchQuery({ destination: hotelDest, checkIn: hotelCheckIn, checkOut: hotelCheckOut, dates: `${hotelCheckIn} – ${hotelCheckOut}`, type: 'hotels', travelers: 2 });
    navigate('search');
  }
  function handleExpSearch() {
    setSearchQuery({ destination: expDest, dates: expDate, type: 'experiences', travelers: 2 });
    navigate('search');
  }
  function handleJourneyBuild() {
    setPlannerDestination(journeyDest, '');
    navigate('ai-planner');
  }

  const inputCls = 'w-full border-0 border-b border-[#E8E4DC] bg-transparent px-0 py-2.5 text-sm text-[#252525] focus:outline-none focus:border-[#C9A96E] transition-colors placeholder-[#77736C]';
  const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#77736C] mb-1';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F5F0' }}>

      {/* ══════════════════════════════════════════════════════════
          HERO — cinematic, full-bleed photography
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden -mt-[60px] pt-[60px] lg:min-h-[88svh]"
      >
        {/* Background */}
        <img
          src="https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1800&h=1100&fit=crop&auto=format"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.65 }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(17,17,17,0.10) 0%, rgba(17,17,17,0.15) 40%, rgba(17,17,17,0.72) 100%)' }}
        />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-16 sm:px-6 sm:pb-12 lg:px-12 lg:pb-16 lg:pt-24">

          {/* Editorial headline */}
          <div className="mb-7 animate-fade-in lg:mb-10">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:mb-4 sm:text-[11px]">Private Travel Intelligence</p>
            <h1
              className="font-display mb-4 text-[clamp(2.75rem,14vw,4.75rem)] leading-[0.92] tracking-[-0.01em] text-white sm:mb-5 lg:text-[clamp(4.5rem,7vw,7rem)]"
            >
              Travel designed
              <br />
              <em>around you.</em>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/75 sm:text-base lg:text-lg">
              Bespoke journeys, curated hotels, and meaningful experiences — planned by intelligence, perfected by craft.
            </p>
          </div>

          {/* Refined search */}
          <div
            className="max-w-4xl animate-slide-up rounded-sm bg-ivory/95 px-4 py-5 shadow-[0_20px_60px_rgba(17,17,17,0.2)] backdrop-blur-xl sm:px-6 lg:px-8 lg:py-7"
          >
            {/* Tab links */}
            <div className="scrollbar-hide mb-5 flex gap-5 overflow-x-auto border-b border-stone pb-3 sm:gap-6 lg:mb-6 lg:pb-4" role="tablist" aria-label="Search type">
              {(['flights', 'hotels', 'experiences', 'journey'] as SearchTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSearchTab(t)}
                  className="relative shrink-0 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors sm:text-xs"
                  role="tab"
                  aria-selected={searchTab === t}
                  style={{
                    color: searchTab === t ? '#252525' : '#77736C',
                    borderBottom: searchTab === t ? '1.5px solid #C9A96E' : 'none',
                    paddingBottom: searchTab === t ? '3px' : undefined,
                  }}
                >
                  {t === 'journey' ? 'Journey AI' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Flights */}
            {searchTab === 'flights' && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-x-6 gap-y-4">
                  <div className="col-span-2 lg:col-span-1">
                    <label className={labelCls}>From</label>
                    <input className={inputCls} value={flightFrom} onChange={(e) => setFlightFrom(e.target.value)} placeholder="City or airport" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <label className={labelCls}>To</label>
                    <input className={inputCls} value={flightTo} onChange={(e) => setFlightTo(e.target.value)} placeholder="City or airport" />
                  </div>
                  <div>
                    <label className={labelCls}>Depart</label>
                    <input type="date" className={inputCls} value={flightDep} onChange={(e) => setFlightDep(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Return</label>
                    <input type="date" className={inputCls} value={flightRet} onChange={(e) => setFlightRet(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Travelers</label>
                    <input className={inputCls} defaultValue="2 Adults" readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Cabin</label>
                    <select className={inputCls} value={flightCabin} onChange={(e) => setFlightCabin(e.target.value)}>
                      {['Economy', 'Premium Economy', 'Business', 'First'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3">
                    {['Tokyo', 'Paris', 'Maldives', 'Dubai'].map((d) => (
                      <button
                        key={d}
                        onClick={() => { setFlightTo(d); }}
                        className="text-xs text-[#77736C] hover:text-[#252525] transition-colors"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleFlightSearch}
                    className="w-full px-6 py-3 text-sm font-semibold text-white transition-colors sm:w-auto sm:py-2.5"
                    style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}
                  >
                    Search flights
                  </button>
                </div>
              </div>
            )}

            {/* Hotels */}
            {searchTab === 'hotels' && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <div className="col-span-2 lg:col-span-1">
                    <label className={labelCls}>Destination</label>
                    <input className={inputCls} value={hotelDest} onChange={(e) => setHotelDest(e.target.value)} placeholder="City, area or hotel" />
                  </div>
                  <div>
                    <label className={labelCls}>Check-in</label>
                    <input type="date" className={inputCls} value={hotelCheckIn} onChange={(e) => setHotelCheckIn(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Check-out</label>
                    <input type="date" className={inputCls} value={hotelCheckOut} onChange={(e) => setHotelCheckOut(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Guests</label>
                    <input className={inputCls} defaultValue="2 Adults · 1 Room" readOnly />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button onClick={handleHotelSearch} className="w-full px-6 py-3 text-sm font-semibold text-white transition-colors sm:w-auto sm:py-2.5" style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}>
                    Search hotels
                  </button>
                </div>
              </div>
            )}

            {/* Experiences */}
            {searchTab === 'experiences' && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <div className="col-span-2 lg:col-span-1">
                    <label className={labelCls}>Destination</label>
                    <input className={inputCls} value={expDest} onChange={(e) => setExpDest(e.target.value)} placeholder="City or country" />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" className={inputCls} value={expDate} onChange={(e) => setExpDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Participants</label>
                    <input className={inputCls} defaultValue="2 people" readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select className={inputCls} value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                      {['Food & Culture', 'Adventure', 'Wellness', 'History', 'Nightlife'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button onClick={handleExpSearch} className="w-full px-6 py-3 text-sm font-semibold text-white transition-colors sm:w-auto sm:py-2.5" style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}>
                    Find experiences
                  </button>
                </div>
              </div>
            )}

            {/* Journey AI */}
            {searchTab === 'journey' && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-4">
                  <div className="col-span-2 lg:col-span-1">
                    <label className={labelCls}>Where to?</label>
                    <input className={inputCls} value={journeyDest} onChange={(e) => setJourneyDest(e.target.value)} placeholder="Japan, Bali, Italy…" />
                  </div>
                  <div>
                    <label className={labelCls}>When?</label>
                    <input className={inputCls} value={journeyWhen} onChange={(e) => setJourneyWhen(e.target.value)} placeholder="Month & year" />
                  </div>
                  <div>
                    <label className={labelCls}>Travelers</label>
                    <div className="flex items-center gap-3 border-b border-[#E8E4DC] py-2.5">
                      <button onClick={() => setJourneyTravelers(Math.max(1, journeyTravelers - 1))} className="text-[#77736C] hover:text-[#252525] text-base leading-none">−</button>
                      <span className="text-sm text-[#252525]">{journeyTravelers}</span>
                      <button onClick={() => setJourneyTravelers(journeyTravelers + 1)} className="text-[#77736C] hover:text-[#252525] text-base leading-none">+</button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Budget</label>
                    <select className={inputCls} value={journeyBudget} onChange={(e) => setJourneyBudget(e.target.value)}>
                      {['Under ₹1L', '₹1L–₹2.5L', '₹2.5L–₹5L', '₹5L+'].map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Style</label>
                    <select className={inputCls} value={journeyStyle} onChange={(e) => setJourneyStyle(e.target.value)}>
                      {['Relaxed', 'Balanced', 'Action-packed'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#77736C]">Journey AI will build a complete itinerary with flights, hotels and experiences.</p>
                  <button onClick={handleJourneyBuild} className="w-full shrink-0 px-6 py-3 text-sm font-semibold text-white transition-colors sm:w-auto sm:py-2.5" style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}>
                    Plan my journey
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          ACTIVE JOURNEY — continue where you left off
      ══════════════════════════════════════════════════════════ */}
      {activeJourney && (
        <section style={{ backgroundColor: '#F7F5F0' }} className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              {/* Image — 5 cols */}
              <div className="lg:col-span-5 relative overflow-hidden" style={{ borderRadius: '2px' }}>
                <img
                  src={activeJourney.imageUrl}
                  alt={activeJourney.destination}
                  className="w-full object-cover"
                  style={{ height: '460px' }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.5) 0%, transparent 60%)' }} />
                <div className="absolute bottom-6 left-6">
                  <p className="text-white/60 text-[10px] uppercase tracking-[0.15em] mb-1">
                    {activeJourney.status === 'in-travel' ? 'In travel' : activeJourney.status === 'pre-travel' ? 'Departing soon' : 'In planning'}
                  </p>
                  <p className="font-display text-white text-2xl">{activeJourney.destination}</p>
                </div>
              </div>

              {/* Details — 7 cols */}
              <div className="lg:col-span-7 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: '#C9A96E' }}>Continue your journey</p>
                <h2 className="font-display text-4xl lg:text-5xl mb-3" style={{ color: '#111111', letterSpacing: '-0.01em' }}>
                  {activeJourney.title}
                </h2>
                <p className="text-sm mb-8" style={{ color: '#77736C' }}>
                  {activeJourney.destination} · {activeJourney.startDate} – {activeJourney.endDate} · {activeJourney.travelers} traveler{activeJourney.travelers !== 1 ? 's' : ''}
                </p>

                {/* Progress */}
                {(() => {
                  const { booked, total, pct } = getJourneyProgress(activeJourney);
                  return (
                    <div className="mb-8">
                      <div className="flex justify-between text-xs mb-3" style={{ color: '#77736C' }}>
                        <span>Planning progress</span>
                        <span>{booked} of {total} items confirmed</span>
                      </div>
                      <div className="h-px overflow-hidden" style={{ backgroundColor: '#E8E4DC' }}>
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#C9A96E' }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Next to book */}
                {(() => {
                  const next = getNextUnbooked(activeJourney);
                  return next ? (
                    <div className="mb-8 py-4 border-t border-b" style={{ borderColor: '#E8E4DC' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: '#C9A96E' }}>Next to confirm</p>
                      <p className="text-sm font-medium" style={{ color: '#252525' }}>{next.title}</p>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center gap-6">
                  <button
                    onClick={() => navigate('journey', { selectedJourneyId: activeJourney.id })}
                    className="px-7 py-3 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}
                  >
                    Continue journey
                  </button>
                  <button
                    onClick={() => navigate('my-trips')}
                    className="text-sm font-medium group flex items-center gap-2 transition-colors"
                    style={{ color: '#77736C' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#252525')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#77736C')}
                  >
                    All journeys
                    <span className="arrow-nudge">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          CURATED JOURNEYS — asymmetric package cards
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#111111' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: '#C9A96E' }}>Curated Journeys</p>
              <h2 className="font-display text-white leading-tight" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', letterSpacing: '-0.01em' }}>
                Journeys worth
                <br />
                <em>travelling for.</em>
              </h2>
            </div>
          </div>

          {/* Asymmetric grid: tall left card (~55%) + two stacked right (~45%) */}
          <div className="grid lg:grid-cols-11 gap-4 lg:gap-5">

            {/* Large feature card — 6 cols */}
            {allPackages[0] && (() => {
              const p = allPackages[0];
              return (
                <div
                  className="lg:col-span-6 relative overflow-hidden group cursor-pointer"
                  style={{ height: '560px', borderRadius: '2px' }}
                  onClick={() => navigateToPackage(p.id)}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.90) 0%, rgba(17,17,17,0.1) 55%, transparent 100%)' }} />
                  {p.badge && (
                    <div className="absolute top-6 left-6">
                      <span
                        className="text-[9px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1"
                        style={{ backgroundColor: 'rgba(201,169,110,0.18)', color: '#C9A96E', borderRadius: '2px', border: '1px solid rgba(201,169,110,0.35)' }}
                      >
                        {p.badge}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 p-8">
                    <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: '#C9A96E' }}>{p.destination}</p>
                    <h3 className="font-display text-white mb-2" style={{ fontSize: '2.2rem', lineHeight: '1.1', letterSpacing: '-0.01em' }}>{p.title}</h3>
                    <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>{p.nights} nights</p>
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm">from <span className="font-semibold text-base">&#8377;{formatPackagePrice(p.pricePerPerson)}</span></p>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>per person</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Right column — 5 cols, two stacked cards */}
            <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5">
              {allPackages.slice(1, 3).map((p) => (
                <div
                  key={p.id}
                  className="relative flex-1 overflow-hidden group cursor-pointer"
                  style={{ minHeight: '268px', borderRadius: '2px' }}
                  onClick={() => navigateToPackage(p.id)}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.88) 0%, rgba(17,17,17,0.05) 60%)' }} />
                  {p.badge && (
                    <div className="absolute top-5 left-5">
                      <span
                        className="text-[9px] font-semibold uppercase tracking-[0.15em] px-2 py-0.5"
                        style={{ backgroundColor: 'rgba(201,169,110,0.18)', color: '#C9A96E', borderRadius: '2px', border: '1px solid rgba(201,169,110,0.3)' }}
                      >
                        {p.badge}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 p-6">
                    <p className="text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A96E' }}>{p.destination}</p>
                    <h3 className="font-display text-white text-xl mb-1">{p.title}</h3>
                    <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.nights} nights</p>
                    <p className="text-white text-sm">from <span className="font-semibold">&#8377;{formatPackagePrice(p.pricePerPerson)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => navigate('journeys')}
              className="px-8 py-3.5 text-sm font-semibold text-white tracking-[0.08em] uppercase transition-colors"
              style={{ backgroundColor: '#111111', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
            >
              Explore all journeys &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TRAVEL BY STYLE — typographic strip
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#F7F5F0' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-10" style={{ color: '#77736C' }}>Travel by Style</p>
          <div className="divide-y" style={{ borderTop: '1px solid #E8E4DC', borderBottom: '1px solid #E8E4DC' }}>
            {[
              'Private Escapes',
              'Honeymoons',
              'Wellness',
              'Family',
              'Adventure',
              'Celebrations',
            ].map((style) => (
              <StyleItem key={style} label={style} onNavigate={() => navigate('journeys')} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          DESTINATIONS — editorial asymmetric layout
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#111111' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: '#77736C' }}>Curated destinations</p>
              <h2 className="font-display text-white leading-tight" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', letterSpacing: '-0.01em' }}>
                Where would you go,
                <br />
                <em>if time allowed?</em>
              </h2>
            </div>
            <button
              onClick={() => navigate('explore')}
              className="hidden lg:flex items-center gap-2 text-sm group"
              style={{ color: '#77736C' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F7F5F0')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#77736C')}
            >
              Explore all
              <span className="arrow-nudge">→</span>
            </button>
          </div>

          {/* Asymmetric grid: 60/40 */}
          <div className="grid lg:grid-cols-5 gap-4 lg:gap-5">
            {/* Large feature — 3 cols */}
            <div
              className="lg:col-span-3 relative overflow-hidden group cursor-pointer"
              style={{ height: '520px', borderRadius: '2px' }}
              onClick={() => navigate('destination', { selectedDestinationId: featuredDestinations[0].id })}
            >
              <img
                src={featuredDestinations[0].image}
                alt={featuredDestinations[0].name}
                className="w-full h-full object-cover img-zoom transition-transform duration-700"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.85) 0%, rgba(17,17,17,0.1) 55%, transparent 100%)' }} />
              <div className="absolute bottom-0 left-0 p-8">
                <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: '#C9A96E' }}>{featuredDestinations[0].country}</p>
                <h3 className="font-display text-white mb-2" style={{ fontSize: '3.2rem', lineHeight: '1', letterSpacing: '-0.01em' }}>
                  {featuredDestinations[0].name}
                </h3>
                <p className="text-sm max-w-xs mb-5" style={{ color: 'rgba(255,255,255,0.65)' }}>{featuredDestinations[0].tagline}</p>
                <span className="text-xs font-medium group transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Explore destination <span className="arrow-nudge inline-block">→</span>
                </span>
              </div>
            </div>

            {/* Right column — 2 cols, 2 images stacked */}
            <div className="lg:col-span-2 flex flex-col gap-4 lg:gap-5">
              {featuredDestinations.slice(1).map((dest) => (
                <div
                  key={dest.id}
                  className="relative flex-1 overflow-hidden group cursor-pointer"
                  style={{ minHeight: '248px', borderRadius: '2px' }}
                  onClick={() => navigate('destination', { selectedDestinationId: dest.id })}
                >
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover img-zoom transition-transform duration-700"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.80) 0%, rgba(17,17,17,0.05) 60%)' }} />
                  <div className="absolute bottom-0 left-0 p-6">
                    <p className="text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A96E' }}>{dest.country}</p>
                    <h3 className="font-display text-white text-2xl">{dest.name}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 lg:hidden">
            <button onClick={() => navigate('explore')} className="text-sm" style={{ color: '#77736C' }}>
              Explore all destinations →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          JOURNEY AI — text-led editorial section
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#F7F5F0' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">

            {/* Left — editorial text */}
            <div className="lg:col-span-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-6" style={{ color: '#C9A96E' }}>Journey AI</p>
              <h2 className="font-display mb-8 leading-tight" style={{ fontSize: 'clamp(2.2rem, 3.5vw, 3.2rem)', color: '#111111', letterSpacing: '-0.01em' }}>
                A private travel strategist,
                <br />
                <em>at your service.</em>
              </h2>
              <p className="text-sm leading-relaxed mb-10" style={{ color: '#77736C', maxWidth: '38ch' }}>
                Describe your ideal journey in your own words. Journey AI composes the complete trip — flights, hotels, experiences, visa requirements — and explains every decision.
              </p>

              {/* AI quote */}
              <blockquote className="pl-5 mb-10" style={{ borderLeft: '2px solid #C9A96E' }}>
                <p className="font-display text-xl italic mb-2" style={{ color: '#252525' }}>
                  "I'd recommend Kyoto on Day 4. The slower pace gives you a better transition after three active days in Tokyo."
                </p>
                <cite className="text-xs not-italic" style={{ color: '#77736C' }}>— Journey AI, on your Japan itinerary</cite>
              </blockquote>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => { setPlannerDestination('Japan', ''); navigate('ai-planner'); }}
                  className="px-7 py-3 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#111111', borderRadius: '2px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#252525')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}
                >
                  Plan my journey
                </button>
                <button
                  onClick={() => navigate('ai-planner')}
                  className="text-sm font-medium group flex items-center gap-2"
                  style={{ color: '#77736C' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#252525')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#77736C')}
                >
                  See how it works <span className="arrow-nudge">→</span>
                </button>
              </div>
            </div>

            {/* Right — single atmospheric image */}
            <div className="lg:col-span-6 hidden lg:block">
              <div className="relative overflow-hidden" style={{ borderRadius: '2px', height: '520px' }}>
                <img
                  src="https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=700&fit=crop&auto=format"
                  alt="Japan journey"
                  className="w-full h-full object-cover"
                />
                {/* Floating intelligence card */}
                <div
                  className="absolute bottom-6 right-6 left-6 p-5"
                  style={{ background: 'rgba(247,245,240,0.92)', backdropFilter: 'blur(12px)', borderRadius: '2px' }}
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: '#C9A96E' }}>Japan · 7 nights · 2 travelers</p>
                  <div className="space-y-1.5 mb-3">
                    {[
                      'Mumbai → Tokyo (IndiGo, non-stop)',
                      'Park Hyatt Tokyo · 3 nights',
                      'Shinkansen → Kyoto',
                      'Ritz-Carlton Kyoto · 4 nights',
                    ].map((line) => (
                      <p key={line} className="text-xs" style={{ color: '#252525' }}>{line}</p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #E8E4DC' }}>
                    <span className="text-xs" style={{ color: '#77736C' }}>Estimated total</span>
                    <span className="text-sm font-semibold" style={{ color: '#111111' }}>₹2,42,800</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SERVICES — typographic, numbered, no emoji
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#252525' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20">

            {/* Left label */}
            <div className="lg:col-span-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: '#77736C' }}>What we cover</p>
              <h2 className="font-display text-white leading-tight mb-6" style={{ fontSize: 'clamp(2rem, 3vw, 2.8rem)', letterSpacing: '-0.01em' }}>
                Every part of
                <br />
                <em>your journey.</em>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#77736C', maxWidth: '28ch' }}>
                All connected, all in one place. Book individually or let Journey AI compose them into one.
              </p>
            </div>

            {/* Right: service list */}
            <div className="lg:col-span-8">
              <div className="grid sm:grid-cols-2 gap-0">
                {[
                  { num: '01', title: 'Flights', desc: 'Global inventory. Economy through First Class. Multi-city and open-jaw routing.', action: () => { setSearchQuery({ type: 'flights', travelers: 2, dates: '', destination: '' }); navigate('search'); } },
                  { num: '02', title: 'Hotels', desc: 'Independent properties, boutique stays and global chains. Curated by destination.', action: () => { setSearchQuery({ type: 'hotels', travelers: 2, dates: '', destination: '' }); navigate('search'); } },
                  { num: '03', title: 'Experiences', desc: 'Private tours, cultural immersions, culinary journeys and adventure activities.', action: () => { setSearchQuery({ type: 'experiences', travelers: 2, dates: '', destination: '' }); navigate('search'); } },
                  { num: '04', title: 'Transfers', desc: 'Airport pickups, intercity travel and private ground transport, pre-arranged.', action: () => navigate('search') },
                  { num: '05', title: 'Visa', desc: 'Eligibility checks, document guidance and application support for 190+ countries.', action: () => navigate('visa-center') },
                  { num: '06', title: 'Journey AI', desc: 'Intelligent trip planning. One conversation. A complete itinerary built for you.', action: () => navigate('ai-planner') },
                ].map((item, idx, arr) => (
                  <button
                    key={item.num}
                    onClick={item.action}
                    className="group text-left py-7 px-6 transition-colors"
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      borderRight: idx % 2 === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      borderBottom: idx >= arr.length - 2 ? 'none' : undefined,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <p className="text-[10px] font-semibold mb-3 transition-colors" style={{ color: '#C9A96E', letterSpacing: '0.1em' }}>{item.num}</p>
                    <p className="font-display text-white text-xl mb-2 group-hover:opacity-80 transition-opacity">{item.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#77736C' }}>{item.desc}</p>
                    <span className="inline-block mt-3 text-xs arrow-nudge transition-colors opacity-0 group-hover:opacity-100" style={{ color: '#C9A96E' }}>
                      Explore →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          DEALS — horizontal editorial, asymmetric
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: '#F7F5F0' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: '#77736C' }}>Limited availability</p>
              <h2 className="font-display leading-tight" style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#111111', letterSpacing: '-0.01em' }}>
                Worth reserving now.
              </h2>
            </div>
            <button
              onClick={() => navigate('deals')}
              className="hidden lg:flex items-center gap-2 text-sm"
              style={{ color: '#77736C' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#252525')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#77736C')}
            >
              All offers <span className="arrow-nudge">→</span>
            </button>
          </div>

          {/* 60/40 layout: one featured + two narrow */}
          <div className="grid lg:grid-cols-5 gap-5">
            {/* Featured deal */}
            {featuredDeals[0] && (
              <button
                onClick={() => navigate('deals')}
                className="lg:col-span-3 group text-left relative overflow-hidden"
                style={{ borderRadius: '2px', height: '400px' }}
              >
                <img
                  src={featuredDeals[0].imageUrl}
                  alt={featuredDeals[0].title}
                  className="w-full h-full object-cover img-zoom transition-transform duration-700"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.90) 0%, rgba(17,17,17,0.1) 60%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-7">
                  <p className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: '#C9A96E' }}>{featuredDeals[0].subtitle}</p>
                  <h3 className="font-display text-white text-2xl mb-4">{featuredDeals[0].title}</h3>
                  <div className="flex items-end gap-4">
                    <div>
                      <p className="text-white font-semibold text-2xl">₹{featuredDeals[0].dealPrice.toLocaleString('en-IN')}</p>
                      <p className="text-xs line-through" style={{ color: '#77736C' }}>₹{featuredDeals[0].originalPrice.toLocaleString('en-IN')}</p>
                    </div>
                    <p className="text-xs pb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Ends in {featuredDeals[0].expiresIn}</p>
                  </div>
                </div>
              </button>
            )}

            {/* Two stacked deals */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {featuredDeals.slice(1, 3).map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => navigate('deals')}
                  className="group text-left relative overflow-hidden flex-1"
                  style={{ borderRadius: '2px', minHeight: '188px' }}
                >
                  <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    className="w-full h-full object-cover img-zoom transition-transform duration-700"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.85) 0%, rgba(17,17,17,0.05) 60%)' }} />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: '#C9A96E' }}>{deal.subtitle}</p>
                    <h3 className="font-display text-white text-lg mb-2">{deal.title}</h3>
                    <p className="text-white text-sm font-semibold">₹{deal.dealPrice.toLocaleString('en-IN')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA — full-bleed, minimal
      ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-32 lg:py-40" style={{ backgroundColor: '#111111' }}>
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&h=600&fit=crop&auto=format"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.15 }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-6" style={{ color: '#77736C' }}>Travalastic</p>
          <h2
            className="font-display text-white mb-6 leading-tight"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', letterSpacing: '-0.015em' }}
          >
            Everything has already
            <br />
            <em>been taken care of.</em>
          </h2>
          <p className="text-sm mb-12 mx-auto max-w-prose" style={{ color: '#77736C', lineHeight: '1.75' }}>
            From your first search to your last day — Travalastic plans, books, monitors and manages every detail of your journey, quietly and intelligently.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('ai-planner')}
              className="px-8 py-3.5 text-sm font-semibold text-white w-full sm:w-auto"
              style={{ backgroundColor: '#C9A96E', borderRadius: '2px' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b8975d')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C9A96E')}
            >
              Begin your journey
            </button>
            <button
              onClick={() => navigate('explore')}
              className="px-8 py-3.5 text-sm font-medium w-full sm:w-auto border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: '2px' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
            >
              Explore destinations
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
