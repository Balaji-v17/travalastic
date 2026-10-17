import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme/tokens';
import apiClient from '../config/apiClient';
import { openLegalUrl, PRIVACY_POLICY_URL } from '../config/legal';
import { clearLocalAuthData } from '../utils/authCleanup';

export default function DeleteAccountScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const executeAccountDeletion = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await apiClient('/auth/me', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });

      if (response.status === 200) {
        // Run existing log out cleanup (SecureStore & localStorage tokens from DATA_INVENTORY.md section 3)
        await clearLocalAuthData();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      if (response.status === 401) {
        setErrorMessage('Incorrect password');
        return;
      }

      if (response.status === 429) {
        setErrorMessage('Too many attempts. Please try again later.');
        return;
      }

      // Handle unexpected status codes without clearing any credentials
      const errData = await response.json().catch(() => ({}));
      setErrorMessage(errData.error || 'Failed to delete account. Please try again.');
    } catch (err) {
      console.error('Account deletion network error:', err);
      setErrorMessage('Unable to connect to the server. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePressDelete = () => {
    if (!password.trim() || loading) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete your account? This action cannot be undone.'
      );
      if (confirmed) {
        executeAccountDeletion();
      }
    } else {
      Alert.alert(
        'Permanently Delete Account?',
        'Are you sure you want to permanently delete your account? All your itineraries, chat logs, expenses, and account data will be permanently removed. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: executeAccountDeletion,
          },
        ]
      );
    }
  };

  const isButtonDisabled = !password.trim() || loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrapper}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Callout */}
        <View style={styles.warningCard}>
          <View style={styles.warningHeaderRow}>
            <Ionicons name="warning-outline" size={24} color={colors.accentUrgent} />
            <Text style={styles.warningTitle}>Permanent Account Deletion</Text>
          </View>
          <Text style={styles.warningText}>
            Deleting your account is permanent and irreversible. Please review what will be deleted and what remains with third-party providers.
          </Text>
        </View>

        {/* Section 1: What Will Be Deleted */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>What will be permanently deleted:</Text>
          <View style={styles.bulletItem}>
            <Ionicons name="close-circle-outline" size={18} color={colors.accentUrgent} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Your Account:</Text> Name, email address, password hash, and active login sessions.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="close-circle-outline" size={18} color={colors.accentUrgent} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Itineraries:</Text> All saved travel schedules, personalized activities, and generated packing lists.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="close-circle-outline" size={18} color={colors.accentUrgent} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Chat History:</Text> All conversational messages and trip planning history with the AI assistant.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="close-circle-outline" size={18} color={colors.accentUrgent} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Expenses:</Text> All recorded trip expenses and spending tracking logs.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="close-circle-outline" size={18} color={colors.accentUrgent} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Booking Records:</Text> All flight reservations and traveler passenger records stored in this app.
            </Text>
          </View>
        </View>

        {/* Section 2: What Is NOT Removed */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>What is NOT removed by this:</Text>
          <View style={styles.bulletItem}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accentPrimary} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>External Flight Bookings:</Text> Flight booking details already shared with our booking provider (Duffel) and airline carriers are held by them under their own policy.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accentPrimary} style={styles.bulletIcon} />
            <Text style={styles.bulletText}>
              <Text style={styles.bulletBold}>Third-Party AI Services:</Text> Data processed by third-party AI services is covered by our{' '}
              <Text
                style={styles.inlineLink}
                onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>

        {/* Section 3: Password Confirmation Input */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Enter your password to confirm</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder="Account password"
            placeholderTextColor={colors.inkNavyMuted || 'rgba(247,243,234,0.4)'}
            secureTextEntry
            autoComplete="current-password"
            autoCapitalize="none"
            editable={!loading}
          />

          {/* Inline Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.accentUrgent} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Delete Action Button */}
          <TouchableOpacity
            style={[
              styles.deleteButton,
              isButtonDisabled && styles.deleteButtonDisabled,
            ]}
            onPress={handlePressDelete}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Permanently delete my account</Text>
            )}
          </TouchableOpacity>
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
    paddingBottom: spacing[48] || 48,
  },
  warningCard: {
    backgroundColor: '#261214',
    borderWidth: 1,
    borderColor: colors.accentUrgent,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.accentUrgent,
    marginLeft: 8,
    fontWeight: '700',
  },
  warningText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
    fontWeight: '600',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bulletBold: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  inlineLink: {
    color: colors.accentPrimary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(214, 90, 74, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentUrgent,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.accentUrgent,
    marginLeft: 8,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: colors.accentUrgent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
});

