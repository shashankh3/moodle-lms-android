import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const courseMethods = {
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

};
