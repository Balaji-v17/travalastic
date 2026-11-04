import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import {
  allPackages,
  indiaPackages,
  internationalPackages,
  travelCollections,
  formatPackagePrice,
  type LuxuryPackage,
  type PackageCategory,
} from '@/data/packagesData';

type FilterTab = 'all' | 'india' | 'international' | PackageCategory;

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'India', value: 'india' },
  { label: 'International', value: 'international' },
  { label: 'Honeymoon', value: 'honeymoon' },
  { label: 'Private', value: 'private' },
  { label: 'Wellness', value: 'wellness' },
  { label: 'Family', value: 'family' },
  { label: 'Adventure', value: 'adventure' },
];

function filterPackages(tab: FilterTab): LuxuryPackage[] {
  if (tab === 'all') return allPackages;
  if (tab === 'india') return indiaPackages;
  if (tab === 'international') return internationalPackages;
  return allPackages.filter((p) => p.categories.includes(tab as PackageCategory));
}

interface PackageCardProps {
  pkg: LuxuryPackage;
  large?: boolean;
}

function PackageCard({ pkg, large }: PackageCardProps) {
  const { navigateToPackage } = useApp();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigateToPackage(pkg.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: '2px', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
      className={large ? 'h-[520px]' : 'h-[320px]'}
    >
      {/* Image */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={pkg.imageUrl}
          alt={pkg.title}
          className="w-full h-full object-cover transition-transform duration-700"
          style={{ transform: hovered ? 'scale(1.06)' : 'scale(1)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)',
          }}
        />
      </div>

      {/* Badge */}
      {pkg.badge && (
        <div
          className="absolute top-4 left-4 px-2 py-1 text-xs tracking-widest uppercase font-sans"
          style={{ backgroundColor: '#C9A96E', color: '#111111', borderRadius: '2px' }}
        >
          {pkg.badge}
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-xs tracking-widest uppercase mb-1 font-sans" style={{ color: '#C9A96E' }}>
          {pkg.destination}
        </p>
        <h3
          className="font-display text-white mb-1"
          style={{ fontSize: large ? 'clamp(1.4rem, 2.5vw, 2rem)' : '1.15rem', lineHeight: 1.15 }}
        >
          {pkg.title}
        </h3>
        <p className="text-sm font-sans mb-3" style={{ color: 'rgba(255,255,255,0.72)' }}>
          {pkg.nights}N · {pkg.travelStyle}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-sans" style={{ color: 'rgba(255,255,255,0.85)' }}>
            from{' '}
            <span className="font-semibold text-white">
              &#8377;{formatPackagePrice(pkg.pricePerPerson)}
            </span>{' '}
            / person
          </span>
          <span
            className="text-xs tracking-widest uppercase font-sans"
            style={{ color: '#C9A96E', opacity: hovered ? 1 : 0, transition: 'opacity 0.3s' }}
          >
            View Journey &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}

function HorizontalPackageCard({ pkg }: { pkg: LuxuryPackage }) {
  const { navigateToPackage } = useApp();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigateToPackage(pkg.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '2px',
        cursor: 'pointer',
        flexShrink: 0,
        width: '280px',
        overflow: 'hidden',
        position: 'relative',
        height: '360px',
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={pkg.imageUrl}
          alt={pkg.title}
          className="w-full h-full object-cover transition-transform duration-700"
          style={{ transform: hovered ? 'scale(1.06)' : 'scale(1)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
          }}
        />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-xs tracking-widest uppercase mb-1 font-sans" style={{ color: '#C9A96E' }}>
          {pkg.destination}
        </p>
        <h4 className="font-display text-white mb-1 text-base leading-tight">{pkg.title}</h4>
        <p className="text-xs font-sans mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {pkg.nights}N · {pkg.travelStyle}
        </p>
        <span className="text-xs font-sans text-white">
          &#8377;{formatPackagePrice(pkg.pricePerPerson)} / person
        </span>
      </div>
    </div>
  );
}

function CollectionTile({ collection }: { collection: typeof travelCollections[0] }) {
  const { navigate } = useApp();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigate('journeys')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: '2px', cursor: 'pointer', overflow: 'hidden', position: 'relative', height: '320px' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={collection.imageUrl}
          alt={collection.title}
          className="w-full h-full object-cover transition-transform duration-700"
          style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: hovered
              ? 'rgba(0,0,0,0.55)'
              : 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
            transition: 'background 0.4s',
          }}
        />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h4
          className="font-display text-white mb-1"
          style={{ fontSize: '1.3rem', lineHeight: 1.2 }}
        >
          {collection.title}
        </h4>
        <p
          className="text-sm font-sans transition-opacity duration-300"
          style={{ color: 'rgba(255,255,255,0.75)', opacity: hovered ? 1 : 0 }}
        >
          {collection.tagline}
        </p>
      </div>
    </div>
  );
}

export default function JourneysPage() {
  const { navigate } = useApp();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const filtered = filterPackages(activeTab);
  const featured = filtered[0];
  const rest = filtered.slice(1, 5);

  return (
    <div style={{ backgroundColor: '#F7F5F0', minHeight: '100vh' }}>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col justify-end"
        style={{ backgroundColor: '#111111', minHeight: '65vh', paddingBottom: '4rem' }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse at 70% 40%, rgba(201,169,110,0.07) 0%, transparent 65%)' }}
        />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-12 pt-24">
          <p
            className="text-xs tracking-widest uppercase font-sans mb-6"
            style={{ color: '#C9A96E', letterSpacing: '0.2em' }}
          >
            Travalastic &mdash; Curated Journeys
          </p>
          <h1
            className="font-display text-white"
            style={{ fontSize: 'clamp(2.8rem, 6vw, 5.2rem)', lineHeight: 1.05, maxWidth: '700px' }}
          >
            Journeys worth<br />travelling for.
          </h1>
          {/* Champagne rule */}
          <div style={{ width: '64px', height: '2px', backgroundColor: '#C9A96E', margin: '2rem 0' }} />
          <p className="font-sans text-lg" style={{ color: 'rgba(255,255,255,0.58)', maxWidth: '480px', lineHeight: 1.6 }}>
            Private, thoughtfully curated travel experiences designed for those who seek depth over distance.
          </p>
        </div>
      </section>

      {/* ─── Category Tabs ────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#F7F5F0', borderBottom: '1px solid rgba(37,37,37,0.1)' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="font-sans text-sm whitespace-nowrap px-4 py-4 transition-colors duration-200"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #C9A96E' : '2px solid transparent',
                    color: isActive ? '#111111' : '#77736C',
                    cursor: 'pointer',
                    fontWeight: isActive ? '500' : '400',
                    outline: 'none',
                    paddingLeft: tab.value === 'all' ? 0 : '1rem',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Featured Package Grid ────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-14">
        {filtered.length === 0 ? (
          <p className="font-sans text-center py-20" style={{ color: '#77736C' }}>
            No journeys found for this category.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="font-display" style={{ fontSize: '1.75rem', color: '#252525' }}>
                {activeTab === 'all'
                  ? 'All Journeys'
                  : TABS.find((t) => t.value === activeTab)?.label + ' Journeys'}
              </h2>
              <span className="font-sans text-sm" style={{ color: '#77736C' }}>
                {filtered.length} journeys
              </span>
            </div>

            {/* Asymmetric grid */}
            {featured && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                {/* Large feature — 3/5 */}
                <div className="lg:col-span-3">
                  <PackageCard pkg={featured} large />
                </div>

                {/* Right column — 2/5 */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  {rest.slice(0, 2).map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              </div>
            )}

            {/* Remaining packages: 3-column grid */}
            {rest.length > 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {rest.slice(2).map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            )}

            {/* More packages beyond initial 5 */}
            {filtered.length > 5 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {filtered.slice(5).map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── India Collection Strip ───────────────────────────────────────── */}
      <section style={{ backgroundColor: '#111111', padding: '5rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
                India Collection
              </p>
              <h2
                className="font-display text-white"
                style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', lineHeight: 1.1 }}
              >
                India, beautifully<br />experienced.
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('india')}
              className="hidden lg:block font-sans text-sm"
              style={{
                background: 'none',
                border: '1px solid rgba(201,169,110,0.4)',
                color: '#C9A96E',
                padding: '0.6rem 1.4rem',
                borderRadius: '2px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              View all India journeys
            </button>
          </div>

          {/* Horizontal scroll strip */}
          <div
            className="flex gap-4 overflow-x-auto pb-3"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {indiaPackages.map((pkg) => (
              <div key={pkg.id} style={{ scrollSnapAlign: 'start' }}>
                <HorizontalPackageCard pkg={pkg} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Travel by Style ──────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#F7F5F0', padding: '5rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              Travel by Style
            </p>
            <h2
              className="font-display"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', color: '#252525', lineHeight: 1.1 }}
            >
              Find your kind of journey.
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {travelCollections.map((col) => (
              <CollectionTile key={col.id} collection={col} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── International Strip ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#111111', padding: '5rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
                International
              </p>
              <h2
                className="font-display text-white"
                style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', lineHeight: 1.1 }}
              >
                Go further.
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('international')}
              className="hidden lg:block font-sans text-sm"
              style={{
                background: 'none',
                border: '1px solid rgba(201,169,110,0.4)',
                color: '#C9A96E',
                padding: '0.6rem 1.4rem',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              View all international journeys
            </button>
          </div>

          <div
            className="flex gap-4 overflow-x-auto pb-3"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {internationalPackages.map((pkg) => (
              <div key={pkg.id} style={{ scrollSnapAlign: 'start' }}>
                <HorizontalPackageCard pkg={pkg} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI Planner CTA ───────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#F7F5F0', padding: '5rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-xs tracking-widest uppercase font-sans mb-4" style={{ color: '#C9A96E' }}>
            Intelligent Planning
          </p>
          <h2
            className="font-display mb-4"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', color: '#252525', lineHeight: 1.15 }}
          >
            Plan your next journey<br />with Journey AI.
          </h2>
          <p className="font-sans mb-8 mx-auto" style={{ color: '#77736C', maxWidth: '420px', lineHeight: 1.65 }}>
            Describe your ideal journey. Our AI curates a private itinerary matched to your style, pace, and budget.
          </p>
          <button
            onClick={() => navigate('ai-planner')}
            className="font-sans text-sm tracking-wider uppercase px-8 py-3 text-white transition-opacity duration-200 hover:opacity-80"
            style={{ backgroundColor: '#111111', borderRadius: '2px', letterSpacing: '0.1em' }}
          >
            Start Planning
          </button>
        </div>
      </section>
    </div>
  );
}
