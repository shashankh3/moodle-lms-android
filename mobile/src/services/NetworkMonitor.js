/**
 * NetworkMonitor — Phase 3 (Moodle Offline Pattern)
 * Zero-dependency pure JavaScript network & sync manager.
 * Works seamlessly in Expo Go, Android APK, iOS, and Web without native dependencies.
 */
import { ScormOfflineQueue } from './scorm/ScormOfflineQueue';
import { MobileAPI } from './apiAdapter';

let _isOnline = true;
let _intervalId = null;
let _initialized = false;

export const NetworkMonitor = {
  /**
   * Start periodic connectivity check and offline track sync.
   * Call this once at app startup (in App.js or root component).
   */
  initialize() {
    if (_initialized) return;
    _initialized = true;

    // Run initial sync check
    this.checkAndSync();

    // Check connectivity and sync queued tracks every 30 seconds
    _intervalId = setInterval(() => {
      this.checkAndSync();
    }, 30000);
  },

  /**
   * Checks network connectivity and drains the offline SCORM track queue if online.
   */
  async checkAndSync() {
    try {
      const client = await MobileAPI.getClient();
      if (!client || !client.baseUrl) return;

      const wasOffline = !_isOnline;

      // Quick HEAD / lightweight fetch to test real server reachability
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

      try {
        const res = await fetch(`${client.baseUrl}/login/token.php`, {
          method: 'GET',
          signal: controller?.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);
        _isOnline = res.status < 500;
      } catch (netErr) {
        if (timeoutId) clearTimeout(timeoutId);
        _isOnline = false;
      }

      if (_isOnline) {
        // Drain any pending offline tracks
        const result = await ScormOfflineQueue.syncOfflineTracks(client);
        if (result && result.synced > 0) {
          console.log(`[NetworkMonitor] Synced ${result.synced} offline SCORM track entries.`);
        }
      }
    } catch (e) {
      // Non-blocking
    }
  },

  /**
   * Returns true if the device currently has internet connectivity.
   */
  isOnline() {
    return _isOnline;
  },

  /**
   * Manually mark connectivity state and trigger sync immediately if online.
   */
  setOnline(online) {
    const wasOffline = !_isOnline;
    _isOnline = !!online;
    if (wasOffline && _isOnline) {
      this.checkAndSync();
    }
  },

  /**
   * Tear down the monitor interval.
   */
  destroy() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
      _initialized = false;
    }
  },
};
