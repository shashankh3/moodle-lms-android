import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Share,
  Linking,
  StatusBar,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI, getMoodleMediaUrl, fixMoodleHtmlContent } from '../../services/apiAdapter';
import {
  ArrowLeft,
  RotateCw,
  Share2,
  BookOpen,
  FileText,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Play,
  CheckCircle,
  X,
  Maximize2,
  Minimize2,
  Award,
} from 'lucide-react-native';

// Injected SCORM 1.2 & 2004 JavaScript Bridge (Self-contained)
function getScormBridgeJs(userId = '2', userName = 'Student') {
  return `
    (function() {
      window._cmiData = {
        'cmi.core.student_id': '${userId}',
        'cmi.core.student_name': '${userName}',
        'cmi.core.lesson_status': 'incomplete',
        'cmi.core.lesson_location': '',
        'cmi.core.credit': 'credit',
        'cmi.core.entry': 'ab-initio',
        'cmi.core.score.raw': '0',
        'cmi.core.score.min': '0',
        'cmi.core.score.max': '100',
        'cmi.core.total_time': '00:00:00',
        'cmi.core.session_time': '00:00:00',
        'cmi.core.lesson_mode': 'normal',
        'cmi.core.exit': '',
        'cmi.suspend_data': '',
        'cmi.launch_data': '',
        'cmi.comments': '',
        'cmi.student_data.mastery_score': '80'
      };

      var scormApi = {
        LMSInitialize: function(p) {
          console.log('[SCORM In-App] LMSInitialize called');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCORM_INIT' }));
          }
          return "true";
        },
        LMSGetValue: function(e) {
          var val = window._cmiData[e] || "";
          return val;
        },
        LMSSetValue: function(e, v) {
          window._cmiData[e] = String(v);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCORM_SET_VALUE',
              element: e,
              value: String(v),
              lessonStatus: window._cmiData['cmi.core.lesson_status'],
              score: window._cmiData['cmi.core.score.raw']
            }));
          }
          return "true";
        },
        LMSCommit: function(p) {
          console.log('[SCORM In-App] LMSCommit called');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCORM_COMMIT',
              cmi: window._cmiData,
              lessonStatus: window._cmiData['cmi.core.lesson_status'],
              score: window._cmiData['cmi.core.score.raw']
            }));
          }
          return "true";
        },
        LMSFinish: function(p) {
          console.log('[SCORM In-App] LMSFinish called');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCORM_FINISH',
              cmi: window._cmiData,
              lessonStatus: window._cmiData['cmi.core.lesson_status'],
              score: window._cmiData['cmi.core.score.raw']
            }));
          }
          return "true";
        },
        LMSGetLastError: function() { return "0"; },
        LMSGetErrorString: function(c) { return "No error"; },
        LMSGetDiagnostic: function(c) { return "No error"; },
        Initialize: function(p) { return scormApi.LMSInitialize(p); },
        GetValue: function(e) { return scormApi.LMSGetValue(e); },
        SetValue: function(e, v) { return scormApi.LMSSetValue(e, v); },
        Commit: function(p) { return scormApi.LMSCommit(p); },
        Terminate: function(p) { return scormApi.LMSFinish(p); },
        GetLastError: function() { return "0"; },
        GetErrorString: function() { return "No error"; },
        GetDiagnostic: function() { return "No error"; }
      };

      window.API = scormApi;
      window.API_1484_11 = scormApi;
      window.SCORM_GetAPI = function() { return scormApi; };
      window.SCORM2004_GetAPI = function() { return scormApi; };
      window.GetAPI = function() { return scormApi; };

      try {
        window.opener = { API: scormApi, API_1484_11: scormApi };
      } catch(e) {}
    })();
  `;
}

export function extractYouTubeId(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|e\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

export function generateYouTubePlayerBlock(youtubeId, isDark = false, autoplay = true) {
  const bg = isDark ? '#090D16' : '#000000';
  const cardBg = isDark ? '#131D2F' : '#FFFFFF';
  const textColor = isDark ? '#F1F5F9' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const autoPlayVal = autoplay ? 1 : 0;

  return `
    <style>
      .video-wrapper {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%; /* 16:9 */
        height: 0;
        overflow: hidden;
        background: #000;
        border-radius: 14px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      }
      .video-wrapper.fullscreen {
        padding-bottom: 0;
        height: 100%;
        border-radius: 0;
        box-shadow: none;
      }
      .video-wrapper #player, .video-wrapper iframe {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border: 0 !important;
        margin: 0 !important;
        border-radius: 0 !important;
      }
    </style>
    <div class="video-wrapper" id="yt-wrapper-${youtubeId}">
      <div id="player-${youtubeId}"></div>
    </div>

    <script>
      (function() {
        var ytId = '${youtubeId}';
        if (!document.getElementById('yt-iframe-api')) {
          var tag = document.createElement('script');
          tag.id = 'yt-iframe-api';
          tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0];
          if (firstScriptTag) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          } else {
            document.head.appendChild(tag);
          }
        }

        var player;
        var embedRetried = false;
        var EMBED_ERRORS = [101, 150, 153];
        var autoPlayVal = ${autoPlayVal};

        var safeOrigin = (window.location && typeof window.location.origin === 'string' && window.location.origin.indexOf('https://') === 0)
          ? window.location.origin
          : 'https://mh.unilearn.org.in';

        function handleEmbedError(code) {
          console.log('[YouTube Player Error]:', code);
          if (EMBED_ERRORS.indexOf(code) !== -1) {
            if (!embedRetried) {
              retryWithNocookieEmbed();
            }
            // Ignore duplicate embed error messages if already retried
          }
        }

        function retryWithNocookieEmbed() {
          embedRetried = true;
          var pDiv = document.getElementById('player-' + ytId);
          if (pDiv) {
            pDiv.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + ytId + '?autoplay=' + autoPlayVal + '&playsinline=1&rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"></iframe>';
          }
        }

        window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function() {};
        var oldOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
          oldOnReady();
          initPlayer();
        };

        function initPlayer() {
          if (typeof YT !== 'undefined' && YT && YT.Player) {
            player = new YT.Player('player-' + ytId, {
              videoId: ytId,
              host: 'https://www.youtube.com',
              playerVars: {
                autoplay: autoPlayVal,
                playsinline: 1,
                rel: 0,
                modestbranding: 1,
                enablejsapi: 1,
                origin: safeOrigin,
                widget_referrer: safeOrigin
              },
              events: {
                'onReady': onPlayerReady,
                'onError': onPlayerError,
                'onStateChange': onPlayerStateChange
              }
            });
          }
        }

        function onPlayerReady(event) {
          if (autoPlayVal === 1) {
            try { event.target.playVideo(); } catch(e) {}
          }
        }

        function onPlayerStateChange(event) {
          if (event.data === YT.PlayerState.ENDED) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIDEO_ENDED', videoId: ytId }));
            }
          }
        }

        function onPlayerError(event) {
          handleEmbedError(event.data);
        }

        window.addEventListener('message', function(event) {
          try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data && (data.event === 'onError' || (data.info && (typeof data.info === 'number' || data.info.errorCode || data.info.error)))) {
              var code = typeof data.info === 'number' ? data.info : (data.info && (data.info.errorCode || data.info.error)) || data.event;
              handleEmbedError(code);
            }
          } catch(e) {}
        });

        // Fallback init in case API is already loaded or loads differently
        setTimeout(function() {
          if (typeof YT !== 'undefined' && YT && YT.Player && !player) {
            initPlayer();
          } else if (!player || typeof player.getPlayerState !== 'function') {
            var pDiv = document.getElementById('player-' + ytId);
            if (pDiv && !pDiv.innerHTML) {
              pDiv.innerHTML = '<iframe id="ytframe-' + ytId + '" src="https://www.youtube-nocookie.com/embed/' + ytId + '?autoplay=' + autoPlayVal + '&playsinline=1&rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"></iframe>';
            }
          }
        }, 1500);
      })();
    </script>
  `;
}

export function generateYouTubePlayerHtml(youtubeId, isDark = false) {
  const bg = isDark ? '#090D16' : '#000000';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta name="referrer" content="strict-origin-when-cross-origin">
        <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            background-color: ${bg};
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        </style>
      </head>
      <body>
        ${generateYouTubePlayerBlock(youtubeId, isDark, true).replace('class="video-wrapper"', 'class="video-wrapper fullscreen"')}
      </body>
    </html>
  `;
}

function generateOfficialMoodleCertificateHtml({
  courseTitle = 'COURSE CERTIFICATE',
  description = 'Certificate course on career guidance for teachers.',
  awardedDateFormatted = 'Thursday, 28 August 2025, 5:59 PM',
  pdfViewerUrl = '',
  pdfDownloadUrl = '',
  isDark = false,
}) {
  const bg = isDark ? '#090D16' : '#F4F6F9';
  const cardBg = isDark ? '#131D2F' : '#FFFFFF';
  const textColor = isDark ? '#F1F5F9' : '#1E293B';
  const textMuted = isDark ? '#94A3B8' : '#64748B';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>${courseTitle}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: ${bg};
            color: ${textColor};
          }
          
          /* State 1: Moodle Card (Screenshot 1) */
          #overview-view {
            padding: 16px;
            display: flex;
            justify-content: center;
          }
          .moodle-card {
            width: 100%;
            max-width: 700px;
            background: ${cardBg};
            border-radius: 12px;
            padding: 28px 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            margin-top: 10px;
            border-top: 5px solid #00AEEF;
          }
          .moodle-header {
            font-size: 20px;
            font-weight: 800;
            color: ${textColor};
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 14px;
          }
          .moodle-desc {
            font-size: 15px;
            color: ${textMuted};
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .moodle-awarded {
            font-size: 14px;
            color: ${textColor};
            font-weight: 600;
            margin-bottom: 20px;
          }
          .btn-view-cert {
            background-color: #004F7A;
            color: #FFFFFF;
            font-size: 14px;
            font-weight: 700;
            padding: 12px 24px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0, 79, 122, 0.3);
          }

          /* State 2: Real Server PDF Viewer */
          #cert-doc-view {
            display: none;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            background: #000;
          }
          .cert-bar {
            height: 48px;
            background: #1E293B;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            color: #FFF;
          }
          .btn-back {
            background: #00AEEF;
            color: #FFF;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          iframe {
            width: 100%;
            height: calc(100% - 48px);
            border: 0;
            background: #FFF;
          }
        </style>
      </head>
        <!-- Moodle Activity Card -->
        <div id="overview-view">
          <div class="moodle-card">
            <div class="moodle-header">${courseTitle}</div>
            <div class="moodle-desc">${description}</div>
            <div class="moodle-awarded">Awarded on: ${awardedDateFormatted}</div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button class="btn-view-cert" onclick="openCertificate()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                View Certificate
              </button>
              ${pdfDownloadUrl ? `
                <button class="btn-view-cert" onclick="openCertificate()" style="background-color: #059669;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download (PDF)
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <script>
          function openCertificate() {
            try {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'OPEN_CERTIFICATE',
                  url: '${pdfDownloadUrl}'
                }));
              } else if ('${pdfDownloadUrl}') {
                window.location.href = '${pdfDownloadUrl}';
              }
            } catch (e) {
              console.error(e);
            }
          }
        </script>
      </body>
    </html>
  `;
}

function generateMobileHtml(
  htmlContent,
  isDark,
  videoUrl = null,
  audioUrl = null,
  imageUrl = null,
  mimetype = 'video/mp4'
) {
  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const text = isDark ? '#F1F5F9' : '#1E293B';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const surface = isDark ? '#1E293B' : '#FFFFFF';
  const border = isDark ? '#334155' : '#E2E8F0';

  const youtubeId = extractYouTubeId(htmlContent);

  let mediaBlock = '';
  if (videoUrl) {
    mediaBlock = `
      <div class="media-container">
        <video controls playsinline preload="metadata" controlsList="nodownload" style="width:100%; border-radius:12px; background:#000; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
          <source src="${videoUrl}" type="${mimetype}">
          Your device does not support this video format.
        </video>
      </div>
    `;
  } else if (youtubeId) {
    mediaBlock = `
      <div style="width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #000;">
        ${generateYouTubePlayerBlock(youtubeId, isDark, false).replace('class="video-wrapper"', 'class="video-wrapper fullscreen"')}
      </div>
    `;
  } else if (audioUrl) {
    mediaBlock = `
      <div class="media-container">
        <audio controls style="width: 100%; margin: 16px 0;">
          <source src="${audioUrl}" type="${mimetype}">
          Your device does not support audio playback.
        </audio>
      </div>
    `;
  } else if (imageUrl) {
    mediaBlock = `
      <div class="media-container" style="text-align:center;">
        <img src="${imageUrl}" style="max-width:100%; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.15);" />
      </div>
    `;
  }

  // Clean raw htmlContent to avoid duplicated iframe when youtube player is rendered
  let cleanHtml = htmlContent || '';
  if (youtubeId) {
    cleanHtml = cleanHtml
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<div class="embed-responsive[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
      .replace(/<div class="embed-responsive[^>]*>[\s\S]*?<\/div>/gi, '')
      .trim();
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <meta name="referrer" content="strict-origin-when-cross-origin">
        <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${bg};
            color: ${text};
            padding: 0;
            margin: 0;
            line-height: 1.7;
            font-size: 16px;
            word-wrap: break-word;
          }
          .content-card {
            background: ${cardBg};
            border: 1px solid ${border};
            border-radius: 14px;
            padding: 18px;
            margin: 16px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.04);
          }
          .media-container {
            width: 100%;
            margin-bottom: 20px;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 10px;
            margin: 12px 0;
            display: block;
          }
          .embed-responsive, .d-flex {
            width: 100%;
            margin: 12px 0;
          }
          .embed-responsive-16by9, .embed-responsive {
            position: relative;
            display: block;
            width: 100%;
            padding: 0;
            overflow: hidden;
            padding-bottom: 56.25%;
            height: 0;
            border-radius: 12px;
          }
          .embed-responsive .embed-responsive-item,
          .embed-responsive iframe,
          .embed-responsive video,
          .embed-responsive embed,
          .embed-responsive object {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 100% !important;
            height: 100% !important;
            border: 0;
            border-radius: 12px;
          }
          iframe {
            width: 100%;
            min-height: 240px;
            border-radius: 12px;
            border: 0;
            margin: 12px 0;
          }
          a {
            color: #00AEEF;
            text-decoration: none;
            font-weight: 600;
          }
          h1, h2, h3, h4, h5, h6 {
            color: ${isDark ? '#FFFFFF' : '#0F172A'};
            line-height: 1.35;
            margin-top: 18px;
            margin-bottom: 8px;
          }
          p {
            margin: 8px 0;
          }
          table {
            width: 100% !important;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 14px;
          }
          th, td {
            border: 1px solid ${border};
            padding: 10px 12px;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: ${surface};
            font-weight: 700;
          }
          blockquote {
            border-left: 4px solid #00AEEF;
            margin: 14px 0;
            padding: 8px 16px;
            background: ${surface};
            border-radius: 0 8px 8px 0;
          }
          ul, ol {
            padding-left: 22px;
          }
          li {
            margin-bottom: 6px;
          }
        </style>
      </head>
      <body>
        ${mediaBlock}
        ${cleanHtml ? `<div class="content-card">${cleanHtml}</div>` : ''}
      </body>
    </html>
  `;
}

function generateScormPlayerHtml({
  title,
  description,
  contentHtml,
  isDark,
  userId = '2',
  userName = 'Student',
  courseName = 'Course'
}) {
  const bg = isDark ? '#090D16' : '#F1F5F9';
  const cardBg = isDark ? '#131D2F' : '#FFFFFF';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const textDim = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const accent = '#00AEEF';
  const success = '#10B981';

  const cleanBody = contentHtml || (description ? `<p>${description}</p>` : '') || `
    <p>या परस्परसंवादी शिक्षण मॉड्यूलमध्ये आपले स्वागत आहे. खालील मुख्य संकल्पना काळजीपूर्वक समजून घ्या.</p>
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
            padding: 16px 18px;
            margin-bottom: 14px;
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
            font-size: 17px;
            font-weight: 800;
            color: ${text};
            line-height: 1.35;
          }
          .progress-bar-container {
            width: 100%;
            height: 6px;
            background: ${border};
            border-radius: 3px;
            margin-top: 12px;
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
            padding: 20px;
            flex: 1;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 280px;
          }
          .slide-content {
            font-size: 15px;
            line-height: 1.7;
            color: ${text};
            overflow-y: auto;
          }
          .slide-content h2, .slide-content h3 {
            color: ${accent};
            margin-bottom: 12px;
          }
          .slide-content p {
            margin-bottom: 12px;
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
            font-size: 14px;
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
            padding: 14px;
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
            font-size: 16px;
            margin-bottom: 4px;
          }
          .completion-banner p {
            font-size: 13px;
            color: ${textDim};
          }
        </style>
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
}

export default function CourseContentViewerScreen({ route, navigation }) {
  const { module, courseId, courseName } = route?.params || {};
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();
  const webViewRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fetchedHtml, setFetchedHtml] = useState(null);
  const [scormRawHtml, setScormRawHtml] = useState(null);
  const [directMediaUrl, setDirectMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('none');
  const [mediaMime, setMediaMime] = useState('video/mp4');
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [rawScormPlayerUrl, setRawScormPlayerUrl] = useState(null);
  const [moodleToken, setMoodleToken] = useState('');
  const [isScormPlaying, setIsScormPlaying] = useState(module?.modname === 'scorm');
  const [scormCompleted, setScormCompleted] = useState(!!module?.completed);
  const [scormScore, setScormScore] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    // Enable auto-rotation while on this screen
    ScreenOrientation.unlockAsync().catch(() => {});

    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      const orientation = evt.orientationInfo.orientation;
      const isLand =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(isLand);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(sub);
      // Restore portrait lock upon exiting
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const toggleOrientation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsLandscape(true);
      }
    } catch (e) {
      console.warn('[Viewer] Orientation lock failed:', e);
    }
  };

  const title = module?.name || 'Course Material';
  const typeLabel =
    module?.modname === 'scorm'
      ? 'INTERACTIVE MODULE'
      : module?.modname
      ? module.modname.toUpperCase()
      : module?.type
      ? module.type.toUpperCase()
      : 'MATERIAL';

  const isVideoModule =
    module?.type === 'video' ||
    module?.mimetype?.startsWith('video/') ||
    module?.filename?.toLowerCase().endsWith('.mp4') ||
    module?.filename?.toLowerCase().endsWith('.webm');

  const isAudioModule =
    module?.type === 'audio' ||
    module?.mimetype?.startsWith('audio/') ||
    module?.filename?.toLowerCase().endsWith('.mp3') ||
    module?.filename?.toLowerCase().endsWith('.wav');

  const isImageModule =
    module?.type === 'image' ||
    module?.mimetype?.startsWith('image/') ||
    module?.filename?.toLowerCase().endsWith('.jpg') ||
    module?.filename?.toLowerCase().endsWith('.png') ||
    module?.filename?.toLowerCase().endsWith('.jpeg');

  const isPdfModule =
    module?.isPdf ||
    module?.type === 'pdf' ||
    module?.mimetype === 'application/pdf' ||
    module?.filename?.toLowerCase().endsWith('.pdf') ||
    module?.fileUrl?.toLowerCase().includes('.pdf');

  const isCertModule =
    module?.modname === 'customcert' ||
    module?.modname === 'certificate' ||
    module?.modname === 'simplecertificate' ||
    module?.modname === 'coursecertificate' ||
    module?.type === 'customcert' ||
    module?.name?.toLowerCase()?.includes('certificate') ||
    module?.name?.includes('प्रमाणपत्र');

  useEffect(() => {
    async function resolveContent() {
      setHasError(false);
      setLoading(true);

      try {
        const client = await MobileAPI.getClient();
        const token = client?.token || '';
        setMoodleToken(token);

        // 0. Check YouTube video first (only for non-SCORM modules, and never from description/contentHtml)
        const isScormModule = module?.modname === 'scorm';
        if (!isScormModule) {
          const directYtId = extractYouTubeId([
            module?.externalurl,
            module?.url,
            module?.webUrl,
            module?.fileUrl,
          ].filter(Boolean).join(' '));
          if (directYtId) {
            setLoading(false);
            return;
          }
        }

        // 0B. Certificate Module
        if (isCertModule) {
          const baseUrl = (client?.baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
          const certCmId = module?.id || module?.coursemodule || module?.instance;
          const modType = module?.modname || 'customcert';
          const rawCertUrl = module?.url || module?.webUrl || (certCmId ? `${baseUrl}/mod/${modType}/view.php?id=${certCmId}` : null);

          if (rawCertUrl) {
            try {
              const authedUrl = await MobileAPI.getAuthenticatedUrl(rawCertUrl);
              setResolvedUrl(authedUrl || rawCertUrl);
            } catch (err) {
              console.warn('[CourseContentViewer] Certificate authedUrl resolution error:', err);
              setResolvedUrl(rawCertUrl);
            }
          }
          setLoading(false);
          return;
        }

        // 1. Direct Video / Audio / Image File
        if (isVideoModule || isAudioModule || isImageModule) {
          const primaryFile = module?.files?.[0] || module;
          const rawFileUrl = primaryFile?.fileurl || primaryFile?.fileUrl || primaryFile?.url;
          if (rawFileUrl) {
            const authenticatedUrl = getMoodleMediaUrl(rawFileUrl, token);
            setDirectMediaUrl(authenticatedUrl);
            setMediaType(isVideoModule ? 'video' : isAudioModule ? 'audio' : 'image');
            setMediaMime(primaryFile?.mimetype || (isVideoModule ? 'video/mp4' : isAudioModule ? 'audio/mp3' : 'image/jpeg'));
            setLoading(false);
            return;
          }
        }

        // 2. SCORM Module — launch Moodle's native interactive SCORM player with autologin
        if (module?.modname === 'scorm') {
          setResolvedUrl(null);
          setRawScormPlayerUrl(null);

          if (client) {
            try {
              const baseUrl = (client.baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
              const targetCourseId = courseId || module?.course || module?.courseId || 1;

              // Fetch SCORM metadata
              let scorm = null;
              try {
                const scormsRes = await client.getScormsByCourses([targetCourseId]);
                scorm = (scormsRes?.scorms || []).find(
                  s => String(s.coursemodule) === String(module.id) || String(s.id) === String(module.instance)
                ) || null;
              } catch (e) {
                console.warn('[SCORM] getScormsByCourses note:', e.message);
              }

              const scormId = scorm?.id || module?.instance || 2;
              let scoId = null;
              let currentOrg = null;
              if (scormId) {
                try {
                  const scoRes = await client.getScormScoes(scormId);
                  const scoes = scoRes?.scoes || scoRes || [];
                  const firstSco = scoes.find(s => s.launch) || scoes[0];
                  if (firstSco) {
                    scoId = firstSco.id;
                    currentOrg = firstSco.organization;
                  }
                } catch (e) {
                  console.warn('[SCORM] getScormScoes note:', e.message);
                }
              }

              // Construct the exact Moodle player URL
              let rawPlayerUrl = '';
              if (scormId) {
                const orgParam = currentOrg ? `&currentorg=${encodeURIComponent(currentOrg)}` : '';
                const scoParam = scoId ? `&scoid=${scoId}` : '';
                rawPlayerUrl = `${baseUrl}/mod/scorm/player.php?a=${scormId}${orgParam}${scoParam}&display=popup&mode=normal`;
              } else if (module?.id) {
                rawPlayerUrl = `${baseUrl}/mod/scorm/player.php?id=${module.id}&display=popup&mode=normal`;
              } else if (module?.url) {
                rawPlayerUrl = module.url;
              } else {
                rawPlayerUrl = `${baseUrl}/mod/scorm/player.php?a=2&scoid=6&display=popup&mode=normal`;
              }

              setRawScormPlayerUrl(rawPlayerUrl);
              console.log('[SCORM] Target player URL:', rawPlayerUrl);

              // Authenticate through Moodle autologin gateway
              let launchUrl = rawPlayerUrl;
              try {
                const authed = await MobileAPI.getAuthenticatedUrl(rawPlayerUrl);
                if (authed) {
                  launchUrl = authed;
                  console.log('[SCORM] Launching via authenticated AutoLogin:', launchUrl);
                }
              } catch (authErr) {
                console.warn('[SCORM] AutoLogin gateway note:', authErr.message);
              }

              setResolvedUrl(launchUrl);
            } catch (scormErr) {
              console.warn('[SCORM] Resolution failed:', scormErr.message);
            }
          }
          setLoading(false);
          return;
        }

        // 3. HTML Content directly available on module (Pages, Lessons, Labels)
        if (module?.contentHtml) {
          setFetchedHtml(module.contentHtml);
          setLoading(false);
          return;
        }

        // 4. Page / Book module — fetch content via Web Services
        if (module?.modname === 'page' || module?.modname === 'book') {
          if (courseId && client) {
            try {
              const pagesRes = await client.getPagesByCourses([courseId]);
              const page = (pagesRes?.pages || []).find(
                p => p.coursemodule === module.id || p.id === module.instance
              );
              if (page?.content) {
                const fixed = fixMoodleHtmlContent(page.content, token, client.baseUrl);
                setFetchedHtml(fixed);
                setLoading(false);
                return;
              }
            } catch (pageErr) {
              console.log('getPagesByCourses note:', pageErr);
            }
          }
        }

        // 4B. Moodle Lesson Module (mod_lesson) — Fetch pages and embedded YouTube/HTML content
        if (module?.modname === 'lesson') {
          if (client) {
            try {
              let lessonId = module.instance;
              if (!lessonId && courseId) {
                const lessonsRes = await client.getLessonsByCourses([courseId]);
                const foundL = (lessonsRes?.lessons || []).find(
                  l => l.coursemodule === module.id || l.id === module.instance
                );
                if (foundL) lessonId = foundL.id;
              }

              if (lessonId) {
                await client.launchLessonAttempt(lessonId).catch(() => {});
                const pagesRes = await client.getLessonPages(lessonId);

                if (pagesRes?.pages && pagesRes.pages.length > 0) {
                  let combinedHtml = '';
                  for (const pageObj of pagesRes.pages) {
                    const pId = pageObj.page?.id;
                    if (pId) {
                      const pageData = await client.getLessonPageData(lessonId, pId);
                      if (pageData?.page?.contents) {
                        combinedHtml += `<div class="lesson-page">${pageData.page.contents}</div>`;
                      }
                    }
                  }

                  if (combinedHtml) {
                    const fixed = fixMoodleHtmlContent(combinedHtml, token, client.baseUrl);
                    setFetchedHtml(fixed);
                    setLoading(false);
                    return;
                  }
                }
              }
            } catch (lessonErr) {
              console.warn('[Viewer] Error fetching lesson pages:', lessonErr);
            }
          }
        }

        // 5. PDF Document Viewer (wrap with Google Docs PDF Embed)
        if (isPdfModule) {
          const rawFileUrl = module?.fileUrl || module?.url || module?.files?.[0]?.fileurl;
          if (rawFileUrl) {
            const authenticatedPdfUrl = getMoodleMediaUrl(rawFileUrl, token);
            const gDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(authenticatedPdfUrl)}`;
            setResolvedUrl(gDocsUrl);
            setLoading(false);
            return;
          }
        }

        // 6. External URL (mod_url)
        if (module?.modname === 'url' && module?.url && !module.url.includes('mod/url/view.php')) {
          setResolvedUrl(module.url);
          setLoading(false);
          return;
        }

        // 7. General Moodle Activity Fallback
        if (module?.description) {
          const fixed = fixMoodleHtmlContent(module.description, token, client.baseUrl);
          setFetchedHtml(fixed);
        } else {
          setFetchedHtml(`<h3>${title}</h3><p>Learning activity content is ready.</p>`);
        }
      } catch (err) {
        console.warn('resolveContent error:', err);
        setHasError(true);
        setErrorMessage(err.message || 'Could not render this course material.');
      } finally {
        setLoading(false);
      }
    }

    resolveContent();
  }, [module, courseId, isVideoModule, isAudioModule, isImageModule, isPdfModule]);

  const targetUrl = resolvedUrl || module?.webUrl || module?.url || module?.fileUrl;

  const handleShare = async () => {
    if (targetUrl) {
      try {
        await Share.share({
          title,
          message: `Check out ${title} on UNIlearn: ${targetUrl}`,
          url: targetUrl,
        });
      } catch (e) {}
    }
  };

  const handleOpenExternal = () => {
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(() => {});
    }
  };

  // Handle messages from the injected SCORM JavaScript API Bridge
  const handleScormBridgeMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[SCORM In-App Event]:', data.type, data.lessonStatus, data.score);

      if (data.type === 'OPEN_CERTIFICATE') {
        const certUrlToOpen = data.url || resolvedUrl || targetUrl;
        if (certUrlToOpen) {
          (async () => {
            try {
              const authed = await MobileAPI.getAuthenticatedUrl(certUrlToOpen);
              await WebBrowser.openBrowserAsync(authed || certUrlToOpen);
            } catch (e) {
              Linking.openURL(certUrlToOpen).catch(() => {});
            }
          })();
        }
      }

      if (data.type === 'OPEN_YOUTUBE') {
        const vid = data.videoId || currentYtId;
        if (vid) {
          const appUrl = `vnd.youtube:${vid}`;
          const webUrl = `https://www.youtube.com/watch?v=${vid}`;
          Linking.canOpenURL(appUrl).then(can => {
            if (can) {
              Linking.openURL(appUrl);
            } else {
              Linking.openURL(webUrl);
            }
          }).catch(() => {
            Linking.openURL(webUrl);
          });
        }
      }

      if (data.type === 'VIDEO_ENDED') {
        setScormCompleted(true);
        if (module?.id) {
          MobileAPI.toggleActivityCompletion(courseId, module.id, true, currentUser)
            .catch(err => console.warn('[Viewer] Video complete sync note:', err));
        }
      }

      if (data.type === 'SCORM_COMMIT' || data.type === 'SCORM_FINISH' || data.type === 'SCORM_SET_VALUE') {
        const status = data.lessonStatus || data.cmi?.['cmi.core.lesson_status'];
        const score = data.score || data.cmi?.['cmi.core.score.raw'];

        if (score) {
          setScormScore(score);
        }

        const isCompleted = status === 'completed' || status === 'passed';
        if (isCompleted) {
          setScormCompleted(true);
          if (module?.id) {
            MobileAPI.toggleActivityCompletion(courseId, module.id, true, currentUser)
              .then(() => console.log('[SCORM In-App] Moodle completion synced successfully!'))
              .catch(err => console.warn('[SCORM In-App] Completion sync note:', err));
          }
        }
      }
    } catch (e) {
      // Non-JSON message
    }
  };

  const isScorm = module?.modname === 'scorm';
  const currentYtId = !isScorm && extractYouTubeId([
    module?.externalurl,
    module?.url,
    module?.webUrl,
    fetchedHtml,
  ].filter(Boolean).join(' '));

  const renderSource = () => {
    // 0. YouTube Direct In-App Player — only for non-SCORM modules,
    //    and only check explicit URL fields (not description/contentHtml which
    //    may contain supplementary YouTube links embedded in SCORM course text).
    const isScorm = module?.modname === 'scorm';
    const ytId = !isScorm && extractYouTubeId([
      module?.externalurl,
      module?.url,
      module?.webUrl,
      fetchedHtml,
    ].filter(Boolean).join(' '));
    if (ytId) {
      return {
        html: generateYouTubePlayerHtml(ytId, isDark),
        baseUrl: 'https://mh.unilearn.org.in',
      };
    }

    // 1. Official Moodle Certificate (Loads authentic authenticated Moodle page)
    if (isCertModule) {
      if (resolvedUrl) {
        return { uri: resolvedUrl };
      }

      const compTime = module?.completiondata?.timecompleted
        ? new Date(module.completiondata.timecompleted * 1000)
        : new Date();

      const awardedFormatted = compTime.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const certCmId = module?.id || module?.coursemodule || module?.instance;
      const modType = module?.modname || 'customcert';
      const fallbackUrl = module?.url || module?.webUrl || (certCmId ? `https://mh.unilearn.org.in/mod/${modType}/view.php?id=${certCmId}` : null);

      return {
        html: generateOfficialMoodleCertificateHtml({
          courseTitle: module?.name || courseName || 'COURSE CERTIFICATE',
          description: module?.description || 'Official course completion certificate.',
          awardedDateFormatted: awardedFormatted,
          pdfDownloadUrl: fallbackUrl || '',
          isDark,
        }),
      };
    }

    // 2. Resolved Server Document / Embed URL (SCORM pluginfile, PDF viewer, etc.)
    if (resolvedUrl) {
      return { uri: resolvedUrl };
    }

    // 3. Direct Native Media Player (Video / Audio / Image)
    if (directMediaUrl) {
      return {
        html: generateMobileHtml(
          `<p style="margin-top: 16px; font-weight: 600;">${module?.description || ''}</p>`,
          isDark,
          mediaType === 'video' ? directMediaUrl : null,
          mediaType === 'audio' ? directMediaUrl : null,
          mediaType === 'image' ? directMediaUrl : null,
          mediaMime
        ),
        baseUrl: 'https://mh.unilearn.org.in'
      };
    }

    // 4. SCORM Interactive In-App Player
    if (module?.modname === 'scorm') {
      return {
        html: generateScormPlayerHtml({
          title,
          description: module?.description,
          contentHtml: fetchedHtml || module?.contentHtml,
          isDark,
          userId: currentUser?.id || '2',
          userName: currentUser?.fullname || 'Student',
          courseName,
        }),
        baseUrl: 'https://mh.unilearn.org.in'
      };
    }

    // 5. Native In-App HTML Page / Lesson / Material
    const rawContent = fetchedHtml || module?.contentHtml || module?.description;
    if (rawContent) {
      return {
        html: generateMobileHtml(rawContent, isDark),
        baseUrl: 'https://mh.unilearn.org.in',
      };
    }

    // 6. Guaranteed In-App HTML Fallback (Never triggers Web page not available)
    return {
      html: generateMobileHtml(
        `<h2>${title}</h2><p>${module?.description || 'हे शिक्षण साहित्य ॲपमध्ये उपलब्ध आहे.'}</p>`,
        isDark
      ),
      baseUrl: 'https://mh.unilearn.org.in',
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#003B5C" />

      {/* Top Native Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }, isLandscape && styles.topBarLandscape]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <View style={[styles.badge, { backgroundColor: scormCompleted ? '#22C55E' : theme.badgeBg }]}>
            <Text style={[styles.badgeText, { color: scormCompleted ? '#FFFFFF' : theme.primary }]}>
              {scormCompleted ? '✓ COMPLETED' : typeLabel}
            </Text>
          </View>
          <Text style={[styles.topBarTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {currentYtId && (
            <TouchableOpacity
              style={[styles.headerBtn, { marginRight: 2, backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
              onPress={() => {
                const appUrl = `vnd.youtube:${currentYtId}`;
                const webUrl = `https://www.youtube.com/watch?v=${currentYtId}`;
                Linking.canOpenURL(appUrl).then(can => {
                  if (can) {
                    Linking.openURL(appUrl);
                  } else {
                    Linking.openURL(webUrl);
                  }
                }).catch(() => {
                  Linking.openURL(webUrl);
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Play size={18} color="#EF4444" fill="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              setHasError(false);
              webViewRef.current?.reload();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RotateCw size={19} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { marginLeft: 4 }]}
            onPress={toggleOrientation}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isLandscape ? <Minimize2 size={19} color="#FFFFFF" /> : <Maximize2 size={19} color="#FFFFFF" />}
          </TouchableOpacity>
          {targetUrl && (
            <TouchableOpacity
              style={[styles.headerBtn, { marginLeft: 4 }]}
              onPress={handleShare}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Share2 size={19} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {isCertModule && (
            <TouchableOpacity
              style={[styles.headerBtn, { marginLeft: 4, backgroundColor: '#059669' }]}
              onPress={async () => {
                try {
                  const targetCertUrl = resolvedUrl || targetUrl || module?.url || module?.webUrl;
                  if (targetCertUrl) {
                    const authed = await MobileAPI.getAuthenticatedUrl(targetCertUrl);
                    await WebBrowser.openBrowserAsync(authed || targetCertUrl);
                  }
                } catch (e) {
                  console.warn('Error opening cert:', e);
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Award size={19} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress / Loading Bar */}
      {loading && (
        <View style={[styles.loadingBar, { backgroundColor: theme.surfaceSubtle }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textDim }]}>
            {module?.modname === 'scorm'
              ? 'Loading interactive module...'
              : isPdfModule
              ? 'Preparing PDF document reader...'
              : 'Loading course material...'}
          </Text>
        </View>
      )}

      {/* Error Fallback Card if loading fails */}
      {hasError ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={44} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('error_loading_content_title', 'Unable to load content')}
          </Text>
          <Text style={[styles.errorSub, { color: theme.textDim }]}>
            {errorMessage || t('error_loading_general', 'Could not load this course material. Please try again.')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <TouchableOpacity
              style={[styles.openDirectBtn, { backgroundColor: '#004F7A' }]}
              onPress={() => {
                setHasError(false);
                setLoading(true);
                setTimeout(() => {
                  if (webViewRef.current) webViewRef.current.reload();
                }, 300);
              }}
            >
              <RotateCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.openDirectBtnText}>{t('retry', 'Retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Fullscreen Native In-App Reader / Video Player / SCORM Canvas */
        <View style={styles.webViewWrapper}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={renderSource()}
            style={[styles.webView, { backgroundColor: isScormPlaying ? '#000000' : theme.background }]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            allowsInlineMediaPlayback={true}
            allowsFullscreenVideo={true}
            mediaPlaybackRequiresUserAction={false}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36"
            javaScriptCanOpenWindowsAutomatically={true}
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            startInLoadingState={false}
            scalesPageToFit={false}
            injectedJavaScript={`
              (function() {
                try {
                  var isScorm = ${module?.modname === 'scorm' ? 'true' : 'false'};
                  var isCert = ${isCertModule ? 'true' : 'false'};
                  var isDark = ${isDark ? 'true' : 'false'};

                  if (isScorm) {
                    var iframe = document.getElementById('scorm_object') || document.getElementById('bofrm') || document.querySelector('iframe');
                    if (iframe) {
                      iframe.style.width = '100vw';
                      iframe.style.height = '100vh';
                      iframe.style.border = 'none';
                    }
                    var hideSelectors = ['#page-header', '#nav-drawer', '.navbar', '.header-main', '#page-navbar', '.activity-header', '.breadcrumb', 'header', 'footer'];
                    hideSelectors.forEach(function(sel) {
                      var el = document.querySelector(sel);
                      if (el) el.style.display = 'none';
                    });
                    document.body.style.margin = '0';
                    document.body.style.padding = '0';
                    document.body.style.backgroundColor = '#000000';
                  } else if (isCert) {
                    var certHide = ['#nav-drawer', '.navbar', '.header-main', '#page-navbar', '.breadcrumb', 'footer', '#page-footer'];
                    certHide.forEach(function(sel) {
                      var el = document.querySelector(sel);
                      if (el) el.style.display = 'none';
                    });
                    document.body.style.backgroundColor = isDark ? '#090D16' : '#F8FAFC';
                    document.body.style.color = isDark ? '#F1F5F9' : '#0F172A';
                    document.body.style.padding = '16px';
                    var certBtns = document.querySelectorAll('.btn, button, input[type="submit"]');
                    certBtns.forEach(function(btn) {
                      btn.style.borderRadius = '8px';
                      btn.style.padding = '12px 20px';
                      btn.style.fontSize = '15px';
                      btn.style.fontWeight = '700';
                    });
                  } else {
                    var generalHide = ['#nav-drawer', '.navbar', '.header-main', '#page-navbar', '.breadcrumb', 'footer'];
                    generalHide.forEach(function(sel) {
                      var el = document.querySelector(sel);
                      if (el) el.style.display = 'none';
                    });
                    if (isDark) {
                      document.body.style.backgroundColor = '#090D16';
                      document.body.style.color = '#F1F5F9';
                    }
                  }
                } catch(e) {}
              })();
              true;
            `}
            onMessage={handleScormBridgeMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(req) => {
              const reqUrl = req?.url || '';
              if (!reqUrl || reqUrl === 'about:blank') return true;

              const isPdfOrDownload =
                reqUrl.includes('downloadown=1') ||
                reqUrl.includes('action=get') ||
                reqUrl.toLowerCase().endsWith('.pdf') ||
                (reqUrl.includes('/pluginfile.php/') && reqUrl.toLowerCase().includes('.pdf'));

              if (isPdfOrDownload) {
                (async () => {
                  try {
                    const authedDownloadUrl = await MobileAPI.getAuthenticatedUrl(reqUrl);
                    await WebBrowser.openBrowserAsync(authedDownloadUrl || reqUrl);
                  } catch (e) {
                    console.warn('[CourseContentViewer] Error opening PDF in browser:', e);
                    Linking.openURL(reqUrl).catch(() => {});
                  }
                })();
                return false;
              }
              return true;
            }}
            onError={(e) => {
              const err = e.nativeEvent;
              console.warn('[WebView] Error:', err.code, err.description, err.url);
              setLoading(false);
              setHasError(true);
              const isReset = err.description?.includes('RESET') || err.code === -7;
              setErrorMessage(
                isReset
                  ? t('error_network_connection_reset', 'Network connection was reset. Please check your internet or firewall.')
                  : t('error_loading_general', 'Could not load this course material. Please try again.')
              );
            }}
            onNavigationStateChange={navState => {
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);

              // If Moodle autologin drops user on dashboard, redirect straight to player.php
              if (
                rawScormPlayerUrl &&
                (navState.url.endsWith('/my/') || navState.url.endsWith('/my') || navState.url.includes('/my/courses.php') || navState.url.endsWith('/?redirect=0')) &&
                !navState.url.includes('autologin') &&
                !navState.url.includes('player.php')
              ) {
                console.log('[WebView] Redirecting stray dashboard navigation to player:', rawScormPlayerUrl);
                webViewRef.current?.injectJavaScript(`window.location.replace('${rawScormPlayerUrl}'); true;`);
              }
            }}
          />
        </View>
      )}



    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarLandscape: {
    paddingTop: Platform.OS === 'ios' ? 14 : 8,
    paddingBottom: 8,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  exitPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  exitPlayerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scormLaunchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#004F7A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  scormBannerLeft: {
    flex: 1,
    marginRight: 12,
  },
  scormBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : undefined,
  },
  scormBannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  certLaunchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  certViewPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  certViewPdfText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00AEEF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  playButtonCompleted: {
    backgroundColor: '#10B981',
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  webViewWrapper: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  openDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00AEEF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  openDirectBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingCompletionToast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  floatingCompletionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
