import { AppProvider, useApp } from './store/AppContext';
import TopNav from './components/layout/TopNav';
import Footer from './components/layout/Footer';
import HomePage from './pages/traveler/HomePage';
import ExplorePage from './pages/traveler/ExplorePage';
import SearchPage from './pages/traveler/SearchPage';
import DestinationPage from './pages/traveler/DestinationPage';
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

function Router() {
  const { page } = useApp();

  const renderPage = () => {
    switch (page) {
      case 'home':              return <HomePage />;
      case 'explore':           return <ExplorePage />;
      case 'search':            return <SearchPage />;
      case 'destination':       return <DestinationPage />;
      case 'hotel-detail':      return <HotelDetailPage />;
      case 'experience-detail': return <ExperienceDetailPage />;
      case 'flight-detail':     return <FlightDetailPage />;
      case 'ai-planner':        return <AIPlannerPage />;
      case 'my-trips':          return <MyTripsPage />;
      case 'journey':           return <JourneyPage />;
      case 'booking-flow':      return <BookingFlowPage />;
      case 'support':           return <SupportPage />;
      case 'profile':           return <ProfilePage />;
      case 'deals':             return <DealsPage />;
      case 'visa-center':       return <VisaCenterPage />;
      case 'my-bookings':       return <MyBookingsPage />;
      case 'journeys':          return <JourneysPage />;
      case 'package-detail':    return <PackageDetailPage />;
      default:                  return <HomePage />;
    }
  };

  const showFooter = page !== 'booking-flow';

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="animate-fade-in">
        {renderPage()}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
