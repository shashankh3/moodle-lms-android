/**
 * NetworkMonitor — Phase 3 (Moodle Offline Pattern)
 * Uses @react-native-community/netinfo for real-time connectivity status.
 */
import { ScormOfflineQueue } from './scorm/ScormOfflineQueue';
import { MobileAPI } from './apiAdapter';
import NetInfo from '@react-native-community/netinfo';

let _isOnline = true;
let _unsubscribe = null;
let _initialized = false;

export const NetworkMonitor = {
  /**
   * Start passive network listening.
   */
  initialize() {
    if (_initialized) return;
    _initialized = true;

    _unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !_isOnline;
      // If isInternetReachable is null, assume true until proven otherwise
      _isOnline = !!(state.isConnected && state.isInternetReachable !== false);
      
      if (wasOffline && _isOnline) {
        this.checkAndSync();
      }
    });

    // Run initial sync check
    this.checkAndSync();
  },

  /**
   * Drains the offline SCORM track queue if online.
   */
  async checkAndSync() {
    try {
      const client = await MobileAPI.getClient();
      if (!client || !client.baseUrl) return;

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
   * Tear down the monitor listener.
   */
  destroy() {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
      _initialized = false;
    }
  },
};
