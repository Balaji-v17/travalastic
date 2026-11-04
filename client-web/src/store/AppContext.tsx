import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  type Role,
  type Journey,
  type Booking,
  type Notification,
  initialJourneys,
  bookings as initialBookings,
  currentTraveler,
  type Traveler,
  type ItineraryDay,
  type VisaApplication,
} from '../data/mockData';

export type Page =
  | 'home'
  | 'explore'
  | 'search'
  | 'destination'
  | 'hotel-detail'
  | 'experience-detail'
  | 'flight-detail'
  | 'ai-planner'
  | 'my-trips'
  | 'journey'
  | 'booking-flow'
  | 'support'
  | 'profile'
  | 'deals'
  | 'visa-center'
  | 'my-bookings'
  | 'journeys'
  | 'package-detail'
  // internal pages (not routed, kept for compilation)
  | 'journey-control-tower'
  | 'supplier-intelligence'
  | 'finance'
  | 'analytics'
  | 'partner-dashboard'
  | 'corporate-dashboard'
  | 'command-center';

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

interface AppState {
  page: Page;
  previousPage: Page | null;
  journeys: Journey[];
  bookings: Booking[];
  traveler: Traveler;
  notifications: Notification[];
  selectedJourneyId: string | null;
  selectedDestinationId: string | null;
  selectedHotelId: string | null;
  selectedExperienceId: string | null;
  selectedFlightId: string | null;
  selectedPackageId: string | null;
  bookingFlow: BookingFlowState | null;
  searchQuery: SearchQuery;
  plannerDestination: string;
  plannerDestinationId: string;
  activeDisruption: import('../data/mockData').Disruption | null;
  disruptionSimulated: boolean;
  savedDestinationIds: string[];
  visaApplications: VisaApplication[];
}

interface AppActions {
  navigate: (page: Page, params?: {
    selectedJourneyId?: string | null;
    selectedDestinationId?: string | null;
    selectedHotelId?: string | null;
    selectedExperienceId?: string | null;
    selectedPackageId?: string | null;
    bookingFlow?: BookingFlowState | null;
    [key: string]: unknown;
  }) => void;
  navigateToPackage: (packageId: string) => void;
  setSearchQuery: (q: Partial<SearchQuery>) => void;
  startBookingFlow: (flow: BookingFlowState) => void;
  confirmBooking: (booking: Booking) => void;
  createJourney: (journey: Omit<Journey, 'id'>) => string;
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
  addNotificationToJourney: (journeyId: string, notif: Notification) => void;
  addVisaApplication: (app: VisaApplication) => void;
  updateVisaApplication: (id: string, updates: Partial<VisaApplication>) => void;
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
  const [journeys, setJourneys] = useState<Journey[]>(initialJourneys);
  const [appBookings, setAppBookings] = useState<Booking[]>(initialBookings);
  const [traveler] = useState<Traveler>(currentTraveler);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [bookingFlow, setBookingFlow] = useState<BookingFlowState | null>(null);
  const [searchQuery, setSearchQueryState] = useState<SearchQuery>(defaultSearch);
  const [plannerDestination, setPlannerDestinationState] = useState('');
  const [plannerDestinationId, setPlannerDestinationId] = useState('');
  const [activeDisruption, setActiveDisruption] = useState<import('../data/mockData').Disruption | null>(null);
  const [disruptionSimulated, setDisruptionSimulated] = useState(false);
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);

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
    selectedHotelId?: string | null;
    selectedExperienceId?: string | null;
    selectedPackageId?: string | null;
    bookingFlow?: BookingFlowState | null;
  }) => {
    setPreviousPage(pageRef.current);
    pageRef.current = p;
    setPage(p);
    if (params?.selectedJourneyId !== undefined) setSelectedJourneyId(params.selectedJourneyId);
    if (params?.selectedDestinationId !== undefined) setSelectedDestinationId(params.selectedDestinationId);
    if (params?.selectedHotelId !== undefined) setSelectedHotelId(params.selectedHotelId);
    if (params?.selectedExperienceId !== undefined) setSelectedExperienceId(params.selectedExperienceId);
    if (params?.selectedPackageId !== undefined) setSelectedPackageId(params.selectedPackageId);
    if (params?.bookingFlow !== undefined) setBookingFlow(params.bookingFlow);
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

  return (
    <AppContext.Provider
      value={{
        page,
        previousPage,
        savedDestinationIds,
        journeys,
        bookings: appBookings,
        traveler,
        notifications: allNotifications,
        selectedJourneyId,
        selectedDestinationId,
        selectedHotelId,
        selectedExperienceId,
        selectedFlightId,
        selectedPackageId,
        bookingFlow,
        searchQuery,
        plannerDestination,
        plannerDestinationId,
        activeDisruption,
        disruptionSimulated,
        navigate,
        setSearchQuery,
        startBookingFlow,
        confirmBooking,
        createJourney,
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
        updateItineraryItemStatus,
        visaApplications,
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
