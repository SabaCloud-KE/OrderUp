import React, { useState } from 'react';
import { Wine, Eye, EyeOff, ChevronRight, Loader2, User, Briefcase, Shield, Timer } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { getSessionExpiredNotice } from '@orderup/shared';
import { PrivacyPolicyModal, TermsAndConditionsModal, BusinessAdminOnboardingModal } from '../components/LegalModals';

type StaffRole = 'waiter' | 'manager' | 'admin';

interface LoginPageProps {
  onLogin: (role: StaffRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [role, setRole] = useState<StaffRole>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const r = (params.get('role') || '').toLowerCase();
      if (r === 'waiter' || r === 'manager' || r === 'admin') return r;
    } catch {}
    return 'admin';
  });
  const [username, setUsername] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || params.get('username') || '';
    } catch {}
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpiredMsg] = useState<string | null>(() => getSessionExpiredNotice());

  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
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

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Please enter your username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanUser, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const msg = data.error?.message || data.message || 'Invalid credentials. Please check your username and password.';
        throw new Error(msg);
      }

      const userRole = (data.data?.user?.role || '').toUpperCase();
      let targetRole: StaffRole = role;

      if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
        targetRole = (role === 'manager' || role === 'waiter') ? role : 'admin';
      } else if (userRole === 'MANAGER') {
        targetRole = 'manager';
      } else if (userRole === 'WAITER') {
        targetRole = 'waiter';
      } else {
        throw new Error(`Access denied. Account role "${userRole}" is not permitted on the staff portal.`);
      }

      setRole(targetRole);

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

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
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
      if (role === 'admin') {
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
            setPendingRole(role);
            setOnboardingSubtitle('Your temporary password has been successfully updated! Before accessing your Business Admin portal, statutory compliance requires your formal review and acceptance of our service agreements.');
            setShowOnboardingModal(true);
            return;
          }
        } catch {
          // fallback to login if parsing fails
        }
      }

      onLogin(role);
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
    onLogin(pendingRole || role);
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
            <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 shadow-sm animate-in fade-in">
              <Timer className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-extrabold block text-red-800">Session Expired</span>
                <span className="text-red-700">{sessionExpiredMsg}</span>
              </div>
            </div>
          )}

          {/* Role Selector */}
          <div className="rounded-xl p-1 flex gap-1 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {(['admin', 'manager', 'waiter'] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setError('');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200"
                style={{
                  background: role === r ? '#2563EB' : 'transparent',
                  color: role === r ? '#FFFFFF' : 'var(--text-secondary)',
                }}
              >
                {r === 'admin' ? <Shield className="h-3.5 w-3.5" /> : r === 'manager' ? <Briefcase className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {r === 'admin' ? 'Admin (Owner)' : r === 'manager' ? 'Manager' : 'Waiter'}
              </button>
            ))}
          </div>

          {/* Demo Account Hint */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
            <div className="flex items-center justify-between font-semibold mb-1">
              <span>
                Demo {role === 'admin' ? 'Business Admin' : role === 'manager' ? 'Manager' : 'Waiter'}:
              </span>
              <button
                type="button"
                onClick={() => {
                  if (role === 'admin') {
                    setUsername('john123@gmail.com');
                    setPassword('john1234');
                  } else if (role === 'manager') {
                    setUsername('tonnykim@gmail.com');
                    setPassword('Tonny1234');
                  } else {
                    setUsername('jane@gmail.com');
                    setPassword('Jane1234');
                  }
                }}
                className="text-blue-600 hover:underline font-bold"
              >
                Auto-fill ⚡
              </button>
            </div>
            <p className="text-[11px] text-blue-700">
              {role === 'admin'
                ? 'john123@gmail.com / john1234 (Admin)'
                : role === 'manager'
                ? 'tonnykim@gmail.com / Tonny1234 (Manager)'
                : 'jane@gmail.com / Jane1234 (Waiter)'}
            </p>
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
                  Username
                </label>
                <input
                  type="text"
                  placeholder={role === 'waiter' ? 'e.g. waiter.jane' : 'e.g. manager.john'}
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
                    placeholder="••••••••••"
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
                    Sign In as {role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Waiter'}
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
