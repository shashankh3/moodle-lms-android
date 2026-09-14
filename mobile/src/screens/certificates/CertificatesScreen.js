import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI } from '../../services/apiAdapter';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  Award,
  Download,
  ExternalLink,
  ShieldCheck,
  Menu,
  RefreshCw,
  AlertCircle,
  FileCheck,
} from 'lucide-react-native';

export default function CertificatesScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, openDrawer } = useTheme();
  const { currentUser } = useAuth();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState([]);

  const fetchLiveCertificates = async () => {
    try {
      setErrors([]);
      const res = await MobileAPI.getCertificates(currentUser);
      setCertificates(res.items || []);
      if (res.errors && res.errors.length > 0) {
        setErrors(res.errors);
      }
    } catch (err) {
      console.error('[CertificatesScreen] Fetch error:', err);
      setErrors([err.message]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveCertificates();
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLiveCertificates();
  };

  const handleOpenCertificate = async (item) => {
    if (item.url) {
      navigation.navigate('CourseContentViewer', {
        module: {
          name: item.name || item.title || 'Official Certificate',
          url: item.url,
          webUrl: item.url,
          modname: 'customcert',
          type: 'customcert',
          description: item.description,
        },
        courseName: item.course || 'Certificate',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DashboardTab')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>{t('menu_certificates')}</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onRefresh}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RefreshCw size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={openDrawer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00AEEF']} />
        }
      >
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconWrapper}>
            <Award size={28} color="#FFFFFF" />
          </View>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>{t('verified_credentials')}</Text>
            <Text style={styles.bannerSub}>
              {t('portal_subtitle')}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textDim }]}>
              {t('loading_catalog')}
            </Text>
          </View>
        ) : certificates.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <FileCheck size={42} color="#94A3B8" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('no_certificates_title')}</Text>
            <Text style={[styles.emptySub, { color: theme.textDim }]}>
              {t('no_certificates_sub')}
            </Text>
          </View>
        ) : (
          certificates.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.certCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => handleOpenCertificate(c)}
              activeOpacity={0.85}
            >
              <View style={styles.certHeader}>
                <View style={styles.certBadge}>
                  <ShieldCheck size={14} color="#00AEEF" />
                  <Text style={styles.certBadgeText}>{t('verified_credentials')}</Text>
                </View>
                <Text style={styles.certDate}>{c.earnedDate || t('active')}</Text>
              </View>

              <Text style={[styles.certTitle, { color: theme.text }]}>
                {c.name || c.title}
              </Text>

              {c.description ? (
                <Text style={[styles.certDescription, { color: theme.textDim }]}>
                  {c.description}
                </Text>
              ) : null}

              <View style={styles.certFooter}>
                <Text style={[styles.courseName, { color: theme.textMuted }]}>
                  {c.course}
                </Text>

                <View style={styles.openBtn}>
                  <Download size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.openBtnText}>{t('view_online')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004F7A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  bannerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
  centerBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  certCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  certBadgeText: {
    color: '#00AEEF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  certDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  certTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  certDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  certFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  courseName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004F7A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
