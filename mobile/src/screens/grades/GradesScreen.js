import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import {
  Award,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  FileText,
  HelpCircle,
  BookOpen,
  PlayCircle,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  MessageCircle,
} from 'lucide-react-native';

export default function GradesScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  const [grades, setGrades] = useState([]);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'graded' | 'pending'

  const fetchGrades = useCallback(async (forceRefresh = false) => {
    try {
      const list = await MobileAPI.getGrades(currentUser?.id, forceRefresh);
      setGrades(list || []);
      if (list && list.length > 0) {
        setExpandedCourses((prev) => (Object.keys(prev).length === 0 ? { [list[0].courseId]: true } : prev));
      }
    } catch (e) {
      console.warn('[GradesScreen] fetchGrades error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      fetchGrades(false);
    }, [fetchGrades])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGrades(true);
  };

  const toggleCourse = (id) => {
    setExpandedCourses(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all = {};
    grades.forEach(c => { all[c.courseId] = true; });
    setExpandedCourses(all);
  };

  const collapseAll = () => {
    setExpandedCourses({});
  };

  // Filter and search courses
  const filteredGrades = useMemo(() => {
    return grades.filter(course => {
      const matchesSearch =
        (course.courseName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.courseCode || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const hasGradedItems = (course.items || []).some(i => i.status === 'Graded') || (course.finalGrade && course.finalGrade !== '-');
      if (selectedFilter === 'graded') return hasGradedItems;
      if (selectedFilter === 'pending') return !hasGradedItems || (course.items || []).some(i => i.status !== 'Graded');

      return true;
    });
  }, [grades, searchQuery, selectedFilter]);

  // Overall metrics calculation
  const gradedCourses = grades.filter(g => {
    const num = parseInt(g.finalGrade, 10);
    return !isNaN(num);
  });
  const avgScore = gradedCourses.length > 0
    ? Math.round(gradedCourses.reduce((acc, curr) => acc + parseInt(curr.finalGrade, 10), 0) / gradedCourses.length)
    : 0;

  const totalGradedActivities = grades.reduce((sum, c) => sum + (c.items || []).filter(i => i.status === 'Graded').length, 0);

  const getItemIcon = (moduleType) => {
    const size = 16;
    switch (moduleType) {
      case 'quiz':
      case 'exam':
        return <HelpCircle size={size} color="#6366F1" />;
      case 'assign':
        return <FileText size={size} color="#0EA5E9" />;
      case 'lesson':
        return <BookOpen size={size} color="#8B5CF6" />;
      case 'scorm':
        return <PlayCircle size={size} color="#EC4899" />;
      case 'forum':
        return <MessageSquare size={size} color="#F59E0B" />;
      default:
        return <Award size={size} color="#10B981" />;
    }
  };

  const getItemBadgeBg = (moduleType) => {
    switch (moduleType) {
      case 'quiz':
      case 'exam':
        return 'rgba(99, 102, 241, 0.12)';
      case 'assign':
        return 'rgba(14, 165, 233, 0.12)';
      case 'lesson':
        return 'rgba(139, 92, 246, 0.12)';
      case 'scorm':
        return 'rgba(236, 72, 153, 0.12)';
      case 'forum':
        return 'rgba(245, 158, 11, 0.12)';
      default:
        return 'rgba(16, 185, 129, 0.12)';
    }
  };

  const getItemTypeLabel = (moduleType) => {
    switch (moduleType) {
      case 'quiz': return 'Quiz';
      case 'exam': return 'Exam';
      case 'assign': return 'Assignment';
      case 'lesson': return 'Lesson';
      case 'scorm': return 'SCORM';
      case 'forum': return 'Forum';
      default: return 'Assessment';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.topBarTitle, { color: theme.text }]}>Academic Grades</Text>
          <Text style={[styles.topBarSub, { color: theme.textDim }]}>
            {grades.length} Enrolled Course{grades.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading && grades.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textDim }]}>Syncing academic grades from Moodle...</Text>
          </View>
        ) : (
          <>
            {/* KPI Performance Banner */}
            {gradedCourses.length > 0 && (
              <View style={[styles.gpaCard, { backgroundColor: theme.primary }]}>
                <View style={styles.gpaLeft}>
                  <Text style={styles.gpaSub}>Cumulative Performance</Text>
                  <Text style={styles.gpaNumber}>{avgScore}%</Text>
                  <Text style={styles.gpaStanding}>
                    Average across {gradedCourses.length} graded course{gradedCourses.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.gpaRight}>
                  <View style={styles.kpiPill}>
                    <CheckCircle2 size={16} color="#FFFFFF" />
                    <Text style={styles.kpiPillText}>{totalGradedActivities} Graded</Text>
                  </View>
                  <View style={[styles.kpiPill, { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                    <Award size={16} color="#FFFFFF" />
                    <Text style={styles.kpiPillText}>{grades.length} Active</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Search and Filters */}
            {grades.length > 0 && (
              <View style={styles.filterSection}>
                <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Search size={16} color={theme.textDim} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search courses or assessments..."
                    placeholderTextColor={theme.textDim}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <View style={styles.filterRow}>
                  <View style={styles.filterTabs}>
                    {['all', 'graded', 'pending'].map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterTab,
                          selectedFilter === filter && { backgroundColor: theme.primary },
                          selectedFilter !== filter && { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 },
                        ]}
                        onPress={() => setSelectedFilter(filter)}
                      >
                        <Text
                          style={[
                            styles.filterTabText,
                            { color: selectedFilter === filter ? '#FFFFFF' : theme.textDim },
                          ]}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity onPress={Object.keys(expandedCourses).length > 0 ? collapseAll : expandAll}>
                    <Text style={[styles.expandToggleText, { color: theme.primary }]}>
                      {Object.keys(expandedCourses).length > 0 ? 'Collapse All' : 'Expand All'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Course Grade List */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Courses & Grade Breakdown</Text>
              <Text style={[styles.resultCount, { color: theme.textDim }]}>
                {filteredGrades.length} Course{filteredGrades.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {filteredGrades.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.badgeBg }]}>
                  <GraduationCap size={36} color={theme.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {searchQuery ? 'No Matching Courses' : 'No Grades Available'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textDim }]}>
                  {searchQuery
                    ? `No courses matching "${searchQuery}" were found. Try clearing your search.`
                    : 'No course grade items were found for your account yet. Complete quizzes or submit assignments, and grades will sync automatically.'}
                </Text>
                {searchQuery ? (
                  <TouchableOpacity
                    style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setSearchQuery('')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refreshBtnText}>Clear Search</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
                    onPress={onRefresh}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.refreshBtnText}>Check for Updates</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredGrades.map(courseGrade => {
                const isExpanded = expandedCourses[courseGrade.courseId];
                const hasGrade = courseGrade.finalGrade && courseGrade.finalGrade !== '-';

                return (
                  <View
                    key={courseGrade.courseId}
                    style={[styles.courseGradeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  >
                    {/* Course Header */}
                    <TouchableOpacity
                      style={styles.courseGradeHeader}
                      onPress={() => toggleCourse(courseGrade.courseId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.headerTitleWrap}>
                        <View style={styles.codeRow}>
                          <View style={[styles.codeBadge, { backgroundColor: theme.badgeBg }]}>
                            <Text style={[styles.codeText, { color: theme.primary }]}>
                              {courseGrade.courseCode}
                            </Text>
                          </View>
                          {courseGrade.category ? (
                            <Text style={[styles.categoryTag, { color: theme.textDim }]} numberOfLines={1}>
                              {courseGrade.category}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                          {courseGrade.courseName}
                        </Text>

                        <Text style={[styles.credits, { color: theme.textDim }]}>
                          {courseGrade.activitiesCount > 0
                            ? `${courseGrade.activitiesCount} Graded Assessment${courseGrade.activitiesCount > 1 ? 's' : ''}`
                            : 'Course Overview Grade'}
                        </Text>
                      </View>

                      {/* Right Grade Badges */}
                      <View style={styles.gradeBadgeWrap}>
                        <View style={styles.gradeDisplayCol}>
                          {courseGrade.letter && courseGrade.letter !== '-' && courseGrade.letter !== courseGrade.finalGrade && (
                            <View style={[styles.letterBadge, { backgroundColor: theme.badgeBg }]}>
                              <Text style={[styles.letterText, { color: theme.primary }]}>
                                {courseGrade.letter}
                              </Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.percentText,
                              { color: hasGrade ? theme.text : theme.warning },
                            ]}
                          >
                            {courseGrade.finalGrade}
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronUp size={18} color={theme.textDim} />
                        ) : (
                          <ChevronDown size={18} color={theme.textDim} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Expanded Items Breakdown */}
                    {isExpanded && (
                      <View style={[styles.itemsList, { borderTopColor: theme.cardBorder }]}>
                        {courseGrade.items && courseGrade.items.length > 0 ? (
                          courseGrade.items.map((item, idx) => {
                            const isGraded = item.status === 'Graded';
                            const badgeBg = getItemBadgeBg(item.moduleType);

                            return (
                              <View
                                key={item.id || idx}
                                style={[
                                  styles.itemCard,
                                  { backgroundColor: theme.background, borderColor: theme.cardBorder },
                                ]}
                              >
                                <View style={styles.itemTopRow}>
                                  {/* Icon & Name */}
                                  <View style={styles.itemTitleBlock}>
                                    <View style={[styles.itemIconWrap, { backgroundColor: badgeBg }]}>
                                      {getItemIcon(item.moduleType)}
                                    </View>
                                    <View style={styles.itemNameWrap}>
                                      <Text style={[styles.itemName, { color: theme.text }]}>
                                        {item.name}
                                      </Text>
                                      <View style={styles.itemMetaRow}>
                                        <Text style={[styles.itemTypeBadge, { color: theme.textDim }]}>
                                          {getItemTypeLabel(item.moduleType)}
                                        </Text>
                                        {item.weight && item.weight !== '-' && (
                                          <Text style={[styles.itemWeightText, { color: theme.textDim }]}>
                                            • Weight: {item.weight}
                                          </Text>
                                        )}
                                        {item.passGrade && (
                                          <Text style={[styles.itemPassText, { color: theme.textDim }]}>
                                            • Pass: {item.passGrade}
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                  </View>

                                  {/* Score Column */}
                                  <View style={styles.itemScoreBlock}>
                                    <Text
                                      style={[
                                        styles.itemScoreText,
                                        { color: isGraded ? theme.text : theme.warning },
                                      ]}
                                    >
                                      {item.rawGrade}
                                      {item.maxGrade ? ` / ${item.maxGrade}` : ''}
                                    </Text>
                                    {item.percentage !== null && item.percentage !== undefined && (
                                      <Text style={[styles.itemPercentageText, { color: theme.primary }]}>
                                        {item.percentage}%
                                      </Text>
                                    )}
                                    <View
                                      style={[
                                        styles.itemStatusPill,
                                        {
                                          backgroundColor: isGraded
                                            ? 'rgba(16, 185, 129, 0.12)'
                                            : 'rgba(245, 158, 11, 0.12)',
                                        },
                                      ]}
                                    >
                                      {isGraded ? (
                                        <Check size={10} color="#10B981" />
                                      ) : (
                                        <Clock size={10} color="#F59E0B" />
                                      )}
                                      <Text
                                        style={[
                                          styles.itemStatusPillText,
                                          { color: isGraded ? '#10B981' : '#F59E0B' },
                                        ]}
                                      >
                                        {item.status}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* Optional Feedback / Remark Quote */}
                                {item.feedback ? (
                                  <View style={[styles.feedbackBox, { backgroundColor: theme.card }]}>
                                    <MessageCircle size={13} color={theme.primary} />
                                    <Text style={[styles.feedbackText, { color: theme.textDim }]}>
                                      "{item.feedback}"
                                    </Text>
                                  </View>
                                ) : null}

                                {item.dateGraded && (
                                  <Text style={[styles.gradedDateText, { color: theme.textDim }]}>
                                    Graded on {item.dateGraded}
                                  </Text>
                                )}
                              </View>
                            );
                          })
                        ) : (
                          <View style={styles.emptyItemsRow}>
                            <Clock size={16} color={theme.textDim} />
                            <Text style={[styles.emptyItemsText, { color: theme.textDim }]}>
                              No individual assessment items recorded yet for this course.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
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
  topBarLeft: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  topBarSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gpaCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  gpaLeft: {
    flex: 1,
  },
  gpaSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpaNumber: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    marginVertical: 4,
  },
  gpaStanding: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  gpaRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  kpiPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kpiPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: 16,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  courseGradeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  courseGradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  credits: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },
  gradeBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeDisplayCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  letterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  letterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  percentText: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemsList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    marginRight: 8,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemNameWrap: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  itemTypeBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemWeightText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemPassText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemScoreBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  itemScoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemPercentageText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  itemStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  gradedDateText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 6,
  },
  emptyItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  emptyItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
