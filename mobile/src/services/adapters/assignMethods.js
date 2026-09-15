import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../adapterUtils';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const assignMethods = {
    async getAssignmentById(assignId, courseId = null) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');

    try {
      let courseIdsToSearch = courseId ? [courseId] : [];
      if (courseIdsToSearch.length === 0) {
        const courses = await this.getCourses();
        courseIdsToSearch = courses.map((c) => c.id);
      }
      if (courseIdsToSearch.length === 0) courseIdsToSearch = [1];

      const assigns = await client.getAssignments(courseIdsToSearch);
      let foundAssign = null;

      if (assigns && Array.isArray(assigns.courses)) {
        const parsedTargetId = parseInt(assignId, 10);
        for (let i = 0; i < assigns.courses.length; i++) {
          const c = assigns.courses[i];
          const courseAssignments = c && Array.isArray(c.assignments) ? c.assignments : [];
          for (let j = 0; j < courseAssignments.length; j++) {
            const a = courseAssignments[j];
            if (a && (parseInt(a.id, 10) === parsedTargetId || parseInt(a.cmid, 10) === parsedTargetId)) {
              foundAssign = a;
              break;
            }
          }
          if (foundAssign) {
            break;
          }
        }
      }

      if (!foundAssign) {
        throw new Error('Assignment not found');
      }

      // 2. Get real submission status
      const statusRes = await client.getSubmissionStatus(foundAssign.id);
      const lastAttempt = statusRes?.lastattempt || {};
      const submission = lastAttempt?.submission || {};
      const grading = lastAttempt?.gradingstatus || 'notgraded';
      
      let submissionStatus = 'not_submitted';
      if (submission.status === 'submitted') submissionStatus = 'submitted';
      else if (submission.status === 'draft') submissionStatus = 'draft';

      let gradingStatus = grading === 'graded' ? 'graded' : 'not_graded';

      // Find any existing online text submission plugin
      const textPlugin = (submission.plugins || []).find(p => p.type === 'onlinetext');
      const submittedText = textPlugin && textPlugin.editorfields ? textPlugin.editorfields[0]?.text : null;

      return {
        id: foundAssign.id,
        name: foundAssign.name,
        courseId: foundAssign.course,
        dueDate: foundAssign.duedate ? new Date(foundAssign.duedate * 1000).toISOString() : null,
        submissionStatus,
        gradingStatus,
        instructions: foundAssign.intro ? foundAssign.intro.replace(/<[^>]*>?/gm, '').trim() : '',
        maxGrade: foundAssign.grade,
        submittedText,
        noSubmissions: foundAssign.nosubmissions === 1 || lastAttempt?.submissionsenabled === false,
        canSubmit: !!lastAttempt?.cansubmit,
        canEdit: !!lastAttempt?.canedit,
        submissionsEnabled: lastAttempt?.submissionsenabled !== false && foundAssign.nosubmissions !== 1,
        locked: !!lastAttempt?.locked,
        submissions: [],
        isLive: true,
      };

    } catch (e) {
      console.warn('Live getAssignmentById error:', e);
      throw e;
    }
  },

    async submitAssignment(assignId, submissionText, file) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');

    try {
      const pluginData = {};
      
      if (submissionText) {
        pluginData.onlinetext_editor = {
          text: submissionText,
          format: 1, // HTML
          itemid: 0,
        };
      }

      // Note: File uploads require uploading to draft file area first.
      // Phase 1: Supporting Online Text primarily.

      await client.saveSubmission(assignId, pluginData);
      
      // Tell Moodle this is ready for grading (if required by assignment settings, 
      // some assignments don't require explicit submit button, but calling it is safe).
      try {
        await client.submitForGrading(assignId, 1);
      } catch (submitErr) {
        // Safe to ignore, often means "Requires explicit accept submission statement" or already submitted
        console.log('submitForGrading note:', submitErr.message);
      }

      return await this.getAssignmentById(assignId);
    } catch (e) {
      console.warn('Real Moodle saveSubmission error:', e);
      throw e;
    }
  },

};
