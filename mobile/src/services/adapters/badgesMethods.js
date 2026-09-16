import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../adapterUtils';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const badgesMethods = {
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
                        earnedDate: (course.progress === 100 || course.completed || m.completiondata?.state >= 1) ? 'Earned' : 'Available on Completion',
                        isCert: true,
                        url: `${client.baseUrl}/mod/${m.modname}/view.php?id=${m.id}`,
                      });
                    }
                  }
                });
              });
            }

            // Fallback: If course is 100% complete and no specific certificate activity was detected, show verified course completion credential
            if (course.progress === 100 || course.completed) {
              const compKey = `course_comp_${course.id}`;
              const hasCertForCourse = certificates.some(c => c.course === (course.fullname || course.name));
              if (!hasCertForCourse && !discoveredIds.has(compKey)) {
                discoveredIds.add(compKey);
                certificates.push({
                  id: compKey,
                  name: `${course.fullname || course.name} - Certificate of Completion`,
                  title: `${course.fullname || course.name} - Certificate of Completion`,
                  description: `Verified completion of ${course.fullname || course.name}`,
                  course: course.fullname || course.name,
                  earnedDate: 'Earned (100% Complete)',
                  isCert: true,
                  url: `${client.baseUrl}/course/view.php?id=${course.id}`,
                });
              }
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

};
