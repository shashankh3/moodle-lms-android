import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';
import { storage } from '../storage/SecureStorage';

export const coreMethods = {
    async getClient() {
    const cfg = await this.getServerConfig();
    if (cfg && cfg.token) {
      if (!this._client || this._client.baseUrl !== cfg.serverUrl || this._client.token !== cfg.token) {
        this._client = new MoodleClient(cfg.serverUrl, cfg.token, (log) => {
          this._logs.unshift(log);
          if (this._logs.length > 50) this._logs.pop();
        });
      }
      return this._client;
    }
    return null;
  },

    async getLogs() {
    return this._logs;
  },

    async getServerConfig() {
    return await getFromStorage(STORAGE_KEYS.SERVER_CONFIG);
  },

    async saveServerConfig(config) {
    await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, config);
  },

    async getSiteInfo() {
    return await getFromStorage(STORAGE_KEYS.SITE_INFO);
  },

    async testConnection(serverUrl, token) {
    const client = new MoodleClient(serverUrl, token);
    const result = await client.testConnection();
    if (result.success && result.siteInfo) {
      await saveToStorage(STORAGE_KEYS.SITE_INFO, result.siteInfo);
      await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, {
        serverUrl: normalizeMoodleUrl(serverUrl),
        token,
        isLiveConnected: true,
        lastConnected: new Date().toISOString(),
      });
    }
    return result;
  },

    async probeAllApis(serverUrl, token) {
    const client = new MoodleClient(serverUrl, token);
    return client.probeAllApis();
  },

    async executeCustomWsFunction(wsfunction, params = {}, method = 'POST') {
    const client = await this.getClient();
    if (!client) throw new Error('No active live Moodle client connection');
    return client.call(wsfunction, params, method);
  },

    async _loadAutoLoginCache() {
    if (this._autoLoginCacheLoaded) return;
    this._autoLoginCacheLoaded = true;
    try {
      const raw = await storage.getItem(STORAGE_KEYS.AUTOLOGIN_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only restore if not older than 5.5 minutes
        if (parsed && (Date.now() - parsed.ts) < 5.5 * 60 * 1000) {
          this._autoLoginCache = parsed;
          console.log('[AutoLogin] Restored valid key from storage');
        } else {
          console.log('[AutoLogin] Stored key expired, will fetch fresh');
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  },

    async getAuthenticatedUrl(targetUrl) {
    if (!targetUrl) return null;
    try {
      const cfg = await this.getServerConfig();
      if (!cfg || !cfg.token) return targetUrl;

      const cleanBase = (cfg.serverUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
      let fullTargetUrl = targetUrl;
      if (targetUrl.startsWith('/')) {
        fullTargetUrl = `${cleanBase}${targetUrl}`;
      }

      if (cfg.privatetoken) {
        // Load from AsyncStorage on first call
        await this._loadAutoLoginCache();

        const now = Date.now();
        const CACHE_TTL = 5.5 * 60 * 1000;
        let autoLoginData = null;

        if (this._autoLoginCache && (now - this._autoLoginCache.ts) < CACHE_TTL) {
          // Valid cached key
          autoLoginData = this._autoLoginCache;
        } else {
          // Fetch a fresh key from Moodle
          try {
            const client = new MoodleClient(cfg.serverUrl, cfg.token);
            const res = await client.getAutoLoginKey(cfg.privatetoken);
            if (res && res.key && res.autologinurl) {
              const user = await getFromStorage(STORAGE_KEYS.ACTIVE_USER);
              const siteInfo = await getFromStorage(STORAGE_KEYS.SITE_INFO);
              const newCache = {
                key: res.key,
                autologinurl: res.autologinurl,
                userId: user?.id || siteInfo?.userid,
                ts: now,
              };
              this._autoLoginCache = newCache;
              // Persist to encrypted storage so it survives reloads
              storage.setItem(STORAGE_KEYS.AUTOLOGIN_CACHE, JSON.stringify(newCache)).catch(() => {});
              autoLoginData = newCache;
            }
          } catch (autoLoginErr) {
            console.warn('AutoLogin generation note:', autoLoginErr.message);
            // Rate-limited — use stale cached key as fallback (Moodle still honours it)
            if (this._autoLoginCache) {
              console.log('[AutoLogin] Using stale cached key as rate-limit fallback');
              autoLoginData = this._autoLoginCache;
            }
          }
        }

        if (autoLoginData?.key && autoLoginData?.autologinurl && autoLoginData?.userId) {
          const sep = autoLoginData.autologinurl.includes('?') ? '&' : '?';
          return `${autoLoginData.autologinurl}${sep}userid=${autoLoginData.userId}&key=${autoLoginData.key}&urlto=${encodeURIComponent(fullTargetUrl)}`;
        }
      }

      // Fallback: pluginfile URLs get token appended
      if (fullTargetUrl.includes('pluginfile.php') && !fullTargetUrl.includes('token=')) {
        const sep = fullTargetUrl.includes('?') ? '&' : '?';
        return `${fullTargetUrl}${sep}token=${cfg.token}`;
      }

      return fullTargetUrl;
    } catch (e) {
      console.warn('getAuthenticatedUrl error:', e);
    }
    return targetUrl;
  },

};
