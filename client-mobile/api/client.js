import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Your live Render backend URL
const BASE_URL = 'https://travalastic.onrender.com';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Automatically attach JWT token to every request if user is logged in
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token = null;
      if (Platform.OS === 'web') {
        token =
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('userToken') ||
              localStorage.getItem('travalastic_token') ||
              localStorage.getItem('token')
            : null);
      } else {
        token =
          (await SecureStore.getItemAsync('userToken').catch(() => null)) ||
          (await SecureStore.getItemAsync('travalastic_token').catch(() => null)) ||
          (await SecureStore.getItemAsync('token').catch(() => null));
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;