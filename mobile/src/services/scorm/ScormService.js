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
    const revision  = (scorm?.revision !== undefined && scorm?.revision !== null) ? scorm.revision : 1;
    const ctx       = contextid || scorm?.contextid || 33;
    const rawLaunch = sco?.launch || '';
    let fileName    = rawLaunch.replace(/^\/+/, '');
    if (!fileName || (!fileName.includes('.htm') && !fileName.includes('.html'))) {
      fileName = 'index_lms.html';
    }
    const cleanBase = (baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
    return `${cleanBase}/webservice/pluginfile.php/${ctx}/mod_scorm/content/${revision}/${fileName}?token=${token}`;
  },

  /**
   * Get the base href for all SCORM sub-assets (JS, images, audio, CSS).
   */
  getBaseHref(scorm, contextid, baseUrl) {
    const revision  = (scorm?.revision !== undefined && scorm?.revision !== null) ? scorm.revision : 1;
    const ctx       = contextid || scorm?.contextid || 33;
    const cleanBase = (baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
    return `${cleanBase}/webservice/pluginfile.php/${ctx}/mod_scorm/content/${revision}/`;
  },

  /**
   * Generate candidate launch URLs for SCORM entry points.
   */
  getCandidateLaunchUrls(scorm, sco, contextid, token, baseUrl) {
    const ctx = contextid || scorm?.contextid || 33;
    const cleanBase = (baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
    const revisions = [
      scorm?.revision,
      1,
      0,
      2,
      4,
      3,
    ].filter(r => r !== undefined && r !== null);
    const uniqueRevisions = Array.from(new Set(revisions));

    const filenames = [
      sco?.launch ? sco.launch.replace(/^\/+/, '') : null,
      'index_lms.html',
      'story.html',
      'index.html',
      'launch.html',
      'scormdriver/indexAPI.html',
      'presentation_html5.html',
      'res/index.html',
    ].filter(Boolean);
    const uniqueFilenames = Array.from(new Set(filenames));

    const candidates = [];
    for (const rev of uniqueRevisions) {
      for (const fn of uniqueFilenames) {
        candidates.push(`${cleanBase}/webservice/pluginfile.php/${ctx}/mod_scorm/content/${rev}/${fn}?token=${token}`);
      }
    }
    return candidates;
  },

  /**
   * Fetch the SCORM HTML entry page and inject:
   *   1. <base href="..."> so all relative asset URLs resolve correctly
   *   2. Network interceptor for XHR / fetch to supply token on pluginfile assets
   *   3. The SCORM JavaScript bridge (window.API) before content scripts run
   *
   * @param {string} launchUrl - Authenticated SCORM launch URL
   * @param {string} baseHref - Base href for sub-assets
   * @param {string} bridgeScript - window.API JavaScript bridge
   * @param {string} token - Moodle auth token for asset interception
   * @param {string[]} candidateUrls - Optional list of fallback URLs to test
   */
  async fetchAndPrepareHtml(launchUrl, baseHref, bridgeScript, token = '', candidateUrls = []) {
    const urlsToTry = [launchUrl, ...(candidateUrls || [])].filter(Boolean);
    const uniqueUrls = Array.from(new Set(urlsToTry));

    let text = null;
    let successfulBaseHref = baseHref;

    for (const url of uniqueUrls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const body = await resp.text();
        if (!body || body.trim().startsWith('{') || body.includes('"error":') || body.includes('"errorcode":')) {
          continue;
        }
        if (body.includes('<html') || body.includes('<!DOCTYPE') || body.includes('<head') || body.includes('<body') || body.includes('<script')) {
          text = body;
          const lastSlash = url.lastIndexOf('/');
          if (lastSlash > 0) {
            successfulBaseHref = url.substring(0, lastSlash + 1).split('?')[0];
          }
          break;
        }
      } catch (err) {
        // Continue trying next candidate URL
      }
    }

    if (!text) {
      return null;
    }

    const baseTag = `<base href="${successfulBaseHref}">`;
    const cssReset = `
      <style>
        html, body {
          width: 100% !important;
          min-height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background-color: #001A2E !important;
          color: #FFFFFF !important;
          overflow: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        #scorm_object, #bofrm, iframe {
          width: 100vw !important;
          height: 100vh !important;
          border: none !important;
        }
      </style>
    `;
    const tokenScript = token ? `
      <script>
        (function() {
          var _tok = "${token}";
          try {
            var _origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              if (typeof url === 'string' && url.indexOf('pluginfile.php') !== -1 && url.indexOf('token=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + _tok;
              }
              return _origOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
            };
            if (window.fetch) {
              var _origFetch = window.fetch;
              window.fetch = function(input, init) {
                if (typeof input === 'string' && input.indexOf('pluginfile.php') !== -1 && input.indexOf('token=') === -1) {
                  input += (input.indexOf('?') === -1 ? '?' : '&') + 'token=' + _tok;
                }
                return _origFetch.call(this, input, init);
              };
            }
          } catch(e) {}
        })();
      </script>
    ` : '';
    const scriptTag = `<script>${bridgeScript}</script>`;

    let html = text;

    // Rewrite relative src and href attributes to append ?token=... so assets load with 200 OK
    if (token) {
      html = html.replace(/(src=["'])(?!https?:\/\/|data:|\/\/)([^"']+)(["'])/gi, (match, prefix, path, suffix) => {
        const sep = path.includes('?') ? '&' : '?';
        const cleanPath = path.includes('token=') ? path : `${path}${sep}token=${token}`;
        return `${prefix}${cleanPath}${suffix}`;
      });
      html = html.replace(/(href=["'])(?!https?:\/\/|data:|\/\/|#)([^"']+\.(?:css|js))(["'])/gi, (match, prefix, path, suffix) => {
        const sep = path.includes('?') ? '&' : '?';
        const cleanPath = path.includes('token=') ? path : `${path}${sep}token=${token}`;
        return `${prefix}${cleanPath}${suffix}`;
      });
    }

    // Inject base href, responsive CSS, token interceptor, and bridge script into the <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n  ${baseTag}\n  ${cssReset}\n  ${tokenScript}\n  ${scriptTag}`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD>\n  ${baseTag}\n  ${cssReset}\n  ${tokenScript}\n  ${scriptTag}`);
    } else {
      html = `<head>${baseTag}${cssReset}${tokenScript}${scriptTag}</head>` + html;
    }

    return { html, baseHref: successfulBaseHref };
  },

  /**
   * Generate a standalone in-app interactive SCORM 1.2 player HTML with rich UI and full bridge.
   */
  generateStandaloneScormPlayerHtml({
    title = 'Interactive Module',
    description = '',
    contentHtml = '',
    isDark = true,
    bridgeScript = '',
    courseName = 'Course',
  }) {
    const bg = isDark ? '#090D16' : '#F1F5F9';
    const cardBg = isDark ? '#131D2F' : '#FFFFFF';
    const text = isDark ? '#F1F5F9' : '#0F172A';
    const textDim = isDark ? '#94A3B8' : '#64748B';
    const border = isDark ? '#1E293B' : '#E2E8F0';
    const accent = '#00AEEF';
    const success = '#10B981';

    const ytMatch = (contentHtml + ' ' + description).match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|e\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    const ytId = ytMatch ? ytMatch[1] : null;
    const videoEmbed = ytId ? `
      <div style="width: 100%; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 16px; background: #000;">
        <iframe
          src="https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https://mh.unilearn.org.in&widget_referrer=https://mh.unilearn.org.in"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 12px;"
        ></iframe>
      </div>
    ` : '';

    const cleanBody = contentHtml || (description ? `<p>${description}</p>` : '') || `
      <p style="font-size: 14px; line-height: 1.6;">या परस्परसंवादी शिक्षण मॉड्यूलमध्ये आपले स्वागत आहे. खालील मुख्य संकल्पना काळजीपूर्वक वाचा व ज्ञानाची उजळणी पूर्ण करा.</p>
    `;

    return `
      <!DOCTYPE html>
      <html lang="mr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: ${bg};
              color: ${text};
              padding: 16px;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .player-header {
              background: ${cardBg};
              border: 1px solid ${border};
              border-radius: 14px;
              padding: 14px 16px;
              margin-bottom: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .badge {
              display: inline-block;
              background: rgba(0, 174, 239, 0.15);
              color: ${accent};
              font-size: 11px;
              font-weight: 800;
              padding: 3px 8px;
              border-radius: 6px;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
            }
            .module-title {
              font-size: 16px;
              font-weight: 800;
              color: ${text};
              line-height: 1.35;
            }
            .progress-bar-container {
              width: 100%;
              height: 6px;
              background: ${border};
              border-radius: 3px;
              margin-top: 10px;
              overflow: hidden;
            }
            .progress-bar-fill {
              height: 100%;
              width: 50%;
              background: ${accent};
              border-radius: 3px;
              transition: width 0.3s ease;
            }
            .slide-card {
              background: ${cardBg};
              border: 1px solid ${border};
              border-radius: 16px;
              padding: 18px;
              flex: 1;
              box-shadow: 0 4px 16px rgba(0,0,0,0.08);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 280px;
            }
            .slide-content {
              font-size: 14px;
              line-height: 1.7;
              color: ${text};
              overflow-y: auto;
            }
            .slide-content h2, .slide-content h3 {
              color: ${accent};
              margin-bottom: 10px;
            }
            .interactive-check {
              background: ${isDark ? '#0B132B' : '#F8FAFC'};
              border: 1px dashed ${accent};
              border-radius: 12px;
              padding: 14px;
              margin-top: 16px;
            }
            .interactive-check-title {
              font-weight: 700;
              font-size: 13px;
              color: ${accent};
              margin-bottom: 8px;
            }
            .choice-btn {
              display: block;
              width: 100%;
              padding: 12px 14px;
              margin: 8px 0;
              background: ${cardBg};
              border: 1px solid ${border};
              border-radius: 8px;
              color: ${text};
              font-size: 13px;
              font-weight: 600;
              text-align: left;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .choice-btn.selected {
              background: rgba(0, 174, 239, 0.15);
              border-color: ${accent};
              color: ${accent};
            }
            .choice-btn.correct {
              background: rgba(16, 185, 129, 0.15);
              border-color: ${success};
              color: ${success};
            }
            .player-footer {
              margin-top: 14px;
              display: flex;
              gap: 10px;
            }
            .nav-btn {
              flex: 1;
              padding: 13px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 700;
              text-align: center;
              border: none;
              cursor: pointer;
              transition: opacity 0.2s;
            }
            .nav-btn:active {
              opacity: 0.8;
            }
            .btn-prev {
              background: ${border};
              color: ${textDim};
            }
            .btn-finish {
              background: ${success};
              color: #FFFFFF;
            }
            .completion-banner {
              display: none;
              background: rgba(16, 185, 129, 0.15);
              border: 1px solid ${success};
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              margin-top: 14px;
            }
            .completion-banner.show {
              display: block;
            }
            .completion-banner h3 {
              color: ${success};
              font-size: 15px;
              margin-bottom: 4px;
            }
            .completion-banner p {
              font-size: 13px;
              color: ${textDim};
            }
          </style>
          <script>${bridgeScript}</script>
        </head>
        <body>
          <div class="player-header">
            <div class="badge">INTERACTIVE SCORM 1.2</div>
            <div class="module-title">${title}</div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="pFill"></div>
            </div>
          </div>

          <div class="slide-card">
            <div class="slide-content" id="slideBody">
              ${videoEmbed}
              ${cleanBody}
              <div class="interactive-check" id="questionBox">
                <div class="interactive-check-title">💡 ज्ञानाची उजळणी (Knowledge Verification)</div>
                <p style="font-size: 13px; margin-bottom: 8px;">तुम्ही या पाठातील सर्व मुख्य संकल्पना पूर्णपणे समजून घेतल्या आहेत का?</p>
                <button class="choice-btn" onclick="selectChoice(this, 1)">होय, मी संकल्पना पूर्णपणे समजून घेतल्या आहेत.</button>
                <button class="choice-btn" onclick="selectChoice(this, 2)">मी पुन्हा एकदा उजळणी करणार आहे.</button>
              </div>
            </div>

            <div class="completion-banner" id="compBanner">
              <h3>🎉 अभिनंदन! मॉड्यूल पूर्ण झाले</h3>
              <p>तुमची प्रगती Moodle LMS मध्ये यशस्वीरीत्या जतन झाली आहे.</p>
            </div>
          </div>

          <div class="player-footer">
            <button class="nav-btn btn-prev" id="prevBtn" onclick="onPrev()">मागील (Back)</button>
            <button class="nav-btn btn-finish" id="finishBtn" onclick="onFinish()">पूर्ण करा (Complete)</button>
          </div>

          <script>
            var _step = 1;
            var _totalSteps = 2;
            var _score = 100;

            if (window.API && typeof window.API.LMSInitialize === 'function') {
              window.API.LMSInitialize('');
              window.API.LMSSetValue('cmi.core.lesson_location', '1');
              window.API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
              window.API.LMSCommit('');
            }

            function updateUI() {
              var fill = document.getElementById('pFill');
              if (fill) fill.style.width = (_step / _totalSteps * 100) + '%';
            }

            function selectChoice(btn, choiceId) {
              var btns = document.querySelectorAll('.choice-btn');
              btns.forEach(function(b) { b.classList.remove('selected', 'correct'); });
              btn.classList.add('correct');
              _score = (choiceId === 1) ? 100 : 80;

              if (window.API && typeof window.API.LMSSetValue === 'function') {
                window.API.LMSSetValue('cmi.core.score.raw', String(_score));
                window.API.LMSCommit('');
              }
            }

            function onPrev() {
              if (_step > 1) {
                _step--;
                updateUI();
              }
            }

            function onFinish() {
              _step = _totalSteps;
              updateUI();

              var banner = document.getElementById('compBanner');
              if (banner) banner.classList.add('show');

              var qBox = document.getElementById('questionBox');
              if (qBox) qBox.style.display = 'none';

              var finishBtn = document.getElementById('finishBtn');
              if (finishBtn) {
                finishBtn.innerText = '✓ पूर्ण झाले (Completed)';
                finishBtn.style.opacity = '0.7';
                finishBtn.disabled = true;
              }

              if (window.API && typeof window.API.LMSSetValue === 'function') {
                window.API.LMSSetValue('cmi.core.lesson_status', 'completed');
                window.API.LMSSetValue('cmi.core.score.raw', String(_score));
                window.API.LMSSetValue('cmi.core.score.min', '0');
                window.API.LMSSetValue('cmi.core.score.max', '100');
                window.API.LMSCommit('');
                window.API.LMSFinish('');
              }
            }

            updateUI();
          </script>
        </body>
      </html>
    `;
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

