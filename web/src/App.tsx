import { useEffect } from 'react';
import { AppProvider, useApp, type Page } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import TopNav from './components/layout/TopNav';
import Footer from './components/layout/Footer';
import HomePage from './pages/traveler/HomePage';
import ExplorePage from './pages/traveler/ExplorePage';
import SearchPage from './pages/traveler/SearchPage';
import DestinationRouter from './pages/traveler/DestinationPage';
import AIPlannerPage from './pages/traveler/AIPlannerPage';
import MyTripsPage from './pages/traveler/MyTripsPage';
import JourneyPage from './pages/traveler/JourneyPage';
import BookingFlowPage from './pages/traveler/BookingFlowPage';
import SupportPage from './pages/traveler/SupportPage';
import ProfilePage from './pages/traveler/ProfilePage';
import DealsPage from './pages/traveler/DealsPage';
import VisaCenterPage from './pages/traveler/VisaCenterPage';
import MyBookingsPage from './pages/traveler/MyBookingsPage';
import JourneysPage from './pages/traveler/JourneysPage';
import PackageDetailPage from './pages/traveler/PackageDetailPage';
import HotelDetailPage from './pages/traveler/HotelDetailPage';
import ExperienceDetailPage from './pages/traveler/ExperienceDetailPage';
import FlightDetailPage from './pages/traveler/FlightDetailPage';
import FlightBookingRouter from './pages/traveler/FlightBookingPage';
import HotelsPage from './pages/traveler/HotelsPage';
import AuthPage from './pages/traveler/AuthPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import DeleteAccountPage from './pages/legal/DeleteAccountPage';
import StyleCollectionPage from './pages/traveler/StyleCollectionPage';
import GroundTransportPage from './pages/traveler/GroundTransportPage';

import TravelAssistantFab from './components/chat/TravelAssistantFab';
import TravelAssistantPanel from './components/chat/TravelAssistantPanel';
import SampleDataBanner from './components/common/SampleDataBanner';
import { SHOW_SAMPLE_PAGES } from './config/features';
import { isPageAvailable, resolvePage, PAGE_STATUS } from './lib/pageStatus';

const GATED_PAGES: Page[] = ['ai-planner', 'my-trips', 'journey', 'my-bookings', 'profile'];

function Router() {
  const { page, navigate } = useApp();
  const { status, setRedirectTarget } = useAuth();

  const effectivePage = resolvePage(page, SHOW_SAMPLE_PAGES);

  // Guard against unbacked / unavailable pages
  useEffect(() => {
    if (!isPageAvailable(page, SHOW_SAMPLE_PAGES)) {
      navigate(resolvePage(page, SHOW_SAMPLE_PAGES));
    }
  }, [page, navigate]);

  // One central gate in the router for protected pages
  useEffect(() => {
    if (status === 'anon' && GATED_PAGES.includes(effectivePage)) {
      setRedirectTarget(effectivePage);
      navigate('auth');
    }
  }, [status, effectivePage, navigate, setRedirectTarget]);

  // While hydrating token on a gated page, show clean luxury loader
  if (status === 'loading' && GATED_PAGES.includes(effectivePage)) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#E8E4DC] border-t-[#111111] rounded-full animate-spin" />
          <span className="text-xs text-[#77736C] tracking-wider uppercase font-medium">Loading</span>
        </div>
      </div>
    );
  }

  const isSample = SHOW_SAMPLE_PAGES && PAGE_STATUS[effectivePage] === 'sample';

  const renderPage = () => {
    // Prevent rendering gated page while navigating anonymous user to auth
    if (status === 'anon' && GATED_PAGES.includes(effectivePage)) {
      return null;
    }

    switch (effectivePage) {
      case 'home':              return <HomePage />;
      case 'explore':           return <ExplorePage />;
      case 'search':            return <SearchPage />;
      case 'destination':       return <DestinationRouter />;
      case 'hotel-detail':      return <HotelDetailPage />;
      case 'experience-detail': return <ExperienceDetailPage />;
      case 'flight-detail':     return <FlightDetailPage />;
      case 'flight-booking':    return <FlightBookingRouter />;
      case 'ai-planner':        return <AIPlannerPage />;
      case 'my-trips':          return <MyTripsPage />;
      case 'journey':           return <JourneyPage />;
      case 'booking-flow':      return <BookingFlowPage />;
      case 'support':           return <SupportPage />;
      case 'profile':           return <ProfilePage />;
      case 'deals':             return <DealsPage />;
      case 'visa-center':       return <VisaCenterPage />;
      case 'my-bookings':       return <MyBookingsPage />;
      case 'hotels':            return <HotelsPage />;
      case 'journeys':          return <JourneysPage />;
      case 'package-detail':    return <PackageDetailPage />;
      case 'auth':              return <AuthPage />;
      case 'privacy':           return <PrivacyPage />;
      case 'delete-account':    return <DeleteAccountPage />;
      case 'style-collection':  return <StyleCollectionPage />;
      case 'ground-transport':  return <GroundTransportPage />;
      default:                  return <HomePage />;
    }
  };

  const showFooter = effectivePage !== 'booking-flow' && effectivePage !== 'flight-booking' && effectivePage !== 'auth';

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      {isSample && <SampleDataBanner />}
      <main className="animate-fade-in">
        {renderPage()}
      </main>
      {showFooter && <Footer />}
      <TravelAssistantFab />
      <TravelAssistantPanel />
    </div>
  );
}

function AuthJourneySync() {
  const { status, user } = useAuth();
  const { refreshJourneys, clearJourneys, setSignedInUserId } = useApp();

  useEffect(() => {
    if (status === 'authed') {
      if (user) {
        setSignedInUserId(user.id || user._id || '');
      }
      refreshJourneys();
    } else if (status === 'anon') {
      clearJourneys();
    }
  }, [status, user, refreshJourneys, clearJourneys, setSignedInUserId]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <AuthJourneySync />
        <Router />
      </AuthProvider>
    </AppProvider>
  );
}
