import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../lib/api.ts';
import { getJwtExpSeconds, isJwtExpired } from '../lib/jwtExp.ts';
import type { AdminRole } from '../lib/permissions.ts';

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  admin: AdminProfile | null;
  token: string | null;
  isLoading: boolean;
  sessionMessage: string | null;
  dashboardNotification: string | null;
  setSessionMessage: (msg: string | null) => void;
  setDashboardNotification: (msg: string | null) => void;
  login: (token: string, admin: AdminProfile) => void;
  logout: () => void;
  completePasswordChange: (newToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [dashboardNotification, setDashboardNotification] = useState<string | null>(null);

  // Initialize and verify session on load
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const storedToken = getToken();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      // If token is already expired according to client-decoded exp, clear immediately
      if (isJwtExpired(storedToken)) {
        clearToken();
        if (isMounted) {
          setSessionMessage('Your session ended. Please sign in again.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const me = await apiFetch<AdminProfile>('/admin/auth/me');
        if (isMounted) {
          setAdmin(me);
          setTokenState(storedToken);
        }
      } catch {
        clearToken();
        if (isMounted) {
          setAdmin(null);
          setTokenState(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();

    // Listen for 401 session expiration event from apiFetch
    const handleSessionEnded = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      clearToken();
      setAdmin(null);
      setTokenState(null);
      setSessionMessage(customEvent.detail?.message || 'Your session ended. Please sign in again.');
      window.location.hash = '#/login';
    };

    // Listen for 403 PASSWORD_CHANGE_REQUIRED event
    const handlePasswordChangeRequired = () => {
      setAdmin((prev) => (prev ? { ...prev, mustChangePassword: true } : null));
      window.location.hash = '#/change-password';
    };

    window.addEventListener('admin:session-ended', handleSessionEnded);
    window.addEventListener('admin:password-change-required', handlePasswordChangeRequired);

    return () => {
      isMounted = false;
      window.removeEventListener('admin:session-ended', handleSessionEnded);
      window.removeEventListener('admin:password-change-required', handlePasswordChangeRequired);
    };
  }, []);

  // Proactive auto sign-out timer based on decoded JWT exp
  useEffect(() => {
    if (!token || !admin) {
      return;
    }

    const expSeconds = getJwtExpSeconds(token);
    if (!expSeconds) {
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const msRemaining = Math.max(0, (expSeconds - nowSeconds) * 1000);

    const timer = setTimeout(() => {
      clearToken();
      setAdmin(null);
      setTokenState(null);
      setSessionMessage('Your session ended. Please sign in again.');
      window.location.hash = '#/login';
    }, msRemaining);

    return () => clearTimeout(timer);
  }, [token, admin]);

  const login = (newToken: string, profile: AdminProfile) => {
    setToken(newToken);
    setTokenState(newToken);
    setAdmin(profile);
    setSessionMessage(null);
    if (profile.mustChangePassword) {
      window.location.hash = '#/change-password';
    } else {
      window.location.hash = '#/';
    }
  };

  const completePasswordChange = (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    setAdmin((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    setDashboardNotification('Password changed');
    window.location.hash = '#/';
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setAdmin(null);
    setSessionMessage(null);
    setDashboardNotification(null);
    window.location.hash = '#/login';
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isLoading,
        sessionMessage,
        dashboardNotification,
        setSessionMessage,
        setDashboardNotification,
        login,
        logout,
        completePasswordChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
