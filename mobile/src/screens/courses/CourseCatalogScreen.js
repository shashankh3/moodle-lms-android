import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI } from '../../services/apiAdapter';
import {
  ArrowLeft,
  Menu,
  Search,
  Globe,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Layers,
  X,
  BookOpen,
} from 'lucide-react-native';

export default function CourseCatalogScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, openDrawer } = useTheme();
  const { currentUser } = useAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedCourseInfo, setSelectedCourseInfo] = useState(null);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await MobileAPI.getCatalogCategoriesAndCourses();
      setCategories(data || []);
      // Initially expand all categories
      const initialExpanded = {};
      (data || []).forEach(cat => {
        initialExpanded[cat.id] = true;
      });
      setExpandedCategories(initialExpanded);
    } catch (e) {
      console.warn('Error loading catalog:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCatalog();
  };

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const toggleCollapseAll = () => {
    const anyExpanded = Object.values(expandedCategories).some(Boolean);
    const updated = {};
    categories.forEach(cat => {
      updated[cat.id] = !anyExpanded;
    });
    setExpandedCategories(updated);
  };

  const allCollapsed = !Object.values(expandedCategories).some(Boolean);

  // Filter categories and courses by search query
  const filteredCategories = categories.map(cat => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return cat;

    const matchesCat = cat.name.toLowerCase().includes(q);
    const filteredCourses = (cat.courses || []).filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.summary && c.summary.toLowerCase().includes(q))
    );

    if (matchesCat) return cat;
    if (filteredCourses.length > 0) {
      return { ...cat, courses: filteredCourses };
    }
    return null;
  }).filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: '#E2F0F7' }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DashboardTab')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>{t('course_catalog_title')}</Text>

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
        {/* Top Header Card matching Screenshot: UNILEARN MH */}
        <View style={styles.titleCard}>
          <Text style={styles.titleText}>UNILEARN MH</Text>
        </View>

        {/* Main Content Card matching Screenshot */}
        <View style={styles.catalogCard}>
          {/* Search Bar + Collapse All Toggle */}
          <View style={styles.controlsRow}>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder={t('search_courses_placeholder')}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={() => {}}
                activeOpacity={0.8}
              >
                <Search size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={toggleCollapseAll}
              activeOpacity={0.7}
            >
              <Text style={styles.collapseToggleText}>
                {allCollapsed ? `▸ ${t('expand_all')}` : `▾ ${t('collapse_all')}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#00AEEF" />
              <Text style={styles.loadingText}>{t('loading_catalog')}</Text>
            </View>
          ) : filteredCategories.length === 0 ? (
            <View style={styles.emptyState}>
              <Layers size={36} color="#94A3B8" />
              <Text style={styles.emptyStateTitle}>{t('no_courses_catalog')}</Text>
              <Text style={styles.emptyStateSub}>
                {searchQuery
                  ? t('no_courses_catalog')
                  : t('no_courses_catalog_sub')}
              </Text>
            </View>
          ) : (
            filteredCategories.map(cat => {
              const isExpanded = expandedCategories[cat.id];
              const coursesList = cat.courses || [];

              return (
                <View key={cat.id} style={styles.categorySection}>
                  {/* Category Header with Triangle Indicator */}
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryIndicator}>
                      {isExpanded ? '▾' : '▸'}
                    </Text>
                    <Text style={styles.categoryTitle}>
                      {cat.name.toUpperCase()}
                    </Text>
                  </TouchableOpacity>

                  {/* Courses List inside Category */}
                  {isExpanded && (
                    <View style={styles.coursesList}>
                      {coursesList.length === 0 ? (
                        <Text style={styles.noCoursesInCategory}>{t('no_courses_catalog')}</Text>
                      ) : (
                        coursesList.map((course, idx) => (
                          <TouchableOpacity
                            key={course.id}
                            style={[
                              styles.courseRow,
                              idx % 2 === 1 && styles.courseRowAlt,
                            ]}
                            onPress={() => {
                              navigation.navigate('CourseDetailScreen', {
                                courseId: course.id,
                                course: course,
                              });
                            }}
                            activeOpacity={0.75}
                          >
                            <View style={styles.courseLeft}>
                              <Globe size={18} color="#64748B" style={styles.courseGlobeIcon} />
                              <Text style={styles.courseNameText} numberOfLines={2}>
                                {course.name || course.fullname}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={styles.infoBtn}
                              onPress={() => setSelectedCourseInfo(course)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Info size={16} color="#005686" />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Course Info Summary Modal */}
      <Modal
        visible={!!selectedCourseInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedCourseInfo(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <View style={styles.infoModalBadge}>
                <BookOpen size={14} color="#00AEEF" />
                <Text style={styles.infoModalBadgeText}>{t('course_details')}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCourseInfo(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.infoModalTitle}>
              {selectedCourseInfo?.name || selectedCourseInfo?.fullname}
            </Text>

            <Text style={styles.infoModalCategory}>
              {t('category_label')}: {selectedCourseInfo?.category || 'General'}
            </Text>

            <ScrollView style={styles.infoModalScroll}>
              <Text style={styles.infoModalDescription}>
                {selectedCourseInfo?.summary || t('no_courses_sub')}
              </Text>
            </ScrollView>

            <View style={styles.infoModalActions}>
              <TouchableOpacity
                style={styles.openCourseBtn}
                onPress={() => {
                  const c = selectedCourseInfo;
                  setSelectedCourseInfo(null);
                  navigation.navigate('CourseDetailScreen', {
                    courseId: c.id,
                    course: c,
                  });
                }}
              >
                <Text style={styles.openCourseBtnText}>{t('view_course')}</Text>
              </TouchableOpacity>
            </View>
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
  titleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E8F0',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.5,
  },
  catalogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E8F0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  controlsRow: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  searchBtn: {
    width: 42,
    height: '100%',
    backgroundColor: '#004F7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseToggleBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  collapseToggleText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryIndicator: {
    fontSize: 16,
    color: '#004F7A',
    fontWeight: '800',
    marginRight: 6,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#004F7A',
    letterSpacing: 0.3,
  },
  coursesList: {
    marginTop: 4,
  },
  noCoursesInCategory: {
    fontSize: 12,
    color: '#94A3B8',
    paddingLeft: 22,
    paddingVertical: 6,
    fontStyle: 'italic',
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 14,
  },
  courseRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  courseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  courseGlobeIcon: {
    marginRight: 10,
  },
  courseNameText: {
    fontSize: 14,
    color: '#004F7A',
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  infoBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  infoModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 174, 239, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  infoModalBadgeText: {
    color: '#00AEEF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 4,
  },
  infoModalCategory: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 12,
  },
  infoModalScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  infoModalDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  infoModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  openCourseBtn: {
    backgroundColor: '#004F7A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  openCourseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
