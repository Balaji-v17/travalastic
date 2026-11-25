import { useApp, type BookTab } from '../../store/AppContext';
import SearchPage from './SearchPage';
import HotelsPage from './HotelsPage';
import GroundTransportPage from './GroundTransportPage';
import TrainsAndBusesPanel from '../../components/booking/TrainsAndBusesPanel';

const BOOK_TAB_DEFS: Array<{
  id: BookTab;
  label: string;
  icon: string;
  subtitle: string;
}> = [
  { id: 'flights', label: 'Flights', icon: '✈', subtitle: 'Search & book live airline fares' },
  { id: 'hotels', label: 'Hotels', icon: '🏨', subtitle: 'Curated stays & Booking.com search' },
  { id: 'cab', label: 'Cab', icon: '🚕', subtitle: 'Local pickups & rides via Uber' },
  { id: 'rental', label: 'Car rental', icon: '🚗', subtitle: 'Self-drive & rental comparison' },
  { id: 'trains', label: 'Trains', icon: '🚆', subtitle: 'Curated routes & IRCTC portal' },
  { id: 'buses', label: 'Buses', icon: '🚌', subtitle: 'Intercity coaches & RedBus portal' },
];

export default function BookPage() {
  const { activeBookTab, setActiveBookTab } = useApp();

  const activeMeta = BOOK_TAB_DEFS.find((t) => t.id === activeBookTab) || BOOK_TAB_DEFS[0];

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#111111] pb-20">
      {/* Header + Unified Tab Bar */}
      <div className="bg-white border-b border-[#E8E4DC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#C9A96E] mb-1">
            Reservations & Partners
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#111111] tracking-tight">
                Book Your Travel
              </h1>
              <p className="text-xs sm:text-sm text-[#77736C] mt-1">{activeMeta.subtitle}</p>
            </div>
            <p className="text-[11px] text-[#77736C]">
              Flights are booked directly on Travalastic; stays, rides & ground transit open partner sites.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Booking categories"
            className="flex flex-wrap gap-1.5 bg-[#F7F5F0] border border-[#E8E4DC] p-1 w-fit"
            style={{ borderRadius: '2px' }}
          >
            {BOOK_TAB_DEFS.map((t) => {
              const isActive = activeBookTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveBookTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#111111] text-white shadow-sm'
                      : 'text-[#77736C] hover:text-[#111111]'
                  }`}
                  style={{ borderRadius: '2px' }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keep every tab panel mounted so half-filled forms & state survive tab switching */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={activeBookTab === 'flights' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'flights'}>
          <SearchPage embeddedFlightOnly />
        </div>

        <div className={activeBookTab === 'hotels' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'hotels'}>
          <HotelsPage embedded />
        </div>

        <div className={activeBookTab === 'cab' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'cab'}>
          <GroundTransportPage embeddedTab="cab" />
        </div>

        <div className={activeBookTab === 'rental' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'rental'}>
          <GroundTransportPage embeddedTab="rental" />
        </div>

        <div className={activeBookTab === 'trains' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'trains'}>
          <TrainsAndBusesPanel mode="train" />
        </div>

        <div className={activeBookTab === 'buses' ? '' : 'hidden'} aria-hidden={activeBookTab !== 'buses'}>
          <TrainsAndBusesPanel mode="bus" />
        </div>
      </div>
    </div>
  );
}

