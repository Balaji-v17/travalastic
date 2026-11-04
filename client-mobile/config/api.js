import { Platform } from 'react-native';

// API configuration for Travalastic mobile app
// Android emulator uses 10.0.2.2 as the alias for Mac localhost:8000
// iOS simulator and desktop web use localhost:8000
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export default API_BASE_URL;
