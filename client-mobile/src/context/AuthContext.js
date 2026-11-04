import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'travalastic_token';

export const AuthContext = createContext({
  token: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async (token) => {},
  signOut: async () => {},
  checkAuth: async () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      let storedToken = null;
      if (Platform.OS === 'web') {
        storedToken =
          localStorage.getItem(TOKEN_KEY) ||
          localStorage.getItem('userToken') ||
          localStorage.getItem('token');
      } else {
        storedToken =
          (await SecureStore.getItemAsync(TOKEN_KEY)) ||
          (await SecureStore.getItemAsync('userToken')) ||
          (await SecureStore.getItemAsync('token'));
      }
      setToken(storedToken || null);
    } catch (e) {
      console.error('Failed to read auth token from storage:', e);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const signIn = async (newToken) => {
    try {
      if (newToken) {
        if (Platform.OS === 'web') {
          localStorage.setItem(TOKEN_KEY, newToken);
        } else {
          await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        }
        setToken(newToken);
      }
    } catch (e) {
      console.error('Failed to save auth token in storage:', e);
    }
  };

  const signOut = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      }
      setToken(null);
    } catch (e) {
      console.error('Failed to remove auth token from storage:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        isLoading,
        signIn,
        signOut,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;

