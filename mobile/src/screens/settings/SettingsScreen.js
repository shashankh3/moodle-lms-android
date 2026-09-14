import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { showMessage } from '../../utils/alert';
import {
  ArrowLeft,
  User,
  Moon,
  Sun,
  Bell,
  HardDrive,
  Shield,
  HelpCircle,
  LogOut,
  Info,
  CheckCircle2,
  Trash2,
  Accessibility,
  ChevronRight,
} from 'lucide-react-native';

export default function SettingsScreen({ navigation }) {
  const {
    theme,
    isDark,
    toggleTheme,
    isDyslexic,
    toggleDyslexicFont,
    openAccessibilityModal,
    showAccessibilityToolbar,
  } = useTheme();
  const { currentUser, logout } = useAuth();

  const [notifAssignment, setNotifAssignment] = useState(true);
  const [notifQuiz, setNotifQuiz] = useState(true);
  const [notifDiscussion, setNotifDiscussion] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = () => {
    setCacheCleared(true);
    showMessage('Cache Cleared', 'Temporary local course materials and cached data have been cleaned.');
    setTimeout(() => setCacheCleared(false), 3000);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your UNIlearn learning account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>App & Account Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.badgeBg }]}>
            <Text style={[styles.avatarInitial, { color: theme.primary }]}>
              {(currentUser?.fullname || currentUser?.username || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{currentUser?.fullname || 'Student Account'}</Text>
            <Text style={[styles.profileEmail, { color: theme.textDim }]}>{currentUser?.email || currentUser?.username}</Text>
            <View style={[styles.rolePill, { backgroundColor: theme.badgeBg }]}>
              <Text style={[styles.rolePillText, { color: theme.primary }]}>
                {currentUser?.roleLabel || 'Registered Learner'}
              </Text>
            </View>
          </View>
        </View>

        {/* Display & Appearance */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Appearance & Accessibility</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {/* Official Accessibility Settings Modal Trigger */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={openAccessibilityModal}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 174, 239, 0.12)' }]}>
                <Accessibility size={18} color="#00AEEF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Accessibility Settings (Dialog)</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>
                  Configure Font Type (Default / Dyslexic) & Toolbar
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={theme.textDim} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 174, 239, 0.12)' }]}>
                {isDark ? <Moon size={18} color="#00AEEF" /> : <Sun size={18} color="#00AEEF" />}
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Dark Theme</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Switch between sleek dark and clean light modes</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(140, 184, 17, 0.12)' }]}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.unilearnGreen }}>A</Text>
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Dyslexia-Friendly Font</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Use a highly readable casual font for improved accessibility</Text>
              </View>
            </View>
            <Switch
              value={isDyslexic}
              onValueChange={toggleDyslexicFont}
              trackColor={{ false: '#CBD5E1', true: theme.unilearnGreen }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Learning Notifications */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Learning Notifications</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(140, 184, 17, 0.15)' }]}>
                <Bell size={18} color="#8CB811" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Assignment Reminders</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Alerts for upcoming deadlines and submissions</Text>
              </View>
            </View>
            <Switch
              value={notifAssignment}
              onValueChange={setNotifAssignment}
              trackColor={{ false: '#64748B', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <CheckCircle2 size={18} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Quiz & Assessment Alerts</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Notifications when new tests are published</Text>
              </View>
            </View>
            <Switch
              value={notifQuiz}
              onValueChange={setNotifQuiz}
              trackColor={{ false: '#64748B', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <HelpCircle size={18} color="#EC4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Forum Discussion Updates</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Replies to your questions and doubt topics</Text>
              </View>
            </View>
            <Switch
              value={notifDiscussion}
              onValueChange={setNotifDiscussion}
              trackColor={{ false: '#64748B', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Data & Storage */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Data & Storage</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Trash2 size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Clear Learning Cache</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Free up storage by clearing cached documents</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* About App */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>About</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 79, 122, 0.12)' }]}>
                <Info size={18} color="#004F7A" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>UNIlearn Maharashtra Portal</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Version 1.0.0 (Production Release)</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(140, 184, 17, 0.12)' }]}>
                <Shield size={18} color="#8CB811" />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Academic Security</Text>
                <Text style={[styles.settingSub, { color: theme.textDim }]}>Official Student Learning Platform</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.errorBg }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color={theme.error} />
          <Text style={[styles.logoutButtonText, { color: theme.error }]}>Sign Out of Learning Portal</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    marginBottom: 6,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  settingSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
