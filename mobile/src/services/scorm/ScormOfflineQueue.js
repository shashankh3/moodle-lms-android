/**
 * SCORM Offline Track Queue
 * Inspired by AddonModScormOffline from moodlehq/moodleapp
 *
 * When network is unavailable during LMSCommit/LMSFinish, tracks are
 * stored here and synced when connectivity is restored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'scorm_offline_tracks_queue';

export const ScormOfflineQueue = {
  /**
   * Add tracks to the offline queue.
   */
  async addOfflineTracks(scormId, attempt, scoId, tracks) {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push({
        scormId,
        attempt,
        scoId,
        tracks,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log('[ScormOfflineQueue] Queued', tracks.length, 'tracks for scormId', scormId);
    } catch (err) {
      console.warn('[ScormOfflineQueue] Failed to queue tracks:', err.message);
    }
  },

  /**
   * Get all queued offline tracks (optionally filtered by scormId/attempt/scoId).
   */
  async getOfflineTracks(scormId = null, attempt = null, scoId = null) {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      return queue.filter(entry => {
        if (scormId !== null && entry.scormId !== scormId) return false;
        if (attempt  !== null && entry.attempt !== attempt)  return false;
        if (scoId    !== null && entry.scoId !== scoId)      return false;
        return true;
      });
    } catch (err) {
      return [];
    }
  },

  /**
   * Sync all offline tracks to Moodle.
   * Called automatically by NetworkMonitor when connectivity is restored.
   */
  async syncOfflineTracks(client) {
    if (!client) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];

      if (queue.length === 0) return { synced: 0, failed: 0 };

      console.log('[ScormOfflineQueue] Syncing', queue.length, 'offline track entries...');

      const remaining = [];

      for (const entry of queue) {
        try {
          await client.insertScormTracks(entry.scoId, entry.tracks);
          synced++;
        } catch (err) {
          const isFatalServerConfig =
            err.message?.includes('external_functions') ||
            err.message?.includes('accessexception') ||
            err.message?.includes('dml_missing_record_exception');

          if (!isFatalServerConfig) {
            remaining.push(entry);
          }
          failed++;
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      if (synced > 0 || failed > 0) {
        console.log('[ScormOfflineQueue] Sync complete:', synced, 'synced,', failed, 'failed/cleaned');
      }
    } catch (err) {
      console.warn('[ScormOfflineQueue] Sync error:', err.message);
    }

    return { synced, failed };
  },

  /**
   * Clear all offline tracks (use after successful full sync).
   */
  async clearQueue() {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch (err) {}
  },
};
