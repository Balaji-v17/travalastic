import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import {
  type Role,
  type Journey,
  type Booking,
  type Notification,
  bookings as initialBookings,
  currentTraveler,
  type Traveler,
  type ItineraryDay,
  type VisaApplication,
} from '../data/mockData';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/auth';
import {
  toJourney,
  type BackendSavedItinerary,
  type BackendBooking,
} from '../lib/journeyAdapter';
import { listRecordedBookings, type MergedBookingItem } from '../lib/bookingsApi';
import { SHOW_SAMPLE_PAGES } from '../config/features.ts';

import {
  normalizeBookTab,
  resolveBookAlias,
  type BookTab,
  type Page,
} from '../lib/pageStatus';
export type { BookTab, Page } from '../lib/pageStatus';
import {
  formatHashRoute,
  parseHashRoute,
  resolveOpenBookTarget,
  type BookPrefill,
} from '../lib/bookRouting';
export type { BookPrefill } from '../lib/bookRouting';
import type { ExternalBookingKind } from '../lib/handoff';
import type { PlaceResult } from '../lib/destinationView';
export type { PlaceResult } from '../lib/destinationView';
import type {
  FlightOffer,
  StopsFilter,
  DepartureTimeBand,
  FlightSortKey,
} from '../lib/flightAdapter';
export type { FlightOffer } from '../lib/flightAdapter';
import type { StyleKey } from '../data/styleCollections';
export type { StyleKey } from '../data/styleCollections';

export interface SearchQuery {
  destination: string;
  destinationId?: string;
  from?: string;
  dates: string;
  checkIn?: string;
  checkOut?: string;
  travelers: number;
  cabin?: string;
  type: 'flights' | 'hotels' | 'experiences' | 'packages';
  travelStyle?: string;
}

export interface FlightSearchSessionState {
  originIata: string | null;
  destIata: string | null;
  departureDate: string;
  adults: number;
  searchStatus: 'idle' | 'loading' | 'results' | 'empty' | 'error';
  rawOffers: FlightOffer[];
  searchErrorMessage: string;
  flightSort: FlightSortKey;
  stopsFilter: StopsFilter;
  airlineFilters: string[];
  timeBandFilters: DepartureTimeBand[];
  minPriceInput: string;
  maxPriceInput: string;
}

export interface RailBusPrefill {
  origin?: string;
  destination?: string;
}

export interface RecordedBookingPrefill {
  kind: ExternalBookingKind;
  provider: string;
}

export interface BookingFlowState {
  type: 'flight' | 'hotel' | 'activity';
  itemId: string;
  journeyId?: string;
  itineraryItemId?: string;
  destinationId?: string;
  source?: 'search' | 'destination' | 'journey' | 'deals' | 'ai-planner' | 'hotel-detail' | 'experience-detail';
}

export interface HotelsQuery {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
}

interface AppState {
  page: Page;
  activeBookTab: BookTab;
  previousPage: Page | null;
  journeys: Journey[];
  journeysStatus: 'idle' | 'loading' | 'ready' | 'error';
  bookings: Booking[];
  traveler: Traveler;
  notifications: Notification[];
  selectedJourneyId: string | null;
  selectedDestinationId: string | null;
  selectedPlace: PlaceResult | null;
  selectedHotelId: string | null;
  selectedExperienceId: string | null;
  selectedFlightId: string | null;
  selectedOffer: FlightOffer | null;
  selectedPackageId: string | null;
  bookingFlow: BookingFlowState | null;
  searchQuery: SearchQuery;
  hotelsQuery: HotelsQuery | null;
  flightSearchSession: FlightSearchSessionState;
  railBusPrefill: RailBusPrefill | null;
  pendingRecordedBookingPrefill: RecordedBookingPrefill | null;
  plannerDestination: string;
  plannerDestinationId: string;
  activeDisruption: import('../data/mockData').Disruption | null;
  disruptionSimulated: boolean;
  savedDestinationIds: string[];
  visaApplications: VisaApplication[];
  isTravelAssistantOpen: boolean;
  travelAssistantInitialMessage: string;
  isGlobalSearchOpen: boolean;
  globalSearchInitialQuery: string;
  selectedStyle: StyleKey | null;
  transportTab: 'cab' | 'rental';
  transportPrefill: TransportPrefill | null;
}

export interface TransportPrefill {
  destination?: string;
  place?: PlaceResult | null;
  lat?: number;
  lon?: number;
  dropoffName?: string;
}

interface AppActions {
  navigate: (page: Page, params?: {
    bookTab?: BookTab | string;
    selectedJourneyId?: string | null;
    selectedDestinationId?: string | null;
    selectedPlace?: PlaceResult | null;
    selectedHotelId?: string | null;
    selectedExperienceId?: string | null;
    selectedPackageId?: string | null;
    selectedStyle?: StyleKey | null;
    bookingFlow?: BookingFlowState | null;
    transportTab?: 'cab' | 'rental';
    transportPrefill?: TransportPrefill | null;
    [key: string]: unknown;
  }) => void;
  openBook: (tab?: BookTab | string | null, prefill?: BookPrefill | null) => void;
  setActiveBookTab: (tab: BookTab) => void;
  setFlightSearchSession: (updater: Partial<FlightSearchSessionState> | ((prev: FlightSearchSessionState) => FlightSearchSessionState)) => void;
  openBookingsWithPrefill: (prefill: RecordedBookingPrefill) => void;
  clearRecordedBookingPrefill: () => void;
  navigateToPackage: (packageId: string) => void;
  setSearchQuery: (q: Partial<SearchQuery>) => void;
  setHotelsQuery: (q: HotelsQuery | null) => void;
  openHotels: (query?: Partial<HotelsQuery> | null) => void;
  setTransportTab: (tab: 'cab' | 'rental') => void;
  openTransport: (tab?: 'cab' | 'rental', prefill?: TransportPrefill | null) => void;
  openStyle: (key: StyleKey) => void;
  startBookingFlow: (flow: BookingFlowState) => void;
  confirmBooking: (booking: Booking) => void;
  createJourney: (journey: Omit<Journey, 'id'>) => string;
  refreshJourneys: () => Promise<void>;
  clearJourneys: () => void;
  setSignedInUserId: (id: string) => void;
  updateItineraryItemStatus: (journeyId: string, itemId: string, status: import('../data/mockData').ItineraryItemStatus, bookingId?: string) => void;
  navigateToHotel: (hotelId: string, context?: { journeyId?: string; itineraryItemId?: string }) => void;
  navigateToExperience: (experienceId: string, context?: { journeyId?: string; itineraryItemId?: string }) => void;
  navigateToFlight: (flightId: string, context?: { journeyId?: string; itineraryItemId?: string }) => void;
  navigateBack: () => void;
  toggleSaveDestination: (destinationId: string) => void;
  updateJourneyStatus: (journeyId: string, status: Journey['status']) => void;
  updateJourneyCover: (journeyId: string, coverImage: import('../data/mockData').TripCoverImage) => void;
  markNotificationRead: (id: string) => void;
  simulateDisruption: () => void;
  resolveDisruption: (id: string) => void;
  dismissDisruption: () => void;
  setPlannerDestination: (name: string, id?: string) => void;
  openPlace: (place: PlaceResult) => void;
  openOffer: (offer: FlightOffer) => void;
  addNotificationToJourney: (journeyId: string, notif: Notification) => void;
  addVisaApplication: (app: VisaApplication) => void;
  updateVisaApplication: (id: string, updates: Partial<VisaApplication>) => void;
  openTravelAssistant: (initialMessage?: string) => void;
  closeTravelAssistant: () => void;
  clearTravelAssistantInitialMessage: () => void;
  openGlobalSearch: (initialQuery?: string) => void;
  closeGlobalSearch: () => void;
}

type AppContextType = AppState & AppActions;

const AppContext = createContext<AppContextType | null>(null);

const defaultSearch: SearchQuery = {
  destination: '',
  destinationId: '',
  dates: '',
  travelers: 2,
  type: 'flights',
};

const defaultFlightSearchSession: FlightSearchSessionState = {
  originIata: null,
  destIata: null,
  departureDate: '',
  adults: 1,
  searchStatus: 'idle',
  rawOffers: [],
  searchErrorMessage: '',
  flightSort: 'cheapest',
  stopsFilter: 'any',
  airlineFilters: [],
  timeBandFilters: [],
  minPriceInput: '',
  maxPriceInput: '',
};

function getInitialRouteFromHash(): { page: Page; tab: BookTab } {
  if (typeof window === 'undefined') return { page: 'home', tab: 'flights' };
  const parsed = parseHashRoute(window.location.hash || '');
  return {
    page: parsed.page,
    tab: parsed.tab || 'flights',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initialRoute = getInitialRouteFromHash();
  const [page, setPage] = useState<Page>(initialRoute.page);
  const [activeBookTab, setActiveBookTabState] = useState<BookTab>(initialRoute.tab);
  const activeBookTabRef = useRef<BookTab>(initialRoute.tab);
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const pageRef = useRef<Page>(initialRoute.page);
  const [savedDestinationIds, setSavedDestinationIds] = useState<string[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysStatus, setJourneysStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [signedInUserId, setSignedInUserIdState] = useState<string>('');
  const signedInUserIdRef = useRef<string>('');
  const [appBookings, setAppBookings] = useState<Booking[]>(SHOW_SAMPLE_PAGES ? initialBookings : []);
  const [traveler] = useState<Traveler>(currentTraveler);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [bookingFlow, setBookingFlow] = useState<BookingFlowState | null>(null);
  const [searchQuery, setSearchQueryState] = useState<SearchQuery>(defaultSearch);
  const [hotelsQuery, setHotelsQuery] = useState<HotelsQuery | null>(null);
  const [flightSearchSession, setFlightSearchSessionState] = useState<FlightSearchSessionState>(defaultFlightSearchSession);
  const [railBusPrefill, setRailBusPrefill] = useState<RailBusPrefill | null>(null);
  const [pendingRecordedBookingPrefill, setPendingRecordedBookingPrefill] = useState<RecordedBookingPrefill | null>(null);
  const [plannerDestination, setPlannerDestinationState] = useState('');
  const [plannerDestinationId, setPlannerDestinationId] = useState('');
  const [activeDisruption, setActiveDisruption] = useState<import('../data/mockData').Disruption | null>(null);
  const [disruptionSimulated, setDisruptionSimulated] = useState(false);
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);
  const [isTravelAssistantOpen, setIsTravelAssistantOpen] = useState(false);
  const [travelAssistantInitialMessage, setTravelAssistantInitialMessage] = useState('');
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchInitialQuery, setGlobalSearchInitialQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleKey | null>(null);
  const [transportTab, setTransportTab] = useState<'cab' | 'rental'>(
    initialRoute.tab === 'rental' ? 'rental' : 'cab'
  );
  const [transportPrefill, setTransportPrefill] = useState<TransportPrefill | null>(null);

  const syncHash = useCallback((nextPage: Page, nextTab?: BookTab) => {
    if (typeof window === 'undefined') return;
    const nextHash = formatHashRoute(nextPage, nextTab);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const parsed = parseHashRoute(window.location.hash || '');
      if (parsed.tab) {
        activeBookTabRef.current = parsed.tab;
        setActiveBookTabState(parsed.tab);
        if (parsed.tab === 'cab' || parsed.tab === 'rental') {
          setTransportTab(parsed.tab);
        }
      }
      if (parsed.page !== pageRef.current) {
        setPreviousPage(pageRef.current);
        pageRef.current = parsed.page;
        setPage(parsed.page);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setActiveBookTab = useCallback((tab: BookTab) => {
    const resolved = normalizeBookTab(tab);
    activeBookTabRef.current = resolved;
    setActiveBookTabState(resolved);
    if (resolved === 'cab' || resolved === 'rental') {
      setTransportTab(resolved);
    }
    if (pageRef.current === 'book') {
      syncHash('book', resolved);
    }
  }, [syncHash]);

  const setFlightSearchSession = useCallback(
    (updater: Partial<FlightSearchSessionState> | ((prev: FlightSearchSessionState) => FlightSearchSessionState)) => {
      setFlightSearchSessionState((prev) =>
        typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      );
    },
    []
  );

  const openBook = useCallback(
    (tab?: BookTab | string | null, prefill?: BookPrefill | null) => {
      const target = resolveOpenBookTarget(tab);
      activeBookTabRef.current = target.tab;
      setActiveBookTabState(target.tab);

      if (prefill) {
        if (target.tab === 'flights') {
          setFlightSearchSessionState((prev) => ({
            ...prev,
            ...(prefill.from ? { originIata: prefill.from.toUpperCase() } : {}),
            ...(prefill.destination && /^[A-Za-z]{3}$/.test(prefill.destination)
              ? { destIata: prefill.destination.toUpperCase() }
              : {}),
            ...(prefill.dates ? { departureDate: prefill.dates } : {}),
            ...(prefill.travelers ? { adults: Math.max(1, Math.min(9, prefill.travelers)) } : {}),
          }));
        } else if (target.tab === 'hotels') {
          setHotelsQuery((prev) => ({
            destination: prefill.destination || prev?.destination || '',
            checkIn: prefill.checkIn ?? prev?.checkIn,
            checkOut: prefill.checkOut ?? prev?.checkOut,
            guests: prefill.guests ?? prev?.guests ?? 2,
            rooms: prefill.rooms ?? prev?.rooms ?? 1,
          }));
        } else if (target.tab === 'cab' || target.tab === 'rental') {
          setTransportTab(target.tab);
          setTransportPrefill({
            destination: prefill.destination,
            place: prefill.place as PlaceResult | null | undefined,
            lat: prefill.lat,
            lon: prefill.lon,
            dropoffName: prefill.dropoffName,
          });
        } else if (target.tab === 'trains' || target.tab === 'buses') {
          setRailBusPrefill({
            origin: prefill.origin,
            destination: prefill.destination,
          });
        }
      } else if (target.tab === 'cab' || target.tab === 'rental') {
        setTransportTab(target.tab);
      }

      setPreviousPage(pageRef.current);
      pageRef.current = 'book';
      setPage('book');
      syncHash('book', target.tab);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [syncHash]
  );

  const openTransport = useCallback((tab: 'cab' | 'rental' = 'cab', prefill?: TransportPrefill | null) => {
    openBook(tab, prefill || null);
  }, [openBook]);

  const openBookingsWithPrefill = useCallback((prefill: RecordedBookingPrefill) => {
    setPendingRecordedBookingPrefill(prefill);
    setPreviousPage(pageRef.current);
    pageRef.current = 'my-bookings';
    setPage('my-bookings');
    syncHash('my-bookings');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const clearRecordedBookingPrefill = useCallback(() => {
    setPendingRecordedBookingPrefill(null);
  }, []);

  const openTravelAssistant = useCallback((initialMessage?: string) => {
    if (initialMessage) {
      setTravelAssistantInitialMessage(initialMessage);
    }
    setIsTravelAssistantOpen(true);
  }, []);

  const closeTravelAssistant = useCallback(() => {
    setIsTravelAssistantOpen(false);
  }, []);

  const clearTravelAssistantInitialMessage = useCallback(() => {
    setTravelAssistantInitialMessage('');
  }, []);

  const openGlobalSearch = useCallback((initialQuery = '') => {
    setGlobalSearchInitialQuery(typeof initialQuery === 'string' ? initialQuery : '');
    setIsGlobalSearchOpen(true);
  }, []);

  const closeGlobalSearch = useCallback(() => {
    setIsGlobalSearchOpen(false);
  }, []);

  const openStyle = useCallback((key: StyleKey) => {
    setSelectedStyle(key);
    setPreviousPage(pageRef.current);
    pageRef.current = 'style-collection';
    setPage('style-collection');
    syncHash('style-collection');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const allNotifications = journeys.flatMap((j) => j.notifications);

  const navigateBack = useCallback(() => {
    if (previousPage) {
      const resolved = resolveBookAlias(previousPage);
      if (resolved.page === 'book' && resolved.tab) {
        activeBookTabRef.current = resolved.tab;
        setActiveBookTabState(resolved.tab);
      }
      pageRef.current = resolved.page;
      setPage(resolved.page);
      syncHash(resolved.page, resolved.tab || activeBookTabRef.current);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      pageRef.current = 'home';
      setPage('home');
      syncHash('home');
    }
  }, [previousPage, syncHash]);

  const toggleSaveDestination = useCallback((destinationId: string) => {
    setSavedDestinationIds((prev) =>
      prev.includes(destinationId) ? prev.filter((id) => id !== destinationId) : [...prev, destinationId]
    );
  }, []);

  const navigate = useCallback((p: Page, params?: {
    bookTab?: BookTab | string;
    selectedJourneyId?: string | null;
    selectedDestinationId?: string | null;
    selectedPlace?: PlaceResult | null;
    selectedHotelId?: string | null;
    selectedExperienceId?: string | null;
    selectedPackageId?: string | null;
    selectedStyle?: StyleKey | null;
    bookingFlow?: BookingFlowState | null;
    transportTab?: 'cab' | 'rental';
    transportPrefill?: TransportPrefill | null;
    [key: string]: unknown;
  }) => {
    const resolved = resolveBookAlias(p, params?.transportTab);
    const targetPage = resolved.page;
    const targetTab = resolved.tab || (params?.bookTab ? normalizeBookTab(String(params.bookTab)) : activeBookTabRef.current);

    setPreviousPage(pageRef.current);
    pageRef.current = targetPage;
    setPage(targetPage);

    if (targetPage === 'book') {
      activeBookTabRef.current = targetTab;
      setActiveBookTabState(targetTab);
      if (targetTab === 'cab' || targetTab === 'rental') {
        setTransportTab(targetTab);
      }
    }

    if (params?.selectedJourneyId !== undefined) setSelectedJourneyId(params.selectedJourneyId);
    if (params?.selectedDestinationId !== undefined) setSelectedDestinationId(params.selectedDestinationId);
    if (params?.selectedPlace !== undefined) setSelectedPlace(params.selectedPlace);
    if (params?.selectedHotelId !== undefined) setSelectedHotelId(params.selectedHotelId);
    if (params?.selectedExperienceId !== undefined) setSelectedExperienceId(params.selectedExperienceId);
    if (params?.selectedPackageId !== undefined) setSelectedPackageId(params.selectedPackageId);
    if (params?.selectedStyle !== undefined) setSelectedStyle(params.selectedStyle);
    if (params?.bookingFlow !== undefined) setBookingFlow(params.bookingFlow);
    if (params?.transportTab !== undefined) setTransportTab(params.transportTab);
    if (params?.transportPrefill !== undefined) setTransportPrefill(params.transportPrefill);
    syncHash(targetPage, targetTab);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const setSearchQuery = useCallback((q: Partial<SearchQuery>) => {
    setSearchQueryState((prev) => ({ ...prev, ...q }));
  }, []);

  const startBookingFlow = useCallback((flow: BookingFlowState) => {
    setPreviousPage(pageRef.current);
    setBookingFlow(flow);
    pageRef.current = 'booking-flow';
    setPage('booking-flow');
    window.scrollTo({ top: 0 });
  }, []);

  const createJourney = useCallback((journey: Omit<Journey, 'id'>): string => {
    const id = `jrn-${Date.now()}`;
    const newJourney: Journey = { ...journey, id };
    setJourneys((prev) => [newJourney, ...prev]);
    return id;
  }, []);

  const setSignedInUserId = useCallback((id: string) => {
    signedInUserIdRef.current = id;
    setSignedInUserIdState(id);
  }, []);

  const clearJourneys = useCallback(() => {
    setJourneys([]);
    setJourneysStatus('idle');
    setAppBookings(SHOW_SAMPLE_PAGES ? initialBookings : []);
    setSelectedJourneyId(null);
  }, []);

  const refreshJourneys = useCallback(async () => {
    const token = getToken();
    if (!token) {
      clearJourneys();
      return;
    }

    setJourneysStatus('loading');
    try {
      const [rawItineraries, rawBookings, rawRecorded] = await Promise.all([
        apiFetch<BackendSavedItinerary[]>('/itinerary/mine'),
        apiFetch<BackendBooking[]>('/bookings/mine').catch(() => [] as BackendBooking[]),
        listRecordedBookings().catch(() => [] as MergedBookingItem[]),
      ]);

      const bookingsByItinId = new Map<string, BackendBooking[]>();
      if (Array.isArray(rawBookings)) {
        for (const b of rawBookings) {
          if (b.itineraryId) {
            const key = String(b.itineraryId);
            if (!bookingsByItinId.has(key)) bookingsByItinId.set(key, []);
            bookingsByItinId.get(key)!.push(b);
          }
        }
      }

      const recordedByTripId = new Map<string, MergedBookingItem[]>();
      if (Array.isArray(rawRecorded)) {
        for (const rb of rawRecorded) {
          if (rb.tripId) {
            const key = String(rb.tripId);
            if (!recordedByTripId.has(key)) recordedByTripId.set(key, []);
            recordedByTripId.get(key)!.push(rb);
          }
        }
      }

      const converted = (rawItineraries || []).map((it) => {
        const itinId = String(it._id || it.id || it.itineraryId || '');
        const matched = bookingsByItinId.get(itinId) || [];
        const matchedRecorded = recordedByTripId.get(itinId) || [];
        return toJourney(it, matched, signedInUserIdRef.current, matchedRecorded);
      });

      const realBookings: Booking[] = (Array.isArray(rawBookings) ? rawBookings : []).map((b) => ({
        id: String(b._id || b.id || ''),
        journeyId: b.itineraryId ? String(b.itineraryId) : '',
        travelerId: signedInUserIdRef.current,
        type: 'flight',
        status: (b.status === 'cancelled' ? 'cancelled' : 'confirmed') as any,
        referenceId: b.bookingReference || '',
        supplierId: b.orderId || '',
        supplierName: b.airline || 'Airline',
        itemName: `${b.airline || 'Flight'}: ${b.origin} → ${b.destination}`,
        itemDetails: `${b.origin} → ${b.destination}${b.departureTime ? ` · ${String(b.departureTime).slice(0, 10)}` : ''}`,
        totalAmount: typeof b.totalAmount === 'number' ? b.totalAmount : parseFloat(String(b.totalAmount || '0')) || 0,
        currency: b.currency || 'USD',
        paymentStatus: 'successful',
        createdAt: b.createdAt || new Date().toISOString(),
      }));

      setAppBookings(realBookings);
      setJourneys(converted);
      setJourneysStatus('ready');
    } catch {
      setJourneysStatus('error');
    }
  }, [clearJourneys]);

  useEffect(() => {
    const handleAuthClear = () => {
      clearJourneys();
    };
    window.addEventListener('auth:expired', handleAuthClear);
    window.addEventListener('auth:logout', handleAuthClear);
    return () => {
      window.removeEventListener('auth:expired', handleAuthClear);
      window.removeEventListener('auth:logout', handleAuthClear);
    };
  }, [clearJourneys]);

  const confirmBooking = useCallback((booking: Booking) => {
    setAppBookings((prev) => [...prev, booking]);
    setJourneys((prev) =>
      prev.map((j) => {
        if (j.id !== booking.journeyId) return j;
        const notif: Notification = {
          id: `notif-bk-${Date.now()}`,
          type: 'success',
          title: `${booking.type === 'flight' ? 'Flight' : booking.type === 'hotel' ? 'Hotel' : 'Experience'} confirmed`,
          message: `${booking.itemName} is confirmed. Reference: ${booking.referenceId}`,
          timestamp: new Date().toISOString(),
          read: false,
          journeyId: j.id,
        };
        return {
          ...j,
          bookings: [...j.bookings, booking.id],
          totalSpend: j.totalSpend + booking.totalAmount,
          notifications: [notif, ...j.notifications],
        };
      })
    );
    // Return to originating journey if booking started from one
    const currentFlow = bookingFlow;
    setBookingFlow(null);
    if (currentFlow?.source === 'journey' && currentFlow.journeyId) {
      setPreviousPage(pageRef.current);
      pageRef.current = 'journey';
      setSelectedJourneyId(currentFlow.journeyId);
      setPage('journey');
    } else {
      setPreviousPage(pageRef.current);
      pageRef.current = 'my-bookings';
      setPage('my-bookings');
    }
    window.scrollTo({ top: 0 });
  }, [bookingFlow]);

  const updateJourneyStatus = useCallback((journeyId: string, status: Journey['status']) => {
    setJourneys((prev) => prev.map((j) => (j.id === journeyId ? { ...j, status } : j)));
  }, []);

  const updateJourneyCover = useCallback(
    (journeyId: string, coverImage: import('../data/mockData').TripCoverImage) => {
      if (!coverImage || !coverImage.url) return;
      setJourneys((prev) =>
        prev.map((j) =>
          j.id === journeyId ? { ...j, coverImage, imageUrl: coverImage.url } : j
        )
      );
    },
    []
  );

  const markNotificationRead = useCallback((id: string) => {
    setJourneys((prev) =>
      prev.map((j) => ({
        ...j,
        notifications: j.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }))
    );
  }, []);

  const addNotificationToJourney = useCallback((journeyId: string, notif: Notification) => {
    setJourneys((prev) =>
      prev.map((j) =>
        j.id === journeyId ? { ...j, notifications: [notif, ...j.notifications] } : j
      )
    );
  }, []);

  // mock, ops pages only; not used by traveler pages
  const simulateDisruption = useCallback(() => {
    const jrn = journeys.find((j) => j.id === 'jrn-001');
    const disruption = jrn?.disruptions[0];
    if (disruption) {
      setActiveDisruption(disruption);
      setDisruptionSimulated(true);
      setJourneys((prev) =>
        prev.map((j) =>
          j.id === 'jrn-001'
            ? {
                ...j,
                notifications: [
                  {
                    id: `notif-live-${Date.now()}`,
                    type: 'alert' as const,
                    title: 'Flight 6E-812 Delayed — 45 Minutes',
                    message: 'Your IndiGo flight from Mumbai is delayed 45 minutes. New departure: 03:15 IST. We\'ve reviewed your journey — hotel check-in is unaffected.',
                    timestamp: new Date().toISOString(),
                    read: false,
                    journeyId: 'jrn-001',
                  },
                  ...j.notifications,
                ],
              }
            : j
        )
      );
    }
  }, [journeys]);

  const resolveDisruption = useCallback((id: string) => {
    setJourneys((prev) =>
      prev.map((j) => ({
        ...j,
        disruptions: j.disruptions.map((d) =>
          d.id === id ? { ...d, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : d
        ),
      }))
    );
    setActiveDisruption(null);
  }, []);

  const dismissDisruption = useCallback(() => setActiveDisruption(null), []);

  const setPlannerDestination = useCallback((name: string, id = '') => {
    setPlannerDestinationState(name);
    setPlannerDestinationId(id);
  }, []);

  // Page refresh loses selectedPlace (SPA in-memory state); not-found page handles this.
  const openPlace = useCallback((place: PlaceResult) => {
    setSelectedPlace(place);
    setSelectedDestinationId(null);
    setPreviousPage(pageRef.current);
    pageRef.current = 'destination';
    setPage('destination');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Selected flight offer (in-memory; lost on refresh by design)
  const openOffer = useCallback((offer: FlightOffer) => {
    setSelectedOffer(offer);
    setSelectedFlightId(null);
    setPreviousPage(pageRef.current);
    pageRef.current = 'flight-detail';
    setPage('flight-detail');
    syncHash('flight-detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const updateItineraryItemStatus = useCallback((
    journeyId: string,
    itemId: string,
    status: import('../data/mockData').ItineraryItemStatus,
    bookingId?: string
  ) => {
    setJourneys((prev) =>
      prev.map((j) =>
        j.id !== journeyId ? j : {
          ...j,
          itinerary: j.itinerary.map((day) => ({
            ...day,
            activities: day.activities.map((act) =>
              act.id === itemId ? { ...act, status, ...(bookingId ? { bookingId } : {}) } : act
            ),
          })),
        }
      )
    );
  }, []);

  const navigateToHotel = useCallback((hotelId: string, context?: { journeyId?: string; itineraryItemId?: string }) => {
    setPreviousPage(pageRef.current);
    setSelectedHotelId(hotelId);
    if (context?.journeyId) {
      setBookingFlow({ type: 'hotel', itemId: hotelId, journeyId: context.journeyId, itineraryItemId: context.itineraryItemId, source: 'journey' });
    }
    pageRef.current = 'hotel-detail';
    setPage('hotel-detail');
    syncHash('hotel-detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const navigateToExperience = useCallback((experienceId: string, context?: { journeyId?: string; itineraryItemId?: string }) => {
    setPreviousPage(pageRef.current);
    setSelectedExperienceId(experienceId);
    if (context?.journeyId) {
      setBookingFlow({ type: 'activity', itemId: experienceId, journeyId: context.journeyId, itineraryItemId: context.itineraryItemId, source: 'journey' });
    }
    pageRef.current = 'experience-detail';
    setPage('experience-detail');
    syncHash('experience-detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const navigateToFlight = useCallback((flightId: string, context?: { journeyId?: string; itineraryItemId?: string }) => {
    setPreviousPage(pageRef.current);
    setSelectedFlightId(flightId);
    if (context?.journeyId) {
      setBookingFlow({ type: 'flight', itemId: flightId, journeyId: context.journeyId, itineraryItemId: context.itineraryItemId, source: 'journey' });
    }
    pageRef.current = 'flight-detail';
    setPage('flight-detail');
    syncHash('flight-detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncHash]);

  const openHotels = useCallback((query?: Partial<HotelsQuery> | null) => {
    openBook('hotels', query || null);
  }, [openBook]);

  return (
    <AppContext.Provider
      value={{
        page,
        activeBookTab,
        previousPage,
        savedDestinationIds,
        journeys,
        journeysStatus,
        bookings: appBookings,
        traveler,
        notifications: allNotifications,
        selectedJourneyId,
        selectedDestinationId,
        selectedPlace,
        selectedHotelId,
        selectedExperienceId,
        selectedFlightId,
        selectedOffer,
        selectedPackageId,
        selectedStyle,
        openStyle,
        bookingFlow,
        searchQuery,
        hotelsQuery,
        setHotelsQuery,
        flightSearchSession,
        setFlightSearchSession,
        railBusPrefill,
        pendingRecordedBookingPrefill,
        openBookingsWithPrefill,
        clearRecordedBookingPrefill,
        openHotels,
        openBook,
        setActiveBookTab,
        transportTab,
        setTransportTab,
        transportPrefill,
        openTransport,
        plannerDestination,
        plannerDestinationId,
        activeDisruption,
        disruptionSimulated,
        navigate,
        setSearchQuery,
        startBookingFlow,
        confirmBooking,
        createJourney,
        refreshJourneys,
        clearJourneys,
        setSignedInUserId,
        updateJourneyStatus,
        updateJourneyCover,
        markNotificationRead,
        addNotificationToJourney,
        navigateToHotel,
        navigateToExperience,
        navigateToFlight,
        navigateBack,
        toggleSaveDestination,
        simulateDisruption,
        resolveDisruption,
        dismissDisruption,
        setPlannerDestination,
        openPlace,
        openOffer,
        updateItineraryItemStatus,
        visaApplications,
        isTravelAssistantOpen,
        travelAssistantInitialMessage,
        openTravelAssistant,
        closeTravelAssistant,
        clearTravelAssistantInitialMessage,
        isGlobalSearchOpen,
        globalSearchInitialQuery,
        openGlobalSearch,
        closeGlobalSearch,
        addVisaApplication: (app: VisaApplication) => setVisaApplications((prev) => [...prev, app]),
        updateVisaApplication: (id: string, updates: Partial<VisaApplication>) =>
          setVisaApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a))),
        navigateToPackage: (packageId: string) => {
          setPreviousPage(pageRef.current);
          setSelectedPackageId(packageId);
          pageRef.current = 'package-detail';
          setPage('package-detail');
          syncHash('package-detail');
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
