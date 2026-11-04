import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import apiClient from '../config/apiClient';

export default function TripHubScreen({ route, navigation }) {
  const { itineraryId } = route.params || {};

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchTrip = useCallback(
    async (isRefresh = false) => {
      if (!itineraryId) {
        setErrorMessage('No itinerary ID was provided.');
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage('');

      try {
        const res = await apiClient(`/itinerary/${itineraryId}`);
        if (!res.ok) {
          throw new Error(`Failed to load trip (status ${res.status})`);
        }
        const data = await res.json();
        setTrip(data);
      } catch (err) {
        console.error('Failed to load trip details in TripHub:', err);
        setErrorMessage('Could not load trip details. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [itineraryId]
  );

  useEffect(() => {
    fetchTrip();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTrip(true);
    });
    return unsubscribe;
  }, [navigation, fetchTrip]);

  const formatDates = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Flexible Dates';
    if (startDate && !endDate) return startDate;
    if (!startDate && endDate) return `Until ${endDate}`;

    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return `${startDate} — ${endDate}`;
      }
      const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eStr = e.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${sStr} — ${eStr}`;
    } catch {
      return `${startDate} — ${endDate}`;
    }
  };

  const daysCount = Array.isArray(trip?.days)
    ? trip.days.length
    : Array.isArray(trip?.itinerary)
    ? trip.itinerary.length
    : 0;

  const bookingsCount = typeof trip?.bookingsCount === 'number' ? trip.bookingsCount : 0;
  const bookingLabel =
    bookingsCount === 1 ? '1 flight booked' : `${bookingsCount} flights booked`;

  const deriveEndDate = (startStr, count) => {
    if (!startStr) return '';
    try {
      const match = String(startStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
        d.setDate(d.getDate() + (count || 1));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      const d = new Date(startStr);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + (count || 1));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return '';
    }
  };

  const effectiveEndDate =
    trip?.endDate ||
    (trip?.startDate && daysCount > 0 ? deriveEndDate(trip.startDate, daysCount) : '');

  // Handlers for section cards
  const handleOpenItinerary = () => {
    if (!trip) return;
    navigation.navigate('TripItineraryView', {
      itineraryId: trip._id || itineraryId,
      itinerary: trip.days || trip.itinerary || [],
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: effectiveEndDate,
      budgetTier: trip.budgetTier,
      undo: trip.undo,
    });
  };

  const handleOpenFlights = () => {
    navigation.navigate('TripFlightSearch', {
      destination: trip?.destination || '',
      departureDate: trip?.startDate || '',
      itineraryId: trip?._id || itineraryId,
    });
  };

  const handleOpenHotels = () => {
    const effectiveCheckin = trip?.startDate || '';
    const effectiveCheckout =
      trip?.endDate ||
      (effectiveCheckin && daysCount > 0 ? deriveEndDate(effectiveCheckin, daysCount) : '');
    navigation.navigate('TripHotels', {
      destination: trip?.destination || '',
      checkinDate: effectiveCheckin,
      checkoutDate: effectiveCheckout,
      startDate: effectiveCheckin,
      endDate: effectiveCheckout,
      budgetTier: trip?.budgetTier || 'mid',
    });
  };

  const handleOpenTrainsAndBuses = () => {
    navigation.navigate('TripTrainsAndBuses', {
      destination: trip?.destination || '',
      origin: 'Bengaluru',
    });
  };

  const handleOpenCabs = () => {
    navigation.navigate('TripCabBooking', {
      destination: trip?.destination || '',
    });
  };

  const handleOpenChat = () => {
    if (!trip) return;
    navigation.navigate('TripChat', {
      itineraryId: trip._id || itineraryId,
      onItineraryUpdated: () => {
        fetchTrip(true);
      },
    });
  };

  const handleOpenPackingList = () => {
    navigation.navigate('PackingList', {
      itineraryId: trip?._id || itineraryId,
      destination: trip?.destination || '',
    });
  };

  const handleOpenToday = () => {
    navigation.navigate('Today', {
      itineraryId: trip?._id || itineraryId,
      destination: trip?.destination || '',
      startDate: trip?.startDate || '',
      endDate: effectiveEndDate,
      trip,
    });
  };

  const handleOpenExpenses = () => {
    navigation.navigate('Expenses', {
      itineraryId: trip?._id || itineraryId,
      budgetEstimate: trip?.budgetEstimate,
      destination: trip?.destination || '',
      trip,
    });
  };

  return (
    <View style={styles.wrapper}>
      {/* Universal ScreenHeader matching dark theme */}
      <ScreenHeader
        title="Trip Hub ✈️"
        subtitle={trip?.destination ? `Command center for ${trip.destination}` : 'Your journey central hub'}
        rightElement={
          navigation?.canGoBack() ? (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTrip(true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchTrip()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading trip details…</Text>
          </View>
        ) : trip ? (
          <>
            {/* OVERVIEW SECTION AT TOP */}
            <View style={styles.overviewCard}>
              <View style={styles.overviewTopRow}>
                <View style={styles.overviewBadge}>
                  <Text style={styles.overviewBadgeText}>TRIP OVERVIEW</Text>
                </View>

                {/* bookingsCount pill */}
                <View
                  style={[
                    styles.bookingStatusPill,
                    bookingsCount > 0 ? styles.bookingStatusPillActive : null,
                  ]}
                >
                  <Ionicons
                    name="airplane"
                    size={12}
                    color={bookingsCount > 0 ? '#10b981' : colors.accentPrimary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.bookingStatusText,
                      bookingsCount > 0 ? styles.bookingStatusTextActive : null,
                    ]}
                  >
                    {bookingLabel}
                  </Text>
                </View>
              </View>

              <Text style={styles.destinationTitle} numberOfLines={2}>
                {trip.destination || 'Your Journey'} 🌴
              </Text>

              <Text style={styles.dateRangeText}>
                📅 {formatDates(trip.startDate, effectiveEndDate || trip.endDate)}
                {daysCount > 0 ? ` • ${daysCount} Days` : ''}
              </Text>

              <View style={styles.overviewMetaRow}>
                {trip.budgetTier ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      {trip.budgetTier === 'luxury'
                        ? '💎 Luxury'
                        : trip.budgetTier === 'budget'
                        ? '🪙 Budget'
                        : '✨ Mid-range'}{' '}
                      Tier
                    </Text>
                  </View>
                ) : null}

                {Array.isArray(trip.interests) && trip.interests.length > 0 ? (
                  <View style={styles.interestsRow}>
                    {trip.interests.slice(0, 2).map((interest, idx) => (
                      <View key={idx} style={styles.interestChip}>
                        <Text style={styles.interestChipText}>#{interest}</Text>
                      </View>
                    ))}
                    {trip.interests.length > 2 ? (
                      <Text style={styles.moreInterestsText}>
                        +{trip.interests.length - 2}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {/* SECTION CARDS BELOW */}
            <View style={styles.sectionCardsContainer}>
              {/* SECTION: TODAY'S LIVE PLAN */}
              <TouchableOpacity
                style={styles.sectionCard}
                activeOpacity={0.85}
                onPress={handleOpenToday}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>☀️</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionCardTitle}>Today's Plan</Text>
                      <View style={styles.sectionTag}>
                        <Text style={styles.sectionTagText}>Live View</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCardSubtitle}>
                      Live trip day schedule, weather forecast, and flight status.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
              </TouchableOpacity>

              {/* SECTION 1: ITINERARY */}
              <TouchableOpacity
                style={styles.sectionCard}
                activeOpacity={0.85}
                onPress={handleOpenItinerary}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>🗺️</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionCardTitle}>Itinerary</Text>
                      <View style={styles.sectionTag}>
                        <Text style={styles.sectionTagText}>{daysCount} Days</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCardSubtitle}>
                      View your complete day-by-day sights, activities, and stays.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
              </TouchableOpacity>

              {/* SECTION 2: TRANSPORT & STAY */}
              <View style={styles.transportCard}>
                <View style={styles.transportCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>🎫</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <Text style={styles.sectionCardTitle}>Transport & Stay</Text>
                    <Text style={styles.sectionCardSubtitle}>
                      Pre-filled booking with your trip destination and dates.
                    </Text>
                  </View>
                </View>

                {/* 4 Picker Options */}
                <View style={styles.pickerGrid}>
                  {/* Flights */}
                  <TouchableOpacity
                    style={styles.pickerTile}
                    activeOpacity={0.8}
                    onPress={handleOpenFlights}
                  >
                    <View style={styles.pickerTileTop}>
                      <Text style={styles.pickerIcon}>✈️</Text>
                      <View style={styles.linksToTripBadge}>
                        <Text style={styles.linksToTripText}>Links to Trip</Text>
                      </View>
                    </View>
                    <Text style={styles.pickerTitle}>Flights</Text>
                    <Text style={styles.pickerSubtitle}>Duffel real-time</Text>
                  </TouchableOpacity>

                  {/* Hotels */}
                  <TouchableOpacity
                    style={styles.pickerTile}
                    activeOpacity={0.8}
                    onPress={handleOpenHotels}
                  >
                    <View style={styles.pickerTileTop}>
                      <Text style={styles.pickerIcon}>🏨</Text>
                    </View>
                    <Text style={styles.pickerTitle}>Hotels</Text>
                    <Text style={styles.pickerSubtitle}>Booking.com stays</Text>
                  </TouchableOpacity>

                  {/* Trains & Buses */}
                  <TouchableOpacity
                    style={styles.pickerTile}
                    activeOpacity={0.8}
                    onPress={handleOpenTrainsAndBuses}
                  >
                    <View style={styles.pickerTileTop}>
                      <Text style={styles.pickerIcon}>🚆</Text>
                    </View>
                    <Text style={styles.pickerTitle}>Trains & Buses</Text>
                    <Text style={styles.pickerSubtitle}>Rail & RedBus</Text>
                  </TouchableOpacity>

                  {/* Cabs */}
                  <TouchableOpacity
                    style={styles.pickerTile}
                    activeOpacity={0.8}
                    onPress={handleOpenCabs}
                  >
                    <View style={styles.pickerTileTop}>
                      <Text style={styles.pickerIcon}>🚗</Text>
                    </View>
                    <Text style={styles.pickerTitle}>Cabs</Text>
                    <Text style={styles.pickerSubtitle}>Uber handoff</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 3: ASK AI */}
              <TouchableOpacity
                style={styles.sectionCard}
                activeOpacity={0.85}
                onPress={handleOpenChat}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>💬</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionCardTitle}>Ask AI</Text>
                      <View style={[styles.sectionTag, styles.sectionTagAi]}>
                        <Text style={styles.sectionTagAiText}>Trip AI Assistant</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCardSubtitle}>
                      Chat with AI to adjust daily plans, ask recommendations, or get transit tips.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
              </TouchableOpacity>

              {/* SECTION 4: PACKING LIST */}
              <TouchableOpacity
                style={styles.sectionCard}
                activeOpacity={0.85}
                onPress={handleOpenPackingList}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>🎒</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionCardTitle}>Packing List</Text>
                      <View style={styles.sectionTag}>
                        <Text style={styles.sectionTagText}>AI Checklist</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCardSubtitle}>
                      Smart checklist tailored to your activities & destination.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
              </TouchableOpacity>

              {/* SECTION 5: EXPENSES */}
              <TouchableOpacity
                style={styles.sectionCard}
                activeOpacity={0.85}
                onPress={handleOpenExpenses}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>💰</Text>
                  </View>
                  <View style={styles.sectionCardTextCol}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionCardTitle}>Trip Expenses</Text>
                      <View style={styles.sectionTag}>
                        <Text style={styles.sectionTagText}>Budget Tracker</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCardSubtitle}>
                      Log expenses and track your spending against estimated budget.
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.accentPrimary}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
    paddingBottom: 40,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBanner: {
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderColor: colors.accentUrgent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: colors.accentUrgent,
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(214, 90, 74, 0.25)',
    borderRadius: 6,
  },
  retryText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 12,
    fontFamily: fonts.body,
  },

  // OVERVIEW CARD
  overviewCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  overviewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentPrimary,
    letterSpacing: 0.5,
  },
  bookingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
  },
  bookingStatusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  bookingStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  bookingStatusTextActive: {
    color: '#10b981',
  },
  destinationTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    lineHeight: 32,
  },
  dateRangeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.body,
    marginBottom: 14,
  },
  overviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
    paddingTop: 12,
  },
  metaChip: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  interestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interestChip: {
    backgroundColor: 'rgba(247, 243, 234, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  interestChipText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  moreInterestsText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // SECTION CARDS
  sectionCardsContainer: {
    gap: 14,
  },
  sectionCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(247, 243, 234, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconText: {
    fontSize: 20,
  },
  sectionCardTextCol: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  sectionCardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
  sectionTag: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  sectionTagAi: {
    backgroundColor: 'rgba(47, 110, 104, 0.25)',
  },
  sectionTagAiText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
  },

  // TRANSPORT CARD & PICKER
  transportCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pickerTile: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
  },
  pickerTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pickerIcon: {
    fontSize: 20,
  },
  linksToTripBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  linksToTripText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    marginBottom: 2,
  },
  pickerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
});
