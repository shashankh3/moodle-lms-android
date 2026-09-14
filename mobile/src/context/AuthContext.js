import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MobileAPI } from '../services/apiAdapter';
import { registerForPushNotificationsAsync, getDeviceInfo } from '../services/PushNotificationService';
import { storage } from '../services/storage/SecureStorage';
import { setAuthErrorHandler } from '../services/moodleClient';

const AUTH_USER_KEY = 'moodle_mobile_active_user_v2';
const AUTH_STATE_KEY = 'moodle_mobile_is_auth_v2';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-logout when Moodle reports the session token is invalid/expired.
  // Re-registered on each render so the closure always sees fresh logout.
  useEffect(() => {
    setAuthErrorHandler(() => {
      console.warn('[AuthContext] Moodle session token invalid — forcing logout');
      if (typeof logoutRef.current === 'function') logoutRef.current();
    });
    return () => setAuthErrorHandler(null);
  });

  useEffect(() => {
    async function loadAuth() {
      try {
        const isAuthStr = await storage.getItem(AUTH_STATE_KEY);
        const savedUser = await storage.getItem(AUTH_USER_KEY);
        if (isAuthStr === 'true' && savedUser) {
          const parsed = JSON.parse(savedUser);
          setCurrentUser(parsed);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Error loading real user profile:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  const loginWithMoodle = async (serverUrl, username, password, service = 'moodle_mobile_app') => {
    try {
      const res = await MobileAPI.loginWithMoodle(serverUrl, username, password, service);
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        await storage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        await storage.setItem(AUTH_STATE_KEY, 'true');

        setTimeout(async () => {
          try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              const info = getDeviceInfo();
              await MobileAPI.registerPushDevice(token, info.uuid, info.platform, info.model);
            }
          } catch (e) {
            console.log('Push registration error:', e);
          }
        }, 1000);

        return { success: true, user: res.user, siteInfo: res.siteInfo };
      }
      return { success: false, error: 'Could not connect to Moodle instance' };
    } catch (e) {
      return { success: false, error: e.message || 'Moodle connection error' };
    }
  };

  const loginWithToken = async (serverUrl, token, privatetoken = '') => {
    try {
      const res = await MobileAPI.loginWithToken(serverUrl, token, privatetoken);
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        await storage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        await storage.setItem(AUTH_STATE_KEY, 'true');

        setTimeout(async () => {
          try {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) {
              const info = getDeviceInfo();
              await MobileAPI.registerPushDevice(pushToken, info.uuid, info.platform, info.model);
            }
          } catch (e) {
            console.log('Push registration error:', e);
          }
        }, 1000);

        return { success: true, user: res.user, siteInfo: res.siteInfo };
      }
      return { success: false, error: res.error || 'Could not validate token' };
    } catch (e) {
      return { success: false, error: e.message || 'Moodle connection error' };
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    await storage.removeItem(AUTH_STATE_KEY);
    await storage.removeItem(AUTH_USER_KEY);
    await MobileAPI.resetToDefaults();
  };

  // Keep the auth-error handler pointed at the latest logout implementation
  const logoutRef = useRef(null);
  useEffect(() => {
    logoutRef.current = logout;
  });

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        loginWithMoodle,
        loginWithToken,
        logout,
        isStudent: currentUser?.role === 'student',
        isTeacher: currentUser?.role === 'editingteacher' || currentUser?.role === 'teacher',
        isAdmin: currentUser?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
