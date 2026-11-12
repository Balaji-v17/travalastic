import React, { useState, useEffect } from 'react';
import { useAuth, type AdminProfile } from '../context/AuthContext.tsx';
import { apiFetch, ApiError } from '../lib/api.ts';

interface LoginResponse {
  token: string;
  admin: AdminProfile;
}

export function LoginPage() {
  const { login, sessionMessage, setSessionMessage } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowServerHint, setSlowServerHint] = useState(false);

  // 5-second pending timer for server wake-up hint
  useEffect(() => {
    let timer: any = null;
    if (isSubmitting) {
      timer = setTimeout(() => {
        setSlowServerHint(true);
      }, 5000);
    } else {
      setSlowServerHint(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSessionMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await apiFetch<LoginResponse>('/admin/auth/login', {
        method: 'POST',
        body: { email: cleanEmail, password },
      });

      login(data.token, data.admin);
      window.location.hash = '#/';
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('The server may be waking up. Retrying can take up to a minute.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Travalastic Admin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to access the administrative dashboard
          </p>
        </div>

        {sessionMessage && (
          <div
            className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg"
            role="status"
          >
            {sessionMessage}
          </div>
        )}

        {errorMessage && (
          <div
            className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
            aria-live="polite"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="admin-email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email address
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="admin@travalastic.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                <span>Signing in...</span>
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* 5-second pending hint */}
        {slowServerHint && isSubmitting && (
          <div
            className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center space-x-3 text-xs text-blue-700"
            aria-live="polite"
          >
            <svg
              className="animate-spin h-4 w-4 text-blue-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <span>The server may be waking up. Retrying can take up to a minute.</span>
          </div>
        )}
      </div>
    </div>
  );
}

