import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../config/api';

export default function CabBookingScreen() {
  const [pickup, setPickup] = useState(null); // { latitude, longitude, label }
  const [gettingLocation, setGettingLocation] = useState(false);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState(null); // { name, address, latitude, longitude }
  const [searchingDestinations, setSearchingDestinations] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');

  // 1. Get current device location for pickup via expo-location
  const handleUseCurrentLocation = async () => {
    setErrorMessage('');
    setFallbackMessage('');
    setGettingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage(
          'Location permission was denied. Please allow location access in your device settings to use current location.'
        );
        setGettingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      setPickup({
        latitude,
        longitude,
        label: 'Current Device Location',
      });
    } catch (error) {
      console.error('Error fetching location:', error);
      setErrorMessage(
        'Unable to retrieve current location. Please ensure location services / GPS are enabled.'
      );
    } finally {
      setGettingLocation(false);
    }
  };

  // 2. Search destination coordinates via GET /destinations/search
  const handleSearchDestination = async () => {
    const query = destinationQuery.trim();
    if (!query) {
      setErrorMessage('Please enter a destination to search.');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');
    setFallbackMessage('');
    setSearchingDestinations(true);
    setSearchResults(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/search?q=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          data?.error || 'Failed to search destination. Please try again.'
        );
        setSearchResults([]);
        return;
      }

      if (Array.isArray(data)) {
        // Filter destinations that have valid latitude and longitude
        const validPlaces = data.filter(
          (p) => p.latitude != null && p.longitude != null
        );
        setSearchResults(validPlaces);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Destination search error:', error);
      setErrorMessage(
        'Unable to connect to destinations service. Please check your network connection.'
      );
      setSearchResults([]);
    } finally {
      setSearchingDestinations(false);
    }
  };

  const handleSelectDestination = (place) => {
    setSelectedDestination(place);
    setSearchResults(null);
    setDestinationQuery(place.name || '');
    if (errorMessage) setErrorMessage('');
  };

  // 3. Build Uber deep link and open via Linking
  const handleBookWithUber = async () => {
    setErrorMessage('');
    setFallbackMessage('');

    if (!pickup || pickup.latitude == null || pickup.longitude == null) {
      setErrorMessage('Please set your pickup location using "Use current location".');
      return;
    }

    if (
      !selectedDestination ||
      selectedDestination.latitude == null ||
      selectedDestination.longitude == null
    ) {
      setErrorMessage('Please search and select a destination first.');
      return;
    }

    const pickupLat = pickup.latitude;
    const pickupLon = pickup.longitude;
    const dropoffLat = selectedDestination.latitude;
    const dropoffLon = selectedDestination.longitude;
    const destinationName = selectedDestination.name || destinationQuery || 'Destination';

    // Construct pure client-side Uber deep link URL
    const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${encodeURIComponent(
      pickupLat
    )}&pickup[longitude]=${encodeURIComponent(
      pickupLon
    )}&dropoff[latitude]=${encodeURIComponent(
      dropoffLat
    )}&dropoff[longitude]=${encodeURIComponent(
      dropoffLon
    )}&dropoff[nickname]=${encodeURIComponent(destinationName)}`;

    try {
      const canOpen = await Linking.canOpenURL(uberUrl);
      if (!canOpen) {
        setFallbackMessage(
          'Uber could not be launched automatically. Please make sure the Uber app is installed on your device or open https://m.uber.com in your browser.'
        );
        return;
      }

      await Linking.openURL(uberUrl);
    } catch (error) {
      console.error('Error opening Uber deep link:', error);
      setFallbackMessage(
        'Unable to open Uber app. Please verify Uber is installed or visit https://m.uber.com.'
      );
    }
  };

  const isReadyToBook =
    pickup?.latitude != null &&
    pickup?.longitude != null &&
    selectedDestination?.latitude != null &&
    selectedDestination?.longitude != null;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header Banner */}
        <View style={styles.card}>
          <Text style={styles.heading}>Book a Cab 🚗</Text>
          <Text style={styles.subheading}>
            Set your pickup and destination to launch your ride directly in Uber.
          </Text>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage('')}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Fallback Message Banner */}
          {fallbackMessage ? (
            <View style={styles.fallbackBanner}>
              <Text style={styles.fallbackTitle}>📱 Uber App Not Found</Text>
              <Text style={styles.fallbackText}>{fallbackMessage}</Text>
              <TouchableOpacity
                style={styles.webFallbackButton}
                onPress={() => Linking.openURL('https://m.uber.com')}
              >
                <Text style={styles.webFallbackButtonText}>Open Uber in Browser 🌐</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Step 1: Pickup Location */}
          <Text style={styles.sectionLabel}>1. Pickup Location</Text>
          {pickup ? (
            <View style={styles.selectedPickupCard}>
              <View style={styles.pickupHeader}>
                <Text style={styles.pickupIcon}>📍</Text>
                <View style={styles.pickupDetails}>
                  <Text style={styles.pickupTitle}>{pickup.label}</Text>
                  <Text style={styles.pickupCoords}>
                    {Number(pickup.latitude).toFixed(4)}, {Number(pickup.longitude).toFixed(4)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.refreshLocButton}
                onPress={handleUseCurrentLocation}
                disabled={gettingLocation}
              >
                <Text style={styles.refreshLocText}>Update Location</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleUseCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.locationButtonText}>Detecting GPS location…</Text>
                </View>
              ) : (
                <View style={styles.buttonLoadingRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationButtonText}>Use Current Location</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Step 2: Destination */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>2. Destination</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Search destination (e.g. Airport, Hotel, Beach)"
              placeholderTextColor="#94a3b8"
              value={destinationQuery}
              onChangeText={(text) => {
                setDestinationQuery(text);
                if (selectedDestination) setSelectedDestination(null);
                if (errorMessage) setErrorMessage('');
              }}
              onSubmitEditing={handleSearchDestination}
              returnKeyType="search"
              editable={!searchingDestinations}
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                (!destinationQuery.trim() || searchingDestinations) &&
                  styles.searchButtonDisabled,
              ]}
              onPress={handleSearchDestination}
              disabled={!destinationQuery.trim() || searchingDestinations}
            >
              {searchingDestinations ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Selected Destination Badge */}
          {selectedDestination ? (
            <View style={styles.selectedDestCard}>
              <View style={styles.destHeader}>
                <Text style={styles.destCheckIcon}>✓</Text>
                <View style={styles.destDetails}>
                  <Text style={styles.destName}>{selectedDestination.name}</Text>
                  {selectedDestination.address ? (
                    <Text style={styles.destAddress} numberOfLines={2}>
                      {selectedDestination.address}
                    </Text>
                  ) : null}
                  <Text style={styles.destCoords}>
                    Coords: {Number(selectedDestination.latitude).toFixed(4)},{' '}
                    {Number(selectedDestination.longitude).toFixed(4)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Destination Search In-Flight Loading State */}
          {searchingDestinations ? (
            <View style={styles.searchingCard}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.searchingText}>
                Searching dropoff locations matching "{destinationQuery.trim()}"…
              </Text>
            </View>
          ) : null}

          {/* Destination Search Results List */}
          {!searchingDestinations && Array.isArray(searchResults) && searchResults.length > 0 ? (
            <View style={styles.resultsList}>
              <Text style={styles.resultsHeading}>Select destination:</Text>
              {searchResults.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => handleSelectDestination(item)}
                >
                  <Text style={styles.resultPin}>📍</Text>
                  <View style={styles.resultTextCol}>
                    <Text style={styles.resultItemName}>{item.name}</Text>
                    {item.address ? (
                      <Text style={styles.resultItemAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {!searchingDestinations &&
          Array.isArray(searchResults) &&
          searchResults.length === 0 ? (
            <View style={styles.emptyResultsBox}>
              <Text style={styles.emptyResultsText}>
                No locations found matching "{destinationQuery}". Try another search term.
              </Text>
            </View>
          ) : null}

          {/* Step 3: Book with Uber Button */}
          <View style={styles.bookingSection}>
            <TouchableOpacity
              style={[
                styles.uberButton,
                (!isReadyToBook || gettingLocation || searchingDestinations) &&
                  styles.uberButtonDisabled,
              ]}
              onPress={handleBookWithUber}
              disabled={!isReadyToBook || gettingLocation || searchingDestinations}
            >
              <Text style={styles.uberButtonText}>Book with Uber</Text>
            </TouchableOpacity>
            {!isReadyToBook ? (
              <Text style={styles.readyPrompt}>
                {!pickup
                  ? '• Set your pickup location above to continue'
                  : '• Select a destination above to continue'}
              </Text>
            ) : (
              <Text style={styles.handoffNote}>
                Rider pickup and destination will be pre-filled directly in the Uber app.
              </Text>
            )}
          </View>
        </View>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
  fallbackBanner: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c2410c',
    marginBottom: 4,
  },
  fallbackText: {
    fontSize: 13,
    color: '#9a3412',
    lineHeight: 18,
    marginBottom: 10,
  },
  webFallbackButton: {
    backgroundColor: '#c2410c',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  webFallbackButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  locationButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  selectedPickupCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pickupIcon: {
    fontSize: 20,
  },
  pickupDetails: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickupCoords: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  refreshLocButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  refreshLocText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0f172a',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedDestCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  destHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  destCheckIcon: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: 'bold',
    marginTop: 2,
  },
  destDetails: {
    flex: 1,
  },
  destName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14532d',
  },
  destAddress: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  destCoords: {
    fontSize: 11,
    color: '#4ade80',
    marginTop: 4,
  },
  resultsList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  resultPin: {
    fontSize: 14,
    marginRight: 8,
  },
  resultTextCol: {
    flex: 1,
  },
  resultItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  resultItemAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  emptyResultsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  searchingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  searchingText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },
  bookingSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  uberButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberButtonDisabled: {
    opacity: 0.4,
  },
  uberButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  readyPrompt: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  handoffNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
});

