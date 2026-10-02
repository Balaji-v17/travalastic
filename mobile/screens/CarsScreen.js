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
import { colors, fonts, spacing, radii } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';
import { API_BASE_URL } from '../config/api';

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialDates = () => {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 7);
  const dropoff = new Date(pickup);
  dropoff.setDate(dropoff.getDate() + 3);
  return {
    pickupStr: formatDate(pickup),
    dropoffStr: formatDate(dropoff),
  };
};

export default function CarsScreen() {
  const initialDates = getInitialDates();
  const [destination, setDestination] = useState('');
  const [pickupDate, setPickupDate] = useState(initialDates.pickupStr);
  const [dropoffDate, setDropoffDate] = useState(initialDates.dropoffStr);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const applyDaysRental = (days) => {
    try {
      const p = new Date(pickupDate);
      if (isNaN(p.getTime())) return;
      const d = new Date(p);
      d.setDate(d.getDate() + days);
      setDropoffDate(formatDate(d));
    } catch {
      // ignore date parse errors
    }
  };

  const handleCompareRentals = async () => {
    const cleanDest = destination.trim();
    if (!cleanDest) {
      setErrorMessage('Please enter a pickup destination or city.');
      return;
    }

    Keyboard.dismiss();
    setErrorMessage('');
    setLoading(true);

    try {
      const url = `${API_BASE_URL}/cars/search?destination=${encodeURIComponent(
        cleanDest
      )}&pickupDate=${encodeURIComponent(pickupDate.trim())}&dropoffDate=${encodeURIComponent(
        dropoffDate.trim()
      )}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.carsSearchUrl) {
        await Linking.openURL(data.carsSearchUrl);
      } else {
        // Fallback directly to Rentalcars search URL if backend returns non-200
        const fallbackUrl = `https://www.rentalcars.com/search-results?locationName=${encodeURIComponent(
          cleanDest
        )}&pickupDate=${encodeURIComponent(pickupDate.trim())}&dropoffDate=${encodeURIComponent(
          dropoffDate.trim()
        )}`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error('Car rental redirect error:', error);
      // Fallback directly on network failure
      const fallbackUrl = `https://www.rentalcars.com/search-results?locationName=${encodeURIComponent(
        cleanDest
      )}&pickupDate=${encodeURIComponent(pickupDate.trim())}&dropoffDate=${encodeURIComponent(
        dropoffDate.trim()
      )}`;
      try {
        await Linking.openURL(fallbackUrl);
      } catch (linkError) {
        setErrorMessage('Unable to open browser. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Rental Cars 🚙"
        subtitle="Self-drive rentals & compare deals on Rentalcars.com"
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search & Configuration Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Self-Drive Car Hire</Text>
          <Text style={styles.cardSubheading}>
            Search top rental brands with live comparison, instant confirmation, and flexible cancellation.
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

          {/* Destination / City Input */}
          <Text style={styles.inputLabel}>Pickup Location / City</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Goa, Bengaluru, Mumbai, Delhi, London"
            placeholderTextColor={colors.textMuted}
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              if (errorMessage) setErrorMessage('');
            }}
            editable={!loading}
            autoCapitalize="words"
          />

          {/* Dates Row */}
          <View style={styles.datesRow}>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Pickup Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={pickupDate}
                onChangeText={setPickupDate}
                editable={!loading}
              />
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>Drop-off Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={dropoffDate}
                onChangeText={setDropoffDate}
                editable={!loading}
              />
            </View>
          </View>

          {/* Quick Rental Presets */}
          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick duration:</Text>
            {[
              { label: '3 Days', days: 3 },
              { label: '5 Days', days: 5 },
              { label: '7 Days', days: 7 },
              { label: '14 Days', days: 14 },
            ].map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={styles.presetChip}
                onPress={() => applyDaysRental(preset.days)}
                disabled={loading}
              >
                <Text style={styles.presetText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Compare rentals on Rentalcars.com Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleCompareRentals}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.inkNavy} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Compare rentals on Rentalcars.com ↗
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Feature Highlights Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Why book self-drive with Travalastic?</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔑</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoItemTitle}>True Self-Drive Freedom</Text>
              <Text style={styles.infoItemDesc}>
                Take the wheel yourself on scenic road trips. (For chauffeur-driven rides, use the Cabs tab instead).
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🤝</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoItemTitle}>Booking.com & Rentalcars.com Network</Text>
              <Text style={styles.infoItemDesc}>
                Compare hundreds of international and local fleets in one click with verified affiliate rates.
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🛡️</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoItemTitle}>No Hidden Fees</Text>
              <Text style={styles.infoItemDesc}>
                Clear fuel policies, optional insurance packages, and free cancellation on most rentals.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing[16] || 16,
    paddingTop: spacing[8] || 8,
    paddingBottom: spacing[48] || 48,
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.card || 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  cardHeading: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardSubheading: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: colors.accentUrgent || '#D65A4A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  dismissText: {
    color: colors.accentUrgent || '#D65A4A',
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 2,
  },
  presetChip: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.chip || 100,
  },
  presetText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: colors.accentPrimary, // Marigold
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkNavy,
    fontSize: 15,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.card || 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  infoCardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoItemTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  infoItemDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

