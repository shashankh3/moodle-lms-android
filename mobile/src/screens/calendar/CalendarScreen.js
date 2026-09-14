import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { showMessage } from '../../utils/alert';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  HelpCircle,
  FileText,
  Sparkles,
  ArrowRight,
  BookOpen,
  Grid,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to generate all days in any month dynamically
function getDaysInMonth(year, monthIndex) {
  const date = new Date(year, monthIndex, 1);
  const days = [];
  while (date.getMonth() === monthIndex) {
    const dayNum = date.getDate();
    const dayOfWeek = DAY_NAMES[date.getDay()];
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;

    days.push({
      day: dayNum,
      name: dayOfWeek,
      dateStr,
      dayOfWeekIndex: date.getDay(),
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const FILTER_TYPES = [
  { key: 'all', label: 'All Events' },
  { key: 'quiz', label: 'Quizzes' },
  { key: 'assignment', label: 'Assignments' },
  { key: 'event', label: 'Study & Events' },
];

export default function CalendarScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [events, setEvents] = useState([]);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(7); // 7 = August (0-indexed)
  const [selectedDateStr, setSelectedDateStr] = useState('all'); // 'all' or 'YYYY-MM-DD'
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewMode, setViewMode] = useState('strip'); // 'strip' | 'grid'

  // Add Event Form State removed

  const [refreshing, setRefreshing] = useState(false);

  const daysScrollRef = useRef(null);

  const loadEvents = useCallback(async () => {
    try {
      const list = await MobileAPI.getEvents(currentYear, currentMonthIndex + 1);
      setEvents(list);
    } catch (e) {
      console.warn('Error loading calendar events:', e);
    }
  }, [currentYear, currentMonthIndex]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonthIndex(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonthIndex(prev => prev + 1);
    }
  };


  const handleEventAction = (event) => {
    if (event.type === 'quiz' && event.quizId) {
      navigation.navigate('QuizPlayer', { quizId: event.quizId, courseId: event.courseId });
    } else if (event.type === 'assignment' && event.assignId) {
      navigation.navigate('AssignmentView', { assignId: event.assignId, courseId: event.courseId });
    } else if (event.courseId) {
      navigation.navigate('CourseDetail', { courseId: event.courseId });
    } else {
      showMessage(event.title, `${event.course} • ${event.date} at ${event.time}\n\n${event.description}`);
    }
  };

  // Generate all days in current selected month (1 to 31)
  const monthDays = getDaysInMonth(currentYear, currentMonthIndex);
  const currentMonthName = `${MONTH_NAMES[currentMonthIndex]} ${currentYear}`;

  // Filter events by day and type
  const filteredEvents = events.filter(e => {
    const matchesFilter = selectedFilter === 'all' || e.type === selectedFilter;
    const matchesDate = selectedDateStr === 'all' || e.date === selectedDateStr;
    return matchesFilter && matchesDate;
  });

  const getEventsForDate = (dateStr) => {
    return events.filter(e => e.date === dateStr);
  };

  // Month events count
  const monthPrefix = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
  const monthEventsCount = events.filter(e => e.date && e.date.startsWith(monthPrefix)).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <View style={styles.topBarLeft}>
          <CalendarIcon size={22} color={theme.primary} />
          <Text style={[styles.topBarTitle, { color: theme.text }]}>{t('academic_calendar')}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Month Switcher Banner */}
        <View style={[styles.monthCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.monthArrow, { backgroundColor: theme.surfaceSubtle }]}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.monthCenter}>
            <Text style={[styles.monthText, { color: theme.text }]}>{currentMonthName}</Text>
            <Text style={[styles.monthSub, { color: theme.textDim }]}>
              {monthEventsCount} {t('events_in')} {MONTH_NAMES[currentMonthIndex]}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.monthArrow, { backgroundColor: theme.surfaceSubtle }]}
            onPress={handleNextMonth}
            activeOpacity={0.7}
          >
            <ChevronRight size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* View Mode & Date Selection Header */}
        <View style={styles.dateStripHeader}>
          <View style={styles.dateStripLeft}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              {viewMode === 'strip' ? `${t('days_in')} ${MONTH_NAMES[currentMonthIndex]} (1 - ${monthDays.length})` : t('monthly_grid')}
            </Text>
            <TouchableOpacity onPress={() => setSelectedDateStr('all')}>
              <Text
                style={[
                  styles.viewAllText,
                  { color: selectedDateStr === 'all' ? theme.primary : theme.textDim },
                ]}
              >
                {selectedDateStr === 'all' ? `● ${t('showing_all')}` : t('show_all')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Toggle between Strip Slider and Full Grid */}
          <View style={[styles.viewToggle, { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'strip' && [styles.activeToggleBtn, { backgroundColor: theme.card }],
              ]}
              onPress={() => setViewMode('strip')}
            >
              <SlidersHorizontal size={14} color={viewMode === 'strip' ? theme.primary : theme.textDim} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'grid' && [styles.activeToggleBtn, { backgroundColor: theme.card }],
              ]}
              onPress={() => setViewMode('grid')}
            >
              <Grid size={14} color={viewMode === 'grid' ? theme.primary : theme.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mode 1: Full Horizontal 31-Day Swipe Slider */}
        {viewMode === 'strip' ? (
          <ScrollView
            ref={daysScrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.daysStrip}
          >
            {monthDays.map(item => {
              const isSelected = selectedDateStr === item.dateStr;
              const dayEvents = getEventsForDate(item.dateStr);
              const hasEvents = dayEvents.length > 0;

              return (
                <TouchableOpacity
                  key={item.dateStr}
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.card,
                      borderColor: isSelected ? theme.primary : hasEvents ? theme.primaryLight : theme.cardBorder,
                    },
                  ]}
                  onPress={() => setSelectedDateStr(isSelected ? 'all' : item.dateStr)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dayName,
                      { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.textDim },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: isSelected ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {item.day}
                  </Text>

                  {hasEvents ? (
                    <View style={styles.dotContainer}>
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <View
                          key={i}
                          style={[
                            styles.eventDot,
                            { backgroundColor: isSelected ? '#FFFFFF' : ev.color || theme.primary },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={{ height: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          /* Mode 2: Full Monthly Calendar Grid (7 Columns Sun-Sat) */
          <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {/* Weekday headers */}
            <View style={styles.gridWeekdayRow}>
              {DAY_NAMES.map(dayName => (
                <Text key={dayName} style={[styles.gridWeekdayText, { color: theme.textDim }]}>
                  {dayName}
                </Text>
              ))}
            </View>

            {/* Grid days */}
            <View style={styles.gridDaysMatrix}>
              {/* Empty leading offset spaces */}
              {Array.from({ length: monthDays[0].dayOfWeekIndex }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.gridDayCellEmpty} />
              ))}

              {/* Month Day Cells */}
              {monthDays.map(item => {
                const isSelected = selectedDateStr === item.dateStr;
                const dayEvents = getEventsForDate(item.dateStr);
                const hasEvents = dayEvents.length > 0;

                return (
                  <TouchableOpacity
                    key={item.dateStr}
                    style={[
                      styles.gridDayCell,
                      isSelected && { backgroundColor: theme.primary, borderRadius: 10 },
                    ]}
                    onPress={() => setSelectedDateStr(isSelected ? 'all' : item.dateStr)}
                  >
                    <Text
                      style={[
                        styles.gridDayNum,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {item.day}
                    </Text>
                    {hasEvents && (
                      <View style={styles.gridDotRow}>
                        {dayEvents.slice(0, 2).map((ev, i) => (
                          <View
                            key={i}
                            style={[
                              styles.gridDot,
                              { backgroundColor: isSelected ? '#FFFFFF' : ev.color || theme.primary },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.filterRow}>
          {[
            { key: 'all', label: t('all_events') },
            { key: 'quiz', label: t('quizzes') },
            { key: 'assignment', label: t('assignments') },
            { key: 'event', label: t('study_events') },
          ].map(filter => {
            const isSelected = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                    borderColor: isSelected ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => setSelectedFilter(filter.key)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: isSelected ? '#FFFFFF' : theme.textMuted },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>



        {/* Agenda Events Feed */}
        <View style={styles.agendaHeader}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            {selectedDateStr === 'all'
              ? `${t('all_milestones')} (${currentMonthName})`
              : `${t('events_for')} ${selectedDateStr}`}
          </Text>
          <Text style={[styles.agendaCount, { color: theme.primary }]}>
            {filteredEvents.length} {t('items')}
          </Text>
        </View>

        {filteredEvents.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <CalendarIcon size={36} color={theme.textDim} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('no_events_title')}</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {t('no_events_sub')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyActionBtn, { backgroundColor: theme.badgeBg }]}
              onPress={() => {
                setSelectedDateStr('all');
                setSelectedFilter('all');
              }}
            >
              <Text style={[styles.emptyActionText, { color: theme.primary }]}>{t('reset_filters')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredEvents.map(event => (
            <TouchableOpacity
              key={event.id}
              style={[styles.agendaCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => handleEventAction(event)}
              activeOpacity={0.85}
            >
              <View style={[styles.colorBar, { backgroundColor: event.color || theme.primary }]} />
              <View style={styles.agendaContent}>
                <View style={styles.agendaTop}>
                  <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          event.type === 'quiz'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : event.type === 'assignment'
                            ? 'rgba(236, 72, 153, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        {
                          color:
                            event.type === 'quiz'
                              ? '#6366F1'
                              : event.type === 'assignment'
                              ? '#EC4899'
                              : '#10B981',
                        },
                      ]}
                    >
                      {event.type.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.eventDesc, { color: theme.textMuted }]}>{event.description}</Text>

                <View style={styles.eventFooter}>
                  <View style={styles.timeInfo}>
                    <Clock size={13} color={theme.textDim} />
                    <Text style={[styles.timeText, { color: theme.textDim }]}>
                      {event.date} • {event.time}
                    </Text>
                  </View>

                  <View style={styles.actionPrompt}>
                    <Text style={[styles.courseTag, { color: theme.primary }]}>{event.course}</Text>
                    <ArrowRight size={14} color={theme.primary} />
                  </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  addEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  addEventBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthSub: {
    fontSize: 11,
    marginTop: 2,
  },
  dateStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeToggleBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  daysStrip: {
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: 2,
  },
  dayCard: {
    width: 56,
    height: 74,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    height: 6,
    alignItems: 'center',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gridCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  gridWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  gridWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    width: 38,
    textAlign: 'center',
  },
  gridDaysMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
  },
  gridDayCellEmpty: {
    width: `${100 / 7}%`,
    height: 38,
  },
  gridDayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDayNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridDotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  gridDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addFormCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  addFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addFormTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addFormTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    marginBottom: 10,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  saveEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  saveEventBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  agendaCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  agendaCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  colorBar: {
    width: 6,
  },
  agendaContent: {
    flex: 1,
    padding: 14,
  },
  agendaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 12,
  },
  actionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  emptyActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
