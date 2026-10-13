/**
 * Security & Session Timeout Utilities
 * Shared across server, staff-portal, admin-portal, client, and customer-pwa.
 */

export const IDLE_TIMEOUT_MS = 20 * 60 * 1000;       // 20 minutes idle timeout
export const WARN_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // warn 2 minutes before timeout
export const MAX_SESSION_MS = 24 * 60 * 60 * 1000;   // 24 hours max session (full day shift)

export const DEFAULT_SESSION_EXPIRED_MSG =
  'Your session has expired due to 20 minutes of inactivity. Please log in again.';

export const AUTH_STORAGE_KEYS = {
  TOKEN: 'orderup_token',
  ADMIN_TOKEN: 'orderup_admin_token',
  REFRESH_TOKEN: 'orderup_refresh_token',
  USER: 'orderup_user',
  LOGIN_TIME: 'orderup_login_time',
  LAST_ACTIVITY: 'orderup_last_activity',
  LOGOUT_EVENT: 'orderup_logout_event',
  SESSION_EXPIRED: 'orderup_session_expired',
  CLIENT_ACCESS_TOKEN: 'accessToken',
  CLIENT_USER: 'user',
} as const;

/**
 * Safely parses JWT payload in browser/Node without external libraries.
 */
export function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT access token is expired or about to expire within bufferMs.
 * Returns false if token is a demo/opaque string (not a 3-part JWT with exp claim).
 */
export function isJwtExpired(token: string | null | undefined, bufferMs = 5000): boolean {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  // If token is not a 3-part JWT with exp claim (e.g. demo token), do not treat as expired
  if (!payload || !payload.exp) return false;
  const expiresAtMs = payload.exp * 1000;
  return expiresAtMs - bufferMs <= Date.now();
}

/**
 * Returns remaining milliseconds before JWT expires.
 */
export function getTokenRemainingTime(token: string | null | undefined): number {
  if (!token) return 0;
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

/**
 * Checks if the total session time exceeds absolute maximum lifetime (e.g. 24h shift).
 */
export function isSessionExpired(loginTimeMs: number | null | undefined, maxSessionMs = MAX_SESSION_MS): boolean {
  if (!loginTimeMs) return false;
  return Date.now() - loginTimeMs >= maxSessionMs;
}

/**
 * Checks if idle inactivity exceeds the idle threshold (defaults to 20 minutes).
 */
export function isIdleExpired(lastActivityMs: number | null | undefined, idleTimeoutMs = IDLE_TIMEOUT_MS): boolean {
  if (!lastActivityMs || lastActivityMs <= 0) return false;
  return Date.now() - lastActivityMs >= idleTimeoutMs;
}

/**
 * Records user activity timestamp in localStorage to synchronize activity across tabs.
 */
export function recordUserActivity(customTimestamp?: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const time = customTimestamp ?? Date.now();
    window.localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, String(time));
  } catch {
    /* ignore localStorage exceptions (e.g. private mode quota) */
  }
}

/**
 * Retrieves the last recorded user activity timestamp from localStorage.
 */
export function getLastActivityTime(defaultToNow = true): number {
  if (typeof window === 'undefined' || !window.localStorage) return defaultToNow ? Date.now() : 0;
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY) || window.localStorage.getItem('drinkhub_last_activity');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultToNow ? Date.now() : 0;
}

/**
 * Stores a session expired flash message for display on the login page.
 */
export function setSessionExpiredNotice(message = DEFAULT_SESSION_EXPIRED_MSG): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION_EXPIRED, message);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Retrieves and consumes any pending session expired flash message.
 */
export function getSessionExpiredNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.sessionStorage) {
      const notice =
        window.sessionStorage.getItem(AUTH_STORAGE_KEYS.SESSION_EXPIRED) ||
        window.sessionStorage.getItem('drinkhub_session_expired');
      if (notice) {
        window.sessionStorage.removeItem(AUTH_STORAGE_KEYS.SESSION_EXPIRED);
        window.sessionStorage.removeItem('drinkhub_session_expired');
        return notice;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Thoroughly clears all authentication tokens, session data, and user info from storage.
 */
export function clearAllAuthData(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.LOGIN_TIME);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.CLIENT_ACCESS_TOKEN);
      window.localStorage.removeItem(AUTH_STORAGE_KEYS.CLIENT_USER);

      // Clean up any legacy keys
      window.localStorage.removeItem('drinkhub_token');
      window.localStorage.removeItem('drinkhub_admin_token');
      window.localStorage.removeItem('drinkhub_refresh_token');
      window.localStorage.removeItem('drinkhub_user');
      window.localStorage.removeItem('drinkhub_login_time');
      window.localStorage.removeItem('drinkhub_last_activity');
    }
  } catch {
    /* ignore */
  }
}
