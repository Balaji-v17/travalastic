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

const BUDGET_TIERS = [
  { id: 'budget', label: 'Budget', icon: '🪙' },
  { id: 'mid', label: 'Mid-range', icon: '✨' },
  { id: 'luxury', label: 'Luxury', icon: '💎' },
];

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialDates = () => {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 7);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 4);
  return {
    checkinStr: formatDate(checkin),
    checkoutStr: formatDate(checkout),
  };
};

export default function HotelsScreen() {
  const initialDates = getInitialDates();
  const [destination, setDestination] = useState('');
  const [budgetTier, setBudgetTier] = useState('mid');
  const [checkinDate, setCheckinDate] = useState(initialDates.checkinStr);
  const [checkoutDate, setCheckoutDate] = useState(initialDates.checkoutStr);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // null = initial, [] = empty, array = hotels
  const [bookingUrl, setBookingUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchedDest, setSearchedDest] = useState('');

  const applyStayNights = (nights) => {
    try {
      const cin = new Date(checkinDate);
      if (isNaN(cin.getTime())) return;
      const cout = new Date(cin);
      cout.setDate(cout.getDate() + nights);
      setCheckoutDate(formatDate(cout));
    } catch {
      // ignore
    }
  };

  const handleSearch = async () => {
    const cleanDest = destination.trim();
    if (!cleanDest) {
      setErrorMessage('Please enter a destination to search hotels.');
      return;
    }

    if (!checkinDate.trim() || !checkoutDate.trim()) {
      setErrorMessage('Please provide both check-in and check-out dates.');
      return;
    }

    const cin = new Date(checkinDate.trim());
    const cout = new Date(checkoutDate.trim());

    if (isNaN(cin.getTime()) || isNaN(cout.getTime())) {
      setErrorMessage('Check-in and check-out dates must be valid (YYYY-MM-DD).');
      return;
    }

    if (cout <= cin) {
      setErrorMessage('Check-out date must be after check-in date.');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');
    setLoading(true);
    setResults(null);
    setBookingUrl('');
    setSearchedDest(cleanDest);

    try {
      const url = `${API_BASE_URL}/hotels/search?destination=${encodeURIComponent(
        cleanDest
      )}&budgetTier=${encodeURIComponent(budgetTier)}&checkinDate=${encodeURIComponent(
        checkinDate.trim()
      )}&checkoutDate=${encodeURIComponent(checkoutDate.trim())}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(
          data?.error || 'Failed to search hotels. Please try again.'
        );
        setResults([]);
        return;
      }

      const hotelsList = data?.curatedHotels || data?.hotels || [];
      setResults(Array.isArray(hotelsList) ? hotelsList : []);
      setBookingUrl(data?.bookingComSearchUrl || '');
    } catch (error) {
      console.error('Hotels search error:', error);
      setErrorMessage(
        'Unable to connect to hotels service. Please check your network connection.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBookingCom = async () => {
    if (!bookingUrl) return;
    try {
      const supported = await Linking.canOpenURL(bookingUrl);
      if (supported) {
        await Linking.openURL(bookingUrl);
      } else {
        await Linking.openURL(bookingUrl);
      }
    } catch (err) {
      console.error('Error opening Booking.com URL:', err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Search Header Card */}
        <View style={styles.searchCard}>
          <Text style={styles.heading}>Find Accommodations 🏨</Text>
          <Text style={styles.subheading}>
            Browse our hand-picked curated stays or check real-time availability on Booking.com.
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

          {/* Destination Input */}
          <Text style={styles.inputLabel}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Goa, Jaipur, Manali, Paris"
            placeholderTextColor="#94a3b8"
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              if (errorMessage) setErrorMessage('');
            }}
            editable={!loading}
            autoCapitalize="words"
          />

          {/* Budget Tier Selector */}
          <Text style={styles.inputLabel}>Budget Tier</Text>
          <View style={styles.budgetRow}>
            {BUDGET_TIERS.map((tier) => {
              const isSelected = budgetTier === tier.id;
              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[styles.budgetBtn, isSelected && styles.budgetBtnActive]}
                  onPress={() => setBudgetTier(tier.id)}
                  disabled={loading}
                >
                  <Text style={styles.budgetIcon}>{tier.icon}</Text>
                  <Text style={[styles.budgetText, isSelected && styles.budgetTextActive]}>
                    {tier.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dates */}
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Check-in Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={checkinDate}
                onChangeText={setCheckinDate}
                editable={!loading}
              />
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Check-out Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={checkoutDate}
                onChangeText={setCheckoutDate}
                editable={!loading}
              />
            </View>
          </View>

          {/* Quick Stay Presets */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick duration:</Text>
            {[2, 3, 5, 7].map((nights) => (
              <TouchableOpacity
                key={nights}
                style={styles.presetBadge}
                onPress={() => applyStayNights(nights)}
                disabled={loading}
              >
                <Text style={styles.presetBadgeText}>{nights} Nights</Text>
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
                <Text style={styles.searchButtonText}>Searching Stays...</Text>
              </View>
            ) : (
              <Text style={styles.searchButtonText}>Search Hotels</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.stateTitle}>Searching hotels in {searchedDest}…</Text>
            <Text style={styles.stateSubtitle}>
              Matching curated recommendations and generating real-time inventory link.
            </Text>
          </View>
        ) : null}

        {/* Results Section */}
        {!loading && results !== null ? (
          <View style={styles.resultsWrapper}>
            {/* Curated Results Section */}
            {results.length > 0 ? (
              <View style={styles.curatedSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Curated Hotel Picks</Text>
                  <Text style={styles.editorialBadge}>Editorial Guide</Text>
                </View>
                <Text style={styles.curatedDisclaimer}>
                  📌 Informational recommendations vetted by our travel editors. See real-time rates on Booking.com below.
                </Text>

                {results.map((hotel, index) => (
                  /* Informational-only card: intentionally not tappable into a booking flow */
                  <View key={hotel._id || index} style={styles.curatedCard}>
                    <View style={styles.curatedCardTop}>
                      <View style={styles.curatedPickBadge}>
                        <Text style={styles.curatedPickText}>Curated Pick</Text>
                      </View>
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingStar}>★</Text>
                        <Text style={styles.ratingText}>{hotel.rating || '4.5'}</Text>
                      </View>
                    </View>

                    <Text style={styles.hotelName}>{hotel.name}</Text>

                    <View style={styles.hotelMetaRow}>
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>EST. PRICE</Text>
                        <Text style={styles.priceRange}>{hotel.priceRangeINR || '₹3,500 - ₹5,500'}</Text>
                      </View>
                      <View style={styles.tierContainer}>
                        <Text style={styles.tierLabel}>TIER</Text>
                        <Text style={styles.tierValue}>
                          {(hotel.budgetTier || budgetTier).toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoFooter}>
                      <Text style={styles.infoNote}>ℹ️ Editorial pick • Bookable via Booking.com</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              /* No curated matches state */
              <View style={styles.noCuratedCard}>
                <Text style={styles.noCuratedIcon}>🏨</Text>
                <Text style={styles.noCuratedTitle}>
                  No curated picks yet for {searchedDest} ({budgetTier})
                </Text>
                <Text style={styles.noCuratedSubtitle}>
                  Our travel editors haven't added custom picks for this specific tier yet, but live rooms and instant bookings are ready below.
                </Text>
              </View>
            )}

            {/* Prominent Booking.com Live Availability Button */}
            {bookingUrl ? (
              <View style={styles.bookingComContainer}>
                <View style={styles.bookingComCard}>
                  <View style={styles.bookingComLogoRow}>
                    <Text style={styles.bookingComBrand}>Booking.com</Text>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE INVENTORY</Text>
                    </View>
                  </View>

                  <Text style={styles.bookingComHeading}>
                    Real-Time Rooms & Instant Rates
                  </Text>
                  <Text style={styles.bookingComDescription}>
                    Check live availability, compare verified guest reviews, and book directly on Booking.com for {searchedDest} ({checkinDate} to {checkoutDate}).
                  </Text>

                  <TouchableOpacity
                    style={styles.bookingComButton}
                    onPress={handleOpenBookingCom}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.bookingComButtonText}>
                      See live availability on Booking.com ↗
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 14,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  budgetBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  budgetBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  budgetIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  budgetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  budgetTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dateCol: {
    flex: 1,
  },
  dateInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  stateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  resultsWrapper: {
    gap: 16,
  },
  curatedSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  editorialBadge: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  curatedDisclaimer: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 4,
  },
  curatedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  curatedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  curatedPickBadge: {
    backgroundColor: '#fef3c7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  curatedPickText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  ratingStar: {
    color: '#16a34a',
    fontSize: 12,
    marginRight: 4,
  },
  ratingText: {
    color: '#15803d',
    fontWeight: 'bold',
    fontSize: 12,
  },
  hotelName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  hotelMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceRange: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tierContainer: {
    alignItems: 'flex-end',
  },
  tierLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tierValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  infoFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  infoNote: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  noCuratedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noCuratedIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  noCuratedTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  noCuratedSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  bookingComContainer: {
    marginTop: 6,
  },
  bookingComCard: {
    backgroundColor: '#003580', // Booking.com brand navy
    borderRadius: 16,
    padding: 22,
    shadowColor: '#003580',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bookingComLogoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingComBrand: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: '#00ba00',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bookingComHeading: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  bookingComDescription: {
    fontSize: 13,
    color: '#e0e7ff',
    lineHeight: 19,
    marginBottom: 18,
  },
  bookingComButton: {
    backgroundColor: '#006ce4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  bookingComButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

