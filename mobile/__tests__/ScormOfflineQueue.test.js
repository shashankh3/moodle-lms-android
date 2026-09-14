jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map();
  return {
    __mockStore: mockStore,
    getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
    setItem: jest.fn((k, v) => { mockStore.set(k, String(v)); return Promise.resolve(); }),
    removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScormOfflineQueue } from '../src/services/scorm/ScormOfflineQueue';

const store = AsyncStorage.__mockStore;

const makeClient = () => ({ insertScormTracks: jest.fn().mockResolvedValue(true) });

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('ScormOfflineQueue.addOfflineTracks', () => {
  it('queues tracks with metadata', async () => {
    await ScormOfflineQueue.addOfflineTracks(10, 2, 5, [{ element: 'cmi.core.lesson_status', value: 'completed' }]);
    const queued = await ScormOfflineQueue.getOfflineTracks();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      scormId: 10,
      attempt: 2,
      scoId: 5,
      tracks: [{ element: 'cmi.core.lesson_status', value: 'completed' }],
    });
    expect(typeof queued[0].timestamp).toBe('number');
  });

  it('appends to an existing queue', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'b' }]);
    await ScormOfflineQueue.addOfflineTracks(2, 1, 1, [{ element: 'c', value: 'd' }]);
    expect(await ScormOfflineQueue.getOfflineTracks()).toHaveLength(2);
  });
});

describe('ScormOfflineQueue.getOfflineTracks filters', () => {
  beforeEach(async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'a' }]);
    await ScormOfflineQueue.addOfflineTracks(1, 2, 1, [{ element: 'b', value: 'b' }]);
    await ScormOfflineQueue.addOfflineTracks(2, 1, 3, [{ element: 'c', value: 'c' }]);
  });

  it('filters by scormId', async () => {
    const rows = await ScormOfflineQueue.getOfflineTracks(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].scormId).toBe(2);
  });

  it('filters by attempt', async () => {
    const rows = await ScormOfflineQueue.getOfflineTracks(null, 2);
    expect(rows).toHaveLength(1);
    expect(rows[0].attempt).toBe(2);
  });

  it('filters by scoId', async () => {
    const rows = await ScormOfflineQueue.getOfflineTracks(null, null, 3);
    expect(rows).toHaveLength(1);
    expect(rows[0].scoId).toBe(3);
  });
});

describe('ScormOfflineQueue.syncOfflineTracks', () => {
  it('returns zeroes without a client', async () => {
    expect(await ScormOfflineQueue.syncOfflineTracks(null)).toEqual({ synced: 0, failed: 0 });
  });

  it('returns zeroes on an empty queue', async () => {
    expect(await ScormOfflineQueue.syncOfflineTracks(makeClient())).toEqual({ synced: 0, failed: 0 });
  });

  it('syncs successfully and empties the queue', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'a' }]);
    const client = makeClient();
    expect(await ScormOfflineQueue.syncOfflineTracks(client)).toEqual({ synced: 1, failed: 0 });
    expect(client.insertScormTracks).toHaveBeenCalledWith(1, [{ element: 'a', value: 'a' }]);
    expect(await ScormOfflineQueue.getOfflineTracks()).toHaveLength(0);
  });

  it('keeps entries on transient failures', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'a' }]);
    const client = { insertScormTracks: jest.fn().mockRejectedValue(new Error('Network request failed')) };
    expect(await ScormOfflineQueue.syncOfflineTracks(client)).toEqual({ synced: 0, failed: 1 });
    expect(await ScormOfflineQueue.getOfflineTracks()).toHaveLength(1);
  });

  it('discards entries on fatal server-config errors', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'a' }]);
    const client = { insertScormTracks: jest.fn().mockRejectedValue(new Error('accessexception: denied')) };
    expect(await ScormOfflineQueue.syncOfflineTracks(client)).toEqual({ synced: 0, failed: 1 });
    expect(await ScormOfflineQueue.getOfflineTracks()).toHaveLength(0);
  });

  it('reports a mixed sync correctly', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'ok', value: '1' }]);
    await ScormOfflineQueue.addOfflineTracks(2, 1, 2, [{ element: 'retry', value: '2' }]);
    await ScormOfflineQueue.addOfflineTracks(3, 1, 3, [{ element: 'fatal', value: '3' }]);
    const client = {
      insertScormTracks: jest.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockRejectedValueOnce(new Error('external_functions not available')),
    };
    expect(await ScormOfflineQueue.syncOfflineTracks(client)).toEqual({ synced: 1, failed: 2 });
    const remaining = await ScormOfflineQueue.getOfflineTracks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].scormId).toBe(2);
  });
});

describe('ScormOfflineQueue.clearQueue', () => {
  it('removes all queued tracks', async () => {
    await ScormOfflineQueue.addOfflineTracks(1, 1, 1, [{ element: 'a', value: 'a' }]);
    await ScormOfflineQueue.clearQueue();
    expect(await ScormOfflineQueue.getOfflineTracks()).toHaveLength(0);
  });
});
