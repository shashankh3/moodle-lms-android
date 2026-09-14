import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { showMessage } from '../../utils/alert';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Send,
  AlertCircle,
  Info,
} from 'lucide-react-native';

export default function AssignmentViewScreen({ route, navigation }) {
  const { assignId, courseId } = route?.params || {};
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [assignment, setAssignment] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAssignment();
  }, [assignId, courseId]);

  const loadAssignment = async () => {
    try {
      const data = await MobileAPI.getAssignmentById(assignId, courseId);
      setAssignment(data);
      if (data.submittedText) {
        setSubmissionText(data.submittedText);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!submissionText.trim()) {
      showMessage('Incomplete', 'Please provide submission text.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await MobileAPI.submitAssignment(
        assignment.id,
        submissionText,
        null
      );
      setAssignment(updated);
      showMessage('Success', 'Your assignment has been submitted.');
    } catch (err) {
      showMessage('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDueDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (error) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <AlertCircle size={40} color={theme.error} />
        <Text style={{ color: theme.error, marginTop: 12 }}>{error}</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={{ color: theme.textMuted, marginTop: 12 }}>Loading assignment...</Text>
      </View>
    );
  }

  const isNoSubmissionRequired = assignment.noSubmissions || !assignment.submissionsEnabled;
  const isSubmitted = assignment.submissionStatus === 'submitted';
  const isDraft = assignment.submissionStatus === 'draft';
  const isGraded = assignment.gradingStatus === 'graded';
  
  // Can only edit if submissions are enabled and user has permission to submit/edit
  const canEdit = !isNoSubmissionRequired && !isGraded && (assignment.canEdit !== false) && (assignment.canSubmit !== false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>
          {assignment.name || 'Assignment'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Assignment Hero Info */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isGraded
                    ? theme.successBg
                    : isSubmitted
                    ? theme.badgeBg
                    : isDraft
                    ? theme.warningBg
                    : theme.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isGraded
                      ? theme.success
                      : isSubmitted
                      ? theme.primary
                      : isDraft
                      ? theme.warning
                      : theme.textDim,
                  },
                ]}
              >
                {isGraded ? 'Graded' : isSubmitted ? 'Submitted for Grading' : isDraft ? 'Draft Saved' : 'Not Submitted'}
              </Text>
            </View>

            {assignment.maxGrade && assignment.maxGrade > 0 ? (
              <Text style={[styles.maxGradeText, { color: theme.textDim }]}>Max: {assignment.maxGrade} Pts</Text>
            ) : null}
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{assignment.name}</Text>

          {assignment.dueDate && (
            <View style={styles.metaRow}>
              <Calendar size={14} color={theme.textDim} />
              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                Due: {formatDueDate(assignment.dueDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        {assignment.instructions ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
            <Text style={[styles.instructionsText, { color: theme.textMuted }]}>{assignment.instructions}</Text>
          </View>
        ) : null}

        {/* Dynamic Submission Area / Supervisor Activity Info */}
        {isNoSubmissionRequired ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 120 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Info size={20} color={theme.primary} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 4 }]}>
                  {t('activity_status', 'Activity Details')}
                </Text>
                <Text style={[styles.instructionsText, { color: theme.textMuted, lineHeight: 22 }]}>
                  {t('no_submission_required_desc', 'This activity is evaluated directly by the supervisor/instructor. No online submission is required.')}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 120 }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Submission</Text>
            
            <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder }]}>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Type your response here..."
                placeholderTextColor={theme.textDim}
                multiline
                textAlignVertical="top"
                value={submissionText}
                onChangeText={setSubmissionText}
                editable={canEdit}
              />
            </View>
            
            {canEdit ? (
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 },
                ]}
                onPress={handleSubmitAssignment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Submit Assignment</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.gradedNotice, { backgroundColor: isGraded ? theme.successBg : theme.surfaceSubtle }]}>
                <CheckCircle2 size={16} color={isGraded ? theme.success : theme.textDim} />
                <Text style={[styles.gradedNoticeText, { color: isGraded ? theme.success : theme.textDim }]}>
                  {isGraded
                    ? 'This assignment has been graded and cannot be edited.'
                    : 'Submissions are currently closed for this activity.'}
                </Text>
              </View>
            )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  backButton: {
    padding: 4,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginHorizontal: 10,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  maxGradeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 15,
    lineHeight: 22,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
    minHeight: 150,
  },
  textInput: {
    fontSize: 16,
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  gradedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
  },
  gradedNoticeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
