/**
 * Grades Service — Phase 2 (Service Layer Refactoring)
 * Handles gradebook items, user grade reports, and course overview grades.
 * Reference: moodlehq/moodleapp core/features/grades
 */
import { MobileAPI } from '../apiAdapter';

export const GradesService = {
  async getGrades(userId = null, forceRefresh = false) {
    return MobileAPI.getGrades(userId, forceRefresh);
  },
};
