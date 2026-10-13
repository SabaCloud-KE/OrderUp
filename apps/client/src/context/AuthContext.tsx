import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  isJwtExpired,
  isSessionExpired,
  MAX_SESSION_MS,
  AUTH_STORAGE_KEYS,
  clearAllAuthData,
  isValidRole,
} from '@orderup/shared';
import { useSessionTimeout, SessionTimeoutBanner } from '@orderup/ui';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  stayActive: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser =
        localStorage.getItem(AUTH_STORAGE_KEYS.CLIENT_USER) ||
        localStorage.getItem(AUTH_STORAGE_KEYS.USER);
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      if (!isValidRole(parsed?.role)) {
        clearAllAuthData();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      const savedToken =
        localStorage.getItem(AUTH_STORAGE_KEYS.CLIENT_ACCESS_TOKEN) ||
        localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
      const loginTimeStr = localStorage.getItem(AUTH_STORAGE_KEYS.LOGIN_TIME);
      const loginTimeMs = loginTimeStr ? parseInt(loginTimeStr, 10) : null;

      if (savedToken) {
        if (isJwtExpired(savedToken) || isSessionExpired(loginTimeMs, MAX_SESSION_MS)) {
          clearAllAuthData();
          return null;
        }
        return savedToken;
      }
    } catch {
      /* ignore */
    }
    return null;
  });

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearAllAuthData();
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    try {
      localStorage.setItem(AUTH_STORAGE_KEYS.CLIENT_ACCESS_TOKEN, newToken);
      localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, newToken);
      localStorage.setItem(AUTH_STORAGE_KEYS.CLIENT_USER, JSON.stringify(newUser));
      localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(newUser));
      localStorage.setItem(AUTH_STORAGE_KEYS.LOGIN_TIME, Date.now().toString());
    } catch {
      /* ignore storage quota */
    }
  }, []);

  const userRoleLabel =
    user?.role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : user?.role === 'WAITER'
      ? 'Waiter'
      : user?.role === 'MANAGER'
      ? 'Manager'
      : user?.role === 'ADMIN'
      ? 'Business Admin'
      : user?.role
      ? user.role
      : 'Staff';

  const {
    idleWarning,
    countdownFormatted,
    stayActive,
    logoutNow,
  } = useSessionTimeout({
    isAuthenticated: !!token,
    onLogout: logout,
    roleName: userRoleLabel,
    expiredMessage: `Your ${userRoleLabel} session has expired due to 20 minutes of inactivity. Please log in again.`,
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        stayActive,
      }}
    >
      <SessionTimeoutBanner
        show={idleWarning}
        countdownFormatted={countdownFormatted}
        roleName={userRoleLabel}
        onStayLoggedIn={stayActive}
        onLogoutNow={logoutNow}
      />
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

