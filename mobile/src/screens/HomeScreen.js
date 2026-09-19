import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { apiClient } from '../config/apiClient';
import ScreenHeader from '../components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Extract email from stored JWT token in SecureStore without external libraries.
 */
function extractEmailFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded);
    return parsed.email || null;
  } catch {
    return null;
  }
}

/**
 * Format route / date text for the ticket stub.
 */
function formatDates(startDate, endDate) {
  if (!startDate && !endDate) return 'Dates to be announced';
  if (startDate && !endDate) return `From ${startDate}`;
  if (!startDate && endDate) return `Until ${endDate}`;
  return `${startDate} — ${endDate}`;
}

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('Traveler');
  const [loading, setLoading] = useState(true);
  const [itinerary, setItinerary] = useState(null);
  const [trendingDestinations, setTrendingDestinations] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Read token & derive user's capitalized email prefix
      const token =
        (await SecureStore.getItemAsync('travalastic_token')) ||
        (await SecureStore.getItemAsync('userToken')) ||
        (await SecureStore.getItemAsync('token'));

      if (token) {
        const email = extractEmailFromToken(token);
        if (email) {
          const prefix = email.split('@')[0];
          const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          setUserName(capitalized);
        }
      }

      // 2. Fetch user's itineraries from GET /itinerary/mine
      const res = await apiClient('/itinerary/mine');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.itineraries || [];
        setItinerary(list.length > 0 ? list[0] : null);
      } else {
        setItinerary(null);
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
      setItinerary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    try {
      const res = await apiClient('/destinations/trending');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTrendingDestinations(data);
        }
      }
    } catch (err) {
      console.error('Failed to load trending destinations:', err);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadTrending();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData, loadTrending]);

  return (
    <View style={styles.safeArea}>
      {/* Universal ScreenHeader with safe area inset and single-line truncated greeting */}
      <ScreenHeader
        title={`Hello, ${userName} 👋`}
        subtitle="Where are you traveling next?"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card Styled as a Ticket Stub */}
        <View style={styles.ticketStub}>
          {loading ? (
            /* Skeleton Placeholder while loading */
            <View style={styles.skeletonWrapper}>
              <View style={styles.ticketContent}>
                <View style={styles.skeletonTag} />
                <View style={styles.skeletonHeading} />
                <View style={styles.skeletonSubheading} />
              </View>
              <View style={styles.ticketDivider}>
                <View style={styles.notchLeft} />
                <View style={styles.dashedLine} />
                <View style={styles.notchRight} />
              </View>
              <View style={styles.ticketAction}>
                <View style={styles.skeletonBtn} />
              </View>
            </View>
          ) : itinerary ? (
            /* Existing Itinerary Ticket */
            <>
              <View style={styles.ticketContent}>
                <View style={styles.badgeRow}>
                  <Text style={styles.badgeText}>UPCOMING TRIP</Text>
                </View>
                <Text style={styles.destinationName} numberOfLines={2}>
                  {itinerary.destination || 'Your Journey'}
                </Text>
                <Text style={styles.routeDateText}>
                  {formatDates(itinerary.startDate, itinerary.endDate)}
                </Text>
              </View>

              {/* Dashed divider line using radii.ticketNotch */}
              <View style={styles.ticketDivider}>
                <View style={styles.notchLeft} />
                <View style={styles.dashedLine} />
                <View style={styles.notchRight} />
              </View>

              <View style={styles.ticketAction}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('Itinerary', {
                      itineraryId: itinerary._id,
                      itinerary: itinerary.days,
                      destination: itinerary.destination,
                      startDate: itinerary.startDate,
                      endDate: itinerary.endDate,
                    })
                  }
                >
                  <Text style={styles.continueBtnText}>Continue planning</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* No Itinerary State */
            <>
              <View style={styles.ticketContent}>
                <View style={styles.badgeRow}>
                  <Text style={styles.badgeText}>NEW JOURNEY</Text>
                </View>
                <Text style={styles.emptyTitle}>Plan your next trip</Text>
                <Text style={styles.emptySubtitle}>
                  Design a personalized day-by-day travel plan powered by AI agents.
                </Text>
              </View>

              {/* Dashed divider line using radii.ticketNotch */}
              <View style={styles.ticketDivider}>
                <View style={styles.notchLeft} />
                <View style={styles.dashedLine} />
                <View style={styles.notchRight} />
              </View>

              <View style={styles.ticketAction}>
                <TouchableOpacity
                  style={styles.startBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('TripRequest')}
                >
                  <Text style={styles.startBtnText}>Start planning</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Trending Destinations Section */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeaderRow}>
            <Text style={styles.trendingHeading}>Trending destinations</Text>
          </View>

          {trendingLoading ? (
            /* Skeleton Loading Rail */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingRail}
            >
              {[1, 2, 3, 4].map((id) => (
                <View key={id} style={styles.trendingSkeletonCard} />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingRail}
            >
              {trendingDestinations.map((dest) => (
                <TouchableOpacity
                  key={dest.name}
                  style={styles.trendingCard}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('Explore', { destination: dest.name })}
                >
                  <ImageBackground
                    source={{ uri: dest.photoUrl }}
                    style={styles.trendingImageBg}
                    imageStyle={styles.trendingImage}
                  >
                    {/* Bottom-anchored dark gradient overlay */}
                    <LinearGradient
                      colors={['transparent', 'rgba(19, 27, 46, 0.95)']}
                      style={styles.gradientOverlay}
                    >
                      <Text
                        style={styles.destinationName}
                        numberOfLines={2}
                      >
                        {dest.name}
                      </Text>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Section credit link */}
          <TouchableOpacity
            style={styles.attributionContainer}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://www.pexels.com')}
          >
            <Text style={styles.attributionText}>Photos via Pexels</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions 2-Column Grid */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsHeading}>Quick actions</Text>
          <View style={styles.quickActionsGrid}>
            {/* Search Destinations -> Explore tab */}
            <TouchableOpacity
              style={styles.actionTile}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Explore')}
            >
              <View style={styles.tileIconContainer}>
                <Ionicons name="compass-outline" size={24} color={colors.accentPrimary} />
              </View>
              <Text style={styles.tileLabel}>Search destinations</Text>
            </TouchableOpacity>

            {/* Book a flight -> FlightSearch */}
            <TouchableOpacity
              style={styles.actionTile}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FlightSearch')}
            >
              <View style={styles.tileIconContainer}>
                <Ionicons name="airplane-outline" size={24} color={colors.accentPrimary} />
              </View>
              <Text style={styles.tileLabel}>Book a flight</Text>
            </TouchableOpacity>

            {/* Book a cab -> CabBooking */}
            <TouchableOpacity
              style={styles.actionTile}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CabBooking')}
            >
              <View style={styles.tileIconContainer}>
                <Ionicons name="car-outline" size={24} color={colors.accentPrimary} />
              </View>
              <Text style={styles.tileLabel}>Book a cab</Text>
            </TouchableOpacity>

            {/* Hotels -> Hotels */}
            <TouchableOpacity
              style={styles.actionTile}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Hotels')}
            >
              <View style={styles.tileIconContainer}>
                <Ionicons name="bed-outline" size={24} color={colors.accentPrimary} />
              </View>
              <Text style={styles.tileLabel}>Hotels</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const NOTCH_RADIUS = radii.ticketNotch; // 12

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
    paddingBottom: spacing[32] || 32,
    backgroundColor: colors.background,
  },

  /* Ticket Stub Hero Card */
  ticketStub: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radii.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: spacing[32] || 32,
  },
  ticketContent: {
    padding: spacing[24] || 24,
    paddingBottom: spacing[16] || 16,
  },
  badgeRow: {
    marginBottom: spacing[8] || 8,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.inkNavyMuted,
    letterSpacing: 1.2,
  },
  destinationName: {
    fontSize: 24,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.textOnSurface,
    marginBottom: spacing[8] || 8,
    lineHeight: 30,
  },
  routeDateText: {
    fontSize: 14,
    fontFamily: fonts.mono,
    color: colors.textOnSurface,
    letterSpacing: 0.5,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: fonts.display,
    color: colors.textOnSurface,
    marginBottom: spacing[8] || 8,
    lineHeight: 30,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkNavyMuted,
    lineHeight: 20,
  },

  /* Dashed Divider with Notches */
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    height: NOTCH_RADIUS * 2,
    marginHorizontal: -2,
  },
  notchLeft: {
    width: NOTCH_RADIUS,
    height: NOTCH_RADIUS * 2,
    borderTopRightRadius: NOTCH_RADIUS,
    borderBottomRightRadius: NOTCH_RADIUS,
    backgroundColor: colors.background, // blends seamlessly into the dark background
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.border,
  },
  notchRight: {
    width: NOTCH_RADIUS,
    height: NOTCH_RADIUS * 2,
    borderTopLeftRadius: NOTCH_RADIUS,
    borderBottomLeftRadius: NOTCH_RADIUS,
    backgroundColor: colors.background, // blends seamlessly into the dark background
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.border,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(19, 27, 46, 0.25)',
    marginHorizontal: spacing[8] || 8,
  },

  /* Ticket Action Section */
  ticketAction: {
    padding: spacing[24] || 24,
    paddingTop: spacing[16] || 16,
  },
  continueBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  continueBtnText: {
    color: colors.textOnSurface,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
  },
  startBtn: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
  },

  /* Skeleton Loading State */
  skeletonWrapper: {
    width: '100%',
  },
  skeletonTag: {
    width: 100,
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(19, 27, 46, 0.08)',
    marginBottom: 12,
  },
  skeletonHeading: {
    width: '70%',
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(19, 27, 46, 0.08)',
    marginBottom: 10,
  },
  skeletonSubheading: {
    width: '45%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(19, 27, 46, 0.08)',
  },
  skeletonBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(19, 27, 46, 0.08)',
  },

  /* Quick Actions 2-Column Grid */
  quickActionsSection: {
    marginTop: spacing[16] || 16,
  },
  quickActionsHeading: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing[12] || 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  actionTile: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tileLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },

  /* Trending Destinations Section */
  trendingSection: {
    marginTop: spacing[24] || 24,
    marginBottom: spacing[8] || 8,
  },
  trendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12] || 12,
  },
  trendingHeading: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trendingRail: {
    gap: 12,
    paddingRight: 16,
  },
  trendingCard: {
    width: 140,
    height: 180,
    borderRadius: radii.card || 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trendingImageBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendingImage: {
    borderRadius: (radii.card || 16) - 1,
  },
  gradientOverlay: {
    width: '100%',
    height: '55%',
    justifyContent: 'flex-end',
    padding: 10,
  },
  destinationName: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trendingSkeletonCard: {
    width: 140,
    height: 180,
    borderRadius: radii.card || 16,
    backgroundColor: 'rgba(28, 39, 64, 0.6)',
  },
  attributionContainer: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  attributionText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
