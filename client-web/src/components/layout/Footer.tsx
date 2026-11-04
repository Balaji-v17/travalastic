import { useApp } from '../../store/AppContext';

const COLUMNS = [
  {
    heading: 'Discover',
    links: [
      { label: 'Explore', page: 'explore' as const },
      { label: 'Destinations', page: 'explore' as const },
      { label: 'Deals', page: 'deals' as const },
      { label: 'Journey AI', page: 'ai-planner' as const },
      { label: 'Trending now', page: 'explore' as const },
    ],
  },
  {
    heading: 'Book',
    links: [
      { label: 'Flights', page: 'search' as const, searchType: 'flights' as const },
      { label: 'Hotels', page: 'search' as const, searchType: 'hotels' as const },
      { label: 'Experiences', page: 'search' as const, searchType: 'experiences' as const },
      { label: 'Transfers', page: 'search' as const },
      { label: 'Car rental', page: 'search' as const },
    ],
  },
  {
    heading: 'Prepare',
    links: [
      { label: 'Visa Center', page: 'visa-center' as const },
      { label: 'Travel Insurance', page: 'explore' as const },
      { label: 'Packing lists', page: 'explore' as const },
      { label: 'Travel advisories', page: 'explore' as const },
      { label: 'Embassy info', page: 'explore' as const },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About us', page: 'explore' as const },
      { label: 'Careers', page: 'explore' as const },
      { label: 'Blog', page: 'explore' as const },
      { label: 'Press', page: 'explore' as const },
      { label: 'Help Center', page: 'support' as const },
    ],
  },
];

export default function Footer() {
  const { navigate, setSearchQuery } = useApp();

  function handleLink(link: { page: Parameters<typeof navigate>[0]; searchType?: 'flights' | 'hotels' | 'experiences' | 'packages' }) {
    if (link.searchType) setSearchQuery({ type: link.searchType });
    navigate(link.page);
  }

  return (
    <footer className="bg-slate-950 text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">

        {/* Top: wordmark + columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <button
              onClick={() => navigate('home')}
              className="font-sans font-bold text-xl text-white hover:text-white/80 transition-colors"
            >
              Travalastic
            </button>
            <p className="text-white/30 text-sm mt-2 leading-relaxed">
              Plan smarter.<br />Travel better.
            </p>

            {/* Social links (placeholder) */}
            <div className="flex gap-3 mt-5">
              {['Twitter', 'Instagram', 'LinkedIn'].map((s) => (
                <div key={s} className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-white/30 hover:bg-white/12 hover:text-white/60 transition-all cursor-pointer text-[10px] font-bold">
                  {s[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => handleLink(link)}
                      className="text-sm text-white/50 hover:text-white transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © 2027 Travalastic · All rights reserved
          </p>

          <div className="flex items-center gap-5">
            {['Privacy', 'Terms', 'Cookie settings'].map((item) => (
              <button key={item} className="text-xs text-white/30 hover:text-white/60 transition-colors">
                {item}
              </button>
            ))}
          </div>

          {/* App store badge placeholders */}
          <div className="flex gap-2">
            {['App Store', 'Google Play'].map((store) => (
              <div
                key={store}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-white/30 text-xs font-medium hover:border-white/20 hover:text-white/50 transition-all cursor-pointer"
              >
                {store}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
