import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts, spacing } from '../theme/tokens';
import ScreenHeader from '../components/ScreenHeader';

export default function ProfileScreen({ navigation }) {
  const [loggingOut, setLoggingOut] = useState(false);

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
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
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

        {/* Coming Soon Notice */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeIcon}>✨</Text>
            <Text style={styles.noticeTitle}>Profile & Account Settings</Text>
          </View>
          <View style={styles.comingSoonPill}>
            <Text style={styles.comingSoonText}>COMING SOON</Text>
          </View>
          <Text style={styles.noticeBody}>
            This is the future home for managing your traveler profile, saved itineraries, flight ticket history, hotel bookings, and travel preferences.
          </Text>
        </View>

        {/* Quick Info Items */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0 (MVP)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>AI Planner Engine</Text>
            <Text style={styles.infoValue}>LangGraph + Cerebras Llama 3.1</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Flight Provider</Text>
            <Text style={styles.infoValue}>Duffel API Sandbox</Text>
          </View>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#b91c1c" />
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  avatarEmoji: {
    fontSize: 36,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  noticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noticeIcon: {
    fontSize: 18,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  comingSoonPill: {
    backgroundColor: '#fef3c7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  noticeBody: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

