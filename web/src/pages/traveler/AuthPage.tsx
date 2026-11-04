import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

export default function AuthPage() {
  const { status, login, signup, redirectTarget, setRedirectTarget } = useAuth();
  const { navigate } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to target or home
  useEffect(() => {
    if (status === 'authed') {
      const target = redirectTarget && redirectTarget !== 'auth' ? redirectTarget : 'home';
      setRedirectTarget(null);
      navigate(target);
    }
  }, [status, redirectTarget, setRedirectTarget, navigate]);

  const handleModeChange = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Client-side validation mirroring backend rules
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'signin') {
        await login(trimmedEmail, password);
      } else {
        await signup(trimmedEmail, password);
      }
      const target = redirectTarget && redirectTarget !== 'auth' ? redirectTarget : 'home';
      setRedirectTarget(null);
      navigate(target);
    } catch (err: any) {
      setError(err?.message || (mode === 'signin' ? 'Sign in failed' : 'Sign up failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F5F0]">
      <div className="max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('home')}
            className="inline-flex items-center gap-2 group mb-4 focus:outline-none"
            aria-label="Travalastic home"
          >
            <span className="font-display text-2xl tracking-tight text-[#111111] group-hover:text-[#77736C] transition-colors">
              Travalastic
            </span>
          </button>
          <h1 className="font-display text-3xl sm:text-4xl text-[#111111] tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Begin your journey'}
          </h1>
          <p className="mt-2 text-sm text-[#77736C]">
            {mode === 'signin'
              ? 'Access your curated itineraries, bespoke journeys, and bookings.'
              : 'Create your account to design, save, and manage luxury travel.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#E8E4DC] p-8 sm:p-10">
          {/* Mode Toggle Tabs */}
          <div className="flex rounded-xl bg-[#F7F5F0] p-1 mb-8 border border-[#E8E4DC]">
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 tracking-wide uppercase ${
                mode === 'signin'
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#77736C] hover:text-[#111111]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('signup')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 tracking-wide uppercase ${
                mode === 'signup'
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#77736C] hover:text-[#111111]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Inline Error Alert */}
          {error && (
            <div
              className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-slide-up"
              role="alert"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="flex-shrink-0 mt-0.5 text-red-600"
              >
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
              </svg>
              <span className="leading-relaxed flex-1">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold uppercase tracking-wider text-[#77736C] mb-2"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border border-[#E8E4DC] bg-[#F7F5F0]/50 text-[#111111] placeholder-[#77736C]/50 focus:outline-none focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E] transition-all text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#77736C] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#E8E4DC] bg-[#F7F5F0]/50 text-[#111111] placeholder-[#77736C]/50 focus:outline-none focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E] transition-all text-sm disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#77736C] hover:text-[#111111] transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#111111] text-white font-medium text-sm hover:bg-[#252525] focus:outline-none focus:ring-2 focus:ring-[#C9A96E] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'signin' ? 'Signing in…' : 'Creating account…'}</span>
                </>
              ) : (
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>

            {mode === 'signup' && (
              <p className="text-[11px] text-[#77736C] text-center mt-3 leading-normal">
                By creating an account, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => navigate('privacy')}
                  className="underline hover:text-[#111111] transition-colors"
                >
                  Privacy Policy
                </button>
                .
              </p>
            )}
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-[#E8E4DC] text-center">
            <p className="text-xs text-[#77736C]">
              {mode === 'signin' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className="font-semibold text-[#111111] hover:text-[#C9A96E] transition-colors"
                  >
                    Create account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('signin')}
                    className="font-semibold text-[#111111] hover:text-[#C9A96E] transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-xs text-[#77736C] hover:text-[#111111] transition-colors"
          >
            ← Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
