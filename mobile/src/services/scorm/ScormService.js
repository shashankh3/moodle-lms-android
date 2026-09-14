/**
 * SCORM Service — port of AddonModScormProvider from moodlehq/moodleapp
 *
 * All SCORM REST calls in one dedicated file.
 * Reference: https://github.com/moodlehq/moodleapp/blob/main/src/addons/mod/scorm/services/scorm.ts
 */

import { MobileAPI } from '../apiAdapter';

// Valid SCORM lesson statuses (SCORM 1.2 spec)
export const SCORM_STATUSES = {
  passed:       'passed',
  completed:    'completed',
  failed:       'failed',
  incomplete:   'incomplete',
  browsed:      'browsed',
  notattempted: 'notattempted',
};

// Normalize status strings from SCORM content to canonical form
const STATUS_MAP = {
  'passed': 'passed', 'p': 'passed',
  'completed': 'completed', 'c': 'completed',
  'failed': 'failed', 'f': 'failed',
  'incomplete': 'incomplete', 'i': 'incomplete',
  'browsed': 'browsed', 'b': 'browsed',
  'not attempted': 'notattempted', 'n': 'notattempted',
};

export const ScormService = {
  /**
   * Get all SCORMs in the given courses.
   */
  async getScormsByCourses(courseIds = []) {
    const client = await MobileAPI.getClient();
    if (!client) return [];
    try {
      const res = await client.getScormsByCourses(courseIds);
      return res?.scorms || [];
    } catch (err) {
      console.warn('[ScormService] getScormsByCourses error:', err.message);
      return [];
    }
  },

  /**
   * Get all SCOs (Shareable Content Objects) for a SCORM package.
   * Each SCO is a navigable content unit.
   */
  async getScormScoes(scormId) {
    const client = await MobileAPI.getClient();
    if (!client || !scormId) return [];
    try {
      const res = await client.getScormScoes(scormId);
      return res?.scoes || [];
    } catch (err) {
      console.warn('[ScormService] getScormScoes error:', err.message);
      return [];
    }
  },

  /**
   * Get the saved CMI user data for all SCOs in a SCORM, for a given attempt.
   * Returns a map of scoId → { userdata, defaultdata }
   */
  async getScormUserData(scormId, attempt = 1) {
    const client = await MobileAPI.getClient();
    const numId = parseInt(scormId, 10);
    if (!client || isNaN(numId) || numId <= 0) return {};
    try {
      const res = await client.getScormUserData(numId, attempt);
      const userData = {};
      if (res && Array.isArray(res.data)) {
        for (const entry of res.data) {
          userData[entry.scoid] = {
            userdata:    {},
            defaultdata: {},
          };
          if (entry.userdata) {
            for (const item of entry.userdata) {
              userData[entry.scoid].userdata[item.element] = item.value;
            }
          }
          if (entry.defaultdata) {
            for (const item of entry.defaultdata) {
              userData[entry.scoid].defaultdata[item.element] = item.value;
            }
          }
        }
      }
      return userData;
    } catch (err) {
      console.warn('[ScormService] getScormUserData error:', err.message);
      return {};
    }
  },

  /**
   * Get how many attempts the user has made on a SCORM.
   */
  async getAttemptCount(scormId, userId) {
    const client = await MobileAPI.getClient();
    const numId = parseInt(scormId, 10);
    if (!client || isNaN(numId) || numId <= 0) return 0;
    try {
      const userData = await client.getScormUserData(numId, 0);
      if (userData && Array.isArray(userData.data) && userData.data.length > 0) {
        const attempts = new Set(userData.data.map(d => d.attempt).filter(Boolean));
        return attempts.size || 1;
      }
      return 0;
    } catch (err) {
      return 0;
    }
  },

  /**
   * Insert/update SCORM tracks (CMI data) for a specific SCO.
   */
  async insertScormTracks(scoId, tracks = []) {
    const client = await MobileAPI.getClient();
    if (!client || !scoId || tracks.length === 0) return;
    try {
      await client.insertScormTracks(scoId, tracks);
    } catch (err) {
      console.warn('[ScormService] insertScormTracks error:', err.message);
      throw err;
    }
  },

  /**
   * Resolve the direct, authenticated HTML5 launch URL for a SCORM SCO.
   * Uses webservice/pluginfile.php endpoint (no browser required).
   *
   * @param {object} scorm - SCORM object from getScormsByCourses
   * @param {object|null} sco - First SCO from getScormScoes (optional)
   * @param {number} contextid - Moodle context ID for this course module
   * @param {string} token - Moodle auth token
   * @param {string} baseUrl - Moodle site base URL
   */
  getLaunchUrl(scorm, sco, contextid, token, baseUrl) {
    const revision  = scorm?.revision || 4;
    const ctx       = contextid || 33;
    const launchFile = sco?.launch || 'index_lms.html';
    // Articulate Storyline always uses index_lms.html as the launch file
    const fileName  = launchFile.includes('.html') ? launchFile : 'index_lms.html';
    return `${baseUrl}/webservice/pluginfile.php/${ctx}/mod_scorm/content/${revision}/${fileName}?token=${token}`;
  },

  /**
   * Get the base href for all SCORM sub-assets (JS, images, audio, CSS).
   */
  getBaseHref(scorm, contextid, baseUrl) {
    const revision = scorm?.revision || 4;
    const ctx      = contextid || 33;
    return `${baseUrl}/webservice/pluginfile.php/${ctx}/mod_scorm/content/${revision}/`;
  },

  /**
   * Fetch the SCORM HTML entry page and inject:
   *   1. <base href="..."> so all relative asset URLs resolve correctly
   *   2. The SCORM JavaScript bridge (window.API) before content scripts run
   *
   * @param {string} launchUrl - Authenticated SCORM launch URL
   * @param {string} baseHref - Base href for sub-assets
   * @param {string} bridgeScript - window.API JavaScript bridge
   */
  async fetchAndPrepareHtml(launchUrl, baseHref, bridgeScript) {
    try {
      const resp = await fetch(launchUrl);
      if (!resp.ok) {
        return null;
      }
      const text = await resp.text();
      // Ensure it's valid HTML and not a JSON error or empty response
      if (!text || text.trim().startsWith('{') || text.includes('"error":') || text.includes('"errorcode":')) {
        return null;
      }
      if (!text.includes('<html') && !text.includes('<!DOCTYPE') && !text.includes('<head') && !text.includes('<body') && !text.includes('<script')) {
        return null;
      }

      const baseTag    = `<base href="${baseHref}">`;
      const scriptTag  = `<script>${bridgeScript}</script>`;

      let html = text;
      // Inject base href and bridge script into the <head>
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n  ${baseTag}\n  ${scriptTag}`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>\n  ${baseTag}\n  ${scriptTag}`);
      } else {
        html = `<head>${baseTag}${scriptTag}</head>` + html;
      }

      return html;
    } catch (err) {
      return null;
    }
  },

  /**
   * Normalize a SCORM lesson_status value to canonical form.
   */
  normalizeStatus(status) {
    if (!status) return 'notattempted';
    return STATUS_MAP[status.toLowerCase()] || status.toLowerCase();
  },

  /**
   * Check if a lesson status counts as "completed" for Moodle activity completion.
   */
  isCompleted(lessonStatus) {
    const s = this.normalizeStatus(lessonStatus);
    return s === 'completed' || s === 'passed';
  },
};
