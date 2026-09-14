/**
 * Grades Service — Phase 2 (Service Layer Refactoring)
 * Handles gradebook items, user grade reports, and course overview grades.
 * Reference: moodlehq/moodleapp core/features/grades
 */
import { MobileAPI } from '../apiAdapter';

export const GradesService = {
  async getGrades(userId = null) {
    const client = await MobileAPI.getClient();
    if (!client) return [];
    try {
      const siteInfo = await MobileAPI.getSiteInfo();
      const actualUserId = userId || siteInfo?.userid || 2;
      const courses = await MobileAPI.getCourses();

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
                items: items,
              });
            }
          }
        } catch (e) {
          console.warn(`[GradesService] Error loading grades for course ${course.id}:`, e);
        }
      }
      return reports;
    } catch (err) {
      console.warn('[GradesService] getGrades failed:', err);
      return [];
    }
  },
};
