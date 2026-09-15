/**
 * Auth Service — Phase 2 (Service Layer Refactoring)
 * Handles authentication, site info, stored server config, and autologin keys.
 * Reference: moodlehq/moodleapp core/features/login/services
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';
import { getMoodleMediaUrl } from '../apiAdapter';
import { storage } from '../storage/SecureStorage';

export const STORAGE_KEYS = {
  SERVER_CONFIG: 'moodle_mobile_server_config',
  SITE_INFO: 'moodle_mobile_site_info',
  ACTIVE_USER: 'moodle_mobile_active_user_v2',
  AUTOLOGIN_CACHE: 'moodle_mobile_autologin_cache',
};

export const AuthService = {
  _client: null,
  _autoLoginCache: null,
  _autoLoginCacheLoaded: false,

  async getStoredItem(key) {
    try {
      const raw = await storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  async setStoredItem(key, data) {
    try {
      await storage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`[AuthService] Error saving ${key}:`, e);
    }
  },

  async getServerConfig() {
    return this.getStoredItem(STORAGE_KEYS.SERVER_CONFIG);
  },

  async saveServerConfig(cfg) {
    await this.setStoredItem(STORAGE_KEYS.SERVER_CONFIG, cfg);
  },

  async getSiteInfo() {
    return this.getStoredItem(STORAGE_KEYS.SITE_INFO);
  },

  async getActiveUser() {
    return this.getStoredItem(STORAGE_KEYS.ACTIVE_USER);
  },

  async getClient(onLog = null) {
    const cfg = await this.getServerConfig();
    if (cfg && cfg.token) {
      if (!this._client || this._client.baseUrl !== cfg.serverUrl || this._client.token !== cfg.token) {
        this._client = new MoodleClient(cfg.serverUrl, cfg.token, onLog);
      }
      return this._client;
    }
    return null;
  },

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
        await this.setStoredItem(STORAGE_KEYS.SITE_INFO, res.siteInfo);
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
      await this.setStoredItem(STORAGE_KEYS.ACTIVE_USER, userProfile);

      // Pre-warm autologin key for non-admins
      if (res.privatetoken && !siteInfo.userissiteadmin) {
        setTimeout(async () => {
          try {
            const autoClient = new MoodleClient(cleanUrl, res.token);
            const autoRes = await autoClient.getAutoLoginKey(res.privatetoken);
            if (autoRes && autoRes.key && autoRes.autologinurl && !autoRes.error && !autoRes.errorcode) {
              const warmCache = {
                key: autoRes.key,
                autologinurl: autoRes.autologinurl,
                userId: userProfile.id,
                ts: Date.now(),
              };
              this._autoLoginCache = warmCache;
              this._autoLoginCacheLoaded = true;
              this.setStoredItem(STORAGE_KEYS.AUTOLOGIN_CACHE, warmCache).catch(() => {});
            }
          } catch (e) {
            console.log('[AutoLogin] Pre-warm note:', e.message);
          }
        }, 2000);
      }

      return {
        success: true,
        token: res.token,
        privatetoken: res.privatetoken,
        siteInfo,
        user: userProfile,
      };
    }
    throw new Error('Authentication failed: Invalid credentials or Web Services disabled on Moodle server.');
  },

  async logout() {
    await storage.multiRemove(Object.values(STORAGE_KEYS));
    this._client = null;
    this._autoLoginCache = null;
    this._autoLoginCacheLoaded = false;
  },
};
