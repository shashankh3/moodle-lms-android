import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileAPI } from '../services/apiAdapter';

const AUTH_USER_KEY = 'moodle_mobile_active_user_v2';
const AUTH_STATE_KEY = 'moodle_mobile_is_auth_v2';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const isAuthStr = await AsyncStorage.getItem(AUTH_STATE_KEY);
        const savedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
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
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        await AsyncStorage.setItem(AUTH_STATE_KEY, 'true');
        return { success: true, user: res.user, siteInfo: res.siteInfo };
      }
      return { success: false, error: 'Could not connect to Moodle instance' };
    } catch (e) {
      return { success: false, error: e.message || 'Moodle connection error' };
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    await AsyncStorage.removeItem(AUTH_STATE_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    await MobileAPI.resetToDefaults();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        loginWithMoodle,
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
