import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { WaiterDashboard } from './pages/WaiterDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  isJwtExpired,
  isSessionExpired,
  isIdleExpired,
  getLastActivityTime,
  setSessionExpiredNotice,
  MAX_SESSION_MS,
  AUTH_STORAGE_KEYS,
  clearAllAuthData,
} from '@orderup/shared';
import { useSessionTimeout, SessionTimeoutBanner } from '@orderup/ui';
import { getApiUrl } from './config/api';

type StaffRole = 'waiter' | 'manager' | 'admin';
interface Session {
  role: StaffRole;
}

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const token = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
      const userStr = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
      const loginTimeStr = localStorage.getItem(AUTH_STORAGE_KEYS.LOGIN_TIME);
      const loginTimeMs = loginTimeStr ? parseInt(loginTimeStr, 10) : null;
      const lastActivityMs = getLastActivityTime(false);

      if (token && userStr) {
        // 1. Inactivity Timeout Check (20-minute idle limit)
        if (isIdleExpired(lastActivityMs)) {
          try {
            const user = JSON.parse(userStr);
            const r = (user.role || '').toUpperCase();
            const rName = r === 'ADMIN' ? 'Admin (Owner)' : r === 'WAITER' ? 'Waiter' : 'Manager';
            setSessionExpiredNotice(
              `Your ${rName} session has expired due to 20 minutes of inactivity. Please log in again.`
            );
          } catch {
            setSessionExpiredNotice();
          }
          clearAllAuthData();
          return null;
        }

        // 2. Token / Shift Expiry Check
        const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
        if ((isJwtExpired(token) && !refreshToken) || isSessionExpired(loginTimeMs, MAX_SESSION_MS)) {
          clearAllAuthData();
          return null;
        }

        const user = JSON.parse(userStr);
        const role = (user.role || '').toUpperCase();
        if (role === 'WAITER') return { role: 'waiter' };
        if (role === 'ADMIN' || role === 'CLUB_ADMIN' || role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') return { role: 'admin' };
        if (role === 'MANAGER') return { role: 'manager' };

        // Reject any other role (deprecated, customer, invalid, or unknown) — clear stale state
        clearAllAuthData();
        return null;
      }
    } catch {
      /* ignore parse error */
    }
    return null;
  });

  const handleLogout = useCallback(() => {
    clearAllAuthData();
    setSession(null);
  }, []);

  const handleLogin = (role: StaffRole) => {
    setSession({ role });
  };

  // Helper for silent background token refresh
  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return false;

    try {
      const res = await fetch(getApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.data?.accessToken) {
        localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.data.refreshToken);
        }
        return true;
      }
    } catch {
      // Refresh failed (offline/network glitch) - keep local session active
    }
    return false;
  }, []);

  const currentRoleName =
    session?.role === 'admin' ? 'Admin (Owner)' : session?.role === 'waiter' ? 'Waiter' : 'Manager';

  const {
    idleWarning,
    countdownFormatted,
    stayActive,
    logoutNow,
  } = useSessionTimeout({
    isAuthenticated: !!session,
    onLogout: handleLogout,
    roleName: currentRoleName,
    onRefreshToken: tryRefreshToken,
    expiredMessage: `Your ${currentRoleName} session has expired due to 20 minutes of inactivity. Please log in again.`,
  });

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      {/* ── 20-min Idle Session Warning Banner ── */}
      <SessionTimeoutBanner
        show={idleWarning}
        countdownFormatted={countdownFormatted}
        roleName={currentRoleName}
        onStayLoggedIn={stayActive}
        onLogoutNow={logoutNow}
      />
      <ErrorBoundary>
        <Routes>
          {session.role === 'admin' && (
            <>
              <Route path="/admin/dashboard" element={<AdminDashboard onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </>
          )}
          {session.role === 'waiter' && (
            <>
              <Route path="/waiter/dashboard" element={<WaiterDashboard onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/waiter/dashboard" replace />} />
            </>
          )}
          {session.role === 'manager' && (
            <>
              <Route path="/manager/dashboard" element={<ManagerDashboard onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
            </>
          )}
        </Routes>
      </ErrorBoundary>
    </Router>
  );
};

export default App;

