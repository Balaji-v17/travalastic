import { apiFetch } from './api.ts';

export const CITY_SEARCH_MIN_CHARS = 2;
export const CITY_SEARCH_DEBOUNCE_MS = 200;

export interface CitySuggestion {
  id: string;
  name: string;
  admin: string;
  country: string;
  iso2: string;
  lat: number;
  lng: number;
  population: number | null;
  type?: 'city' | 'region';
}

const EXTRA_FOLD_MAP: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
  þ: 'th',
  '’': "'",
  '‘': "'",
};

const EXTRA_FOLD_REGEX = /[łøđðßæœıþ’‘]/g;

export function normalizeCitySearchKey(input?: string | null): string {
  if (input == null) return '';
  const str = String(input).trim();
  if (!str) return '';

  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(EXTRA_FOLD_REGEX, (ch) => EXTRA_FOLD_MAP[ch] || ch)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a suggestion as "City, Admin, Country" (or "Region, Country" for regions).
 */
export function formatCityDisplay(city: CitySuggestion): string {
  if (city.type === 'region') {
    return [city.name, city.country].filter(Boolean).join(', ');
  }
  return [city.name, city.admin, city.country].filter(Boolean).join(', ');
}

/**
 * Formats secondary location text below/beside the city name.
 */
export function formatCitySecondary(city: CitySuggestion): string {
  if (city.type === 'region') {
    return city.country ? `${city.country} · State / region` : 'State / region';
  }
  return [city.admin, city.country].filter(Boolean).join(', ');
}

export function nextTypeaheadIndex(
  currentIndex: number,
  key: string,
  totalCount: number
): number {
  if (totalCount <= 0) return -1;
  if (key === 'ArrowDown') {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % totalCount;
  }
  if (key === 'ArrowUp') {
    return currentIndex <= 0 ? totalCount - 1 : currentIndex - 1;
  }
  return currentIndex;
}

export interface TypeaheadKeyState {
  isOpen: boolean;
  activeIndex: number;
  itemCount: number;
}

export interface TypeaheadKeyTransition {
  isOpen: boolean;
  activeIndex: number;
  action: 'navigate' | 'select' | 'close' | 'open' | 'passthrough';
  preventDefault: boolean;
}

/**
 * Pure keyboard transition logic for the accessible CityTypeahead combobox.
 */
export function reduceTypeaheadKeyDown(
  state: TypeaheadKeyState,
  key: string
): TypeaheadKeyTransition {
  const { isOpen, activeIndex, itemCount } = state;

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (itemCount <= 0) {
      return { isOpen, activeIndex: -1, action: 'passthrough', preventDefault: false };
    }
    if (!isOpen) {
      return {
        isOpen: true,
        activeIndex: key === 'ArrowDown' ? 0 : itemCount - 1,
        action: 'open',
        preventDefault: true,
      };
    }
    return {
      isOpen: true,
      activeIndex: nextTypeaheadIndex(activeIndex, key, itemCount),
      action: 'navigate',
      preventDefault: true,
    };
  }

  if (key === 'Escape') {
    if (!isOpen) {
      return { isOpen: false, activeIndex: -1, action: 'passthrough', preventDefault: false };
    }
    return {
      isOpen: false,
      activeIndex: -1,
      action: 'close',
      preventDefault: true,
    };
  }

  if (key === 'Enter') {
    if (isOpen && activeIndex >= 0 && activeIndex < itemCount) {
      return {
        isOpen: false,
        activeIndex,
        action: 'select',
        preventDefault: true,
      };
    }
    return {
      isOpen: false,
      activeIndex: -1,
      action: 'passthrough',
      preventDefault: false,
    };
  }

  return { isOpen, activeIndex, action: 'passthrough', preventDefault: false };
}

export async function fetchCitySuggestions(
  q: string,
  options: { limit?: number; signal?: AbortSignal } = {}
): Promise<CitySuggestion[]> {
  const trimmed = q.trim();
  if (trimmed.length < CITY_SEARCH_MIN_CHARS) {
    return [];
  }
  const limit = Math.min(10, Math.max(1, options.limit ?? 8));
  const data = await apiFetch<{ cities?: CitySuggestion[] }>(
    `/destinations/cities?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
    {
      signal: options.signal,
      timeoutMs: 8000,
    }
  );
  return Array.isArray(data?.cities) ? data.cities : [];
}

