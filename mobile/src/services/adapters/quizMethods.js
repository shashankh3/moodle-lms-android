import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const quizMethods = {
    async getQuizById(quizId, courseId) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');
    
    // 1. Fetch Quiz Info
    const res = await client.getQuizzesByCourses([courseId]);
    let q = null;
    if (res && res.quizzes) {
      q = res.quizzes.find(x => x.id === quizId || x.coursemodule === quizId);
    }
    
    if (!q) return null;

    // 2. Fetch User Attempts for this Quiz
    try {
      const attemptsRes = await client.getUserAttempts(q.id);
      q.attemptHistory = attemptsRes?.attempts || [];
      
      // Check if there's an in-progress attempt
      q.hasInProgress = q.attemptHistory.some(a => a.state === 'inprogress');
      
      // Determine if they can still attempt
      // If attempts limit is set and they've reached it (and no inprogress)
      q.canAttempt = true;
      if (q.attempts > 0) {
        const finishedAttempts = q.attemptHistory.filter(a => a.state === 'finished' || a.state === 'abandoned').length;
        if (finishedAttempts >= q.attempts && !q.hasInProgress) {
          q.canAttempt = false;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch quiz attempts:', e);
      q.attemptHistory = [];
      q.hasInProgress = false;
      q.canAttempt = true;
    }

    return q;
  },

    async getQuizAttemptData(quizId) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');

    // 1. Get User Attempts
    const attemptsRes = await client.getUserAttempts(quizId);
    let attempt = null;
    
    // Look for in-progress attempt
    if (attemptsRes && attemptsRes.attempts && attemptsRes.attempts.length > 0) {
      attempt = attemptsRes.attempts.find(a => a.state === 'inprogress');
    }

    // 2. Start new attempt if none in progress
    if (!attempt) {
      const startRes = await client.startQuizAttempt(quizId);
      if (startRes && startRes.attempt) {
        attempt = startRes.attempt;
      } else {
        throw new Error(startRes.message || 'Failed to start quiz attempt. You may have reached the attempt limit.');
      }
    }

    // 3. Get Attempt Data (Questions)
    const dataRes = await client.getAttemptData(attempt.id, 0);
    if (!dataRes || !dataRes.questions) {
      throw new Error('No questions returned from Moodle');
    }

    return {
      attemptId: attempt.id,
      state: attempt.state,
      questions: dataRes.questions,
      timeLimit: dataRes.nextpage >= 0 ? 600 : 0, // Fallback, real timelimit would come from quiz info
    };
  },

    async submitQuizAnswers(attemptId, answers = {}, finishAttempt = 0) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');

    // Convert answers map into Moodle WS data array format
    const data = [];
    Object.keys(answers).forEach(name => {
      data.push({ name, value: String(answers[name]) });
    });

    const res = await client.processAttempt(attemptId, data, finishAttempt);
    if (res && res.state && finishAttempt) {
      const reviewRes = await client.getAttemptReview(attemptId);
      return reviewRes;
    }
    return res;
  },
};
