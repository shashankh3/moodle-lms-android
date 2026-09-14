import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { 
  Play, FileText, Download, CheckCircle, Video, Music, Image as ImageIcon, BookOpen, Clock, Activity, MessageSquare, Maximize2, Globe, File, Map, ArrowLeft, MoreVertical, Layout, AlignLeft, Users, Shield, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Share2, Award, Circle, HelpCircle, ExternalLink, X
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';

import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { showMessage } from '../../utils/alert';
import { getModuleNavigationTarget } from '../../services/modules/ModuleResolver';

export function cleanHtmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, ' • ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function generateHtmlPage(htmlContent, isDark, theme) {
  const bg = isDark ? '#0F172A' : '#FFFFFF';
  const text = isDark ? '#F1F5F9' : '#1E293B';
  const surface = isDark ? '#1E293B' : '#F8FAFC';
  const border = isDark ? '#334155' : '#E2E8F0';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: ${bg};
            color: ${text};
            padding: 16px;
            margin: 0;
            line-height: 1.65;
            font-size: 15px;
            word-wrap: break-word;
          }
          img, video, iframe, embed, object { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
          a { color: #00AEEF; text-decoration: none; font-weight: 600; }
          h1, h2, h3, h4, h5, h6 { color: ${isDark ? '#FFFFFF' : '#0F172A'}; line-height: 1.3; margin-top: 16px; margin-bottom: 8px; }
          pre, code { background: ${surface}; padding: 4px 8px; border-radius: 6px; font-size: 13px; border: 1px solid ${border}; }
          pre { overflow-x: auto; padding: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
          th, td { border: 1px solid ${border}; padding: 8px 12px; text-align: left; }
          th { background: ${surface}; font-weight: 700; }
          blockquote { border-left: 4px solid #00AEEF; margin: 12px 0; padding: 6px 14px; background: ${surface}; border-radius: 0 8px 8px 0; }
          ul, ol { padding-left: 20px; }
          li { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;
}

export default function CourseDetailScreen({ route, navigation }) {
  const courseId = route?.params?.courseId || route?.params?.id || route?.params?.course?.id || 1;
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();

  const [course, setCourse] = useState(route?.params?.course || null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [selectedPageModal, setSelectedPageModal] = useState(null);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [fetchedText, setFetchedText] = useState('');
  const [canGoForward, setCanGoForward] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleOpenResource = (url, isPdf = false, title = 'Course Material') => {
    if (!url) return;
    navigation.navigate('CourseContentViewer', {
      module: {
        name: title,
        fileUrl: url,
        isPdf,
        type: isPdf ? 'pdf' : 'resource',
      },
      courseId: course?.id || courseId,
      courseName: course?.fullname || course?.name,
    });
  };

  const loadCourseData = useCallback(async (showLoading = false, forceApiRefresh = false) => {
    if (showLoading && !route?.params?.course) setCourse(null);
    try {
      const data = await MobileAPI.getCourseById(courseId, currentUser, forceApiRefresh);
      if (data) setCourse(data);
    } catch (e) {
      console.warn('Error loading course data:', e);
    }
  }, [courseId, currentUser, route?.params?.course]);

  useEffect(() => {
    loadCourseData(true, false);
  }, [loadCourseData]);

  // Real-time re-sync whenever returning from Quiz/Assignment/Discussion
  useFocusEffect(
    useCallback(() => {
      loadCourseData(false, false);
    }, [loadCourseData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCourseData(false, true);
    setRefreshing(false);
  };

  const toggleSection = (secId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

  const handleToggleCompletion = async (moduleId, isCurrentlyCompleted) => {
    const nextState = !isCurrentlyCompleted;

    // 1. Optimistic Real-Time UI update
    setCourse((prev) => {
      if (!prev) return prev;
      let totalTrackable = 0;
      let completedTrackable = 0;

      const updatedSections = (prev.sections || []).map((sec) => ({
        ...sec,
        modules: (sec.modules || []).map((m) => {
          const isTarget = m.id === moduleId;
          const isDone = isTarget ? nextState : m.completed;
          if (m.hasCompletion || m.completionTracking > 0) {
            totalTrackable++;
            if (isDone) completedTrackable++;
          }
          return isTarget ? { ...m, completed: nextState } : m;
        }),
      }));

      const newProgress = totalTrackable > 0 ? Math.round((completedTrackable / totalTrackable) * 100) : prev.progress;

      return {
        ...prev,
        progress: newProgress,
        sections: updatedSections,
      };
    });

    // 2. Persist to live Moodle database
    try {
      const success = await MobileAPI.toggleActivityCompletion(courseId, moduleId, nextState, currentUser);
      if (!success) {
        console.warn('Failed to update activity completion on Moodle (API returned false)');
      }
    } catch (err) {
      console.warn('Failed to update activity completion on Moodle:', err);
    }
  };

  const MODULE_META = {
    quiz:       { icon: HelpCircle,    color: '#6366F1', bg: 'rgba(99,102,241,0.13)',   label: 'Quiz' },
    assign:     { icon: FileText,      color: '#EC4899', bg: 'rgba(236,72,153,0.13)',   label: 'Assignment' },
    forum:      { icon: MessageSquare, color: '#10B981', bg: 'rgba(16,185,129,0.13)',   label: 'Discussion' },
    url:        { icon: Globe,         color: '#06B6D4', bg: 'rgba(6,182,212,0.13)',    label: 'Web Link' },
    scorm:      { icon: Maximize2,     color: '#F97316', bg: 'rgba(249,115,22,0.13)',   label: 'Interactive' },
    lesson:     { icon: BookOpen,      color: '#00AEEF', bg: 'rgba(0,174,239,0.13)',    label: 'Lesson' },
    page:       { icon: FileText,      color: '#00AEEF', bg: 'rgba(0,174,239,0.13)',    label: 'Page' },
    book:       { icon: BookOpen,      color: '#00AEEF', bg: 'rgba(0,174,239,0.13)',    label: 'Book' },
    pdf:        { icon: FileText,      color: '#EF4444', bg: 'rgba(239,68,68,0.13)',    label: 'PDF' },
    video:      { icon: Video,         color: '#F59E0B', bg: 'rgba(245,158,11,0.13)',   label: 'Video' },
    resource:          { icon: File,          color: '#3B82F6', bg: 'rgba(59,130,246,0.13)',   label: 'Resource' },
    customcert:        { icon: Award,         color: '#10B981', bg: 'rgba(16,185,129,0.13)',   label: 'Certificate' },
    certificate:       { icon: Award,         color: '#10B981', bg: 'rgba(16,185,129,0.13)',   label: 'Certificate' },
    simplecertificate: { icon: Award,         color: '#10B981', bg: 'rgba(16,185,129,0.13)',   label: 'Certificate' },
    coursecertificate: { icon: Award,         color: '#10B981', bg: 'rgba(16,185,129,0.13)',   label: 'Certificate' },
    default:           { icon: BookOpen,      color: '#64748B', bg: 'rgba(100,116,139,0.13)',  label: 'Material' },
  };

  const getModuleMeta = (modname, type, isPdf) => {
    if (isPdf || type === 'pdf') return MODULE_META.pdf;
    if (type === 'video') return MODULE_META.video;
    return MODULE_META[modname] || MODULE_META.default;
  };

  const handleModuleClick = async (mod) => {
    const effectiveCourseId = course?.id || courseId;
    const effectiveCourseName = course?.fullname || course?.name || course?.shortname || 'Course';

    if (mod.modname === 'quiz' && (mod.quizId || mod.instance)) {
      navigation.navigate('QuizPlayer', { quizId: mod.quizId || mod.instance, courseId: effectiveCourseId });
    } else if (mod.modname === 'assign' && (mod.assignId || mod.instance)) {
      navigation.navigate('AssignmentView', { assignId: mod.assignId || mod.instance, courseId: effectiveCourseId });
    } else if (mod.modname === 'forum' && (mod.forumId || mod.instance)) {
      navigation.navigate('ForumScreen', { forumId: mod.forumId || mod.instance, courseId: effectiveCourseId });
    } else if (mod.modname === 'lesson' && (mod.lessonId || mod.instance)) {
      navigation.navigate('LessonPlayer', { module: mod, courseId: effectiveCourseId, courseName: effectiveCourseName });
    } else if (mod.modname === 'scorm') {
      navigation.navigate('ScormPlayer', { module: mod, courseId: effectiveCourseId });
    } else {
      // Route other learning modules to CourseContentViewer
      navigation.navigate('CourseContentViewer', {
        module: { ...mod, courseId: effectiveCourseId },
        courseId: effectiveCourseId,
        courseName: effectiveCourseName,
      });
    }
  };

  if (!course) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={{ color: theme.textMuted, marginTop: 12 }}>Loading course curriculum...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>
          {course.shortname || course.fullname}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {course.image ? (
            <Image
              source={{ uri: course.image }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
          ) : null}
          <View style={styles.heroContent}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.badgeBg }]}>
              <Text style={[styles.categoryText, { color: theme.primary }]}>{course.category || 'Course Curriculum'}</Text>
            </View>
            <Text style={[styles.courseTitle, { color: theme.text }]}>{course.fullname}</Text>
            {course.summary ? <Text style={[styles.summary, { color: theme.textMuted }]}>{course.summary}</Text> : null}

            {/* Instructor Row */}
            {course.instructor ? (
              <View style={[styles.instructorCard, { backgroundColor: theme.surfaceSubtle }]}>
                {course.instructorAvatar ? (
                  <Image source={{ uri: course.instructorAvatar }} style={styles.instructorAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.badgeBg }]}>
                    <Text style={[styles.avatarInitial, { color: theme.primary }]}>
                      {course.instructor.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.instructorDetails}>
                  <Text style={[styles.instructorRole, { color: theme.textDim }]}>Instructor</Text>
                  <Text style={[styles.instructorName, { color: theme.text }]}>{course.instructor}</Text>
                </View>
                {course.enrollmentCount > 0 && (
                  <View style={styles.enrolledInfo}>
                    <Users size={14} color={theme.textDim} />
                    <Text style={[styles.enrolledText, { color: theme.textDim }]}>{course.enrollmentCount} students</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Overall Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: theme.text }]}>Course Completion</Text>
                <Text style={[styles.progressVal, { color: theme.primary }]}>{course.progress || 0}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSubtle }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${course.progress || 0}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Course Syllabus / Modules Sections */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Curriculum Modules & Materials</Text>

        {(() => {
          const visibleSections = (course.sections || []).filter(sec => {
            if (!sec.modules || sec.modules.length === 0) return false;
            if (sec.section === 0 && (!sec.name || sec.name.trim() === 'General' || sec.name.trim() === '' || sec.name.trim() === 'अभ्यासक्रम परिचय')) return false;
            return true;
          });
          if (visibleSections.length === 0) {
            return (
              <View style={[styles.emptySectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <BookOpen size={36} color={theme.textDim} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptySectionTitle, { color: theme.text }]}>No Modules Published</Text>
                <Text style={[styles.emptySectionSubtitle, { color: theme.textMuted }]}>
                  There are no published sections or downloadable materials on this Moodle course yet.
                </Text>
              </View>
            );
          }
          return visibleSections.map((section, sIndex) => {
            const isCollapsed = collapsedSections[section.id];
            const totalMods = (section.modules || []).length;
            const completedMods = (section.modules || []).filter(m => m.completed).length;
          return (
            <View
              key={section.id || sIndex}
              style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              {/* Section Header */}
              <TouchableOpacity
                style={[styles.sectionHeader, { borderBottomColor: theme.cardBorder }]}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.sectionAccent, { backgroundColor: theme.primary }]} />
                <View style={styles.sectionHeaderTitle}>
                  <Text style={[styles.sectionName, { color: theme.text }]}>
                    {section.name && section.name.trim() !== 'General' ? section.name.trim() : 'अभ्यासक्रम परिचय'}
                  </Text>
                  <Text style={[styles.sectionMeta, { color: theme.textDim }]}>
                    {completedMods}/{totalMods} completed
                  </Text>
                </View>
                <View style={[styles.sectionBadge, { backgroundColor: theme.badgeBg }]}>
                  <Text style={[styles.sectionBadgeText, { color: theme.primary }]}>{totalMods}</Text>
                </View>
                {isCollapsed ? (
                  <ChevronDown size={18} color={theme.textDim} style={{ marginLeft: 6 }} />
                ) : (
                  <ChevronUp size={18} color={theme.primary} style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>

              {/* Module List */}
              {!isCollapsed && (
                <View style={styles.modulesList}>
                  {(section.modules || []).map((module, mIdx) => {
                    const meta = getModuleMeta(module.modname, module.type, module.isPdf);
                    const IconComponent = meta.icon;
                    const isLast = mIdx === (section.modules.length - 1);
                    return (
                      <TouchableOpacity
                        key={module.id}
                        style={[
                          styles.moduleItem,
                          { borderBottomColor: theme.cardBorder },
                          isLast && styles.moduleItemLast,
                          module.completed && { backgroundColor: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.03)' },
                        ]}
                        onPress={() => handleModuleClick(module)}
                        activeOpacity={0.72}
                      >
                        {/* Icon Bubble */}
                        <View style={[styles.moduleIconBubble, { backgroundColor: meta.bg }]}>
                          <IconComponent size={18} color={meta.color} />
                        </View>

                        {/* Content */}
                        <View style={styles.moduleTextContainer}>
                          <Text style={[styles.moduleName, { color: theme.text }]} numberOfLines={2}>
                            {module.name}
                          </Text>
                          {module.description ? (
                            <Text style={[styles.moduleDesc, { color: theme.textDim }]} numberOfLines={1}>
                              {cleanHtmlToText(module.description)}
                            </Text>
                          ) : null}
                          {/* Type badge */}
                          <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                          </View>
                        </View>

                        {/* Completion toggle */}
                        {(module.completionTracking > 0 || module.hasCompletion) && (
                          <TouchableOpacity
                            style={styles.checkButton}
                            onPress={() => {
                              if (module.completionTracking === 2) {
                                if (module.completed) {
                                  Alert.alert('Completed', 'You have already met the requirements for this activity.');
                                } else {
                                  Alert.alert('Automatic Completion', 'This activity is tracked automatically and will be marked complete when you meet the requirements.');
                                }
                              } else {
                                handleToggleCompletion(module.id, module.completed);
                              }
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            {module.completed ? (
                              <CheckCircle size={22} color="#22C55E" />
                            ) : (
                              <Circle size={22} color={module.completionTracking === 2 ? theme.textMuted : theme.textDim} />
                            )}
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            );
          });
        })()}
      </ScrollView>

      {/* In-App Resource & Lesson Notes Viewer Modal */}
      {selectedPageModal && (
        <Modal
          visible={!!selectedPageModal}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedPageModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.modalCategoryBadge, { backgroundColor: theme.badgeBg }]}>
                    <Text style={[styles.modalCategoryText, { color: theme.primary }]}>
                      {selectedPageModal.isPdf
                        ? 'PDF DOCUMENT'
                        : selectedPageModal.modname === 'url'
                        ? 'WEB RESOURCE'
                        : selectedPageModal.modname === 'page'
                        ? 'LESSON PAGE'
                        : selectedPageModal.modname === 'resource'
                        ? 'COURSE RESOURCE'
                        : 'COURSE MATERIAL'}
                    </Text>
                  </View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedPageModal.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedPageModal(null)} style={styles.modalCloseBtn}>
                  <X size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
                {fetchingContent ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={theme.primary} size="large" />
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginTop: 12 }}>Loading learning material...</Text>
                    <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 4 }}>Preparing interactive content</Text>
                  </View>
                ) : (fetchedText || selectedPageModal.contentHtml) ? (
                  <View style={{ height: 380, marginVertical: 6, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.cardBorder, backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }}>
                    <WebView
                      originWhitelist={['*']}
                      source={{
                        html: generateHtmlPage(fetchedText || selectedPageModal.contentHtml, isDark, theme),
                        baseUrl: 'https://mh.unilearn.org.in',
                      }}
                      style={{ backgroundColor: 'transparent' }}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      scalesPageToFit={false}
                    />
                  </View>
                ) : (
                  <View style={{ paddingVertical: 10 }}>
                    {selectedPageModal.description ? (
                      <Text style={[styles.modalContentText, { color: theme.text, marginBottom: 14 }]}>
                        {cleanHtmlToText(selectedPageModal.description)}
                      </Text>
                    ) : null}
                    <View style={{ padding: 18, backgroundColor: theme.surfaceSubtle, borderRadius: 12, borderWidth: 1, borderColor: theme.cardBorder, alignItems: 'center', marginBottom: 8 }}>
                      <BookOpen size={36} color={theme.primary} style={{ marginBottom: 10 }} />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 4 }}>
                        {selectedPageModal.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textDim, textAlign: 'center', lineHeight: 18 }}>
                        This interactive learning material is part of your registered curriculum. Tap the button below to view the content.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Attached Files List if available */}
                {selectedPageModal.files && selectedPageModal.files.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textDim, marginBottom: 8, letterSpacing: 0.5 }}>
                      ATTACHED COURSE FILES ({selectedPageModal.files.length})
                    </Text>
                    {selectedPageModal.files.map((file, fIdx) => (
                      <TouchableOpacity
                        key={fIdx}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          backgroundColor: theme.surfaceSubtle,
                          borderRadius: 10,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: theme.cardBorder,
                        }}
                        onPress={() => {
                          if (file.fileurl) handleOpenResource(file.fileurl, file.isPdf);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                          <FileText size={18} color={theme.primary} style={{ marginRight: 10 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                              {file.filename}
                            </Text>
                            {file.filesize ? (
                              <Text style={{ fontSize: 11, color: theme.textDim }}>
                                {(file.filesize / 1024).toFixed(1)} KB
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <ExternalLink size={16} color={theme.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Primary Action Button */}
              {selectedPageModal.fileUrl ? (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: selectedPageModal.isPdf ? '#EF4444' : theme.primary }]}
                  onPress={() => {
                    handleOpenResource(selectedPageModal.fileUrl, selectedPageModal.isPdf);
                  }}
                  activeOpacity={0.8}
                >
                  {selectedPageModal.isPdf ? (
                    <Download size={16} color="#FFFFFF" />
                  ) : (
                    <ExternalLink size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.modalActionBtnText}>
                    {selectedPageModal.isPdf
                      ? 'View PDF Document in App'
                      : selectedPageModal.filename
                      ? `Open ${selectedPageModal.filename} in App`
                      : 'Open Interactive Content'}
                  </Text>
                </TouchableOpacity>
              ) : selectedPageModal.url ? (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    handleOpenResource(selectedPageModal.url, false);
                  }}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={16} color="#FFFFFF" />
                  <Text style={styles.modalActionBtnText}>Open Web Resource in App</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginHorizontal: 8,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#1E293B',
  },
  heroContent: {
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  courseTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 26,
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  instructorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
  },
  instructorDetails: {
    flex: 1,
  },
  instructorRole: {
    fontSize: 11,
    fontWeight: '600',
  },
  instructorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  enrolledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enrolledText: {
    fontSize: 12,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  certButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  certButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  sectionAccent: {
    width: 4,
    height: 36,
    borderRadius: 3,
    marginRight: 12,
  },
  sectionHeaderTitle: {
    flex: 1,
  },
  sectionName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 1,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptySectionCard: {
    padding: 36,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySectionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modulesList: {},
  moduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  moduleItemLast: {
    borderBottomWidth: 0,
  },
  moduleIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moduleTextContainer: {
    flex: 1,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 2,
  },
  moduleDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 5,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  checkButton: {
    padding: 4,
    flexShrink: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  modalCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
  modalBody: {
    marginBottom: 16,
    maxHeight: 360,
  },
  modalContentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
