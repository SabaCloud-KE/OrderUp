import React, { useState, useEffect } from 'react';
import { Wine, Eye, EyeOff, ChevronRight, Loader2, User, Briefcase, Shield, Timer, X } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { getSessionExpiredNotice, validateStrongPassword, STRONG_PASSWORD_MESSAGE } from '@orderup/shared';
import { PrivacyPolicyModal, TermsAndConditionsModal, BusinessAdminOnboardingModal } from '../components/LegalModals';

type StaffRole = 'waiter' | 'manager' | 'admin';

interface LoginPageProps {
  onLogin: (role: StaffRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    } catch {}
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(() => getSessionExpiredNotice());

  // Auto-dismiss session expired alert after 5 seconds
  useEffect(() => {
    if (!sessionExpiredMsg) return;
    const timer = setTimeout(() => {
      setSessionExpiredMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [sessionExpiredMsg]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSubtitle, setOnboardingSubtitle] = useState('');
  const [pendingRole, setPendingRole] = useState<StaffRole | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const msg = data.error?.message || data.message || 'Invalid credentials. Please check your email and password.';
        throw new Error(msg);
      }

      const userRole = (data.data?.user?.role || '').toUpperCase();
      let targetRole: StaffRole;

      if (userRole === 'ADMIN' || userRole === 'CLUB_ADMIN' || userRole === 'TENANT_ADMIN' || userRole === 'SUPER_ADMIN') {
        targetRole = 'admin';
      } else if (userRole === 'MANAGER') {
        targetRole = 'manager';
      } else if (userRole === 'WAITER') {
        targetRole = 'waiter';
      } else {
        throw new Error(`Access denied. Account role "${userRole}" is not permitted on the staff portal.`);
      }

      setPendingRole(targetRole);

      if (data.data?.accessToken) {
        localStorage.setItem('orderup_token', data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem('orderup_refresh_token', data.data.refreshToken);
        }
        localStorage.setItem('orderup_user', JSON.stringify(data.data.user));
        localStorage.setItem('orderup_login_time', Date.now().toString());
      }

      const mustChange = data.data?.mustChangePassword || data.data?.user?.mustChangePassword;
      if (mustChange) {
        setTempPassword(password);
        setNeedsPasswordChange(true);
        setIsLoading(false);
        return;
      }

      if (targetRole === 'admin') {
        const userObj = data.data?.user || {};
        const userKey = userObj.userUuid || userObj.id || userObj.email || 'admin';
        const isPolicyAccepted = !!(
          localStorage.getItem('orderup_policy_accepted_' + userKey) ||
          localStorage.getItem('drinkhub_policy_accepted_' + userKey)
        );
        if (!isPolicyAccepted) {
          setPendingRole(targetRole);
          setOnboardingSubtitle(`Welcome${userObj.business?.name ? ` to ${userObj.business.name}` : ''}! Before accessing your Business Admin portal, statutory compliance requires your formal review and acceptance of our service agreements.`);
          setShowOnboardingModal(true);
          setIsLoading(false);
          return;
        }
      }

      onLogin(targetRole);
    } catch (err: any) {
      const isNetworkError =
        err.name === 'TypeError' ||
        err.message?.toLowerCase().includes('fetch') ||
        err.message?.toLowerCase().includes('failed to fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('connect');

      if (isNetworkError) {
        setError(
          'Cannot connect to the server. Please verify your internet connection or check if the server is running.'
        );
      } else {
        setError(err.message || 'Authentication failed. Invalid credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const val = validateStrongPassword(newPassword);
    if (!val.isValid) {
      setError(val.error || STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('orderup_token') || localStorage.getItem('drinkhub_token');
      const res = await fetch(getApiUrl('/auth/change-first-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: tempPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to update password.');
      }

      setNeedsPasswordChange(false);
      setTempPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // After password change, if user is Business Admin, prompt them to accept the policy
      const resolvedRole: StaffRole = pendingRole || 'admin';
      if (resolvedRole === 'admin') {
        try {
          const userObj = JSON.parse(
            localStorage.getItem('orderup_user') ||
            localStorage.getItem('drinkhub_user') ||
            '{}'
          );
          const userKey = userObj.userUuid || userObj.id || userObj.email || 'admin';
          const isPolicyAccepted = !!(
            localStorage.getItem('orderup_policy_accepted_' + userKey) ||
            localStorage.getItem('drinkhub_policy_accepted_' + userKey)
          );
          if (!isPolicyAccepted) {
            setPendingRole(resolvedRole);
            setOnboardingSubtitle('Your temporary password has been successfully updated! Before accessing your Business Admin portal, statutory compliance requires your formal review and acceptance of our service agreements.');
            setShowOnboardingModal(true);
            return;
          }
        } catch {
          // fallback to login if parsing fails
        }
      }

      onLogin(resolvedRole);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptPolicy = () => {
    try {
      const userObj = JSON.parse(
        localStorage.getItem('orderup_user') ||
        localStorage.getItem('drinkhub_user') ||
        '{}'
      );
      const userKey = userObj.userUuid || userObj.id || userObj.email || 'admin';
      localStorage.setItem('orderup_policy_accepted_' + userKey, new Date().toISOString());
    } catch {
      localStorage.setItem('orderup_policy_accepted_admin', new Date().toISOString());
    }
    setShowOnboardingModal(false);
    onLogin(pendingRole || 'admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
      {/* ---- LOGIN FORM (centered) ---- */}
      <div className="w-full flex items-center justify-center p-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3 justify-center">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Wine className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>OrderUp</span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              Staff Portal
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Welcome back. Sign in to access your workspace.
            </p>
          </div>

          {/* Session Inactivity Timeout Notice */}
          {sessionExpiredMsg && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 shadow-sm animate-in fade-in transition-all duration-300">
              <div className="flex items-start gap-3">
                <Timer className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-extrabold block text-red-800">Session Expired</span>
                  <span className="text-red-700">{sessionExpiredMsg}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSessionExpiredMsg(null)}
                className="p-1 text-red-400 hover:text-red-700 hover:bg-red-100/60 rounded-lg transition-colors flex-shrink-0"
                title="Dismiss notice"
                aria-label="Dismiss notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick Demo Credentials Autofill Helper */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center justify-between font-semibold mb-2">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Quick Demo Credentials:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('langatlionel@gmail.com');
                  setPassword('Lionel123');
                  setError('');
                  setSessionExpiredMsg(null);
                }}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-blue-200 bg-white hover:bg-blue-100/60 font-semibold text-blue-900 transition shadow-sm text-[11px]"
              >
                <Shield className="h-3 w-3 text-blue-600" />
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('lionellangat2000@gmail.com');
                  setPassword('Langat123');
                  setError('');
                  setSessionExpiredMsg(null);
                }}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-blue-200 bg-white hover:bg-blue-100/60 font-semibold text-blue-900 transition shadow-sm text-[11px]"
              >
                <Briefcase className="h-3 w-3 text-blue-600" />
                Manager
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('llangat325@gmail.com');
                  setPassword('Jane1234');
                  setError('');
                  setSessionExpiredMsg(null);
                }}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-blue-200 bg-white hover:bg-blue-100/60 font-semibold text-blue-900 transition shadow-sm text-[11px]"
              >
                <User className="h-3 w-3 text-blue-600" />
                Waiter
              </button>
            </div>
          </div>

          {/* First-time login Password Change View */}
          {needsPasswordChange ? (
            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  🔒 Password Reset Required
                </div>
                <p>
                  You are logging in with a temporary password. Please set a secure permanent password to continue.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border px-3.5 py-2.5 pr-11 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button type="button" onClick={() => setShowNewPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 pt-1 text-[11px]">
                    <span className={newPassword.length >= 8 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {newPassword.length >= 8 ? '✓' : '○'} Min. 8 characters
                    </span>
                    <span className={/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {/[A-Z]/.test(newPassword) ? '✓' : '○'} Uppercase (A-Z)
                    </span>
                    <span className={/[a-z]/.test(newPassword) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {/[a-z]/.test(newPassword) ? '✓' : '○'} Lowercase (a-z)
                    </span>
                    <span className={/\d/.test(newPassword) ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      {/\d/.test(newPassword) ? '✓' : '○'} Number (0-9)
                    </span>
                    <span className={/[^A-Za-z0-9\s]/.test(newPassword) ? 'text-emerald-600 font-medium col-span-2' : 'text-slate-400 col-span-2'}>
                      {/[^A-Za-z0-9\s]/.test(newPassword) ? '✓' : '○'} Special symbol (!, @, #, $, etc.)
                    </span>
                  </div>
                )}
                {newPassword.length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    Must be at least 8 characters with uppercase, lowercase, numbers, and special symbols.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border px-3.5 py-2.5 pr-11 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    Update Password & Continue
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@orderup.co.ke"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (sessionExpiredMsg) setSessionExpiredMsg(null);
                  }}
                  autoComplete="email"
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
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (sessionExpiredMsg) setSessionExpiredMsg(null);
                    }}
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

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot Password?
                </button>
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
                    Sign In
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Business Admin Onboarding Compliance Modal ── */}
      <BusinessAdminOnboardingModal
        open={showOnboardingModal}
        businessName={(() => {
          try {
            const userObj = JSON.parse(
              localStorage.getItem('orderup_user') ||
              localStorage.getItem('drinkhub_user') ||
              '{}'
            );
            return userObj.business?.name || userObj.club?.name || '';
          } catch {
            return '';
          }
        })()}
        subtitle={onboardingSubtitle}
        onAccept={handleAcceptPolicy}
      />

      <PrivacyPolicyModal open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      <TermsAndConditionsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
};
