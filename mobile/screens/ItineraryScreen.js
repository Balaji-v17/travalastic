import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors, fonts, spacing, radii } from '../theme/tokens';

export default function ItineraryScreen({ route, navigation }) {
  const {
    itineraryId,
    itinerary = [],
    destination = '',
    startDate = '',
    endDate = '',
    budgetTier = 'mid',
  } = route.params || {};

  const [currentItinerary, setCurrentItinerary] = useState(itinerary);

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
            return (
              <View key={day.dayNumber} style={styles.dayCard}>
                {/* Header (Expandable Toggle) */}
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day.dayNumber)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>Day {day.dayNumber}</Text>
                  </View>

                  <View style={styles.dayHeaderRight}>
                    {day.estimatedCostINR != null ? (
                      <Text style={styles.dayCostText}>
                        ₹{Number(day.estimatedCostINR).toLocaleString('en-IN')}
                      </Text>
                    ) : null}
                    <Text style={styles.chevronIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Accommodation Suggestion */}
                {day.accommodationSuggestion ? (
                  <View style={styles.stayContainer}>
                    <Text style={styles.stayLabel}>🏨 Stay:</Text>
                    <Text style={styles.stayText}>{day.accommodationSuggestion}</Text>
                  </View>
                ) : null}

                {/* Expandable Activities */}
                {isExpanded && Array.isArray(day.activities) ? (
                  <View style={styles.activitiesContainer}>
                    <Text style={styles.activitiesLabel}>Planned Activities:</Text>
                    {day.activities.map((activity, idx) => (
                      <View key={idx} style={styles.activityItem}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.activityText}>{activity}</Text>
                      </View>
                    ))}
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

      {/* Floating Ask AI Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          navigation.navigate('Chat', {
            itineraryId,
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
            },
          });
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.floatingButtonIcon}>💬</Text>
        <Text style={styles.floatingButtonText}>Ask AI</Text>
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
    paddingBottom: 40,
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
  },
  bulletDot: {
    fontSize: 16,
    color: colors.accentPrimary,
    marginRight: 8,
    lineHeight: 20,
  },
  activityText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textPrimary,
    lineHeight: 20,
    flex: 1,
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
});

