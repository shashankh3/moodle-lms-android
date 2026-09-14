import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import UniLearnLogo from '../../components/UniLearnLogo';
import {
  User,
  Award,
  Settings,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  Shield,
  GraduationCap,
  Globe,
  Accessibility,
} from 'lucide-react-native';

export default function MoreMenuScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [langModalVisible, setLangModalVisible] = React.useState(false);
  const { theme, themeMode, toggleTheme, isDark, openAccessibilityModal } = useTheme();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(t('sign_out'), t('sign_out_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.topBarTitle, { color: '#FFFFFF' }]}>{t('profile_settings')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Banner */}
        <View style={styles.logoBanner}>
          <UniLearnLogo size={26} showMaharashtra={true} />
        </View>

        {/* User Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {currentUser?.avatar ? (
            <Image source={{ uri: currentUser.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarInitial}>
                {currentUser?.fullname?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.profileDetails}>
            <Text style={[styles.name, { color: theme.text }]}>{currentUser?.fullname || t('moodle_user')}</Text>
            <Text style={[styles.email, { color: theme.textDim }]}>{currentUser?.email || currentUser?.username}</Text>
            <View style={[styles.roleBadge, { backgroundColor: theme.badgeBg }]}>
              <Text style={[styles.roleText, { color: theme.primary }]}>
                {currentUser?.roleLabel || (currentUser?.role === 'admin' ? t('administrator') : t('learner'))}
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Actions */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>{t('learning_tools')}</Text>
        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.cardBorder, borderBottomWidth: 1 }]}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Globe size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.menuText, { color: theme.text }]}>{t('language')}</Text>
            <ChevronRight size={18} color={theme.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.cardBorder, borderBottomWidth: 1 }]}
            onPress={openAccessibilityModal}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(0, 174, 239, 0.12)' }]}>
              <Accessibility size={18} color="#00AEEF" />
            </View>
            <Text style={[styles.menuText, { color: theme.text }]}>Accessibility Settings</Text>
            <ChevronRight size={18} color={theme.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(0, 79, 122, 0.12)' }]}>
              <Settings size={18} color="#004F7A" />
            </View>
            <Text style={[styles.menuText, { color: theme.text }]}>{t('app_account_settings')}</Text>
            <ChevronRight size={18} color={theme.textDim} />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>{t('preferences')}</Text>
        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(0, 174, 239, 0.12)' }]}>
              {isDark ? <Moon size={18} color="#00AEEF" /> : <Sun size={18} color="#00AEEF" />}
            </View>
            <Text style={[styles.menuText, { color: theme.text }]}>{t('dark_theme')}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#64748B', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: theme.errorBg }]}
          onPress={handleLogout}
        >
          <LogOut size={18} color={theme.error} />
          <Text style={[styles.logoutText, { color: theme.error }]}>{t('sign_out')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('select_language')}</Text>
            
            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'en' && { backgroundColor: theme.primary + '20' }]}
              onPress={() => { i18n.changeLanguage('en'); setLangModalVisible(false); }}
            >
              <Text style={[styles.langText, { color: theme.text }, i18n.language === 'en' && { color: theme.primary, fontWeight: '700' }]}>English</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'hi' && { backgroundColor: theme.primary + '20' }]}
              onPress={() => { i18n.changeLanguage('hi'); setLangModalVisible(false); }}
            >
              <Text style={[styles.langText, { color: theme.text }, i18n.language === 'hi' && { color: theme.primary, fontWeight: '700' }]}>हिन्दी (Hindi)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'mr' && { backgroundColor: theme.primary + '20' }]}
              onPress={() => { i18n.changeLanguage('mr'); setLangModalVisible(false); }}
            >
              <Text style={[styles.langText, { color: theme.text }, i18n.language === 'mr' && { color: theme.primary, fontWeight: '700' }]}>मराठी (Marathi)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: theme.cardBorder }]}
              onPress={() => setLangModalVisible(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.textDim }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  logoBanner: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  email: {
    fontSize: 12,
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  langOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  langText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancelBtn: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
