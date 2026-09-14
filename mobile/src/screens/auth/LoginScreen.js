import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  ImageBackground,
  Modal,
  BackHandler,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import UniLearnLogo from '../../components/UniLearnLogo';
import UnicefUnBanner from '../../components/UnicefUnBanner';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ChevronDown,
  HelpCircle,
  Mail,
  MessageCircle,
  Check,
  Globe,
  Settings,
  ArrowLeft,
  X,
  RotateCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { loginWithMoodle } = useAuth();
  const { t, i18n } = useTranslation();

  const [serverUrl, setServerUrl] = useState('https://mh.unilearn.org.in');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState(null);
  const [browserModal, setBrowserModal] = useState({ visible: false, url: '', title: '' });
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(false);
  const webViewRef = useRef(null);

  const openInAppBrowser = (url, title = 'Web Page') => {
    setBrowserModal({ visible: true, url, title });
  };

  const closeInAppBrowser = () => {
    setBrowserModal({ visible: false, url: '', title: '' });
  };

  useEffect(() => {
    if (!browserModal.visible) return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      closeInAppBrowser();
      return true; // Intercept hardware back press so Expo Go does NOT exit
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [browserModal.visible, canGoBack]);

  const currentLangLabel =
    i18n.language === 'mr'
      ? 'मराठी (mr)'
      : i18n.language === 'hi'
      ? 'हिन्दी (hi)'
      : 'English (en)';

  const handleLogin = async () => {
    if (!username.trim()) {
      setErrorMessage(t('enter_username_error'));
      return;
    }
    if (!password) {
      setErrorMessage(t('enter_password_error'));
      return;
    }

    setErrorMessage('');
    setLoading(true);
    const res = await loginWithMoodle(serverUrl.trim() || 'https://mh.unilearn.org.in', username.trim(), password);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials or connection error. Please verify your username and password.');
    }
  };

  const handleForgotPassword = () => {
    setResetIdentifier(username || '');
    setResetStatus(null);
    setForgotModalVisible(true);
  };

  const handleSendResetLink = async () => {
    if (!resetIdentifier.trim()) {
      setResetStatus({
        success: false,
        message: 'Please enter your username or registered email address.'
      });
      return;
    }
    setResetLoading(true);
    setResetStatus(null);
    try {
      const cleanUrl = (serverUrl.trim() || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
      const formBody = new URLSearchParams();
      if (resetIdentifier.includes('@')) {
        formBody.append('email', resetIdentifier.trim());
      } else {
        formBody.append('username', resetIdentifier.trim());
      }
      await fetch(`${cleanUrl}/login/forgot_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });
      setResetStatus({
        success: true,
        message: 'If your account exists in the Moodle system, an email has been sent with instructions on how to reset your password.'
      });
    } catch (e) {
      setResetStatus({
        success: false,
        message: 'Could not connect to the Moodle server. Please check your network connection.'
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200' }}
        style={styles.bgImage}
        resizeMode="cover"
      >
        {/* Subtle Dark / Blue Tint Overlay */}
        <View style={styles.overlay} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Bar: Language Dropdown Pill */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.langPill}
              onPress={() => setLangModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.langText}>{currentLangLabel}</Text>
              <ChevronDown size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Main White Card matching Screenshot */}
          <View style={styles.card}>
            {/* Card Header with UNIlearn Logo & MAHARASHTRA DASHBOARD */}
            <View style={styles.cardHeader}>
              <UniLearnLogo
                size={38}
                showMaharashtra={true}
              />
            </View>

            {/* Log in Heading */}
            <Text style={styles.loginTitle}>{t('login_title')}</Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Username / Email Input */}
            <View style={styles.inputGroup}>
              <User size={18} color="#1E293B" style={styles.inputIcon} />
              <TextInput
                style={styles.underlinedInput}
                placeholder={t('username_placeholder')}
                placeholderTextColor="#64748B"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage) setErrorMessage('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.passwordGroup}>
              <Lock size={18} color="#1E293B" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder={t('password_placeholder')}
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#64748B" />
                ) : (
                  <Eye size={18} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Check size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>{t('remember_me')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>{t('forgot_password')}</Text>
              </TouchableOpacity>
            </View>

            {/* Log in Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>{t('login_title')}</Text>
              )}
            </TouchableOpacity>

            {/* Bottom Card Strip: Cookies must be enabled */}
            <View style={styles.cardFooterStrip}>
              <Text style={styles.cookiesText}>{t('cookies_enabled_msg')}</Text>
              <View style={styles.helpIconCircle}>
                <Text style={styles.helpQuestionMark}>?</Text>
              </View>
            </View>
          </View>

          {/* Deep Blue Footer: UNICEF & UN OICT */}
          <View style={styles.footer}>
            {/* Logos Banner matching official UNICEF & UN OICT banner */}
            <View style={styles.footerBannerWrapper}>
              <UnicefUnBanner />
            </View>

            {/* Copyright & Links */}
            <Text style={styles.copyrightText}>
              © 2025{' '}
              <Text
                style={{ textDecorationLine: 'underline', fontWeight: '700' }}
                onPress={() => openInAppBrowser('https://www.unicef.org/', 'UNICEF')}
              >
                UNICEF
              </Text>
              , {t('rights_reserved')}
            </Text>
            <TouchableOpacity onPress={() => openInAppBrowser('https://mh.unilearn.org.in/theme/unoict/contact_us.php', 'Contact Us')}>
              <Text style={styles.contactLink}>{t('contact_us')}</Text>
            </TouchableOpacity>

            {/* Social / Contact Icons */}
            <View style={styles.contactIconsRow}>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => openInAppBrowser('https://mh.unilearn.org.in/theme/unoict/contact_us.php', 'Contact Us')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Mail size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={async () => {
                  const waUrl = 'https://api.whatsapp.com/send/?phone=919971748500&text&type=phone_number&app_absent=0';
                  try {
                    const supported = await Linking.canOpenURL(waUrl);
                    if (supported) {
                      await Linking.openURL(waUrl);
                    } else {
                      openInAppBrowser(waUrl, 'WhatsApp Support');
                    }
                  } catch {
                    openInAppBrowser(waUrl, 'WhatsApp Support');
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MessageCircle size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Language Selection Modal */}
        <Modal
          visible={langModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLangModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setLangModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('select_language')}</Text>

              <TouchableOpacity
                style={[styles.langOption, i18n.language === 'en' && styles.langOptionActive]}
                onPress={() => {
                  i18n.changeLanguage('en');
                  setLangModalVisible(false);
                }}
              >
                <Text style={[styles.langOptionText, i18n.language === 'en' && styles.langOptionTextActive]}>
                  English (en)
                </Text>
                {i18n.language === 'en' && <Check size={16} color="#00AEEF" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.langOption, i18n.language === 'hi' && styles.langOptionActive]}
                onPress={() => {
                  i18n.changeLanguage('hi');
                  setLangModalVisible(false);
                }}
              >
                <Text style={[styles.langOptionText, i18n.language === 'hi' && styles.langOptionTextActive]}>
                  हिन्दी (hi)
                </Text>
                {i18n.language === 'hi' && <Check size={16} color="#00AEEF" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.langOption, i18n.language === 'mr' && styles.langOptionActive]}
                onPress={() => {
                  i18n.changeLanguage('mr');
                  setLangModalVisible(false);
                }}
              >
                <Text style={[styles.langOptionText, i18n.language === 'mr' && styles.langOptionTextActive]}>
                  मराठी (mr)
                </Text>
                {i18n.language === 'mr' && <Check size={16} color="#00AEEF" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLangModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Native In-App Password Reset Modal */}
        <Modal
          visible={forgotModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setForgotModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setForgotModalVisible(false)}
          >
            <View style={[styles.modalContent, { maxWidth: 360, padding: 22 }]}>
              <View style={styles.resetHeaderRow}>
                <View style={styles.resetIconWrap}>
                  <Lock size={20} color="#00AEEF" />
                </View>
                <Text style={styles.modalTitle}>{t('forgot_password', 'Reset Password')}</Text>
              </View>

              <Text style={styles.resetSubText}>
                Enter your username or registered email address to receive password reset instructions from Moodle.
              </Text>

              {resetStatus && (
                <View style={[styles.resetStatusBox, resetStatus.success ? styles.resetStatusSuccess : styles.resetStatusError]}>
                  <Text style={[styles.resetStatusText, resetStatus.success ? styles.resetStatusTextSuccess : styles.resetStatusTextError]}>
                    {resetStatus.message}
                  </Text>
                </View>
              )}

              {!resetStatus?.success && (
                <View style={styles.resetInputWrap}>
                  <User size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.resetInput}
                    placeholder="Username or email address"
                    placeholderTextColor="#94A3B8"
                    value={resetIdentifier}
                    onChangeText={setResetIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <View style={styles.resetBtnRow}>
                {!resetStatus?.success ? (
                  <>
                    <TouchableOpacity
                      style={styles.resetCancelBtn}
                      onPress={() => setForgotModalVisible(false)}
                    >
                      <Text style={styles.resetCancelText}>{t('cancel', 'Cancel')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.resetSubmitBtn, resetLoading && { opacity: 0.7 }]}
                      onPress={handleSendResetLink}
                      disabled={resetLoading}
                    >
                      {resetLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.resetSubmitText}>Send Link</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.resetSubmitBtn, { width: '100%' }]}
                    onPress={() => setForgotModalVisible(false)}
                  >
                    <Text style={styles.resetSubmitText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* In-App Browser Modal (Prevents Expo Go from closing on Android Back) */}
        <Modal
          visible={browserModal.visible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeInAppBrowser}
        >
          <SafeAreaView style={styles.browserContainer}>
            {/* Browser Header */}
            <View style={styles.browserHeader}>
              <TouchableOpacity
                style={styles.browserBtn}
                onPress={() => {
                  if (canGoBack && webViewRef.current) {
                    webViewRef.current.goBack();
                  } else {
                    closeInAppBrowser();
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.browserTitleBox}>
                <ShieldCheck size={14} color="#38BDF8" style={{ marginRight: 5 }} />
                <Text style={styles.browserTitleText} numberOfLines={1}>
                  {browserModal.title || 'UNIlearn Portal'}
                </Text>
              </View>

              <View style={styles.browserHeaderRight}>
                <TouchableOpacity
                  style={styles.browserBtn}
                  onPress={() => webViewRef.current?.reload()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <RotateCw size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.browserBtn}
                  onPress={closeInAppBrowser}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* WebView Body */}
            {browserModal.visible && (
              <View style={{ flex: 1, position: 'relative' }}>
                <WebView
                  ref={webViewRef}
                  source={{ uri: browserModal.url }}
                  onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
                  onShouldStartLoadWithRequest={(request) => {
                    if (request.url.startsWith('whatsapp://') || request.url.startsWith('mailto:') || request.url.startsWith('tel:')) {
                      Linking.openURL(request.url).catch(() => {});
                      return false;
                    }
                    return true;
                  }}
                  onLoadStart={() => setWebViewLoading(true)}
                  onLoadEnd={() => setWebViewLoading(false)}
                  style={{ flex: 1 }}
                />
                {webViewLoading && (
                  <View style={styles.browserLoadingOverlay} pointerEvents="none">
                    <ActivityIndicator size="large" color="#00AEEF" />
                  </View>
                )}
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 30, 60, 0.45)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 24,
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00AEEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  langText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 24,
  },
  cardHeader: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#00AEEF',
    textAlign: 'center',
    marginVertical: 14,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  serverConfigBox: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#F1F6FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serverLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#004F7A',
    marginBottom: 4,
  },
  serverInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serverInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 2,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
    paddingBottom: 6,
  },
  underlinedInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 4,
  },
  passwordGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#EEF3F8',
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  eyeButton: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#64748B',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#00AEEF',
    borderColor: '#00AEEF',
  },
  rememberText: {
    fontSize: 13,
    color: '#334155',
  },
  forgotText: {
    fontSize: 13,
    color: '#004F7A',
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#00AEEF',
    marginHorizontal: 20,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00AEEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  serverToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 14,
  },
  serverToggleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardFooterStrip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cookiesText: {
    fontSize: 12,
    color: '#64748B',
  },
  helpIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00AEEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpQuestionMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  footer: {
    backgroundColor: '#005686',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  footerBannerWrapper: {
    width: '100%',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 14,
  },

  copyrightText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 6,
  },
  contactLink: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  contactIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langOptionActive: {
    backgroundColor: 'rgba(0, 174, 239, 0.1)',
    borderColor: '#00AEEF',
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  langOptionTextActive: {
    color: '#00AEEF',
    fontWeight: '800',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  browserContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  browserHeader: {
    height: 54,
    backgroundColor: '#005686',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  browserBtn: {
    padding: 8,
    borderRadius: 8,
  },
  browserTitleBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  browserTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  browserHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  browserLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  resetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  resetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetSubText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetStatusBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  resetStatusSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  resetStatusError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  resetStatusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  resetStatusTextSuccess: {
    color: '#15803D',
  },
  resetStatusTextError: {
    color: '#DC2626',
  },
  resetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 18,
  },
  resetInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  resetBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  resetCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  resetSubmitBtn: {
    backgroundColor: '#00AEEF',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
