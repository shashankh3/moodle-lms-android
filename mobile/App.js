import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import OfficialDrawer from './src/components/OfficialDrawer';
import AccessibilitySettingsModal from './src/components/AccessibilitySettingsModal';
import AccessibilityToolbar from './src/components/AccessibilityToolbar';
import { useFonts } from 'expo-font';
import { initGlobalDyslexiaPatcher, subscribeDyslexiaState } from './src/utils/dyslexiaPatcher';
import './src/i18n';
import { NetworkMonitor } from './src/services/NetworkMonitor';

// Initialize offline sync monitor (Phase 3 — syncs queued SCORM tracks on reconnect)
NetworkMonitor.initialize();

// Initialize the global typography interceptor once at app startup
initGlobalDyslexiaPatcher();

export { navigationRef };

function MainApp() {
  const { theme, isDark } = useTheme();
  const [dyslexiaKey, setDyslexiaKey] = useState(0);

  // Subscribe to font changes to trigger an immediate full tree re-render
  useEffect(() => {
    const unsubscribe = subscribeDyslexiaState(() => {
      setDyslexiaKey((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider style={[styles.rootContainer, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg || theme.background} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
        <View key={`dyslexia-tree-${dyslexiaKey}`} style={[styles.appWrapper, { backgroundColor: theme.background }]}>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>

          {/* Global Official Sidebar Drawer */}
          <OfficialDrawer navigation={navigationRef} />

          {/* Global Official Accessibility Modal */}
          <AccessibilitySettingsModal />

          {/* Floating Accessibility Toolbar */}
          <AccessibilityToolbar />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'OpenDyslexic': require('./assets/fonts/OpenDyslexic-Regular.otf'),
    'OpenDyslexic-Bold': require('./assets/fonts/OpenDyslexic-Bold.otf'),
    'OpenDyslexic-Italic': require('./assets/fonts/OpenDyslexic-Italic.otf'),
    'Kalam': require('./assets/fonts/Kalam-Regular.ttf'),
    'Kalam-Bold': require('./assets/fonts/Kalam-Bold.ttf'),
    'Baloo2': require('./assets/fonts/Baloo2-Variable.ttf'),
    'Mukta': require('./assets/fonts/Mukta-Regular.ttf'),
    'Mukta-Bold': require('./assets/fonts/Mukta-Bold.ttf'),
  });

  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  appWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
