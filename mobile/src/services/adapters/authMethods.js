import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const authMethods = {
    async loginWithMoodle(serverUrl, username, password, service = 'moodle_mobile_app') {
    const cleanUrl = normalizeMoodleUrl(serverUrl);
    const client = new MoodleClient(cleanUrl, '');
    const res = await client.loginWithCredentials(username, password, service);
    if (res && res.token) {
      await this.saveServerConfig({
        serverUrl: cleanUrl,
        token: res.token,
        privatetoken: res.privatetoken,
        isLiveConnected: true,
        lastConnected: new Date().toISOString(),
      });
      if (res.siteInfo) {
        await saveToStorage(STORAGE_KEYS.SITE_INFO, res.siteInfo);
      }
      const siteInfo = res.siteInfo || {};
      const userProfile = {
        id: siteInfo.userid || 2,
        username: siteInfo.username || username,
        firstname: siteInfo.firstname || siteInfo.fullname?.split(' ')[0] || username,
        lastname: siteInfo.lastname || siteInfo.fullname?.split(' ')[1] || '',
        fullname: siteInfo.fullname || username,
        email: siteInfo.userpictureurl ? `${siteInfo.username || username}@moodle` : `${username}@moodle`,
        role: siteInfo.userissiteadmin ? 'admin' : 'student',
        roleLabel: siteInfo.userissiteadmin ? 'Site Administrator' : 'Enrolled Student',
        avatar: getMoodleMediaUrl(siteInfo.userpictureurl, res.token) || null,
        siteName: siteInfo.sitename || 'Moodle Server',
        serverUrl: cleanUrl,
        token: res.token,
      };
      await saveToStorage(STORAGE_KEYS.ACTIVE_USER, userProfile);

      // Eagerly warm the autologin key cache after login (non-blocking)
      // This ensures the key is ready before the user opens a SCORM module
      if (res.privatetoken) {
        setTimeout(async () => {
          try {
            const autoClient = new MoodleClient(cleanUrl, res.token);
            const autoRes = await autoClient.getAutoLoginKey(res.privatetoken);
            if (autoRes && autoRes.key && autoRes.autologinurl) {
              const warmCache = {
                key: autoRes.key,
                autologinurl: autoRes.autologinurl,
                userId: userProfile.id,
                ts: Date.now(),
              };
              this._autoLoginCache = warmCache;
              this._autoLoginCacheLoaded = true;
              saveToStorage(STORAGE_KEYS.AUTOLOGIN_CACHE, warmCache).catch(() => {});
              console.log('[AutoLogin] Key pre-warmed successfully after login');
            }
          } catch (e) {
            console.log('[AutoLogin] Pre-warm note:', e.message);
          }
        }, 2000); // 2 second delay so login completes first
      }

      return {
        success: true,
        token: res.token,
        privatetoken: res.privatetoken,
        user: userProfile,
        siteInfo: res.siteInfo || {},
      };
    }
    return { success: false, error: 'Invalid response from Moodle' };
  },

    async loginWithToken(serverUrl, token, privatetoken = '') {
    const cleanUrl = normalizeMoodleUrl(serverUrl);
    const client = new MoodleClient(cleanUrl, token);
    try {
      const siteInfo = await client.getSiteInfo();
      await this.saveServerConfig({
        serverUrl: cleanUrl,
        token: token,
        privatetoken: privatetoken,
        isLiveConnected: true,
        lastConnected: new Date().toISOString(),
      });
      await saveToStorage(STORAGE_KEYS.SITE_INFO, siteInfo);
      
      const username = siteInfo.username || 'user';
      const userProfile = {
        id: siteInfo.userid || 2,
        username,
        firstname: siteInfo.firstname || siteInfo.fullname?.split(' ')[0] || username,
        lastname: siteInfo.lastname || siteInfo.fullname?.split(' ')[1] || '',
        fullname: siteInfo.fullname || username,
        email: siteInfo.userpictureurl ? `${username}@moodle` : `${username}@moodle`,
        role: siteInfo.userissiteadmin ? 'admin' : 'student',
        roleLabel: siteInfo.userissiteadmin ? 'Site Administrator' : 'Enrolled Student',
        avatar: getMoodleMediaUrl(siteInfo.userpictureurl, token) || null,
        siteName: siteInfo.sitename || 'Moodle Server',
        serverUrl: cleanUrl,
        token: token,
      };
      await saveToStorage(STORAGE_KEYS.ACTIVE_USER, userProfile);
      
      if (privatetoken) {
        setTimeout(async () => {
          try {
            const autoRes = await client.getAutoLoginKey(privatetoken);
            if (autoRes && autoRes.key && autoRes.autologinurl) {
              const warmCache = {
                key: autoRes.key,
                autologinurl: autoRes.autologinurl,
                userId: userProfile.id,
                ts: Date.now(),
              };
              this._autoLoginCache = warmCache;
              this._autoLoginCacheLoaded = true;
              saveToStorage(STORAGE_KEYS.AUTOLOGIN_CACHE, warmCache).catch(() => {});
            }
          } catch (e) {
             console.log('[AutoLogin] Pre-warm note:', e.message);
          }
        }, 2000);
      }
      return { success: true, token, privatetoken, user: userProfile, siteInfo };
    } catch(e) {
       return { success: false, error: e.message };
    }
  },

    async registerPushDevice(pushToken, uuid, platform, model) {
    const client = await this.getClient();
    if (!client) return { success: false, error: 'Not authenticated' };
    try {
      const res = await client.addDevice('com.moodle.lms.app', 'Expo Device', model, platform, '1.0.0', pushToken, uuid);
      return { success: true, response: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

    async resetToDefaults() {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    await SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_CONFIG);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACTIVE_USER);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTOLOGIN_CACHE);
    this._client = null;
  },

};
