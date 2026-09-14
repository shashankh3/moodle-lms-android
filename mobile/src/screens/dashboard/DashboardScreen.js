import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import OfficialTopHeader from '../../components/OfficialTopHeader';
import {
  BookOpen,
  Award,
  ChevronDown,
  Layers,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Check,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function DashboardScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { currentUser, isStudent, isTeacher, isAdmin } = useAuth();
  const { t } = useTranslation();

  const [courses, setCourses] = useState([]);
  const [badges, setBadges] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('All');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadData = useCallback(async (showLoading = true, forceServer = false) => {
    if (showLoading) setLoading(true);
    try {
      const [fetchedCourses, fetchedBadges] = await Promise.all([
        MobileAPI.getCourses(currentUser, forceServer),
        MobileAPI.getBadges(currentUser?.id || 2, currentUser).catch(() => ({ items: [] })),
      ]);
      setCourses(fetchedCourses || []);
      setBadges(fetchedBadges?.items || []);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData(false, true);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false, true);
    setRefreshing(false);
  };

  const userName = (currentUser?.firstname || currentUser?.fullname || 'DEMO USER').toUpperCase();
  const recentCourses = courses.slice(0, 4);

  const filterOptions = [
    { key: 'All', label: t('filter_all', 'All'), count: courses.length },
    {
      key: 'InProgress',
      label: t('filter_in_progress', 'In progress'),
      count: courses.filter((c) => {
        const p = Math.min(100, Math.max(0, Math.round(c.progress || 0)));
        return p < 100 && p > 0;
      }).length,
    },
    {
      key: 'Completed',
      label: t('filter_completed', 'Completed'),
      count: courses.filter((c) => {
        const p = Math.min(100, Math.max(0, Math.round(c.progress || 0)));
        return p === 100;
      }).length,
    },
    {
      key: 'NotStarted',
      label: t('filter_not_started', 'Not started'),
      count: courses.filter((c) => {
        const p = Math.min(100, Math.max(0, Math.round(c.progress || 0)));
        return p === 0;
      }).length,
    },
  ];

  const currentFilterLabel = filterOptions.find((f) => f.key === filterMode)?.label || t('filter_all', 'All');

  const filteredCourses = courses.filter((c) => {
    const p = Math.min(100, Math.max(0, Math.round(c.progress || 0)));
    if (filterMode === 'InProgress') return p < 100 && p > 0;
    if (filterMode === 'Completed') return p === 100;
    if (filterMode === 'NotStarted') return p === 0;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Official UNIlearn Header */}
      <OfficialTopHeader title="UNIlearn" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00AEEF']} />
        }
      >
        {/* Modern Redesigned Greeting & Clue Card */}
        <LinearGradient
          colors={isDark ? ['#0E2439', '#071524'] : ['#004F7A', '#0077B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.greetingCard}
        >
          <View style={styles.greetingTopRow}>
            {currentUser?.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={styles.userAvatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPill}>
                <Text style={styles.avatarInitial}>
                  {(currentUser?.firstname || currentUser?.fullname || 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.greetingTextCol}>
              <View style={styles.roleBadgeRow}>
                <Text style={styles.roleBadgeText}>
                  {currentUser?.roleLabel || (isStudent ? t('student_role', 'Enrolled Student') : t('moodle_user', 'Learner'))}
                </Text>
                <View style={styles.activeDot} />
              </View>
              <Text style={styles.greetingTitle}>
                {t('greeting_hi', 'Hi')}, {currentUser?.firstname || currentUser?.fullname?.split(' ')[0] || 'Demo'}! 👋
              </Text>
            </View>

            <View style={styles.sparkleBox}>
              <Sparkles size={20} color="#38BDF8" />
            </View>
          </View>

          {/* Motivational Clue Banner / Quick Tip */}
          <View style={styles.clueBox}>
            <View style={styles.clueIconWrap}>
              <GraduationCap size={16} color="#00AEEF" />
            </View>
            <Text style={styles.clueText} numberOfLines={2}>
              {courses.length > 0
                ? `${t('ready_to_learn', 'Ready to continue? You have')} ${courses.length} ${t('active_courses', 'courses enrolled.')}`
                : t('explore_catalog_clue', 'Explore the course catalog to start your learning journey.')}
            </Text>
          </View>
        </LinearGradient>


        {/* RECENTLY ACCESSED COURSES matching Screenshot */}
        {recentCourses.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>{t('recently_accessed')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScrollContent}
            >
              {recentCourses.map(c => {
                const imgUri = c.image || c.thumbnail;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.recentCourseCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    onPress={() => navigation.navigate('CourseDetailScreen', { courseId: c.id, course: c })}
                    activeOpacity={0.85}
                  >
                    {imgUri ? (
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.recentCourseImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <BookOpen size={32} color="#00AEEF" />
                      </View>
                    )}
                    <View style={[styles.recentTitleBar, { backgroundColor: theme.card }]}>
                      <Text style={[styles.recentCourseTitle, { color: theme.text }]} numberOfLines={2}>
                        {c.fullname || c.shortname}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* COURSE OVERVIEW matching Screenshot */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>{t('course_overview')}</Text>

          {/* Filter Dropdown Pill */}
          <TouchableOpacity
            style={[styles.filterPill, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, { color: theme.primary || '#00AEEF' }]}>{currentFilterLabel}</Text>
            <ChevronDown size={14} color={theme.primary || '#00AEEF'} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {/* Course Cards Grid/List */}
          {filteredCourses.length === 0 && !loading ? (
            <View style={[styles.whiteCard, styles.emptyCoursesCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Layers size={36} color="#94A3B8" />
              <Text style={[styles.emptyCoursesTitle, { color: theme.text }]}>{t('no_courses_title')}</Text>
              <Text style={[styles.emptyCoursesSub, { color: theme.subText || '#64748B' }]}>
                {t('no_courses_sub')}
              </Text>
            </View>
          ) : (
            <View style={styles.coursesGrid}>
              {filteredCourses.map(c => {
                const imgUri = c.image || c.thumbnail;
                const progress = Math.min(100, Math.max(0, Math.round(c.progress || 0)));

                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.courseOverviewCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    onPress={() => navigation.navigate('CourseDetailScreen', { courseId: c.id, course: c })}
                    activeOpacity={0.85}
                  >
                    {/* Course Banner Image */}
                    {imgUri ? (
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.overviewCourseImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.overviewImagePlaceholder}>
                        <BookOpen size={36} color="#00AEEF" />
                      </View>
                    )}

                    {/* Course Title */}
                    <View style={styles.overviewBody}>
                      <Text style={[styles.overviewCourseTitle, { color: theme.text }]} numberOfLines={2}>
                        {c.fullname || c.shortname}
                      </Text>
                    </View>

                    {/* Bottom Green Progress Bar matching Screenshot */}
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progress > 0 ? progress : 100}%`, backgroundColor: '#8CB811' },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Course Overview Filter Dropdown Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t('course_overview')}</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={theme.subText || '#64748B'} />
              </TouchableOpacity>
            </View>

            {filterOptions.map((opt) => {
              const isSelected = filterMode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterOptionRow,
                    { borderBottomColor: theme.cardBorder || '#E2E8F0' },
                    isSelected && { backgroundColor: isDark ? 'rgba(0, 174, 239, 0.15)' : '#E0F2FE' },
                  ]}
                  onPress={() => {
                    setFilterMode(opt.key);
                    setFilterModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterOptionLeft}>
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: isSelected ? '#00AEEF' : theme.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: isSelected ? '#00AEEF' : (isDark ? '#334155' : '#E2E8F0') }]}>
                      <Text style={[styles.countBadgeText, isSelected && { color: '#FFFFFF' }]}>
                        {opt.count}
                      </Text>
                    </View>
                  </View>
                  {isSelected && <Check size={18} color="#00AEEF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  greetingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  greetingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#38BDF8',
    marginRight: 12,
  },
  avatarPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  greetingTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0F2FE',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8CB811',
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sparkleBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 10,
    minHeight: 46,
  },
  clueIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#F0F9FF',
    lineHeight: 18,
    paddingVertical: 1,
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E8F0',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  badgesCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyBadgesText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 70,
  },
  badgeName: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionBlock: {
    marginBottom: 22,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 22,
    marginBottom: 10,
    paddingVertical: 2,
  },
  recentScrollContent: {
    gap: 14,
    paddingRight: 16,
  },
  recentCourseCard: {
    width: 250,
    height: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E8F0',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recentCourseImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  recentCourseTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00AEEF',
    marginBottom: 14,
    minHeight: 38,
  },
  filterPillText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#00AEEF',
    lineHeight: 20,
    paddingRight: 2,
  },
  coursesGrid: {
    flexDirection: 'column',
    gap: 14,
  },
  courseOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewCourseImage: {
    width: '100%',
    height: 140,
  },
  overviewImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewBody: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  overviewCourseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 19,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  emptyCoursesCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCoursesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyCoursesSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
});
