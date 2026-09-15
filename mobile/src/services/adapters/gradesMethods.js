import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch } from '../adapterUtils';

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

function cleanFormattedGrade(str) {
  if (str === null || str === undefined) return '-';
  if (typeof str === 'number') return String(str);
  if (typeof str !== 'string') return '-';
  const decoded = decodeHtmlEntities(str);
  const cleaned = decoded.replace(/<[^>]*>/g, '').trim();
  return cleaned.length > 0 ? cleaned : '-';
}

function parsePercentage(str, raw, max) {
  if (str && typeof str === 'string') {
    const cleaned = decodeHtmlEntities(str).replace(/<[^>]*>/g, '').replace('%', '').trim();
    const val = parseFloat(cleaned);
    if (!isNaN(val)) return Math.round(val);
  }
  if (raw !== null && raw !== undefined && max && Number(max) > 0) {
    const calc = (Number(raw) / Number(max)) * 100;
    if (!isNaN(calc)) return Math.round(calc);
  }
  return null;
}

function getFriendlyItemName(name, moduleType, itemType) {
  const cleaned = cleanFormattedGrade(name);
  if (cleaned && cleaned !== '-' && cleaned !== 'Assessment Item') {
    return cleaned;
  }
  if (moduleType === 'quiz') return 'Quiz Assessment';
  if (moduleType === 'assign') return 'Assignment Submission';
  if (moduleType === 'lesson') return 'Interactive Lesson';
  if (moduleType === 'scorm') return 'SCORM Activity';
  if (moduleType === 'forum') return 'Forum Assessment';
  if (itemType === 'category') return 'Category Subtotal';
  if (itemType === 'course') return 'Course Total';
  return 'Graded Assessment';
}

function parseGradesTable(tables) {
  if (!Array.isArray(tables) || tables.length === 0) return { items: [], courseTotal: null };
  const tableData = tables[0]?.tabledata;
  if (!Array.isArray(tableData)) return { items: [], courseTotal: null };

  const items = [];
  let courseTotal = null;

  for (const row of tableData) {
    if (!row) continue;
    const rawName = row.itemname?.content || row.itemname || '';
    const name = cleanFormattedGrade(rawName);
    const grade = cleanFormattedGrade(row.grade?.content || row.grade);
    const weight = cleanFormattedGrade(row.weight?.content || row.weight);
    const percentageStr = cleanFormattedGrade(row.percentage?.content || row.percentage);
    const letter = cleanFormattedGrade(row.lettergrade?.content || row.lettergrade);
    const range = cleanFormattedGrade(row.range?.content || row.range);
    const feedback = cleanFormattedGrade(row.feedback?.content || row.feedback);
    const isCourseTotal = (row.itemname?.class && row.itemname.class.includes('courseitem')) || /course total/i.test(name);

    if (isCourseTotal) {
      courseTotal = {
        name,
        gradeformatted: grade,
        percentageformatted: percentageStr,
        letter: letter !== '-' ? letter : grade,
        feedback: feedback !== '-' ? feedback : '',
      };
    } else if (name && name !== '-') {
      const pct = parsePercentage(percentageStr, null, null);
      let moduleType = 'other';
      if (/quiz/i.test(name)) moduleType = 'quiz';
      else if (/assign|task|homework|project/i.test(name)) moduleType = 'assign';
      else if (/exam|midterm|final/i.test(name)) moduleType = 'exam';
      else if (/lesson/i.test(name)) moduleType = 'lesson';
      else if (/scorm|module/i.test(name)) moduleType = 'scorm';

      items.push({
        id: Math.random().toString(),
        name: getFriendlyItemName(name, moduleType, 'mod'),
        moduleType,
        weight: weight !== '-' ? weight : '-',
        rawGrade: grade,
        range: range !== '-' ? range : null,
        percentage: pct,
        letter: letter !== '-' ? letter : null,
        feedback: feedback !== '-' ? feedback : null,
        status: (grade !== '-' && grade !== '') ? 'Graded' : 'Pending',
      });
    }
  }
  return { items, courseTotal };
}

export const gradesMethods = {
  async getGrades(userId = null, forceRefresh = false) {
    const client = await this.getClient();
    if (!client) return [];

    try {
      const activeUser = await getFromStorage(STORAGE_KEYS.ACTIVE_USER);
      const siteInfo = await this.getSiteInfo();
      let actualUserId = Number(userId || activeUser?.id || siteInfo?.userid || 0);

      if (!actualUserId) {
        try {
          const liveSite = await client.getSiteInfo();
          if (liveSite?.userid) actualUserId = Number(liveSite.userid);
        } catch (siteErr) {}
      }

      const cacheKey = `moodle_mobile_grades_${actualUserId}`;

      return swrFetch(cacheKey, async () => {
        try {
          // 1. Fetch user's enrolled courses and overview grades in parallel
          const [courses, overviewRes] = await Promise.all([
            this.getCourses({ id: actualUserId }, forceRefresh).catch((e) => {
              console.warn('[Grades] Error fetching courses:', e.message);
              return [];
            }),
            client.getCourseGrades(0).catch(async () => {
              if (actualUserId > 0) {
                try {
                  return await client.getCourseGrades(actualUserId);
                } catch (eId) {
                  console.warn('[Grades] Overview grades note:', eId.message);
                }
              }
              return null;
            }),
          ]);

          const overviewMap = new Map();
          if (overviewRes && Array.isArray(overviewRes.grades)) {
            for (const og of overviewRes.grades) {
              if (og && og.courseid) {
                overviewMap.set(Number(og.courseid), og);
              }
            }
          }

          let courseList = Array.isArray(courses) ? courses.filter(c => c.id !== 1 || courses.length === 1) : [];

          // If getCourses returned empty but overview grades has courses, synthesize course list
          if (courseList.length === 0 && overviewMap.size > 0) {
            courseList = Array.from(overviewMap.keys()).map((cId) => ({
              id: cId,
              fullname: `Course ${cId}`,
              name: `Course ${cId}`,
            }));
          }

          // If any course has placeholder name, fetch catalog metadata to get proper titles
          const coursesNeedingTitles = courseList.filter(c => !c.fullname || c.fullname.startsWith('Course '));
          if (coursesNeedingTitles.length > 0 && typeof client.getCoursesByField === 'function') {
            try {
              const catalogRes = await client.getCoursesByField('', '');
              if (catalogRes && Array.isArray(catalogRes.courses)) {
                const catalogMap = new Map(catalogRes.courses.map(c => [Number(c.id), c]));
                courseList = courseList.map(c => {
                  const catC = catalogMap.get(Number(c.id));
                  if (catC) {
                    return {
                      ...c,
                      fullname: catC.fullname || catC.displayname || c.fullname,
                      name: catC.fullname || catC.displayname || c.name,
                      shortname: catC.shortname || c.shortname,
                      category: catC.categoryname || c.category,
                    };
                  }
                  return c;
                });
              }
            } catch (catErr) {}
          }

          if (courseList.length === 0 && overviewMap.size === 0) {
            return [];
          }

          // 2. Fetch detailed grade items for each course in parallel
          const gradePromises = courseList.map(async (course) => {
            let items = [];
            let courseTotalItem = null;
            let userGroupId = 0;
            const overviewGradeObj = overviewMap.get(Number(course.id)) || null;

            // Helper to get user group for courses with separate groups mode
            const resolveGroupId = async () => {
              if (userGroupId > 0) return userGroupId;
              try {
                if (typeof client.getUserCourseGroups === 'function') {
                  const groupRes = await client.getUserCourseGroups(course.id, 0);
                  if (groupRes && Array.isArray(groupRes.groups) && groupRes.groups.length > 0) {
                    userGroupId = groupRes.groups[0].id;
                    return userGroupId;
                  }
                }
              } catch (gErr) {}
              return 0;
            };

            // Step A: Try primary gradereport_user_get_grade_items (passing 0 for self)
            try {
              let liveGrades = await client.getUserGradeItems(course.id, 0);
              if (liveGrades && Array.isArray(liveGrades.usergrades) && liveGrades.usergrades.length > 0) {
                const itemsRaw = liveGrades.usergrades[0].gradeitems || [];
                courseTotalItem = itemsRaw.find(gi => gi.itemtype === 'course') || (itemsRaw.length > 0 ? itemsRaw[itemsRaw.length - 1] : null);

                items = itemsRaw
                  .filter(gi => gi.itemtype !== 'course')
                  .map((gi) => {
                    const cleanedRaw = cleanFormattedGrade(gi.gradeformatted || gi.graderaw);
                    const pct = parsePercentage(gi.percentageformatted, gi.graderaw, gi.grademax);
                    const modType = gi.itemmodule || gi.itemtype || (/quiz/i.test(gi.itemname) ? 'quiz' : /assign/i.test(gi.itemname) ? 'assign' : 'other');
                    return {
                      id: gi.id || gi.iteminstance || Math.random().toString(),
                      name: getFriendlyItemName(gi.itemname, modType, gi.itemtype),
                      moduleType: modType,
                      itemType: gi.itemtype || 'mod',
                      weight: gi.weightformatted || (gi.weightraw !== null && gi.weightraw !== undefined && !isNaN(parseFloat(gi.weightraw))
                        ? parseFloat(gi.weightraw).toFixed(1) + '%'
                        : '-'),
                      rawGrade: cleanedRaw,
                      maxGrade: gi.grademax !== null && gi.grademax !== undefined ? cleanFormattedGrade(gi.grademax) : null,
                      minGrade: gi.grademin !== null && gi.grademin !== undefined ? cleanFormattedGrade(gi.grademin) : null,
                      passGrade: gi.gradepass !== null && gi.gradepass !== undefined && Number(gi.gradepass) > 0 ? cleanFormattedGrade(gi.gradepass) : null,
                      percentage: pct,
                      letter: cleanFormattedGrade(gi.lettergradeformatted || gi.lettergrade || '-'),
                      feedback: cleanFormattedGrade(gi.feedback || ''),
                      dateGraded: gi.dategraded ? new Date(gi.dategraded * 1000).toLocaleDateString() : null,
                      status: (gi.graderaw !== null && gi.graderaw !== undefined && gi.graderaw !== '') ? 'Graded' : 'Pending',
                    };
                  });
              }
            } catch (err) {
              // If error is notingroup, try with user group
              if (/notingroup/i.test(err.message)) {
                try {
                  const gid = await resolveGroupId();
                  if (gid > 0) {
                    const groupGrades = await client.getUserGradeItems(course.id, 0, gid);
                    if (groupGrades && Array.isArray(groupGrades.usergrades) && groupGrades.usergrades.length > 0) {
                      const itemsRaw = groupGrades.usergrades[0].gradeitems || [];
                      courseTotalItem = itemsRaw.find(gi => gi.itemtype === 'course') || (itemsRaw.length > 0 ? itemsRaw[itemsRaw.length - 1] : null);
                      items = itemsRaw
                        .filter(gi => gi.itemtype !== 'course')
                        .map((gi) => {
                          const modType = gi.itemmodule || gi.itemtype || (/quiz/i.test(gi.itemname) ? 'quiz' : /assign/i.test(gi.itemname) ? 'assign' : 'other');
                          return {
                            id: gi.id || gi.iteminstance || Math.random().toString(),
                            name: getFriendlyItemName(gi.itemname, modType, gi.itemtype),
                            moduleType: modType,
                            itemType: gi.itemtype || 'mod',
                            weight: gi.weightformatted || (gi.weightraw !== null && gi.weightraw !== undefined && !isNaN(parseFloat(gi.weightraw))
                              ? parseFloat(gi.weightraw).toFixed(1) + '%'
                              : '-'),
                            rawGrade: cleanFormattedGrade(gi.gradeformatted || gi.graderaw),
                            maxGrade: gi.grademax !== null && gi.grademax !== undefined ? cleanFormattedGrade(gi.grademax) : null,
                            passGrade: gi.gradepass !== null && gi.gradepass !== undefined && Number(gi.gradepass) > 0 ? cleanFormattedGrade(gi.gradepass) : null,
                            percentage: parsePercentage(gi.percentageformatted, gi.graderaw, gi.grademax),
                            letter: cleanFormattedGrade(gi.lettergradeformatted || gi.lettergrade || '-'),
                            feedback: cleanFormattedGrade(gi.feedback || ''),
                            dateGraded: gi.dategraded ? new Date(gi.dategraded * 1000).toLocaleDateString() : null,
                            status: (gi.graderaw !== null && gi.graderaw !== undefined && gi.graderaw !== '') ? 'Graded' : 'Pending',
                          };
                        });
                    }
                  }
                } catch (groupRetryErr) {
                  console.warn(`[Grades] Group grade retry note for course ${course.id}:`, groupRetryErr.message);
                }
              }
            }

            // Step B: Fallback to gradereport_user_get_grades_table if items is empty
            if (items.length === 0 && typeof client.getUserGradesTable === 'function') {
              try {
                let tableRes = await client.getUserGradesTable(course.id, 0);
                if (tableRes && Array.isArray(tableRes.tables)) {
                  const parsed = parseGradesTable(tableRes.tables);
                  if (parsed.items.length > 0) {
                    items = parsed.items;
                  }
                  if (!courseTotalItem && parsed.courseTotal) {
                    courseTotalItem = parsed.courseTotal;
                  }
                }
              } catch (tableErr) {
                if (/notingroup/i.test(tableErr.message)) {
                  try {
                    const gid = await resolveGroupId();
                    if (gid > 0) {
                      const tableRes = await client.getUserGradesTable(course.id, 0, gid);
                      if (tableRes && Array.isArray(tableRes.tables)) {
                        const parsed = parseGradesTable(tableRes.tables);
                        if (parsed.items.length > 0) items = parsed.items;
                        if (!courseTotalItem && parsed.courseTotal) courseTotalItem = parsed.courseTotal;
                      }
                    }
                  } catch (tRetryErr) {}
                }
              }
            }

            // Step C: Fallback to direct activity module queries if gradebook is restricted
            if (items.length === 0) {
              try {
                const activityItems = [];
                // 1. Quizzes
                if (typeof client.getQuizzesByCourses === 'function' && typeof client.getUserAttempts === 'function') {
                  try {
                    const qRes = await client.getQuizzesByCourses([course.id]);
                    if (qRes && Array.isArray(qRes.quizzes)) {
                      for (const q of qRes.quizzes) {
                        try {
                          const attRes = await client.getUserAttempts(q.id, 0);
                          const attempts = attRes?.attempts || [];
                          const finished = attempts.filter(a => a.state === 'finished');
                          const cleanName = cleanFormattedGrade(q.name || 'Quiz Assessment');
                          if (finished.length > 0) {
                            const best = finished.sort((a, b) => (b.sumgrades || 0) - (a.sumgrades || 0))[0];
                            const raw = best.sumgrades !== undefined ? parseFloat(best.sumgrades).toFixed(2) : '-';
                            const pct = q.grade && q.grade > 0 && best.sumgrades !== undefined
                              ? Math.round((best.sumgrades / q.grade) * 100)
                              : null;
                            activityItems.push({
                              id: `quiz_${q.id}`,
                              name: cleanName,
                              moduleType: 'quiz',
                              itemType: 'mod',
                              weight: '-',
                              rawGrade: raw,
                              maxGrade: q.grade ? cleanFormattedGrade(q.grade) : null,
                              percentage: pct,
                              status: 'Graded',
                              feedback: null,
                            });
                          } else if (attempts.length > 0) {
                            activityItems.push({
                              id: `quiz_${q.id}`,
                              name: cleanName,
                              moduleType: 'quiz',
                              itemType: 'mod',
                              weight: '-',
                              rawGrade: '-',
                              maxGrade: q.grade ? cleanFormattedGrade(q.grade) : null,
                              percentage: null,
                              status: 'In Progress',
                              feedback: null,
                            });
                          }
                        } catch (attErr) {}
                      }
                    }
                  } catch (qErr) {}
                }

                // 2. Assignments
                if (typeof client.getAssignments === 'function' && typeof client.getSubmissionStatus === 'function') {
                  try {
                    const aRes = await client.getAssignments([course.id]);
                    if (aRes && Array.isArray(aRes.courses)) {
                      for (const c of aRes.courses) {
                        const courseAssigns = c.assignments || [];
                        for (const a of courseAssigns) {
                          try {
                            const subRes = await client.getSubmissionStatus(a.id, 0);
                            const feedback = subRes?.feedback;
                            const gradeObj = feedback?.grade;
                            const cleanName = cleanFormattedGrade(a.name || 'Assignment');
                            if (gradeObj && gradeObj.gradeformatted) {
                              const cleanG = cleanFormattedGrade(gradeObj.gradeformatted);
                              const feedbackComments = cleanFormattedGrade(feedback?.plugins?.find(p => p.type === 'comments')?.editorfields?.[0]?.text || '');
                              activityItems.push({
                                id: `assign_${a.id}`,
                                name: cleanName,
                                moduleType: 'assign',
                                itemType: 'mod',
                                weight: '-',
                                rawGrade: cleanG,
                                percentage: parsePercentage(cleanG, null, null),
                                status: 'Graded',
                                feedback: feedbackComments !== '-' ? feedbackComments : null,
                              });
                            }
                          } catch (subErr) {}
                        }
                      }
                    }
                  } catch (aErr) {}
                }

                if (activityItems.length > 0) {
                  items = activityItems;
                }
              } catch (actModuleErr) {
                console.warn(`[Grades] Activity module fallback note for course ${course.id}:`, actModuleErr.message);
              }
            }

            // Fallback / computation for course total
            const overviewGradeStr = overviewGradeObj ? cleanFormattedGrade(overviewGradeObj.grade || overviewGradeObj.rawgrade) : null;
            const letterVal = courseTotalItem && courseTotalItem.gradeformatted
              ? cleanFormattedGrade(courseTotalItem.gradeformatted)
              : (overviewGradeStr || '-');

            const finalPct = parsePercentage(
              courseTotalItem?.percentageformatted,
              courseTotalItem?.graderaw || (overviewGradeObj ? overviewGradeObj.rawgrade : null),
              courseTotalItem?.grademax
            );

            let finalGradeStr = '-';
            if (finalPct !== null) {
              finalGradeStr = `${finalPct}%`;
            } else if (letterVal !== '-') {
              finalGradeStr = letterVal;
            }

            return {
              courseId: course.id,
              courseName: cleanFormattedGrade(course.fullname || course.name || `Course ${course.id}`),
              courseCode: course.shortname || course.code || `CRS-${course.id}`,
              category: course.category || course.department || 'Course Curriculum',
              activitiesCount: items.length,
              letter: letterVal,
              finalGrade: finalGradeStr,
              items: items,
            };
          });

          const reports = await Promise.all(gradePromises);
          return reports;
        } catch (e) {
          console.warn('[Grades] Real Moodle getGrades note:', e);
          return [];
        }
      }, forceRefresh);
    } catch (err) {
      console.warn('[Grades] getGrades top error:', err);
      return [];
    }
  },
};
