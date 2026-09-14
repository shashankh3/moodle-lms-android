import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const gradesMethods = {
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

};
