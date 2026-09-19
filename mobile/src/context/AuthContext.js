import React, { createContext, useContext, useState, useEffect } from 'react';
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
      const storedToken =
        (await SecureStore.getItemAsync(TOKEN_KEY)) ||
        (await SecureStore.getItemAsync('userToken')) ||
        (await SecureStore.getItemAsync('token'));
      setToken(storedToken || null);
    } catch (e) {
      console.error('Failed to read auth token from SecureStore:', e);
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
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        setToken(newToken);
      }
    } catch (e) {
      console.error('Failed to save auth token in SecureStore:', e);
    }
  };

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      setToken(null);
    } catch (e) {
      console.error('Failed to remove auth token from SecureStore:', e);
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

