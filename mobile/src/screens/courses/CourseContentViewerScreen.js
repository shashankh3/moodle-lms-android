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
  const match = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function generateYouTubePlayerHtml(youtubeId, isDark = false) {
  const bg = isDark ? '#090D16' : '#000000';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
          }
          .video-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
          }
          iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
          }
        </style>
      </head>
      <body>
        <div class="video-wrapper">
          <iframe
            id="ytplayer"
            type="text/html"
            src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https://mh.unilearn.org.in&widget_referrer=https://mh.unilearn.org.in"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        </div>
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
      <body>
        <!-- State 1: Moodle Activity Card (Screenshot 1) -->
        <div id="overview-view">
          <div class="moodle-card">
            <div class="moodle-header">${courseTitle}</div>
            <div class="moodle-desc">${description}</div>
            <div class="moodle-awarded">Awarded on: ${awardedDateFormatted}</div>
            <button class="btn-view-cert" onclick="showServerCertificate()">
              View certificate
            </button>
          </div>
        </div>

        <!-- State 2: Real Server PDF (Screenshot 2) -->
        <div id="cert-doc-view">
          <div class="cert-bar">
            <button class="btn-back" onclick="hideServerCertificate()">← Back to Activity</button>
            <span style="font-size: 13px; font-weight: 600;">Official Certificate (PDF)</span>
            <a href="${pdfDownloadUrl}" target="_blank" style="color: #00AEEF; font-size: 12px; text-decoration: none; font-weight: 700;">Download</a>
          </div>
          <iframe id="cert-iframe" src=""></iframe>
        </div>

        <script>
          function showServerCertificate() {
            var frame = document.getElementById('cert-iframe');
            if (!frame.src || frame.src === 'about:blank' || frame.src === window.location.href) {
              frame.src = '${pdfViewerUrl}';
            }
            document.getElementById('overview-view').style.display = 'none';
            document.getElementById('cert-doc-view').style.display = 'block';
          }
          function hideServerCertificate() {
            document.getElementById('cert-doc-view').style.display = 'none';
            document.getElementById('overview-view').style.display = 'flex';
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
      <div class="media-container" style="margin-bottom: 20px;">
        <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 14px; background: #000; box-shadow: 0 6px 24px rgba(0,0,0,0.3);">
          <iframe 
            src="https://www.youtube.com/embed/${youtubeId}?rel=0&autoplay=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=https://mh.unilearn.org.in&widget_referrer=https://mh.unilearn.org.in" 
            title="Video Lesson" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" 
            allowfullscreen 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 14px;"
          ></iframe>
        </div>
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
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${bg};
            color: ${text};
            padding: 16px;
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
            margin-bottom: 16px;
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

        // 0. Certificate Module
        if (isCertModule) {
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

        // 2. SCORM Module — Resolve authenticated in-app view URL and overview HTML
        if (module?.modname === 'scorm') {
          const targetViewUrl = `${client.baseUrl}/mod/scorm/view.php?id=${module.id || 2}`;
          let authUrl = targetViewUrl;
          try {
            const autologin = await MobileAPI.getAuthenticatedUrl(targetViewUrl);
            if (autologin) authUrl = autologin;
          } catch (e) {}
          setResolvedUrl(authUrl);

          // Prepare overview HTML
          const rawDesc = module?.contentHtml || module?.description || module?.intro ||
            `<div style="text-align: center; padding: 20px;">
               <h3 style="color: #004F7A;">${title}</h3>
               <p style="color: #64748B;">हे परस्परसंवादी शिक्षण मॉड्यूल (Interactive SCORM) सुरू करण्यासाठी खालील प्ले बटण दाबा.</p>
             </div>`;

          const fixed = fixMoodleHtmlContent(rawDesc, token, client.baseUrl);
          setFetchedHtml(fixed);
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

  const renderSource = () => {
    // 0. Official Moodle Customcert (Matches Screenshot 1 & Screenshot 2)
    if (isCertModule) {
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

      const certificateId = module?.instance || module?.id || 2;
      const userId = currentUser?.id || 14;
      const realPdfDownloadUrl = `https://mh.unilearn.org.in/mod/customcert/mobile/pluginfile.php?certificateid=${certificateId}&userid=${userId}&token=${moodleToken}`;
      const gDocsPdfViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(realPdfDownloadUrl)}`;

      return {
        html: generateOfficialMoodleCertificateHtml({
          courseTitle: module?.name || 'COURSE CERTIFICATE',
          description: module?.description || 'Certificate course on career guidance for teachers.',
          awardedDateFormatted: awardedFormatted,
          pdfViewerUrl: gDocsPdfViewerUrl,
          pdfDownloadUrl: realPdfDownloadUrl,
          isDark,
        }),
      };
    }

    // 0B. Resolved Server Document / Embed URL (Google Docs PDF Viewer, etc.)
    if (resolvedUrl) {
      return { uri: resolvedUrl };
    }

    // 1. SCORM Interactive In-App Player (100% local in-app HTML5 canvas)
    if (module?.modname === 'scorm') {
      if (isScormPlaying) {
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
        };
      }
      // SCORM Overview mode (shown before tapping Play)
      const overviewText = module?.description || fetchedHtml || module?.contentHtml ||
        'हे परस्परसंवादी शिक्षण मॉड्यूल (Interactive SCORM) सुरू करण्यासाठी वरील प्ले बटण दाबा.';
      return {
        html: generateMobileHtml(
          `<h3 style="color: #00AEEF; margin-bottom: 12px;">${title}</h3><p>${overviewText}</p>`,
          isDark
        ),
      };
    }

    // 1. YouTube Direct In-App Video Player (Uses origin + baseUrl to prevent Error 150/153)
    const ytId = extractYouTubeId(fetchedHtml || module?.contentHtml || module?.description || module?.intro || module?.url || module?.webUrl);
    if (ytId) {
      return {
        html: generateYouTubePlayerHtml(ytId, isDark),
        baseUrl: 'https://mh.unilearn.org.in',
      };
    }

    // 2. Direct Native Media Player (Video / Audio / Image)
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
      };
    }

    // 3. Native In-App HTML Page / Lesson / Material
    const rawContent = fetchedHtml || module?.contentHtml || module?.description;
    if (rawContent) {
      return {
        html: generateMobileHtml(rawContent, isDark),
        baseUrl: 'https://mh.unilearn.org.in',
      };
    }

    // 4. Guaranteed In-App HTML Fallback (Never triggers Web page not available)
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
        {isScormPlaying ? (
          <TouchableOpacity
            style={styles.exitPlayerBtn}
            onPress={() => setIsScormPlaying(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#FFFFFF" />
            <Text style={styles.exitPlayerText}>{t('exit', 'Exit')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}

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
        </View>
      </View>

      {/* Interactive SCORM Launch Banner (shown in Overview mode) */}
      {module?.modname === 'scorm' && !isScormPlaying && (
        <View style={styles.scormLaunchBanner}>
          <View style={styles.scormBannerLeft}>
            <Text style={styles.scormBannerTitle}>{t('interactive_scorm_title', 'Interactive Learning (SCORM)')}</Text>
            <Text style={styles.scormBannerSubtitle}>
              {scormCompleted
                ? `✅ ${t('scorm_completed_sub', 'You have successfully completed this module!')}`
                : t('scorm_start_sub', 'Tap Play to start this interactive module in-app.')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.playButton, scormCompleted && styles.playButtonCompleted]}
            onPress={() => {
              setIsScormPlaying(true);
            }}
            activeOpacity={0.85}
          >
            <Play size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.playButtonText}>
              {scormCompleted ? t('replay', 'Replay') : t('play', 'Play')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
            onMessage={handleScormBridgeMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(req) => {
              const reqUrl = req?.url || '';
              if (
                reqUrl.includes('downloadown=1') ||
                reqUrl.toLowerCase().endsWith('.pdf') ||
                (reqUrl.includes('/pluginfile.php/') && reqUrl.toLowerCase().includes('.pdf'))
              ) {
                const authedPdf = getMoodleMediaUrl(reqUrl, moodleToken);
                const gDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(authedPdf)}`;
                setResolvedUrl(gDocsUrl);
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
            }}
          />
        </View>
      )}

      {/* Floating Completion Feedback when SCORM is Finished */}
      {scormCompleted && isScormPlaying && (
        <View style={styles.floatingCompletionToast}>
          <CheckCircle size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.floatingCompletionText}>
            {t('progress_saved', 'Progress Saved to Moodle')}
          </Text>
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
