import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';

export default function BookingConfirmationScreen({ route, navigation }) {
  const {
    bookingReference = 'N/A',
    orderId = '',
    totalAmount = '0.00',
    currency = 'USD',
    passengerNames = [],
    status = 'confirmed',
    offer,
  } = route.params || {};

  const handleDone = () => {
    // Navigate cleanly back to HomeScreen
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Success Header */}
        <View style={styles.header}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.title}>Booking Confirmed! 🎉</Text>
          <Text style={styles.subtitle}>
            Your flight has been ticketed and confirmed with the airline.
          </Text>
        </View>

        {/* Confirmation Receipt Card */}
        <View style={styles.receiptCard}>
          {/* PNR / Booking Reference */}
          <View style={styles.pnrSection}>
            <Text style={styles.pnrLabel}>BOOKING REFERENCE (PNR)</Text>
            <Text style={styles.pnrValue}>{bookingReference}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Flight Details if available */}
          {offer ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Airline</Text>
              <Text style={styles.detailValue}>
                {offer.airline || offer.airlineName || 'Airline'}
              </Text>
            </View>
          ) : null}

          {/* Total Paid */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Paid</Text>
            <Text style={styles.amountValue}>
              {currency === 'USD' ? '$' : `${currency} `}
              {Number(totalAmount).toFixed(2)}
            </Text>
          </View>

          {/* Passengers */}
          <View style={styles.passengerSection}>
            <Text style={styles.detailLabel}>
              Travelers ({passengerNames.length || 1})
            </Text>
            <View style={styles.passengerList}>
              {passengerNames.map((name, idx) => (
                <View key={idx} style={styles.passengerItem}>
                  <Text style={styles.passengerBullet}>👤</Text>
                  <Text style={styles.passengerNameText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>

          {orderId ? (
            <View style={styles.orderIdRow}>
              <Text style={styles.orderIdLabel}>Order ID:</Text>
              <Text style={styles.orderIdValue}>{orderId}</Text>
            </View>
          ) : null}
        </View>

        {/* Notice Info Card */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Keep your 6-character booking reference handy when checking in at the airport or viewing reservation details.
          </Text>
        </View>

        {/* Done Button */}
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successIcon: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(247, 243, 234, 0.65)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  receiptCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    marginBottom: 20,
  },
  pnrSection: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  pnrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(247, 243, 234, 0.6)',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  pnrValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#60a5fa',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.1)',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.6)',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F7F3EA',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7F3EA',
  },
  passengerSection: {
    marginTop: 6,
    marginBottom: 12,
  },
  passengerList: {
    marginTop: 8,
    gap: 6,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  passengerBullet: {
    fontSize: 14,
    marginRight: 8,
  },
  passengerNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F7F3EA',
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247, 243, 234, 0.1)',
    gap: 6,
  },
  orderIdLabel: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.5)',
  },
  orderIdValue: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.5)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.75)',
    flex: 1,
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

