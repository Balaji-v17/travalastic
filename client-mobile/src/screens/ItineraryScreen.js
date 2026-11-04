import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../config/apiClient';
import { colors, fonts, spacing, radii } from '../theme/tokens';

const calculateDistanceKm = (loc1, loc2) => {
  if (!loc1 || !loc2) return null;
  const lat1 = Number(loc1.lat != null ? loc1.lat : loc1.latitude);
  const lon1 = Number(loc1.lon != null ? loc1.lon : loc1.longitude);
  const lat2 = Number(loc2.lat != null ? loc2.lat : loc2.latitude);
  const lon2 = Number(loc2.lon != null ? loc2.lon : loc2.longitude);

  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  if (isNaN(d) || d < 0) return null;
  return d;
};

const calculateTotalDayDistanceKm = (activities) => {
  if (!Array.isArray(activities) || activities.length < 2) return null;
  let totalKm = 0;
  let pairCount = 0;

  for (let i = 0; i < activities.length - 1; i++) {
    const act1 = activities[i];
    const act2 = activities[i + 1];

    const loc1 = typeof act1 === 'object' ? act1?.location : null;
    const loc2 = typeof act2 === 'object' ? act2?.location : null;

    const hasLoc1 = !!(
      loc1 &&
      (loc1.lat != null || loc1.latitude != null) &&
      (loc1.lon != null || loc1.longitude != null)
    );
    const hasLoc2 = !!(
      loc2 &&
      (loc2.lat != null || loc2.latitude != null) &&
      (loc2.lon != null || loc2.longitude != null)
    );

    if (hasLoc1 && hasLoc2) {
      const dist = calculateDistanceKm(loc1, loc2);
      if (dist != null) {
        totalKm += dist;
        pairCount++;
      }
    }
  }

  if (pairCount === 0) return null;
  return totalKm;
};

const openDirections = (location) => {
  if (!location) return;
  const lat = location.lat != null ? location.lat : location.latitude;
  const lon = location.lon != null ? location.lon : location.longitude;
  if (lat == null || lon == null) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
  Linking.openURL(url).catch((err) => console.warn('Could not open map URL:', err));
};

export default function ItineraryScreen({ route, navigation }) {
  const {
    itineraryId,
    itinerary = [],
    destination = '',
    startDate = '',
    endDate = '',
    budgetTier = 'mid',
    undo: initialUndo = null,
  } = route.params || {};

  const [currentItinerary, setCurrentItinerary] = useState(itinerary);
  const [undoState, setUndoState] = useState(
    initialUndo || route.params?.itinerary?.undo || null
  );
  const [undoLoading, setUndoLoading] = useState(false);

  const fetchItineraryDetails = useCallback(async () => {
    if (!itineraryId) return;
    try {
      const res = await apiClient(`/itinerary/${itineraryId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.days || data?.itinerary) {
          setCurrentItinerary(data.days || data.itinerary);
        }
        if (data?.undo) {
          setUndoState(data.undo);
        }
      }
    } catch (err) {
      console.warn('Could not fetch itinerary details:', err);
    }
  }, [itineraryId]);

  useEffect(() => {
    fetchItineraryDetails();
  }, [fetchItineraryDetails]);

  // Initially expand all days so the user immediately sees the rich details
  const [expandedDays, setExpandedDays] = useState(() => {
    const initial = {};
    if (Array.isArray(itinerary)) {
      itinerary.forEach((day) => {
        initial[day.dayNumber] = true;
      });
    }
    return initial;
  });

  const toggleDay = (dayNumber) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNumber]: !prev[dayNumber],
    }));
  };

  const handleOpenReorder = (day) => {
    navigation.navigate('ReorderDay', {
      itineraryId,
      day,
      onOrderUpdated: (updatedDay) => {
        if (!updatedDay) return;
        setCurrentItinerary((prevItin) => {
          const days = Array.isArray(prevItin) ? prevItin : [];
          return days.map((d) =>
            d.dayNumber === updatedDay.dayNumber ? updatedDay : d
          );
        });
      },
      onRefresh: fetchItineraryDetails,
    });
  };

  const formatUndoDaysLabel = (days) => {
    if (Array.isArray(days) && days.length === 1) {
      return `Undo last change (Day ${days[0]})`;
    }
    if (Array.isArray(days) && days.length > 1) {
      return `Undo last change (Days ${days.join(', ')})`;
    }
    return 'Undo last change';
  };

  const confirmUndo = () => {
    const daysLabel =
      Array.isArray(undoState?.lastEditDays) && undoState.lastEditDays.length > 0
        ? undoState.lastEditDays.length === 1
          ? `Day ${undoState.lastEditDays[0]}`
          : `Days ${undoState.lastEditDays.join(', ')}`
        : 'your itinerary';

    Alert.alert(
      'Undo Last Change',
      `Are you sure you want to revert the last changes made to ${daysLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: handleUndoItinerary,
        },
      ]
    );
  };

  const handleUndoItinerary = async () => {
    if (!itineraryId || !undoState?.lastEditId || undoLoading) return;

    setUndoLoading(true);
    try {
      const res = await apiClient(`/itinerary/${itineraryId}/undo`, {
        method: 'POST',
        body: JSON.stringify({ expectedEditId: undoState.lastEditId }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        const newDays = Array.isArray(data)
          ? data
          : data?.days || data?.itinerary || [];
        if (newDays.length > 0) {
          setCurrentItinerary(newDays);
        }
        if (data?.undo) {
          setUndoState(data.undo);
        } else {
          fetchItineraryDetails();
        }
      } else {
        const errorMsg =
          data?.error || 'Could not revert changes. Itinerary may have changed.';
        Alert.alert('Undo Failed', errorMsg);
        fetchItineraryDetails();
      }
    } catch (err) {
      console.error('Error undoing itinerary change:', err);
      Alert.alert('Network Error', 'Unable to undo change. Please check your connection.');
    } finally {
      setUndoLoading(false);
    }
  };

  const totalCost = Array.isArray(currentItinerary)
    ? currentItinerary.reduce((sum, day) => sum + (Number(day.estimatedCostINR) || 0), 0)
    : 0;

  return (
    <SafeAreaView style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Trip Summary Card (Ticket-paper treatment) */}
        <View style={styles.summaryCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>TRIP SUMMARY</Text>
          </View>
          <Text style={styles.destinationTitle}>
            {destination ? `Trip to ${destination} 🌴` : 'Your Travel Itinerary 🌴'}
          </Text>
          {startDate && endDate ? (
            <Text style={styles.dateRangeText}>
              📅 {startDate} — {endDate} ({currentItinerary.length} Days)
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Estimated Cost</Text>
              <Text style={styles.statValue}>₹{totalCost.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Budget Tier</Text>
              <Text style={styles.statTier}>
                {budgetTier.charAt(0).toUpperCase() + budgetTier.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Undo Last Change Button (Below Summary Card) */}
        {undoState && typeof undoState.count === 'number' && undoState.count > 0 ? (
          <View style={styles.undoBarContainer}>
            <TouchableOpacity
              style={styles.undoHeaderButton}
              onPress={confirmUndo}
              disabled={undoLoading}
              activeOpacity={0.7}
            >
              {undoLoading ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <Text style={styles.undoHeaderButtonText}>
                  ↩ {formatUndoDaysLabel(undoState.lastEditDays)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Days List */}
        <Text style={styles.sectionHeading}>Daily Itinerary</Text>

        {!Array.isArray(currentItinerary) || currentItinerary.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No itinerary days available.</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Return to Planner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          currentItinerary.map((day) => {
            const isExpanded = !!expandedDays[day.dayNumber];
            const notDoneCount = (day.activities || []).filter(
              (a) => typeof a === 'string' || a?.done !== true
            ).length;
            const canReorder = notDoneCount >= 2;

            const totalKm = calculateTotalDayDistanceKm(day.activities);
            const totalDistanceText =
              totalKm != null
                ? `About ${totalKm < 0.1 ? '< 0.1' : totalKm.toFixed(1)} km in total (straight-line, where locations are known)`
                : null;

            return (
              <View key={day.dayNumber} style={styles.dayCard}>
                {/* Header (Expandable Toggle & Reorder Button) */}
                <View style={styles.dayHeader}>
                  <TouchableOpacity
                    style={styles.dayHeaderLeft}
                    onPress={() => toggleDay(day.dayNumber)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>Day {day.dayNumber}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.dayHeaderRight}>
                    {canReorder ? (
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        onPress={() => handleOpenReorder(day)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Reorder activities for Day ${day.dayNumber}`}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="swap-vertical"
                          size={13}
                          color={colors.accentPrimary || '#E07A5F'}
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.reorderBtnText}>Reorder</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.dayHeaderToggle}
                      onPress={() => toggleDay(day.dayNumber)}
                      activeOpacity={0.7}
                    >
                      {day.estimatedCostINR != null ? (
                        <Text style={styles.dayCostText}>
                          ₹{Number(day.estimatedCostINR).toLocaleString('en-IN')}
                        </Text>
                      ) : null}
                      <Text style={styles.chevronIcon}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Accommodation Suggestion */}
                {day.accommodationSuggestion ? (
                  <View style={styles.stayContainer}>
                    <Text style={styles.stayLabel}>🏨 Stay:</Text>
                    <Text style={styles.stayText}>{day.accommodationSuggestion}</Text>
                  </View>
                ) : null}

                {/* Total Day Straight-Line Distance Banner */}
                {totalDistanceText ? (
                  <View style={styles.dayDistanceBanner}>
                    <Ionicons
                      name="navigate-outline"
                      size={13}
                      color={colors.textSecondary || '#a3a3a3'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.dayDistanceBannerText}>{totalDistanceText}</Text>
                  </View>
                ) : null}

                {/* Expandable Activities */}
                {isExpanded && Array.isArray(day.activities) ? (
                  <View style={styles.activitiesContainer}>
                    <Text style={styles.activitiesLabel}>Planned Activities:</Text>
                    {day.activities.map((activity, idx) => {
                      const isString = typeof activity === 'string';
                      const name = isString ? activity : (activity?.name || activity?.title || '');
                      const description = isString ? '' : (activity?.description || '');
                      const suggestedTime = isString ? null : activity?.suggestedTime;
                      const location = isString ? null : activity?.location;
                      const isDone = !isString && activity?.done === true;
                      const hasLocation = !!(
                        location &&
                        (location.lat != null || location.latitude != null) &&
                        (location.lon != null || location.longitude != null)
                      );

                      // Check next activity for consecutive distance
                      const nextActivity =
                        idx < day.activities.length - 1 ? day.activities[idx + 1] : null;
                      const nextLocation =
                        nextActivity && typeof nextActivity !== 'string'
                          ? nextActivity.location
                          : null;
                      const nextHasLocation = !!(
                        nextLocation &&
                        (nextLocation.lat != null || nextLocation.latitude != null) &&
                        (nextLocation.lon != null || nextLocation.longitude != null)
                      );

                      const distanceKm =
                        hasLocation && nextHasLocation
                          ? calculateDistanceKm(location, nextLocation)
                          : null;
                      const distanceLabel =
                        distanceKm != null
                          ? `~${distanceKm < 0.1 ? '< 0.1' : distanceKm.toFixed(1)} km (straight-line)`
                          : null;

                      return (
                        <React.Fragment key={idx}>
                          <View style={[styles.activityItem, isDone && styles.activityItemDone]}>
                            {isDone ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={colors.accentSecondary || '#2F6E68'}
                                style={styles.activityDoneIcon}
                                accessibilityLabel="Done"
                              />
                            ) : (
                              <Text style={styles.bulletDot}>•</Text>
                            )}
                            <View style={{ flex: 1 }}>
                              <View style={styles.activityTitleRow}>
                                {suggestedTime ? (
                                  <View style={[styles.timeBadge, isDone && styles.timeBadgeDone]}>
                                    <Text
                                      style={[
                                        styles.timeBadgeText,
                                        isDone && styles.timeBadgeTextDone,
                                      ]}
                                    >
                                      {suggestedTime}
                                    </Text>
                                  </View>
                                ) : null}
                                <Text
                                  style={[
                                    styles.activityNameText,
                                    isDone && styles.activityNameTextDone,
                                  ]}
                                >
                                  {name}
                                </Text>
                              </View>
                              {description && description !== name ? (
                                <Text
                                  style={[
                                    styles.activityDescriptionText,
                                    isDone && styles.activityDescriptionTextDone,
                                  ]}
                                >
                                  {description}
                                </Text>
                              ) : null}
                              {hasLocation ? (
                                <TouchableOpacity
                                  style={styles.directionsBtn}
                                  onPress={() => openDirections(location)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.directionsIcon}>📍</Text>
                                  <Text style={styles.directionsBtnText}>Get directions</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>

                          {distanceLabel ? (
                            <View style={styles.distanceConnectorRow}>
                              <View style={styles.distanceLine} />
                              <View style={styles.distanceBadge}>
                                <Text style={styles.distanceBadgeText}>{distanceLabel}</Text>
                              </View>
                              <View style={styles.distanceLine} />
                            </View>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.planAnotherButton}
          onPress={() => navigation.navigate('TripRequest')}
        >
          <Text style={styles.planAnotherButtonText}>Plan Another Trip</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Ask about your trip Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          navigation.navigate('Chat', {
            itineraryId,
            startDate: itineraryData?.startDate,
            endDate: itineraryData?.endDate,
            days: currentItinerary,
            onItineraryUpdated: (updatedItin) => {
              const newDays = Array.isArray(updatedItin)
                ? updatedItin
                : updatedItin?.days || updatedItin?.itinerary || [];
              if (newDays.length > 0) {
                setCurrentItinerary(newDays);
                setExpandedDays((prev) => {
                  const updated = { ...prev };
                  newDays.forEach((d) => {
                    updated[d.dayNumber] = true;
                  });
                  return updated;
                });
              }
              if (updatedItin?.undo) {
                setUndoState(updatedItin.undo);
              } else {
                fetchItineraryDetails();
              }
            },
          });
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.floatingButtonIcon}>💬</Text>
        <Text style={styles.floatingButtonText}>Ask about your trip</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 100,
    backgroundColor: colors.background,
  },
  // Trip Summary Card: ticket-paper treatment matching Home's hero card (colors.surface #F7F3EA)
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card || 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(19, 27, 46, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  badgeRow: {
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.mono || 'monospace',
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  destinationTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 30,
  },
  dateRangeText: {
    fontSize: 14,
    fontFamily: fonts.body,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.body,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 19,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: '#0F172A',
  },
  statTier: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.accentSecondary || '#2F6E68',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.display,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  // Daily itinerary day-cards: colors.surfaceAlt background, colors.textPrimary text
  dayCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderColor: 'rgba(232, 163, 61, 0.3)',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dayBadgeText: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224, 122, 95, 0.12)',
    borderColor: 'rgba(224, 122, 95, 0.3)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  reorderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentPrimary || '#E07A5F',
    fontFamily: fonts.body || 'System',
  },
  dayDistanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  dayDistanceBannerText: {
    fontSize: 12,
    color: colors.textSecondary || '#a3a3a3',
    fontFamily: fonts.body || 'System',
    flex: 1,
  },
  dayCostText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
  },
  chevronIcon: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  stayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground || '#121212',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stayLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  stayText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    flex: 1,
  },
  activitiesContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activitiesLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(247, 243, 234, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.06)',
  },
  activityItemDone: {
    opacity: 0.65,
    backgroundColor: 'rgba(247, 243, 234, 0.015)',
  },
  bulletDot: {
    fontSize: 16,
    color: colors.accentPrimary,
    marginRight: 8,
    lineHeight: 20,
  },
  activityDoneIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
  },
  timeBadgeDone: {
    opacity: 0.6,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.mono || 'monospace',
    color: colors.accentPrimary,
  },
  timeBadgeTextDone: {
    color: colors.textMuted || '#94A3B8',
  },
  activityNameText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
    lineHeight: 20,
  },
  activityNameTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted || '#94A3B8',
  },
  activityDescriptionText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted || '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  activityDescriptionTextDone: {
    color: colors.textMuted || '#94A3B8',
    opacity: 0.8,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(232, 163, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.2)',
    gap: 4,
  },
  directionsIcon: {
    fontSize: 11,
  },
  directionsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.bodyBold,
    color: colors.accentPrimary,
  },
  distanceConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginLeft: 16,
    marginRight: 10,
    gap: 8,
  },
  distanceLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.12)',
  },
  distanceBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  distanceBadgeText: {
    fontSize: 11,
    fontFamily: fonts.mono || 'monospace',
    color: colors.textMuted || '#94A3B8',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#000000',
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  planAnotherButton: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  planAnotherButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '600',
  },
  // "Ask AI" floating button: colors.accentPrimary
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonIcon: {
    fontSize: 18,
  },
  floatingButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  undoBarContainer: {
    marginTop: 10,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  undoHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(224, 122, 95, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224, 122, 95, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoHeaderButtonText: {
    color: colors.accentPrimary || '#E07A5F',
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
  },
});

