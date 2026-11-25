export type RailBusMode = 'train' | 'bus';

export const IRCTC_TRAIN_SEARCH_URL = 'https://www.irctc.co.in/nget/train-search';
export const REDBUS_URL = 'https://www.redbus.in/';

/**
 * Exact web mirror of mobile TrainsAndBusesScreen.js link builder:
 *   const targetUrl = bookingUrl || (mode === 'train'
 *     ? 'https://www.irctc.co.in/nget/train-search'
 *     : 'https://www.redbus.in/');
 *
 * Neither IRCTC nor RedBus supports prefilled query parameters or affiliate codes.
 */
export function buildRailBusUrl(
  mode: RailBusMode,
  bookingUrl?: string | null
): string {
  if (typeof bookingUrl === 'string' && bookingUrl.trim()) {
    return bookingUrl.trim();
  }
  return mode === 'train' ? IRCTC_TRAIN_SEARCH_URL : REDBUS_URL;
}

export function getRailBusProviderLabel(mode: RailBusMode): 'IRCTC' | 'RedBus' {
  return mode === 'train' ? 'IRCTC' : 'RedBus';
}

export function getRailBusDisclosure(mode: RailBusMode): {
  headline: string;
  detail: string;
} {
  if (mode === 'train') {
    return {
      headline: 'Opens IRCTC. Nothing is booked here.',
      detail:
        'IRCTC does not support prefilled deep links. Open IRCTC Train Search directly to check live PNR, Tatkal, seat availability, and book tickets.',
    };
  }
  return {
    headline: 'Opens RedBus. Nothing is booked here.',
    detail:
      'RedBus does not support prefilled external search links. Open RedBus directly to browse private and state bus operators, boarding points, and book seats.',
  };
}

