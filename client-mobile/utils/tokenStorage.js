import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Universal token storage utility for Travalastic.
 * Falls back to browser localStorage on web because expo-secure-store
 * does not support the web platform.
 */

export async function getItem(key) {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      console.error('localStorage.getItem error:', e);
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('localStorage.setItem error:', e);
    }
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function removeItem(key) {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('localStorage.removeItem error:', e);
    }
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export default {
  getItem,
  setItem,
  removeItem,
  getItemAsync: getItem,
  setItemAsync: setItem,
  deleteItemAsync: removeItem,
};

