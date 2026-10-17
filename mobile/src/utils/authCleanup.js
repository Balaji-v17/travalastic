import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { clearTravelAssistantStore } from '../screens/TravelAssistantScreen';

/**
 * Runs the complete on-device auth cleanup.
 * Removes active JWT token and legacy fallback tokens from SecureStore and localStorage,
 * matching DATA_INVENTORY.md section 3 on-device storage inventory.
 * Also clears ephemeral in-memory Travel Assistant conversation.
 */
export async function clearLocalAuthData() {
  try {
    clearTravelAssistantStore();
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('travalastic_token');
        localStorage.removeItem('userToken');
        localStorage.removeItem('token');
      }
    } else {
      await SecureStore.deleteItemAsync('travalastic_token').catch(() => {});
      await SecureStore.deleteItemAsync('userToken').catch(() => {});
      await SecureStore.deleteItemAsync('token').catch(() => {});
    }
  } catch (err) {
    console.error('Error clearing local auth data:', err);
  }
}
