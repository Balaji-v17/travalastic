import { useApp } from '../../store/AppContext';
import { activities, destinations } from '../../data/mockData';

const MOCK_REVIEWS = [
  {
    id: 'r1',
    name: 'Rohan Mehta',
    nationality: 'India',
    rating: 5,
    date: 'July 2026',
    text: "One of the highlights of our entire trip. The guide was incredibly knowledgeable and made the experience feel personal and authentic. We learned so much and had a blast.",
  },
  {
    id: 'r2',
    name: 'Sophie Laurent',
    nationality: 'France',
    rating: 4,
    date: 'June 2026',
    text: "Well-organized and genuinely fun. The small group size made all the difference — we got individual attention and the pace was just right. Would definitely book again.",
  },
  {
    id: 'r3',
    name: 'Marcus Chen',
    nationality: 'Singapore',
    rating: 5,
    date: 'May 2026',
    text: "Exceeded all expectations. Everything included was top quality and the meeting point instructions were clear and easy to follow. A must-do for anyone visiting this destination.",
  },
];

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

function dayAbbr(day: string): string {
  return DAY_ABBR[day] || day.slice(0, 3);
}

export default function ExperienceDetailPage() {
  const { selectedExperienceId, navigate, navigateBack, startBookingFlow, navigateToExperience, bookingFlow, journeys, previousPage } = useApp();
  const activity = activities.find((a) => a.id === selectedExperienceId);

  if (!activity) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 text-lg">Experience not found.</p>
        <button
          onClick={() => navigate('explore')}
          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Explore
        </button>
      </div>
    );
  }

  const destination = destinations.find((d) => d.id === activity.destination);
  const journeyContext = bookingFlow?.journeyId
    ? journeys.find((j) => j.id === bookingFlow.journeyId) ?? null
    : null;
  const allImages = [activity.imageUrl, ...(activity.images || [])].slice(0, 1);
  const relatedActivities = activities
    .filter((a) => a.destination === activity.destination && a.id !== activity.id)
    .slice(0, 3);

  const handleBack = () => {
    if (bookingFlow?.source === 'journey' && bookingFlow?.journeyId) {
      navigate('journey', { selectedJourneyId: bookingFlow.journeyId });
    } else if (previousPage === 'search') {
      navigate('search');
    } else if (activity.destination) {
      navigate('destination', { selectedDestinationId: activity.destination });
    } else {
      navigateBack();
    }
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
                onClick={() => navigate('destination', { selectedDestinationId: activity.destination })}
                className="hover:text-blue-600 transition-colors"
              >
                {destination.name}
              </button>
              <span>›</span>
            </>
          )}
          <span className="hover:text-blue-600 cursor-pointer" onClick={handleBack}>Experiences</span>
          <span>›</span>
          <span className="text-slate-800 font-medium truncate max-w-[200px]">{activity.name}</span>
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
            <span>Add to your <span className="font-semibold">{journeyContext.destination}</span> Journey</span>
          </div>
        )}

        {/* Hero Image */}
        <div className="relative rounded-2xl overflow-hidden h-64 sm:h-80 bg-slate-200 mb-6">
          <img
            src={allImages[0]}
            alt={activity.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-blue-700">
            {activity.category}
          </div>
          <div className="absolute top-4 right-4 bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">
            {activity.rating} ★
          </div>
          <div className="absolute bottom-4 left-4">
            <p className="text-xs text-white/70 mb-0.5">⏱ {activity.duration}</p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Activity info */}
            <section>
              <div className="flex items-start gap-3 mb-2">
                <h1 className="font-display text-2xl sm:text-3xl text-slate-900 flex-1">{activity.name}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-0.5 text-xs font-medium">{activity.category}</span>
                <span>⏱ {activity.duration}</span>
                <span>★ {activity.rating} <span className="text-slate-400">({activity.reviewCount} reviews)</span></span>
              </div>
            </section>

            {/* Description */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-2">About this experience</h2>
              <p className="text-slate-600 leading-relaxed">{activity.longDescription || activity.description}</p>
            </section>

            {/* Why this experience? */}
            <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <h2 className="font-display text-base text-blue-900 mb-3">Why this experience?</h2>
              {journeyContext ? (
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                    <span>Matches your destination interests — {activity.category}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                    <span>Duration fits your itinerary: {activity.duration}</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-2">
                  {(activity.highlights || []).slice(0, 3).map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-blue-800">
                      <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Highlights */}
            {activity.highlights && activity.highlights.length > 0 && (
              <section>
                <h2 className="font-display text-lg text-slate-900 mb-3">Highlights</h2>
                <ul className="space-y-2">
                  {activity.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-slate-700 text-sm">
                      <span className="text-blue-500 mt-0.5 shrink-0">✦</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Included / Not Included */}
            <section className="grid sm:grid-cols-2 gap-6">
              <div>
                <h2 className="font-display text-lg text-slate-900 mb-3">{"What's Included"}</h2>
                <ul className="space-y-2">
                  {activity.includedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-emerald-500 mt-0.5 shrink-0 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-lg text-slate-900 mb-3">{"What's Not Included"}</h2>
                <ul className="space-y-2">
                  {activity.excludedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-red-400 mt-0.5 shrink-0 font-bold">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Available Days */}
            {activity.availableDays && activity.availableDays.length > 0 && (
              <section>
                <h2 className="font-display text-lg text-slate-900 mb-3">Available Days</h2>
                <div className="flex flex-wrap gap-2">
                  {activity.availableDays.map((day) => (
                    <span
                      key={day}
                      className="bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-1.5 text-sm font-medium"
                    >
                      {dayAbbr(day)}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Time Slots */}
            {activity.timeSlots && activity.timeSlots.length > 0 && (
              <section>
                <h2 className="font-display text-lg text-slate-900 mb-3">Time Slots</h2>
                <div className="flex flex-wrap gap-2">
                  {activity.timeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`border rounded-xl px-4 py-2 text-sm ${
                        slot.availableSpots > 0
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 cursor-pointer'
                          : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <p className="font-semibold">{slot.time}</p>
                      <p className="text-xs mt-0.5">
                        {slot.availableSpots > 0
                          ? `${slot.availableSpots} spots left`
                          : 'Fully booked'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Meeting Point */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-2">Meeting Point</h2>
              <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
                <span className="text-base mt-0.5">📍</span>
                <span>{activity.meetingPoint}</span>
              </div>
            </section>

            {/* Requirements */}
            {activity.requirements && (
              <section>
                <h2 className="font-display text-lg text-slate-900 mb-2">Requirements</h2>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                  <span className="text-base mt-0.5">⚠️</span>
                  <span>{activity.requirements}</span>
                </div>
              </section>
            )}

            {/* Min Age & Max Participants */}
            <section className="flex flex-wrap gap-4">
              {activity.minAge > 0 && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                  <span>🔞</span>
                  <div>
                    <p className="text-xs text-slate-400">Minimum Age</p>
                    <p className="font-semibold text-slate-900">{activity.minAge}+ years</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                <span>👥</span>
                <div>
                  <p className="text-xs text-slate-400">Max Participants</p>
                  <p className="font-semibold text-slate-900">{activity.maxParticipants} people</p>
                </div>
              </div>
            </section>

            {/* Cancellation Policy */}
            <section>
              <h2 className="font-display text-lg text-slate-900 mb-2">Cancellation Policy</h2>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm text-amber-800">{activity.cancellationPolicy}</p>
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-lg text-slate-900">Guest Reviews</h2>
                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-sm font-semibold">
                  <span>★ {activity.rating}</span>
                  <span className="text-blue-400">·</span>
                  <span className="font-normal text-xs">{activity.reviewCount} reviews</span>
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
                      <div className="text-amber-500 text-sm font-semibold">{"★".repeat(review.rating)}</div>
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
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-0.5">Price from</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">₹{activity.price.toLocaleString()}</span>
                    <span className="text-slate-400 text-sm">/ person</span>
                  </div>
                  {activity.pricePerChild !== undefined && (
                    <p className="text-xs text-slate-500 mt-1">
                      Children: ₹{activity.pricePerChild.toLocaleString()} / child
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-slate-100 text-slate-600 rounded-full px-3 py-1 text-xs font-medium">⏱ {activity.duration}</span>
                  <span className="bg-slate-100 text-slate-600 rounded-full px-3 py-1 text-xs font-medium">👥 Max {activity.maxParticipants}</span>
                </div>

                <button
                  onClick={() => startBookingFlow({ type: 'activity', itemId: activity.id, source: bookingFlow?.journeyId ? 'journey' : 'experience-detail', journeyId: bookingFlow?.journeyId, itineraryItemId: bookingFlow?.itineraryItemId })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  Book This Experience
                </button>

                {activity.availableDays && activity.availableDays.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Available days</p>
                    <div className="flex flex-wrap gap-1.5">
                      {activity.availableDays.map((day) => (
                        <span key={day} className="bg-blue-50 text-blue-700 text-xs rounded px-2 py-0.5 font-medium">
                          {dayAbbr(day)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-100 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Have questions?</p>
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

        {/* Related Experiences */}
        {relatedActivities.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl text-slate-900 mb-4">More Experiences in {destination?.name || 'this destination'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedActivities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => navigateToExperience(act.id)}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-200 hover:shadow-md transition-all text-left"
                >
                  <div className="relative h-36 bg-slate-100">
                    <img src={act.imageUrl} alt={act.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium text-blue-700">
                      {act.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">{act.name}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>⏱ {act.duration}</span>
                      <span className="font-semibold text-slate-900">₹{act.price.toLocaleString()}<span className="font-normal text-slate-400">/person</span></span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                      <span>★ {act.rating}</span>
                      <span className="text-slate-400">({act.reviewCount})</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
