/**
 * Pure query helper for Hotel list filters and URL hash synchronization.
 */

export type HotelVisibilityFilter = 'all' | 'true' | 'false';
export type BudgetTierFilter = 'all' | 'budget' | 'mid' | 'luxury';

export interface HotelFilterState {
  q: string;
  city: string;
  budgetTier: BudgetTierFilter;
  hidden: HotelVisibilityFilter;
}

export const DEFAULT_HOTEL_FILTERS: Readonly<HotelFilterState> = Object.freeze({
  q: '',
  city: '',
  budgetTier: 'all',
  hidden: 'all',
});

/**
 * Parses URL hash into structured HotelFilterState.
 * Example hash: "#/hotels?q=Taj&city=Goa&tier=luxury&hidden=false"
 */
export function parseHotelQuery(hash: string): HotelFilterState {
  if (!hash || typeof hash !== 'string') {
    return { ...DEFAULT_HOTEL_FILTERS };
  }

  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return { ...DEFAULT_HOTEL_FILTERS };
  }

  const queryString = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(queryString);

  const qRaw = params.get('q') || '';
  const q = qRaw.trim().slice(0, 60);

  const city = (params.get('city') || params.get('destination') || '').trim();

  const tierRaw = (params.get('budgetTier') || params.get('tier') || '').trim().toLowerCase();
  let budgetTier: BudgetTierFilter = 'all';
  if (tierRaw === 'budget' || tierRaw === 'mid' || tierRaw === 'luxury') {
    budgetTier = tierRaw;
  }

  const hiddenRaw = (params.get('hidden') || '').trim().toLowerCase();
  let hidden: HotelVisibilityFilter = 'all';
  if (hiddenRaw === 'true' || hiddenRaw === 'false') {
    hidden = hiddenRaw;
  }

  return {
    q,
    city,
    budgetTier,
    hidden,
  };
}

/**
 * Builds a query string from filter state, omitting empty and default values.
 */
export function buildHotelQuery(filters: HotelFilterState): string {
  const params = new URLSearchParams();

  if (filters.q && filters.q.trim()) {
    params.set('q', filters.q.trim().slice(0, 60));
  }
  if (filters.city && filters.city.trim()) {
    params.set('city', filters.city.trim());
  }
  if (filters.budgetTier && filters.budgetTier !== 'all') {
    params.set('tier', filters.budgetTier);
  }
  if (filters.hidden && filters.hidden !== 'all') {
    params.set('hidden', filters.hidden);
  }

  return params.toString();
}

/**
 * Builds the full hash URL string for the hotels list.
 * Example: "#/hotels?city=Goa&tier=mid"
 */
export function buildHotelHash(filters: HotelFilterState): string {
  const qs = buildHotelQuery(filters);
  return qs ? `#/hotels?${qs}` : '#/hotels';
}

