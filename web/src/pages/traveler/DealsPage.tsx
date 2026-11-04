import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { destinations, deals, type Deal } from '../../data/mockData';

type DealCategory = 'all' | 'flights' | 'hotels' | 'packages' | 'experiences';

const categoryFilters: { key: DealCategory; label: string }[] = [
  { key: 'all', label: 'All Deals' },
  { key: 'flights', label: 'Flights' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'experiences', label: 'Experiences' },
];

export default function DealsPage() {
  const { startBookingFlow, navigateToHotel, navigateToExperience, navigate, setPlannerDestination } = useApp();
  const [category, setCategory] = useState<DealCategory>('all');

  const filteredDeals = deals.filter((d) => {
    if (category === 'all') return true;
    if (category === 'flights') return d.type === 'flight';
    if (category === 'hotels') return d.type === 'hotel';
    if (category === 'experiences') return d.type === 'activity';
    return true;
  });

  const handleBook = (deal: Deal) => {
    if (deal.type === 'hotel') {
      navigateToHotel(deal.itemId);
    } else if (deal.type === 'activity') {
      navigateToExperience(deal.itemId);
    } else {
      startBookingFlow({ type: 'flight', itemId: deal.itemId, destinationId: deal.destinationId, source: 'deals' });
    }
  };

  const handleExplore = (destinationId: string) => {
    navigate('destination', { selectedDestinationId: destinationId });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-500 text-lg">🏷️</span>
          <span className="text-amber-600 text-sm font-semibold">Limited-time offers</span>
        </div>
        <h1 className="font-display text-3xl text-slate-900 mb-2">Deals worth booking now</h1>
        <p className="text-slate-500 text-sm">Prices drop, dates fill. Every deal here links to a real booking.</p>
      </div>

      {/* Hero deal */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-slate-900 min-h-[220px]">
        <img
          src="https://images.unsplash.com/photo-1654593777128-d187ed9820e5?w=1600&h=600&fit=crop&auto=format"
          alt="Maldives deal"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/50 to-transparent" />
        <div className="relative px-8 py-10 max-w-lg">
          <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full mb-3 uppercase tracking-wide">
            Staff pick — 28% off
          </span>
          <h2 className="font-display text-2xl sm:text-3xl text-white mb-1">Maldives Overwater Retreat</h2>
          <p className="text-white/70 text-sm mb-4">Soneva Jani · 7 nights · Private overwater villa · All-inclusive</p>
          <div className="flex items-center gap-4 mb-5">
            <div>
              <p className="text-white/50 text-xs line-through">₹2,20,000/night</p>
              <p className="text-white text-2xl font-bold">₹1,58,000<span className="text-sm font-normal text-white/60">/night</span></p>
            </div>
            <span className="text-emerald-400 text-sm font-bold">Save ₹62,000</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => startBookingFlow({ type: 'hotel', itemId: 'ht-014', destinationId: 'maldives' })}
              className="px-5 py-2.5 bg-white text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors"
            >
              Book Now
            </button>
            <button
              onClick={() => handleExplore('maldives')}
              className="px-5 py-2.5 bg-white/10 text-white text-sm font-medium rounded-xl hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              View Destination
            </button>
          </div>
        </div>
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl animate-pulse">
          ⏰ Expires in 18h 44m
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {categoryFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setCategory(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
              category === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:border-blue-300 bg-white'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-60">
              ({f.key === 'all' ? deals.length : deals.filter(d => (f.key === 'flights' ? d.type === 'flight' : f.key === 'hotels' ? d.type === 'hotel' : d.type === 'activity')).length})
            </span>
          </button>
        ))}
      </div>

      {/* Deals grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDeals.map((deal) => (
          <div key={deal.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group">
            <div className="relative h-44 bg-slate-100 overflow-hidden">
              <img
                src={deal.imageUrl}
                alt={deal.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                <span className={`px-2.5 py-1 ${deal.badgeColor} text-white text-xs font-bold rounded-lg`}>
                  {deal.badge}
                </span>
              </div>
              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium rounded-lg">
                ⏰ {deal.expiresIn}
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1 capitalize">{deal.type}</p>
              <h3 className="font-semibold text-slate-900 text-base mb-0.5">{deal.title}</h3>
              <p className="text-slate-500 text-xs">{deal.subtitle}</p>

              <div className="flex items-end justify-between mt-4">
                <div>
                  <p className="text-slate-400 text-xs line-through">₹{deal.originalPrice.toLocaleString()}</p>
                  <p className="text-slate-900 text-xl font-bold">₹{deal.dealPrice.toLocaleString()}</p>
                  <p className="text-emerald-600 text-xs font-semibold">{Math.round((1 - deal.dealPrice / deal.originalPrice) * 100)}% off</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleBook(deal)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Book Deal
                  </button>
                  <button
                    onClick={() => handleExplore(deal.destinationId)}
                    className="px-4 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Explore →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Destination deals banner */}
      <div className="mt-10">
        <h2 className="font-display text-xl text-slate-900 mb-4">Plan trips around these deals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {destinations.map((dest) => (
            <button
              key={dest.id}
              onClick={() => {
                setPlannerDestination(dest.name, dest.id);
                navigate('ai-planner');
              }}
              className="relative rounded-xl overflow-hidden aspect-square group"
            >
              <img src={dest.imageUrl} alt={dest.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-white text-xs font-semibold leading-tight">{dest.name}</p>
                <p className="text-white/60 text-[10px]">Plan with AI ✨</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
