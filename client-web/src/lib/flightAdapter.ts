import { FLIGHTS_TEST_MODE } from '../config/features.ts';

export interface FlightSegment {
  id?: string;
  originIata: string;
  originName?: string;
  originCity?: string;
  destinationIata: string;
  destinationName?: string;
  destinationCity?: string;
  departingAt: string; // local ISO string
  arrivingAt: string; // local ISO string
  durationMinutes: number | null;
  durationIso?: string | null;
  carrierName?: string;
  carrierCode?: string;
  flightNumber?: string;
  aircraftName?: string;
  baggageSummary?: string | null;
}

export interface FlightSlice {
  id?: string;
  originIata: string;
  originName?: string;
  originCity?: string;
  destinationIata: string;
  destinationName?: string;
  destinationCity?: string;
  departureTime: string; // local ISO
  arrivalTime: string; // local ISO
  durationMinutes: number | null;
  durationIso: string | null;
  stops: number;
  segments: FlightSegment[];
}

export interface FlightOffer {
  id: string;
  carrier: {
    name: string;
    code?: string;
  };
  flightNumbers: string[];
  slices: FlightSlice[];
  stops: number;
  totalPrice: {
    amount: string;
    currency: string;
  };
  perAdultApprox: {
    amount: string;
    currency: string;
  } | null;
  baggage: string | null;
  refundConditions: string | null;
  changeConditions: string | null;
  expiresAt: string | null;
  isTest: boolean;
  passengerIdentityDocumentsRequired?: boolean;
  // Raw times & duration at top level for easy table access
  departureTime: string;
  arrivalTime: string;
  durationIso: string | null;
  durationMinutes: number | null;
  originIata: string;
  destinationIata: string;
}

export type StopsFilter = 'any' | 'nonstop' | '1stop' | '2plus';
export type DepartureTimeBand = 'morning' | 'afternoon' | 'evening' | 'night';
export type FlightSortKey = 'cheapest' | 'fastest' | 'earliest';

export interface FlightFilters {
  stops?: StopsFilter;
  airlines?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  timeBands?: DepartureTimeBand[];
}

/**
 * Parses an ISO 8601 duration string into total minutes.
 * Supports P#DT#H#M, PT#H#M, PT#M, PT#H, P#D.
 * Invalid, empty or garbage inputs return null.
 */
export function parseIsoDuration(isoDuration: string | null | undefined): number | null {
  if (!isoDuration || typeof isoDuration !== 'string') return null;
  const trimmed = isoDuration.trim();
  if (!trimmed) return null;

  // Regex strictly matching ISO 8601 duration format: P[nD][T[nH][nM][nS]]
  const match = trimmed.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;

  const daysStr = match[1];
  const hoursStr = match[2];
  const minutesStr = match[3];

  // Must contain at least one meaningful duration component
  if (daysStr === undefined && hoursStr === undefined && minutesStr === undefined) {
    return null;
  }

  const days = daysStr ? parseInt(daysStr, 10) : 0;
  const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
  const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;

  if (isNaN(days) || isNaN(hours) || isNaN(minutes)) return null;

  return days * 24 * 60 + hours * 60 + minutes;
}

/**
 * Formats total minutes into human-readable duration:
 * e.g. 555 -> "9h 15m", 60 -> "1h", 135 -> "2h 15m", 59 -> "59m", 0 -> "0m".
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes) || minutes < 0) return '--';
  const mins = Math.floor(minutes);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hours > 0 && remMins > 0) {
    return `${hours}h ${remMins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remMins}m`;
}

/**
 * Extracts written clock digits HH:MM without timezone conversion.
 * Showing the local clock digits exactly as provided by the airline.
 */
export function formatLocalTime(isoString: string | null | undefined): string | null {
  if (!isoString || typeof isoString !== 'string') return null;
  const match = isoString.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

/**
 * Formats date label from the DATE parts only of the ISO string (YYYY-MM-DD),
 * avoiding any browser-timezone shifting. e.g. "20 Nov".
 */
export function formatDateLabel(isoString: string | null | undefined): string {
  if (!isoString || typeof isoString !== 'string') return '';
  const match = isoString.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, , monthStr, dayStr] = match;
  const monthIdx = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx] || '';
  return `${day} ${monthName}`;
}

/**
 * Computes layover duration in minutes between two connecting flight segments.
 *
 * NOTE: Total trip duration must come directly from Duffel's slice duration and NEVER
 * from subtracting origin departure time from destination arrival time, because origin
 * and destination are in different timezones with unknown UTC offsets.
 * In contrast, layoverMinutes IS valid because both arrival and departure occur at the
 * exact same airport, sharing the same local timezone.
 *
 * Handles midnight rollover cleanly. Returns null if airports differ or times are invalid.
 */
export function layoverMinutes(
  prevArrivingLocal: string | null | undefined,
  nextDepartingLocal: string | null | undefined,
  prevArrivalAirport?: string | null,
  nextDepartureAirport?: string | null
): number | null {
  if (!prevArrivingLocal || !nextDepartingLocal) return null;

  // If airport codes are provided, they must be the same airport
  if (
    prevArrivalAirport &&
    nextDepartureAirport &&
    prevArrivalAirport.toUpperCase() !== nextDepartureAirport.toUpperCase()
  ) {
    return null;
  }

  // Parse local datetime assuming same local timezone by anchoring with Z
  const cleanArr = prevArrivingLocal.replace(/Z|[+-]\d{2}:?\d{2}$/, '');
  const cleanDep = nextDepartingLocal.replace(/Z|[+-]\d{2}:?\d{2}$/, '');

  const arrDate = new Date(`${cleanArr}Z`);
  const depDate = new Date(`${cleanDep}Z`);

  if (isNaN(arrDate.getTime()) || isNaN(depDate.getTime())) return null;

  const diffMs = depDate.getTime() - arrDate.getTime();
  if (diffMs < 0) return null;

  return Math.round(diffMs / 60000);
}

/**
 * Formats a currency amount string or number using Intl.NumberFormat with the offer's currency.
 * No hardcoded currency symbols or conversion.
 */
export function formatMoney(amount: string | number | null | undefined, currency?: string | null): string {
  if (amount == null) return '';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(amount);

  const cleanCurrency = currency && currency.trim() ? currency.trim().toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cleanCurrency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${cleanCurrency} ${num.toFixed(2)}`;
  }
}

/**
 * Checks whether an offer has expired against the given reference time (defaults to now).
 */
export function isExpired(
  offer: { expiresAt?: string | null; expires_at?: string | null },
  now: Date = new Date()
): boolean {
  const exp = offer?.expiresAt || offer?.expires_at;
  if (!exp) return false;
  const expTime = new Date(exp).getTime();
  if (isNaN(expTime)) return false;
  return expTime <= now.getTime();
}

/**
 * Normalizes a raw backend or Duffel offer object into the UI model.
 * Handles both the backend's trimmed output and richer Duffel fixtures.
 * NEVER invents fields (e.g. no refundable: false when conditions are absent).
 */
export function toFlightOffer(
  raw: any,
  context?: { origin?: string; destination?: string; adults?: number }
): FlightOffer {
  const id = raw.offerId || raw.id || '';
  const carrierName =
    raw.airline ||
    raw.airlineName ||
    raw.owner?.name ||
    'Airline';
  const carrierCode = raw.owner?.iata_code || (raw.airline ? raw.airline.slice(0, 2).toUpperCase() : undefined);

  const totalAmount = raw.price?.amount || raw.total_amount || '0';
  const totalCurrency = raw.price?.currency || raw.total_currency || 'USD';

  const adults = context?.adults && context.adults > 0 ? context.adults : 1;
  const totalNum = parseFloat(totalAmount);
  let perAdultApprox: { amount: string; currency: string } | null = null;
  if (!isNaN(totalNum) && adults > 1) {
    const approx = (totalNum / adults).toFixed(2);
    perAdultApprox = {
      amount: approx,
      currency: totalCurrency,
    };
  }

  // Slices & segments normalization
  let slices: FlightSlice[] = [];
  let stops = 0;
  let flightNumbers: string[] = [];
  let baggageSummary: string | null = null;
  let refundConditions: string | null = null;
  let changeConditions: string | null = null;

  if (Array.isArray(raw.slices) && raw.slices.length > 0) {
    slices = raw.slices.map((rawSlice: any) => {
      const sliceSegments: FlightSegment[] = Array.isArray(rawSlice.segments)
        ? rawSlice.segments.map((seg: any) => {
            const segDurationMin = parseIsoDuration(seg.duration);
            const fn =
              seg.marketing_carrier_flight_number ||
              seg.operating_carrier_flight_number ||
              (seg.marketing_carrier?.iata_code && seg.flight_number
                ? `${seg.marketing_carrier.iata_code} ${seg.flight_number}`
                : undefined);
            if (fn && !flightNumbers.includes(fn)) {
              flightNumbers.push(fn);
            }

            // Baggage from passengers in segment
            let segBaggage: string | null = null;
            if (Array.isArray(seg.passengers)) {
              for (const p of seg.passengers) {
                if (Array.isArray(p.baggages) && p.baggages.length > 0) {
                  segBaggage = p.baggages
                    .map((b: any) => `${b.quantity || 1} ${b.type || 'bag'}`)
                    .join(', ');
                  if (!baggageSummary) {
                    baggageSummary = segBaggage;
                  }
                  break;
                }
              }
            }

            return {
              id: seg.id,
              originIata: seg.origin?.iata_code || seg.origin_iata_code || '',
              originName: seg.origin?.name,
              originCity: seg.origin?.city_name || seg.origin?.city?.name,
              destinationIata: seg.destination?.iata_code || seg.destination_iata_code || '',
              destinationName: seg.destination?.name,
              destinationCity: seg.destination?.city_name || seg.destination?.city?.name,
              departingAt: seg.departing_at || '',
              arrivingAt: seg.arriving_at || '',
              durationMinutes: segDurationMin,
              durationIso: seg.duration || null,
              carrierName: seg.operating_carrier?.name || seg.marketing_carrier?.name || carrierName,
              carrierCode: seg.operating_carrier?.iata_code || seg.marketing_carrier?.iata_code || carrierCode,
              flightNumber: fn,
              aircraftName: seg.aircraft?.name,
              baggageSummary: segBaggage,
            };
          })
        : [];

      const sliceStops = Math.max(0, sliceSegments.length - 1);
      stops += sliceStops;

      const firstSeg = sliceSegments[0];
      const lastSeg = sliceSegments[sliceSegments.length - 1] || firstSeg;

      return {
        id: rawSlice.id,
        originIata: rawSlice.origin?.iata_code || firstSeg?.originIata || context?.origin || '',
        originName: rawSlice.origin?.name || firstSeg?.originName,
        originCity: rawSlice.origin?.city_name || firstSeg?.originCity,
        destinationIata: rawSlice.destination?.iata_code || lastSeg?.destinationIata || context?.destination || '',
        destinationName: rawSlice.destination?.name || lastSeg?.destinationName,
        destinationCity: rawSlice.destination?.city_name || lastSeg?.destinationCity,
        departureTime: firstSeg?.departingAt || rawSlice.departure_date || raw.departureTime || '',
        arrivalTime: lastSeg?.arrivingAt || raw.arrivalTime || '',
        durationMinutes: parseIsoDuration(rawSlice.duration),
        durationIso: rawSlice.duration || null,
        stops: sliceStops,
        segments: sliceSegments,
      };
    });
  } else {
    // Backend trimmed offer shape
    const depTime = raw.departureTime || '';
    const arrTime = raw.arrivalTime || '';
    const durationMinutes = parseIsoDuration(raw.duration);
    const originIata = context?.origin || '';
    const destIata = context?.destination || '';

    const singleSegment: FlightSegment = {
      originIata,
      destinationIata: destIata,
      departingAt: depTime,
      arrivingAt: arrTime,
      durationMinutes,
      durationIso: raw.duration || null,
      carrierName,
      carrierCode,
    };

    slices = [
      {
        originIata,
        destinationIata: destIata,
        departureTime: depTime,
        arrivalTime: arrTime,
        durationMinutes,
        durationIso: raw.duration || null,
        stops: 0,
        segments: [singleSegment],
      },
    ];
  }

  // Duffel conditions (only if present in raw)
  if (raw.conditions) {
    if (raw.conditions.refund_before_departure) {
      const ref = raw.conditions.refund_before_departure;
      refundConditions = ref.allowed
        ? ref.penalty_amount
          ? `Refundable (${formatMoney(ref.penalty_amount, ref.penalty_currency)} fee)`
          : 'Fully refundable'
        : 'Non-refundable';
    }
    if (raw.conditions.change_before_departure) {
      const chg = raw.conditions.change_before_departure;
      changeConditions = chg.allowed
        ? chg.penalty_amount
          ? `Changes allowed (${formatMoney(chg.penalty_amount, chg.penalty_currency)} fee)`
          : 'Free changes'
        : 'No changes';
    }
  }

  // Test mode detection
  const isTest =
    raw.isTest === true ||
    raw.live_mode === false ||
    (raw.live_mode === undefined && FLIGHTS_TEST_MODE);

  const firstSlice = slices[0];
  const lastSlice = slices[slices.length - 1] || firstSlice;

  return {
    id,
    carrier: {
      name: carrierName,
      code: carrierCode,
    },
    flightNumbers,
    slices,
    stops,
    totalPrice: {
      amount: totalAmount,
      currency: totalCurrency,
    },
    perAdultApprox,
    baggage: baggageSummary,
    refundConditions,
    changeConditions,
    expiresAt: raw.expiresAt || raw.expires_at || null,
    isTest,
    passengerIdentityDocumentsRequired: !!(
      raw.passenger_identity_documents_required ||
      raw.passengerIdentityDocumentsRequired
    ),
    departureTime: firstSlice?.departureTime || raw.departureTime || '',
    arrivalTime: lastSlice?.arrivalTime || raw.arrivalTime || '',
    durationIso: firstSlice?.durationIso || raw.duration || null,
    durationMinutes: firstSlice?.durationMinutes || parseIsoDuration(raw.duration),
    originIata: firstSlice?.originIata || context?.origin || '',
    destinationIata: lastSlice?.destinationIata || context?.destination || '',
  };
}

/**
 * Filter offers pure function
 */
export function filterOffers(offers: FlightOffer[], filters: FlightFilters): FlightOffer[] {
  return offers.filter((offer) => {
    // Stops filter
    if (filters.stops && filters.stops !== 'any') {
      if (filters.stops === 'nonstop' && offer.stops !== 0) return false;
      if (filters.stops === '1stop' && offer.stops !== 1) return false;
      if (filters.stops === '2plus' && offer.stops < 2) return false;
    }

    // Airline filter
    if (filters.airlines && filters.airlines.length > 0) {
      if (!filters.airlines.includes(offer.carrier.name)) return false;
    }

    // Price range
    const priceNum = parseFloat(offer.totalPrice.amount);
    if (!isNaN(priceNum)) {
      if (filters.minPrice != null && priceNum < filters.minPrice) return false;
      if (filters.maxPrice != null && priceNum > filters.maxPrice) return false;
    }

    // Departure time band filter (local clock hour)
    if (filters.timeBands && filters.timeBands.length > 0) {
      const timeStr = formatLocalTime(offer.departureTime);
      if (!timeStr) return false;
      const hour = parseInt(timeStr.slice(0, 2), 10);
      const matchesBand = filters.timeBands.some((band) => {
        if (band === 'morning') return hour >= 5 && hour < 12;
        if (band === 'afternoon') return hour >= 12 && hour < 18;
        if (band === 'evening') return hour >= 18 && hour < 22;
        if (band === 'night') return hour >= 22 || hour < 5;
        return false;
      });
      if (!matchesBand) return false;
    }

    return true;
  });
}

/**
 * Sort offers pure function with stable sort semantics.
 */
export function sortOffers(offers: FlightOffer[], sortKey: FlightSortKey): FlightOffer[] {
  const indexed = offers.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    if (sortKey === 'cheapest') {
      const priceA = parseFloat(a.item.totalPrice.amount) || 0;
      const priceB = parseFloat(b.item.totalPrice.amount) || 0;
      if (priceA !== priceB) return priceA - priceB;
    } else if (sortKey === 'fastest') {
      const durA = a.item.durationMinutes ?? Number.MAX_SAFE_INTEGER;
      const durB = b.item.durationMinutes ?? Number.MAX_SAFE_INTEGER;
      if (durA !== durB) return durA - durB;
    } else if (sortKey === 'earliest') {
      const timeA = a.item.departureTime || '';
      const timeB = b.item.departureTime || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
    }
    // Stable tie-breaker
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
}

/**
 * Router decision for FlightDetailPage:
 * 'live' | 'sample' | 'notfound'
 */
export function flightDetailView({
  selectedOffer,
  selectedFlightId,
  mockIds,
  showSample,
}: {
  selectedOffer: FlightOffer | null;
  selectedFlightId: string | null;
  mockIds: string[];
  showSample: boolean;
}): 'live' | 'sample' | 'notfound' {
  if (selectedOffer) {
    return 'live';
  }
  if (showSample && selectedFlightId && mockIds.includes(selectedFlightId)) {
    return 'sample';
  }
  return 'notfound';
}
