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
import { API_BASE_URL } from '../config/api';
import apiClient from '../config/apiClient';

const TITLES = [
  { id: 'mr', label: 'Mr' },
  { id: 'ms', label: 'Ms' },
  { id: 'mrs', label: 'Mrs' },
  { id: 'miss', label: 'Miss' },
  { id: 'dr', label: 'Dr' },
];

const GENDERS = [
  { id: 'm', label: 'Male' },
  { id: 'f', label: 'Female' },
];

export default function PassengerFormScreen({ route, navigation }) {
  const { offerId, passengerCount = 1, offer } = route.params || {};

  const count = Math.max(1, parseInt(passengerCount, 10) || 1);

  // Initialize array of passenger details
  const [passengers, setPassengers] = useState(() => {
    return Array.from({ length: count }, (_, index) => ({
      givenName: '',
      familyName: '',
      dateOfBirth: '1995-06-15',
      gender: 'm',
      title: 'mr',
    }));
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // 'checking' | 'booking'
  const [errorMessage, setErrorMessage] = useState('');
  const [offerExpired, setOfferExpired] = useState(false);

  const updatePassenger = (index, field, value) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (!offerId) {
      setErrorMessage('Missing flight offer ID. Please return to flight search.');
      return;
    }

    // 1. Validate passenger fields client-side
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const pNum = i + 1;

      if (!p.givenName.trim()) {
        setErrorMessage(`Passenger ${pNum}: Please enter given name (first name).`);
        return;
      }
      if (!p.familyName.trim()) {
        setErrorMessage(`Passenger ${pNum}: Please enter family name (last name).`);
        return;
      }
      if (!p.dateOfBirth.trim() || !dateRegex.test(p.dateOfBirth.trim())) {
        setErrorMessage(`Passenger ${pNum}: Date of birth must be in YYYY-MM-DD format.`);
        return;
      }

      const birthDate = new Date(p.dateOfBirth.trim());
      if (isNaN(birthDate.getTime()) || birthDate >= new Date()) {
        setErrorMessage(`Passenger ${pNum}: Date of birth must be a valid date in the past.`);
        return;
      }
    }

    setErrorMessage('');
    setOfferExpired(false);
    setLoading(true);

    try {
      // Step 1: Re-check offer freshness before booking
      setLoadingStep('Verifying flight availability & price freshness…');
      const freshnessResponse = await fetch(`${API_BASE_URL}/flights/offers/${encodeURIComponent(offerId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const freshnessData = await freshnessResponse.json().catch(() => null);

      if (!freshnessResponse.ok || !freshnessData?.isValid) {
        setLoading(false);
        setOfferExpired(true);
        setErrorMessage('This offer has expired, please search again.');
        return;
      }

      // Step 2: Fresh offer confirmed! Proceed with booking order creation
      setLoadingStep('Issuing tickets & confirming booking with Duffel…');
      const formattedPassengers = passengers.map((p) => ({
        givenName: p.givenName.trim(),
        familyName: p.familyName.trim(),
        dateOfBirth: p.dateOfBirth.trim(),
        gender: p.gender,
        title: p.title,
      }));

      const bookResponse = await apiClient('/flights/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          offerId,
          passengers: formattedPassengers,
        }),
      });

      const bookData = await bookResponse.json().catch(() => null);

      if (!bookResponse.ok) {
        setLoading(false);
        if (bookResponse.status === 409 || bookData?.reSearchRequired) {
          setOfferExpired(true);
          setErrorMessage('This offer has expired, please search again.');
        } else {
          setErrorMessage(
            bookData?.error || 'Failed to complete flight booking. Please try again.'
          );
        }
        return;
      }

      setLoading(false);

      // Step 3: Navigate to confirmation screen
      navigation.navigate('BookingConfirmation', {
        bookingReference: bookData.bookingReference,
        orderId: bookData.orderId,
        totalAmount: bookData.totalAmount,
        currency: bookData.currency,
        passengerNames: bookData.passengerNames,
        status: bookData.status,
        offer,
      });
    } catch (error) {
      console.error('Booking submission error:', error);
      setLoading(false);
      setErrorMessage(
        'Unable to connect to flight booking service. Please check your connection.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Selected Flight Summary Card */}
        {offer ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryAirline}>{offer.airline || offer.airlineName || 'Selected Flight'}</Text>
              <Text style={styles.summaryPrice}>
                {offer.price?.currency === 'USD' ? '$' : `${offer.price?.currency} `}
                {Number(offer.price?.amount || 0).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.summaryOfferId}>Offer ID: {offerId}</Text>
          </View>
        ) : null}

        {/* Expired Offer Banner */}
        {offerExpired ? (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredTitle}>⚠️ Offer No Longer Available</Text>
            <Text style={styles.expiredText}>
              This offer has expired, please search again. Airline fares and seat holds are time-sensitive.
            </Text>
            <TouchableOpacity
              style={[styles.reSearchButton, loading && styles.reSearchButtonDisabled]}
              onPress={() => navigation.navigate('FlightSearch')}
              disabled={loading}
            >
              <Text style={styles.reSearchButtonText}>Back to Flight Search 🛫</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Inline Error Banner */}
        {errorMessage && !offerExpired ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage('')} disabled={loading}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Passenger Forms */}
        <Text style={styles.sectionHeading}>
          Passenger Information ({passengers.length} {passengers.length === 1 ? 'Traveler' : 'Travelers'})
        </Text>

        {passengers.map((passenger, index) => {
          const travelerNum = index + 1;
          return (
            <View key={index} style={styles.passengerCard}>
              <View style={styles.cardBadgeRow}>
                <View style={styles.travelerBadge}>
                  <Text style={styles.travelerBadgeText}>Passenger {travelerNum}</Text>
                </View>
                <Text style={styles.adultLabel}>Adult (12+)</Text>
              </View>

              {/* Title Selector */}
              <Text style={styles.fieldLabel}>Title</Text>
              <View style={styles.chipRow}>
                {TITLES.map((t) => {
                  const isSelected = passenger.title === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => updatePassenger(index, 'title', t.id)}
                      disabled={loading || offerExpired}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Names */}
              <View style={styles.nameRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>Given Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Jane"
                    placeholderTextColor="rgba(247, 243, 234, 0.4)"
                    value={passenger.givenName}
                    onChangeText={(val) => updatePassenger(index, 'givenName', val)}
                    autoCapitalize="words"
                    editable={!loading && !offerExpired}
                  />
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>Family Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Doe"
                    placeholderTextColor="rgba(247, 243, 234, 0.4)"
                    value={passenger.familyName}
                    onChangeText={(val) => updatePassenger(index, 'familyName', val)}
                    autoCapitalize="words"
                    editable={!loading && !offerExpired}
                  />
                </View>
              </View>

              {/* Date of Birth & Gender */}
              <View style={styles.nameRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(247, 243, 234, 0.4)"
                    value={passenger.dateOfBirth}
                    onChangeText={(val) => updatePassenger(index, 'dateOfBirth', val)}
                    editable={!loading && !offerExpired}
                  />
                </View>

                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={styles.genderRow}>
                    {GENDERS.map((g) => {
                      const isSelected = passenger.gender === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[styles.genderChip, isSelected && styles.chipActive]}
                          onPress={() => updatePassenger(index, 'gender', g.id)}
                          disabled={loading || offerExpired}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {g.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {/* Submit or Loading */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingTitle}>Processing Flight Booking…</Text>
            <Text style={styles.loadingSubtitle}>{loadingStep}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, offerExpired && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={offerExpired}
          >
            <Text style={styles.submitButtonText}>Confirm & Book Flight ✈️</Text>
          </TouchableOpacity>
        )}
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
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryAirline: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
  },
  summaryPrice: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#60a5fa',
  },
  summaryOfferId: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.5)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 12,
    marginTop: 4,
  },
  expiredBanner: {
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    borderColor: 'rgba(225, 29, 72, 0.4)',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  expiredTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fb7185',
    marginBottom: 6,
  },
  expiredText: {
    fontSize: 13,
    color: '#fda4af',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  reSearchButton: {
    backgroundColor: '#be123c',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  reSearchButtonDisabled: {
    opacity: 0.6,
  },
  reSearchButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
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
  passengerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247, 243, 234, 0.1)',
  },
  travelerBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  travelerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
  },
  adultLabel: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.6)',
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.7)',
    marginBottom: 6,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#121212',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#121212',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.6)',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  nameCol: {
    flex: 1,
  },
  textInput: {
    backgroundColor: '#121212',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F7F3EA',
  },
  loadingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginTop: 12,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.6)',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

