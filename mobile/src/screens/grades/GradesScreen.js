import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { Award, GraduationCap, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react-native';

export default function GradesScreen() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  const [grades, setGrades] = useState([]);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchGrades = useCallback(async () => {
    const list = await MobileAPI.getGrades(currentUser?.id);
    setGrades(list);
    if (list && list.length > 0) {
      setExpandedCourses((prev) => (Object.keys(prev).length === 0 ? { [list[0].courseId]: true } : prev));
    }
  }, [currentUser]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  useFocusEffect(
    useCallback(() => {
      fetchGrades();
    }, [fetchGrades])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGrades();
    setRefreshing(false);
  };

  const toggleCourse = (id) => {
    setExpandedCourses(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>Academic Grades</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Dynamic Summary Card */}
        {grades.length > 0 && (
          <View style={[styles.gpaCard, { backgroundColor: theme.primary }]}>
            <View style={styles.gpaLeft}>
              <Text style={styles.gpaSub}>Average Score</Text>
              <Text style={styles.gpaNumber}>
                {Math.round(grades.reduce((acc, curr) => acc + parseInt(curr.finalGrade || 0, 10), 0) / grades.length)}%
              </Text>
              <Text style={styles.gpaStanding}>Across {grades.length} Courses</Text>
            </View>
            <View style={styles.gpaRight}>
              <View style={styles.creditBadge}>
                <Award size={20} color="#FFFFFF" />
                <Text style={styles.creditText}>Enrolled</Text>
              </View>
            </View>
          </View>
        )}

        {/* Courses Grades Breakdown */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Course Grade Reports</Text>

        {grades.map(courseGrade => {
          const isExpanded = expandedCourses[courseGrade.courseId];
          return (
            <View
              key={courseGrade.courseId}
              style={[styles.courseGradeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <TouchableOpacity
                style={styles.courseGradeHeader}
                onPress={() => toggleCourse(courseGrade.courseId)}
                activeOpacity={0.7}
              >
                <View style={styles.headerTitleWrap}>
                  <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>
                    {courseGrade.courseName}
                  </Text>
                  {courseGrade.activitiesCount ? (
                    <Text style={[styles.credits, { color: theme.textDim }]}>{courseGrade.activitiesCount} Graded Items</Text>
                  ) : null}
                </View>

                <View style={styles.gradeBadgeWrap}>
                  <View style={[styles.letterBadge, { backgroundColor: theme.badgeBg }]}>
                    <Text style={[styles.letterText, { color: theme.primary }]}>{courseGrade.letter}</Text>
                  </View>
                  <Text style={[styles.percentText, { color: theme.text }]}>{courseGrade.finalGrade}</Text>
                  {isExpanded ? (
                    <ChevronUp size={18} color={theme.textDim} />
                  ) : (
                    <ChevronDown size={18} color={theme.textDim} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Items List */}
              {isExpanded && (
                <View style={[styles.itemsList, { borderTopColor: theme.cardBorder }]}>
                  {courseGrade.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemMain}>
                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.itemWeight, { color: theme.textDim }]}>Weight: {item.weight}</Text>
                      </View>
                      <View style={styles.itemScore}>
                        <Text
                          style={[
                            styles.itemScoreText,
                            { color: item.percentage !== null ? theme.text : theme.warning },
                          ]}
                        >
                          {item.rawGrade}
                        </Text>
                        <Text
                          style={[
                            styles.itemStatus,
                            { color: item.status === 'Graded' ? theme.success : theme.warning },
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gpaCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  gpaLeft: {},
  gpaSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  gpaNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginVertical: 4,
  },
  gpaStanding: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  gpaRight: {
    alignItems: 'center',
  },
  creditBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  creditText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
  courseName: {
    fontSize: 15,
    fontWeight: '700',
  },
  credits: {
    fontSize: 12,
    marginTop: 2,
  },
  gradeBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 15,
    fontWeight: '800',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemsList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemMain: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemWeight: {
    fontSize: 11,
    marginTop: 2,
  },
  itemScore: {
    alignItems: 'flex-end',
  },
  itemScoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemStatus: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
