// Moodle REST API Client for Mobile
// Comprehensive Moodle Web Services client for REST protocol (moodlewsrestformat=json)

export function normalizeMoodleUrl(url) {
  if (!url || typeof url !== 'string') return 'https://sandbox.moodledemo.net';
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (
      clean.startsWith('localhost') ||
      clean.startsWith('127.0.0.1') ||
      clean.startsWith('10.') ||
      clean.startsWith('192.168.')
    ) {
      clean = 'http://' + clean;
    } else {
      clean = 'https://' + clean;
    }
  }
  clean = clean.replace(/\/+$/, '');
  clean = clean.replace(/\/login\/token\.php.*$/i, '');
  clean = clean.replace(/\/login\/index\.php.*$/i, '');
  clean = clean.replace(/\/webservice\/rest\/server\.php.*$/i, '');
  return clean;
}

export async function getPublicConfig(serverUrl) {
  const endpoint = `${normalizeMoodleUrl(serverUrl)}/webservice/rest/server.php`;
  const bodyParams = new URLSearchParams();
  bodyParams.append('wsfunction', 'tool_mobile_get_public_config');
  bodyParams.append('moodlewsrestformat', 'json');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'MoodleMobile',
    },
    body: bodyParams.toString(),
  });
  if (!res.ok) throw new Error('Network response was not ok');
  return await res.json();
}

export class MoodleClient {
  constructor(baseUrl = 'https://sandbox.moodledemo.net', token = '', onLog = null) {
    this.baseUrl = normalizeMoodleUrl(baseUrl);
    this.token = token ? token.trim() : '';
    this.onLog = onLog;
  }

  setToken(token) {
    this.token = token ? token.trim() : '';
  }

  setBaseUrl(url) {
    this.baseUrl = normalizeMoodleUrl(url);
  }

  logRequest(method, wsfunction, params, response, duration, error = null) {
    if (typeof this.onLog === 'function') {
      this.onLog({
        id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        wsfunction,
        endpoint: `${this.baseUrl}/webservice/rest/server.php`,
        method,
        params,
        response,
        duration: Math.round(duration),
        status: error ? 'error' : 'success',
        error: error ? error.message : null,
      });
    }
  }

  // --- Authentication with Moodle /login/token.php ---
  async loginWithCredentials(username, password, service = 'moodle_mobile_app') {
    const startTime = Date.now();
    const cleanUrl = normalizeMoodleUrl(this.baseUrl);
    this.baseUrl = cleanUrl;
    const endpoint = `${cleanUrl}/login/token.php`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('username', (username || '').trim());
    bodyParams.append('password', password || '');
    if (service) {
      bodyParams.append('service', service.trim());
    }

    let rawResponse = null;
    let fetchError = null;

    // 1. Try POST request first
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'MoodleMobile',
        },
        body: bodyParams.toString(),
      });

      if (response.ok) {
        const text = await response.text();
        try {
          rawResponse = JSON.parse(text);
        } catch (e) {
          throw new Error(`Moodle returned non-JSON response: ${text.substring(0, 100)}`);
        }
      } else {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
    } catch (postErr) {
      fetchError = postErr;
    }

    const duration = Date.now() - startTime;

    if (fetchError || !rawResponse) {
      const err = new Error(
        `Could not reach Moodle server at ${endpoint}. ${fetchError ? fetchError.message : 'No response'}. Check URL and network connectivity.`
      );
      this.logRequest('POST', 'login/token.php', { username, service }, null, duration, err);
      throw err;
    }

    if (rawResponse.error) {
      const err = new Error(rawResponse.error || 'Authentication failed');
      err.errorcode = rawResponse.errorcode;
      this.logRequest('POST', 'login/token.php', { username, service }, rawResponse, duration, err);
      throw err;
    }

    if (!rawResponse.token) {
      const err = new Error('No token returned. Verify that Moodle Web Services (moodle_mobile_app) are enabled.');
      this.logRequest('POST', 'login/token.php', { username, service }, rawResponse, duration, err);
      throw err;
    }

    this.setToken(rawResponse.token);
    this.logRequest('POST', 'login/token.php', { username, service }, { token: '***' + rawResponse.token.slice(-6) }, duration, null);

    // Fetch site info safely with fallback
    let siteInfo = null;
    try {
      siteInfo = await this.getSiteInfo();
    } catch (siteErr) {
      console.warn('getSiteInfo failed after token generation, using fallback profile:', siteErr);
      siteInfo = {
        sitename: this.baseUrl.replace(/^https?:\/\//, ''),
        username: username,
        firstname: username,
        lastname: 'User',
        fullname: username,
        userissiteadmin: false,
        userid: 2,
      };
    }

    return {
      token: rawResponse.token,
      privatetoken: rawResponse.privatetoken || null,
      siteInfo,
    };
  }

  // --- Universal REST Web Services Caller ---
  async call(wsfunction, params = {}, method = 'POST') {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/webservice/rest/server.php`;

    const searchParams = new URLSearchParams();
    searchParams.append('wstoken', this.token);
    searchParams.append('wsfunction', wsfunction);
    searchParams.append('moodlewsrestformat', 'json');

    // Recursively flatten nested params for Moodle form encoding
    const appendParam = (key, val) => {
      if (val === undefined || val === null) return;
      if (Array.isArray(val)) {
        val.forEach((item, index) => {
          appendParam(`${key}[${index}]`, item);
        });
      } else if (typeof val === 'object') {
        Object.entries(val).forEach(([subKey, subVal]) => {
          appendParam(`${key}[${subKey}]`, subVal);
        });
      } else {
        searchParams.append(key, String(val));
      }
    };

    Object.entries(params).forEach(([k, v]) => appendParam(k, v));

    let data = null;
    let lastError = null;

    // Try primary method with fallback to alternate method
    const methodsToTry = method.toUpperCase() === 'GET' ? ['GET', 'POST'] : ['POST', 'GET'];

    for (const tryMethod of methodsToTry) {
      try {
        let response;
        if (tryMethod === 'GET') {
          response = await fetch(`${endpoint}?${searchParams.toString()}`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'MoodleMobile',
            },
          });
        } else {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
              'User-Agent': 'MoodleMobile',
            },
            body: searchParams.toString(),
          });
        }

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        try {
          data = JSON.parse(text);
          lastError = null;
          break;
        } catch (jsonErr) {
          throw new Error(`Invalid JSON from Moodle: ${text.substring(0, 120)}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    const duration = Date.now() - startTime;

    if (lastError) {
      this.logRequest(method, wsfunction, params, null, duration, lastError);
      throw new Error(`Moodle API call to ${wsfunction} failed: ${lastError.message}`);
    }

    if (data && data.exception) {
      const err = new Error(data.message || data.exception);
      err.errorcode = data.errorcode;
      err.debuginfo = data.debuginfo;
      this.logRequest(method, wsfunction, params, data, duration, err);
      throw err;
    }

    if (data && data.errorcode) {
      const err = new Error(data.message || data.errorcode);
      err.errorcode = data.errorcode;
      this.logRequest(method, wsfunction, params, data, duration, err);
      throw err;
    }

    this.logRequest(method, wsfunction, params, data, duration, null);
    return data;
  }

  // ==========================================
  // 1. CORE SITE & USER FUNCTIONS
  // ==========================================

  async getSiteInfo() {
    return this.call('tool_mobile_get_site_info', {}, 'POST');
  }

  async getUsersByField(field = 'id', values = []) {
    return this.call('core_user_get_users_by_field', { field, values }, 'POST');
  }

  async getUserPreferences(name = '') {
    return this.call('core_user_get_user_preferences', name ? { name } : {}, 'POST');
  }

  async updateUserPreferences(preferences = []) {
    return this.call('core_user_update_user_preferences', { preferences }, 'POST');
  }

  async getCourseUserProfiles(userlist = []) {
    return this.call('core_user_get_course_user_profiles', { userlist }, 'POST');
  }

  // ==========================================
  // 2. COURSES & ENROLMENT FUNCTIONS
  // ==========================================

  async getUsersCourses(userId) {
    return this.call(
      'core_enrol_get_users_courses',
      {
        userid: userId,
        returnusercount: 0,
      },
      'POST'
    );
  }

  async getCoursesByField(field = '', value = '') {
    return this.call('core_course_get_courses_by_field', { field, value }, 'POST');
  }

  async getCourseContents(courseId, options = null) {
    const params = { courseid: courseId };
    if (Array.isArray(options) && options.length > 0) {
      params.options = options;
    }
    return this.call('core_course_get_contents', params, 'POST');
  }

  async getCategories(criteria = []) {
    return this.call('core_course_get_categories', { criteria }, 'POST');
  }

  async getEnrolledUsers(courseId, options = []) {
    return this.call('core_enrol_get_enrolled_users', { courseid: courseId, options }, 'POST');
  }

  async getCourseUpdates(courseId, since = 0) {
    return this.call('core_course_get_updates_since', { courseid: courseId, since }, 'POST');
  }

  async getActivityCompletionStatus(courseId, userId) {
    return this.call('core_completion_get_activities_completion_status', { courseid: courseId, userid: userId }, 'POST');
  }

  async getCourseCompletionStatus(courseId, userId) {
    return this.call('core_completion_get_course_completion_status', { courseid: courseId, userid: userId }, 'POST');
  }

  async updateActivityCompletion(cmId, completed = true) {
    return this.call('core_completion_update_activity_completion_status_manually', {
      cmid: cmId,
      completed: completed ? 1 : 0,
    }, 'POST');
  }

  // ==========================================
  // 3. ASSIGNMENTS FUNCTIONS (mod_assign)
  // ==========================================

  async getAssignments(courseIds = [], includenotenrolledcourses = 0) {
    return this.call('mod_assign_get_assignments', { courseids: courseIds, includenotenrolledcourses }, 'POST');
  }

  async getSubmissions(assignmentIds = []) {
    return this.call('mod_assign_get_submissions', { assignmentids: assignmentIds }, 'POST');
  }

  async getSubmissionStatus(assignId, userId = 0) {
    return this.call('mod_assign_get_submission_status', { assignid: assignId, userid: userId }, 'POST');
  }

  async saveSubmission(assignId, pluginData = {}) {
    return this.call('mod_assign_save_submission', {
      assignmentid: assignId,
      plugindata: pluginData,
    }, 'POST');
  }

  async submitForGrading(assignId, acceptSubmissionStatement = 1) {
    return this.call('mod_assign_submit_for_grading', {
      assignmentid: assignId,
      acceptsubmissionstatement: acceptSubmissionStatement,
    }, 'POST');
  }

  async saveGrade(assignId, userId, grade, attemptNumber = -1, addAttempt = 0, workflowState = '', applyToAll = 1, plugindata = {}) {
    return this.call('mod_assign_save_grade', {
      assignmentid: assignId,
      userid: userId,
      grade: grade,
      attemptnumber: attemptNumber,
      addattempt: addAttempt,
      workflowstate: workflowState,
      applytoall: applyToAll,
      plugindata,
    }, 'POST');
  }

  async getAssignmentParticipants(assignId, groupId = 0) {
    return this.call('mod_assign_get_participant', { assignid: assignId, groupid: groupId }, 'POST');
  }

  // ==========================================
  // 4. QUIZZES FUNCTIONS (mod_quiz)
  // ==========================================

  async getQuizzesByCourses(courseIds = []) {
    return this.call('mod_quiz_get_quizzes_by_courses', { courseids: courseIds }, 'POST');
  }

  async startQuizAttempt(quizId) {
    return this.call('mod_quiz_start_attempt', { quizid: quizId }, 'POST');
  }

  async getAttemptData(attemptId, page = 0) {
    return this.call('mod_quiz_get_attempt_data', { attemptid: attemptId, page }, 'POST');
  }

  async getAttemptSummary(attemptId) {
    return this.call('mod_quiz_get_attempt_summary', { attemptid: attemptId }, 'POST');
  }

  async processAttempt(attemptId, data = [], finishAttempt = 0) {
    return this.call('mod_quiz_process_attempt', {
      attemptid: attemptId,
      data,
      finishattempt: finishAttempt,
    }, 'POST');
  }

  async getUserAttempts(quizId, userId = 0, status = 'all') {
    return this.call('mod_quiz_get_user_attempts', { quizid: quizId, userid: userId, status }, 'POST');
  }

  async getAttemptReview(attemptId, page = -1) {
    return this.call('mod_quiz_get_attempt_review', { attemptid: attemptId, page }, 'POST');
  }

  // ==========================================
  // 4B. LESSON FUNCTIONS (mod_lesson)
  // ==========================================

  async getLessonsByCourses(courseIds = []) {
    return this.call('mod_lesson_get_lessons_by_courses', { courseids: courseIds }, 'POST');
  }

  async getLessonPages(lessonId) {
    return this.call('mod_lesson_get_pages', { lessonid: lessonId }, 'POST');
  }

  async getLessonPageData(lessonId, pageId) {
    return this.call('mod_lesson_get_page_data', { lessonid: lessonId, pageid: pageId }, 'POST');
  }

  async launchLessonAttempt(lessonId) {
    return this.call('mod_lesson_launch_attempt', { lessonid: lessonId }, 'POST');
  }

  async processLessonPage(lessonId, pageId, data = []) {
    return this.call('mod_lesson_process_page', {
      lessonid: lessonId,
      pageid: pageId,
      data,
    }, 'POST');
  }

  // ==========================================
  // 5. FORUMS FUNCTIONS (mod_forum)
  // ==========================================

  async getForumsByCourses(courseIds = []) {
    return this.call('mod_forum_get_forums_by_courses', { courseids: courseIds }, 'POST');
  }

  async getForumDiscussions(forumId, page = 0, perPage = 20, sortOrder = 1) {
    return this.call('mod_forum_get_forum_discussions', {
      forumid: forumId,
      page,
      perpage: perPage,
      sortorder: sortOrder,
    }, 'POST');
  }

  async getDiscussionPosts(discussionId, sortby = 'created', sortdirection = 'ASC') {
    return this.call('mod_forum_get_discussion_posts', {
      discussionid: discussionId,
      sortby,
      sortdirection,
    }, 'POST');
  }

  async addDiscussion(forumId, subject, message, groupId = -1, options = []) {
    return this.call('mod_forum_add_discussion', {
      forumid: forumId,
      subject,
      message,
      groupid: groupId,
      options,
    }, 'POST');
  }

  async addDiscussionPost(postid, subject, message, options = []) {
    return this.call('mod_forum_add_discussion_post', {
      postid,
      subject,
      message,
      options,
    }, 'POST');
  }

  async togglePinDiscussion(discussionId, targetPinState = 1) {
    return this.call('mod_forum_set_pin_state', {
      discussionid: discussionId,
      targetstate: targetPinState,
    }, 'POST');
  }

  async toggleFavouriteDiscussion(discussionId, targetState = 1) {
    return this.call('mod_forum_toggle_favourite_state', {
      discussionid: discussionId,
      targetstate: targetState,
    }, 'POST');
  }

  // ==========================================
  // 6. GRADEBOOK FUNCTIONS
  // ==========================================

  async getUserGradeItems(courseId, userId = 0) {
    return this.call('gradereport_user_get_grade_items', {
      courseid: courseId,
      userid: userId,
    }, 'POST');
  }

  async getCourseGrades(userId = 0) {
    return this.call('gradereport_overview_get_course_grades', {
      userid: userId,
    }, 'POST');
  }

  async getGrades(courseId, component = '', activityId = 0, userIds = []) {
    return this.call('core_grades_get_grades', {
      courseid: courseId,
      component,
      activityid: activityId,
      userids: userIds,
    }, 'POST');
  }

  // ==========================================
  // 7. CALENDAR FUNCTIONS (core_calendar)
  // ==========================================

  async getCalendarMonthlyView(year, month, courseId = 1) {
    return this.call('core_calendar_get_calendar_monthly_view', {
      year,
      month,
      courseid: courseId,
    }, 'POST');
  }

  async getActionEventsByTimesort(timesortfrom = 0, limitnum = 20) {
    return this.call('core_calendar_get_action_events_by_timesort', {
      timesortfrom,
      limitnum,
    }, 'POST');
  }

  async getCalendarEvents(events = {}, options = {}) {
    return this.call('core_calendar_get_calendar_events', { events, options }, 'POST');
  }

  async createCalendarEvents(events = []) {
    return this.call('core_calendar_create_calendar_events', { events }, 'POST');
  }

  async deleteCalendarEvents(events = []) {
    return this.call('core_calendar_delete_calendar_events', { events }, 'POST');
  }

  // ==========================================
  // 8. MESSAGES & CHAT FUNCTIONS (core_message)
  // ==========================================

  async getConversations(userId, limitFrom = 0, limitNum = 20, type = 1) {
    return this.call('core_message_get_conversations', {
      userid: userId,
      limitfrom: limitFrom,
      limitnum: limitNum,
      type,
    }, 'POST');
  }

  async getConversationMessages(currentUserId, conversationId, limitFrom = 0, limitNum = 50) {
    return this.call('core_message_get_conversation_messages', {
      currentuserid: currentUserId,
      convid: conversationId,
      limitfrom: limitFrom,
      limitnum: limitNum,
    }, 'POST');
  }

  async sendMessagesToConversation(conversationId, messages = []) {
    return this.call('core_message_send_messages_to_conversation', {
      conversationid: conversationId,
      messages,
    }, 'POST');
  }

  async sendInstantMessages(messages = []) {
    return this.call('core_message_send_instant_messages', { messages }, 'POST');
  }

  async markAllConversationMessagesAsRead(userId, conversationId) {
    return this.call('core_message_mark_all_conversation_messages_as_read', {
      userid: userId,
      conversationid: conversationId,
    }, 'POST');
  }

  async getUnreadConversationsCount(userId) {
    return this.call('core_message_get_unread_conversations_count', { userid: userId }, 'POST');
  }

  // ==========================================
  // 9. BADGES FUNCTIONS (core_badges)
  // ==========================================

  async getUserBadges(userId = 0, courseId = 0) {
    return this.call('core_badges_get_user_badges', { userid: userId, courseid: courseId }, 'POST');
  }

  // ==========================================
  // 10. NOTIFICATIONS FUNCTIONS (message_popup)
  // ==========================================

  async addDevice(appid, name, model, platform, version, pushid, uuid) {
    return this.call('core_user_add_user_device', {
      appid,
      name,
      model,
      platform,
      version,
      pushid,
      uuid
    }, 'POST');
  }

  async getPopupNotifications(userIdTo, limit = 20) {
    return this.call('message_popup_get_popup_notifications', { useridto: userIdTo, limit }, 'POST');
  }

  async getUnreadNotificationCount(userIdTo) {
    return this.call('message_popup_get_unread_popup_notification_count', { useridto: userIdTo }, 'POST');
  }

  // ==========================================
  // 11. CERTIFICATES (mod_customcert & mod_certificate)
  // ==========================================

  async getCustomcertsByCourses(courseIds = []) {
    return this.call('mod_customcert_get_customcerts_by_courses', { courseids: courseIds }, 'POST');
  }

  async getIssuedCustomcerts(customcertId = 0) {
    return this.call('mod_customcert_get_issued_customcerts', { customcertid: customcertId }, 'POST');
  }

  async getCertificatesByCourses(courseIds = []) {
    return this.call('mod_certificate_get_certificates_by_courses', { courseids: courseIds }, 'POST');
  }

  async getCoursecertificatesByCourses(courseIds = []) {
    return this.call('mod_coursecertificate_get_coursecertificates_by_courses', { courseids: courseIds }, 'POST');
  }

  // ==========================================
  // 12. FILES & MODULE CONTENT FUNCTIONS
  // ==========================================

  async getPagesByCourses(courseIds = []) {
    return this.call('mod_page_get_pages_by_courses', { courseids: courseIds }, 'POST');
  }

  async getResourcesByCourses(courseIds = []) {
    return this.call('mod_resource_get_resources_by_courses', { courseids: courseIds }, 'POST');
  }

  async getBooksByCourses(courseIds = []) {
    return this.call('mod_book_get_books_by_courses', { courseids: courseIds }, 'POST');
  }

  async getUrlsByCourses(courseIds = []) {
    return this.call('mod_url_get_urls_by_courses', { courseids: courseIds }, 'POST');
  }

  async getScormsByCourses(courseIds = []) {
    return this.call('mod_scorm_get_scorms_by_courses', { courseids: courseIds }, 'POST');
  }

  async getScormScoes(scormId) {
    return this.call('mod_scorm_get_scorm_scoes', { scormid: scormId }, 'POST');
  }

  async launchSco(scormId, scoId = 0) {
    return this.call('mod_scorm_launch_sco', { scormid: scormId, scoid: scoId }, 'POST');
  }

  async getScormUserData(scormId, attempt = 0) {
    const numId = parseInt(scormId, 10);
    if (isNaN(numId) || numId <= 0) return { data: [] };
    const params = { scormid: numId };
    if (attempt !== undefined && attempt !== null && !isNaN(Number(attempt)) && Number(attempt) > 0) {
      params.attempt = Number(attempt);
    }
    return this.call('mod_scorm_get_scorm_user_data', params, 'POST');
  }

  async insertScormTracks(scoId, tracks = []) {
    return this.call('mod_scorm_insert_tracks', { scoid: scoId, tracks }, 'POST');
  }


  async getAutoLoginKey(privatetoken = '') {
    return this.call('tool_mobile_get_autologin_key', { privatetoken }, 'POST');
  }

  async getFiles(contextId, component = '', filearea = '', itemId = 0) {
    return this.call('core_files_get_files', {
      contextid: contextId,
      component,
      filearea,
      itemid: itemId,
    }, 'POST');
  }

  // ==========================================
  // COMPREHENSIVE API PROBE / DIAGNOSTICS SUITE
  // ==========================================

  async probeAllApis(userId = 2, courseId = 1) {
    const tests = [
      { id: 'site_info', category: 'Core & Auth', name: 'core_webservice_get_site_info', run: () => this.getSiteInfo() },
      { id: 'courses', category: 'Courses', name: 'core_enrol_get_users_courses', run: () => this.getUsersCourses(userId) },
      { id: 'course_contents', category: 'Courses', name: 'core_course_get_contents', run: () => this.getCourseContents(courseId) },
      { id: 'assignments', category: 'Assignments', name: 'mod_assign_get_assignments', run: () => this.getAssignments([courseId]) },
      { id: 'quizzes', category: 'Quizzes', name: 'mod_quiz_get_quizzes_by_courses', run: () => this.getQuizzesByCourses([courseId]) },
      { id: 'forums', category: 'Forums', name: 'mod_forum_get_forums_by_courses', run: () => this.getForumsByCourses([courseId]) },
      { id: 'grades', category: 'Grades', name: 'gradereport_user_get_grade_items', run: () => this.getUserGradeItems(courseId, userId) },
      { id: 'calendar', category: 'Calendar', name: 'core_calendar_get_calendar_monthly_view', run: () => this.getCalendarMonthlyView(new Date().getFullYear(), new Date().getMonth() + 1, courseId) },
      { id: 'messages', category: 'Messages', name: 'core_message_get_conversations', run: () => this.getConversations(userId) },
      { id: 'badges', category: 'Badges', name: 'core_badges_get_user_badges', run: () => this.getUserBadges(userId) },
      { id: 'notifications', category: 'Notifications', name: 'message_popup_get_unread_popup_notification_count', run: () => this.getUnreadNotificationCount(userId) },
    ];

    const results = [];

    for (const test of tests) {
      const t0 = Date.now();
      try {
        const res = await test.run();
        const latency = Date.now() - t0;
        results.push({
          id: test.id,
          category: test.category,
          name: test.name,
          status: 'success',
          latency,
          dataSummary: Array.isArray(res) ? `${res.length} items returned` : typeof res === 'object' && res !== null ? Object.keys(res).join(', ') : 'OK',
          raw: res,
        });
      } catch (err) {
        const latency = Date.now() - t0;
        results.push({
          id: test.id,
          category: test.category,
          name: test.name,
          status: 'error',
          latency,
          error: err.message,
          errorcode: err.errorcode || null,
        });
      }
    }

    return results;
  }

  async testConnection() {
    try {
      const siteInfo = await this.getSiteInfo();
      return {
        success: true,
        siteInfo,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
