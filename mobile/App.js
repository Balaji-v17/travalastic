import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_600SemiBold,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  SpaceMono_400Regular,
} from '@expo-google-fonts/space-mono';

import { colors } from './theme/tokens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';

// Navigation theme setting default background across all screens to colors.background
const appNavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
  },
};

// Keep the splash screen visible while fonts and auth are being loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    Manrope_400Regular,
    Manrope_700Bold,
    SpaceMono_400Regular,
  });

  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkToken() {
      try {
        let token = null;
        if (Platform.OS === 'web') {
          token =
            localStorage.getItem('travalastic_token') ||
            localStorage.getItem('userToken') ||
            localStorage.getItem('token');
        } else {
          token =
            (await SecureStore.getItemAsync('travalastic_token')) ||
            (await SecureStore.getItemAsync('userToken')) ||
            (await SecureStore.getItemAsync('token'));
        }
        setIsAuthenticated(!!token);
      } catch (err) {
        console.error('App: Error checking auth token:', err);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    }

    checkToken();
  }, []);

  const isReady = (fontsLoaded || fontError) && !authLoading;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const initialRouteName = isAuthenticated ? 'Home' : 'Login';

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={appNavigationTheme}>
          <StatusBar style="light" />
          <RootNavigator initialRouteName={initialRouteName} isAuthenticated={isAuthenticated} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
