import {
  normalizeBookTab,
  PAGE_STATUS,
  resolveBookAlias,
  type BookTab,
  type Page,
} from './pageStatus.ts';

export interface BookPrefill {
  // Flights
  from?: string;
  destination?: string;
  dates?: string;
  travelers?: number;
  // Hotels
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  // Cab & Rental
  place?: unknown;
  lat?: number;
  lon?: number;
  dropoffName?: string;
  // Trains & Buses
  origin?: string;
}

/**
 * Resolves `openBook(tab, prefill)` target page + tab.
 * Unknown or omitted tabs always fall back to 'flights'.
 */
export function resolveOpenBookTarget(tab?: string | null): {
  page: 'book';
  tab: BookTab;
} {
  return {
    page: 'book',
    tab: normalizeBookTab(tab),
  };
}

/**
 * Formats a Page + optional BookTab into a shareable URL hash.
 */
export function formatHashRoute(page: Page, tab?: BookTab): string {
  const aliased = resolveBookAlias(page);
  if (aliased.page === 'book') {
    const resolvedTab = aliased.tab || normalizeBookTab(tab);
    return `#book/${resolvedTab}`;
  }
  return `#${page}`;
}

/**
 * Parses window.location.hash into a Page and optional BookTab.
 * Handles #book/<tab>, legacy aliases (#hotels, #ground-transport, #flights, etc.), and #my-bookings.
 */
export function parseHashRoute(hashStr: string): { page: Page; tab?: BookTab } {
  const cleaned = (hashStr || '').replace(/^#\/?/, '').trim().toLowerCase();
  if (!cleaned) return { page: 'home' };

  if (cleaned === 'book') {
    return { page: 'book', tab: 'flights' };
  }

  if (cleaned.startsWith('book/')) {
    const subTab = cleaned.slice('book/'.length).split('/')[0];
    return { page: 'book', tab: normalizeBookTab(subTab) };
  }

  const baseSlug = cleaned.split('/')[0];
  const aliased = resolveBookAlias(baseSlug);
  if (aliased.page === 'book' && aliased.tab) {
    return aliased;
  }

  if (Object.prototype.hasOwnProperty.call(PAGE_STATUS, baseSlug)) {
    return { page: baseSlug as Page };
  }

  return { page: 'home' };
}

