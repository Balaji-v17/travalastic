import { useState, useMemo, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { destinations, type Destination } from '../../data/mockData';

// ── Constants ────────────────────────────────────────────────────────────────

const TRAVEL_STYLES = ['Beach', 'Mountains', 'Culture', 'Food', 'Adventure', 'Wellness', 'Wildlife', 'City', 'Romantic'];

const STYLE_MAP: Record<string, string[]> = {
  Beach: ['Beach & Relaxation'],
  Mountains: ['Adventure', 'Nature'],
  Culture: ['Cultural', 'Photography'],
  Food: ['Food & Culinary'],
  Adventure: ['Adventure'],
  Wellness: ['Wellness & Spa', 'Wellness'],
  Wildlife: ['Adventure', 'Nature'],
  City: ['Urban', 'Shopping'],
  Romantic: ['Romantic'],
};

const EXPERIENCE_CATEGORIES = [
  { id: 'taste', label: 'Taste', icon: '🍜', desc: 'Food-first destinations', styles: ['Food & Culinary'] },
  { id: 'adventure', label: 'Adventure', icon: '⛰', desc: 'Thrills and the outdoors', styles: ['Adventure'] },
  { id: 'relax', label: 'Relax', icon: '🌅', desc: 'Beaches, spas and slow days', styles: ['Beach & Relaxation', 'Wellness & Spa', 'Wellness'] },
  { id: 'discover', label: 'Discover', icon: '🏛', desc: 'History, culture and wonder', styles: ['Cultural', 'Urban', 'Photography'] },
  { id: 'celebrate', label: 'Celebrate', icon: '✨', desc: 'Romance and special occasions', styles: ['Romantic', 'Shopping', 'Luxury'] },
  { id: 'reconnect', label: 'Reconnect', icon: '🌿', desc: 'Nature and mindful travel', styles: ['Wellness & Spa', 'Nature'] },
];

const TRAVELER_TYPES = [
  { id: 'solo', label: 'Solo', icon: '🎒', styles: ['Budget', 'Adventure', 'Urban', 'Cultural'] },
  { id: 'couples', label: 'Couples', icon: '💑', styles: ['Romantic', 'Beach & Relaxation', 'Luxury', 'Wellness & Spa'] },
  { id: 'family', label: 'Families', icon: '👨‍👩‍👧', styles: ['Family', 'Beach & Relaxation', 'Urban'] },
  { id: 'friends', label: 'Friends', icon: '🎉', styles: ['Adventure', 'Food & Culinary', 'Urban', 'Budget'] },
  { id: 'luxury', label: 'Luxury', icon: '💎', styles: ['Luxury', 'Romantic', 'Wellness & Spa'] },
  { id: 'budget', label: 'Budget', icon: '🪙', styles: ['Budget', 'Adventure', 'Cultural'] },
];

const REGIONS = [
  { id: 'Asia', label: 'Asia', desc: "Ancient cities, tropical islands and some of the world's best food.", img: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=600&h=400&fit=crop&auto=format' },
  { id: 'Europe', label: 'Europe', desc: 'Timeless art, café culture and landscapes that define romance.', img: 'https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=600&h=400&fit=crop&auto=format' },
  { id: 'Middle East', label: 'Middle East', desc: 'Desert luxury, golden skylines and ancient civilisations.', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop&auto=format' },
  { id: 'Indian Ocean', label: 'Indian Ocean', desc: 'Crystal lagoons, white sand and total seclusion.', img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=400&fit=crop&auto=format' },
  { id: 'Americas', label: 'Americas', desc: 'From Patagonian peaks to Caribbean shores — epic scale.', img: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=400&fit=crop&auto=format' },
  { id: 'Oceania', label: 'Oceania', desc: 'Wild coastlines, Maori culture and wine country.', img: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=600&h=400&fit=crop&auto=format' },
];

const CURRENT_MONTH = 'August';

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesStyle(dest: Destination, filterStyles: string[]): boolean {
  if (!filterStyles.length) return true;
  return filterStyles.some((fs) =>
    dest.travelStyles.some((ds) =>
      ds.toLowerCase().includes(fs.toLowerCase()) || fs.toLowerCase().includes(ds.toLowerCase())
    )
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveButton({ id, saved, onToggle }: { id: string; saved: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(id); }}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${saved ? 'bg-white border-white' : 'bg-white/80 border-white/60 hover:bg-white'}`}
      aria-label={saved ? 'Unsave destination' : 'Save destination'}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? '#C9A96E' : 'none'} stroke={saved ? '#C9A96E' : '#252525'} strokeWidth="1.5">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

interface DestCardProps {
  dest: Destination;
  saved: boolean;
  comparing: boolean;
  onNavigate: () => void;
  onPlanAI: () => void;
  onSave: (id: string) => void;
  onCompare: (dest: Destination) => void;
}

function DestCard({ dest, saved, comparing, onNavigate, onPlanAI, onSave, onCompare }: DestCardProps) {
  return (
    <div
      className={`relative overflow-hidden cursor-pointer group h-full ${comparing ? 'ring-1 ring-[#C9A96E]' : ''}`}
      style={{ borderRadius: '2px' }}
      onClick={onNavigate}
    >
      <div className="w-full h-full overflow-hidden">
        <img src={dest.imageUrl} alt={dest.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {dest.trending && (
            <span className="px-2 py-0.5 bg-white/90 text-[#252525] text-[10px] font-semibold tracking-wide uppercase">
              +{dest.demandChange}%
            </span>
          )}
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(dest); }}
            className={`px-2 py-0.5 text-xs font-medium transition-all backdrop-blur-sm border ${comparing ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white/80 text-[#252525] border-white/60 hover:bg-white'}`}
            style={{ borderRadius: '2px' }}
          >
            {comparing ? '✓' : '+'}
          </button>
          <SaveButton id={dest.id} saved={saved} onToggle={onSave} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>{dest.country}</p>
        <h3 className="font-display font-bold text-white text-lg mb-1 leading-tight">{dest.name}</h3>
        <p className="text-white/70 text-xs line-clamp-1 mb-2">{dest.tagline}</p>
        <div className="flex items-center justify-between">
          <span className="text-white/80 text-xs">From ₹{dest.budgetMin.toLocaleString()}/day</span>
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onPlanAI(); }}
              className="px-2.5 py-1 bg-[#C9A96E] hover:bg-[#b8955a] text-[#111111] text-xs font-semibold transition-colors"
              style={{ borderRadius: '2px' }}
            >
              Plan with AI
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              className="px-2.5 py-1 bg-white/90 hover:bg-white text-[#252525] text-xs font-semibold transition-colors"
              style={{ borderRadius: '2px' }}
            >
              Explore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compare bar & modal ───────────────────────────────────────────────────────

function CompareBar({ items, onRemove, onClear, onPlanAI }: {
  items: Destination[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onPlanAI: (dest: Destination) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  if (items.length === 0) return null;

  const compareRows = [
    { label: 'Budget', values: items.map((d) => `₹${d.budgetMin.toLocaleString()}–${d.budgetMax.toLocaleString()}/day`) },
    { label: 'Duration', values: items.map((d) => `${d.recommendedDays} nights`) },
    { label: 'Travel style', values: items.map((d) => d.travelStyles.slice(0, 2).join(', ')) },
    { label: 'Best season', values: items.map((d) => d.bestMonths.slice(0, 2).join(', ')) },
    { label: 'Region', values: items.map((d) => d.region) },
    { label: 'Top highlights', values: items.map((d) => d.highlights.slice(0, 1).join('')) },
  ];

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white shadow-2xl px-5 py-3 flex items-center gap-4 flex-wrap justify-center" style={{ backgroundColor: '#111111', borderRadius: '2px' }}>
        <span className="text-sm font-medium text-white/60 uppercase tracking-widest text-xs">Comparing {items.length}/3</span>
        <div className="flex gap-2 flex-wrap">
          {items.map((d) => (
            <div key={d.id} className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1" style={{ borderRadius: '2px' }}>
              <span className="text-sm font-medium">{d.name}</span>
              <button onClick={() => onRemove(d.id)} className="text-white/50 hover:text-white text-xs leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="px-3.5 py-1.5 bg-[#C9A96E] text-[#111111] text-sm font-semibold hover:bg-[#b8955a] transition-colors" style={{ borderRadius: '2px' }}>
            Compare
          </button>
          <button onClick={onClear} className="px-3 py-1.5 text-white/50 hover:text-white text-sm transition-colors">Clear</button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" style={{ backgroundColor: '#F7F5F0', borderRadius: '2px' }}>
            <div className="p-6 border-b border-[#E8E4DC] flex items-center justify-between sticky top-0" style={{ backgroundColor: '#F7F5F0' }}>
              <h2 className="text-xl font-display font-bold text-[#111111]">Destination Comparison</h2>
              <button onClick={() => setShowModal(false)} className="text-[#77736C] hover:text-[#252525] text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-[#77736C] uppercase tracking-[0.18em] pb-4 pr-6 w-28" />
                    {items.map((d) => (
                      <th key={d.id} className="pb-4 px-4 text-center">
                        <div className="w-16 h-16 overflow-hidden mx-auto mb-2" style={{ borderRadius: '2px', backgroundColor: '#E8E4DC' }}>
                          <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-base font-display font-bold text-[#111111]">{d.name}</div>
                        <div className="text-xs text-[#77736C]">{d.country}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.label} className="border-t border-[#E8E4DC]">
                      <td className="py-3 pr-6 text-[10px] font-semibold text-[#77736C] uppercase tracking-[0.18em]">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="py-3 px-4 text-sm text-[#252525] text-center">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-[#E8E4DC] flex gap-3 justify-center flex-wrap">
              {items.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setShowModal(false); onPlanAI(d); }}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#252525] text-white text-sm font-semibold transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  Plan {d.name} with Journey AI
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const { navigate, setPlannerDestination, searchQuery, setSearchQuery, savedDestinationIds, toggleSaveDestination } = useApp();

  const [searchText, setSearchText] = useState('');
  const [activeStyle, setActiveStyle] = useState<string | null>(searchQuery.travelStyle ?? null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeTravelerType, setActiveTravelerType] = useState<string | null>(null);
  const [activeExperience, setActiveExperience] = useState<string | null>(null);
  const savedIds = new Set(savedDestinationIds);
  const [compareList, setCompareList] = useState<Destination[]>([]);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const trendingRef = useRef<HTMLDivElement>(null);

  const incomingStyle = searchQuery.travelStyle;
  const incomingDest = searchQuery.destination && searchQuery.destination !== '' ? searchQuery.destination : null;

  const clearContext = () => {
    setSearchQuery({ travelStyle: undefined, destination: '' });
    setActiveStyle(null);
    setActiveRegion(null);
    setActiveTravelerType(null);
    setActiveExperience(null);
  };

  const effectiveStyles = useMemo(() => {
    if (activeStyle) return STYLE_MAP[activeStyle] ?? [];
    if (activeTravelerType) return TRAVELER_TYPES.find((t) => t.id === activeTravelerType)?.styles ?? [];
    if (activeExperience) return EXPERIENCE_CATEGORIES.find((e) => e.id === activeExperience)?.styles ?? [];
    return [] as string[];
  }, [activeStyle, activeTravelerType, activeExperience]);

  const filtered = useMemo(() => {
    let result = [...destinations];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.travelStyles.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (activeRegion) result = result.filter((d) => d.region === activeRegion);
    if (effectiveStyles.length) result = result.filter((d) => matchesStyle(d, effectiveStyles));
    if (incomingDest && !activeRegion && !effectiveStyles.length && !searchText) {
      const q = incomingDest.toLowerCase();
      const destFiltered = result.filter((d) => d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q));
      if (destFiltered.length > 0) result = destFiltered;
    }
    return result;
  }, [searchText, activeRegion, effectiveStyles, incomingDest]);

  const trending = useMemo(() => destinations.filter((d) => d.trending).sort((a, b) => b.demandChange - a.demandChange), []);
  const seasonal = useMemo(() => destinations.filter((d) => d.bestMonths.includes(CURRENT_MONTH)), []);
  const featured = filtered[featuredIdx % Math.max(filtered.length, 1)] ?? destinations[0];

  const handleNavigateDest = (dest: Destination) => navigate('destination', { selectedDestinationId: dest.id });
  const handlePlanAI = (dest: Destination) => { setPlannerDestination(dest.name, dest.id); navigate('ai-planner'); };
  const toggleSave = (id: string) => toggleSaveDestination(id);
  const toggleCompare = (dest: Destination) => setCompareList((prev) => {
    if (prev.some((d) => d.id === dest.id)) return prev.filter((d) => d.id !== dest.id);
    if (prev.length >= 3) return prev;
    return [...prev, dest];
  });

  const setStyleFilter = (style: string) => {
    setActiveStyle((prev) => prev === style ? null : style);
    setActiveTravelerType(null);
    setActiveExperience(null);
  };

  let contextLabel = 'Explore the world';
  let contextClearable = false;
  if (incomingStyle) { contextLabel = `Exploring: ${incomingStyle}`; contextClearable = true; }
  else if (incomingDest) { contextLabel = `Results for ${incomingDest}`; contextClearable = true; }
  else if (activeRegion) { contextLabel = activeRegion; contextClearable = true; }
  else if (activeStyle) { contextLabel = `Style: ${activeStyle}`; contextClearable = true; }
  else if (activeTravelerType) { const t = TRAVELER_TYPES.find((x) => x.id === activeTravelerType); contextLabel = t ? `${t.label} travel` : contextLabel; contextClearable = true; }
  else if (activeExperience) { const e = EXPERIENCE_CATEGORIES.find((x) => x.id === activeExperience); contextLabel = e ? `${e.label} experiences` : contextLabel; contextClearable = true; }


  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F5F0' }}>
      {/* ── Hero ── */}
      <div className="text-white pt-16 pb-12 px-4" style={{ backgroundColor: '#111111' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] font-medium mb-4" style={{ color: '#C9A96E' }}>Private Travel</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 leading-tight tracking-tight">
            Where will you go next?
          </h1>
          <p className="text-lg mb-8" style={{ color: '#77736C' }}>Explore places that match the way you want to travel.</p>
          <div className="relative max-w-xl mx-auto mb-8">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search destinations, regions, experiences..."
              className="w-full bg-white/8 backdrop-blur-sm border px-5 py-3.5 text-white placeholder:text-white/30 text-base focus:outline-none transition-colors"
              style={{ borderColor: '#E8E4DC33', borderRadius: '2px' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#C9A96E'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E8E4DC33'; }}
            />
            <svg className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#77736C' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {TRAVEL_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => setStyleFilter(style)}
                className="px-4 py-1.5 text-sm font-medium transition-all border"
                style={{
                  borderRadius: '2px',
                  backgroundColor: activeStyle === style ? '#F7F5F0' : 'transparent',
                  color: activeStyle === style ? '#111111' : '#F7F5F0',
                  borderColor: activeStyle === style ? '#F7F5F0' : '#77736C',
                }}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Context banner ── */}
        <div className="flex items-center justify-between py-4 border-b border-[#E8E4DC]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#252525]">{contextLabel}</span>
            {contextClearable && (
              <button onClick={clearContext} className="text-xs text-[#77736C] hover:text-[#252525] transition-colors flex items-center gap-1">
                <span>✕</span> Clear
              </button>
            )}
          </div>
          <span className="text-sm text-[#77736C] font-medium">{filtered.length} destination{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Featured Destination ── */}
        {featured && (
          <div className="mt-8 mb-10">
            <div
              className="relative overflow-hidden h-[440px] sm:h-[540px] cursor-pointer group"
              style={{ borderRadius: '2px' }}
              onClick={() => handleNavigateDest(featured)}
            >
              <img
                src={featured.heroImageUrl || featured.imageUrl}
                alt={featured.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-12">
                <div className="max-w-lg">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-2 block" style={{ color: '#C9A96E' }}>{featured.country} · {featured.region}</span>
                  <h2 className="text-4xl sm:text-5xl font-display font-bold text-white mb-2">{featured.name}</h2>
                  <p className="text-white/80 text-lg mb-4 leading-relaxed">{featured.tagline}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {featured.travelStyles.slice(0, 3).map((s) => (
                      <span key={s} className="px-3 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-medium tracking-wide">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mb-6 text-white/70 text-sm flex-wrap">
                    <span>{featured.recommendedDays} nights ideal</span>
                    <span>·</span>
                    <span>From ₹{featured.budgetMin.toLocaleString()}/day</span>
                    <span>·</span>
                    <span>Best: {featured.bestMonths.slice(0, 2).join(', ')}</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNavigateDest(featured); }}
                      className="px-6 py-2.5 bg-white text-[#111111] text-sm font-semibold hover:bg-[#F7F5F0] transition-colors"
                      style={{ borderRadius: '2px' }}
                    >
                      Explore {featured.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePlanAI(featured); }}
                      className="px-6 py-2.5 text-[#111111] text-sm font-semibold transition-colors"
                      style={{ backgroundColor: '#C9A96E', borderRadius: '2px' }}
                    >
                      Plan with Journey AI
                    </button>
                  </div>
                </div>
              </div>
              {filtered.length > 1 && (
                <div className="absolute top-6 right-6 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFeaturedIdx((i) => (i - 1 + filtered.length) % filtered.length); }}
                    className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-colors flex items-center justify-center text-lg"
                  >‹</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFeaturedIdx((i) => (i + 1) % filtered.length); }}
                    className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-colors flex items-center justify-center text-lg"
                  >›</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Discover by Region ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>Explore</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Discover by Region</h2>
            </div>
            {activeRegion && (
              <button onClick={() => setActiveRegion(null)} className="text-sm font-medium text-[#77736C] hover:text-[#252525] transition-colors">Clear region</button>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {REGIONS.map((r) => {
              const count = destinations.filter((d) => d.region === r.id).length;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRegion((prev) => prev === r.id ? null : r.id)}
                  className={`flex-none w-52 overflow-hidden relative h-36 text-left transition-all ${activeRegion === r.id ? 'ring-1 ring-[#C9A96E] ring-offset-2 ring-offset-[#F7F5F0]' : 'hover:opacity-90'}`}
                  style={{ borderRadius: '2px' }}
                >
                  <img src={r.img} alt={r.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="text-white font-display font-bold text-sm">{r.label}</div>
                    <div className="text-white/60 text-xs">{count} destinations</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Destination Results ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>
                {(activeStyle || activeRegion || activeTravelerType || activeExperience || searchText) ? 'Filtered' : 'All'}
              </p>
              <h2 className="text-xl font-display font-bold text-[#111111]">
                {(activeStyle || activeRegion || activeTravelerType || activeExperience || searchText) ? 'Filtered Destinations' : 'All Destinations'}
              </h2>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20 border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
              <p className="text-lg font-display font-semibold text-[#252525] mb-2">No destinations match these preferences.</p>
              <p className="text-[#77736C] mb-6">Try adjusting your filters, or let Journey AI find something for you.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={clearContext} className="px-5 py-2.5 border border-[#E8E4DC] text-[#252525] font-medium hover:border-[#C9A96E] transition-colors" style={{ borderRadius: '2px' }}>
                  Clear filters
                </button>
                <button onClick={() => navigate('ai-planner')} className="px-5 py-2.5 bg-[#111111] text-white font-medium hover:bg-[#252525] transition-colors" style={{ borderRadius: '2px' }}>
                  Let Journey AI find something for me
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {filtered.map((d, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const spanClass = isFirst
                  ? 'lg:col-span-2 lg:row-span-2 h-[440px] lg:h-auto'
                  : isSecond
                  ? 'lg:col-span-2 h-[220px]'
                  : 'h-[220px]';
                return (
                  <div key={d.id} className={spanClass}>
                    <DestCard dest={d} saved={savedIds.has(d.id)} comparing={compareList.some((x) => x.id === d.id)} onNavigate={() => handleNavigateDest(d)} onPlanAI={() => handlePlanAI(d)} onSave={toggleSave} onCompare={toggleCompare} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Trending Rail ── */}
        {trending.length > 0 && (
          <section className="mb-10">
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>Rising</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Trending this week</h2>
            </div>
            <div ref={trendingRef} className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
              {trending.map((dest) => (
                <div
                  key={dest.id}
                  className="flex-none w-48 overflow-hidden cursor-pointer group relative"
                  style={{ borderRadius: '2px' }}
                  onClick={() => handleNavigateDest(dest)}
                >
                  <div className="h-36 overflow-hidden" style={{ backgroundColor: '#E8E4DC' }}>
                    <img src={dest.imageUrl} alt={dest.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-0.5 bg-white/90 text-[#252525] text-[10px] font-semibold tracking-wide">+{dest.demandChange}%</span>
                  </div>
                  <div className="p-3" style={{ backgroundColor: '#F7F5F0' }}>
                    <p className="font-display font-bold text-[#111111] text-sm truncate">{dest.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] mb-1 truncate" style={{ color: '#C9A96E' }}>{dest.travelStyles[0]}</p>
                    <p className="text-xs text-[#252525]">₹{dest.budgetMin.toLocaleString()}/day</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Seasonal Discovery ── */}
        {seasonal.length > 0 && (
          <section className="mb-10">
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>{CURRENT_MONTH}</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Where to travel right now</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {seasonal.slice(0, 6).map((dest) => (
                <div
                  key={dest.id}
                  className="flex gap-4 p-4 border border-[#E8E4DC] hover:border-[#C9A96E] hover:shadow-sm transition-all cursor-pointer group"
                  style={{ backgroundColor: '#F7F5F0', borderRadius: '2px' }}
                  onClick={() => handleNavigateDest(dest)}
                >
                  <div className="w-16 h-16 overflow-hidden flex-shrink-0" style={{ borderRadius: '2px', backgroundColor: '#E8E4DC' }}>
                    <img src={dest.imageUrl} alt={dest.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div>
                        <p className="font-display font-bold text-[#111111] text-sm">{dest.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#C9A96E' }}>{dest.country}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-[#77736C] uppercase tracking-wide flex-shrink-0 pt-0.5">Best now</span>
                    </div>
                    <p className="text-xs text-[#77736C] line-clamp-1 mt-1">{dest.tagline}</p>
                    <p className="text-xs text-[#252525] mt-1">From ₹{dest.budgetMin.toLocaleString()}/day</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Traveler Type ── */}
        <section className="mb-10">
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>Preferences</p>
            <h2 className="text-xl font-display font-bold text-[#111111]">Find your kind of travel</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {TRAVELER_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setActiveTravelerType((prev) => prev === type.id ? null : type.id);
                  setActiveStyle(null);
                  setActiveExperience(null);
                }}
                className="flex flex-col items-center p-4 border-2 transition-all"
                style={{
                  borderRadius: '2px',
                  borderColor: activeTravelerType === type.id ? '#111111' : '#E8E4DC',
                  backgroundColor: activeTravelerType === type.id ? '#111111' : 'white',
                  color: activeTravelerType === type.id ? 'white' : '#252525',
                }}
              >
                <span className="text-xs font-semibold tracking-wide">{type.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Experience-Led Discovery ── */}
        <section className="mb-10">
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1" style={{ color: '#C9A96E' }}>Mood</p>
            <h2 className="text-xl font-display font-bold text-[#111111]">Choose what you want to feel.</h2>
            <p className="text-sm text-[#77736C] mt-1">Let your mood guide your destination.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {EXPERIENCE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveExperience((prev) => prev === cat.id ? null : cat.id);
                  setActiveStyle(null);
                  setActiveTravelerType(null);
                }}
                className="p-4 border-2 text-left transition-all"
                style={{
                  borderRadius: '2px',
                  borderColor: activeExperience === cat.id ? '#111111' : '#E8E4DC',
                  backgroundColor: activeExperience === cat.id ? '#111111' : 'white',
                }}
              >
                <div className={`font-display font-bold text-sm mb-1 ${activeExperience === cat.id ? 'text-white' : 'text-[#111111]'}`}>{cat.label}</div>
                <div className={`text-xs leading-tight ${activeExperience === cat.id ? 'text-white/60' : 'text-[#77736C]'}`}>{cat.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Journey AI CTA ── */}
        <section className="mb-12">
          <div className="relative overflow-hidden text-white p-8 sm:p-12" style={{ backgroundColor: '#111111', borderRadius: '2px' }}>
            <div className="max-w-2xl relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 flex items-center justify-center border border-white/20">
                  <span className="text-white text-xs font-bold">J</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#C9A96E' }}>Journey AI</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-3">Not sure where to go?</h2>
              <p className="text-lg mb-6" style={{ color: '#77736C' }}>
                Tell Journey AI how you want to travel — your pace, interests and budget. We will build a complete itinerary with real flights, hotels and experiences.
              </p>
              <button
                onClick={() => navigate('ai-planner')}
                className="px-7 py-3 font-semibold text-base transition-colors"
                style={{ backgroundColor: '#C9A96E', color: '#111111', borderRadius: '2px' }}
              >
                Build my journey
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Compare Bar ── */}
      <CompareBar
        items={compareList}
        onRemove={(id) => setCompareList((prev) => prev.filter((d) => d.id !== id))}
        onClear={() => setCompareList([])}
        onPlanAI={handlePlanAI}
      />
    </div>
  );
}
