export type BookTab = 'flights' | 'hotels' | 'cab' | 'rental' | 'trains' | 'buses';

export const BOOK_TABS: readonly BookTab[] = [
  'flights',
  'hotels',
  'cab',
  'rental',
  'trains',
  'buses',
];

export type Page =
  | 'home'
  | 'explore'
  | 'search'
  | 'book'
  | 'destination'
  | 'hotel-detail'
  | 'experience-detail'
  | 'flight-detail'
  | 'flight-booking'
  | 'ai-planner'
  | 'my-trips'
  | 'journey'
  | 'booking-flow'
  | 'support'
  | 'profile'
  | 'deals'
  | 'visa-center'
  | 'my-bookings'
  | 'style-collection'
  | 'journeys'
  | 'package-detail'
  | 'auth'
  | 'privacy'
  | 'delete-account'
  // Legacy booking aliases (resolve to 'book' + tab)
  | 'flights'
  | 'hotels'
  | 'ground-transport'
  | 'cab'
  | 'car-rental'
  | 'trains'
  | 'buses'
  // internal pages (not routed, kept for compilation)
  | 'journey-control-tower'
  | 'supplier-intelligence'
  | 'finance'
  | 'analytics'
  | 'partner-dashboard'
  | 'corporate-dashboard'
  | 'command-center';

export type PageStatus = 'live' | 'sample' | 'internal';

export const PAGE_ALIASES: Record<string, { page: 'book'; tab: BookTab }> = {
  flights: { page: 'book', tab: 'flights' },
  hotels: { page: 'book', tab: 'hotels' },
  'ground-transport': { page: 'book', tab: 'cab' },
  cab: { page: 'book', tab: 'cab' },
  'car-rental': { page: 'book', tab: 'rental' },
  trains: { page: 'book', tab: 'trains' },
  buses: { page: 'book', tab: 'buses' },
};

export function normalizeBookTab(tab?: string | null): BookTab {
  if (!tab || typeof tab !== 'string') return 'flights';
  const cleaned = tab.trim().toLowerCase() as BookTab;
  return (BOOK_TABS as readonly string[]).includes(cleaned) ? cleaned : 'flights';
}

export function resolveBookAlias(
  page: string,
  transportTab?: 'cab' | 'rental'
): { page: Page; tab?: BookTab } {
  const alias = PAGE_ALIASES[page];
  if (alias) {
    if (page === 'ground-transport' && transportTab === 'rental') {
      return { page: 'book', tab: 'rental' };
    }
    return alias;
  }
  return { page: page as Page };
}

export const PAGE_STATUS: Record<Page, PageStatus> = {
  home: 'live',
  'ai-planner': 'live',
  'my-trips': 'live',
  journey: 'live',
  auth: 'live',
  profile: 'live',
  privacy: 'live',
  'delete-account': 'live',
  'style-collection': 'live',
  book: 'live',

  explore: 'live',
  destination: 'live',
  search: 'live',
  'flight-detail': 'live',
  'flight-booking': 'live',
  'my-bookings': 'live',

  // Aliased legacy ids (all resolve to 'book' + tab)
  flights: 'live',
  hotels: 'live',
  'ground-transport': 'live',
  cab: 'live',
  'car-rental': 'live',
  trains: 'live',
  buses: 'live',

  'hotel-detail': 'sample',
  'experience-detail': 'sample',
  journeys: 'sample',
  'package-detail': 'sample',
  deals: 'sample',
  'visa-center': 'sample',
  support: 'sample',
  'booking-flow': 'sample',

  'journey-control-tower': 'internal',
  'supplier-intelligence': 'internal',
  finance: 'internal',
  analytics: 'internal',
  'partner-dashboard': 'internal',
  'corporate-dashboard': 'internal',
  'command-center': 'internal',
};

export interface PrimaryNavItem {
  label: string;
  page: Page;
  activePaths?: Page[];
  icon?: string;
  badge?: string;
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { label: 'Explore', page: 'explore', activePaths: ['explore', 'destination'] },
  { label: 'Journey AI', page: 'ai-planner', activePaths: ['ai-planner'] },
  {
    label: 'Book',
    page: 'book',
    activePaths: ['book', 'flights', 'hotels', 'ground-transport', 'cab', 'car-rental', 'trains', 'buses', 'flight-detail', 'flight-booking', 'hotel-detail'],
  },
  { label: 'Trips', page: 'my-trips', activePaths: ['my-trips', 'journey'] },
  { label: 'Bookings', page: 'my-bookings', activePaths: ['my-bookings'] },
];

export function isPageAvailable(page: Page, showSample: boolean): boolean {
  const aliased = PAGE_ALIASES[page];
  const target = aliased ? aliased.page : page;
  const status = PAGE_STATUS[target];
  if (status === 'live') return true;
  if (status === 'sample') return showSample;
  return false;
}

const warnedUnavailablePages = new Set<string>();

export function _resetWarnedPagesForTests(): void {
  warnedUnavailablePages.clear();
}

export function resolvePage(page: Page, showSample: boolean): Page {
  const aliased = PAGE_ALIASES[page];
  if (aliased) {
    return isPageAvailable(aliased.page, showSample) ? aliased.page : 'home';
  }
  if (isPageAvailable(page, showSample)) {
    return page;
  }
  const isDev =
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV));

  if (isDev && !warnedUnavailablePages.has(page)) {
    warnedUnavailablePages.add(page);
    const status = PAGE_STATUS[page] ?? 'unknown';
    console.warn(`Dead link: page '${page}' is not available (status: ${status})`);
  }
  return 'home';
}

export function visibleNav<T extends { page: Page; searchType?: string }>(
  items: readonly T[],
  showSample: boolean
): T[] {
  return items.filter((item) => {
    if (!showSample && item.page === 'search' && item.searchType && item.searchType !== 'flights') {
      return false;
    }
    return isPageAvailable(item.page, showSample);
  });
}

export function getAvatarInitial(
  name?: string | null,
  email?: string | null
): string {
  const trimmedName = name?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName[0].toUpperCase();
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail && trimmedEmail.length > 0) {
    return trimmedEmail[0].toUpperCase();
  }
  return '?';
}
