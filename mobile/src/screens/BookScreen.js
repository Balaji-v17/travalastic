import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

const BOOKING_OPTIONS = [
  {
    id: 'flights',
    title: 'Flights',
    icon: '✈️',
    subtitle: 'Search airline routes & instant booking with Duffel',
    route: 'FlightSearch',
    accent: '#2563eb',
    badge: 'Instant Tickets',
  },
  {
    id: 'hotels',
    title: 'Hotels',
    icon: '🏨',
    subtitle: 'Curated stays & real-time rooms on Booking.com',
    route: 'Hotels',
    accent: '#003580',
    badge: 'Curated + Booking.com',
  },
  {
    id: 'trains-buses',
    title: 'Trains & Buses',
    icon: '🚆',
    subtitle: 'Intercity Indian ground transit with IRCTC & RedBus',
    route: 'TrainsAndBuses',
    accent: '#ea580c',
    badge: 'Rail & Bus',
  },
  {
    id: 'cabs',
    title: 'Cabs',
    icon: '🚗',
    subtitle: 'Set pickup & dropoff with direct Uber app handoff',
    route: 'CabBooking',
    accent: '#000000',
    badge: 'Uber Deep Link',
  },
];

export default function BookScreen({ navigation }) {
  return (
    <View style={styles.wrapper}>
      {/* Universal ScreenHeader with safe-area clearance */}
      <ScreenHeader
        title="Book Travel 🎫"
        subtitle="Choose your mode of transit or stay to search availability and start booking."
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 4 Cards */}
        <View style={styles.cardsGrid}>
          {BOOKING_OPTIONS.map((option) => {
            const isFlights = option.id === 'flights';

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.cardBase,
                  isFlights ? styles.cardSurface : styles.cardSurfaceAlt,
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(option.route)}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isFlights
                          ? `${option.accent}18`
                          : `${option.accent}25`,
                      },
                    ]}
                  >
                    <Text style={styles.icon}>{option.icon}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      isFlights ? styles.badgeSurface : styles.badgeSurfaceAlt,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: isFlights ? '#1e40af' : option.accent === '#000000' ? colors.textPrimary : option.accent,
                        },
                      ]}
                    >
                      {option.badge}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.cardTitle,
                    isFlights ? styles.cardTitleSurface : styles.cardTitleSurfaceAlt,
                  ]}
                >
                  {option.title}
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    isFlights ? styles.cardSubtitleSurface : styles.cardSubtitleSurfaceAlt,
                  ]}
                >
                  {option.subtitle}
                </Text>

                <View
                  style={[
                    styles.cardFooter,
                    isFlights ? styles.cardFooterSurface : styles.cardFooterSurfaceAlt,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      isFlights ? styles.actionTextSurface : styles.actionTextSurfaceAlt,
                    ]}
                  >
                    Explore & Book
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
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
  cardsGrid: {
    gap: 16,
  },
  cardBase: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  // Flights: ticket-paper treatment (colors.surface)
  cardSurface: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(19, 27, 46, 0.12)',
  },
  // Hotels, Trains & Buses, Cabs: secondary dark navy treatment (colors.surfaceAlt)
  cardSurfaceAlt: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeSurface: {
    backgroundColor: 'rgba(19, 27, 46, 0.08)',
  },
  badgeSurfaceAlt: {
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
  },
  cardTitleSurface: {
    color: colors.textOnSurface, // #131B2E
  },
  cardTitleSurfaceAlt: {
    color: colors.textPrimary, // #F7F3EA
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardSubtitleSurface: {
    color: 'rgba(19, 27, 46, 0.7)',
  },
  cardSubtitleSurfaceAlt: {
    color: colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  cardFooterSurface: {
    borderTopColor: 'rgba(19, 27, 46, 0.08)',
  },
  cardFooterSurfaceAlt: {
    borderTopColor: colors.border,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionTextSurface: {
    color: colors.textOnSurface,
  },
  actionTextSurfaceAlt: {
    color: colors.accentPrimary,
  },
});

