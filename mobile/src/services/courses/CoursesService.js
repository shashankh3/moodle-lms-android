/**
 * Courses Service — Phase 2 (Service Layer Refactoring)
 * Handles course listing, course contents, enriched module parsing, and activity completion.
 * Reference: moodlehq/moodleapp core/features/course/services
 */
import { MobileAPI, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';

export const CoursesService = {
  async getCourses(user) {
    const client = await MobileAPI.getClient();
    if (!client) return [];

    try {
      const siteInfo = await MobileAPI.getSiteInfo();
      const moodleUserId = siteInfo?.userid || user?.id || 2;

      let liveCourses = [];
      try {
        liveCourses = await client.getUsersCourses(moodleUserId);
      } catch (err) {
        console.log('[CoursesService] getUsersCourses note:', err);
      }

      if (!Array.isArray(liveCourses) || liveCourses.length === 0) {
        try {
          const allCoursesResp = await client.getCoursesByField('', '');
          if (allCoursesResp && Array.isArray(allCoursesResp.courses)) {
            liveCourses = allCoursesResp.courses;
          }
        } catch (e2) {
          console.log('[CoursesService] getCoursesByField note:', e2);
        }
      }

      if (Array.isArray(liveCourses)) {
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
      console.warn('[CoursesService] Could not fetch courses from Moodle:', e);
      return [];
    }
  },

  async getCourseById(courseId, user) {
    const numId = parseInt(courseId, 10);
    const client = await MobileAPI.getClient();
    if (!client) return null;

    let targetCourse = null;
    let moodleUserId = user?.id || 2;
    try {
      const siteInfo = await MobileAPI.getSiteInfo();
      if (siteInfo?.userid) moodleUserId = siteInfo.userid;
      const courses = await this.getCourses(user);
      targetCourse = courses.find((c) => c.id === numId);

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
      console.warn('[CoursesService] Error finding course header:', e);
    }

    let mappedSections = [];
    let activityCompletionMap = {};
    let courseCompletionData = null;

    try {
      const [contents, actCompletion, crsCompletion, pagesRes, urlsRes, booksRes, resourcesRes, scormsRes, quizzesRes, assignsRes, customCertsRes, simpleCertsRes] = await Promise.all([
        client.getCourseContents(numId).catch((err) => {
          console.warn('getCourseContents error:', err);
          return [];
        }),
        client.getActivityCompletionStatus(numId, moodleUserId).catch((err) => {
          console.log('getActivityCompletionStatus note:', err);
          return null;
        }),
        client.getCourseCompletionStatus(numId, moodleUserId).catch((err) => {
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
                  completionTracking: m.completion || 0,
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

      if (certsList && certsList.length > 0) {
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
      console.warn('[CoursesService] Real Moodle getCourseContents failed:', e);
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
  },

  async toggleActivityCompletion(courseId, moduleId, completed = true, user = null) {
    const client = await MobileAPI.getClient();
    let success = false;
    if (client) {
      try {
        await client.updateActivityCompletion(moduleId, completed);
        success = true;
      } catch (e) {
        console.warn('[CoursesService] Live Moodle updateActivityCompletion note:', e);
      }
    }
    return success;
  },

  async fetchModuleTextContent(fileUrl) {
    if (!fileUrl) return null;
    try {
      const client = await MobileAPI.getClient();
      const authenticatedUrl = getMoodleMediaUrl(fileUrl, client?.token);
      const res = await fetch(authenticatedUrl, {
        headers: {
          Accept: 'text/html, text/plain, application/json, */*',
        },
      });
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      console.warn('[CoursesService] Error fetching module text content:', e);
    }
    return null;
  },
};
