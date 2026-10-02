import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/tokens';
import apiClient from '../config/apiClient';

export default function SavedItinerariesScreen({ navigation }) {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchItineraries = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const response = await apiClient('/itinerary/mine');
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch saved itineraries');
      }

      const list = Array.isArray(data) ? data : data?.itineraries || [];
      setItineraries(list);
    } catch (err) {
      console.error('Fetch itineraries error:', err);
      setErrorMessage(err.message || 'Could not load your saved trips.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  const handleTripPress = (trip) => {
    const days = Array.isArray(trip.days) ? trip.days : [];
    navigation.navigate('Itinerary', {
      itineraryId: trip._id,
      itinerary: days,
      destination: trip.destination || 'Destination',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      budgetTier: trip.budgetTier || 'mid',
    });
  };

  const calculateTotalCost = (days) => {
    if (!Array.isArray(days) || days.length === 0) return null;
    const sum = days.reduce((acc, d) => acc + (Number(d.estimatedCostINR) || 0), 0);
    return sum > 0 ? `₹${sum.toLocaleString('en-IN')}` : null;
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchItineraries(true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Saved Itineraries</Text>
          <Text style={styles.headerSubtitle}>
            Browse all your customized AI travel plans. Tap any trip to view its day-by-day activities or chat with the AI assistant.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchItineraries()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Retrieving your itineraries...</Text>
          </View>
        ) : itineraries.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="map-outline" size={44} color={colors.accentPrimary} />
            </View>
            <Text style={styles.emptyTitle}>No saved itineraries yet. Start exploring!</Text>
            <Text style={styles.emptySubtitle}>
              You haven't generated any trips yet. Generate your first custom AI itinerary with day-by-day sights and stays in seconds.
            </Text>
            <TouchableOpacity
              style={styles.planTripButton}
              onPress={() => navigation.navigate('TripRequest')}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.planTripButtonText}>Plan a Trip with AI</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* List of Itineraries */
          <View style={styles.listContainer}>
            <Text style={styles.listCountText}>
              {itineraries.length} {itineraries.length === 1 ? 'Trip' : 'Trips'} Saved
            </Text>

            {itineraries.map((trip) => {
              const daysCount = Array.isArray(trip.days) ? trip.days.length : 0;
              const totalCost = calculateTotalCost(trip.days);
              const interests = Array.isArray(trip.interests) ? trip.interests : [];

              return (
                <TouchableOpacity
                  key={trip._id}
                  style={styles.tripCard}
                  onPress={() => handleTripPress(trip)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.destinationBox}>
                      <Text style={styles.destinationTitle}>
                        {trip.destination || 'Custom Journey'} 🌴
                      </Text>
                      {trip.startDate && trip.endDate ? (
                        <Text style={styles.datesSubtitle}>
                          📅 {trip.startDate} — {trip.endDate}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.accentPrimary} />
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{daysCount} Days</Text>
                    </View>

                    {trip.budgetTier ? (
                      <View style={[styles.badgePill, styles.badgePillSecondary]}>
                        <Text style={styles.badgePillTextSecondary}>
                          {trip.budgetTier.charAt(0).toUpperCase() + trip.budgetTier.slice(1)} Budget
                        </Text>
                      </View>
                    ) : null}

                    {totalCost ? (
                      <View style={styles.costBadge}>
                        <Text style={styles.costBadgeText}>{totalCost}</Text>
                      </View>
                    ) : null}
                  </View>

                  {interests.length > 0 ? (
                    <View style={styles.tagsRow}>
                      {interests.slice(0, 3).map((tag, idx) => (
                        <View key={idx} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{tag}</Text>
                        </View>
                      ))}
                      {interests.length > 3 ? (
                        <Text style={styles.moreTagsText}>+{interests.length - 3} more</Text>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
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
  },
  headerInfo: {
    marginBottom: 20,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.65)',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  loadingText: {
    color: 'rgba(247, 243, 234, 0.6)',
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: 'rgba(232, 163, 61, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 280,
  },
  planTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  planTripButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
  },
  listCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(247, 243, 234, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tripCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  destinationBox: {
    flex: 1,
    marginRight: 10,
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F7F3EA',
    marginBottom: 4,
  },
  datesSubtitle: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.6)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badgePill: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  badgePillSecondary: {
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  badgePillTextSecondary: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.75)',
  },
  costBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  costBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.08)',
  },
  tagChip: {
    backgroundColor: '#121212',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagChipText: {
    fontSize: 10,
    color: 'rgba(247, 243, 234, 0.55)',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
    color: 'rgba(247, 243, 234, 0.4)',
    fontStyle: 'italic',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
