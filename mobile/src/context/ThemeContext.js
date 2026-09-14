import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDyslexiaEnabled } from '../utils/dyslexiaPatcher';
import i18n from '../i18n';

const THEME_KEY = 'moodle_mobile_theme_v2';
const DYSLEXIC_FONT_KEY = 'moodle_dyslexic_font';
const FONT_TYPE_KEY = 'moodle_font_type';
const ACCESSIBILITY_TOOLBAR_KEY = 'moodle_accessibility_toolbar';
const FONT_SIZE_MULTIPLIER_KEY = 'moodle_font_size_mult';
const HIGH_CONTRAST_KEY = 'moodle_high_contrast';

export const THEMES = {
  light: {
    mode: 'light',
    background: '#F0F4F8',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F6FA',
    card: '#FFFFFF',
    cardBorder: 'rgba(0, 79, 122, 0.12)',
    text: '#0F172A',
    textMuted: '#475569',
    textDim: '#64748B',
    primary: '#00AEEF',
    primaryDark: '#005686',
    primaryLight: '#38BDF8',
    primaryGradient: ['#00AEEF', '#005686'],
    navy: '#004F7A',
    unilearnGreen: '#8CB811',
    accent: '#8CB811',
    success: '#8CB811',
    successBg: '#F4F9E8',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    tabBarBg: '#FFFFFF',
    tabBarBorder: 'rgba(0, 79, 122, 0.1)',
    activeTab: '#00AEEF',
    inactiveTab: '#64748B',
    headerBg: '#004F7A',
    headerText: '#FFFFFF',
    badgeBg: '#E0F4FC',
  },
  dark: {
    mode: 'dark',
    background: '#071524',
    surface: '#0E2439',
    surfaceSubtle: '#091B2E',
    card: '#0E2439',
    cardBorder: 'rgba(0, 174, 239, 0.2)',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    textDim: '#64748B',
    primary: '#00AEEF',
    primaryDark: '#005686',
    primaryLight: '#38BDF8',
    primaryGradient: ['#00AEEF', '#0077B6'],
    navy: '#004F7A',
    unilearnGreen: '#8CB811',
    accent: '#8CB811',
    success: '#8CB811',
    successBg: 'rgba(140, 184, 17, 0.15)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    error: '#EF4444',
    errorBg: 'rgba(239, 68, 68, 0.15)',
    tabBarBg: '#071524',
    tabBarBorder: 'rgba(0, 174, 239, 0.15)',
    activeTab: '#00AEEF',
    inactiveTab: '#64748B',
    headerBg: '#004F7A',
    headerText: '#FFFFFF',
    badgeBg: 'rgba(0, 174, 239, 0.2)',
  },
  highContrast: {
    mode: 'highContrast',
    background: '#000000',
    surface: '#121212',
    surfaceSubtle: '#1E1E1E',
    card: '#000000',
    cardBorder: '#FFFF00',
    text: '#FFFFFF',
    textMuted: '#FFFF00',
    textDim: '#00FFFF',
    primary: '#FFFF00',
    primaryDark: '#FFD700',
    primaryLight: '#FFFF88',
    primaryGradient: ['#FFFF00', '#FFD700'],
    navy: '#000000',
    unilearnGreen: '#00FF00',
    accent: '#FFFF00',
    success: '#00FF00',
    successBg: '#003300',
    warning: '#FFA500',
    warningBg: '#332200',
    error: '#FF0000',
    errorBg: '#330000',
    tabBarBg: '#000000',
    tabBarBorder: '#FFFF00',
    activeTab: '#FFFF00',
    inactiveTab: '#FFFFFF',
    headerBg: '#000000',
    headerText: '#FFFF00',
    badgeBg: '#333300',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('light');
  const [fontType, setFontType] = useState('default'); // 'default' | 'dyslexic'
  const [showAccessibilityToolbar, setShowAccessibilityToolbar] = useState(false);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);
  const [readingRuler, setReadingRuler] = useState(false);

  // UI Modals / Drawer State
  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // Load saved preferences
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && (saved === 'dark' || saved === 'light')) {
        setThemeMode(saved);
      }
    });
    AsyncStorage.getItem(FONT_TYPE_KEY).then(saved => {
      if (saved === 'dyslexic' || saved === 'default') {
        setFontType(saved);
        setDyslexiaEnabled(saved === 'dyslexic', fontSizeMultiplier, i18n.language);
      } else {
        // Check legacy key
        AsyncStorage.getItem(DYSLEXIC_FONT_KEY).then(legacy => {
          if (legacy === 'true') {
            setFontType('dyslexic');
            setDyslexiaEnabled(true, fontSizeMultiplier, i18n.language);
          }
        });
      }
    });
    AsyncStorage.getItem(ACCESSIBILITY_TOOLBAR_KEY).then(saved => {
      if (saved === 'true') {
        setShowAccessibilityToolbar(true);
      }
    });
    AsyncStorage.getItem(FONT_SIZE_MULTIPLIER_KEY).then(saved => {
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val)) {
          setFontSizeMultiplier(val);
          setDyslexiaEnabled(fontType === 'dyslexic', val, i18n.language);
        }
      }
    });
    AsyncStorage.getItem(HIGH_CONTRAST_KEY).then(saved => {
      if (saved === 'true') setHighContrast(true);
    });

    const handleLangChange = (lng) => {
      setDyslexiaEnabled(fontType === 'dyslexic', fontSizeMultiplier, lng);
    };
    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, [fontType, fontSizeMultiplier]);

  const toggleTheme = async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const toggleDyslexicFont = async () => {
    const next = fontType === 'dyslexic' ? 'default' : 'dyslexic';
    setFontType(next);
    setDyslexiaEnabled(next === 'dyslexic', fontSizeMultiplier, i18n.language);
    await AsyncStorage.setItem(FONT_TYPE_KEY, next);
    await AsyncStorage.setItem(DYSLEXIC_FONT_KEY, next === 'dyslexic' ? 'true' : 'false');
  };

  const saveAccessibilitySettings = async (selectedFontType, enableToolbar) => {
    setFontType(selectedFontType);
    setShowAccessibilityToolbar(enableToolbar);
    setDyslexiaEnabled(selectedFontType === 'dyslexic', fontSizeMultiplier, i18n.language);
    await AsyncStorage.setItem(FONT_TYPE_KEY, selectedFontType);
    await AsyncStorage.setItem(DYSLEXIC_FONT_KEY, selectedFontType === 'dyslexic' ? 'true' : 'false');
    await AsyncStorage.setItem(ACCESSIBILITY_TOOLBAR_KEY, enableToolbar ? 'true' : 'false');
    setAccessibilityModalVisible(false);
  };

  const updateFontSizeMultiplier = async (mult) => {
    setFontSizeMultiplier(mult);
    setDyslexiaEnabled(fontType === 'dyslexic', mult, i18n.language);
    await AsyncStorage.setItem(FONT_SIZE_MULTIPLIER_KEY, mult.toString());
  };

  const toggleHighContrast = async () => {
    const next = !highContrast;
    setHighContrast(next);
    await AsyncStorage.setItem(HIGH_CONTRAST_KEY, next ? 'true' : 'false');
  };

  const toggleReadingRuler = () => {
    setReadingRuler(prev => !prev);
  };

  const resetAccessibility = async () => {
    setFontType('default');
    setShowAccessibilityToolbar(false);
    setFontSizeMultiplier(1.0);
    setHighContrast(false);
    setReadingRuler(false);
    await AsyncStorage.setItem(FONT_TYPE_KEY, 'default');
    await AsyncStorage.setItem(DYSLEXIC_FONT_KEY, 'false');
    await AsyncStorage.setItem(ACCESSIBILITY_TOOLBAR_KEY, 'false');
    await AsyncStorage.setItem(FONT_SIZE_MULTIPLIER_KEY, '1.0');
    await AsyncStorage.setItem(HIGH_CONTRAST_KEY, 'false');
  };

  const activeThemeKey = highContrast ? 'highContrast' : themeMode;
  const currentTheme = {
    ...THEMES[activeThemeKey],
    fontFamily: fontType === 'dyslexic' ? 'casual' : undefined,
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        themeMode,
        toggleTheme,
        isDark: themeMode === 'dark' && !highContrast,
        isDyslexic: fontType === 'dyslexic',
        fontType,
        setFontType,
        toggleDyslexicFont,
        showAccessibilityToolbar,
        setShowAccessibilityToolbar,
        fontSizeMultiplier,
        setFontSizeMultiplier: updateFontSizeMultiplier,
        highContrast,
        toggleHighContrast,
        readingRuler,
        toggleReadingRuler,
        saveAccessibilitySettings,
        resetAccessibility,
        accessibilityModalVisible,
        openAccessibilityModal: () => setAccessibilityModalVisible(true),
        closeAccessibilityModal: () => setAccessibilityModalVisible(false),
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        toggleDrawer: () => setDrawerOpen(prev => !prev),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
