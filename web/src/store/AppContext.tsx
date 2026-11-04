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
import { SHOW_SAMPLE_PAGES } from '../config/features.ts';

import type { Page } from '../lib/pageStatus';
export type { Page } from '../lib/pageStatus';
import type { PlaceResult } from '../lib/destinationView';
export type { PlaceResult } from '../lib/destinationView';
import type { FlightOffer } from '../lib/flightAdapter';
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
  plannerDestination: string;
  plannerDestinationId: string;
  activeDisruption: import('../data/mockData').Disruption | null;
  disruptionSimulated: boolean;
  savedDestinationIds: string[];
  visaApplications: VisaApplication[];
  isTravelAssistantOpen: boolean;
  travelAssistantInitialMessage: string;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home');
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const pageRef = useRef<Page>('home');
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
  const [plannerDestination, setPlannerDestinationState] = useState('');
  const [plannerDestinationId, setPlannerDestinationId] = useState('');
  const [activeDisruption, setActiveDisruption] = useState<import('../data/mockData').Disruption | null>(null);
  const [disruptionSimulated, setDisruptionSimulated] = useState(false);
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);
  const [isTravelAssistantOpen, setIsTravelAssistantOpen] = useState(false);
  const [travelAssistantInitialMessage, setTravelAssistantInitialMessage] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleKey | null>(null);
  const [transportTab, setTransportTab] = useState<'cab' | 'rental'>('cab');
  const [transportPrefill, setTransportPrefill] = useState<TransportPrefill | null>(null);

  const openTransport = useCallback((tab: 'cab' | 'rental' = 'cab', prefill?: TransportPrefill | null) => {
    setTransportTab(tab);
    if (prefill !== undefined) {
      setTransportPrefill(prefill);
    }
    setPreviousPage(pageRef.current);
    pageRef.current = 'ground-transport';
    setPage('ground-transport');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const openStyle = useCallback((key: StyleKey) => {
    setSelectedStyle(key);
    setPreviousPage(pageRef.current);
    pageRef.current = 'style-collection';
    setPage('style-collection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const allNotifications = journeys.flatMap((j) => j.notifications);

  const navigateBack = useCallback(() => {
    if (previousPage) {
      setPage(previousPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPage('home');
    }
  }, [previousPage]);

  const toggleSaveDestination = useCallback((destinationId: string) => {
    setSavedDestinationIds((prev) =>
      prev.includes(destinationId) ? prev.filter((id) => id !== destinationId) : [...prev, destinationId]
    );
  }, []);

  const navigate = useCallback((p: Page, params?: {
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
    setPreviousPage(pageRef.current);
    pageRef.current = p;
    setPage(p);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
      const [rawItineraries, rawBookings] = await Promise.all([
        apiFetch<BackendSavedItinerary[]>('/itinerary/mine'),
        apiFetch<BackendBooking[]>('/bookings/mine').catch(() => [] as BackendBooking[]),
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

      const converted = (rawItineraries || []).map((it) => {
        const itinId = String(it._id || it.id || it.itineraryId || '');
        const matched = bookingsByItinId.get(itinId) || [];
        return toJourney(it, matched, signedInUserIdRef.current);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToExperience = useCallback((experienceId: string, context?: { journeyId?: string; itineraryItemId?: string }) => {
    setPreviousPage(pageRef.current);
    setSelectedExperienceId(experienceId);
    if (context?.journeyId) {
      setBookingFlow({ type: 'activity', itemId: experienceId, journeyId: context.journeyId, itineraryItemId: context.itineraryItemId, source: 'journey' });
    }
    pageRef.current = 'experience-detail';
    setPage('experience-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToFlight = useCallback((flightId: string, context?: { journeyId?: string; itineraryItemId?: string }) => {
    setPreviousPage(pageRef.current);
    setSelectedFlightId(flightId);
    if (context?.journeyId) {
      setBookingFlow({ type: 'flight', itemId: flightId, journeyId: context.journeyId, itineraryItemId: context.itineraryItemId, source: 'journey' });
    }
    pageRef.current = 'flight-detail';
    setPage('flight-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openHotels = useCallback((query?: Partial<HotelsQuery> | null) => {
    if (query) {
      setHotelsQuery((prev) => ({
        destination: query.destination || prev?.destination || '',
        checkIn: query.checkIn ?? prev?.checkIn,
        checkOut: query.checkOut ?? prev?.checkOut,
        guests: query.guests ?? prev?.guests ?? 2,
        rooms: query.rooms ?? prev?.rooms ?? 1,
      }));
    }
    setPreviousPage(pageRef.current);
    pageRef.current = 'hotels';
    setPage('hotels');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <AppContext.Provider
      value={{
        page,
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
        openHotels,
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
        addVisaApplication: (app: VisaApplication) => setVisaApplications((prev) => [...prev, app]),
        updateVisaApplication: (id: string, updates: Partial<VisaApplication>) =>
          setVisaApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a))),
        navigateToPackage: (packageId: string) => {
          setPreviousPage(pageRef.current);
          setSelectedPackageId(packageId);
          pageRef.current = 'package-detail';
          setPage('package-detail');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
