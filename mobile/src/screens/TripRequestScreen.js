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
            placeholderTextColor="rgba(247, 243, 234, 0.4)"
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
                placeholderTextColor="rgba(247, 243, 234, 0.4)"
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
                placeholderTextColor="rgba(247, 243, 234, 0.4)"
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
    backgroundColor: '#000000',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: 'rgba(247, 243, 234, 0.65)',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  dismissText: {
    color: '#fca5a5',
    fontWeight: '600',
    fontSize: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.7)',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F7F3EA',
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
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F7F3EA',
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
    color: 'rgba(247, 243, 234, 0.6)',
  },
  presetBadge: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  presetBadgeText: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.8)',
    fontWeight: '500',
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetButton: {
    flex: 1,
    backgroundColor: '#121212',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  budgetButtonActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#3b82f6',
  },
  budgetIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  budgetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.6)',
  },
  budgetButtonTextActive: {
    color: '#60a5fa',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#121212',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.7)',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.65)',
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
    backgroundColor: '#334155',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

