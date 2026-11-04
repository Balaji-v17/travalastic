import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { destinations } from '../../data/mockData';
import { SHOW_SAMPLE_PAGES } from '../../config/features';
import {
  destinationView,
  findTripForPlace,
  buildMapsUrl,
  type PlaceResult,
} from '../../lib/destinationView';
import { apiFetch } from '../../lib/api';
import SampleDataBanner from '../../components/common/SampleDataBanner';
import SampleDestinationPage from './SampleDestinationPage';
import CuratedHotelCard, { type CuratedHotelItem } from '../../components/hotels/CuratedHotelCard';

interface WeatherResponse {
  condition?: string;
  temp_min?: number;
  temp_max?: number;
  description?: string;
  temperature?: string;
}

export function LiveDestinationPage({ place }: { place: PlaceResult }) {
  const { journeys, navigate, setPlannerDestination, openHotels } = useApp();
  const [imgError, setImgError] = useState(false);

  const heroImg = place.photoUrl || place.image || place.imageUrl;
  const hasValidImage = Boolean(heroImg && !imgError);

  // Weather state
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Hotels state
  const [hotels, setHotels] = useState<CuratedHotelItem[]>([]);
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [hotelsLoading, setHotelsLoading] = useState(true);

  const lat = place.lat ?? place.latitude;
  const lon = place.lon ?? place.longitude;
  const mapsUrl = buildMapsUrl(place.name, lat, lon);
  const existingTrip = findTripForPlace(journeys, place.name);
  const description = place.significance || place.description;

  // Fetch Weather
  useEffect(() => {
    let active = true;
    setWeatherLoading(true);

    let path = '/destinations/weather';
    if (lat != null && lon != null) {
      path += `?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
    } else if (place.name) {
      path += `?destination=${encodeURIComponent(place.name)}`;
    } else {
      setWeatherLoading(false);
      return;
    }

    apiFetch<WeatherResponse>(path)
      .then((data) => {
        if (!active) return;
        if (data && (data.temperature && data.temperature !== 'N/A' || data.temp_max != null || data.condition)) {
          setWeather(data);
        } else {
          setWeather(null);
        }
      })
      .catch(() => {
        if (active) setWeather(null);
      })
      .finally(() => {
        if (active) setWeatherLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, place.name]);

  // Fetch Curated Hotels
  useEffect(() => {
    let active = true;
    setHotelsLoading(true);
    const queryDest = place.city || place.name;
    apiFetch<{ curatedHotels?: CuratedHotelItem[]; hotels?: CuratedHotelItem[]; bookingComSearchUrl?: string }>(
      `/hotels/search?destination=${encodeURIComponent(queryDest)}`
    )
      .then((res) => {
        if (!active) return;
        setHotels(res.curatedHotels || res.hotels || []);
        if (res.bookingComSearchUrl) setBookingUrl(res.bookingComSearchUrl);
      })
      .catch(() => {
        if (active) setHotels([]);
      })
      .finally(() => {
        if (active) setHotelsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [place.city, place.name]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F5F0' }}>
      {/* ── Hero ── */}
      <div className="text-white pt-16 pb-14 px-4 sm:px-6 relative overflow-hidden" style={{ backgroundColor: '#111111' }}>
        {hasValidImage ? (
          <>
            <div className="absolute inset-0">
              <img
                src={heroImg}
                alt={place.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover opacity-40"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/70 to-transparent" />
          </>
        ) : (
          <div
            className="absolute inset-0 opacity-20 flex items-center justify-center font-display font-bold text-9xl text-white/10 select-none"
            style={{
              background: 'linear-gradient(135deg, #1c1c1c 0%, #111111 100%)',
            }}
          >
            {place.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="max-w-5xl mx-auto relative z-10">
          <button
            onClick={() => navigate('explore')}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors mb-6"
          >
            <span>←</span>
            <span>Back to Explore</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(place.category || place.type) && (
              <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wider uppercase" style={{ borderRadius: '2px' }}>
                {place.category || place.type}
              </span>
            )}
            <span
              className="px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase"
              style={{
                borderRadius: '2px',
                backgroundColor: place.isCurated ? '#C9A96E' : 'rgba(255,255,255,0.15)',
                color: place.isCurated ? '#111111' : '#FFFFFF',
              }}
            >
              {place.isCurated ? 'Curated' : 'Nearby, not curated'}
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 tracking-tight">
            {place.name}
          </h1>

          <p className="text-base sm:text-lg text-white/70 max-w-2xl">
            {place.address || [place.city, place.state, place.country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Existing Trip Alert ── */}
        {existingTrip && (
          <div
            className="mb-10 p-5 bg-[#C9A96E]/10 border border-[#C9A96E]/30 flex items-center justify-between flex-wrap gap-4"
            style={{ borderRadius: '2px' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#C9A96E' }}>Your Itinerary</p>
              <p className="font-display text-base font-bold text-[#111111]">
                You already have a trip here: {existingTrip.title || existingTrip.destination}
              </p>
              <p className="text-xs text-[#77736C] mt-0.5">
                {[existingTrip.startDate, existingTrip.endDate].filter(Boolean).join(' to ') || existingTrip.destination}
              </p>
            </div>
            <button
              onClick={() => navigate('journey', { selectedJourneyId: existingTrip.id })}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
              style={{ borderRadius: '2px' }}
            >
              View Trip →
            </button>
          </div>
        )}

        {/* ── About Section ── */}
        {description && (
          <section className="mb-10">
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#C9A96E' }}>Overview</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">About {place.name}</h2>
            </div>
            <p className="text-base text-[#252525] leading-relaxed max-w-3xl whitespace-pre-line">{description}</p>
          </section>
        )}

        {/* ── Location & Directions Section ── */}
        {mapsUrl && (
          <section className="mb-10">
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#C9A96E' }}>Location</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Getting There</h2>
            </div>
            <div
              className="p-5 border border-[#E8E4DC] bg-white flex items-center justify-between flex-wrap gap-4"
              style={{ borderRadius: '2px' }}
            >
              <div>
                <p className="text-sm font-semibold text-[#111111]">{place.name}</p>
                {place.address && <p className="text-xs text-[#77736C] mt-0.5">{place.address}</p>}
                <p className="text-xs text-[#77736C] mt-0.5 font-mono">
                  Coordinates: {Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}
                </p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                <span>Open in Maps</span>
                <span>↗</span>
              </a>
            </div>
          </section>
        )}

        {/* ── Weather Section (Fail-Soft) ── */}
        {weatherLoading ? (
          <section className="mb-10">
            <div className="p-5 border border-[#E8E4DC] bg-white animate-pulse" style={{ borderRadius: '2px' }}>
              <div className="h-4 bg-[#E8E4DC] w-32 mb-2" />
              <div className="h-6 bg-[#E8E4DC] w-24" />
            </div>
          </section>
        ) : weather ? (
          <section className="mb-10">
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#C9A96E' }}>Forecast</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Local Weather</h2>
            </div>
            <div
              className="p-5 border border-[#E8E4DC] bg-white flex items-center justify-between flex-wrap gap-4"
              style={{ borderRadius: '2px' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 bg-[#F7F5F0] border border-[#E8E4DC] flex items-center justify-center text-2xl"
                  style={{ borderRadius: '2px' }}
                >
                  ☀️
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-3xl text-[#111111]">
                      {weather.temperature && weather.temperature !== 'N/A'
                        ? weather.temperature
                        : weather.temp_max != null
                        ? `${Math.round(weather.temp_max)}°C`
                        : '—'}
                    </span>
                    <span className="text-sm font-medium text-[#77736C] capitalize">
                      {weather.description || weather.condition || ''}
                    </span>
                  </div>
                  {weather.temp_min != null && weather.temp_max != null && (
                    <p className="text-xs text-[#77736C] mt-0.5 font-mono">
                      Low: {Math.round(weather.temp_min)}°C • High: {Math.round(weather.temp_max)}°C
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold tracking-wider text-[#77736C] uppercase bg-[#F7F5F0] px-2.5 py-1 border border-[#E8E4DC]"
                  style={{ borderRadius: '2px' }}
                >
                  Forecast from OpenWeather
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Where to Stay Section ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#C9A96E' }}>Accommodations</p>
              <h2 className="text-xl font-display font-bold text-[#111111]">Where to Stay</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openHotels({ destination: place.city || place.name })}
                className="text-xs font-semibold text-[#111111] hover:text-[#C9A96E] transition-colors"
              >
                See more hotels →
              </button>
              {bookingUrl && (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#111111] hover:text-[#C9A96E] transition-colors flex items-center gap-1"
                >
                  <span>Live rates on Booking.com</span>
                  <span>↗</span>
                </a>
              )}
            </div>
          </div>

          {hotelsLoading ? (
            <div className="p-6 border border-[#E8E4DC] bg-white animate-pulse" style={{ borderRadius: '2px' }}>
              <div className="h-4 bg-[#E8E4DC] w-1/4 mb-3" />
              <div className="h-3 bg-[#E8E4DC] w-1/2" />
            </div>
          ) : hotels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotels.map((h, i) => (
                <CuratedHotelCard
                  key={h._id || i}
                  hotel={h}
                  bookingUrl={bookingUrl}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 border border-[#E8E4DC] bg-white" style={{ borderRadius: '2px' }}>
              <p className="text-sm text-[#77736C]">No curated hotels for this place yet.</p>
            </div>
          )}
        </section>

        {/* ── Plan CTA Banner ── */}
        <section className="mb-12">
          <div
            className="p-8 sm:p-10 text-white relative overflow-hidden"
            style={{ backgroundColor: '#111111', borderRadius: '2px' }}
          >
            <div className="max-w-2xl relative z-10">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-2" style={{ color: '#C9A96E' }}>
                AI Trip Planning
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold mb-3">
                Ready to experience {place.name}?
              </h2>
              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                Let Journey AI craft a complete itinerary with real activities, stays, and pacing tailored to your travel style.
              </p>
              <button
                onClick={() => {
                  setPlannerDestination(place.name, '');
                  navigate('ai-planner');
                }}
                className="px-6 py-3 font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#C9A96E', color: '#111111', borderRadius: '2px' }}
              >
                Plan a trip to {place.name}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DestinationRouter() {
  const { selectedPlace, selectedDestinationId, navigate } = useApp();
  const mockIds = destinations.map((d) => d.id);

  const decision = destinationView({
    selectedPlace,
    selectedDestinationId,
    mockIds,
    showSample: SHOW_SAMPLE_PAGES,
  });

  if (decision === 'live' && selectedPlace) {
    return <LiveDestinationPage place={selectedPlace} />;
  }

  if (decision === 'sample') {
    return (
      <>
        <SampleDataBanner />
        <SampleDestinationPage />
      </>
    );
  }

  // Not found state: never fall back to destinations[0]
  return (
    <div className="min-h-screen bg-[#F7F5F0] py-20 px-4 flex items-center justify-center">
      <div
        className="max-w-md w-full bg-white p-8 sm:p-10 text-center border border-[#E8E4DC]"
        style={{ borderRadius: '2px' }}
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F7F5F0] border border-[#E8E4DC] flex items-center justify-center text-xl text-[#77736C]">
          🧭
        </div>
        <h2 className="font-display text-2xl font-bold text-[#111111] mb-2">Destination Not Found</h2>
        <p className="text-sm text-[#77736C] mb-8 leading-relaxed">
          We couldn't find that destination. Open it from Explore.
        </p>
        <button
          onClick={() => navigate('explore')}
          className="w-full py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
          style={{ borderRadius: '2px' }}
        >
          Explore Destinations
        </button>
      </div>
    </div>
  );
}
