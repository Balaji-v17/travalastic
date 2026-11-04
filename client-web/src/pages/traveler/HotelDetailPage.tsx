import { useState, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { hotels, destinations } from '../../data/mockData';

const MOCK_REVIEWS = [
  {
    id: 'r1',
    name: 'Priya Sharma',
    nationality: 'India',
    rating: 5,
    date: 'July 2026',
    text: "Absolutely stunning property with impeccable service. The staff remembered our names from day one and the room views were breathtaking. Would return without hesitation.",
  },
  {
    id: 'r2',
    name: 'James Whitfield',
    nationality: 'United Kingdom',
    rating: 4,
    date: 'June 2026',
    text: "Excellent location and beautifully maintained facilities. The breakfast spread was exceptional — fresh local produce and a wide variety of options. Minor wait times at check-in were the only downside.",
  },
  {
    id: 'r3',
    name: 'Aiko Tanaka',
    nationality: 'Japan',
    rating: 5,
    date: 'May 2026',
    text: "A truly memorable stay. The room was spotless and the amenities were top-notch. The concierge arranged everything perfectly for our day trips. Highly recommend this property.",
  },
];

const AMENITY_ICONS: Record<string, string> = {
  'Free WiFi': '📶',
  'Swimming Pool': '🏊',
  'Gym': '🏋️',
  'Spa': '💆',
  'Restaurant': '🍽️',
  'Bar': '🍸',
  'Room Service': '🛎️',
  'Airport Shuttle': '🚌',
  'Parking': '🅿️',
  'Air Conditioning': '❄️',
  'Business Center': '💼',
  'Laundry': '👕',
  'Concierge': '🎩',
  'Kids Club': '🧒',
  'Rooftop': '🏙️',
};

function getAmenityIcon(amenity: string): string {
  for (const [key, icon] of Object.entries(AMENITY_ICONS)) {
    if (amenity.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '✓';
}

export default function HotelDetailPage() {
  const { selectedHotelId, navigate, navigateBack, startBookingFlow, selectedDestinationId, bookingFlow, journeys, previousPage } = useApp();
  const hotel = hotels.find((h) => h.id === selectedHotelId);
  const roomsRef = useRef<HTMLDivElement>(null);

  const [mainImage, setMainImage] = useState(0);

  if (!hotel) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 text-lg">Hotel not found.</p>
        <button
          onClick={() => navigate('explore')}
          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Explore
        </button>
      </div>
    );
  }

  const destination = destinations.find((d) => d.id === hotel.destination);
  const allImages = [hotel.imageUrl, ...(hotel.images || [])].slice(0, 4);

  const journeyContext = bookingFlow?.journeyId
    ? journeys.find((j) => j.id === bookingFlow.journeyId) ?? null
    : null;

  const handleBack = () => {
    if (bookingFlow?.source === 'journey' && bookingFlow?.journeyId) {
      navigate('journey', { selectedJourneyId: bookingFlow.journeyId });
    } else if (previousPage === 'search') {
      navigate('search');
    } else if (hotel.destination) {
      navigate('destination', { selectedDestinationId: hotel.destination });
    } else {
      navigateBack();
    }
  };

  const scrollToRooms = () => {
    roomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4 flex-wrap">
          <button onClick={() => navigate('home')} className="hover:text-blue-600 transition-colors">Home</button>
          <span>›</span>
          <button onClick={() => navigate('explore')} className="hover:text-blue-600 transition-colors">Explore</button>
          <span>›</span>
          {destination && (
            <>
              <button
                onClick={() => navigate('destination', { selectedDestinationId: hotel.destination })}
                className="hover:text-blue-600 transition-colors"
              >
                {destination.name}
              </button>
              <span>›</span>
            </>
          )}
          <span className="hover:text-blue-600 cursor-pointer" onClick={handleBack}>Hotels</span>
          <span>›</span>
          <span className="text-slate-800 font-medium truncate max-w-[200px]">{hotel.name}</span>
        </nav>

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 font-medium mb-4 transition-colors"
        >
          ← Back
        </button>

        {/* Journey Context Banner */}
        {journeyContext && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-800">
            <span className="text-base">🗺️</span>
            <span>Part of your <span className="font-semibold">{journeyContext.destination}</span> Journey</span>
          </div>
        )}

        {/* Hero Image Gallery */}
        <div className="mb-6">
          <div className="relative rounded-2xl overflow-hidden h-72 sm:h-96 bg-slate-200">
            <img
              src={allImages[mainImage]}
              alt={hotel.name}
              className="w-full h-full object-cover"
            />
            {/* Stars badge */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold text-amber-600 flex items-center gap-1">
              {'★'.repeat(hotel.stars)}
              <span className="text-slate-500 font-normal ml-1">{hotel.stars}-Star</span>
            </div>
            {/* Rating badge */}
            <div className="absolute top-4 right-4 bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">
              {hotel.rating} ★
            </div>
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 mt-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setMainImage(idx)}
                  className={`flex-1 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    mainImage === idx ? 'border-blue-500' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hotel info */}
            <section>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-display text-2xl sm:text-3xl text-slate-900">{hotel.name}</h1>
                <span className="shrink-0 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold px-3 py-1 rounded-full mt-1">
                  {hotel.category}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-1">
                <span>📍</span>
                <span>{hotel.location}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <span>🏠</span>
                <span>{hotel.address}</span>
              </div>
            </section>

            {/* Description */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-2">About this hotel</h2>
              <p className="text-slate-600 leading-relaxed">{hotel.description}</p>
            </section>

            {/* Why this hotel? */}
            <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h2 className="font-display text-base text-blue-900 mb-3">
                {journeyContext ? "Good match for your journey" : "Why this hotel?"}
              </h2>
              <ul className="space-y-2">
                {journeyContext ? (
                  <>
                    {hotel.rating >= 4.5 && (
                      <li className="flex items-start gap-2 text-sm text-blue-800">
                        <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                        <span>Highly rated by guests</span>
                      </li>
                    )}
                    {hotel.amenities[0] && (
                      <li className="flex items-start gap-2 text-sm text-blue-800">
                        <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                        <span>{hotel.amenities[0]} on site</span>
                      </li>
                    )}
                    {hotel.location && (
                      <li className="flex items-start gap-2 text-sm text-blue-800">
                        <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                        <span>Great location — {hotel.location}</span>
                      </li>
                    )}
                  </>
                ) : (
                  hotel.amenities.slice(0, 3).map((amenity) => (
                    <li key={amenity} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                      <span>{amenity}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* Amenities */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-3">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hotel.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700"
                  >
                    <span className="text-base">{getAmenityIcon(amenity)}</span>
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Available Rooms */}
            <section ref={roomsRef} id="rooms">
              <h2 className="font-display text-lg text-slate-900 mb-3">Available Rooms</h2>
              <div className="space-y-4">
                {hotel.rooms.map((room) => (
                  <div key={room.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-200 hover:shadow-md transition-all">
                    <div className="sm:flex">
                      <div className="sm:w-48 h-40 sm:h-auto shrink-0">
                        <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{room.name}</h3>
                          {room.breakfastIncluded && (
                            <span className="shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium px-2 py-0.5 rounded-full">
                              🍳 Breakfast Included
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-2">
                          <span>🛏 {room.bedType}</span>
                          <span>👥 Up to {room.maxOccupancy} guests</span>
                          <span>📐 {room.size}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {room.amenities.slice(0, 5).map((a) => (
                            <span key={a} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{room.cancellationPolicy}</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xl font-bold text-slate-900">₹{room.pricePerNight.toLocaleString()}</span>
                            <span className="text-slate-400 text-sm"> / night</span>
                          </div>
                          <button
                            onClick={() => startBookingFlow({ type: 'hotel', itemId: hotel.id, source: bookingFlow?.journeyId ? 'journey' : 'hotel-detail', journeyId: bookingFlow?.journeyId, itineraryItemId: bookingFlow?.itineraryItemId })}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                          >
                            Select This Room
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Check-in / Check-out */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-3">Check-in & Check-out</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Check-in from</p>
                  <p className="text-lg font-bold text-slate-900">{hotel.checkInTime}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Check-out by</p>
                  <p className="text-lg font-bold text-slate-900">{hotel.checkOutTime}</p>
                </div>
              </div>
            </section>

            {/* Nearby Attractions */}
            {hotel.nearbyAttractions && hotel.nearbyAttractions.length > 0 && (
              <section>
                <h2 className="font-display text-lg text-slate-900 mb-3">Nearby Attractions</h2>
                <div className="space-y-2">
                  {hotel.nearbyAttractions.map((attr) => (
                    <div key={attr} className="flex items-center gap-2 text-slate-600 text-sm">
                      <span>📍</span>
                      <span>{attr}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cancellation Policy */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-2">Cancellation Policy</h2>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm text-amber-800">{hotel.cancellationPolicy}</p>
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-lg text-slate-900">Guest Reviews</h2>
                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-sm font-semibold">
                  <span>★ {hotel.rating}</span>
                  <span className="text-blue-400">·</span>
                  <span className="font-normal text-xs">{hotel.reviewCount} reviews</span>
                </div>
              </div>
              <div className="space-y-4">
                {MOCK_REVIEWS.map((review) => (
                  <div key={review.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{review.name}</p>
                        <p className="text-xs text-slate-400">{review.nationality} · {review.date}</p>
                      </div>
                      <div className="text-amber-500 text-sm font-semibold">{'★'.repeat(review.rating)}</div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">{review.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-0.5">Price from</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">₹{hotel.pricePerNight.toLocaleString()}</span>
                    <span className="text-slate-400 text-sm">/ night</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-600 font-bold text-sm">★ {hotel.rating}</span>
                  <span className="text-slate-400 text-xs">({hotel.reviewCount} reviews)</span>
                </div>

                <div className="flex items-center gap-2 mb-4 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 text-sm">
                  <span>🏨</span>
                  <span className="font-medium">{hotel.availableRooms} rooms available</span>
                </div>

                <button
                  onClick={scrollToRooms}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  Select a Room
                </button>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Check-in</p>
                    <p className="text-sm font-semibold text-slate-800">{hotel.checkInTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Check-out</p>
                    <p className="text-sm font-semibold text-slate-800">{hotel.checkOutTime}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Need help choosing?</p>
                <button
                  onClick={() => navigate('support')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                >
                  Chat with our travel experts →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
