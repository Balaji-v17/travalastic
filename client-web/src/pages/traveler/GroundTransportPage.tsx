import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp, type TransportPrefill } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { apiFetch } from '../../lib/api';
import {
  buildUberUrl,
  validateRental,
  buildRentalUrl,
  extractActivityCoordinates,
  activityHasCoordinates,
  isAffiliateUrl,
  type RentalInput,
} from '../../lib/transportLinks';
import type { PlaceResult } from '../../lib/destinationView';

type CabDropoffMode = 'trip' | 'search' | 'manual';

export default function GroundTransportPage() {
  const {
    transportTab,
    setTransportTab,
    transportPrefill,
    journeys,
    navigate,
  } = useApp();
  const { status } = useAuth();

  const activeTab = transportTab || 'cab';

  // -------------------------------------------------------------
  // CAB STATE
  // -------------------------------------------------------------
  const [dropoffMode, setDropoffMode] = useState<CabDropoffMode>(() => {
    if (transportPrefill?.lat != null && transportPrefill?.lon != null) {
      return 'search';
    }
    return status === 'authed' && journeys.length > 0 ? 'trip' : 'search';
  });

  // Trip selection
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(() => {
    return journeys[0]?.id || '';
  });
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');

  // Destination search selection
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return transportPrefill?.dropoffName || transportPrefill?.destination || '';
  });
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(() => {
    if (transportPrefill?.place) return transportPrefill.place;
    if (transportPrefill?.lat != null && transportPrefill?.lon != null) {
      return {
        name: transportPrefill.dropoffName || transportPrefill.destination || 'Selected Destination',
        lat: transportPrefill.lat,
        lon: transportPrefill.lon,
      };
    }
    return null;
  });

  // -------------------------------------------------------------
  // CAR RENTAL STATE
  // -------------------------------------------------------------
  const todayStr = useMemo(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  }, []);

  const [rentalLocation, setRentalLocation] = useState<string>(() => {
    return transportPrefill?.destination || '';
  });
  const [pickupDate, setPickupDate] = useState<string>('');
  const [dropoffDate, setDropoffDate] = useState<string>('');
  const [driverAge, setDriverAge] = useState<string>('');
  const [rentalErrors, setRentalErrors] = useState<Record<string, string>>({});
  const [rentalSubmitting, setRentalSubmitting] = useState(false);
  const [lastGeneratedRentalUrl, setLastGeneratedRentalUrl] = useState<string | null>(null);

  // Sync prefill if it arrives
  useEffect(() => {
    if (transportPrefill?.destination && !rentalLocation) {
      setRentalLocation(transportPrefill.destination);
    }
    if (transportPrefill?.dropoffName && !searchQuery) {
      setSearchQuery(transportPrefill.dropoffName);
    }
    if (transportPrefill?.lat != null && transportPrefill?.lon != null && !selectedPlace) {
      setSelectedPlace({
        name: transportPrefill.dropoffName || transportPrefill.destination || 'Selected Destination',
        lat: transportPrefill.lat,
        lon: transportPrefill.lon,
      });
      setDropoffMode('search');
    }
  }, [transportPrefill]);

  // Keep selected journey valid
  useEffect(() => {
    if (journeys.length > 0 && !journeys.some((j) => j.id === selectedJourneyId)) {
      setSelectedJourneyId(journeys[0].id);
      setSelectedActivityId('');
    }
  }, [journeys, selectedJourneyId]);

  // Debounced search for places
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (dropoffMode !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch<{ results?: PlaceResult[]; destinations?: PlaceResult[] }>(
          `/destinations/search?q=${encodeURIComponent(q)}`
        );
        const list = res.results || res.destinations || [];
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, dropoffMode]);

  // Find activities for currently chosen journey
  const activeJourney = useMemo(() => {
    return journeys.find((j) => j.id === selectedJourneyId);
  }, [journeys, selectedJourneyId]);

  const journeyActivities = useMemo(() => {
    if (!activeJourney) return [];
    return activeJourney.itinerary.flatMap((day) =>
      day.activities.map((act) => ({
        ...act,
        dayNumber: day.day,
        hasCoords: activityHasCoordinates(act),
      }))
    );
  }, [activeJourney]);

  // Resolved dropoff coordinates for Cab
  const resolvedDropoff = useMemo(() => {
    if (dropoffMode === 'manual') {
      return null;
    }
    if (dropoffMode === 'trip') {
      const act = journeyActivities.find((a) => a.id === selectedActivityId);
      if (!act) return null;
      const coords = extractActivityCoordinates(act);
      if (!coords) return null;
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        nickname: coords.name,
      };
    }
    if (dropoffMode === 'search') {
      if (!selectedPlace) return null;
      const coords = extractActivityCoordinates(selectedPlace);
      if (!coords) return null;
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        nickname: coords.name,
      };
    }
    return null;
  }, [dropoffMode, selectedActivityId, journeyActivities, selectedPlace]);

  // Uber URL
  const uberUrl = useMemo(() => {
    const clientId = import.meta.env?.VITE_UBER_CLIENT_ID || undefined;
    return buildUberUrl({
      pickup: null, // Resolves to 'my_location'
      dropoff: resolvedDropoff,
      clientId,
    });
  }, [resolvedDropoff]);

  // Car rental preset durations
  function applyDurationPreset(days: number) {
    const baseDateStr = pickupDate && pickupDate >= todayStr ? pickupDate : todayStr;
    const base = new Date(baseDateStr + 'T00:00:00');
    base.setDate(base.getDate() + days);
    const targetStr = [
      base.getFullYear(),
      String(base.getMonth() + 1).padStart(2, '0'),
      String(base.getDate()).padStart(2, '0'),
    ].join('-');
    if (!pickupDate) {
      setPickupDate(baseDateStr);
    }
    setDropoffDate(targetStr);
    setRentalErrors((prev) => {
      const copy = { ...prev };
      delete copy.dropoffAt;
      return copy;
    });
  }

  // Handle rental submit
  async function handleRentalSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: RentalInput = {
      location: rentalLocation,
      pickupAt: pickupDate,
      dropoffAt: dropoffDate,
      driverAge: driverAge ? parseInt(driverAge, 10) : null,
    };

    const val = validateRental(input, new Date());
    if (!val.valid) {
      setRentalErrors(val.errors);
      return;
    }
    setRentalErrors({});
    setRentalSubmitting(true);

    let destinationUrl: string;
    try {
      const params = new URLSearchParams({
        destination: rentalLocation.trim(),
        pickupDate: pickupDate.trim(),
        dropoffDate: dropoffDate.trim(),
      });
      const data = await apiFetch<{ carsSearchUrl?: string }>(`/cars/search?${params.toString()}`);
      if (data?.carsSearchUrl) {
        destinationUrl = data.carsSearchUrl;
      } else {
        destinationUrl = buildRentalUrl({
          location: rentalLocation.trim(),
          pickupDate: pickupDate.trim(),
          dropoffDate: dropoffDate.trim(),
        });
      }
    } catch {
      destinationUrl = buildRentalUrl({
        location: rentalLocation.trim(),
        pickupDate: pickupDate.trim(),
        dropoffDate: dropoffDate.trim(),
      });
    } finally {
      setRentalSubmitting(false);
    }

    setLastGeneratedRentalUrl(destinationUrl);
    window.open(destinationUrl, '_blank', 'noopener,noreferrer');
  }

  const isAffiliate = isAffiliateUrl(lastGeneratedRentalUrl);

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-slate-900 pb-24">
      {/* Page Header */}
      <div className="bg-slate-950 text-white border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#C9A96E] mb-2">
            Seamless Connections
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white mb-3">
            Ground Transport
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            Direct options for getting around. Rides and car rentals open directly with our trusted partner networks.
          </p>

          {/* Tab Switcher */}
          <div className="flex gap-2 mt-8 p-1 bg-white/10 rounded-xl max-w-xs">
            <button
              type="button"
              onClick={() => setTransportTab('cab')}
              className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'cab'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Cab (Uber)
            </button>
            <button
              type="button"
              onClick={() => setTransportTab('rental')}
              className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'rental'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Car Rental
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {/* ========================================================= */}
        {/* CAB TAB */}
        {/* ========================================================= */}
        {activeTab === 'cab' && (
          <div className="max-w-2xl bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-950">Ride with Uber</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Launch Uber with your drop-off pre-set. Fares and drivers are managed directly inside the Uber app.
              </p>
            </div>

            {/* Pickup Location Section */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Pickup Location
              </label>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-3">
                <span className="text-emerald-700 text-base leading-none">📍</span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-emerald-950">
                    My current location (Uber finds it)
                  </p>
                  <p className="text-xs text-emerald-800/80 leading-relaxed">
                    Uber automatically detects your pickup location when opening. Travalastic never requests or accesses your device location.
                  </p>
                </div>
              </div>
            </div>

            {/* Drop-off Destination Section */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Drop-off Destination
              </label>

              {/* Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDropoffMode('trip')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                    dropoffMode === 'trip'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  From my trip
                </button>
                <button
                  type="button"
                  onClick={() => setDropoffMode('search')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                    dropoffMode === 'search'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Search a place
                </button>
                <button
                  type="button"
                  onClick={() => setDropoffMode('manual')}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                    dropoffMode === 'manual'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Enter in Uber
                </button>
              </div>

              {/* Option A: From my trip */}
              {dropoffMode === 'trip' && (
                <div className="space-y-3 pt-2">
                  {status !== 'authed' ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                      <p className="text-xs text-slate-600">
                        Sign in to choose activities and stays directly from your saved trips.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('auth')}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Sign in
                      </button>
                    </div>
                  ) : journeys.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                      No saved trips found yet. You can search for a destination or enter it directly in Uber.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Select Trip</label>
                        <select
                          value={selectedJourneyId}
                          onChange={(e) => {
                            setSelectedJourneyId(e.target.value);
                            setSelectedActivityId('');
                          }}
                          className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          {journeys.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.title} ({j.destination})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Select Activity or Stop</label>
                        {journeyActivities.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No itinerary activities found for this trip.</p>
                        ) : (
                          <select
                            value={selectedActivityId}
                            onChange={(e) => setSelectedActivityId(e.target.value)}
                            className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          >
                            <option value="">-- Choose a stop --</option>
                            {journeyActivities.map((act) => (
                              <option
                                key={act.id}
                                value={act.id}
                                disabled={!act.hasCoords}
                              >
                                Day {act.dayNumber}: {act.title} {!act.hasCoords ? '(coordinates unavailable)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Option B: Search a place */}
              {dropoffMode === 'search' && (
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedPlace(null);
                      }}
                      placeholder="Search landmark, attraction, or city..."
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    {isSearching && (
                      <span className="absolute right-3.5 top-3 text-xs text-slate-400 animate-pulse">
                        Searching…
                      </span>
                    )}
                  </div>

                  {selectedPlace && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-800">
                      <div>
                        <p className="font-semibold text-slate-900">{selectedPlace.name}</p>
                        <p className="text-slate-500">
                          {[selectedPlace.city, selectedPlace.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                        Selected
                      </span>
                    </div>
                  )}

                  {!selectedPlace && searchResults.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white shadow-sm">
                      {searchResults.map((place, idx) => {
                        const coords = extractActivityCoordinates(place);
                        return (
                          <button
                            key={place.placeId || place._id || idx}
                            type="button"
                            onClick={() => {
                              setSelectedPlace(place);
                              setSearchQuery(place.name);
                              setSearchResults([]);
                            }}
                            disabled={!coords}
                            className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between ${
                              coords
                                ? 'hover:bg-slate-50 cursor-pointer text-slate-900'
                                : 'opacity-40 cursor-not-allowed bg-slate-50/50 text-slate-500'
                            }`}
                          >
                            <div>
                              <p className="font-medium">{place.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {[place.city, place.country].filter(Boolean).join(', ')}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {coords ? 'Select' : 'No coords'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Option C: Enter in Uber */}
              {dropoffMode === 'manual' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  Uber will prompt you for your destination when the app opens.
                </div>
              )}
            </div>

            {/* Launch Action */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <a
                href={uberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>Open Uber</span>
                <span className="text-xs">↗</span>
              </a>
              <p className="text-center text-xs text-slate-500">
                Opens Uber. Fares and availability are shown there. Nothing is booked here.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CAR RENTAL TAB */}
        {/* ========================================================= */}
        {activeTab === 'rental' && (
          <div className="max-w-2xl bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-950">Car Rental</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Compare rates and vehicle types with our rental partner network. Stays and cars open directly on the provider's site.
              </p>
            </div>

            <form onSubmit={handleRentalSubmit} className="space-y-5" noValidate>
              {/* Pickup Location */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Pickup Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rentalLocation}
                  onChange={(e) => {
                    setRentalLocation(e.target.value);
                    if (rentalErrors.location) {
                      setRentalErrors((prev) => {
                        const c = { ...prev };
                        delete c.location;
                        return c;
                      });
                    }
                  }}
                  placeholder="e.g. San Francisco International Airport or Rome"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {rentalErrors.location && (
                  <p className="text-xs text-red-600 mt-1">{rentalErrors.location}</p>
                )}
              </div>

              {/* Dates Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Pickup Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={pickupDate}
                    onChange={(e) => {
                      setPickupDate(e.target.value);
                      if (rentalErrors.pickupAt) {
                        setRentalErrors((prev) => {
                          const c = { ...prev };
                          delete c.pickupAt;
                          return c;
                        });
                      }
                    }}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  {rentalErrors.pickupAt && (
                    <p className="text-xs text-red-600 mt-1">{rentalErrors.pickupAt}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Drop-off Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    min={pickupDate || todayStr}
                    value={dropoffDate}
                    onChange={(e) => {
                      setDropoffDate(e.target.value);
                      if (rentalErrors.dropoffAt) {
                        setRentalErrors((prev) => {
                          const c = { ...prev };
                          delete c.dropoffAt;
                          return c;
                        });
                      }
                    }}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  {rentalErrors.dropoffAt && (
                    <p className="text-xs text-red-600 mt-1">{rentalErrors.dropoffAt}</p>
                  )}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5">
                  Quick duration presets (from pickup date)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[3, 5, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => applyDurationPreset(days)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      +{days} days
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver Age */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Driver Age <span className="text-slate-400 font-normal lowercase">(optional, 21–75)</span>
                </label>
                <input
                  type="number"
                  min="21"
                  max="75"
                  value={driverAge}
                  onChange={(e) => {
                    setDriverAge(e.target.value);
                    if (rentalErrors.driverAge) {
                      setRentalErrors((prev) => {
                        const c = { ...prev };
                        delete c.driverAge;
                        return c;
                      });
                    }
                  }}
                  placeholder="e.g. 30"
                  className="w-32 text-xs sm:text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {rentalErrors.driverAge && (
                  <p className="text-xs text-red-600 mt-1">{rentalErrors.driverAge}</p>
                )}
              </div>

              {/* Action Button & Disclosures */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <button
                  type="submit"
                  disabled={rentalSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <span>{rentalSubmitting ? 'Preparing options…' : 'Open rental options'}</span>
                  <span className="text-xs">↗</span>
                </button>

                {isAffiliate && (
                  <p className="text-center text-[11px] text-slate-500">
                    We may earn a commission if you book through these links.
                  </p>
                )}

                <p className="text-center text-xs text-slate-500">
                  Opens our rental partner's site. Prices and availability are shown there.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
