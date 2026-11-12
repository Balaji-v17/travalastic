export type VisibilityFilter = 'all' | 'true' | 'false';

export interface PlaceFilterState {
  q: string;
  city: string;
  state: string;
  type: string;
  hidden: VisibilityFilter;
}

export const DEFAULT_PLACE_FILTERS: PlaceFilterState = {
  q: '',
  city: '',
  state: '',
  type: '',
  hidden: 'all',
};

/**
 * Parses the URL hash string into PlaceFilterState.
 * Example hash: "#/places?q=Goa&city=Panaji&hidden=false"
 */
export function parsePlaceQuery(hash: string): PlaceFilterState {
  const result: PlaceFilterState = { ...DEFAULT_PLACE_FILTERS };
  if (!hash || typeof hash !== 'string') {
    return result;
  }

  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return result;
  }

  const queryString = hash.slice(queryIndex + 1);
  const searchParams = new URLSearchParams(queryString);

  const q = searchParams.get('q');
  if (q !== null && q.trim().length > 0) {
    result.q = q.trim().slice(0, 60);
  }

  const city = searchParams.get('city');
  if (city !== null && city.trim().length > 0) {
    result.city = city.trim();
  }

  const state = searchParams.get('state');
  if (state !== null && state.trim().length > 0) {
    result.state = state.trim();
  }

  const type = searchParams.get('type');
  if (type !== null && type.trim().length > 0) {
    result.type = type.trim();
  }

  const hidden = searchParams.get('hidden');
  if (hidden === 'true' || hidden === 'false') {
    result.hidden = hidden;
  } else {
    result.hidden = 'all';
  }

  return result;
}

/**
 * Builds a query string or full hash route from PlaceFilterState.
 * Drops empty/whitespace-only values and drops hidden when 'all'.
 */
export function buildPlaceQuery(filters: Partial<PlaceFilterState>): string {
  const params = new URLSearchParams();

  if (filters.q && typeof filters.q === 'string' && filters.q.trim().length > 0) {
    params.set('q', filters.q.trim().slice(0, 60));
  }
  if (filters.city && typeof filters.city === 'string' && filters.city.trim().length > 0) {
    params.set('city', filters.city.trim());
  }
  if (filters.state && typeof filters.state === 'string' && filters.state.trim().length > 0) {
    params.set('state', filters.state.trim());
  }
  if (filters.type && typeof filters.type === 'string' && filters.type.trim().length > 0) {
    params.set('type', filters.type.trim());
  }
  if (filters.hidden === 'true' || filters.hidden === 'false') {
    params.set('hidden', filters.hidden);
  }

  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

/**
 * Builds the complete hash route (e.g. "#/places?q=Goa&hidden=false")
 */
export function buildPlaceHash(filters: Partial<PlaceFilterState>): string {
  const qs = buildPlaceQuery(filters);
  return `#/places${qs}`;
}

