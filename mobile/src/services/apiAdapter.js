import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodleClient, normalizeMoodleUrl } from './moodleClient';

export const STORAGE_KEYS = {
  SERVER_CONFIG: 'moodle_mobile_server_config',
  SITE_INFO: 'moodle_mobile_site_info',
  ACTIVE_USER: 'moodle_mobile_active_user_v2',
  AUTOLOGIN_CACHE: 'moodle_mobile_autologin_cache',
};

export function getMoodleMediaUrl(url, token) {
  if (!url || typeof url !== 'string') return url;
  if (!token) return url;

  if (url.includes('token=')) return url;

  if (url.includes('/webservice/pluginfile.php/')) {
    return url.includes('?') ? `${url}&token=${token}` : `${url}?token=${token}`;
  }

  if (url.includes('/pluginfile.php/')) {
    const newUrl = url.replace('/pluginfile.php/', '/webservice/pluginfile.php/');
    return newUrl.includes('?') ? `${newUrl}&token=${token}` : `${newUrl}?token=${token}`;
  }

  return url;
}

export function fixMoodleHtmlContent(html, token, baseUrl = 'https://mh.unilearn.org.in') {
  if (!html || typeof html !== 'string') return '';
  const cleanBase = (baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');

  let fixed = html.replace(/@@PLUGINFILE@@\//g, `${cleanBase}/webservice/pluginfile.php/`);

  fixed = fixed.replace(
    new RegExp(`${cleanBase}/pluginfile.php/`, 'g'),
    `${cleanBase}/webservice/pluginfile.php/`
  );

  fixed = fixed.replace(/\/webservice\/pluginfile\.php\/([^"'\s?]+)/g, (match, path) => {
    return `/webservice/pluginfile.php/${path}?token=${token}`;
  });

  fixed = fixed.replace(/src="\/([^"]+)"/g, `src="${cleanBase}/$1"`);
  fixed = fixed.replace(/href="\/([^"]+)"/g, `href="${cleanBase}/$1"`);

  return fixed;
}

export function extractCourseImage(c, token) {
  if (!c) return null;

  let rawUrl = c.courseimage || null;

  if (!rawUrl && Array.isArray(c.overviewfiles) && c.overviewfiles.length > 0) {
    const imgFile =
      c.overviewfiles.find((f) => {
        const mime = f.mimetype || '';
        const fname = f.fileurl || f.url || f.filename || '';
        return mime.startsWith('image/') || /\.(jpeg|jpg|gif|png|webp|svg)/i.test(fname);
      }) || c.overviewfiles[0];
    if (imgFile) rawUrl = imgFile.fileurl || imgFile.url;
  }

  if (!rawUrl) rawUrl = c.image || c.thumbnail || null;

  if (!rawUrl && c.summary && typeof c.summary === 'string') {
    const match = c.summary.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) rawUrl = match[1];
  }

  if (!rawUrl && Array.isArray(c.customfields)) {
    const cf = c.customfields.find((f) => f.type === 'image' || f.shortname === 'courseimage');
    if (cf && cf.value) rawUrl = cf.value;
  }

  if (!rawUrl) return null;

  if (rawUrl.includes('token=')) return rawUrl;

  return getMoodleMediaUrl(rawUrl, token);
}

export async function saveToStorage(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

export async function getFromStorage(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function swrFetch(cacheKey, fetchFn, forceRefresh = false) {
  if (forceRefresh) {
    try {
      const data = await fetchFn();
      if (data) await saveToStorage(cacheKey, data);
      return data;
    } catch (e) {
      console.warn(`[SWR] Force refresh failed for ${cacheKey}`, e);
      return getFromStorage(cacheKey);
    }
  }

  const cachedData = await getFromStorage(cacheKey);

  const networkPromise = fetchFn()
    .then(async (data) => {
      if (data) await saveToStorage(cacheKey, data);
      return data;
    })
    .catch((e) => {
      console.warn(`[SWR] Background fetch failed for ${cacheKey}`, e.message);
      return null;
    });

  if (cachedData) {
    return cachedData;
  }

  const data = await networkPromise;
  return data || [];
}

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
