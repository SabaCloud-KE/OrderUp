import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IDLE_TIMEOUT_MS,
  WARN_BEFORE_TIMEOUT_MS,
  MAX_SESSION_MS,
  AUTH_STORAGE_KEYS,
  recordUserActivity,
  getLastActivityTime,
  setSessionExpiredNotice,
  clearAllAuthData,
  isSessionExpired,
  getTokenRemainingTime,
  isJwtExpired,
} from '@orderup/shared';

export interface UseSessionTimeoutOptions {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Callback triggered when session expires or user clicks Logout Now */
  onLogout: () => void;
  /** Inactivity threshold in ms (defaults to 20 minutes) */
  idleTimeoutMs?: number;
  /** Advance warning window in ms (defaults to 2 minutes) */
  warnBeforeMs?: number;
  /** Absolute session cap in ms (defaults to 24 hours) */
  maxSessionMs?: number;
  /** Role label for UI warning displays, e.g. 'Platform Admin', 'Manager', 'Waiter' */
  roleName?: string;
  /** Proactive token refresh handler if JWT is near expiry */
  onRefreshToken?: () => Promise<boolean>;
  /** Optional custom session expiration message */
  expiredMessage?: string;
}

export interface UseSessionTimeoutReturn {
  /** True when inactivity warning is active (within warnBeforeMs of timeout) */
  idleWarning: boolean;
  /** Seconds remaining before automatic logout */
  countdownSeconds: number;
  /** Formatted MM:SS string for countdown */
  countdownFormatted: string;
  /** Resets the 20-minute idle timer, broadcasting activity to other tabs */
  stayActive: () => void;
  /** Immediately logs out and clears all session data */
  logoutNow: () => void;
  /** Role name passed in or default */
  roleName: string;
}

export function useSessionTimeout({
  isAuthenticated,
  onLogout,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  warnBeforeMs = WARN_BEFORE_TIMEOUT_MS,
  maxSessionMs = MAX_SESSION_MS,
  roleName = 'Staff',
  onRefreshToken,
  expiredMessage,
}: UseSessionTimeoutOptions): UseSessionTimeoutReturn {
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  const lastActivityRef = useRef<number>(Date.now());
  const lastBroadcastRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);

  const triggerLogout = useCallback(
    (reason: 'timeout' | 'manual' | 'max_session' | 'cross_tab' = 'timeout') => {
      if (reason === 'timeout' || reason === 'max_session') {
        setSessionExpiredNotice(
          expiredMessage ||
            (reason === 'max_session'
              ? 'Your maximum session shift (24 hours) has ended. Please log in again.'
              : 'Your session has expired due to 20 minutes of inactivity. Please log in again.')
        );
      }

      // Broadcast logout event to close other open browser tabs
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(AUTH_STORAGE_KEYS.LOGOUT_EVENT, String(Date.now()));
        }
      } catch {
        /* ignore */
      }

      clearAllAuthData();
      setIdleWarning(false);
      setCountdownSeconds(0);
      onLogout();
    },
    [onLogout, expiredMessage]
  );

  // Synchronize initial last activity from storage on mount
  useEffect(() => {
    if (isAuthenticated) {
      const storedLast = getLastActivityTime(false);
      const now = Date.now();
      if (storedLast > 0 && now - storedLast >= idleTimeoutMs) {
        triggerLogout('timeout');
        return;
      }
      lastActivityRef.current = storedLast > 0 ? storedLast : now;
      recordUserActivity(lastActivityRef.current);
    }
  }, [isAuthenticated, idleTimeoutMs, triggerLogout]);

  const stayActive = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    recordUserActivity(now);
    setIdleWarning(false);
    setCountdownSeconds(0);

    // If a refresh handler is available, trigger a silent heartbeat
    if (onRefreshToken && !isRefreshingRef.current) {
      isRefreshingRef.current = true;
      Promise.resolve(onRefreshToken()).finally(() => {
        isRefreshingRef.current = false;
      });
    }
  }, [onRefreshToken]);

  // 1. User Activity Listener — resets idle timer on user interaction
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      const now = Date.now();
      // If idle time already reached 20 minutes before this event, user activity
      // must NOT resurrect the expired session — trigger logout immediately!
      if (now - lastActivityRef.current >= idleTimeoutMs) {
        triggerLogout('timeout');
        return;
      }

      lastActivityRef.current = now;

      // Throttle cross-tab localStorage broadcast to once per second
      if (now - lastBroadcastRef.current > 1000) {
        lastBroadcastRef.current = now;
        recordUserActivity(now);
      }

      if (idleWarning) {
        setIdleWarning(false);
      }
    };

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'keypress',
      'click',
      'scroll',
      'touchstart',
      'touchmove',
      'pointerdown',
      'focus',
      'wheel',
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const storedLast = getLastActivityTime(false);
        if (
          now - lastActivityRef.current >= idleTimeoutMs ||
          (storedLast > 0 && now - storedLast >= idleTimeoutMs)
        ) {
          triggerLogout('timeout');
          return;
        }
        if (storedLast > lastActivityRef.current) {
          lastActivityRef.current = storedLast;
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cross-tab synchronization via storage events
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEYS.LAST_ACTIVITY && e.newValue) {
        const remoteLast = parseInt(e.newValue, 10);
        if (!isNaN(remoteLast) && remoteLast > lastActivityRef.current) {
          lastActivityRef.current = remoteLast;
          setIdleWarning(false);
        }
      } else if (e.key === AUTH_STORAGE_KEYS.LOGOUT_EVENT) {
        triggerLogout('cross_tab');
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
        document.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [isAuthenticated, idleWarning, triggerLogout]);

  // 2. High-precision 1-second Interval Audit
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      const now = Date.now();

      // Check cross-tab activity in case events were fired in another window
      const storedLast = getLastActivityTime();
      if (storedLast > lastActivityRef.current) {
        lastActivityRef.current = storedLast;
      }

      const idleMs = now - lastActivityRef.current;
      const timeUntilTimeout = idleTimeoutMs - idleMs;

      // Check A: 20-minute idle inactivity timeout reached
      if (idleMs >= idleTimeoutMs) {
        triggerLogout('timeout');
        return;
      }

      // Check B: Maximum shift lifetime (24 hours)
      const loginTimeStr = typeof window !== 'undefined' ? window.localStorage?.getItem(AUTH_STORAGE_KEYS.LOGIN_TIME) : null;
      const loginTimeMs = loginTimeStr ? parseInt(loginTimeStr, 10) : null;
      if (loginTimeMs && isSessionExpired(loginTimeMs, maxSessionMs)) {
        triggerLogout('max_session');
        return;
      }

      // Check C: Proactive Token Expiration & Refresh
      const token =
        typeof window !== 'undefined'
          ? window.localStorage?.getItem(AUTH_STORAGE_KEYS.TOKEN) ||
            window.localStorage?.getItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN) ||
            window.localStorage?.getItem(AUTH_STORAGE_KEYS.CLIENT_ACCESS_TOKEN)
          : null;

      if (token && onRefreshToken && !isRefreshingRef.current) {
        const remainingMs = getTokenRemainingTime(token);
        const expired = isJwtExpired(token);

        if (expired || (remainingMs > 0 && remainingMs < 10 * 60 * 1000)) {
          isRefreshingRef.current = true;
          try {
            const refreshed = await onRefreshToken();
            if (!refreshed && expired) {
              triggerLogout('timeout');
              return;
            }
          } finally {
            isRefreshingRef.current = false;
          }
        }
      }

      // Check D: 2-minute warning countdown
      if (timeUntilTimeout <= warnBeforeMs) {
        setIdleWarning(true);
        const remainingSec = Math.max(0, Math.ceil(timeUntilTimeout / 1000));
        setCountdownSeconds(remainingSec);
      } else {
        if (idleWarning) {
          setIdleWarning(false);
          setCountdownSeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, idleTimeoutMs, warnBeforeMs, maxSessionMs, onRefreshToken, idleWarning, triggerLogout]);

  const mins = Math.floor(countdownSeconds / 60);
  const secs = String(countdownSeconds % 60).padStart(2, '0');
  const countdownFormatted = `${mins}:${secs}`;

  return {
    idleWarning,
    countdownSeconds,
    countdownFormatted,
    stayActive,
    logoutNow: () => triggerLogout('manual'),
    roleName,
  };
}
