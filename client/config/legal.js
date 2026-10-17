import { Alert, Linking, Platform } from 'react-native';

export const PRIVACY_POLICY_URL = '';
export const TERMS_URL = '';
export const ACCOUNT_DELETION_INFO_URL = '';

/**
 * Open a legal URL or display an alert if not yet configured.
 * @param {string} url
 */
export function openLegalUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert("This page isn't available yet");
      }
    } else {
      Alert.alert('Notice', "This page isn't available yet");
    }
    return;
  }

  Linking.openURL(url).catch((err) => {
    console.warn('Failed to open URL:', err);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert("This page isn't available yet");
      }
    } else {
      Alert.alert('Notice', "This page isn't available yet");
    }
  });
}

