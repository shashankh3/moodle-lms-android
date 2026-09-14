import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { ArrowLeft, Award, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import * as WebBrowser from 'expo-web-browser';

export default function BadgesScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const fetchBadges = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const result = await MobileAPI.getBadges(currentUser?.id || 2, currentUser);
      setBadges(result.items || []);
      const realErrors = (result.errors || []).filter(
        err => !err.includes('external_functions') && !err.includes('plugin may not be installed')
      );
      setErrors(realErrors);
    } catch (e) {
      console.error('[BadgesScreen] Unexpected error:', e);
      setErrors([e.message]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, [currentUser]);

  const handleOpenBadge = async (item) => {
    if (item.url) {
      navigation.navigate('CourseContentViewer', {
        module: {
          name: item.name || item.title || 'Verified Credential',
          url: item.url,
          webUrl: item.url,
          type: item.isCert ? 'customcert' : 'badge',
          description: item.description,
        },
        courseName: item.course || 'Badge Credential',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>Badges & Credentials</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchBadges}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <RefreshCw size={18} color={theme.textDim} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
          <Sparkles size={28} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Academic Honors</Text>
          <Text style={styles.heroSubtitle}>
            Verified micro-credentials and milestones earned through course completions and quiz mastery.
          </Text>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textDim }]}>
              Fetching badges & certificates from Moodle...
            </Text>
          </View>
        )}

        {/* Badges / Certs List */}
        {!loading && badges.length > 0 && badges.map(badge => (
          <TouchableOpacity
            key={badge.id}
            onPress={() => handleOpenBadge(badge)}
            activeOpacity={badge.isCert ? 0.7 : 1}
            style={[styles.badgeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <View style={[styles.badgeIconWrapper, { backgroundColor: `${badge.color}20` }]}>
              {/* Show image if icon is a URL, else show emoji */}
              {badge.icon && badge.icon.startsWith('http') ? (
                <Image source={{ uri: badge.icon }} style={styles.badgeImage} resizeMode="contain" />
              ) : (
                <Text style={styles.badgeEmoji}>{badge.icon || '🏆'}</Text>
              )}
            </View>
            <View style={styles.badgeInfo}>
              <View style={styles.badgeTop}>
                <Text style={[styles.badgeName, { color: theme.text }]}>{badge.name || badge.title}</Text>
                <View style={[styles.verifiedPill, { backgroundColor: theme.successBg }]}>
                  <CheckCircle2 size={12} color={theme.success} />
                  <Text style={[styles.verifiedText, { color: theme.success }]}>Verified</Text>
                </View>
              </View>
              <Text style={[styles.badgeCourse, { color: theme.primary }]}>{badge.course}</Text>
              {badge.description ? (
                <Text style={[styles.badgeDesc, { color: theme.textMuted }]}>{badge.description}</Text>
              ) : null}
              <Text style={[styles.badgeDate, { color: theme.textDim }]}>Issued on {badge.earnedDate}</Text>
              {badge.isCert && (
                <Text style={[styles.tapHint, { color: theme.primary }]}>Tap to view certificate →</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Empty State */}
        {!loading && badges.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Award size={44} color={theme.textDim} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Badges or Certificates Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Badges awarded on Moodle and certificates from installed certificate plugins (mod_customcert / mod_certificate) will appear here.
            </Text>
          </View>
        )}

        {/* API Errors (diagnostic) */}
        {!loading && errors.length > 0 && (
          <View style={[styles.errorCard, { backgroundColor: theme.errorBg || 'rgba(239,68,68,0.08)', borderColor: theme.error || '#EF4444' }]}>
            <View style={styles.errorHeader}>
              <AlertCircle size={16} color={theme.error || '#EF4444'} />
              <Text style={[styles.errorTitle, { color: theme.error || '#EF4444' }]}>
                API Diagnostics ({errors.length} issue{errors.length !== 1 ? 's' : ''})
              </Text>
            </View>
            {errors.map((err, i) => (
              <Text key={i} style={[styles.errorItem, { color: theme.textMuted }]}>
                • {err}
              </Text>
            ))}
          </View>
        )}
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
  backBtn: {
    padding: 4,
  },
  refreshBtn: {
    padding: 4,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  centerBox: {
    alignItems: 'center',
    padding: 40,
    gap: 14,
  },
  loadingText: {
    fontSize: 13,
    textAlign: 'center',
  },
  badgeCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    gap: 14,
  },
  badgeIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  badgeEmoji: {
    fontSize: 26,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  badgeName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeCourse: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  badgeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  badgeDate: {
    fontSize: 11,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorItem: {
    fontSize: 11,
    lineHeight: 17,
  },
});
