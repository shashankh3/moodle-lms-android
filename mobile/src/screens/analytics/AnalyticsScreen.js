import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI } from '../../services/apiAdapter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Users, AlertTriangle, TrendingUp, BookOpen, Award, Layers } from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [courses, setCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [crs, grd] = await Promise.all([
        MobileAPI.getCourses(currentUser),
        MobileAPI.getGrades(currentUser?.id),
      ]);
      setCourses(crs || []);
      setGrades(grd || []);
    } catch (e) {
      console.warn('Error loading analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const chartConfig = {
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    color: (opacity = 1) => `rgba(0, 174, 239, ${opacity})`,
    labelColor: () => theme.textDim,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: theme.cardBorder,
      strokeDasharray: "0"
    }
  };

  // Derive progress distribution from real courses
  const courseProgressList = courses.map(c => Math.round(c.progress || 0));
  const completedCount = courseProgressList.filter(p => p >= 100).length;
  const inProgressCount = courseProgressList.filter(p => p > 0 && p < 100).length;
  const notStartedCount = courseProgressList.filter(p => p === 0).length;

  const distributionData = {
    labels: [t('active'), t('active_learning'), t('complete')],
    datasets: [
      {
        data: [
          Math.max(0, notStartedCount),
          Math.max(0, inProgressCount),
          Math.max(0, completedCount),
        ],
      },
    ],
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 50 : 20) }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('tab_analytics')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00AEEF']} />
        }
      >
        {/* Real Summary Overview */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <BookOpen size={20} color="#00AEEF" />
            <Text style={[styles.statBoxNum, { color: theme.text }]}>{courses.length}</Text>
            <Text style={[styles.statBoxLabel, { color: theme.textDim }]}>{t('total_courses')}</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TrendingUp size={20} color="#38BDF8" />
            <Text style={[styles.statBoxNum, { color: theme.text }]}>{inProgressCount}</Text>
            <Text style={[styles.statBoxLabel, { color: theme.textDim }]}>{t('active_learning')}</Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Award size={20} color="#8CB811" />
            <Text style={[styles.statBoxNum, { color: theme.text }]}>{completedCount}</Text>
            <Text style={[styles.statBoxLabel, { color: theme.textDim }]}>{t('completed_label')}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00AEEF" />
            <Text style={[styles.loadingText, { color: theme.textDim }]}>
              {t('loading_metrics')}
            </Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Layers size={36} color="#94A3B8" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('no_metrics_title')}</Text>
            <Text style={[styles.emptySub, { color: theme.textDim }]}>
              {t('no_metrics_sub')}
            </Text>
          </View>
        ) : (
          <>
            {/* Progress Distribution Chart */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.cardHeader}>
                <Users size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>{t('course_progress_distribution')}</Text>
              </View>
              <BarChart
                data={distributionData}
                width={screenWidth - 64}
                height={200}
                yAxisLabel=""
                chartConfig={chartConfig}
                verticalLabelRotation={0}
                style={styles.chart}
              />
            </View>

            {/* Live Course Breakdown */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.cardHeader}>
                <TrendingUp size={18} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>{t('course_breakdown')}</Text>
              </View>

              {courses.map(c => {
                const prog = Math.round(c.progress || 0);
                return (
                  <View key={c.id} style={styles.courseMetricRow}>
                    <View style={styles.courseMetricHeader}>
                      <Text style={[styles.courseMetricTitle, { color: theme.text }]} numberOfLines={1}>
                        {c.fullname || c.name}
                      </Text>
                      <Text style={[styles.courseMetricPercent, { color: prog >= 100 ? '#8CB811' : theme.primary }]}>
                        {prog}%
                      </Text>
                    </View>
                    <View style={styles.progTrack}>
                      <View
                        style={[
                          styles.progFill,
                          {
                            width: `${Math.min(100, prog)}%`,
                            backgroundColor: prog >= 100 ? '#8CB811' : theme.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxNum: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chart: {
    marginVertical: 4,
    borderRadius: 10,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  courseMetricRow: {
    marginBottom: 12,
  },
  courseMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  courseMetricTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  courseMetricPercent: {
    fontSize: 13,
    fontWeight: '800',
  },
  progTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    borderRadius: 3,
  },
});
