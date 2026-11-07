export type Page =
  | 'home'
  | 'explore'
  | 'search'
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
  | 'hotels'
  | 'ground-transport'
  | 'style-collection'
  | 'journeys'
  | 'package-detail'
  | 'auth'
  | 'privacy'
  | 'delete-account'
  // internal pages (not routed, kept for compilation)
  | 'journey-control-tower'
  | 'supplier-intelligence'
  | 'finance'
  | 'analytics'
  | 'partner-dashboard'
  | 'corporate-dashboard'
  | 'command-center';

export type PageStatus = 'live' | 'sample' | 'internal';

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
  'ground-transport': 'live',

  explore: 'live',
  destination: 'live',
  search: 'live',
  'flight-detail': 'live',
  'flight-booking': 'live',
  'hotel-detail': 'sample',
  'experience-detail': 'sample',
  journeys: 'sample',
  'package-detail': 'sample',
  deals: 'sample',
  'visa-center': 'sample',
  'my-bookings': 'live',
  hotels: 'live',
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

export function isPageAvailable(page: Page, showSample: boolean): boolean {
  const status = PAGE_STATUS[page];
  if (status === 'live') return true;
  if (status === 'sample') return showSample;
  return false;
}

const warnedUnavailablePages = new Set<string>();

export function _resetWarnedPagesForTests(): void {
  warnedUnavailablePages.clear();
}

export function resolvePage(page: Page, showSample: boolean): Page {
  if (isPageAvailable(page, showSample)) {
    return page;
  }
  const isDev =
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV));

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

