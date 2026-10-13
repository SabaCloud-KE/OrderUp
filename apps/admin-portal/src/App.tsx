import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
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

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const token =
        localStorage.getItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN) ||
        localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
      const userStr = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
      const loginTimeStr = localStorage.getItem(AUTH_STORAGE_KEYS.LOGIN_TIME);
      const loginTimeMs = loginTimeStr ? parseInt(loginTimeStr, 10) : null;
      const lastActivityMs = getLastActivityTime(false);

      if (token && userStr) {
        // 1. Inactivity Timeout Check (20-minute idle limit)
        if (isIdleExpired(lastActivityMs)) {
          setSessionExpiredNotice(
            'Your Super Admin session has expired due to 20 minutes of inactivity. Please log in again.'
          );
          clearAllAuthData();
          return false;
        }

        const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
        if ((isJwtExpired(token) && !refreshToken) || isSessionExpired(loginTimeMs, MAX_SESSION_MS)) {
          clearAllAuthData();
          return false;
        }

        const user = JSON.parse(userStr);
        // Exclusively allow SUPER_ADMIN — any other role (including legacy/invalid) clears auth
        if (user.role !== 'SUPER_ADMIN') {
          clearAllAuthData();
          return false;
        }
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  });

  const handleLogout = useCallback(() => {
    clearAllAuthData();
    setIsAuthenticated(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

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
      // offline/network error
    }
    return false;
  }, []);

  const {
    idleWarning,
    countdownFormatted,
    stayActive,
    logoutNow,
  } = useSessionTimeout({
    isAuthenticated,
    onLogout: handleLogout,
    roleName: 'Super Admin',
    onRefreshToken: tryRefreshToken,
    expiredMessage: 'Your Super Admin session has expired due to 20 minutes of inactivity. Please log in again.',
  });

  if (!isAuthenticated) {
    return <AdminLoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <SessionTimeoutBanner
        show={idleWarning}
        countdownFormatted={countdownFormatted}
        roleName="Super Admin"
        onStayLoggedIn={stayActive}
        onLogoutNow={logoutNow}
      />
      <Routes>
        <Route path="/admin/dashboard" element={<AdminDashboard onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

