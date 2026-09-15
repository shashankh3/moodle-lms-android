/**
 * Courses Service — Phase 2 (Service Layer Refactoring)
 * Handles course listing, course contents, enriched module parsing, and activity completion.
 * Reference: moodlehq/moodleapp core/features/course/services
 */
import { MobileAPI } from '../apiAdapter';

export const CoursesService = {
  async getCourses(user, forceRefresh = false) {
    return MobileAPI.getCourses(user, forceRefresh);
  },

  async getCourseById(courseId, user, forceRefresh = false) {
    return MobileAPI.getCourseById(courseId, user, forceRefresh);
  },

  async toggleActivityCompletion(courseId, moduleId, completed = true, user = null) {
    return MobileAPI.toggleActivityCompletion(courseId, moduleId, completed, user);
  },

  async fetchModuleTextContent(fileUrl) {
    return MobileAPI.fetchModuleTextContent(fileUrl);
  },
};
