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
import { API_BASE_URL } from '../config/api';

const MODES = [
  { id: 'train', label: 'Trains 🚆', icon: '🚆' },
  { id: 'bus', label: 'Buses 🚌', icon: '🚌' },
];

export default function TrainsAndBusesScreen() {
  const [mode, setMode] = useState('train');
  const [origin, setOrigin] = useState('Bengaluru');
  const [destination, setDestination] = useState('Goa');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = initial, [] = empty, array = routes
  const [bookingUrl, setBookingUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchedPair, setSearchedPair] = useState({ origin: '', destination: '', mode: 'train' });

  const handleSearch = async () => {
    const cleanOrigin = origin.trim();
    const cleanDest = destination.trim();

    if (!cleanOrigin) {
      setErrorMessage('Please enter an origin city.');
      return;
    }
    if (!cleanDest) {
      setErrorMessage('Please enter a destination city.');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');
    setLoading(true);
    setResults(null);
    setBookingUrl('');
    setSearchedPair({ origin: cleanOrigin, destination: cleanDest, mode });

    try {
      const url = `${API_BASE_URL}/routes/search?mode=${encodeURIComponent(
        mode
      )}&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(cleanDest)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(data?.error || 'Failed to search routes. Please try again.');
        setResults([]);
        return;
      }

      const routesList = data?.curatedRoutes || data?.routes || [];
      setResults(Array.isArray(routesList) ? routesList : []);
      setBookingUrl(
        data?.bookingLinkUrl ||
          (mode === 'train'
            ? 'https://www.irctc.co.in/nget/train-search'
            : 'https://www.redbus.in/')
      );
    } catch (error) {
      console.error('Route search error:', error);
      setErrorMessage(
        'Unable to connect to route search service. Please check your network connection.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBookingLink = async () => {
    const targetUrl =
      bookingUrl ||
      (mode === 'train'
        ? 'https://www.irctc.co.in/nget/train-search'
        : 'https://www.redbus.in/');

    try {
      await Linking.openURL(targetUrl);
    } catch (err) {
      console.error('Error opening external booking link:', err);
    }
  };

  const isTrain = mode === 'train';
  const partnerLabel = isTrain ? 'IRCTC' : 'RedBus';

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Search Header Card */}
        <View style={styles.searchCard}>
          <Text style={styles.heading}>Trains & Buses 🚆🚌</Text>
          <Text style={styles.subheading}>
            Discover curated intercity ground routes across India, with direct handoff to official booking portals.
          </Text>

          {/* Mode Segmented Selector */}
          <Text style={styles.inputLabel}>Mode of Travel</Text>
          <View style={styles.modeRow}>
            {MODES.map((m) => {
              const isSelected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => {
                    setMode(m.id);
                    if (results !== null) setResults(null);
                  }}
                  disabled={loading}
                >
                  <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage('')}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Origin & Destination Inputs */}
          <View style={styles.inputRow}>
            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>Origin City</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Bengaluru, Mumbai, Delhi"
                placeholderTextColor="#94a3b8"
                value={origin}
                onChangeText={(t) => {
                  setOrigin(t);
                  if (errorMessage) setErrorMessage('');
                }}
                editable={!loading}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.arrowCol}>
              <Text style={styles.arrowIcon}>→</Text>
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>Destination City</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Goa, Pune, Jaipur"
                placeholderTextColor="#94a3b8"
                value={destination}
                onChangeText={(t) => {
                  setDestination(t);
                  if (errorMessage) setErrorMessage('');
                }}
                editable={!loading}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Popular Route Presets */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick pairs:</Text>
            {[
              { o: 'Bengaluru', d: 'Goa' },
              { o: 'Mumbai', d: 'Pune' },
              { o: 'Delhi', d: 'Jaipur' },
            ].map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetBadge}
                onPress={() => {
                  setOrigin(p.o);
                  setDestination(p.d);
                }}
                disabled={loading}
              >
                <Text style={styles.presetBadgeText}>
                  {p.o}–{p.d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Explicit Search Button */}
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.searchButtonText}>Searching Routes...</Text>
              </View>
            ) : (
              <Text style={styles.searchButtonText}>Search {isTrain ? 'Trains' : 'Buses'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.stateTitle}>Searching curated {mode} routes…</Text>
            <Text style={styles.stateSubtitle}>
              Checking route options between {searchedPair.origin} and {searchedPair.destination}
            </Text>
          </View>
        ) : null}

        {/* Results Section */}
        {!loading && results !== null ? (
          <View style={styles.resultsWrapper}>
            {results.length > 0 ? (
              <View style={styles.curatedList}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Curated {isTrain ? 'Train' : 'Bus'} Routes ({results.length})
                  </Text>
                  <Text style={styles.approxBadge}>Approximate Estimates</Text>
                </View>

                {results.map((route, idx) => (
                  <View key={route._id || idx} style={styles.routeCard}>
                    <View style={styles.routeHeader}>
                      <View style={styles.routeModeTag}>
                        <Text style={styles.routeModeTagText}>
                          {route.mode?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.routeFrequency}>
                        📅 {route.frequency || 'Scheduled'}
                      </Text>
                    </View>

                    <Text style={styles.routePair}>
                      {route.origin} → {route.destination}
                    </Text>

                    <View style={styles.routeMetaRow}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>APPROX. DURATION</Text>
                        <Text style={styles.metaValue}>
                          ~{route.approxDurationHours} hours
                        </Text>
                      </View>
                      <View style={styles.metaItemRight}>
                        <Text style={styles.metaLabel}>RELIABILITY</Text>
                        <Text style={styles.verifiedTag}>Needs Operator Verification</Text>
                      </View>
                    </View>

                    {route.note ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteText}>ℹ️ {route.note}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              /* No curated match */
              <View style={styles.noRouteCard}>
                <Text style={styles.noRouteIcon}>🗺️</Text>
                <Text style={styles.noRouteTitle}>
                  No curated route listed for {searchedPair.origin} → {searchedPair.destination} ({searchedPair.mode})
                </Text>
                <Text style={styles.noRouteSubtitle}>
                  We don't have an editorial schedule for this exact pair yet, but live booking is available on {partnerLabel}.
                </Text>
              </View>
            )}

            {/* Honest Portal Booking Button */}
            <View style={styles.portalCard}>
              <View style={styles.portalHeaderRow}>
                <Text style={styles.portalBrand}>
                  {isTrain ? 'IRCTC NextGen' : 'RedBus India'}
                </Text>
                <View style={styles.officialBadge}>
                  <Text style={styles.officialBadgeText}>OFFICIAL PORTAL</Text>
                </View>
              </View>

              <Text style={styles.portalDescription}>
                {isTrain
                  ? 'IRCTC does not support prefilled deep links. Tap below to launch IRCTC Train Search directly to check live PNR, Tatkal, seat availability, and book tickets.'
                  : 'RedBus does not support prefilled external search links. Tap below to open RedBus to view all private and state bus operators, pick boarding points, and book seats.'}
              </Text>

              <TouchableOpacity
                style={[styles.portalButton, isTrain ? styles.irctcBtn : styles.redbusBtn]}
                onPress={handleOpenBookingLink}
                activeOpacity={0.85}
              >
                <Text style={styles.portalButtonText}>
                  {isTrain ? 'Search on IRCTC ↗' : 'Search on RedBus ↗'}
                </Text>
              </TouchableOpacity>
            </View>
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
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  modeBtnTextActive: {
    color: '#2563eb',
    fontWeight: '700',
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inputCol: {
    flex: 1,
  },
  arrowCol: {
    paddingTop: 18,
  },
  arrowIcon: {
    fontSize: 16,
    color: '#94a3b8',
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
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
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  stateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  resultsWrapper: {
    gap: 16,
  },
  curatedList: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  approxBadge: {
    fontSize: 11,
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontWeight: '700',
  },
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeModeTag: {
    backgroundColor: '#eff6ff',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  routeModeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  routeFrequency: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  routePair: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  routeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  metaItem: {
    flex: 1,
  },
  metaItemRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  verifiedTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
  noteBox: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  noteText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  noRouteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noRouteIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  noRouteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  noRouteSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  portalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
  },
  portalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  portalBrand: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  officialBadge: {
    backgroundColor: '#334155',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  officialBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  portalDescription: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 16,
  },
  portalButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  irctcBtn: {
    backgroundColor: '#ea580c', // IRCTC Orange
  },
  redbusBtn: {
    backgroundColor: '#d84e55', // RedBus Crimson
  },
  portalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

