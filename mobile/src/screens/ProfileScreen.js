import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

export default function ProfileScreen({ navigation }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleComingSoon = (featureName) => {
    if (Platform.OS === 'web') {
      window.alert(`Coming Soon: ${featureName} is currently under development.`);
    } else {
      Alert.alert(
        'Coming Soon',
        `${featureName} is currently under development.`
      );
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('travalastic_token');
      } else {
        await SecureStore.deleteItemAsync('travalastic_token').catch(() => {});
      }
    } finally {
      setLoggingOut(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* ScreenHeader handles safe-area notch and status bar spacing */}
      <ScreenHeader title="Profile" subtitle="Account & travel preferences" />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header (Preserved) */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.userName}>Traveler Member</Text>
          <Text style={styles.userRole}>Travalastic Explorer</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Active Session</Text>
          </View>
        </View>

        {/* Section A: Account Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Account Information</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('EditProfileScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="person-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Personal Details</Text>
              <Text style={styles.itemSubtitle}>
                Traveler Member • traveler@travalastic.com
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('EditProfileScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="create-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Edit Profile</Text>
              <Text style={styles.itemSubtitle}>
                Update name, contact info & password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section B: Travel Preferences */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>Travel Preferences</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleComingSoon('Default Currency')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="cash-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Default Currency</Text>
              <Text style={styles.itemSubtitle}>USD ($) / INR (₹)</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeText}>USD / INR</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleComingSoon('Dietary Restrictions')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="restaurant-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Dietary Restrictions</Text>
              <Text style={styles.itemSubtitle}>Vegetarian, Vegan, Halal, etc.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleComingSoon('Preferred Travel Style')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="compass-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Preferred Travel Style</Text>
              <Text style={styles.itemSubtitle}>Budget, Luxury, Adventure</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section C: My Journeys */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>My Journeys</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('SavedItinerariesScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="map-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Saved Itineraries</Text>
              <Text style={styles.itemSubtitle}>Access saved & active trip itineraries</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('BookingHistoryScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="airplane-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Flight History</Text>
              <Text style={styles.itemSubtitle}>Duffel tickets, boarding passes & receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section D: App Settings & Support */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>App Settings & Support</Text>

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleComingSoon('Help Center & Support')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="help-circle-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Help Center & Support</Text>
              <Text style={styles.itemSubtitle}>Customer care, FAQs & live assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => handleComingSoon('Privacy Policy & Terms of Service')}
            activeOpacity={0.7}
          >
            <View style={styles.itemIconContainer}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Privacy Policy & Terms</Text>
              <Text style={styles.itemSubtitle}>Data security, terms & compliance</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* System Architecture (De-emphasized footer metadata) */}
        <View style={styles.systemArchFooter}>
          <Text style={styles.systemArchTitle}>System Architecture</Text>
          <View style={styles.systemArchRow}>
            <Text style={styles.systemArchLabel}>App Version</Text>
            <Text style={styles.systemArchValue}>1.0.0 (MVP)</Text>
          </View>
          <View style={styles.systemArchRow}>
            <Text style={styles.systemArchLabel}>AI Planner Engine</Text>
            <Text style={styles.systemArchValue}>LangGraph + Cerebras Llama 3.1</Text>
          </View>
          <View style={styles.systemArchRow}>
            <Text style={styles.systemArchLabel}>Flight Provider</Text>
            <Text style={styles.systemArchValue}>Duffel API Sandbox</Text>
          </View>
        </View>

        {/* Log Out Button (Preserved) */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={colors.accentUrgent} />
          ) : (
            <Text style={styles.logoutButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: spacing[48] || 48,
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
  },
  avatarEmoji: {
    fontSize: 34,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  pillBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentPrimary,
  },
  systemArchFooter: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  systemArchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  systemArchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  systemArchLabel: {
    fontSize: 12,
    color: '#666666',
    fontFamily: fonts.body,
  },
  systemArchValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: fonts.body,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(214, 90, 74, 0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: colors.accentUrgent,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: fonts.bodyBold,
  },
});
