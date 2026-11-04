import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import type { Page } from '../../store/AppContext';

// ─── Nav link definition ────────────────────────────────────────────────────

interface NavItem {
  label: string;
  page: Page;
  searchType?: 'flights' | 'hotels' | 'experiences' | 'packages';
  activePaths?: Page[];
  badge?: string;
  icon?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Explore', page: 'explore', activePaths: ['explore', 'destination'] },
  { label: 'Journey AI', page: 'ai-planner', activePaths: ['ai-planner'] },
  { label: 'Flights', page: 'search', searchType: 'flights', activePaths: ['flight-detail', 'search'] },
  { label: 'Hotels', page: 'search', searchType: 'hotels', activePaths: ['hotel-detail'] },
  { label: 'Experiences', page: 'search', searchType: 'experiences', activePaths: ['experience-detail'] },
  { label: 'Journeys', page: 'journeys', activePaths: ['journeys', 'package-detail'] },
  { label: 'Trips', page: 'my-trips', activePaths: ['my-trips', 'journey'] },
  { label: 'Bookings', page: 'my-bookings', activePaths: ['my-bookings'] },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TopNav() {
  const { page, navigate, notifications, setSearchQuery, markNotificationRead } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const isHome = page === 'home';

  useEffect(() => {
    if (!isHome) { setScrolled(false); return; }
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const transparent = isHome && !scrolled;
  const unread = notifications.filter((n) => !n.read).length;

  function handleNavClick(item: NavItem) {
    if (item.searchType) setSearchQuery({ type: item.searchType });
    navigate(item.page);
    setMobileOpen(false);
  }

  function isActive(item: NavItem): boolean {
    if (item.activePaths) {
      if (item.label === 'Flights' && page === 'search') {
        return false; // handled by searchType context, don't highlight generically
      }
      return item.activePaths.includes(page);
    }
    return page === item.page;
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          transparent
            ? 'bg-transparent border-transparent'
            : 'bg-slate-950/95 backdrop-blur-xl border-b border-white/8 shadow-[0_1px_0_rgba(255,255,255,0.06)]'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-[60px] gap-8">

            {/* ── Logo ── */}
            <button
              onClick={() => navigate('home')}
              className="flex items-center flex-shrink-0 group"
              aria-label="Travalastic home"
            >
              <span className="font-sans font-bold text-[18px] tracking-tight text-white group-hover:text-white/80 transition-colors">
                Travalastic
              </span>
            </button>

            {/* ── Primary nav (desktop) ── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1" aria-label="Main navigation">
              {PRIMARY_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 tracking-[0.01em] ${
                      active
                        ? 'text-white'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-px rounded-full" style={{ backgroundColor: '#C9A96E' }} />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* ── Right actions (desktop) ── */}
            <div className="hidden lg:flex items-center gap-1 flex-shrink-0">

              {/* Search */}
              <button
                onClick={() => navigate('search')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Search"
              >
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="8" cy="8" r="5.5"/><path d="M13.5 13.5l2.5 2.5" strokeLinecap="round"/>
                </svg>
                <span className="text-xs">Search</span>
              </button>

              {/* Visa Center */}
              <button
                onClick={() => navigate('visa-center')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-slate-950 ${
                  page === 'visa-center' ? 'text-white' : 'text-white/55 hover:text-white'
                }`}
              >
                <span>Visa</span>
              </button>

              {/* Divider */}
              <div className="w-px h-4 bg-white/12 mx-1" />

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setMobileOpen(false); }}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Notifications"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M14 9a5 5 0 00-10 0c0 4.5-2 5.5-2 5.5h14s-2-1-2-5.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.73 16a2 2 0 01-3.46 0" strokeLinecap="round"/>
                  </svg>
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-slate-950">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-12 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden animate-slide-up">
                    <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Notifications</p>
                      <div className="flex items-center gap-3">
                        {unread > 0 && <span className="text-xs text-blue-400 font-medium">{unread} new</span>}
                        {unread > 0 && (
                          <button
                            onClick={() => notifications.filter(n => !n.read).forEach(n => markNotificationRead(n.id))}
                            className="text-xs text-white/40 hover:text-white/70 transition-colors"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-5 text-sm text-white/40 text-center">All caught up ✓</p>
                      ) : (
                        notifications.slice(0, 6).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setExpandedNotifId(prev => prev === n.id ? null : n.id);
                              if (!n.read) markNotificationRead(n.id);
                            }}
                            className={`px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-blue-500/8' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                n.type === 'alert' ? 'bg-red-400' :
                                n.type === 'warning' ? 'bg-amber-400' :
                                n.type === 'success' ? 'bg-emerald-400' : 'bg-blue-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white/90 leading-snug">{n.title}</p>
                                <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                {expandedNotifId === n.id && (
                                  <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                                    {n.type === 'alert' && (
                                      <>
                                        <button onClick={() => { navigate('search'); setNotifOpen(false); }} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600 transition-colors">Rebook Flight</button>
                                        <button className="px-3 py-1.5 bg-white/10 text-white/70 text-xs rounded-lg font-medium hover:bg-white/15 transition-colors">Accept Delay</button>
                                      </>
                                    )}
                                    {n.type === 'success' && (
                                      <button onClick={() => { navigate('my-bookings'); setNotifOpen(false); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 transition-colors">View Booking</button>
                                    )}
                                    {n.type === 'warning' && (
                                      <button onClick={() => { navigate('visa-center'); setNotifOpen(false); }} className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg font-medium hover:bg-amber-600 transition-colors">Take Action</button>
                                    )}
                                    {n.type === 'info' && (
                                      <button onClick={() => { navigate('my-trips'); setNotifOpen(false); }} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium hover:bg-blue-200 transition-colors">View</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <button
                onClick={() => navigate('profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  page === 'profile' ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/8'
                }`}
                aria-label="Profile"
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: '#77736C' }}>
                  A
                </div>
                <span className="text-sm font-medium hidden xl:block">Arjun</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/40 hidden xl:block">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* ── Mobile right ── */}
            <div className="lg:hidden flex items-center gap-1 ml-auto">
              {/* Notif mobile */}
              <button
                onClick={() => navigate('my-bookings')}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M14 9a5 5 0 00-10 0c0 4.5-2 5.5-2 5.5h14s-2-1-2-5.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.73 16a2 2 0 01-3.46 0" strokeLinecap="round"/>
                </svg>
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>

              {/* Hamburger */}
              <button
                className="w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 transition-all"
                onClick={() => { setMobileOpen(!mobileOpen); setNotifOpen(false); }}
                aria-label="Menu"
                aria-expanded={mobileOpen}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                  {mobileOpen
                    ? <path d="M4 4L14 14M14 4L4 14" strokeLinecap="round"/>
                    : <><path d="M3 5.5H15" strokeLinecap="round"/><path d="M3 9H15" strokeLinecap="round"/><path d="M3 12.5H15" strokeLinecap="round"/></>
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/98 backdrop-blur-xl pt-[60px]">
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Primary nav */}
            <div className="px-4 py-4 space-y-1 border-b border-white/8">
              {PRIMARY_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-blue-500/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon && <span className="text-blue-400 text-[11px]">{item.icon}</span>}
                      {item.label}
                      {item.badge && (
                        <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>
                      )}
                    </span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                );
              })}
            </div>

            {/* Secondary items */}
            <div className="px-4 py-4 space-y-1">
              <button onClick={() => { navigate('visa-center'); setMobileOpen(false); }} className="w-full text-left flex items-center px-4 py-3 rounded-xl text-sm text-white/60 hover:bg-white/8 hover:text-white transition-all">
                Visa Center
              </button>
              <button onClick={() => { navigate('deals'); setMobileOpen(false); }} className="w-full text-left flex items-center px-4 py-3 rounded-xl text-sm text-white/60 hover:bg-white/8 hover:text-white transition-all">
                Deals
              </button>
              <button onClick={() => { navigate('support'); setMobileOpen(false); }} className="w-full text-left flex items-center px-4 py-3 rounded-xl text-sm text-white/60 hover:bg-white/8 hover:text-white transition-all">
                Help &amp; Support
              </button>
            </div>

            {/* Profile strip */}
            <div className="mt-auto px-4 py-4 border-t border-white/8">
              <button
                onClick={() => { navigate('profile'); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/8 transition-all"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#77736C' }}>A</div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Arjun Mehta</p>
                  <p className="text-xs text-white/40">View profile</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-auto text-white/30">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Spacer to push page content below fixed nav ── */}
      <div className="h-[60px]" />
    </>
  );
}
