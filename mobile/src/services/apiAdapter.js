import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodleClient, normalizeMoodleUrl } from './moodleClient';

const STORAGE_KEYS = {
  SERVER_CONFIG: 'moodle_mobile_server_config',
  SITE_INFO: 'moodle_mobile_site_info',
  ACTIVE_USER: 'moodle_mobile_active_user_v2',
  AUTOLOGIN_CACHE: 'moodle_mobile_autologin_cache',
};

export function getMoodleMediaUrl(url, token) {
  if (!url || typeof url !== 'string') return url;
  if (!token) return url;

  // Already has a token — return as-is
  if (url.includes('token=')) return url;

  // Already a webservice pluginfile URL — just append token
  if (url.includes('/webservice/pluginfile.php/')) {
    return url.includes('?') ? `${url}&token=${token}` : `${url}?token=${token}`;
  }

  // Standard pluginfile URL — replace with webservice version and append token
  if (url.includes('/pluginfile.php/')) {
    const newUrl = url.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
    return newUrl.includes('?') ? `${newUrl}&token=${token}` : `${newUrl}?token=${token}`;
  }

  return url;
}

export function fixMoodleHtmlContent(html, token, baseUrl = 'https://mh.unilearn.org.in') {
  if (!html || typeof html !== 'string') return '';
  const cleanBase = (baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');

  // 1. Replace @@PLUGINFILE@@/ with authenticated webservice pluginfile endpoint
  let fixed = html.replace(/@@PLUGINFILE@@\//g, `${cleanBase}/webservice/pluginfile.php/`);

  // 2. Fix standard /pluginfile.php/ links with webservice links
  fixed = fixed.replace(
    new RegExp(`${cleanBase}/pluginfile.php/`, 'g'),
    `${cleanBase}/webservice/pluginfile.php/`
  );

  // 3. Append token to all webservice/pluginfile.php links in the HTML
  fixed = fixed.replace(/\/webservice\/pluginfile\.php\/([^"'\s?]+)/g, (match, path) => {
    return `/webservice/pluginfile.php/${path}?token=${token}`;
  });

  // 3. Fix relative links starting with /
  fixed = fixed.replace(/src="\/([^"]+)"/g, `src="${cleanBase}/$1"`);
  fixed = fixed.replace(/href="\/([^"]+)"/g, `href="${cleanBase}/$1"`);

  return fixed;
}

export function extractCourseImage(c, token) {
  if (!c) return null;

  // 1. Direct image field — many Moodle versions return 'courseimage' directly as a URL
  let rawUrl = c.courseimage || null;

  // 2. overviewfiles is the standard Moodle field for course thumbnail
  if (!rawUrl && Array.isArray(c.overviewfiles) && c.overviewfiles.length > 0) {
    const imgFile =
      c.overviewfiles.find((f) => {
        const mime = f.mimetype || '';
        const fname = f.fileurl || f.url || f.filename || '';
        return mime.startsWith('image/') || /\.(jpeg|jpg|gif|png|webp|svg)/i.test(fname);
      }) || c.overviewfiles[0];
    if (imgFile) rawUrl = imgFile.fileurl || imgFile.url;
  }

  // 3. Direct image/thumbnail fields (may be set by adapters already)
  if (!rawUrl) rawUrl = c.image || c.thumbnail || null;

  // 4. Extract from course summary HTML
  if (!rawUrl && c.summary && typeof c.summary === 'string') {
    const match = c.summary.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) rawUrl = match[1];
  }

  // 5. Custom fields
  if (!rawUrl && Array.isArray(c.customfields)) {
    const cf = c.customfields.find((f) => f.type === 'image' || f.shortname === 'courseimage');
    if (cf && cf.value) rawUrl = cf.value;
  }

  if (!rawUrl) return null;

  // If the URL already has a token= param, it's already authenticated — return as-is
  if (rawUrl.includes('token=')) return rawUrl;

  // If it's a pluginfile URL, authenticate it
  return getMoodleMediaUrl(rawUrl, token);
}

async function saveToStorage(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

async function getFromStorage(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Stale-While-Revalidate Caching Utility
async function swrFetch(cacheKey, fetchFn, forceRefresh = false) {
  if (forceRefresh) {
    try {
      const data = await fetchFn();
      if (data) await saveToStorage(cacheKey, data);
      return data;
    } catch (e) {
      console.warn(`[SWR] Force refresh failed for ${cacheKey}`, e);
      // Fallback to cache if network fails on force refresh
      return getFromStorage(cacheKey);
    }
  }

  const cachedData = await getFromStorage(cacheKey);

  // Always fire network request in background to update cache for next time
  const networkPromise = fetchFn()
    .then(async (data) => {
      if (data) await saveToStorage(cacheKey, data);
      return data;
    })
    .catch((e) => {
      console.warn(`[SWR] Background fetch failed for ${cacheKey}`, e.message);
      return null;
    });

  // Return cache immediately if available for instantaneous UX
  if (cachedData) {
    return cachedData;
  }

  // If no cache exists, we MUST wait for the network
  const data = await networkPromise;
  return data || [];
}

export const MobileAPI = {
  _client: null,
  _logs: [],

  async getClient() {
    const cfg = await this.getServerConfig();
    if (cfg && cfg.token) {
      if (!this._client || this._client.baseUrl !== cfg.serverUrl || this._client.token !== cfg.token) {
        this._client = new MoodleClient(cfg.serverUrl, cfg.token, (log) => {
          this._logs.unshift(log);
          if (this._logs.length > 50) this._logs.pop();
        });
      }
      return this._client;
    }
    return null;
  },

  async getLogs() {
    return this._logs;
  },

  async resetToDefaults() {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    this._client = null;
  },

  // Direct authentication with Moodle
  async loginWithMoodle(serverUrl, username, password, service = 'moodle_mobile_app') {
    const cleanUrl = normalizeMoodleUrl(serverUrl);
    const client = new MoodleClient(cleanUrl, '');
    const res = await client.loginWithCredentials(username, password, service);
    if (res && res.token) {
      await this.saveServerConfig({
        serverUrl: cleanUrl,
        token: res.token,
        privatetoken: res.privatetoken,
        isLiveConnected: true,
        lastConnected: new Date().toISOString(),
      });
      if (res.siteInfo) {
        await saveToStorage(STORAGE_KEYS.SITE_INFO, res.siteInfo);
      }
      const siteInfo = res.siteInfo || {};
      const userProfile = {
        id: siteInfo.userid || 2,
        username: siteInfo.username || username,
        firstname: siteInfo.firstname || siteInfo.fullname?.split(' ')[0] || username,
        lastname: siteInfo.lastname || siteInfo.fullname?.split(' ')[1] || '',
        fullname: siteInfo.fullname || username,
        email: siteInfo.userpictureurl ? `${siteInfo.username || username}@moodle` : `${username}@moodle`,
        role: siteInfo.userissiteadmin ? 'admin' : 'student',
        roleLabel: siteInfo.userissiteadmin ? 'Site Administrator' : 'Enrolled Student',
        avatar: getMoodleMediaUrl(siteInfo.userpictureurl, res.token) || null,
        siteName: siteInfo.sitename || 'Moodle Server',
        serverUrl: cleanUrl,
        token: res.token,
      };
      await saveToStorage(STORAGE_KEYS.ACTIVE_USER, userProfile);

      // Eagerly warm the autologin key cache after login (non-blocking)
      // This ensures the key is ready before the user opens a SCORM module
      if (res.privatetoken) {
        setTimeout(async () => {
          try {
            const autoClient = new MoodleClient(cleanUrl, res.token);
            const autoRes = await autoClient.getAutoLoginKey(res.privatetoken);
            if (autoRes && autoRes.key && autoRes.autologinurl) {
              const warmCache = {
                key: autoRes.key,
                autologinurl: autoRes.autologinurl,
                userId: userProfile.id,
                ts: Date.now(),
              };
              this._autoLoginCache = warmCache;
              this._autoLoginCacheLoaded = true;
              AsyncStorage.setItem(STORAGE_KEYS.AUTOLOGIN_CACHE, JSON.stringify(warmCache)).catch(() => {});
              console.log('[AutoLogin] Key pre-warmed successfully after login');
            }
          } catch (e) {
            console.log('[AutoLogin] Pre-warm note:', e.message);
          }
        }, 2000); // 2 second delay so login completes first
      }

      return {
        success: true,
        token: res.token,
        privatetoken: res.privatetoken,
        siteInfo,
        user: userProfile,
      };
    }
    throw new Error('Authentication failed: Invalid credentials or Web Services disabled on Moodle server.');
  },

  // Real Courses from Moodle (Cached via SWR)
  async getCourses(user, forceRefresh = false) {
    const moodleUserId = user?.id || 2;
    const cacheKey = `moodle_mobile_courses_${moodleUserId}`;

    return swrFetch(cacheKey, async () => {
      const client = await this.getClient();
      if (!client) return [];

      try {
        let liveCourses = [];
        try {
          liveCourses = await client.getUsersCourses(moodleUserId);
        } catch (err) {
          console.log('getUsersCourses note:', err);
        }

        if (!Array.isArray(liveCourses) || liveCourses.length === 0) {
          try {
            const allCoursesResp = await client.getCoursesByField('', '');
            if (allCoursesResp && Array.isArray(allCoursesResp.courses)) {
              liveCourses = allCoursesResp.courses;
            }
          } catch (e2) {
            console.log('getCoursesByField note:', e2);
          }
        }

        if (Array.isArray(liveCourses)) {
          // Exclude site frontpage course (id: 1) if other courses exist
          const validCourses = liveCourses.filter((c) => c.id !== 1 || liveCourses.length === 1);
          return validCourses.map((c) => {
            let instructorName = '';
            let instructorAvatar = null;
            if (c.contacts && c.contacts.length > 0) {
              instructorName = c.contacts[0].fullname || '';
              if (c.contacts[0].profileimageurl) {
                instructorAvatar = getMoodleMediaUrl(c.contacts[0].profileimageurl, client.token);
              }
            } else if (c.instructor) {
              instructorName = c.instructor;
              instructorAvatar = c.instructorAvatar ? getMoodleMediaUrl(c.instructorAvatar, client.token) : null;
            }

            const imgUrl = extractCourseImage(c, client.token);

            return {
              id: c.id,
              shortname: c.shortname || `CRS-${c.id}`,
              code: c.shortname || `CRS-${c.id}`,
              fullname: c.fullname || c.displayname || `Course ${c.id}`,
              name: c.fullname || c.displayname || `Course ${c.id}`,
              term: 'Active Term',
              category: c.categoryname || 'Course Curriculum',
              department: c.categoryname || 'Academic Track',
              summary: c.summary ? c.summary.replace(/<[^>]*>?/gm, '').trim() : '',
              instructor: instructorName,
              instructorAvatar,
              image: imgUrl,
              thumbnail: imgUrl,
              progress: typeof c.progress === 'number' ? Math.round(c.progress) : 0,
              enrollmentCount: c.enrolledusercount || 0,
              isEnrolled: true,
              isLive: true,
              sections: [],
            };
          });
        }
        return [];
      } catch (e) {
        console.warn('Could not fetch courses from Moodle:', e);
        return [];
      }
    }, forceRefresh);
  },

  // Real Course Details and Contents from Moodle with Live Completion Tracking
  async getCourseById(courseId, user, forceRefresh = false) {
    const numId = parseInt(courseId, 10);
    const moodleUserId = user?.id || 2;
    const cacheKey = `moodle_mobile_course_${numId}_${moodleUserId}`;

    return swrFetch(cacheKey, async () => {
      const client = await this.getClient();
      if (!client) return null;

      let targetCourse = null;
      let effectiveUserId = moodleUserId;
      try {
        const siteInfo = await this.getSiteInfo();
        if (siteInfo?.userid) effectiveUserId = siteInfo.userid;
        const courses = await this.getCourses(user, forceRefresh);
        targetCourse = courses.find((c) => c.id === numId);

      // If not in enrolled courses, fetch course metadata from Moodle catalog
      if (!targetCourse) {
        const crsRes = await client.getCoursesByField('id', numId);
        if (crsRes?.courses && crsRes.courses.length > 0) {
          const c = crsRes.courses[0];
          targetCourse = {
            id: c.id,
            fullname: c.fullname,
            name: c.fullname,
            shortname: c.shortname,
            category: c.categoryname || 'Curriculum',
            summary: c.summary ? c.summary.replace(/<[^>]*>?/gm, '').trim() : '',
            image: extractCourseImage(c, client.token),
            progress: 0,
            instructor: 'Faculty Lead',
          };
        }
      }
    } catch (e) {
      console.warn('Error finding course header:', e);
    }

    let mappedSections = [];
    let activityCompletionMap = {};
    let courseCompletionData = null;

      // Fetch contents, activity completion, and course module details concurrently
      try {
        const [contents, actCompletion, crsCompletion, pagesRes, urlsRes, booksRes, resourcesRes, scormsRes, quizzesRes, assignsRes, customCertsRes, simpleCertsRes] = await Promise.all([
          client.getCourseContents(numId).catch((err) => {
            console.warn('getCourseContents error:', err);
            return [];
          }),
          client.getActivityCompletionStatus(numId, effectiveUserId).catch((err) => {
            console.log('getActivityCompletionStatus note:', err);
            return null;
          }),
          client.getCourseCompletionStatus(numId, effectiveUserId).catch((err) => {
            console.log('getCourseCompletionStatus note:', err);
            return null;
          }),
          client.getPagesByCourses([numId]).catch(() => null),
          client.getUrlsByCourses([numId]).catch(() => null),
          client.getBooksByCourses([numId]).catch(() => null),
          client.getResourcesByCourses([numId]).catch(() => null),
        client.getScormsByCourses([numId]).catch(() => null),
        client.getQuizzesByCourses([numId]).catch(() => null),
        client.getAssignments([numId]).catch(() => null),
        client.getCustomcertsByCourses([numId]).catch(() => null),
        client.getCertificatesByCourses([numId]).catch(() => null),
      ]);

      const pagesList = pagesRes?.pages || [];
      const urlsList = urlsRes?.urls || [];
      const booksList = booksRes?.books || [];
      const resourcesList = resourcesRes?.resources || [];
      const scormsList = scormsRes?.scorms || [];
      const quizzesList = quizzesRes?.quizzes || [];
      const assignsList = assignsRes?.courses?.[0]?.assignments || (Array.isArray(assignsRes?.assignments) ? assignsRes.assignments : []);
      
      const certsList = [];
      if (customCertsRes?.customcerts) certsList.push(...customCertsRes.customcerts.map(c => ({ ...c, modname: 'customcert' })));
      if (simpleCertsRes?.certificates) certsList.push(...simpleCertsRes.certificates.map(c => ({ ...c, modname: 'certificate' })));

      if (actCompletion && Array.isArray(actCompletion.statuses)) {
        actCompletion.statuses.forEach((st) => {
          // state: 0 = incomplete, 1 = complete, 2 = complete_pass, 3 = complete_fail
          activityCompletionMap[st.cmid] = st.state >= 1;
        });
      }

      if (crsCompletion && crsCompletion.completionstatus) {
        courseCompletionData = crsCompletion.completionstatus;
      }

      let totalTrackable = 0;
      let completedTrackable = 0;

      if (Array.isArray(contents) && contents.length > 0) {
        mappedSections = contents
          .filter(sec => {
            if (sec.uservisible === false || sec.visible === 0) return false;
            // In Moodle Tiles / Topics format, Section 0 (General) is not a course module section
            if (sec.section === 0 && (!sec.name || sec.name.trim() === 'General' || sec.name.trim() === '')) return false;
            return true;
          })
          .map((sec) => {
            const resolvedName = (sec.name && sec.name.trim().length > 0)
              ? sec.name.trim()
              : `Section ${sec.section || sec.id}`;
            return {
              id: sec.id,
              name: resolvedName,
              title: resolvedName,
              summary: sec.summary ? sec.summary.replace(/<[^>]*>?/gm, '').trim() : '',
              modules: (sec.modules || [])
                .filter(m => m.uservisible !== false && m.visible !== 0 && m.modname !== 'label')
                .map((m) => {
                const rawFiles = Array.isArray(m.contents) ? m.contents : [];
                const files = rawFiles.map((f) => ({
                  filename: f.filename,
                  fileurl: getMoodleMediaUrl(f.fileurl, client.token),
                  filesize: f.filesize,
                  mimetype: f.mimetype,
                  timemodified: f.timemodified,
                  content: f.content || null,
                  isPdf: f.mimetype === 'application/pdf' || f.filename?.toLowerCase().endsWith('.pdf'),
                }));

                const primaryFile = files[0] || null;
                const isPdf = primaryFile ? primaryFile.isPdf : (m.modname === 'resource' && m.name?.toLowerCase().endsWith('.pdf'));
                const isVideo = primaryFile ? (primaryFile.mimetype?.startsWith('video/') || primaryFile.filename?.toLowerCase().endsWith('.mp4')) : false;

                let type = 'resource';
                if (m.modname === 'quiz') type = 'quiz';
                else if (m.modname === 'assign') type = 'assign';
                else if (m.modname === 'forum') type = 'forum';
                else if (m.modname === 'url') type = 'url';
                else if (m.modname === 'page' || m.modname === 'book') type = 'page';
                else if (m.modname === 'scorm') type = 'scorm';
                else if (m.modname === 'folder') type = 'folder';
                else if (m.modname === 'customcert' || m.modname === 'simplecertificate' || m.modname === 'certificate') type = 'customcert';
                else if (isPdf) type = 'pdf';
                else if (isVideo) type = 'video';

                // Find rich module content from Moodle Web Services
                const pageObj = pagesList.find((p) => p.coursemodule === m.id || p.id === m.instance);
                const urlObj = urlsList.find((u) => u.coursemodule === m.id || u.id === m.instance);
                const bookObj = booksList.find((b) => b.coursemodule === m.id || b.id === m.instance);
                const resObj = resourcesList.find((r) => r.coursemodule === m.id || r.id === m.instance);
                const scormObj = scormsList.find((s) => s.coursemodule === m.id || s.id === m.instance);

                const rawEmbeddedContent = pageObj?.content || primaryFile?.content || m.contents?.[0]?.content || scormObj?.intro || m.intro || m.description || null;
                const embeddedContent = rawEmbeddedContent ? fixMoodleHtmlContent(rawEmbeddedContent, client.token, client.baseUrl) : null;

                // For SCORM: Build direct authenticated view URL
                const scormViewUrl = m.modname === 'scorm' ? `${client.baseUrl}/mod/scorm/view.php?id=${m.id}` : null;
                const baseWebUrl = urlObj?.externalurl || scormViewUrl || m.url || `${client.baseUrl}/mod/${m.modname}/view.php?id=${m.id}`;
                const directUrl = (primaryFile ? primaryFile.fileurl : (scormViewUrl || baseWebUrl));

                // Live completion logic:
                // 1. Check activity completion status from core_completion API
                // 2. Check inline completiondata from course contents
                const isTracked = m.completion !== undefined && m.completion > 0;
                const isCompletedViaApi = activityCompletionMap[m.id] === true;
                const isCompletedViaInline = !!(m.completiondata && m.completiondata.state >= 1);
                const isCompleted = isCompletedViaApi || isCompletedViaInline;

                if (isTracked || isCompleted) {
                  totalTrackable++;
                  if (isCompleted) completedTrackable++;
                }

                return {
                  id: m.id,
                  instance: m.instance,
                  contextid: m.contextid,
                  name: m.name,
                  modname: m.modname,
                  type,
                  isPdf,
                  completionTracking: m.completion || 0, // 0 = none, 1 = manual, 2 = auto
                  hasCompletion: isTracked,
                  completed: isCompleted,
                  quizId: m.modname === 'quiz' ? (m.instance || m.id) : undefined,
                  assignId: m.modname === 'assign' ? (m.instance || m.id) : undefined,
                  forumId: m.modname === 'forum' ? (m.instance || m.id) : undefined,
                  scormLaunchUrl: scormViewUrl,
                  url: scormViewUrl || baseWebUrl,
                  webUrl: scormViewUrl || baseWebUrl,
                  fileUrl: directUrl,
                  filename: primaryFile ? primaryFile.filename : null,
                  filesize: primaryFile ? primaryFile.filesize : null,
                  mimetype: primaryFile ? primaryFile.mimetype : null,
                  files,
                  description: m.intro ? m.intro.replace(/<[^>]*>?/gm, '').trim() : (m.description ? m.description.replace(/<[^>]*>?/gm, '').trim() : ''),
                  contentHtml: embeddedContent,
                };
              }),
            };
          })
          .filter(sec => Array.isArray(sec.modules) && sec.modules.length > 0);
      }

      // Fallback: If contents returned no modules, synthesize from individual module APIs (SCORM, Pages, Resources, Quizzes)
      const hasModules = mappedSections.some((s) => s.modules && s.modules.length > 0);
      if (!hasModules) {
        const synthModules = [];

        // 1. SCORM Packages - use view.php (player.php requires scoid which we fetch lazily)
        scormsList.forEach((s) => {
          const scormCmId = s.coursemodule || s.id;
          const scormViewUrl = `${client.baseUrl}/mod/scorm/view.php?id=${scormCmId}`;
          synthModules.push({
            id: scormCmId,
            instance: s.id,
            scormId: s.id,
            name: s.name || 'Interactive Module',
            modname: 'scorm',
            type: 'scorm',
            isPdf: false,
            completed: false,
            url: scormViewUrl,
            webUrl: scormViewUrl,
            fileUrl: scormViewUrl,
            description: s.intro ? s.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        // 2. HTML Pages
        pagesList.forEach((p) => {
          const pCmId = p.coursemodule || p.id;
          synthModules.push({
            id: pCmId,
            instance: p.id,
            name: p.name || 'Lesson Page',
            modname: 'page',
            type: 'page',
            isPdf: false,
            completed: false,
            contentHtml: p.content,
            url: `${client.baseUrl}/mod/page/view.php?id=${pCmId}`,
            webUrl: `${client.baseUrl}/mod/page/view.php?id=${pCmId}`,
            description: p.intro ? p.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        // 3. Resources / Files
        resourcesList.forEach((r) => {
          const rCmId = r.coursemodule || r.id;
          synthModules.push({
            id: rCmId,
            instance: r.id,
            name: r.name || 'Course Resource',
            modname: 'resource',
            type: 'resource',
            isPdf: r.name?.toLowerCase().endsWith('.pdf'),
            completed: false,
            url: `${client.baseUrl}/mod/resource/view.php?id=${rCmId}`,
            webUrl: `${client.baseUrl}/mod/resource/view.php?id=${rCmId}`,
            description: r.intro ? r.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        // 4. Quizzes
        quizzesList.forEach((q) => {
          const qCmId = q.coursemodule || q.id;
          synthModules.push({
            id: qCmId,
            instance: q.id,
            quizId: q.id,
            name: q.name || 'Quiz',
            modname: 'quiz',
            type: 'quiz',
            completed: false,
            description: q.intro ? q.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        // 5. Assignments
        assignsList.forEach((a) => {
          const aCmId = a.cmid || a.id;
          synthModules.push({
            id: aCmId,
            instance: a.id,
            assignId: a.id,
            name: a.name || 'Assignment',
            modname: 'assign',
            type: 'assign',
            completed: false,
            description: a.intro ? a.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        // 6. Certificates
        certsList.forEach((c) => {
          const cCmId = c.coursemodule || c.id;
          const actualModName = c.modname || 'customcert';
          synthModules.push({
            id: cCmId,
            instance: c.id,
            name: c.name || 'Certificate',
            modname: actualModName,
            type: 'customcert',
            completed: false,
            url: `${client.baseUrl}/mod/${actualModName}/view.php?id=${cCmId}`,
            webUrl: `${client.baseUrl}/mod/${actualModName}/view.php?id=${cCmId}`,
            description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : '',
          });
        });

        if (synthModules.length > 0) {
          mappedSections = [
            {
              id: 1,
              name: 'Curriculum & SCORM Modules',
              title: 'Curriculum & SCORM Modules',
              summary: 'Interactive learning packages and curriculum activities.',
              modules: synthModules,
            },
          ];
        }
      }

      // Force-inject certificates into mappedSections if they aren't already there
      // This is crucial because core_course_get_contents often completely omits customcerts!
      if (certsList && certsList.length > 0) {
        // Collect all existing module IDs
        const existingModuleIds = new Set();
        mappedSections.forEach(s => {
          (s.modules || []).forEach(m => existingModuleIds.add(m.id));
        });

        const missingCerts = [];
        certsList.forEach((c) => {
          const cCmId = c.coursemodule || c.id;
          const actualModName = c.modname || 'customcert';
          if (!existingModuleIds.has(cCmId)) {
            missingCerts.push({
              id: cCmId,
              instance: c.id,
              name: c.name || 'Certificate',
              modname: actualModName,
              type: 'customcert',
              completed: false,
              url: `${client.baseUrl}/mod/${actualModName}/view.php?id=${cCmId}`,
              webUrl: `${client.baseUrl}/mod/${actualModName}/view.php?id=${cCmId}`,
              description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : '',
            });
          }
        });

        if (missingCerts.length > 0) {
          // If we have an existing section, append to the last section, otherwise create a new one
          if (mappedSections.length > 0) {
            mappedSections[mappedSections.length - 1].modules.push(...missingCerts);
          } else {
            mappedSections.push({
              id: 999,
              name: 'Certificates & Credentials',
              title: 'Certificates & Credentials',
              summary: 'Your course accomplishments',
              modules: missingCerts,
            });
          }
        }
      }

      // Calculate dynamic realtime progress
      let calculatedProgress = targetCourse?.progress || 0;
      if (courseCompletionData && courseCompletionData.completed) {
        calculatedProgress = 100;
      } else if (totalTrackable > 0) {
        calculatedProgress = Math.round((completedTrackable / totalTrackable) * 100);
      }

        return {
          ...(targetCourse || {
            id: numId,
            name: `Course ${numId}`,
            fullname: `Course ${numId}`,
            image: extractCourseImage(null, client.token),
            instructor: '',
            instructorAvatar: null,
            category: 'Course Curriculum',
          }),
          progress: calculatedProgress,
          isCompleted: courseCompletionData ? courseCompletionData.completed : calculatedProgress === 100,
          sections: mappedSections,
          isLive: true,
        };
      } catch (e) {
        console.warn('Real Moodle getCourseContents failed:', e);
      }

      return {
        ...(targetCourse || {
          id: numId,
          name: `Course ${numId}`,
          fullname: `Course ${numId}`,
          image: extractCourseImage(null, client.token),
          instructor: '',
          instructorAvatar: null,
          category: 'Course Curriculum',
          progress: 0,
        }),
        sections: mappedSections,
        isLive: true,
      };
    }, forceRefresh);
  },

  // Dynamic Module Text Content Fetcher for In-App Reader
  async fetchModuleTextContent(fileUrl) {
    if (!fileUrl) return null;
    try {
      const client = await this.getClient();
      const authenticatedUrl = getMoodleMediaUrl(fileUrl, client?.token);
      const res = await fetch(authenticatedUrl, {
        headers: {
          Accept: 'text/html, text/plain, application/json, */*',
        },
      });
      if (res.ok) {
        const text = await res.text();
        return text;
      }
    } catch (e) {
      console.warn('Error fetching module text content:', e);
    }
    return null;
  },

  async toggleActivityCompletion(courseId, moduleId, completed = true, user = null) {
    const client = await this.getClient();
    let success = false;
    if (client) {
      try {
        await client.updateActivityCompletion(moduleId, completed);
        success = true;
      } catch (e) {
        console.warn('Live Moodle updateActivityCompletion note:', e);
      }
    }
    // Return success boolean instead of refetching course to prevent Moodle cache 
    // from instantly reverting optimistic UI updates.
    return success;
  },

  // Real Assignments from Moodle
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

  // Real Forums from Moodle
  async getForumById(forumId) {
    const client = await this.getClient();
    if (client) {
      try {
        const discResp = await client.getForumDiscussions(forumId);
        if (discResp && Array.isArray(discResp.discussions)) {
          return {
            id: parseInt(forumId, 10),
            courseId: 1,
            courseName: 'Moodle Discussions',
            title: 'Course Discussions',
            description: 'Participate in active course discussions.',
            discussionsCount: discResp.discussions.length,
            unreadCount: 0,
            discussions: discResp.discussions.map((d) => ({
              id: d.discussion,
              title: d.name,
              content: d.message ? d.message.replace(/<[^>]*>?/gm, '').trim() : '',
              author: d.userfullname || 'Participant',
              authorRole: 'Contributor',
              authorAvatar: getMoodleMediaUrl(d.userpictureurl, client.token) || null,
              pinned: !!d.pinned,
              created: new Date(d.created * 1000).toISOString(),
              repliesCount: d.numreplies || 0,
              replies: [],
            })),
          };
        }
      } catch (e) {
        console.warn('Real Moodle getForumDiscussions note:', e);
      }
    }
    return null;
  },

  async addForumDiscussion(forumId, user, title, content) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.addDiscussion(forumId, title, content);
      } catch (e) {
        console.warn('Real Moodle addDiscussion note:', e);
      }
    }
    return this.getForumById(forumId);
  },

  async addForumReply(forumId, discussionId, user, content) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.addDiscussionPost(discussionId, 'Re: Discussion', content);
      } catch (e) {
        console.warn('Real Moodle addDiscussionPost note:', e);
      }
    }
    return this.getForumById(forumId);
  },

  // Real Grades from Moodle
  async getGrades(userId = null) {
    const client = await this.getClient();
    if (!client) return [];
    try {
      const siteInfo = await this.getSiteInfo();
      const actualUserId = userId || siteInfo?.userid || 2;
      const courses = await this.getCourses();
      
      const reports = [];
      for (const course of courses) {
        try {
          const liveGrades = await client.getUserGradeItems(course.id, actualUserId);
          if (liveGrades && liveGrades.usergrades && liveGrades.usergrades.length > 0) {
            const itemsRaw = liveGrades.usergrades[0].gradeitems || [];
            
            const courseTotalItem = itemsRaw.find(gi => gi.itemtype === 'course') || itemsRaw[itemsRaw.length - 1];
            
            const items = itemsRaw.filter(gi => gi.itemtype !== 'course').map((gi) => ({
              id: gi.id,
              name: gi.itemname || 'Assessment Item',
              weight: parseFloat(gi.weightraw || 0).toFixed(1) + '%',
              rawGrade: gi.gradeformatted || gi.graderaw || '-',
              percentage: Math.round(parseFloat(gi.percentageformatted || 0)),
              status: gi.graderaw !== null ? 'Graded' : 'Pending',
            }));

            if (items.length > 0) {
              reports.push({
                courseId: course.id,
                courseName: course.fullname,
                activitiesCount: items.length,
                letter: courseTotalItem && courseTotalItem.gradeformatted ? courseTotalItem.gradeformatted : '-',
                finalGrade: courseTotalItem ? Math.round(parseFloat(courseTotalItem.percentageformatted || 0)) + '%' : '-',
                items: items
              });
            }
          }
        } catch (err) {
          console.warn(`Could not fetch grades for course ${course.id}`, err);
        }
      }
      return reports;
    } catch (e) {
      console.warn('Real Moodle getGrades note:', e);
    }
    return [];
  },

  // Real Calendar Events from Moodle
  async getEvents(year, month) {
    const client = await this.getClient();
    if (!client) return [];
    try {
      const y1 = year || new Date().getFullYear();
      const m1 = month || new Date().getMonth() + 1;
      
      const liveAgenda1 = await client.getCalendarMonthlyView(y1, m1).catch(() => ({ weeks: [] }));

      const events = [];
      if (liveAgenda1 && liveAgenda1.weeks) {
        liveAgenda1.weeks.forEach((w) => {
          w.days?.forEach((d) => {
            d.events?.forEach((ev) => {
              events.push({
                id: ev.id,
                title: ev.name,
                course: ev.course?.fullname || 'Moodle Calendar',
                type: ev.eventtype === 'due' ? 'assignment' : ev.eventtype === 'quiz' ? 'quiz' : 'live_session',
                date: new Date(ev.timestart * 1000).toISOString().split('T')[0],
                time: new Date(ev.timestart * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                instructor: 'Staff',
                platform: 'Moodle Calendar',
              });
            });
          });
        });
      }
      return events;
    } catch (e) {
      console.warn('Real Moodle getCalendarMonthlyView note:', e);
    }
    return [];
  },

  async addEvent(eventData) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.createCalendarEvents([
          {
            name: eventData.title,
            description: eventData.description || 'Calendar event',
            timestart: Math.floor(new Date(eventData.date).getTime() / 1000),
          },
        ]);
      } catch (e) {
        console.warn('Real Moodle createCalendarEvents note:', e);
      }
    }
    return { id: Date.now(), ...eventData };
  },

  // Real Instant Messages from Moodle
  async getConversations(userId = 2) {
    const client = await this.getClient();
    if (client) {
      try {
        const liveConvos = await client.getConversations(userId);
        if (liveConvos && Array.isArray(liveConvos.conversations)) {
          return liveConvos.conversations.map((c) => ({
            id: c.id,
            partner: {
              id: c.members?.[0]?.id || 1,
              name: c.name || c.members?.[0]?.fullname || 'Moodle Contact',
              avatar: getMoodleMediaUrl(c.members?.[0]?.profileimageurl, client.token) || null,
              role: 'Enrolled Member',
              online: c.members?.[0]?.isonline || false,
            },
            course: 'Direct Messages',
            unreadCount: c.unreadcount || 0,
            lastMessage: c.messages?.[c.messages.length - 1]?.text || '',
            lastMessageTime: 'Recent',
            messages: (c.messages || []).map((m) => ({
              id: m.id,
              senderId: m.useridfrom,
              senderName: m.useridfrom === userId ? 'You' : 'Contact',
              text: m.text,
              time: new Date(m.timecreated * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })),
          }));
        }
      } catch (e) {
        console.warn('Real Moodle getConversations note:', e);
      }
    }
    return [];
  },

  async sendMessage(conversationId, text, currentUser) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.sendInstantMessages([
          {
            touserid: parseInt(conversationId, 10),
            text,
          },
        ]);
      } catch (e) {
        console.warn('Real Moodle sendInstantMessages note:', e);
      }
    }
    return {
      id: Date.now(),
      senderId: currentUser?.id || 2,
      text,
      timestamp: 'Just now',
      isMe: true,
    };
  },

  // Real Badges and Certificates from Moodle
  async getBadges(userId = 2, userContext = null) {
    const client = await this.getClient();
    let combinedItems = [];
    const errors = [];

    if (!client) {
      console.warn('[Badges] No Moodle client — user not connected to a Moodle server.');
      return { items: [], errors: ['Not connected to a Moodle server.'] };
    }

    // Always resolve the true Moodle user ID from siteInfo (same pattern as getCourses)
    let moodleUserId = userId;
    try {
      const siteInfo = await this.getSiteInfo();
      if (siteInfo?.userid) moodleUserId = siteInfo.userid;
    } catch (e) {
      console.warn('[Badges] Could not read siteInfo:', e);
    }
    console.log('[Badges] Fetching for Moodle userId:', moodleUserId);

    // --- 1. Real Moodle Badges ---
    try {
      const liveBadges = await client.getUserBadges(moodleUserId);
      console.log('[Badges] getUserBadges raw response:', JSON.stringify(liveBadges)?.substring(0, 300));
      if (liveBadges && Array.isArray(liveBadges.badges) && liveBadges.badges.length > 0) {
        const mappedBadges = liveBadges.badges.map((b) => ({
          id: `badge_${b.id}`,
          name: b.name,
          title: b.name,
          description: b.description || '',
          icon: getMoodleMediaUrl(b.badgeurl, client.token) || '🏆',
          course: b.coursename || 'Moodle Site',
          earnedDate: b.dateissued ? new Date(b.dateissued * 1000).toISOString().split('T')[0] : 'Awarded',
          rarity: 'Verified',
          color: '#F59E0B',
          isCert: false,
        }));
        combinedItems = [...combinedItems, ...mappedBadges];
        console.log('[Badges] Found', mappedBadges.length, 'badge(s)');
      } else {
        console.log('[Badges] No badges awarded yet for user');
      }
    } catch (e) {
      console.log('[Badges] core_badges_get_user_badges note:', e.message);
    }

    // --- 2. Real Moodle Certificates (mod_customcert + mod_certificate plugins) ---
    try {
      const courses = await this.getCourses(userContext || { id: moodleUserId });
      const courseIds = courses.map(c => c.id);
      console.log('[Badges] Fetching certificates for', courseIds.length, 'enrolled course(s):', courseIds);

      if (courseIds.length > 0) {
        // mod_customcert
        let customCertsRes = null;
        try {
          customCertsRes = await client.getCustomcertsByCourses(courseIds);
        } catch (e) {
          // Optional plugin may not be registered in external_functions — safe to ignore
        }

        if (customCertsRes?.customcerts && customCertsRes.customcerts.length > 0) {
          const mappedCerts = customCertsRes.customcerts.map(c => ({
            id: `cert_custom_${c.id}`,
            name: c.name || 'Custom Certificate',
            title: c.name || 'Custom Certificate',
            description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : 'Course Certificate',
            icon: '📜',
            course: c.coursename || 'Completed Course',
            earnedDate: 'Verified',
            color: '#10B981',
            isCert: true,
            url: `${client.baseUrl}/mod/customcert/view.php?id=${c.coursemodule}`,
          }));
          combinedItems = [...combinedItems, ...mappedCerts];
        }

        // mod_certificate
        let simpleCertsRes = null;
        try {
          simpleCertsRes = await client.getCertificatesByCourses(courseIds);
        } catch (e) {
          // Optional plugin may not be registered in external_functions — safe to ignore
        }

        if (simpleCertsRes?.certificates && simpleCertsRes.certificates.length > 0) {
          const mappedSimpleCerts = simpleCertsRes.certificates.map(c => ({
            id: `cert_simple_${c.id}`,
            name: c.name || 'Certificate',
            title: c.name || 'Certificate',
            description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : 'Course Certificate',
            icon: '📜',
            course: c.coursename || 'Completed Course',
            earnedDate: 'Verified',
            color: '#10B981',
            isCert: true,
            url: `${client.baseUrl}/mod/certificate/view.php?id=${c.coursemodule}`,
          }));
          combinedItems = [...combinedItems, ...mappedSimpleCerts];
        }

        // Fallback: Scan course contents for certificates if plugins were not available
        if (combinedItems.filter(i => i.isCert).length === 0) {
          try {
            const certResult = await this.getCertificates(userContext || { id: moodleUserId });
            if (certResult?.items && certResult.items.length > 0) {
              const scannedCerts = certResult.items.map(c => ({
                id: c.id,
                name: c.name || c.title || 'Course Certificate',
                title: c.name || c.title || 'Course Certificate',
                description: c.description || 'Course Certificate',
                icon: '📜',
                course: c.course || 'Completed Course',
                earnedDate: c.earnedDate || 'Verified',
                color: '#10B981',
                isCert: true,
                url: c.url,
              }));
              combinedItems = [...combinedItems, ...scannedCerts];
            }
          } catch (scanErr) {}
        }
      }
    } catch (e) {
      console.log('[Badges] Certificate scan note:', e.message);
    }

    return { items: combinedItems, errors };
  },

  // Real Certificates Discovery & Fetcher from Moodle
  async getCertificates(userContext = null) {
    const client = await this.getClient();
    if (!client) {
      return { items: [], errors: ['Not connected to a Moodle server.'] };
    }

    let certificates = [];
    const errors = [];
    const discoveredIds = new Set();

    try {
      const siteInfo = await this.getSiteInfo();
      const moodleUserId = siteInfo?.userid || userContext?.id || 2;
      const courses = await this.getCourses(userContext || { id: moodleUserId });
      const courseIds = courses.map(c => c.id);

      if (courseIds.length > 0) {
        // 1. Check mod_customcert
        try {
          const customCertsRes = await client.getCustomcertsByCourses(courseIds);
          if (customCertsRes?.customcerts && Array.isArray(customCertsRes.customcerts)) {
            customCertsRes.customcerts.forEach(c => {
              const idKey = `customcert_${c.id}`;
              if (!discoveredIds.has(idKey)) {
                discoveredIds.add(idKey);
                certificates.push({
                  id: idKey,
                  name: c.name || 'Official Course Certificate',
                  title: c.name || 'Official Course Certificate',
                  description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : 'Official Moodle Course Certificate',
                  course: c.coursename || 'Completed Course',
                  earnedDate: 'Verified',
                  isCert: true,
                  url: `${client.baseUrl}/mod/customcert/view.php?id=${c.coursemodule || c.id}`,
                });
              }
            });
          }
        } catch (e) {
          errors.push(`mod_customcert: ${e.message}`);
        }

        // 2. Check mod_certificate
        try {
          const simpleCertsRes = await client.getCertificatesByCourses(courseIds);
          if (simpleCertsRes?.certificates && Array.isArray(simpleCertsRes.certificates)) {
            simpleCertsRes.certificates.forEach(c => {
              const idKey = `simplecert_${c.id}`;
              if (!discoveredIds.has(idKey)) {
                discoveredIds.add(idKey);
                certificates.push({
                  id: idKey,
                  name: c.name || 'Course Certificate',
                  title: c.name || 'Course Certificate',
                  description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : 'Official Course Certificate',
                  course: c.coursename || 'Completed Course',
                  earnedDate: 'Verified',
                  isCert: true,
                  url: `${client.baseUrl}/mod/certificate/view.php?id=${c.coursemodule || c.id}`,
                });
              }
            });
          }
        } catch (e) {
          errors.push(`mod_certificate: ${e.message}`);
        }

        // 3. Check mod_coursecertificate
        try {
          const courseCertsRes = await client.getCoursecertificatesByCourses(courseIds);
          if (courseCertsRes?.certificates && Array.isArray(courseCertsRes.certificates)) {
            courseCertsRes.certificates.forEach(c => {
              const idKey = `coursecert_${c.id}`;
              if (!discoveredIds.has(idKey)) {
                discoveredIds.add(idKey);
                certificates.push({
                  id: idKey,
                  name: c.name || 'Official Course Certificate',
                  title: c.name || 'Official Course Certificate',
                  description: c.intro ? c.intro.replace(/<[^>]*>?/gm, '').trim() : 'Official Moodle Course Certificate',
                  course: c.coursename || 'Completed Course',
                  earnedDate: 'Verified',
                  isCert: true,
                  url: `${client.baseUrl}/mod/coursecertificate/view.php?id=${c.coursemodule || c.id}`,
                });
              }
            });
          }
        } catch (e) {
          // ignore if plugin not present
        }

        // 4. Check core_badges_get_user_badges (Moodle verified completion badges/credentials)
        try {
          const liveBadges = await client.getUserBadges(moodleUserId);
          if (liveBadges && Array.isArray(liveBadges.badges)) {
            liveBadges.badges.forEach(b => {
              const idKey = `badge_cert_${b.id}`;
              if (!discoveredIds.has(idKey)) {
                discoveredIds.add(idKey);
                certificates.push({
                  id: idKey,
                  name: b.name,
                  title: b.name,
                  description: b.description || 'Verified Course Achievement Credential',
                  course: b.coursename || 'Moodle Site',
                  earnedDate: b.dateissued ? new Date(b.dateissued * 1000).toISOString().split('T')[0] : 'Awarded',
                  isCert: true,
                  badgeUrl: getMoodleMediaUrl(b.badgeurl, client.token),
                  url: `${client.baseUrl}/badges/badge.php?hash=${b.uniquehash || b.id}`,
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }

        // 5. Scan course contents across all enrolled courses for certificate modules
        for (const course of courses) {
          try {
            const contents = await client.getCourseContents(course.id);
            if (Array.isArray(contents)) {
              contents.forEach(sec => {
                (sec.modules || []).forEach(m => {
                  const modName = (m.modname || '').toLowerCase();
                  const name = (m.name || '').toLowerCase();
                  const isCertModule =
                    modName.includes('cert') ||
                    name.includes('certificate') ||
                    name.includes('प्रमाणपत्र') ||
                    name.includes('प्रमाण पत्र');

                  if (isCertModule) {
                    const idKey = `cm_${m.id}`;
                    if (!discoveredIds.has(idKey)) {
                      discoveredIds.add(idKey);
                      certificates.push({
                        id: idKey,
                        name: m.name || 'Course Certificate',
                        title: m.name || 'Course Certificate',
                        description: m.description || sec.name || 'Official Moodle Course Certificate',
                        course: course.fullname || course.name,
                        earnedDate: m.completiondata?.state >= 1 ? 'Earned' : 'Available on Completion',
                        isCert: true,
                        url: `${client.baseUrl}/mod/${m.modname}/view.php?id=${m.id}`,
                      });
                    }
                  }
                });
              });
            }
          } catch (e2) {
            console.log(`Scan course contents for certs (${course.id}) note:`, e2);
          }
        }
      }
    } catch (err) {
      errors.push(`getCertificates error: ${err.message}`);
    }

    return { items: certificates, errors };
  },

  // Server Config
  async getServerConfig() {
    return await getFromStorage(STORAGE_KEYS.SERVER_CONFIG);
  },

  async saveServerConfig(config) {
    await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, config);
  },

  async getSiteInfo() {
    return await getFromStorage(STORAGE_KEYS.SITE_INFO);
  },

  async testConnection(serverUrl, token) {
    const client = new MoodleClient(serverUrl, token);
    const result = await client.testConnection();
    if (result.success && result.siteInfo) {
      await saveToStorage(STORAGE_KEYS.SITE_INFO, result.siteInfo);
      await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, {
        serverUrl: normalizeMoodleUrl(serverUrl),
        token,
        isLiveConnected: true,
        lastConnected: new Date().toISOString(),
      });
    }
    return result;
  },

  async probeAllApis(serverUrl, token) {
    const client = new MoodleClient(serverUrl, token);
    return client.probeAllApis();
  },

  async executeCustomWsFunction(wsfunction, params = {}, method = 'POST') {
    const client = await this.getClient();
    if (!client) throw new Error('No active live Moodle client connection');
    return client.call(wsfunction, params, method);
  },
  // In-memory autologin key cache (warm cache from AsyncStorage on first use)
  _autoLoginCache: null,
  _autoLoginCacheLoaded: false,

  async _loadAutoLoginCache() {
    if (this._autoLoginCacheLoaded) return;
    this._autoLoginCacheLoaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.AUTOLOGIN_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only restore if not older than 5.5 minutes
        if (parsed && (Date.now() - parsed.ts) < 5.5 * 60 * 1000) {
          this._autoLoginCache = parsed;
          console.log('[AutoLogin] Restored valid key from storage');
        } else {
          console.log('[AutoLogin] Stored key expired, will fetch fresh');
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  },

  // Universal Web View Auth using official tool_mobile_get_autologin_key
  async getAuthenticatedUrl(targetUrl) {
    if (!targetUrl) return null;
    try {
      const cfg = await this.getServerConfig();
      if (!cfg || !cfg.token) return targetUrl;

      const cleanBase = (cfg.serverUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
      let fullTargetUrl = targetUrl;
      if (targetUrl.startsWith('/')) {
        fullTargetUrl = `${cleanBase}${targetUrl}`;
      }

      if (cfg.privatetoken) {
        // Load from AsyncStorage on first call
        await this._loadAutoLoginCache();

        const now = Date.now();
        const CACHE_TTL = 5.5 * 60 * 1000;
        let autoLoginData = null;

        if (this._autoLoginCache && (now - this._autoLoginCache.ts) < CACHE_TTL) {
          // Valid cached key
          autoLoginData = this._autoLoginCache;
        } else {
          // Fetch a fresh key from Moodle
          try {
            const client = new MoodleClient(cfg.serverUrl, cfg.token);
            const res = await client.getAutoLoginKey(cfg.privatetoken);
            if (res && res.key && res.autologinurl) {
              const user = await getFromStorage(STORAGE_KEYS.ACTIVE_USER);
              const siteInfo = await getFromStorage(STORAGE_KEYS.SITE_INFO);
              const newCache = {
                key: res.key,
                autologinurl: res.autologinurl,
                userId: user?.id || siteInfo?.userid,
                ts: now,
              };
              this._autoLoginCache = newCache;
              // Persist to AsyncStorage so it survives reloads
              AsyncStorage.setItem(STORAGE_KEYS.AUTOLOGIN_CACHE, JSON.stringify(newCache)).catch(() => {});
              autoLoginData = newCache;
            }
          } catch (autoLoginErr) {
            console.warn('AutoLogin generation note:', autoLoginErr.message);
            // Rate-limited — use stale cached key as fallback (Moodle still honours it)
            if (this._autoLoginCache) {
              console.log('[AutoLogin] Using stale cached key as rate-limit fallback');
              autoLoginData = this._autoLoginCache;
            }
          }
        }

        if (autoLoginData?.key && autoLoginData?.autologinurl && autoLoginData?.userId) {
          const sep = autoLoginData.autologinurl.includes('?') ? '&' : '?';
          return `${autoLoginData.autologinurl}${sep}userid=${autoLoginData.userId}&key=${autoLoginData.key}&urlto=${encodeURIComponent(fullTargetUrl)}`;
        }
      }

      // Fallback: pluginfile URLs get token appended
      if (fullTargetUrl.includes('pluginfile.php') && !fullTargetUrl.includes('token=')) {
        const sep = fullTargetUrl.includes('?') ? '&' : '?';
        return `${fullTargetUrl}${sep}token=${cfg.token}`;
      }

      return fullTargetUrl;
    } catch (e) {
      console.warn('getAuthenticatedUrl error:', e);
    }
    return targetUrl;
  },

  // Real Course Catalog with Categories and Courses from Moodle
  async getCatalogCategoriesAndCourses() {
    const client = await this.getClient();
    if (!client) return [];

    try {
      let categories = [];
      try {
        const catRes = await client.getCategories();
        if (Array.isArray(catRes)) {
          categories = catRes;
        }
      } catch (err) {
        console.warn('getCategories note:', err);
      }

      let allCourses = [];
      try {
        const coursesRes = await client.getCoursesByField('', '');
        if (coursesRes && Array.isArray(coursesRes.courses)) {
          allCourses = coursesRes.courses;
        }
      } catch (err) {
        console.warn('getCoursesByField in catalog note:', err);
      }

      if (allCourses.length === 0) {
        try {
          allCourses = await this.getCourses();
        } catch (e) {
          console.warn('getCourses fallback in catalog note:', e);
        }
      }

      const validCourses = allCourses.filter((c) => c.id !== 1 || allCourses.length === 1);

      if (categories.length > 0) {
        const result = categories.map((cat) => {
          const catCourses = validCourses.filter(
            (c) => c.category === cat.id || c.categoryid === cat.id || (c.categoryname && c.categoryname.toLowerCase() === cat.name.toLowerCase())
          );
          return {
            id: cat.id,
            name: cat.name,
            description: cat.description ? cat.description.replace(/<[^>]*>?/gm, '').trim() : '',
            coursecount: cat.coursecount || catCourses.length,
            courses: catCourses.map((c) => ({
              id: c.id,
              name: c.fullname || c.displayname || `Course ${c.id}`,
              fullname: c.fullname || c.displayname || `Course ${c.id}`,
              shortname: c.shortname || '',
              summary: c.summary ? c.summary.replace(/<[^>]*>?/gm, '').trim() : '',
              image: extractCourseImage(c, client.token),
              category: cat.name,
            })),
          };
        }).filter((cat) => cat.courses.length > 0 || cat.coursecount > 0);

        // If some courses didn't match any category, group them into an Other category
        const categorizedCourseIds = new Set();
        result.forEach(cat => cat.courses.forEach(c => categorizedCourseIds.add(c.id)));
        const uncategorized = validCourses.filter(c => !categorizedCourseIds.has(c.id));
        if (uncategorized.length > 0) {
          result.push({
            id: 9999,
            name: 'GENERAL COURSES',
            description: '',
            coursecount: uncategorized.length,
            courses: uncategorized.map(c => ({
              id: c.id,
              name: c.fullname || c.displayname || `Course ${c.id}`,
              fullname: c.fullname || c.displayname || `Course ${c.id}`,
              shortname: c.shortname || '',
              summary: c.summary ? c.summary.replace(/<[^>]*>?/gm, '').trim() : '',
              image: extractCourseImage(c, client.token),
              category: 'GENERAL COURSES',
            })),
          });
        }
        return result;
      } else {
        const categoryMap = {};
        validCourses.forEach((c) => {
          const catName = c.categoryname || c.category || 'COURSES';
          if (!categoryMap[catName]) {
            categoryMap[catName] = {
              id: c.category || 1,
              name: catName,
              description: '',
              coursecount: 0,
              courses: [],
            };
          }
          categoryMap[catName].courses.push({
            id: c.id,
            name: c.fullname || c.displayname || `Course ${c.id}`,
            fullname: c.fullname || c.displayname || `Course ${c.id}`,
            shortname: c.shortname || '',
            summary: c.summary ? c.summary.replace(/<[^>]*>?/gm, '').trim() : '',
            image: extractCourseImage(c, client.token),
            category: catName,
          });
          categoryMap[catName].coursecount++;
        });
        return Object.values(categoryMap);
      }
    } catch (e) {
      console.warn('Error fetching catalog categories and courses:', e);
      return [];
    }
  },
  // ==========================================
  // NATIVE QUIZZES API
  // ==========================================
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
    // data[0][name]=q123:1_answer&data[0][value]=1
    const data = [];
    Object.keys(answers).forEach(name => {
      data.push({ name, value: String(answers[name]) });
    });

    const res = await client.processAttempt(attemptId, data, finishAttempt);
    if (res && res.state && finishAttempt) {
      // If finished, fetch the review/grade
      const reviewRes = await client.getAttemptReview(attemptId);
      return reviewRes;
    }
    return res;
  },

  // ==========================================
  // LESSON API METHODS
  // ==========================================

  async getLessonInfo(courseId, lessonId) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');
    const res = await client.getLessonsByCourses([courseId]);
    if (res && res.lessons) {
      return res.lessons.find(l => l.id === lessonId || l.coursemodule === lessonId);
    }
    return null;
  },

  async getLessonPages(lessonId) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');
    const res = await client.getLessonPages(lessonId);
    return res && res.pages ? res.pages : [];
  },

  async getLessonPageData(lessonId, pageId) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');
    const res = await client.getLessonPageData(lessonId, pageId);
    return res;
  },

  async processLessonPage(lessonId, pageId, data = []) {
    const client = await this.getClient();
    if (!client) throw new Error('No client');
    const res = await client.processLessonPage(lessonId, pageId, data);
    return res;
  },

  // Real Private Files from Moodle
  async getPrivateFiles(user) {
    const client = await this.getClient();
    if (!client) return [];
    try {
      const siteInfo = await this.getSiteInfo();
      const moodleUserId = siteInfo?.userid || user?.id || 14;

      let files = [];
      let userContextId;
      try {
        // Always fetch dynamic context ID to prevent cache issues
        const draftInfo = await client.call('core_files_get_unused_draft_itemid', {});
        if (draftInfo && draftInfo.contextid) {
          userContextId = draftInfo.contextid;
          // Optionally save it, but we always re-fetch it above
          await saveToStorage(`moodle_user_context_${moodleUserId}`, userContextId);
        }
      } catch (de) {
        console.warn('draftInfo note:', de);
        // Fallback to cached context ID if offline or API fails
        userContextId = await getFromStorage(`moodle_user_context_${moodleUserId}`);
      }

        if (!userContextId) userContextId = 88;

      try {
        const res = await client.call('core_files_get_files', {
          contextid: userContextId,
          component: 'user',
          filearea: 'private',
          itemid: 0,
          filepath: '/',
          filename: '',
        });

        if (res && Array.isArray(res.files)) {
          files = res.files
            .filter((f) => f.filename !== '.')
            .map((f) => ({
              id: `moodle_server_${f.filename}_${f.timemodified || ''}`,
              name: f.filename,
              size: f.filesize ? (f.filesize > 1048576 ? `${(f.filesize / 1048576).toFixed(1)} MB` : `${Math.round(f.filesize / 1024)} KB`) : '0 KB',
              updated: f.timemodified ? new Date(f.timemodified * 1000).toLocaleDateString() : 'Recent',
              url: f.url ? getMoodleMediaUrl(f.url, client.token) : null,
              mimetype: f.mimetype,
              timemodified: f.timemodified,
              filesize: f.filesize,
              author: f.author,
              isServer: true,
            }));
        }
      } catch (err) {
        console.warn('core_files_get_files note:', err);
      }

      const localFiles = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
      const serverNames = new Set(files.map((f) => f.name));
      const filteredLocal = localFiles.filter((lf) => !serverNames.has(lf.name));

      return files.concat(filteredLocal);
    } catch (e) {
      console.warn('getPrivateFiles error:', e);
      return [];
    }
  },

  async getPrivateFilesQuota(user) {
    const client = await this.getClient();
    if (!client) return { filecount: 0, filesize: 0, formattedSize: '0 MB' };
    try {
      const siteInfo = await this.getSiteInfo();
      const moodleUserId = siteInfo?.userid || user?.id || 14;
      const res = await client.call('core_user_get_private_files_info', { userid: moodleUserId });
      if (res && res.filesize !== undefined) {
        const sizeBytes = res.filesize || 0;
        const formatted = sizeBytes > 1048576 
          ? `${(sizeBytes / 1048576).toFixed(1)} MB` 
          : `${Math.round(sizeBytes / 1024)} KB`;
        return {
          filecount: res.filecount || 0,
          filesize: sizeBytes,
          formattedSize: formatted,
        };
      }
    } catch (e) {
      console.warn('getPrivateFilesQuota note:', e);
    }
    return { filecount: 0, filesize: 0, formattedSize: '0 MB' };
  },

  async addPrivateFile(user, fileData) {
    const client = await this.getClient();
    const siteInfo = await this.getSiteInfo();
    const moodleUserId = siteInfo?.userid || user?.id || 14;

    // 1. Save locally for instant offline UI update
    const existing = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
    const updated = [fileData, ...existing];
    await saveToStorage(`moodle_private_files_${moodleUserId}`, updated);

    // 2. Sync to Moodle server if online
    if (client && client.token) {
      try {
        const draftRes = await client.call('core_files_get_unused_draft_itemid', {});
        if (draftRes && draftRes.itemid) {
          const draftId = draftRes.itemid;
          if (draftRes.contextid) {
            await saveToStorage(`moodle_user_context_${moodleUserId}`, draftRes.contextid);
          }

          const cleanBaseUrl = (client.baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
          const uploadUrl = `${cleanBaseUrl}/webservice/upload.php?token=${client.token}&filearea=draft&itemid=${draftId}&filepath=/&filename=${encodeURIComponent(fileData.name)}`;

          const boundary = `----ReactNativeBoundary${Date.now().toString(16)}`;
          const contentStr = typeof fileData.content === 'string' ? fileData.content : JSON.stringify(fileData.content || '');

          let body = '';
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="token"\r\n\r\n${client.token}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filearea"\r\n\r\ndraft\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="itemid"\r\n\r\n${draftId}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filepath"\r\n\r\n/\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filename"\r\n\r\n${fileData.name}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="file"; filename="${fileData.name}"\r\n`;
          body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
          body += `${contentStr}\r\n`;
          body += `--${boundary}--\r\n`;

          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
          });

          const uploadText = await uploadRes.text();
          console.log('[PrivateFiles upload.php]', uploadRes.status, uploadText);

          await client.call('core_user_add_user_private_files', {
            draftid: draftId,
          });
        }
      } catch (syncErr) {
        console.warn('Private file server sync note:', syncErr);
      }
    }

    return this.getPrivateFiles(user);
  },

  async deletePrivateFile(user, fileId) {
    const siteInfo = await this.getSiteInfo();
    const moodleUserId = siteInfo?.userid || user?.id || 14;
    const existing = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
    const updated = existing.filter((f) => f.id !== fileId);
    await saveToStorage(`moodle_private_files_${moodleUserId}`, updated);
    return this.getPrivateFiles(user);
  }
};
