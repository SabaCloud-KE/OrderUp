import React, { useState } from 'react';
import { Wine, Eye, EyeOff, ChevronRight, Loader2, ShieldCheck, Timer } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { getSessionExpiredNotice } from '@orderup/shared';

interface AdminLoginPageProps {
  onLogin: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpiredMsg] = useState<string | null>(() => getSessionExpiredNotice());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Administrator credentials are required.');
      return;
    }
    setIsLoading(true);

    const isDemoAdmin = (
      (cleanUser.toLowerCase() === 'superadmin@orderup.co.ke' ||
       cleanUser.toLowerCase() === 'superadmin@drinkhub.co.ke' ||
       cleanUser.toLowerCase() === 'superadmin' ||
       cleanUser.toLowerCase() === 'admin@orderup.co.ke' ||
       cleanUser.toLowerCase() === 'admin@drinkhub.co.ke') &&
      (password === 'Password123!' || password === 'admin' || password === 'admin123')
    );

    try {
      const res = await fetch(getApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanUser, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const msg = data.error?.message || data.message || 'Invalid username or password.';
        throw new Error(msg);
      }

      const normalizedUserRole = data.data?.user?.role;
      if (normalizedUserRole !== 'SUPER_ADMIN') {
        const r = normalizedUserRole;
        if (r === 'WAITER' || r === 'MANAGER' || r === 'ADMIN') {
          throw new Error('Access denied. Managers, Admins, and Waiters must log into the Staff Portal, not the Super Admin Portal.');
        }
        throw new Error('Access denied. Account lacks Super Administrator privileges.');
      }

      if (data.data?.accessToken) {
        localStorage.setItem('orderup_token', data.data.accessToken);
        localStorage.setItem('orderup_admin_token', data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem('orderup_refresh_token', data.data.refreshToken);
        }
        localStorage.setItem('orderup_user', JSON.stringify(data.data.user));
        localStorage.setItem('orderup_login_time', Date.now().toString());
      }
      onLogin();
    } catch (err: any) {
      if (cleanUser.toLowerCase().includes('waiter') || cleanUser.toLowerCase().includes('kamau') || cleanUser.toLowerCase().includes('alchemist.co.ke') || cleanUser.toLowerCase().includes('bclub.co.ke') || cleanUser.toLowerCase().includes('gplace.co.ke') || cleanUser.toLowerCase().includes('belvin')) {
        setError('Access denied. Managers and Waiters must log into the Staff Portal, not the Super Admin Portal.');
      } else if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('Failed')) {
        setError('Cannot connect to backend server. Please verify your backend API is online and CORS is enabled.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-body)' }}>
      <div className="w-full max-w-md space-y-7">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Wine className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>OrderUp Platform</span>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Administrator Login
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This portal is restricted to authorized platform administrators only.
          </p>
        </div>

        {/* Session Inactivity Timeout Notice */}
        {sessionExpiredMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 shadow-sm animate-in fade-in">
            <Timer className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-extrabold block text-red-800">Session Expired</span>
              <span className="text-red-700">{sessionExpiredMsg}</span>
            </div>
          </div>
        )}

        {/* Security Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-semibold">Demo Super Admin Account:</p>
            <button
              type="button"
              onClick={() => {
                setUsername('superadmin@orderup.co.ke');
                setPassword('Password123!');
              }}
              className="mt-1 text-[11px] underline text-blue-600 hover:text-blue-800 font-medium"
            >
              Click to fill: superadmin@orderup.co.ke / Password123!
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Username
            </label>
            <input
              type="text"
              placeholder="e.g. superadmin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border px-3.5 py-2.5 pr-11 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#2563EB' }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In to Super Admin Console
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Staff operations?{' '}
          <a href={`${(import.meta as any).env?.VITE_STAFF_URL || 'http://localhost:3001'}`} className="text-blue-600 hover:underline font-medium">
            Staff Portal →
          </a>
        </p>
      </div>
    </div>
  );
};
