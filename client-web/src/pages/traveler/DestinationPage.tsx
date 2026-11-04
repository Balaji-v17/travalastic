import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { destinations, hotels, activities } from '../../data/mockData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function inferCurrency(region: string): string {
  if (region === 'Europe') return 'EUR (€)';
  if (region === 'Middle East') return 'AED / Local';
  if (region === 'Americas') return 'USD ($)';
  if (region === 'Oceania') return 'AUD ($)';
  return 'Local currency';
}

function inferLanguage(country: string): string {
  const map: Record<string, string> = {
    Japan: 'Japanese',
    Indonesia: 'Indonesian / Balinese',
    Singapore: 'English, Mandarin, Malay',
    Thailand: 'Thai',
    France: 'French',
    Italy: 'Italian',
    Greece: 'Greek',
    UAE: 'Arabic / English',
    Maldives: 'Dhivehi / English',
    'Sri Lanka': 'Sinhala / Tamil',
    India: 'Hindi / English',
    Australia: 'English',
    USA: 'English',
    Morocco: 'Arabic / French',
  };
  return map[country] || 'Local language / English';
}

function inferTimezone(region: string, country: string): string {
  if (country === 'Japan') return 'JST (UTC+9)';
  if (country === 'Indonesia') return 'WITA (UTC+8)';
  if (country === 'Singapore') return 'SGT (UTC+8)';
  if (country === 'Thailand') return 'ICT (UTC+7)';
  if (country === 'Maldives') return 'MVT (UTC+5)';
  if (country === 'Sri Lanka') return 'IST (UTC+5:30)';
  if (region === 'Europe') return 'CET (UTC+1/+2)';
  if (region === 'Middle East') return 'GST (UTC+4)';
  if (region === 'Americas') return 'EST/PST';
  if (region === 'Oceania') return 'AEST (UTC+10)';
  return 'UTC+5 to UTC+9';
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
    </span>
  );
}

export default function DestinationPage() {
  const {
    selectedDestinationId,
    navigate,
    setPlannerDestination,
    setSearchQuery,
    navigateToHotel,
    navigateToExperience,
    journeys,
  } = useApp();

  const [saved, setSaved] = useState(false);

  const dest = destinations.find((d) => d.id === selectedDestinationId) || destinations[0];
  const destHotels = hotels.filter((h) => h.destinationId === dest.id);
  const destActivities = activities.filter((a) => a.destinationId === dest.id);
  const similarDests = destinations.filter((d) => d.region === dest.region && d.id !== dest.id).slice(0, 4);

  const activeJourney = journeys.find(
    (j) => j.destination === dest.name || (j as any).destinationId === dest.id
  );

  // Hotel labels
  const sortedByRating = [...destHotels].sort((a, b) => b.rating - a.rating);
  const sortedByPrice = [...destHotels].sort((a, b) => a.pricePerNight - b.pricePerNight);
  const bestOverallId = sortedByRating[0]?.id;
  const bestValueId = sortedByPrice[0]?.id;
  const mostLuxuryId = destHotels.find((h) => h.stars >= 5)?.id;

  function getHotelLabel(hotelId: string): string | null {
    if (hotelId === bestOverallId) return 'Best overall';
    if (hotelId === bestValueId) return 'Best value';
    if (hotelId === mostLuxuryId) return 'Most luxury';
    return null;
  }

  // Sample journeys
  const journeyTemplates = [
    {
      title: `5-Day Essentials`,
      duration: '5 days',
      budget: `₹${(dest.budgetMin * 5).toLocaleString()}`,
      highlights: dest.highlights.slice(0, 2),
    },
    {
      title: `7-Day Extended`,
      duration: '7 days',
      budget: `₹${(dest.budgetMin * 7).toLocaleString()}`,
      highlights: dest.highlights.slice(0, 3),
    },
    {
      title: `10-Day Explorer`,
      duration: '10 days',
      budget: `₹${(dest.budgetMin * 9).toLocaleString()}`,
      highlights: [...dest.highlights],
    },
  ];

  // Day-by-day preview
  const areas = dest.areas || [];
  const dayPreviews = [
    { day: 'Day 1', label: 'Arrival & Orientation', area: areas[0] || '' },
    { day: 'Day 2', label: 'Deep Exploration', area: [areas[1], areas[2]].filter(Boolean).join(' + ') },
    { day: 'Day 3', label: 'Hidden Gems', area: [areas[3], areas[4]].filter(Boolean).join(' + ') },
  ];

  // Travel style scores — first 2 styles get 5 stars, rest get 3–4
  const styleScores = dest.travelStyles.map((s, i) => ({
    style: s,
    stars: i < 2 ? 5 : i < 4 ? 4 : 3,
  }));

  function goToAiPlanner() {
    setPlannerDestination(dest.name, dest.id);
    navigate('ai-planner');
  }

  function goToHotelSearch() {
    setSearchQuery({ destination: dest.name, destinationId: dest.id, type: 'hotels' });
    navigate('search');
  }

  function goToExperienceSearch() {
    setSearchQuery({ destination: dest.name, destinationId: dest.id, type: 'experiences' });
    navigate('search');
  }

  const highlightActivity = destActivities[0];

  return (
    <div className="bg-white min-h-screen">
      {/* Back nav */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate('explore')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/30 backdrop-blur-sm text-white text-sm font-medium rounded-full hover:bg-black/50 transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Active journey banner */}
      {activeJourney && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-emerald-800 text-sm font-medium">
            {"You're already planning"} <span className="font-semibold">{dest.name}</span>.
          </p>
          <button
            onClick={() => navigate('journey', { selectedJourneyId: activeJourney.id })}
            className="text-sm px-3 py-1 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition-colors flex-shrink-0"
          >
            Open Journey
          </button>
        </div>
      )}

      {/* ── CINEMATIC HERO ── */}
      <div className="relative h-[500px] sm:h-[600px] overflow-hidden">
        <img
          src={dest.heroImageUrl}
          alt={dest.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Heart save */}
        <button
          onClick={() => setSaved(!saved)}
          className="absolute top-14 right-4 sm:top-6 sm:right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
          aria-label="Save destination"
        >
          <span className={`text-xl ${saved ? 'text-red-400' : 'text-white/70'}`}>{saved ? '♥' : '♡'}</span>
        </button>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-8 max-w-[1400px] mx-auto">
          <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-2">
            {dest.region} · {dest.country}
          </p>
          <h1 className="font-display text-5xl sm:text-7xl text-white leading-tight mb-3">
            {dest.name}
          </h1>
          <p className="text-white/75 text-base sm:text-lg max-w-xl mb-2 leading-relaxed">
            {dest.tagline}
          </p>

          {/* Rating + meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <span className="text-amber-400">★</span>
              <span className="text-white font-semibold">4.8</span>
              <span>destination rating</span>
            </span>
            <span>·</span>
            <span>Best: {dest.bestMonths.slice(0, 3).join(', ')}</span>
            <span>·</span>
            <span>{dest.recommendedDays}+ days recommended</span>
            <span>·</span>
            <span>From ₹{dest.budgetMin.toLocaleString()}/day</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={goToAiPlanner}
              className="px-5 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              ✦ Plan with Journey AI
            </button>
            <button
              onClick={goToHotelSearch}
              className="px-5 py-2.5 bg-white/15 backdrop-blur-sm text-white text-sm font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-colors"
            >
              Explore stays
            </button>
            <button
              onClick={goToExperienceSearch}
              className="px-5 py-2.5 bg-white/15 backdrop-blur-sm text-white text-sm font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-colors"
            >
              Explore experiences
            </button>
          </div>
        </div>
      </div>

      {/* ── DESTINATION SNAPSHOT STRIP ── */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 divide-x divide-white/10">
            {[
              { label: 'Best for', value: dest.travelStyles.slice(0, 2).join(', ') },
              { label: 'Ideal duration', value: `${dest.recommendedDays}–${dest.recommendedDays + 3} days` },
              { label: 'Daily budget', value: `₹${dest.budgetMin.toLocaleString()}–${dest.budgetMax.toLocaleString()}` },
              { label: 'Best season', value: dest.bestMonths.slice(0, 2).join(' · ') },
              { label: 'Travel difficulty', value: dest.budgetMin > 6000 ? 'Moderate' : 'Easy' },
              { label: 'Flight time', value: '~7–14 hrs from Mumbai' },
            ].map((item, i) => (
              <div key={item.label} className={`${i > 0 ? 'pl-6' : ''} min-w-0`}>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-white text-sm font-semibold leading-snug">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHY VISIT ── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Why visit</p>
        <h2 className="font-display text-4xl sm:text-5xl text-slate-900 mb-10 max-w-lg leading-tight">
          What makes {dest.name} unforgettable
        </h2>

        {dest.highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Large card for first highlight */}
            <div className="lg:row-span-2 relative rounded-3xl overflow-hidden bg-slate-900 min-h-[300px] flex items-end">
              <img
                src={dest.heroImageUrl}
                alt={dest.highlights[0]}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              <div className="relative z-10 p-6">
                <span className="text-3xl mb-3 block">✦</span>
                <p className="font-display text-2xl text-white leading-snug">{dest.highlights[0]}</p>
              </div>
            </div>

            {/* Remaining highlights */}
            {dest.highlights.slice(1, 4).map((h, i) => (
              <div
                key={h}
                className={`rounded-3xl p-7 flex flex-col justify-between min-h-[140px] ${
                  i === 0
                    ? 'bg-blue-600 text-white'
                    : i === 1
                    ? 'bg-slate-100 text-slate-900'
                    : 'bg-amber-50 text-slate-900 border border-amber-100'
                }`}
              >
                <span className="text-2xl mb-4">{i === 0 ? '◈' : i === 1 ? '◉' : '◎'}</span>
                <p className={`font-display text-xl leading-snug ${i === 0 ? 'text-white' : 'text-slate-900'}`}>{h}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── JOURNEY AI CTA ── */}
      <section className="bg-slate-950 mx-4 sm:mx-8 rounded-3xl overflow-hidden mb-16 max-w-[1400px] lg:mx-auto">
        <div className="px-8 py-12 sm:px-14 sm:py-16 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div>
            <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">Journey AI</p>
            <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight max-w-md">
              Let Journey AI build {dest.name} around you.
            </h2>
            <p className="text-white/50 mt-3 text-sm max-w-sm leading-relaxed">
              Tell us your dates, budget and travel style. {"We'll"} craft every day — hotels, experiences, logistics — in seconds.
            </p>
          </div>
          <button
            onClick={goToAiPlanner}
            className="flex-shrink-0 px-8 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-500 transition-colors text-sm"
          >
            Build my {dest.name} journey →
          </button>
        </div>
      </section>

      {/* ── WHERE TO STAY ── */}
      {destHotels.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 mb-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Where to stay</p>
              <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Curated stays</h2>
            </div>
            <button
              onClick={goToHotelSearch}
              className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors"
            >
              View all stays →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destHotels.slice(0, 6).map((h) => {
              const label = getHotelLabel(h.id);
              return (
                <div
                  key={h.id}
                  onClick={() => navigateToHotel(h.id)}
                  className="group bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer hover:shadow-lg hover:border-slate-200 transition-all"
                >
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={h.imageUrl}
                      alt={h.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {label && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-white text-slate-800 text-xs font-bold rounded-full shadow-sm">
                        {label}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">{h.name}</h3>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <span className="text-amber-400 text-xs">★</span>
                        <span className="text-xs font-bold text-slate-700">{h.rating}</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-xs mb-3">{h.location || h.category} · {'★'.repeat(Math.min(h.stars, 5))}</p>
                    {h.amenities && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {h.amenities.slice(0, 3).map((a: string) => (
                          <span key={a} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs rounded-full border border-slate-100">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">₹{h.pricePerNight.toLocaleString()}</span>
                        <span className="text-slate-400 text-xs"> / night</span>
                      </div>
                      <span className="text-xs text-blue-600 font-semibold group-hover:underline">View hotel →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── THINGS WORTH DOING ── */}
      {destActivities.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-8 mb-16">
          <div className="mb-8">
            <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Experiences</p>
            <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Things worth doing</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {destActivities.slice(0, 8).map((a) => (
              <div
                key={a.id}
                onClick={() => navigateToExperience(a.id)}
                className="group cursor-pointer"
              >
                <div className="relative h-52 rounded-2xl overflow-hidden bg-slate-100 mb-3">
                  <img
                    src={a.imageUrl}
                    alt={a.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-semibold rounded-full">
                      {a.category}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 group-hover:text-blue-600 transition-colors">
                  {a.name}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-amber-400">★</span>
                    <span className="font-semibold text-slate-700">{a.rating}</span>
                    <span>· {a.duration}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">₹{a.price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── EXPERIENCE HIGHLIGHT ── */}
      {highlightActivity && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-8 mb-16">
          <div
            className="relative rounded-3xl overflow-hidden min-h-[340px] flex items-end cursor-pointer group"
            onClick={() => navigateToExperience(highlightActivity.id)}
          >
            <img
              src={highlightActivity.imageUrl}
              alt={highlightActivity.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative z-10 p-8 sm:p-12 max-w-2xl">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">Featured experience</p>
              <h3 className="font-display text-3xl sm:text-4xl text-white leading-tight mb-3">
                {highlightActivity.name}
              </h3>
              <div className="flex items-center gap-4 text-white/60 text-sm mb-6">
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">★</span>
                  <span className="text-white font-semibold">{highlightActivity.rating}</span>
                  <span>({highlightActivity.reviewCount?.toLocaleString()})</span>
                </span>
                <span>·</span>
                <span>{highlightActivity.duration}</span>
                <span>·</span>
                <span>₹{highlightActivity.price.toLocaleString()}/person</span>
              </div>
              <span className="inline-flex px-5 py-2.5 bg-white text-slate-900 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors">
                Explore experience →
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── SAMPLE JOURNEYS ── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 mb-16">
        <div className="mb-8">
          <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Ready-made plans</p>
          <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Sample journeys</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {journeyTemplates.map((j) => (
            <div key={j.title} className="border border-slate-200 rounded-2xl p-6 hover:border-blue-200 hover:shadow-md transition-all">
              <h3 className="font-display text-xl text-slate-900 mb-1">{j.title}</h3>
              <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                <span>{j.duration}</span>
                <span>·</span>
                <span>From {j.budget}</span>
              </div>
              <ul className="space-y-1.5 mb-6">
                {j.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">◆</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={goToAiPlanner}
                className="w-full py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors"
              >
                Build with Journey AI
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── DAY-BY-DAY PREVIEW ── */}
      {areas.length > 0 && (
        <section className="bg-slate-50 py-16 mb-0">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="mb-8">
              <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Sample itinerary</p>
              <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Day-by-day preview</h2>
            </div>
            <div className="space-y-0">
              {dayPreviews.map((d, i) => (
                <div
                  key={d.day}
                  className={`flex flex-col sm:flex-row items-start gap-4 sm:gap-8 py-6 ${
                    i < dayPreviews.length - 1 ? 'border-b border-slate-200' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-20">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{d.day}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-0.5">{d.label}</h3>
                    <p className="text-slate-500 text-sm">{d.area}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-500">
                      {dest.popularFor[i] || 'Local exploration'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <button
                onClick={goToAiPlanner}
                className="px-6 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors"
              >
                Build full itinerary with Journey AI →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── LOCAL INSIGHT ── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 mb-0">
        <div className="mb-8">
          <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Know before you go</p>
          <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Local insight</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: '✈',
              title: 'Getting around',
              body: dest.travelTips?.[0] || `${dest.name} has efficient public transport and taxis. Pre-book transfers from the airport for ease.`,
            },
            {
              icon: '₹',
              title: 'Currency',
              body: inferCurrency(dest.region),
            },
            {
              icon: '◎',
              title: 'Language',
              body: inferLanguage(dest.country),
            },
            {
              icon: '◷',
              title: 'Time zone',
              body: inferTimezone(dest.region, dest.country),
            },
          ].map((item) => (
            <div key={item.title} className="bg-slate-50 rounded-2xl p-6">
              <span className="text-2xl mb-3 block">{item.icon}</span>
              <h3 className="font-semibold text-slate-900 text-sm mb-2">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors">
            Check visa requirements →
          </button>
        </div>
      </section>

      {/* ── BEST TIME TO VISIT ── */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="mb-8">
            <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Timing your trip</p>
            <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Best time to visit</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {MONTHS.map((m, i) => {
              const isBest = dest.bestMonths.some(
                (bm) => bm.toLowerCase().startsWith(m.toLowerCase()) || MONTH_FULL[i].toLowerCase() === bm.toLowerCase()
              );
              return (
                <div
                  key={m}
                  className={`rounded-xl p-3 text-center ${
                    isBest
                      ? 'bg-emerald-100 border-2 border-emerald-400'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  <p className={`text-xs font-bold ${isBest ? 'text-emerald-700' : 'text-slate-400'}`}>{m}</p>
                  {isBest && <p className="text-emerald-500 text-xs mt-1">✓</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-slate-500 text-sm">
            Green months are the best time to visit {dest.name}.
          </p>
        </div>
      </section>

      {/* ── TRAVEL STYLE MATCH ── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16">
        <div className="mb-8">
          <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Who loves it here</p>
          <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Travel style match</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {styleScores.map(({ style, stars }) => (
            <div key={style} className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-4">
              <span className="font-medium text-slate-800 text-sm">{style}</span>
              <StarRating rating={stars} />
            </div>
          ))}
        </div>
      </section>

      {/* ── SIMILAR DESTINATIONS ── */}
      {similarDests.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
            <div className="mb-8">
              <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-2">Keep exploring</p>
              <h2 className="font-display text-4xl sm:text-5xl text-slate-900">Similar destinations</h2>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4">
              {similarDests.map((d) => (
                <div
                  key={d.id}
                  onClick={() => navigate('destination', { selectedDestinationId: d.id })}
                  className="flex-shrink-0 w-64 sm:w-auto group cursor-pointer"
                >
                  <div className="relative h-48 rounded-2xl overflow-hidden bg-slate-200 mb-3">
                    <img
                      src={d.heroImageUrl}
                      alt={d.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white font-display text-lg leading-tight">{d.name}</p>
                      <p className="text-white/60 text-xs">{d.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-slate-500">{d.travelStyles.slice(0, 2).join(' · ')}</span>
                    <span className="text-xs font-bold text-slate-700">₹{d.budgetMin.toLocaleString()}/day</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom padding */}
      <div className="h-16" />
    </div>
  );
}
