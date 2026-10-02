import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts } from '../theme/tokens';
import apiClient from '../config/apiClient';

function extractEmailFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded);
    return parsed.email || null;
  } catch {
    return null;
  }
}

export default function EditProfileScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadUser() {
      setLoadingInitial(true);
      try {
        const response = await apiClient('/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            if (data.user.email) setEmail(data.user.email);
            if (data.user.name) setName(data.user.name);
            setLoadingInitial(false);
            return;
          }
        }
      } catch (err) {
        // Fallback to token extraction
      }

      try {
        let token = null;
        if (Platform.OS === 'web') {
          token = localStorage.getItem('travalastic_token');
        } else {
          token = await SecureStore.getItemAsync('travalastic_token').catch(() => null);
        }
        const derivedEmail = extractEmailFromToken(token);
        if (derivedEmail) {
          setEmail(derivedEmail);
          const namePart = derivedEmail.split('@')[0];
          setName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        }
      } catch {
        // Fallback default
        setEmail('traveler@travalastic.com');
        setName('Traveler Member');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadUser();
  }, []);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Full name cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await apiClient('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to update profile. Please try again.';
        setErrorMessage(errorMsg);
        setSaving(false);
        return;
      }

      setSaving(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch (err) {
      setSaving(false);
      setErrorMessage(err.message || 'Network error while updating profile.');
    }
  };

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
        {/* Header Title */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Text style={styles.headerSubtitle}>
            Update your account information. Changes will reflect across your travel itineraries.
          </Text>
        </View>

        {/* Success Banner */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#34d399" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {loadingInitial ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading profile details...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {/* User Avatar Badge */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <View style={styles.avatarTextCol}>
                <Text style={styles.avatarTitle}>{name || 'Traveler Member'}</Text>
                <Text style={styles.avatarSubtitle}>{email || 'Active Member'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Email Field (Read-only) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Account Email</Text>
                <Text style={styles.readOnlyTag}>Read-only</Text>
              </View>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={18} color="rgba(247, 243, 234, 0.4)" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, styles.inputDisabledText]}
                  value={email}
                  editable={false}
                  placeholder="traveler@travalastic.com"
                  placeholderTextColor="rgba(247, 243, 234, 0.3)"
                />
              </View>
              <Text style={styles.helperText}>Your primary sign-in and booking confirmation address.</Text>
            </View>

            {/* Editable Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={colors.accentPrimary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(247, 243, 234, 0.4)"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
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
  headerInfo: {
    marginBottom: 20,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F7F3EA',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(247, 243, 234, 0.65)',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.1)',
  },
  loadingText: {
    color: 'rgba(247, 243, 234, 0.6)',
    fontSize: 13,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.12)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  avatarTextCol: {
    flex: 1,
  },
  avatarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F7F3EA',
  },
  avatarSubtitle: {
    fontSize: 12,
    color: 'rgba(247, 243, 234, 0.55)',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.08)',
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(247, 243, 234, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  readOnlyTag: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(247, 243, 234, 0.45)',
    backgroundColor: '#121212',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(247, 243, 234, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F7F3EA',
  },
  inputDisabled: {
    backgroundColor: '#0d0d0d',
    borderColor: 'rgba(247, 243, 234, 0.08)',
  },
  inputDisabledText: {
    color: 'rgba(247, 243, 234, 0.65)',
  },
  helperText: {
    fontSize: 11,
    color: 'rgba(247, 243, 234, 0.45)',
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
});
