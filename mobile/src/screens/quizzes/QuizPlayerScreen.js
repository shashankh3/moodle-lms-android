import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { MoodleQuizParser } from '../../services/moodleQuizParser';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Flag,
  ArrowRight,
  History,
} from 'lucide-react-native';

export default function QuizPlayerScreen({ route, navigation }) {
  const { quizId, courseId } = route?.params || {};
  const { theme } = useTheme();

  const [quiz, setQuiz] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attemptResult, setAttemptResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);

  // 1. Fetch Quiz Info
  useEffect(() => {
    MobileAPI.getQuizById(quizId, courseId).then(q => {
      setQuiz(q);
      if (q && q.timelimit) setTimeLeft(q.timelimit);
    }).catch(e => {
      Alert.alert('Error', e.message);
    });
  }, [quizId, courseId]);

  // 2. Timer
  useEffect(() => {
    let timer;
    if (isStarted && !isSubmitted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isStarted, isSubmitted, timeLeft]);

  // 3. Start Attempt
  const handleStart = async () => {
    setIsStarted(true);
    try {
      const data = await MobileAPI.getQuizAttemptData(quizId);
      setAttemptData(data);
      if (data.timeLimit) setTimeLeft(data.timeLimit);
      
      // Parse the HTML questions into native JSON
      const parsedQs = data.questions.map(q => {
        const parsed = MoodleQuizParser.parseQuestionHtml(q.html);
        return {
          ...parsed,
          id: q.slot, // Moodle uses slot for navigation
          raw_id: q.slot,
          number: q.number,
        };
      });
      setQuestions(parsedQs);
      
      // Seed sequence checks into selectedAnswers so they are always submitted
      const initialAnswers = {};
      parsedQs.forEach(q => {
        if (q.sequenceCheckName) {
          initialAnswers[q.sequenceCheckName] = q.sequenceCheckValue;
        }
      });
      setSelectedAnswers(initialAnswers);
      
    } catch (e) {
      setIsStarted(false);
      Alert.alert('Error Starting Quiz', e.message);
    }
  };

  const handleSelectOption = (question, optionValue, inputName) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [inputName]: optionValue, // Moodle uses specific input names like q123:1_answer
      [`${question.id}_ui_selection`]: optionValue, // Store a clean copy for UI state
    }));
  };

  const handleShortAnswer = (question, text) => {
    if (question.inputName) {
      setSelectedAnswers(prev => ({
        ...prev,
        [question.inputName]: text,
        [`${question.id}_ui_selection`]: text,
      }));
    }
  };

  const handleToggleFlag = (questionId) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSubmit = async (isAuto = false) => {
    if (!attemptData) return;
    setIsSubmitting(true);
    try {
      // Filter out our custom UI state keys, only send real Moodle input names
      const payload = {};
      Object.keys(selectedAnswers).forEach(k => {
        if (!k.endsWith('_ui_selection')) {
          payload[k] = selectedAnswers[k];
        }
      });

      const review = await MobileAPI.submitQuizAnswers(attemptData.attemptId, payload, 1);
      setAttemptResult(review);
      setIsSubmitted(true);
    } catch (e) {
      Alert.alert('Error Submitting Quiz', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderHTML = (text) => {
    // A simplistic HTML stripper for prompts. In production, use react-native-render-html
    return text.replace(/<[^>]+>/g, '');
  };

  if (!quiz) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={{ color: theme.textMuted, marginTop: 12 }}>Loading quiz...</Text>
      </View>
    );
  }

  const currentQ = questions[currentQIndex] || null;

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
          {quiz.name}
        </Text>
        {isStarted && !isSubmitted && timeLeft > 0 ? (
          <View style={[styles.timerBadge, { backgroundColor: theme.surfaceSubtle }]}>
            <Clock size={14} color={timeLeft < 60 ? theme.error : theme.primary} />
            <Text style={[styles.timerText, { color: timeLeft < 60 ? theme.error : theme.text }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!isStarted && !isSubmitted ? (
          /* Start Screen */
          <View>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={[styles.quizIconWrapper, { backgroundColor: theme.badgeBg }]}>
                <HelpCircle size={36} color={theme.primary} />
              </View>
              <Text style={[styles.quizTitle, { color: theme.text }]}>{quiz.name}</Text>
              <Text style={[styles.quizIntro, { color: theme.textMuted }]}>{renderHTML(quiz.intro || '')}</Text>

              <View style={styles.specGrid}>
                <View style={[styles.specItem, { backgroundColor: theme.surfaceSubtle }]}>
                  <Clock size={18} color={theme.primary} />
                  <Text style={[styles.specVal, { color: theme.text }]}>
                    {quiz.timelimit ? Math.round(quiz.timelimit / 60) + ' Mins' : 'None'}
                  </Text>
                  <Text style={[styles.specLabel, { color: theme.textDim }]}>Time Limit</Text>
                </View>
                <View style={[styles.specItem, { backgroundColor: theme.surfaceSubtle }]}>
                  <Award size={18} color={theme.warning} />
                  <Text style={[styles.specVal, { color: theme.text }]}>{quiz.grade || 100} Pts</Text>
                  <Text style={[styles.specLabel, { color: theme.textDim }]}>Max Grade</Text>
                </View>
              </View>

              {quiz.canAttempt ? (
                <TouchableOpacity style={[styles.startBtn, { backgroundColor: theme.primary }]} onPress={handleStart}>
                  <Text style={styles.startBtnText}>{quiz.hasInProgress ? 'Continue Attempt' : 'Attempt Quiz Now'}</Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.gradedNotice, { backgroundColor: theme.warningBg }]}>
                  <XCircle size={16} color={theme.warning} />
                  <Text style={[styles.gradedNoticeText, { color: theme.warning }]}>
                    You have reached the maximum number of attempts allowed for this quiz.
                  </Text>
                </View>
              )}
            </View>

            {/* Previous Attempts History */}
            {quiz.attemptHistory && quiz.attemptHistory.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                  <History size={18} color={theme.text} />
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Previous Attempts</Text>
                </View>
                
                {quiz.attemptHistory.map((attempt, index) => (
                  <View key={attempt.id} style={[styles.attemptRow, { borderBottomColor: theme.cardBorder }]}>
                    <View>
                      <Text style={[styles.attemptNumber, { color: theme.text }]}>Attempt {attempt.attempt}</Text>
                      <Text style={[styles.attemptState, { color: attempt.state === 'finished' ? theme.success : theme.textMuted }]}>
                        {attempt.state === 'finished' ? 'Finished' : attempt.state === 'inprogress' ? 'In Progress' : 'Abandoned'}
                      </Text>
                    </View>
                    {attempt.state === 'finished' && attempt.sumgrades !== undefined && (
                      <View style={[styles.gradeBadge, { backgroundColor: theme.successBg }]}>
                        <Text style={[styles.gradeText, { color: theme.success }]}>{attempt.sumgrades} / {quiz.sumgrades || quiz.grade || '-'}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : isSubmitted && attemptResult ? (
          /* Review Screen */
          <View>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={[styles.resultBadge, { backgroundColor: attemptResult.grade >= (quiz.grade / 2) ? theme.successBg : theme.errorBg }]}>
                {attemptResult.grade >= (quiz.grade / 2) ? (
                  <CheckCircle2 size={44} color={theme.success} />
                ) : (
                  <XCircle size={44} color={theme.error} />
                )}
                <Text style={[styles.resultTitle, { color: attemptResult.grade >= (quiz.grade / 2) ? theme.success : theme.error }]}>
                  {attemptResult.grade >= (quiz.grade / 2) ? 'Quiz Passed!' : 'Needs Review'}
                </Text>
                <Text style={[styles.resultScore, { color: theme.text }]}>
                  Score: {attemptResult.grade || attemptResult.sumgrades || '0'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.retakeBtn, { borderColor: theme.primary }]} onPress={() => navigation.goBack()}>
                <ArrowLeft size={16} color={theme.primary} />
                <Text style={[styles.retakeBtnText, { color: theme.primary }]}>Return to Course</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : attemptData && questions.length === 0 ? (
           /* Loading Questions */
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={{ color: theme.textMuted, marginTop: 12 }}>Loading questions...</Text>
          </View>
        ) : currentQ ? (
          /* Active Question */
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qNavScroll}>
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQIndex;
                const isAnswered = selectedAnswers[`${q.id}_ui_selection`] !== undefined;
                return (
                  <TouchableOpacity
                    key={q.id}
                    style={[
                      styles.qNavPill,
                      {
                        backgroundColor: isCurrent ? theme.primary : isAnswered ? theme.surfaceSubtle : theme.card,
                        borderColor: isCurrent ? theme.primary : theme.cardBorder,
                      },
                    ]}
                    onPress={() => setCurrentQIndex(idx)}
                  >
                    <Text style={[styles.qNavPillText, { color: isCurrent ? '#FFFFFF' : theme.text }]}>
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.qHeader}>
                <Text style={[styles.qCounter, { color: theme.textDim }]}>
                  Question {currentQIndex + 1} of {questions.length}
                </Text>
              </View>

              <Text style={[styles.promptText, { color: theme.text }]}>{currentQ.prompt}</Text>

              {/* Options */}
              {currentQ.type === 'multichoice' || currentQ.type === 'truefalse' ? (
                <View style={styles.optionsList}>
                  {currentQ.options.map(opt => {
                    const isSelected = selectedAnswers[`${currentQ.id}_ui_selection`] === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionItem,
                          {
                            backgroundColor: isSelected ? theme.badgeBg : theme.surfaceSubtle,
                            borderColor: isSelected ? theme.primary : theme.cardBorder,
                          },
                        ]}
                        onPress={() => handleSelectOption(currentQ, opt.value, opt.inputName)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.radioCircle, { borderColor: isSelected ? theme.primary : theme.textDim }]}>
                          {isSelected && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
                        </View>
                        <Text style={[styles.optionText, { color: isSelected ? theme.primary : theme.text }]}>{opt.text}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : currentQ.type === 'shortanswer' ? (
                <View style={styles.optionsList}>
                   <TextInput
                     style={[styles.textInput, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.surfaceSubtle }]}
                     placeholder="Type your answer here..."
                     placeholderTextColor={theme.textDim}
                     value={selectedAnswers[`${currentQ.id}_ui_selection`] || ''}
                     onChangeText={(text) => handleShortAnswer(currentQ, text)}
                   />
                </View>
              ) : currentQ.type === 'essay' ? (
                <View style={styles.optionsList}>
                   <TextInput
                     style={[
                       styles.textInput,
                       {
                         color: theme.text,
                         borderColor: theme.cardBorder,
                         backgroundColor: theme.surfaceSubtle,
                         height: 140,
                         textAlignVertical: 'top',
                         paddingTop: 12,
                       },
                     ]}
                     multiline
                     placeholder="Type your answer here..."
                     placeholderTextColor={theme.textDim}
                     value={selectedAnswers[`${currentQ.id}_ui_selection`] || ''}
                     onChangeText={(text) => handleShortAnswer(currentQ, text)}
                   />
                </View>
              ) : currentQ.type === 'match' ? (
                <View style={styles.optionsList}>
                  {currentQ.subQuestions.map((subQ) => (
                    <View key={subQ.id} style={[styles.matchContainer, { borderColor: theme.cardBorder }]}>
                      <Text style={[styles.subQText, { color: theme.text }]}>{subQ.text}</Text>
                      <View style={styles.matchOptions}>
                        {currentQ.options.map(opt => {
                          const isSelected = selectedAnswers[`${currentQ.id}_${subQ.id}_ui_selection`] === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[
                                styles.matchOptionItem,
                                {
                                  backgroundColor: isSelected ? theme.badgeBg : theme.surfaceSubtle,
                                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                                }
                              ]}
                              onPress={() => {
                                setSelectedAnswers(prev => ({
                                  ...prev,
                                  [subQ.inputName]: opt.value,
                                  [`${currentQ.id}_${subQ.id}_ui_selection`]: opt.value,
                                }));
                              }}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.optionText, { color: isSelected ? theme.primary : theme.text, fontSize: 13 }]}>{opt.text}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: theme.error }}>Unsupported question type ({currentQ.type}). Please skip.</Text>
              )}
            </View>

            {/* Nav */}
            <View style={styles.navControls}>
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: theme.surfaceSubtle, opacity: currentQIndex === 0 ? 0.4 : 1 }]}
                disabled={currentQIndex === 0}
                onPress={() => setCurrentQIndex(prev => prev - 1)}
              >
                <Text style={[styles.navBtnText, { color: theme.text }]}>Previous</Text>
              </TouchableOpacity>

              {currentQIndex < questions.length - 1 ? (
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.primary }]} onPress={() => setCurrentQIndex(prev => prev + 1)}>
                  <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: theme.success }]} onPress={() => handleSubmit()} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>Submit Quiz</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 16, paddingBottom: 12, borderBottomWidth: 1 },
  backButton: { padding: 4 },
  topBarTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 10 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  timerText: { fontSize: 13, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 16 },
  quizIconWrapper: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  quizTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  quizIntro: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  specGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 24 },
  specItem: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12 },
  specVal: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  specLabel: { fontSize: 11, marginTop: 2 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14, gap: 8 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  qNavScroll: { gap: 8, paddingBottom: 14 },
  qNavPill: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  qNavPillText: { fontSize: 14, fontWeight: '700' },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  qCounter: { fontSize: 12, fontWeight: '600' },
  promptText: { fontSize: 16, fontWeight: '600', lineHeight: 23, marginBottom: 18 },
  optionsList: { gap: 10 },
  optionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 14, flex: 1, fontWeight: '500' },
  textInput: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  navControls: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  navBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 15, fontWeight: '700' },
  resultBadge: { alignItems: 'center', padding: 20, borderRadius: 14, marginBottom: 16 },
  resultTitle: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  resultScore: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, borderWidth: 1, gap: 8 },
  retakeBtnText: { fontSize: 14, fontWeight: '700' },
  gradedNotice: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, gap: 8, marginTop: 10 },
  gradedNoticeText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  attemptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  attemptNumber: { fontSize: 14, fontWeight: '600' },
  attemptState: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  gradeText: { fontSize: 13, fontWeight: '700' },
  matchContainer: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 4 },
  subQText: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  matchOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  matchOptionItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});
