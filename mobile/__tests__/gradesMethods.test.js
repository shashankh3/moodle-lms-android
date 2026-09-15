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

import { gradesMethods } from '../src/services/adapters/gradesMethods';

describe('gradesMethods', () => {
  let mockClient;
  let context;

  beforeEach(() => {
    mockClient = {
      getUserGradeItems: jest.fn(),
      getUserGradesTable: jest.fn(),
      getCourseGrades: jest.fn(),
    };

    context = {
      _client: mockClient,
      async getClient() {
        return mockClient;
      },
      async getSiteInfo() {
        return { userid: 14 };
      },
      async getCourses(user, forceRefresh) {
        return [
          { id: 101, fullname: 'Mathematics 101' },
          { id: 102, fullname: 'Physics 201' },
        ];
      },
      ...gradesMethods,
    };
  });

  it('fetches grades and maps grade items correctly', async () => {
    mockClient.getCourseGrades.mockResolvedValue({
      grades: [
        { courseid: 101, grade: '85.00', rawgrade: 85 },
      ],
    });

    mockClient.getUserGradeItems.mockImplementation(async (courseId, userId) => {
      if (courseId === 101) {
        return {
          usergrades: [
            {
              courseid: 101,
              userid: 14,
              gradeitems: [
                {
                  id: 1,
                  itemname: 'Quiz 1',
                  itemtype: 'mod',
                  graderaw: 9,
                  grademax: 10,
                  gradeformatted: '9.00',
                  percentageformatted: '90.00 %',
                  weightraw: 50,
                },
                {
                  id: 2,
                  itemname: 'Midterm Exam',
                  itemtype: 'mod',
                  graderaw: 80,
                  grademax: 100,
                  gradeformatted: '80.00',
                  percentageformatted: '80.00 %',
                  weightraw: 50,
                },
                {
                  id: 3,
                  itemname: 'Course total',
                  itemtype: 'course',
                  graderaw: 85,
                  grademax: 100,
                  gradeformatted: '85.00',
                  percentageformatted: '85.00 %',
                },
              ],
            },
          ],
        };
      }
      return { usergrades: [] };
    });

    const reports = await context.getGrades(14, true);

    expect(reports.length).toBe(2);

    const mathReport = reports.find(r => r.courseId === 101);
    expect(mathReport).toBeDefined();
    expect(mathReport.courseName).toBe('Mathematics 101');
    expect(mathReport.activitiesCount).toBe(2);
    expect(mathReport.finalGrade).toBe('85%');
    expect(mathReport.items.length).toBe(2);
    expect(mathReport.items[0].rawGrade).toBe('9.00');
    expect(mathReport.items[0].percentage).toBe(90);
    expect(mathReport.items[0].status).toBe('Graded');
  });

  it('falls back to getUserGradesTable when getUserGradeItems has no items', async () => {
    mockClient.getCourseGrades.mockResolvedValue({ grades: [] });
    mockClient.getUserGradeItems.mockResolvedValue({ usergrades: [] });
    mockClient.getUserGradesTable.mockResolvedValue({
      tables: [
        {
          courseid: 101,
          tabledata: [
            {
              itemname: { content: 'Assignment 1' },
              grade: { content: '18.00' },
              weight: { content: '20.00 %' },
              percentage: { content: '90.00 %' },
            },
            {
              itemname: { content: 'Course total', class: 'gradeitemname courseitem' },
              grade: { content: '90.00' },
              percentage: { content: '90.00 %' },
            },
          ],
        },
      ],
    });

    const reports = await context.getGrades(14, true);
    const mathReport = reports.find(r => r.courseId === 101);

    expect(mathReport.items.length).toBe(1);
    expect(mathReport.items[0].name).toBe('Assignment 1');
    expect(mathReport.items[0].rawGrade).toBe('18.00');
    expect(mathReport.items[0].percentage).toBe(90);
    expect(mathReport.finalGrade).toBe('90%');
  });

  it('falls back to overview grade when individual grade items are empty', async () => {
    mockClient.getCourseGrades.mockResolvedValue({
      grades: [
        { courseid: 102, grade: '92.00', rawgrade: 92 },
      ],
    });

    mockClient.getUserGradeItems.mockResolvedValue({
      usergrades: [],
    });
    mockClient.getUserGradesTable.mockResolvedValue({ tables: [] });

    const reports = await context.getGrades(14, true);

    const physReport = reports.find(r => r.courseId === 102);
    expect(physReport).toBeDefined();
    expect(physReport.activitiesCount).toBe(0);
    expect(physReport.letter).toBe('92.00');
    expect(physReport.finalGrade).toBe('92.00');
    expect(physReport.items).toEqual([]);
  });

  it('synthesizes course list from overview grades when getCourses returns empty', async () => {
    context.getCourses = jest.fn().mockResolvedValue([]);
    mockClient.getCourseGrades.mockResolvedValue({
      grades: [
        { courseid: 505, grade: '78.50', rawgrade: 78.5 },
      ],
    });
    mockClient.getUserGradeItems.mockResolvedValue({ usergrades: [] });
    mockClient.getUserGradesTable.mockResolvedValue({ tables: [] });

    const reports = await context.getGrades(14, true);
    expect(reports.length).toBe(1);
    expect(reports[0].courseId).toBe(505);
    expect(reports[0].finalGrade).toBe('78.50');
  });

  it('safely strips HTML from gradeformatted and handles NaN gracefully', async () => {
    mockClient.getCourseGrades.mockResolvedValue({ grades: [] });
    mockClient.getUserGradeItems.mockResolvedValue({
      usergrades: [
        {
          courseid: 101,
          gradeitems: [
            {
              id: 1,
              itemname: '<b>Assignment 1</b>',
              itemtype: 'mod',
              graderaw: null,
              gradeformatted: '<span class="grade">-</span>',
              percentageformatted: '-',
            },
          ],
        },
      ],
    });
    mockClient.getUserGradesTable.mockResolvedValue({ tables: [] });

    const reports = await context.getGrades(14, true);
    const mathReport = reports.find(r => r.courseId === 101);

    expect(mathReport.items[0].name).toBe('Assignment 1');
    expect(mathReport.items[0].rawGrade).toBe('-');
    expect(mathReport.items[0].percentage).toBeNull();
    expect(mathReport.items[0].status).toBe('Pending');
    expect(mathReport.finalGrade).toBe('-');
  });
});
