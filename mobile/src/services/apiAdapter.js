export {
  STORAGE_KEYS,
  getMoodleMediaUrl,
  fixMoodleHtmlContent,
  extractCourseImage,
  saveToStorage,
  getFromStorage,
  swrFetch,
} from './adapterUtils';

import { courseMethods } from './adapters/courseMethods';
import { quizMethods } from './adapters/quizMethods';
import { assignMethods } from './adapters/assignMethods';
import { forumMethods } from './adapters/forumMethods';
import { gradesMethods } from './adapters/gradesMethods';
import { calendarMethods } from './adapters/calendarMethods';
import { messagesMethods } from './adapters/messagesMethods';
import { badgesMethods } from './adapters/badgesMethods';
import { lessonMethods } from './adapters/lessonMethods';
import { filesMethods } from './adapters/filesMethods';
import { authMethods } from './adapters/authMethods';
import { coreMethods } from './adapters/coreMethods';

export const MobileAPI = {
  _client: null,
  _logs: [],
  _autoLoginCache: null,
  _autoLoginCacheLoaded: false,

  ...courseMethods,
  ...quizMethods,
  ...assignMethods,
  ...forumMethods,
  ...gradesMethods,
  ...calendarMethods,
  ...messagesMethods,
  ...badgesMethods,
  ...lessonMethods,
  ...filesMethods,
  ...authMethods,
  ...coreMethods,
};
