jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map();
  return {
    __mockStore: mockStore,
    getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
    setItem: jest.fn((k, v) => { mockStore.set(k, String(v)); return Promise.resolve(); }),
    removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
    multiRemove: jest.fn((keys) => { keys.forEach(k => mockStore.delete(k)); return Promise.resolve(); }),
  };
});

jest.mock('expo-secure-store', () => {
  const mockSecure = new Map();
  return {
    __mockSecure: mockSecure,
    setItemAsync: jest.fn((k, v) => { mockSecure.set(k, v); return Promise.resolve(); }),
    getItemAsync: jest.fn((k) => Promise.resolve(mockSecure.has(k) ? mockSecure.get(k) : null)),
    deleteItemAsync: jest.fn((k) => { mockSecure.delete(k); return Promise.resolve(); }),
  };
});

import { courseMethods } from '../src/services/adapters/courseMethods';
import { CoursesService } from '../src/services/courses/CoursesService';
import { MobileAPI } from '../src/services/apiAdapter';

describe('courseMethods - Course Completion Percentage', () => {
  let mockClient;
  let context;

  beforeEach(() => {
    mockClient = {
      token: 'test-token',
      baseUrl: 'https://moodle.example.com',
      getUsersCourses: jest.fn(),
      getCoursesByField: jest.fn(),
      getActivityCompletionStatus: jest.fn(),
      getCourseCompletionStatus: jest.fn(),
      getCourseContents: jest.fn(),
      getPagesByCourses: jest.fn().mockResolvedValue({ pages: [] }),
      getUrlsByCourses: jest.fn().mockResolvedValue({ urls: [] }),
      getBooksByCourses: jest.fn().mockResolvedValue({ books: [] }),
      getResourcesByCourses: jest.fn().mockResolvedValue({ resources: [] }),
      getScormsByCourses: jest.fn().mockResolvedValue({ scorms: [] }),
      getQuizzesByCourses: jest.fn().mockResolvedValue({ quizzes: [] }),
      getAssignments: jest.fn().mockResolvedValue({ courses: [{ assignments: [] }] }),
      getCustomcertsByCourses: jest.fn().mockResolvedValue({ customcerts: [] }),
      getCertificatesByCourses: jest.fn().mockResolvedValue({ certificates: [] }),
      updateActivityCompletion: jest.fn().mockResolvedValue({ status: true }),
    };

    context = {
      _client: mockClient,
      async getClient() {
        return mockClient;
      },
      async getSiteInfo() {
        return { userid: 25 };
      },
      ...courseMethods,
    };
  });

  describe('getCourses', () => {
    it('sets progress to 100% when Moodle marks course completed', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 10,
          fullname: 'Chemistry 101',
          shortname: 'CHEM101',
          progress: null,
          completed: true,
        },
      ]);

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(100);
      expect(courses[0].isCompleted).toBe(true);
    });

    it('calculates accurate progress percentage from module activity completion statuses', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 20,
          fullname: 'Biology 201',
          shortname: 'BIO201',
          progress: null,
          completed: false,
        },
      ]);

      mockClient.getActivityCompletionStatus.mockResolvedValue({
        statuses: [
          { cmid: 101, modname: 'page', state: 1, tracking: 1 },
          { cmid: 102, modname: 'quiz', state: 1, tracking: 1 },
          { cmid: 103, modname: 'assign', state: 0, tracking: 1 },
          { cmid: 104, modname: 'resource', state: 0, tracking: 1 },
        ],
      });

      mockClient.getCourseCompletionStatus.mockResolvedValue({
        completionstatus: { completed: false, criteria: [] },
      });

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(50); // 2 out of 4 completed = 50%
      expect(courses[0].isCompleted).toBe(false);
    });

    it('calculates progress from course completion criteria if activity statuses not present', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 30,
          fullname: 'History 301',
          shortname: 'HIST301',
          progress: null,
          completed: false,
        },
      ]);

      mockClient.getActivityCompletionStatus.mockResolvedValue({ statuses: [] });
      mockClient.getCourseCompletionStatus.mockResolvedValue({
        completionstatus: {
          completed: false,
          criteria: [
            { title: 'Assignment 1', complete: true, status: 'Yes' },
            { title: 'Assignment 2', complete: true, status: 'Yes' },
            { title: 'Final Exam', complete: true, status: 'Yes' },
            { title: 'Project Paper', complete: false, status: 'No' },
          ],
        },
      });

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(75); // 3 of 4 criteria = 75%
      expect(courses[0].isCompleted).toBe(false);
    });

    it('handles course completion status completed=true', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 40,
          fullname: 'Literature 101',
          shortname: 'LIT101',
          progress: 0,
          completed: false,
        },
      ]);

      mockClient.getActivityCompletionStatus.mockResolvedValue(null);
      mockClient.getCourseCompletionStatus.mockResolvedValue({
        completionstatus: { completed: true },
      });

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(100);
      expect(courses[0].isCompleted).toBe(true);
    });

    it('calculates progress from getCourseContents inline module completion when activity completion status returns empty', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 60,
          fullname: 'Physics 101',
          shortname: 'PHYS101',
          progress: null,
          completed: false,
        },
      ]);

      mockClient.getActivityCompletionStatus.mockResolvedValue({ statuses: [] });
      mockClient.getCourseCompletionStatus.mockResolvedValue({ completionstatus: { completed: false, criteria: [] } });
      mockClient.getCourseContents.mockResolvedValue([
        {
          id: 1,
          name: 'Section 1',
          modules: [
            { id: 201, name: 'Module 1', completion: 1, completiondata: { state: 1 } },
            { id: 202, name: 'Module 2', completion: 1, completiondata: { state: 0 } },
            { id: 203, name: 'Module 3', completion: 1, completiondata: { state: 1 } },
            { id: 204, name: 'Module 4', completion: 1, completiondata: { state: 1 } },
          ],
        },
      ]);

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(75); // 3 of 4 = 75%
      expect(courses[0].isCompleted).toBe(false);
    });

    it('falls back to numeric course.progress when completion APIs are unavailable or throw', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        {
          id: 50,
          fullname: 'Art 101',
          shortname: 'ART101',
          progress: 60,
          completed: false,
        },
      ]);

      mockClient.getActivityCompletionStatus.mockRejectedValue(new Error('Course completion not enabled'));
      mockClient.getCourseCompletionStatus.mockRejectedValue(new Error('Course completion not enabled'));

      const courses = await context.getCourses({ id: 25 }, true);
      expect(courses).toHaveLength(1);
      expect(courses[0].progress).toBe(60);
    });
  });

  describe('getCourseById', () => {
    it('calculates progress accurately for a specific course', async () => {
      mockClient.getUsersCourses.mockResolvedValue([
        { id: 20, fullname: 'Biology 201', shortname: 'BIO201', progress: null },
      ]);

      mockClient.getCourseContents.mockResolvedValue([
        {
          id: 1,
          name: 'Week 1',
          modules: [
            { id: 101, name: 'Module 1', modname: 'page', completion: 1, completiondata: { state: 1 } },
            { id: 102, name: 'Module 2', modname: 'quiz', completion: 1, completiondata: { state: 0 } },
            { id: 103, name: 'Module 3', modname: 'assign', completion: 1, completiondata: { state: 1 } },
          ],
        },
      ]);

      mockClient.getActivityCompletionStatus.mockResolvedValue({
        statuses: [
          { cmid: 101, state: 1, tracking: 1 },
          { cmid: 102, state: 0, tracking: 1 },
          { cmid: 103, state: 1, tracking: 1 },
        ],
      });

      mockClient.getCourseCompletionStatus.mockResolvedValue({
        completionstatus: { completed: false },
      });

      const course = await context.getCourseById(20, { id: 25 }, true);
      expect(course).not.toBeNull();
      expect(course.progress).toBe(67); // 2 out of 3 = 67%
      expect(course.isCompleted).toBe(false);
    });
  });

  describe('CoursesService delegator', () => {
    it('delegates getCourses and getCourseById to MobileAPI', async () => {
      const getCoursesSpy = jest.spyOn(MobileAPI, 'getCourses').mockResolvedValue([{ id: 1, name: 'Test' }]);
      const getCourseByIdSpy = jest.spyOn(MobileAPI, 'getCourseById').mockResolvedValue({ id: 1, name: 'Test', progress: 50 });

      const list = await CoursesService.getCourses({ id: 10 }, true);
      expect(getCoursesSpy).toHaveBeenCalledWith({ id: 10 }, true);
      expect(list).toHaveLength(1);

      const item = await CoursesService.getCourseById(1, { id: 10 }, true);
      expect(getCourseByIdSpy).toHaveBeenCalledWith(1, { id: 10 }, true);
      expect(item.progress).toBe(50);

      getCoursesSpy.mockRestore();
      getCourseByIdSpy.mockRestore();
    });
  });
});
