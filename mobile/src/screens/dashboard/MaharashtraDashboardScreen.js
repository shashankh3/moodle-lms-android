import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, RotateCw, ShieldCheck, ExternalLink } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function MaharashtraDashboardScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  // Hardware back press handler on Android
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      navigation.goBack();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [canGoBack, navigation]);

  // Injected CSS for clean mobile responsive display of the Maharashtra state dashboard
  const injectedCss = `
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=2.0';
    document.getElementsByTagName('head')[0].appendChild(meta);
    const style = document.createElement('style');
    style.innerHTML = \`
      body { -webkit-text-size-adjust: 100%; }
      .container, .container-fluid { width: 100% !important; padding-left: 8px !important; padding-right: 8px !important; }
    \`;
    document.head.appendChild(style);
    true;
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.headerBg || '#004F7A' }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg || '#004F7A' }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (canGoBack && webViewRef.current) {
              webViewRef.current.goBack();
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <ShieldCheck size={16} color="#38BDF8" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            MAHARASHTRA DASHBOARD
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => webViewRef.current?.reload()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <RotateCw size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main WebView Content */}
      <View style={styles.webviewWrap}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://mh.unilearn.org.in/dashboard/' }}
          injectedJavaScript={injectedCss}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
        />

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#00AEEF" />
            <Text style={styles.loadingText}>Loading Maharashtra Dashboard...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#004F7A',
  },
});
