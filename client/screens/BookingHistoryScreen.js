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

export default function BookingHistoryScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const response = await apiClient('/bookings/mine');
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch flight bookings');
      }

      const list = Array.isArray(data) ? data : data?.bookings || [];
      setBookings(list);
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setErrorMessage(err.message || 'Could not load your flight bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleBookingPress = (item) => {
    navigation.navigate('BookingConfirmation', {
      bookingReference: item.bookingReference,
      orderId: item.orderId,
      totalAmount: item.totalAmount,
      currency: item.currency || 'USD',
      passengerNames: item.passengerNames || [],
    });
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchBookings(true)}
            tintColor={colors.accentPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Flight History</Text>
          <Text style={styles.headerSubtitle}>
            Review all your confirmed flight bookings, tickets, and booking references issued through Duffel.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => fetchBookings()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading your flight bookings…</Text>
          </View>
        ) : null}

        {/* Empty State */}
        {!loading && bookings.length === 0 && !errorMessage ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="airplane-outline" size={42} color={colors.accentPrimary} />
            </View>
            <Text style={styles.emptyTitle}>No Flight Bookings Yet</Text>
            <Text style={styles.emptyDescription}>
              You haven't booked any flights with us yet. Search real-time flights and book instant tickets!
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => navigation.navigate('FlightSearch')}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={18} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.exploreButtonText}>Search Flights</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Bookings List */}
        {!loading && bookings.length > 0 ? (
          <View style={styles.listContainer}>
            {bookings.map((item, index) => {
              const depFormatted = formatDate(item.departureTime);
              const timeFormatted = formatTime(item.departureTime);
              const status = (item.status || 'confirmed').toLowerCase();

              return (
                <TouchableOpacity
                  key={item._id || item.bookingReference || index}
                  style={styles.card}
                  onPress={() => handleBookingPress(item)}
                  activeOpacity={0.7}
                >
                  {/* Card Header: Airline & Status Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.airlineRow}>
                      <Ionicons name="airplane" size={18} color={colors.accentPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.airlineText} numberOfLines={1}>
                        {item.airline || 'Commercial Flight'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        status === 'confirmed' ? styles.statusConfirmed : styles.statusOther,
                      ]}
                    >
                      <Ionicons
                        name={status === 'confirmed' ? 'checkmark-circle' : 'time-outline'}
                        size={12}
                        color={status === 'confirmed' ? '#34D399' : '#FBBF24'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          status === 'confirmed' ? styles.statusTextConfirmed : styles.statusTextOther,
                        ]}
                      >
                        {status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Route Row: Origin -> Arrow -> Destination */}
                  <View style={styles.routeRow}>
                    <View style={styles.airportBlock}>
                      <Text style={styles.airportCode}>{item.origin || 'ORIGIN'}</Text>
                      <Text style={styles.airportLabel}>From</Text>
                    </View>

                    <View style={styles.flightPathContainer}>
                      <View style={styles.pathLine} />
                      <View style={styles.planeIconContainer}>
                        <Ionicons name="airplane" size={16} color={colors.textSecondary} />
                      </View>
                      <View style={styles.pathLine} />
                    </View>

                    <View style={[styles.airportBlock, { alignItems: 'flex-end' }]}>
                      <Text style={styles.airportCode}>{item.destination || 'DEST'}</Text>
                      <Text style={styles.airportLabel}>To</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Details Footer: Reference, Date, Passengers, Amount */}
                  <View style={styles.cardFooter}>
                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>BOOKING REF</Text>
                      <Text style={styles.referenceCode}>{item.bookingReference || 'N/A'}</Text>
                    </View>

                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>DEPARTURE</Text>
                      <Text style={styles.footerValue}>
                        {depFormatted}
                        {timeFormatted ? ` • ${timeFormatted}` : ''}
                      </Text>
                    </View>

                    <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
                      <Text style={styles.footerLabel}>AMOUNT</Text>
                      <Text style={styles.amountValue}>
                        {item.currency === 'USD' || !item.currency ? '$' : `${item.currency} `}
                        {item.totalAmount || '0'}
                      </Text>
                    </View>
                  </View>

                  {/* Passenger names preview if available */}
                  {Array.isArray(item.passengerNames) && item.passengerNames.length > 0 ? (
                    <View style={styles.passengersRow}>
                      <Ionicons name="person-outline" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={styles.passengersText} numberOfLines={1}>
                        {item.passengerNames.join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
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
    padding: 20,
    paddingBottom: 40,
  },
  headerInfo: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F7F3EA',
    letterSpacing: -0.5,
    marginBottom: 6,
    fontFamily: fonts.hero,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: fonts.body,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
    marginLeft: 8,
    fontFamily: fonts.body,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262626',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(235, 94, 40, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(235, 94, 40, 0.25)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F7F3EA',
    marginBottom: 8,
    fontFamily: fonts.hero,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: fonts.body,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  listContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  airlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  airlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F7F3EA',
    fontFamily: fonts.hero,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusOther: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextConfirmed: {
    color: '#34D399',
  },
  statusTextOther: {
    color: '#FBBF24',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  airportBlock: {
    flex: 1,
  },
  airportCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F7F3EA',
    letterSpacing: 1,
    fontFamily: fonts.hero,
  },
  airportLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    fontFamily: fonts.body,
  },
  flightPathContainer: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  pathLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  planeIconContainer: {
    marginHorizontal: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerCol: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  referenceCode: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accentPrimary,
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 12,
    color: '#F7F3EA',
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F7F3EA',
    fontFamily: fonts.hero,
  },
  passengersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  passengersText: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: fonts.body,
    flex: 1,
  },
});
