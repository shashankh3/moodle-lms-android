import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const lessonMethods = {
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

};
