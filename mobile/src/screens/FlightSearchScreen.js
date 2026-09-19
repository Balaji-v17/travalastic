import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { API_BASE_URL } from '../config/api';

/**
 * Formats a Date object to YYYY-MM-DD
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns an initial future date (14 days from today)
 */
const getInitialDepartureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return formatDate(d);
};

/**
 * Formats ISO 8601 duration (e.g. PT7H50M) to human-readable (e.g. 7h 50m)
 */
const formatDuration = (isoDuration) => {
  if (!isoDuration || typeof isoDuration !== 'string') return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  const hours = match[1] ? `${match[1]}h` : '';
  const minutes = match[2] ? `${match[2]}m` : '';
  return [hours, minutes].filter(Boolean).join(' ') || isoDuration;
};

/**
 * Formats ISO datetime string to readable time / date
 */
const formatTime = (isoString) => {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return isoString;
  }
};

const formatDateSnippet = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function FlightSearchScreen({ navigation }) {
  const [origin, setOrigin] = useState('LHR');
  const [destination, setDestination] = useState('JFK');
  const [departureDate, setDepartureDate] = useState(getInitialDepartureDate());
  const [passengers, setPassengers] = useState(1);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = initial, [] = empty, array = flights
  const [errorMessage, setErrorMessage] = useState('');

  // Quick helper to increment departure date
  const adjustDate = (days) => {
    try {
      const current = new Date(departureDate);
      if (isNaN(current.getTime())) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + days);
        setDepartureDate(formatDate(fallback));
        return;
      }
      current.setDate(current.getDate() + days);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (current <= today) {
        return; // Don't allow past dates via preset
      }
      setDepartureDate(formatDate(current));
    } catch {
      // ignore
    }
  };

  const handleSearch = async () => {
    Keyboard.dismiss();
    setErrorMessage('');

    const cleanOrigin = (origin || '').trim().toUpperCase();
    const cleanDest = (destination || '').trim().toUpperCase();
    const cleanDate = (departureDate || '').trim();

    // 1. Validate 3-letter IATA codes client-side
    const iataRegex = /^[A-Z]{3}$/;
    if (!cleanOrigin || !iataRegex.test(cleanOrigin)) {
      setErrorMessage('Origin must be a valid 3-letter IATA airport code (e.g. LHR, JFK, SFO).');
      return;
    }

    if (!cleanDest || !iataRegex.test(cleanDest)) {
      setErrorMessage('Destination must be a valid 3-letter IATA airport code (e.g. JFK, LHR, CDG).');
      return;
    }

    if (cleanOrigin === cleanDest) {
      setErrorMessage('Origin and destination cannot be the same airport code.');
      return;
    }

    // 2. Validate departure date format and future constraint
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!cleanDate || !dateRegex.test(cleanDate)) {
      setErrorMessage('Departure date must be in YYYY-MM-DD format.');
      return;
    }

    const parsedDate = new Date(cleanDate);
    if (isNaN(parsedDate.getTime())) {
      setErrorMessage('Departure date is invalid.');
      return;
    }

    const todayStr = formatDate(new Date());
    if (cleanDate <= todayStr) {
      setErrorMessage('Departure date must be a future date.');
      return;
    }

    // 3. Perform network search
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/flights/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          origin: cleanOrigin,
          destination: cleanDest,
          departureDate: cleanDate,
          passengers,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.error || 'Failed to search flights. Please try again.';
        setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
        setResults([]);
        setLoading(false);
        return;
      }

      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Flight search error:', error);
      setErrorMessage(
        'Unable to connect to flight search service. Please check your network connection.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOffer = (offer) => {
    // Navigate to PassengerFormScreen passing selected offer details
    navigation.navigate('PassengerForm', {
      offerId: offer.offerId,
      passengerCount: passengers,
      offer,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Search Header Card */}
        <View style={styles.searchCard}>
          <Text style={styles.heading}>Find Flights ✈️</Text>
          <Text style={styles.subheading}>
            Search real-time airline routes and book instantly with Duffel.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage('')}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Airport Inputs */}
          <View style={styles.airportRow}>
            <View style={styles.airportCol}>
              <Text style={styles.inputLabel}>Origin (IATA)</Text>
              <TextInput
                style={styles.iataInput}
                placeholder="LHR"
                placeholderTextColor="#94a3b8"
                value={origin}
                onChangeText={(text) => {
                  setOrigin(text.toUpperCase());
                  if (errorMessage) setErrorMessage('');
                }}
                maxLength={3}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.airportDivider}>
              <Text style={styles.planeIcon}>✈️</Text>
            </View>

            <View style={styles.airportCol}>
              <Text style={styles.inputLabel}>Destination (IATA)</Text>
              <TextInput
                style={styles.iataInput}
                placeholder="JFK"
                placeholderTextColor="#94a3b8"
                value={destination}
                onChangeText={(text) => {
                  setDestination(text.toUpperCase());
                  if (errorMessage) setErrorMessage('');
                }}
                maxLength={3}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Departure Date */}
          <Text style={styles.inputLabel}>Departure Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={departureDate}
            onChangeText={(text) => {
              setDepartureDate(text);
              if (errorMessage) setErrorMessage('');
            }}
            editable={!loading}
          />

          {/* Date Adjuster Chips */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick adjust:</Text>
            {[
              { label: '+1 Day', days: 1 },
              { label: '+3 Days', days: 3 },
              { label: '+1 Wk', days: 7 },
              { label: '+2 Wks', days: 14 },
            ].map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={styles.presetBadge}
                onPress={() => adjustDate(preset.days)}
                disabled={loading}
              >
                <Text style={styles.presetBadgeText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Passenger Count Stepper */}
          <View style={styles.stepperRow}>
            <View>
              <Text style={styles.inputLabel}>Passengers</Text>
              <Text style={styles.stepperSubtext}>Adults (12+ yrs)</Text>
            </View>
            <View style={styles.stepperControls}>
              <TouchableOpacity
                style={[styles.stepperBtn, (passengers <= 1 || loading) && styles.stepperBtnDisabled]}
                onPress={() => setPassengers((prev) => Math.max(1, prev - 1))}
                disabled={passengers <= 1 || loading}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{passengers}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, (passengers >= 9 || loading) && styles.stepperBtnDisabled]}
                onPress={() => setPassengers((prev) => Math.min(9, prev + 1))}
                disabled={passengers >= 9 || loading}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Explicit Search Button */}
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.searchLoadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.searchButtonText}>Searching Flights...</Text>
              </View>
            ) : (
              <Text style={styles.searchButtonText}>Search Flights</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingTitle}>Querying airline availability…</Text>
            <Text style={styles.loadingSubtitle}>
              Contacting global airline networks via Duffel for live seat availability and fares.
            </Text>
          </View>
        ) : null}

        {/* Empty Results State */}
        {!loading && results !== null && results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛫</Text>
            <Text style={styles.emptyTitle}>No flights found for this route/date</Text>
            <Text style={styles.emptySubtitle}>
              There are no available flights matching {origin} → {destination} on {departureDate}.
              In sandbox test mode, try popular test routes like LHR to JFK or adjust your date.
            </Text>
          </View>
        ) : null}

        {/* Flight Cards List */}
        {!loading && Array.isArray(results) && results.length > 0 ? (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              Found {results.length} flight {results.length === 1 ? 'offer' : 'offers'}
            </Text>

            {results.map((item, index) => {
              const formattedDuration = formatDuration(item.duration);
              const depTime = formatTime(item.departureTime);
              const arrTime = formatTime(item.arrivalTime);
              const depDate = formatDateSnippet(item.departureTime);

              return (
                <TouchableOpacity
                  key={item.offerId || index}
                  style={styles.flightCard}
                  activeOpacity={0.8}
                  onPress={() => handleSelectOffer(item)}
                >
                  {/* Card Header: Airline & Price */}
                  <View style={styles.cardHeader}>
                    <View style={styles.airlineBadge}>
                      <Text style={styles.airlineName}>{item.airline || item.airlineName || 'Airline'}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceAmount}>
                        {item.price?.currency === 'USD' ? '$' : `${item.price?.currency} `}
                        {Number(item.price?.amount || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.priceSubtext}>total per traveler</Text>
                    </View>
                  </View>

                  {/* Flight Times & Route */}
                  <View style={styles.flightTimeline}>
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeText}>{depTime}</Text>
                      <Text style={styles.airportCode}>{origin}</Text>
                      {depDate ? <Text style={styles.dateSnippet}>{depDate}</Text> : null}
                    </View>

                    <View style={styles.timelineMiddle}>
                      {formattedDuration ? (
                        <Text style={styles.durationText}>{formattedDuration}</Text>
                      ) : null}
                      <View style={styles.flightPathLine}>
                        <View style={styles.dot} />
                        <View style={styles.line} />
                        <Text style={styles.planeSymbol}>✈</Text>
                        <View style={styles.line} />
                        <View style={styles.dot} />
                      </View>
                      <Text style={styles.directLabel}>Direct / One-way</Text>
                    </View>

                    <View style={[styles.timeBlock, styles.timeBlockRight]}>
                      <Text style={styles.timeText}>{arrTime}</Text>
                      <Text style={styles.airportCode}>{destination}</Text>
                    </View>
                  </View>

                  {/* Card Footer: Action */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.selectOfferText}>Select Flight →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  dismissText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 12,
  },
  airportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  airportCol: {
    flex: 1,
  },
  airportDivider: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  planeIcon: {
    fontSize: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  iataInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: 2,
  },
  dateInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  presetLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  presetBadge: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  presetBadgeText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 18,
  },
  stepperSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    minWidth: 20,
    textAlign: 'center',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsContainer: {
    gap: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  flightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  airlineBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  airlineName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  priceSubtext: {
    fontSize: 11,
    color: '#64748b',
  },
  flightTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeBlock: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  timeBlockRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  airportCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  dateSnippet: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  timelineMiddle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  flightPathLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#cbd5e1',
  },
  planeSymbol: {
    fontSize: 11,
    color: '#2563eb',
    paddingHorizontal: 4,
  },
  directLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  selectOfferText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
});

