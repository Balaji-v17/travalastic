import React, { useState, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/api';

/**
 * Formats an airport suggestion to "Airport Name (IATA) — City, Country"
 */
const formatAirportLabel = (airport) => {
  if (!airport) return '';
  const locationParts = [airport.cityName, airport.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` — ${locationParts.join(', ')}` : '';
  return `${airport.name} (${airport.iataCode})${locationStr}`;
};

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
  // Stored IATA codes (what gets sent to /flights/search) and input text
  const [originIata, setOriginIata] = useState('LHR');
  const [originText, setOriginText] = useState('Heathrow Airport (LHR) — London, United Kingdom');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [originLoading, setOriginLoading] = useState(false);
  const [originShowDropdown, setOriginShowDropdown] = useState(false);
  const [originFocused, setOriginFocused] = useState(false);

  const [destinationIata, setDestinationIata] = useState('JFK');
  const [destinationText, setDestinationText] = useState('John F. Kennedy International Airport (JFK) — New York, United States');
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationShowDropdown, setDestinationShowDropdown] = useState(false);
  const [destinationFocused, setDestinationFocused] = useState(false);

  const [departureDate, setDepartureDate] = useState(getInitialDepartureDate());
  const [passengers, setPassengers] = useState(1);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = initial, [] = empty, array = flights
  const [errorMessage, setErrorMessage] = useState('');

  const originTimerRef = useRef(null);
  const destTimerRef = useRef(null);

  // Debounced search for origin airports (~350ms)
  const handleOriginChange = (text) => {
    setOriginText(text);
    // User typing: clear confirmed IATA code so free-text cannot be submitted directly
    setOriginIata(null);
    if (errorMessage) setErrorMessage('');

    if (originTimerRef.current) {
      clearTimeout(originTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      setOriginSuggestions([]);
      setOriginLoading(false);
      setOriginShowDropdown(false);
      return;
    }

    setOriginLoading(true);
    setOriginShowDropdown(true);

    originTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/flights/airports?query=${encodeURIComponent(trimmed)}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch airport suggestions');
        }
        const data = await response.json();
        setOriginSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Origin airport search error:', err);
        setOriginSuggestions([]);
      } finally {
        setOriginLoading(false);
      }
    }, 350);
  };

  // Debounced search for destination airports (~350ms)
  const handleDestinationChange = (text) => {
    setDestinationText(text);
    // User typing: clear confirmed IATA code so free-text cannot be submitted directly
    setDestinationIata(null);
    if (errorMessage) setErrorMessage('');

    if (destTimerRef.current) {
      clearTimeout(destTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      setDestinationSuggestions([]);
      setDestinationLoading(false);
      setDestinationShowDropdown(false);
      return;
    }

    setDestinationLoading(true);
    setDestinationShowDropdown(true);

    destTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/flights/airports?query=${encodeURIComponent(trimmed)}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch airport suggestions');
        }
        const data = await response.json();
        setDestinationSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Destination airport search error:', err);
        setDestinationSuggestions([]);
      } finally {
        setDestinationLoading(false);
      }
    }, 350);
  };

  const handleSelectOrigin = (airport) => {
    setOriginIata(airport.iataCode);
    setOriginText(formatAirportLabel(airport));
    setOriginShowDropdown(false);
    setOriginSuggestions([]);
    Keyboard.dismiss();
    if (errorMessage) setErrorMessage('');
  };

  const handleSelectDestination = (airport) => {
    setDestinationIata(airport.iataCode);
    setDestinationText(formatAirportLabel(airport));
    setDestinationShowDropdown(false);
    setDestinationSuggestions([]);
    Keyboard.dismiss();
    if (errorMessage) setErrorMessage('');
  };

  const handleSwapAirports = () => {
    const tempIata = originIata;
    const tempText = originText;
    setOriginIata(destinationIata);
    setOriginText(destinationText);
    setDestinationIata(tempIata);
    setDestinationText(tempText);
    setOriginShowDropdown(false);
    setDestinationShowDropdown(false);
    if (errorMessage) setErrorMessage('');
  };

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
    setOriginShowDropdown(false);
    setDestinationShowDropdown(false);
    setErrorMessage('');

    // 1. Strictly enforce selecting a suggested airport (no raw free-text IATA submission)
    if (!originIata) {
      setErrorMessage(
        'Please search and select a valid Origin airport from the suggestions dropdown.'
      );
      return;
    }

    if (!destinationIata) {
      setErrorMessage(
        'Please select a valid Destination airport from the suggestions dropdown.'
      );
      return;
    }

    if (originIata === destinationIata) {
      setErrorMessage('Origin and destination cannot be the same airport.');
      return;
    }

    // 2. Validate departure date format and future constraint
    const cleanDate = (departureDate || '').trim();
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

    // 3. Perform network search using validated IATA codes
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
          origin: originIata,
          destination: destinationIata,
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

          {/* Origin Autocomplete Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Origin Airport</Text>
              {originIata ? (
                <View style={styles.iataBadge}>
                  <Text style={styles.iataBadgeText}>{originIata}</Text>
                </View>
              ) : (
                <Text style={styles.hintRequired}>*Select from suggestions</Text>
              )}
            </View>

            <View style={[styles.inputBox, originFocused && styles.inputBoxFocused]}>
              <Ionicons name="airplane-outline" size={18} color="#E8A33D" style={styles.inputPrefixIcon} />
              <TextInput
                style={styles.autocompleteInput}
                placeholder="Search airport or city (e.g. London, LHR, Tokyo)"
                placeholderTextColor="#666666"
                value={originText}
                onChangeText={handleOriginChange}
                onFocus={() => {
                  setOriginFocused(true);
                  if (originText.trim().length >= 2 && originSuggestions.length > 0) {
                    setOriginShowDropdown(true);
                  }
                }}
                onBlur={() => {
                  setOriginFocused(false);
                  setTimeout(() => setOriginShowDropdown(false), 250);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
              {originText.length > 0 && !loading && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setOriginText('');
                    setOriginIata(null);
                    setOriginSuggestions([]);
                    setOriginShowDropdown(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Origin Dropdown Suggestions */}
            {originShowDropdown && (
              <View style={styles.dropdownContainer}>
                {originLoading ? (
                  <View style={styles.dropdownLoadingRow}>
                    <ActivityIndicator size="small" color="#E8A33D" />
                    <Text style={styles.dropdownLoadingText}>Searching airports via Duffel…</Text>
                  </View>
                ) : originSuggestions.length === 0 ? (
                  <View style={styles.dropdownEmptyRow}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8E8E93" />
                    <Text style={styles.dropdownEmptyText}>
                      No matching airports found. Try another city or code.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.dropdownScroll}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {originSuggestions.map((item, index) => {
                      const isSelected = originIata === item.iataCode;
                      return (
                        <TouchableOpacity
                          key={`${item.iataCode}_${index}`}
                          style={[
                            styles.suggestionItem,
                            isSelected && styles.suggestionItemSelected,
                            index < originSuggestions.length - 1 && styles.suggestionBorder,
                          ]}
                          onPress={() => handleSelectOrigin(item)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.suggestionIconWrapper}>
                            <Ionicons name="airplane" size={16} color="#E8A33D" />
                          </View>
                          <View style={styles.suggestionTextWrapper}>
                            <View style={styles.suggestionMainRow}>
                              <Text style={styles.suggestionName} numberOfLines={1}>
                                {item.name}
                              </Text>
                              <View style={styles.suggestionCodeBadge}>
                                <Text style={styles.suggestionCodeText}>{item.iataCode}</Text>
                              </View>
                            </View>
                            <Text style={styles.suggestionSub} numberOfLines={1}>
                              {[item.cityName, item.country].filter(Boolean).join(', ')}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Swap / Divider Button */}
          <View style={styles.swapRow}>
            <View style={styles.swapLine} />
            <TouchableOpacity
              style={styles.swapButton}
              onPress={handleSwapAirports}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-vertical" size={18} color="#E8A33D" />
            </TouchableOpacity>
            <View style={styles.swapLine} />
          </View>

          {/* Destination Autocomplete Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Destination Airport</Text>
              {destinationIata ? (
                <View style={styles.iataBadge}>
                  <Text style={styles.iataBadgeText}>{destinationIata}</Text>
                </View>
              ) : (
                <Text style={styles.hintRequired}>*Select from suggestions</Text>
              )}
            </View>

            <View style={[styles.inputBox, destinationFocused && styles.inputBoxFocused]}>
              <Ionicons name="location-outline" size={18} color="#E8A33D" style={styles.inputPrefixIcon} />
              <TextInput
                style={styles.autocompleteInput}
                placeholder="Search airport or city (e.g. New York, JFK, Paris)"
                placeholderTextColor="#666666"
                value={destinationText}
                onChangeText={handleDestinationChange}
                onFocus={() => {
                  setDestinationFocused(true);
                  if (destinationText.trim().length >= 2 && destinationSuggestions.length > 0) {
                    setDestinationShowDropdown(true);
                  }
                }}
                onBlur={() => {
                  setDestinationFocused(false);
                  setTimeout(() => setDestinationShowDropdown(false), 250);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
              {destinationText.length > 0 && !loading && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setDestinationText('');
                    setDestinationIata(null);
                    setDestinationSuggestions([]);
                    setDestinationShowDropdown(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Destination Dropdown Suggestions */}
            {destinationShowDropdown && (
              <View style={styles.dropdownContainer}>
                {destinationLoading ? (
                  <View style={styles.dropdownLoadingRow}>
                    <ActivityIndicator size="small" color="#E8A33D" />
                    <Text style={styles.dropdownLoadingText}>Searching airports via Duffel…</Text>
                  </View>
                ) : destinationSuggestions.length === 0 ? (
                  <View style={styles.dropdownEmptyRow}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8E8E93" />
                    <Text style={styles.dropdownEmptyText}>
                      No matching airports found. Try another city or code.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.dropdownScroll}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {destinationSuggestions.map((item, index) => {
                      const isSelected = destinationIata === item.iataCode;
                      return (
                        <TouchableOpacity
                          key={`${item.iataCode}_${index}`}
                          style={[
                            styles.suggestionItem,
                            isSelected && styles.suggestionItemSelected,
                            index < destinationSuggestions.length - 1 && styles.suggestionBorder,
                          ]}
                          onPress={() => handleSelectDestination(item)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.suggestionIconWrapper}>
                            <Ionicons name="airplane" size={16} color="#E8A33D" />
                          </View>
                          <View style={styles.suggestionTextWrapper}>
                            <View style={styles.suggestionMainRow}>
                              <Text style={styles.suggestionName} numberOfLines={1}>
                                {item.name}
                              </Text>
                              <View style={styles.suggestionCodeBadge}>
                                <Text style={styles.suggestionCodeText}>{item.iataCode}</Text>
                              </View>
                            </View>
                            <Text style={styles.suggestionSub} numberOfLines={1}>
                              {[item.cityName, item.country].filter(Boolean).join(', ')}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
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
              There are no available flights matching {originIata || 'Origin'} → {destinationIata || 'Destination'} on {departureDate}.
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
                      <Text style={styles.airportCode}>{originIata || 'Origin'}</Text>
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
                      <Text style={styles.airportCode}>{destinationIata || 'Destination'}</Text>
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
    backgroundColor: '#000000',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#000000',
  },
  searchCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: 'rgba(247, 243, 234, 0.6)',
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
  inputGroup: {
    marginBottom: 10,
    zIndex: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.7)',
  },
  iataBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  iataBadgeText: {
    color: '#E8A33D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hintRequired: {
    color: '#E8A33D',
    fontSize: 11,
    fontStyle: 'italic',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
  },
  inputBoxFocused: {
    borderColor: '#E8A33D',
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  autocompleteInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F7F3EA',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },
  dropdownContainer: {
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E33',
    marginTop: 6,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  dropdownLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  dropdownLoadingText: {
    color: '#8E8E93',
    fontSize: 13,
  },
  dropdownEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  dropdownEmptyText: {
    color: '#8E8E93',
    fontSize: 13,
    flex: 1,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  suggestionItemSelected: {
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
  },
  suggestionIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  suggestionName: {
    color: '#F7F3EA',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  suggestionCodeBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  suggestionCodeText: {
    color: '#E8A33D',
    fontSize: 11,
    fontWeight: '800',
  },
  suggestionSub: {
    color: '#8E8E93',
    fontSize: 12,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginBottom: 10,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#2E2E33',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  dateInput: {
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F7F3EA',
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
    color: 'rgba(247, 243, 234, 0.6)',
  },
  presetBadge: {
    backgroundColor: '#27272A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  presetBadgeText: {
    fontSize: 12,
    color: '#F7F3EA',
    fontWeight: '500',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 18,
  },
  stepperSubtext: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.6)',
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
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F7F3EA',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
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
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
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
    color: '#F7F3EA',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsContainer: {
    gap: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.6)',
    marginBottom: 4,
  },
  flightCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  airlineBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  airlineName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#60a5fa',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7F3EA',
  },
  priceSubtext: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.6)',
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
    color: '#F7F3EA',
  },
  airportCode: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.6)',
    marginTop: 2,
  },
  dateSnippet: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.45)',
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
    borderTopColor: 'rgba(247, 243, 234, 0.1)',
  },
  selectOfferText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
});

