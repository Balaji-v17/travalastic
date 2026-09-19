import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

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
        {/* Trip Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.destinationTitle}>
            {destination ? `Trip to ${destination} 🌴` : 'Your Travel Itinerary 🌴'}
          </Text>
          {startDate && endDate ? (
            <Text style={styles.dateRangeText}>
              📅 {startDate} to {endDate} ({currentItinerary.length} Days)
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
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  destinationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  dateRangeText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  statTier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34d399',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dayBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayCostText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  chevronIcon: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  stayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  stayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  stayText: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  activitiesContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  activitiesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 16,
    color: '#2563eb',
    marginRight: 8,
    lineHeight: 20,
  },
  activityText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  planAnotherButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  planAnotherButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonIcon: {
    fontSize: 18,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

