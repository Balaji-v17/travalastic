import { useApp } from '../../store/AppContext';
import HotelBookingFlow from './booking/HotelBookingFlow';
import FlightBookingFlow from './booking/FlightBookingFlow';
import ExperienceBookingFlow from './booking/ExperienceBookingFlow';

export default function BookingFlowPage() {
  const { bookingFlow } = useApp();

  if (!bookingFlow) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
        <p>No booking selected.</p>
      </div>
    );
  }

  if (bookingFlow.type === 'hotel') return <HotelBookingFlow />;
  if (bookingFlow.type === 'flight') return <FlightBookingFlow />;
  if (bookingFlow.type === 'activity') return <ExperienceBookingFlow />;

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
      <p>Unknown booking type.</p>
    </div>
  );
}
