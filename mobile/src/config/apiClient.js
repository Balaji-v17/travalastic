import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './api';

const TOKEN_KEY = 'travalastic_token';

/**
 * A thin fetch wrapper that automatically reads the stored JWT from
 * expo-secure-store (or localStorage on web) and attaches Authorization: Bearer <token> when present.
 *
 * @param {string} endpoint - Relative path (e.g. '/itinerary/generate') or full URL
 * @param {RequestInit} [options={}] - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiClient(endpoint, options = {}) {
  const token =
    Platform.OS === 'web'
      ? (typeof localStorage !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY) || localStorage.getItem('userToken') || localStorage.getItem('token')
          : null)
      : await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  // Attach token if present and not explicitly provided in headers
  if (token && !headers.Authorization && !headers.authorization) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Prepend API_BASE_URL if endpoint is a relative path
  const url =
    endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

apiClient.get = (endpoint, options = {}) =>
  apiClient(endpoint, { ...options, method: 'GET' });

apiClient.post = (endpoint, body, options = {}) =>
  apiClient(endpoint, {
    ...options,
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

export default apiClient;

