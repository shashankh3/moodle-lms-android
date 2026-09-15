jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore = new Map();
  return {
    __mockStore: mockStore,
    getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
    setItem: jest.fn((k, v) => { mockStore.set(k, String(v)); return Promise.resolve(); }),
    removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
    multiRemove: jest.fn((keys) => { keys.forEach(k => mockStore.delete(k)); return Promise.resolve(); }),
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

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props) => React.createElement(View, props),
  };
});

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: jest.fn(() => Promise.resolve()),
  lockAsync: jest.fn(() => Promise.resolve()),
  addOrientationChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeOrientationChangeListener: jest.fn(),
  Orientation: {
    LANDSCAPE_LEFT: 3,
    LANDSCAPE_RIGHT: 4,
  },
  OrientationLock: {
    PORTRAIT_UP: 1,
    LANDSCAPE_RIGHT: 4,
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, def) => def || k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { coreMethods } from '../src/services/adapters/coreMethods';
import { ScormService } from '../src/services/scorm/ScormService';
import { STORAGE_KEYS, saveToStorage } from '../src/services/adapterUtils';
import { storage } from '../src/services/storage/SecureStorage';

describe('Site Admin Autologin Bypass & SCORM Candidate Resolution', () => {
  beforeEach(async () => {
    await storage.multiRemove(Object.values(STORAGE_KEYS));
  });

  describe('coreMethods.getAuthenticatedUrl', () => {
    it('returns targetUrl unchanged if no server config exists', async () => {
      const url = await coreMethods.getAuthenticatedUrl('https://example.com/mod/scorm/player.php?a=1');
      expect(url).toBe('https://example.com/mod/scorm/player.php?a=1');
    });

    it('bypasses autologin.php and returns direct URL for site admins', async () => {
      await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, {
        serverUrl: 'https://mh.unilearn.org.in',
        token: 'admin_token_123',
        privatetoken: 'admin_private_token_456',
      });
      await saveToStorage(STORAGE_KEYS.SITE_INFO, {
        userid: 2,
        userissiteadmin: 1,
        username: 'admin',
      });
      await saveToStorage(STORAGE_KEYS.ACTIVE_USER, {
        id: 2,
        role: 'admin',
        username: 'admin',
        userissiteadmin: true,
      });

      const playerUrl = 'https://mh.unilearn.org.in/mod/scorm/player.php?a=2&scoid=5';
      const result = await coreMethods.getAuthenticatedUrl(playerUrl);

      // Must NOT contain autologin.php
      expect(result).not.toContain('autologin.php');
      expect(result).toBe(playerUrl);
    });

    it('appends token to pluginfile.php for site admins without autologin.php', async () => {
      await saveToStorage(STORAGE_KEYS.SERVER_CONFIG, {
        serverUrl: 'https://mh.unilearn.org.in',
        token: 'admin_token_123',
        privatetoken: 'admin_private_token_456',
      });
      await saveToStorage(STORAGE_KEYS.SITE_INFO, {
        userid: 2,
        userissiteadmin: 1,
      });
      await saveToStorage(STORAGE_KEYS.ACTIVE_USER, {
        id: 2,
        role: 'admin',
      });

      const pluginfileUrl = 'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/story.html';
      const result = await coreMethods.getAuthenticatedUrl(pluginfileUrl);

      expect(result).not.toContain('autologin.php');
      expect(result).toBe('https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/story.html?token=admin_token_123');
    });
  });

  describe('ScormService.getCandidateLaunchUrls', () => {
    it('generates candidate URLs across revisions and standard launch filenames', () => {
      const candidates = ScormService.getCandidateLaunchUrls(
        { id: 2, revision: 1 },
        { id: 5, launch: 'story.html' },
        42,
        'test_token',
        'https://mh.unilearn.org.in'
      );

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);

      // Primary candidate should be present
      expect(candidates).toContain(
        'https://mh.unilearn.org.in/webservice/pluginfile.php/42/mod_scorm/content/1/story.html?token=test_token'
      );
      // Fallback filenames should be present
      expect(candidates).toContain(
        'https://mh.unilearn.org.in/webservice/pluginfile.php/42/mod_scorm/content/1/index_lms.html?token=test_token'
      );
      expect(candidates).toContain(
        'https://mh.unilearn.org.in/webservice/pluginfile.php/42/mod_scorm/content/1/index.html?token=test_token'
      );
    });
  });

  describe('ScormService.fetchAndPrepareHtml', () => {
    it('injects base href, token interceptor, and bridge script into HTML', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '<!DOCTYPE html><html><head><title>Course</title></head><body><h1>SCORM</h1></body></html>',
      });

      const launchUrl = 'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/index_lms.html?token=test_token';
      const baseHref = 'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/';
      const bridgeScript = 'window.API = { LMSInitialize: function() { return "true"; } };';

      const result = await ScormService.fetchAndPrepareHtml(
        launchUrl,
        baseHref,
        bridgeScript,
        'test_token'
      );

      expect(result).not.toBeNull();
      expect(result.html).toContain('<base href="https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/">');
      expect(result.html).toContain('window.API');
      expect(result.html).toContain('pluginfile.php');
      expect(result.html).toContain('test_token');
    });

    it('falls back to candidate URLs if primary launchUrl fails', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html><head></head><body>Candidate SCORM HTML</body></html>',
        });

      const launchUrl = 'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/4/index_lms.html?token=tok';
      const fallbackUrl = 'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/story.html?token=tok';

      const result = await ScormService.fetchAndPrepareHtml(
        launchUrl,
        'https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/4/',
        'window.API = {};',
        'tok',
        [fallbackUrl]
      );

      expect(result).not.toBeNull();
      expect(result.html).toContain('Candidate SCORM HTML');
      expect(result.baseHref).toBe('https://mh.unilearn.org.in/webservice/pluginfile.php/33/mod_scorm/content/1/');
    });
  });

  describe('YouTube & Video Module Playback Unification', () => {
    const { extractYouTubeId, generateYouTubePlayerHtml } = require('../src/screens/courses/CourseContentViewerScreen');
    const { ModuleResolver } = require('../src/services/modules/ModuleResolver');

    it('extracts YouTube IDs from standard watch URLs', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    });

    it('extracts YouTube IDs from short youtu.be URLs', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc123xyz')).toBe('dQw4w9WgXcQ');
    });

    it('extracts YouTube IDs from embed and shorts URLs', () => {
      expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>')).toBe('dQw4w9WgXcQ');
    });

    it('generates responsive YouTube player HTML with origin and inline playback', () => {
      const html = generateYouTubePlayerHtml('dQw4w9WgXcQ', true);
      expect(html).toContain('dQw4w9WgXcQ');
      expect(html).toContain('autoplay: 1');
      expect(html).toContain('playsinline: 1');
      expect(html).toContain('strict-origin-when-cross-origin');
    });

    it('routes SCORM modules to CourseContentViewer via ModuleResolver', () => {
      const handler = ModuleResolver.getHandler({ modname: 'scorm' });
      const target = handler.getNavigationTarget({ id: 10, modname: 'scorm' });
      expect(target.screen).toBe('CourseContentViewer');
      expect(target.params.module.id).toBe(10);
    });

    it('embeds YouTube player in ScormService.generateStandaloneScormPlayerHtml when description contains YouTube link', () => {
      const html = ScormService.generateStandaloneScormPlayerHtml({
        title: 'ECCE Video Lesson',
        description: 'Watch this session: https://youtu.be/dQw4w9WgXcQ',
      });
      expect(html).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(html).toContain('ECCE Video Lesson');
    });
  });
});
