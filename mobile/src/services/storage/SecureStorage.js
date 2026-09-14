/**
 * SecureStorage — routes sensitive Moodle auth data to expo-secure-store
 * (encrypted on-device storage) while keeping non-sensitive cache data in
 * AsyncStorage. Falls back to AsyncStorage transparently when SecureStore
 * is unavailable (e.g. inside Expo Go on some platforms or value too large).
 *
 * Sensitive keys: server config (token + privatetoken), active user profile
 * (contains token), autologin key cache, and cached site info.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const SENSITIVE_KEYS = new Set([
  'moodle_mobile_server_config',
  'moodle_mobile_active_user_v2',
  'moodle_mobile_autologin_cache',
  'moodle_mobile_site_info',
]);

// SecureStore has a per-value size limit (2048 bytes on Android). Values
// larger than this are kept in AsyncStorage as a safe fallback.
const MAX_SECURE_VALUE_BYTES = 2000;

let _secureAvailable = null;
async function isSecureStoreAvailable() {
  if (_secureAvailable !== null) return _secureAvailable;
  try {
    _secureAvailable =
      typeof SecureStore.setItemAsync === 'function' &&
      typeof SecureStore.getItemAsync === 'function' &&
      typeof SecureStore.deleteItemAsync === 'function';
  } catch (e) {
    _secureAvailable = false;
  }
  return _secureAvailable;
}

async function secureSet(key, value) {
  if (value != null && value.length > MAX_SECURE_VALUE_BYTES) return false;
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (e) {
    console.warn(`[SecureStorage] SecureStore write failed for ${key}, using AsyncStorage:`, e.message);
    return false;
  }
}

/**
 * One-time eager migration: move any sensitive keys still in AsyncStorage
 * to SecureStore and delete the plaintext copies. Safe to call at every
 * startup; per-key lazy migration also happens on read.
 */
export async function migrateSensitiveStorage() {
  if (!(await isSecureStoreAvailable())) return;
  for (const key of SENSITIVE_KEYS) {
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        const ok = await secureSet(key, legacy);
        if (ok) await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      // Non-fatal — lazy migration will retry on read
    }
  }
}

export const storage = {
  async getItem(key) {
    if (SENSITIVE_KEYS.has(key)) {
      try {
        const secured = await SecureStore.getItemAsync(key);
        if (secured != null) return secured;
        // Legacy plaintext value from before the migration
        const legacy = await AsyncStorage.getItem(key);
        if (legacy != null && (await isSecureStoreAvailable())) {
          // Lazy migration: secure it, then drop the plaintext copy
          const ok = await secureSet(key, legacy);
          if (ok) AsyncStorage.removeItem(key).catch(() => {});
        }
        return legacy;
      } catch (e) {
        return AsyncStorage.getItem(key);
      }
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key, value) {
    if (SENSITIVE_KEYS.has(key)) {
      if (await isSecureStoreAvailable()) {
        const ok = await secureSet(key, value);
        if (ok) {
          // Never keep a plaintext copy of sensitive values
          AsyncStorage.removeItem(key).catch(() => {});
          return;
        }
      }
    }
    return AsyncStorage.setItem(key, value);
  },

  async removeItem(key) {
    if (SENSITIVE_KEYS.has(key)) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignore — best effort
      }
    }
    return AsyncStorage.removeItem(key);
  },

  async multiRemove(keys) {
    await Promise.all((keys || []).map((k) => this.removeItem(k)));
  },
};
