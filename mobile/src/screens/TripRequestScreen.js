import React, { useState } from 'react';
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
} from 'react-native';
import apiClient from '../config/apiClient';

const INTERESTS_LIST = [
  'beach',
  'heritage',
  'adventure',
  'nightlife',
  'wildlife',
  'hill stations',
  'spiritual',
  'food',
];

const BUDGET_TIERS = [
  { id: 'budget', label: 'Budget', icon: '🪙' },
  { id: 'mid', label: 'Mid-range', icon: '✨' },
  { id: 'luxury', label: 'Luxury', icon: '💎' },
];

const formatDate = (date) => date.toISOString().slice(0, 10);

const getInitialDates = () => {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  return {
    startStr: formatDate(start),
    endStr: formatDate(end),
  };
};

export default function TripRequestScreen({ navigation }) {
  const initialDates = getInitialDates();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(initialDates.startStr);
  const [endDate, setEndDate] = useState(initialDates.endStr);
  const [budgetTier, setBudgetTier] = useState('mid');
  const [selectedInterests, setSelectedInterests] = useState(['beach', 'nightlife']);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        if (prev.length === 1) return prev; // Keep at least one interest
        return prev.filter((item) => item !== interest);
      } else {
        return [...prev, interest];
      }
    });
  };

  const applyDurationPreset = (days) => {
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return;
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      setEndDate(formatDate(end));
    } catch {
      // ignore
    }
  };

  const calculateDays = () => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const handleSubmit = async () => {
    const trimmedDest = destination.trim();
    if (!trimmedDest) {
      setErrorMessage('Please enter a destination.');
      return;
    }

    if (!startDate.trim() || !endDate.trim()) {
      setErrorMessage('Please provide both start and end dates (YYYY-MM-DD).');
      return;
    }

    const nDays = calculateDays();
    const interestsJoined = selectedInterests.join(', ');
    const sentence = `${nDays} days in ${trimmedDest} from ${startDate.trim()} to ${endDate.trim()}, ${budgetTier} budget, interested in ${interestsJoined}`;

    setErrorMessage('');
    setLoading(true);

    try {
      const response = await apiClient('/itinerary/generate', {
        method: 'POST',
        body: JSON.stringify({ rawRequest: sentence }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.error?.message || data?.error || 'Failed to generate itinerary. Please try again.';
        setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
        setLoading(false);
        return;
      }

      setLoading(false);

      const itineraryData = Array.isArray(data) ? data : data?.itinerary || data?.days || [];

      // Navigate to ItineraryScreen with generated itinerary, itineraryId, and context
      navigation.navigate('Itinerary', {
        itineraryId: data?.itineraryId,
        itinerary: itineraryData,
        destination: trimmedDest,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        budgetTier,
        interests: selectedInterests,
        rawRequest: sentence,
      });
    } catch (error) {
      console.error('Itinerary generation error:', error);
      setLoading(false);
      setErrorMessage(
        'Unable to connect to travel planner service. Please check your connection and try again.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.heading}>Plan Your Adventure 🗺️</Text>
          <Text style={styles.subheading}>
            Tell us where and how you want to travel, and our AI agents will build your custom itinerary.
          </Text>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              <TouchableOpacity onPress={() => setErrorMessage('')}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Destination */}
          <Text style={styles.label}>Destination</Text>
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
          />

          {/* Dates */}
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={startDate}
                onChangeText={setStartDate}
                editable={!loading}
              />
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                value={endDate}
                onChangeText={setEndDate}
                editable={!loading}
              />
            </View>
          </View>

          {/* Duration Presets */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick duration:</Text>
            {[3, 5, 7].map((days) => (
              <TouchableOpacity
                key={days}
                style={styles.presetBadge}
                onPress={() => applyDurationPreset(days)}
                disabled={loading}
              >
                <Text style={styles.presetBadgeText}>{days} Days</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget Tier */}
          <Text style={styles.label}>Budget Tier</Text>
          <View style={styles.budgetRow}>
            {BUDGET_TIERS.map((tier) => {
              const isSelected = budgetTier === tier.id;
              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[styles.budgetButton, isSelected && styles.budgetButtonActive]}
                  onPress={() => setBudgetTier(tier.id)}
                  disabled={loading}
                >
                  <Text style={styles.budgetIcon}>{tier.icon}</Text>
                  <Text
                    style={[
                      styles.budgetButtonText,
                      isSelected && styles.budgetButtonTextActive,
                    ]}
                  >
                    {tier.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interests */}
          <Text style={styles.label}>Interests & Experiences (Select multiple)</Text>
          <View style={styles.chipsContainer}>
            {INTERESTS_LIST.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleInterest(interest)}
                  disabled={loading}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {interest.charAt(0).toUpperCase() + interest.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Loading state or Submit button */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingTitle}>Building your itinerary…</Text>
              <Text style={styles.loadingSubtitle}>
                Synthesizing weather forecasts, local attractions, hotel options, and personalized content.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!destination.trim() || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!destination.trim() || loading}
            >
              <Text style={styles.submitButtonText}>Generate Itinerary ✨</Text>
            </TouchableOpacity>
          )}
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
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
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
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorContainer: {
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
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
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  budgetButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  budgetIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  budgetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  budgetButtonTextActive: {
    color: '#2563eb',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

