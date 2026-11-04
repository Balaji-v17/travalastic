import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import {
  getPackageById,
  formatPackagePrice,
  type PackageDayActivity,
  type PackageStop,
  type PackageHighlight,
} from '@/data/packagesData';

// ─── SVG Activity Icons ────────────────────────────────────────────────────────

function IconPlane() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2.5 8.5l5 2L8 13l-2 2 2 2 2-2 2.5 5.5z"/>
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 22V12h6v10M9 7h1M14 7h1M9 12h1M14 12h1"/>
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function IconUtensils() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#77736C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function activityIcon(type: PackageDayActivity['type']) {
  switch (type) {
    case 'flight': return <IconPlane />;
    case 'hotel':
    case 'check-in':
    case 'check-out': return <IconBuilding />;
    case 'experience': return <IconStar />;
    case 'meal': return <IconUtensils />;
    default: return <IconArrow />;
  }
}

// ─── Route Visualization ──────────────────────────────────────────────────────

function RouteViz({ route }: { route: string[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {route.map((city, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="font-sans text-sm font-medium" style={{ color: '#252525' }}>{city}</span>
          {i < route.length - 1 && (
            <span style={{ color: '#C9A96E', fontSize: '1rem' }}>&rarr;</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Itinerary Day Row ────────────────────────────────────────────────────────

function DayRow({ day, defaultOpen }: { day: { day: number; title: string; location: string; activities: PackageDayActivity[] }; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '1px solid rgba(37,37,37,0.1)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-5 py-6 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1.5rem 0' }}
      >
        <div className="flex-shrink-0 w-16">
          <span
            className="font-sans text-xs tracking-widest uppercase"
            style={{ color: '#C9A96E', letterSpacing: '0.18em' }}
          >
            DAY {String(day.day).padStart(2, '0')}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-lg leading-tight" style={{ color: '#252525' }}>
            {day.title}
          </h4>
          <p className="font-sans text-sm mt-0.5" style={{ color: '#77736C' }}>
            {day.location}
          </p>
        </div>
        <div className="flex-shrink-0 mt-1" style={{ color: '#77736C' }}>
          <IconChevron open={open} />
        </div>
      </button>

      {open && (
        <div className="pb-6 pl-16 md:pl-21">
          <div className="flex flex-col gap-3">
            {day.activities.map((act, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: act.included ? '#C9A96E' : '#77736C' }}
                >
                  {activityIcon(act.type)}
                </span>
                <div className="min-w-0">
                  <span className="font-sans text-sm" style={{ color: '#252525' }}>
                    {act.title}
                  </span>
                  {!act.included && (
                    <span className="font-sans text-xs ml-2" style={{ color: '#77736C' }}>
                      (not included)
                    </span>
                  )}
                  {act.notes && (
                    <p className="font-sans text-xs mt-0.5" style={{ color: '#77736C' }}>
                      {act.notes}
                    </p>
                  )}
                </div>
                {act.time && (
                  <span className="ml-auto flex-shrink-0 font-sans text-xs" style={{ color: '#77736C' }}>
                    {act.time}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Highlight Card ───────────────────────────────────────────────────────────

function HighlightCard({ highlight, reverse }: { highlight: PackageHighlight; reverse?: boolean }) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${reverse ? 'md:[direction:rtl]' : ''}`}
    >
      {highlight.imageUrl && (
        <div
          className="overflow-hidden"
          style={{ borderRadius: '2px', height: '320px', direction: 'ltr' }}
        >
          <img src={highlight.imageUrl} alt={highlight.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div style={{ direction: 'ltr' }}>
        <div style={{ width: '32px', height: '2px', backgroundColor: '#C9A96E', marginBottom: '1.25rem' }} />
        <h3 className="font-display mb-3" style={{ fontSize: '1.5rem', color: '#252525', lineHeight: 1.2 }}>
          {highlight.title}
        </h3>
        <p className="font-sans text-base leading-relaxed" style={{ color: '#77736C' }}>
          {highlight.description}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PackageDetailPage() {
  const { selectedPackageId, navigate, navigateBack } = useApp();
  const pkg = selectedPackageId ? getPackageById(selectedPackageId) : undefined;

  useEffect(() => {
    if (!selectedPackageId || !pkg) {
      navigate('journeys');
    }
  }, [selectedPackageId, pkg, navigate]);

  const [bookHovered, setBookHovered] = useState(false);

  if (!pkg) {
    return (
      <div
        className="flex items-center justify-center min-h-screen font-sans text-sm"
        style={{ backgroundColor: '#F7F5F0', color: '#77736C' }}
      >
        Loading journey...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F7F5F0' }}>
      {/* ─── Cinematic Hero ───────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col justify-end"
        style={{ minHeight: '100svh', overflow: 'hidden' }}
      >
        {/* Background image */}
        <img
          src={pkg.imageUrl}
          alt={pkg.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1 }}
        />

        {/* Back button */}
        <button
          onClick={navigateBack}
          className="absolute top-6 left-6 font-sans text-xs tracking-widest uppercase flex items-center gap-2"
          style={{
            zIndex: 10,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.85)',
            padding: '0.5rem 1rem',
            borderRadius: '2px',
            cursor: 'pointer',
          }}
        >
          <span>&larr;</span> Back
        </button>

        {/* Hero content */}
        <div className="relative px-6 lg:px-12 pb-16 max-w-5xl mx-auto w-full" style={{ zIndex: 2 }}>
          <p
            className="font-sans text-xs tracking-widest uppercase mb-4"
            style={{ color: '#C9A96E', letterSpacing: '0.2em' }}
          >
            {pkg.destination}
          </p>
          <h1
            className="font-display text-white"
            style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', lineHeight: 1.0, marginBottom: '1.25rem', maxWidth: '800px' }}
          >
            {pkg.title}
          </h1>
          <p className="font-sans mb-8" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1rem' }}>
            {pkg.nights} nights &middot; {pkg.travelStyle}
          </p>
          <p className="font-sans text-xl font-semibold text-white mb-8">
            from &#8377;{formatPackagePrice(pkg.pricePerPerson)}{' '}
            <span className="text-base font-normal" style={{ color: 'rgba(255,255,255,0.65)' }}>
              / person
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onMouseEnter={() => setBookHovered(true)}
              onMouseLeave={() => setBookHovered(false)}
              className="font-sans text-sm tracking-wider uppercase px-8 py-3 text-white"
              style={{
                backgroundColor: bookHovered ? '#222' : '#111111',
                borderRadius: '2px',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                transition: 'background-color 0.2s',
              }}
            >
              Book This Journey
            </button>
            <button
              className="font-sans text-sm"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              Customise &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ─── Journey Overview Strip ───────────────────────────────────────── */}
      <section style={{ backgroundColor: '#F7F5F0', borderBottom: '1px solid rgba(37,37,37,0.1)' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">
          <div className="mb-8">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              Route
            </p>
            <RouteViz route={pkg.route} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Duration</p>
              <p className="font-display text-xl" style={{ color: '#252525' }}>{pkg.nights} nights</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Pace</p>
              <p className="font-display text-xl capitalize" style={{ color: '#252525' }}>{pkg.pace}</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Accommodation</p>
              <p className="font-display text-xl capitalize" style={{ color: '#252525' }}>{pkg.accommodation.replace('-', ' ')}</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Transport</p>
              <p className="font-display text-xl capitalize" style={{ color: '#252525' }}>{pkg.transport}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Signature Moments ────────────────────────────────────────────── */}
      {pkg.highlights.length > 0 && (
        <section style={{ backgroundColor: '#F7F5F0', padding: '5rem 0' }}>
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              Signature Moments
            </p>
            <h2
              className="font-display mb-12"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#252525', lineHeight: 1.1 }}
            >
              Experiences crafted for you.
            </h2>
            <div className="flex flex-col gap-16">
              {pkg.highlights.slice(0, 3).map((h, i) => (
                <HighlightCard key={i} highlight={h} reverse={i % 2 === 1} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Your Stay ────────────────────────────────────────────────────── */}
      {pkg.stops.length > 0 && (
        <section style={{ backgroundColor: '#111111', padding: '5rem 0' }}>
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              Your Stay
            </p>
            <h2
              className="font-display text-white mb-10"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', lineHeight: 1.1 }}
            >
              Where you will rest.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {pkg.stops.map((stop: PackageStop, i: number) => (
                <div
                  key={i}
                  className="p-6"
                  style={{ backgroundColor: '#111111' }}
                >
                  <p className="font-sans text-xs tracking-widest uppercase mb-2" style={{ color: '#C9A96E' }}>
                    {stop.city}
                  </p>
                  <p className="font-display text-white text-lg leading-tight mb-1">{stop.hotel}</p>
                  {stop.roomType && (
                    <p className="font-sans text-sm mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {stop.roomType}
                    </p>
                  )}
                  <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {stop.nights} night{stop.nights !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Day-by-Day Itinerary ─────────────────────────────────────────── */}
      {pkg.itinerary.length > 0 && (
        <section style={{ backgroundColor: '#F7F5F0', padding: '5rem 0' }}>
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              The Journey
            </p>
            <h2
              className="font-display mb-10"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#252525', lineHeight: 1.1 }}
            >
              Day by day.
            </h2>
            <div style={{ borderTop: '1px solid rgba(37,37,37,0.1)' }}>
              {pkg.itinerary.map((day, i) => (
                <DayRow key={day.day} day={day} defaultOpen={i < 3} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Inclusions & Exclusions ──────────────────────────────────────── */}
      <section style={{ backgroundColor: '#F7F5F0', padding: '5rem 0', borderTop: '1px solid rgba(37,37,37,0.08)' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
            What is included
          </p>
          <h2
            className="font-display mb-10"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#252525', lineHeight: 1.1 }}
          >
            The full picture.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-5 font-semibold" style={{ color: '#252525' }}>
                Included
              </p>
              <ul className="flex flex-col gap-3">
                {pkg.inclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5"><IconCheck /></span>
                    <span className="font-sans text-sm" style={{ color: '#252525' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest mb-5 font-semibold" style={{ color: '#252525' }}>
                Not included
              </p>
              <ul className="flex flex-col gap-3">
                {pkg.exclusions.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5"><IconX /></span>
                    <span className="font-sans text-sm" style={{ color: '#77736C' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Visa & Travel Requirements ───────────────────────────────────── */}
      {pkg.visaRequired && pkg.region === 'international' && (
        <section style={{ backgroundColor: '#F0EDE6', padding: '4rem 0' }}>
          <div className="max-w-5xl mx-auto px-6 lg:px-12">
            <p className="text-xs tracking-widest uppercase font-sans mb-3" style={{ color: '#C9A96E' }}>
              Visa &amp; Entry
            </p>
            <h2
              className="font-display mb-4"
              style={{ fontSize: '1.6rem', color: '#252525', lineHeight: 1.1 }}
            >
              Travel requirements.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Visa type</p>
                <p className="font-sans text-base capitalize" style={{ color: '#252525' }}>
                  {pkg.visaType?.replace('-', ' ')}
                </p>
              </div>
              {pkg.visaNote && (
                <div>
                  <p className="font-sans text-xs uppercase tracking-widest mb-1" style={{ color: '#77736C' }}>Note</p>
                  <p className="font-sans text-sm" style={{ color: '#252525', lineHeight: 1.6 }}>{pkg.visaNote}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('visa-center')}
              className="font-sans text-sm tracking-wider uppercase px-6 py-3 text-white"
              style={{ backgroundColor: '#111111', borderRadius: '2px', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
            >
              Start Visa Application
            </button>
          </div>
        </section>
      )}

      {/* ─── Price Architecture ───────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#111111', padding: '5rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-xs tracking-widest uppercase font-sans mb-4" style={{ color: '#C9A96E' }}>
            Pricing
          </p>
          <p
            className="font-display text-white mb-2"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', lineHeight: 1 }}
          >
            &#8377;{formatPackagePrice(pkg.pricePerPerson)}
          </p>
          <p className="font-sans mb-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem' }}>
            per person
          </p>
          <p className="font-sans text-xs mb-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Taxes and government levies estimated at checkout. Price based on twin sharing.
          </p>
          <button
            className="font-sans text-sm tracking-wider uppercase px-10 py-4 text-white"
            style={{ backgroundColor: '#C9A96E', borderRadius: '2px', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', color: '#111111' }}
          >
            Book This Journey
          </button>
        </div>
      </section>

      {/* ─── Sticky Mobile Bottom Bar ─────────────────────────────────────── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: '#111111', zIndex: 50 }}
      >
        <div>
          <p className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>from</p>
          <p className="font-sans font-semibold text-white">
            &#8377;{formatPackagePrice(pkg.pricePerPerson)}{' '}
            <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.55)' }}>/ person</span>
          </p>
        </div>
        <button
          className="font-sans text-sm tracking-wider uppercase px-6 py-3"
          style={{
            backgroundColor: '#C9A96E',
            borderRadius: '2px',
            border: 'none',
            cursor: 'pointer',
            color: '#111111',
            letterSpacing: '0.08em',
            fontWeight: '500',
          }}
        >
          Book Journey
        </button>
      </div>

      {/* Bottom padding for sticky bar on mobile */}
      <div className="lg:hidden h-20" />
    </div>
  );
}
