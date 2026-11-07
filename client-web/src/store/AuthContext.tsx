import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/api';
import { getToken, setToken, clearToken } from '../lib/auth';
import type { Page } from './AppContext';
import { useApp } from './AppContext';

export interface User {
  id: string;
  _id?: string;
  email: string;
  name: string;
  createdAt?: string;
}

export type AuthStatus = 'loading' | 'authed' | 'anon';

export interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  redirectTarget: Page | null;
  setRedirectTarget: (page: Page | null) => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [redirectTarget, setRedirectTargetState] = useState<Page | null>(null);
  const redirectTargetRef = useRef<Page | null>(null);

  const { page, navigate } = useApp();
  const pageRef = useRef<Page>(page);
  pageRef.current = page;

  const setRedirectTarget = useCallback((target: Page | null) => {
    redirectTargetRef.current = target;
    setRedirectTargetState(target);
  }, []);

  // Hydrate user on mount if token exists
  useEffect(() => {
    let isMounted = true;
    const token = getToken();

    if (!token) {
      setStatus('anon');
      setUser(null);
      return;
    }

    apiFetch<{ user: User }>('/auth/me')
      .then((data) => {
        if (!isMounted) return;
        setUser(data.user);
        setStatus('authed');
      })
      .catch(() => {
        if (!isMounted) return;
        clearToken();
        setUser(null);
        setStatus('anon');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for the auth:expired event: set anon, and remember the page the user was on
  useEffect(() => {
    const handleExpired = () => {
      clearToken();
      setUser(null);
      setStatus('anon');
      if (pageRef.current && pageRef.current !== 'auth') {
        setRedirectTarget(pageRef.current);
      }
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => {
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, [setRedirectTarget]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.token);
      setUser(data.user);
      setStatus('authed');
    },
    []
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{ token: string; user: User }>('/auth/signup', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.token);
      setUser(data.user);
      setStatus('authed');
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anon');
    setRedirectTarget(null);
    navigate('home');
  }, [navigate, setRedirectTarget]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        signup,
        logout,
        redirectTarget,
        setRedirectTarget,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
