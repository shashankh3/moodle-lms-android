jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map();
  return {
    __mockStore: mockStore,
    getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
    setItem: jest.fn((k, v) => { mockStore.set(k, String(v)); return Promise.resolve(); }),
    removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureStore from 'expo-secure-store';
import { storage, migrateSensitiveStorage, SENSITIVE_KEYS } from '../src/services/storage/SecureStorage';

const asyncStore = AsyncStorage.__mockStore;
const secureStore = SecureStore.__mockSecure;

const SERVER_CONFIG = 'moodle_mobile_server_config';
const COURSE_CACHE = 'moodle_courses_cache_x';
const CONFIG_JSON = JSON.stringify({ serverUrl: 'https://mh.unilearn.org.in', token: 'secret-token' });

beforeEach(() => {
  asyncStore.clear();
  secureStore.clear();
  jest.clearAllMocks();
});

describe('storage routing', () => {
  it('writes sensitive keys to SecureStore and keeps them out of AsyncStorage', async () => {
    await storage.setItem(SERVER_CONFIG, CONFIG_JSON);
    expect(secureStore.get(SERVER_CONFIG)).toBe(CONFIG_JSON);
    expect(asyncStore.has(SERVER_CONFIG)).toBe(false);
  });

  it('reads sensitive keys back from SecureStore', async () => {
    await storage.setItem(SERVER_CONFIG, CONFIG_JSON);
    expect(await storage.getItem(SERVER_CONFIG)).toBe(CONFIG_JSON);
  });

  it('keeps non-sensitive cache keys in AsyncStorage', async () => {
    await storage.setItem(COURSE_CACHE, '[1,2,3]');
    expect(asyncStore.get(COURSE_CACHE)).toBe('[1,2,3]');
    expect(secureStore.has(COURSE_CACHE)).toBe(false);
    expect(await storage.getItem(COURSE_CACHE)).toBe('[1,2,3]');
  });

  it('falls back to AsyncStorage when the value exceeds the SecureStore limit', async () => {
    const bigValue = JSON.stringify({ blob: 'x'.repeat(3000) });
    await storage.setItem(SERVER_CONFIG, bigValue);
    expect(secureStore.has(SERVER_CONFIG)).toBe(false);
    expect(await storage.getItem(SERVER_CONFIG)).toBe(bigValue);
  });

  it('removeItem clears both stores for sensitive keys', async () => {
    await storage.setItem(SERVER_CONFIG, CONFIG_JSON);
    // Simulate a stray plaintext copy
    asyncStore.set(SERVER_CONFIG, CONFIG_JSON);
    await storage.removeItem(SERVER_CONFIG);
    expect(secureStore.has(SERVER_CONFIG)).toBe(false);
    expect(asyncStore.has(SERVER_CONFIG)).toBe(false);
    expect(await storage.getItem(SERVER_CONFIG)).toBeNull();
  });

  it('multiRemove clears every key', async () => {
    await storage.setItem(COURSE_CACHE, '1');
    await storage.setItem(SERVER_CONFIG, CONFIG_JSON);
    await storage.multiRemove([COURSE_CACHE, SERVER_CONFIG]);
    expect(await storage.getItem(COURSE_CACHE)).toBeNull();
    expect(await storage.getItem(SERVER_CONFIG)).toBeNull();
  });
});

describe('legacy plaintext migration', () => {
  it('migrateSensitiveStorage moves plaintext values and deletes them', async () => {
    asyncStore.set(SERVER_CONFIG, CONFIG_JSON);
    asyncStore.set('moodle_mobile_active_user_v2', '{"token":"t"}');
    await migrateSensitiveStorage();
    expect(secureStore.get(SERVER_CONFIG)).toBe(CONFIG_JSON);
    expect(secureStore.get('moodle_mobile_active_user_v2')).toBe('{"token":"t"}');
    expect(asyncStore.has(SERVER_CONFIG)).toBe(false);
    expect(asyncStore.has('moodle_mobile_active_user_v2')).toBe(false);
  });

  it('lazily migrates on read when a legacy plaintext value exists', async () => {
    asyncStore.set(SERVER_CONFIG, CONFIG_JSON);
    const result = await storage.getItem(SERVER_CONFIG);
    expect(result).toBe(CONFIG_JSON);
    expect(secureStore.get(SERVER_CONFIG)).toBe(CONFIG_JSON);
    expect(asyncStore.has(SERVER_CONFIG)).toBe(false);
  });

  it('covers all four sensitive Moodle keys', () => {
    expect(SENSITIVE_KEYS.has('moodle_mobile_server_config')).toBe(true);
    expect(SENSITIVE_KEYS.has('moodle_mobile_active_user_v2')).toBe(true);
    expect(SENSITIVE_KEYS.has('moodle_mobile_autologin_cache')).toBe(true);
    expect(SENSITIVE_KEYS.has('moodle_mobile_site_info')).toBe(true);
  });
});
