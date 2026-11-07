import { useApp } from '../../store/AppContext';
import { SHOW_SAMPLE_PAGES } from '../../config/features';
import {
  FOOTER_COLUMNS,
  currentYear,
  filterFooterColumns,
  type FooterLink,
  type FooterColumn,
} from '../../lib/footer';

export {
  FOOTER_COLUMNS,
  currentYear,
  filterFooterColumns,
  type FooterLink,
  type FooterColumn,
};

export default function Footer() {
  const { navigate, setSearchQuery, openTransport } = useApp();

  function handleLink(link: FooterLink) {
    if (link.transportTab) {
      openTransport(link.transportTab);
      return;
    }
    if (link.searchType) {
      setSearchQuery({ type: link.searchType });
    }
    navigate(link.page);
  }

  const renderedColumns = filterFooterColumns(FOOTER_COLUMNS, SHOW_SAMPLE_PAGES);

  return (
    <footer className="bg-slate-950 text-white">
      {/* Container with ample bottom and right offset to prevent overlap with Travel Assistant FAB at 1280px & 375px */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        {/* Top: brand + link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <button
              onClick={() => navigate('home')}
              className="font-sans font-bold text-xl text-white hover:text-white/80 transition-colors cursor-pointer text-left"
            >
              Travalastic
            </button>
            <p className="text-white/40 text-sm mt-2 leading-relaxed">
              Plan smarter.<br />Travel better.
            </p>
          </div>

          {/* Filtered Columns */}
          {renderedColumns.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.label}`}>
                    <button
                      onClick={() => handleLink(link)}
                      className="text-sm text-white/60 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip: Clean copyright notice with clearance for FAB */}
        <div className="border-t border-white/8 pt-6 pb-16 sm:pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-0 sm:pr-56">
          <p className="text-white/40 text-xs tracking-wide">
            &copy; {currentYear()} Travalastic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
