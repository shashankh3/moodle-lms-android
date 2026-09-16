/**
 * ScormPlayerScreen — Phase 4
 * Dedicated fullscreen SCORM player with multi-SCO Table of Contents.
 * Modelled after AddonModScormPlayerPage from moodlehq/moodleapp.
 *
 * Features:
 *   - Loads all SCOs from getScormScoes()
 *   - Pre-seeds CMI data from getScormUserData()
 *   - Fetches Storyline HTML and injects <base href> + SCORM 1.2 bridge
 *   - Automatic fallback to authenticated direct URL if pluginfile is not accessible
 *   - Shows a TOC bottom sheet for multi-SCO navigation
 *   - Syncs tracks to Moodle on LMSCommit / LMSFinish
 *   - Marks Moodle activity completion when lesson_status = completed/passed
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  ActivityIndicator, Modal, FlatList, StatusBar, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI } from '../../services/apiAdapter';
import { ScormService } from '../../services/scorm/ScormService';
import { ScormDataModel12 } from '../../services/scorm/ScormDataModel12';
import { extractYouTubeId, generateYouTubePlayerHtml } from './CourseContentViewerScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  ArrowLeft, List, ChevronLeft, ChevronRight,
  CheckCircle, RotateCw, X, AlertCircle, Maximize, Minimize, Play,
} from 'lucide-react-native';

export default function ScormPlayerScreen({ route, navigation }) {
  const { module, courseId } = route?.params || {};
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();
  const webViewRef = useRef(null);

  const [loading, setLoading]                   = useState(true);
  const [loadProgress, setLoadProgress]         = useState(0);
  const [scormHtml, setScormHtml]               = useState(null);
  const [resolvedUri, setResolvedUri]           = useState(null);
  const [resolvedPlayerUrl, setResolvedPlayerUrl] = useState(null);
  const [resolvedBaseHref, setResolvedBaseHref] = useState(null);
  const [scoes, setScoes]                       = useState([]);
  const [currentScoIdx, setCurrentScoIdx]       = useState(0);
  const [showToc, setShowToc]                   = useState(false);
  const [completed, setCompleted]               = useState(false);
  const [score, setScore]                       = useState(null);
  const [dataModel, setDataModel]               = useState(null);
  const [scormObj, setScormObj]                 = useState(null);
  const [errorMsg, setErrorMsg]                 = useState(null);
  const [isLandscape, setIsLandscape]           = useState(false);
  const insets = useSafeAreaInsets();

  const title = module?.name || 'Interactive Module';

  // Load a specific SCO into the WebView
  const loadSco = async (sco, scorm, userData, scoIdx, client, token, baseUrl) => {
    setLoading(true);
    setErrorMsg(null);
    setCurrentScoIdx(scoIdx);

    // 0. Only treat this as a YouTube-only module if the launch URL or explicit
    //    external URL is a YouTube link. Do NOT check description/contentHtml —
    //    those may embed YouTube links as supplementary material inside a real SCORM package.
    const ytId = extractYouTubeId([
      sco?.launch,
      module?.externalurl,
      module?.url,
      module?.webUrl,
    ].filter(Boolean).join(' '));

    if (ytId) {
      setScormHtml(generateYouTubePlayerHtml(ytId, isDark));
      setResolvedBaseHref('https://mh.unilearn.org.in');
      setResolvedUri(null);
      setLoading(false);
      return;
    }

    const contextid = module?.contextid || scorm?.contextid || (module?.id ? (31 + parseInt(module.id, 10)) : 33);
    const launchUrl = module?.scormLaunchUrl || ScormService.getLaunchUrl(scorm, sco, contextid, token, baseUrl);
    const baseHref  = ScormService.getBaseHref(scorm, contextid, baseUrl);

    console.log('[ScormPlayer] Loading SCO:', scoIdx + 1, 'Launch URL:', launchUrl);

    // Build data model for this SCO (for SCORM 1.2 bridge)
    const scoId = sco?.id || module?.instance || 1;
    const model = new ScormDataModel12({
      scoId,
      scormId: scorm?.id || module?.instance || 0,
      attempt: 1,
      userId:   currentUser?.id   || '2',
      userName: currentUser?.fullname || 'Student',
      userData: userData || {},
      client,
      courseId: courseId || module?.course || module?.courseId || 1,
      onComplete: ({ lessonStatus, score: rawScore }) => {
        setCompleted(true);
        setScore(rawScore);
        if (module?.id) {
          MobileAPI.toggleActivityCompletion(courseId || module?.course || 1, module.id, true, currentUser)
            .catch(e => console.warn('[ScormPlayer] Completion sync note:', e));
        }
      },
    });
    setDataModel(model);

    // Launch via Moodle's native interactive web player with AutoLogin authentication
    const scormId = scorm?.id || module?.instance || 2;
    let playerUrl = '';
    if (scormId) {
      const orgParam = sco?.organization ? `&currentorg=${encodeURIComponent(sco.organization)}` : '';
      const scoParam = sco?.id ? `&scoid=${sco.id}` : '';
      playerUrl = `${baseUrl}/mod/scorm/player.php?a=${scormId}${orgParam}${scoParam}&display=popup&mode=normal`;
    } else if (module?.id) {
      playerUrl = `${baseUrl}/mod/scorm/player.php?id=${module.id}&display=popup&mode=normal`;
    } else {
      playerUrl = `${baseUrl}/mod/scorm/player.php?a=2&scoid=6&display=popup&mode=normal`;
    }

    let directUri = playerUrl;
    try {
      const authed = await MobileAPI.getAuthenticatedUrl(playerUrl);
      if (authed) directUri = authed;
    } catch (e) {
      console.warn('[ScormPlayer] AutoLogin note:', e.message);
    }

    setScormHtml(null);
    setResolvedUri(directUri);
    setResolvedBaseHref(baseUrl || 'https://mh.unilearn.org.in');
    setLoading(false);
  };

  // Resolve SCORM data: scorm metadata, SCOs, user data, and render first SCO
  const initScorm = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const client = await MobileAPI.getClient();
      if (!client) {
        setErrorMsg('Not connected to Moodle server');
        setLoading(false);
        return;
      }

      const token   = client.token;
      const baseUrl = client.baseUrl;
      const targetCourseId = courseId || module?.course || module?.courseId || 1;

      // 1. Get SCORM package metadata
      let scorm = null;
      try {
        const scormList = await ScormService.getScormsByCourses([targetCourseId]);
        scorm = (scormList || []).find(s =>
          s.coursemodule === module?.id || s.id === module?.instance
        ) || scormList?.[0] || null;
      } catch (e) {}

      if (!scorm) {
        scorm = {
          id: module?.instance || module?.scormId || 1,
          coursemodule: module?.id || 1,
          contextid: module?.contextid || 33,
          revision: 4,
        };
      }
      setScormObj(scorm);

      const targetScormId = scorm?.id || module?.instance || module?.scormId;

      // 2. Get all SCOs
      let scoList = [];
      if (targetScormId) {
        try {
          scoList = await ScormService.getScormScoes(targetScormId);
        } catch (e) {}
      }
      const launchableScoes = (scoList || []).filter(s => (s.launch && s.scormtype !== 'sco') || s.scormtype === 'sco');
      const finalScoes = launchableScoes.length > 0 ? launchableScoes : (scoList && scoList.length > 0 ? scoList : [{ id: 1, launch: 'index_lms.html', title: title }]);
      setScoes(finalScoes);

      // 3. Get saved user CMI data (attempt 1)
      let userData = {};
      if (targetScormId) {
        try {
          userData = await ScormService.getScormUserData(targetScormId, 1);
        } catch (e) {}
      }

      // 4. Build data model for the first SCO
      const firstSco = finalScoes[0];
      await loadSco(firstSco, scorm, userData, 0, client, token, baseUrl);
    } catch (err) {
      console.warn('[ScormPlayerScreen] initScorm error:', err.message);
      setErrorMsg(err.message || 'Failed to initialize player');
      setLoading(false);
    }
  }, [module, courseId, title]);

  useEffect(() => {
    initScorm();
    
    // Unlock orientation when leaving the screen
    return () => {
      ScreenOrientation.unlockAsync().catch(()=>{});
    };
  }, [initScorm]);

  const toggleLandscape = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsLandscape(true);
      }
    } catch (e) {
      console.warn('Orientation lock failed', e);
    }
  };

  // Navigate to the next SCO
  const goNext = async () => {
    if (currentScoIdx >= scoes.length - 1) return;
    const client = await MobileAPI.getClient();
    if (!client) return;
    const targetScormId = scormObj?.id || module?.instance;
    const userData = targetScormId ? await ScormService.getScormUserData(targetScormId, 1) : {};
    await loadSco(scoes[currentScoIdx + 1], scormObj, userData, currentScoIdx + 1, client, client.token, client.baseUrl);
  };

  // Navigate to the previous SCO
  const goPrev = async () => {
    if (currentScoIdx <= 0) return;
    const client = await MobileAPI.getClient();
    if (!client) return;
    const targetScormId = scormObj?.id || module?.instance;
    const userData = targetScormId ? await ScormService.getScormUserData(targetScormId, 1) : {};
    await loadSco(scoes[currentScoIdx - 1], scormObj, userData, currentScoIdx - 1, client, client.token, client.baseUrl);
  };

  // Navigate to a specific SCO from TOC
  const goToSco = async (idx) => {
    setShowToc(false);
    if (idx === currentScoIdx) return;
    const client = await MobileAPI.getClient();
    if (!client) return;
    const targetScormId = scormObj?.id || module?.instance;
    const userData = targetScormId ? await ScormService.getScormUserData(targetScormId, 1) : {};
    await loadSco(scoes[idx], scormObj, userData, idx, client, client.token, client.baseUrl);
  };

  const detectedYtId = extractYouTubeId([
    module?.externalurl,
    module?.url,
    module?.webUrl,
    module?.intro,
    module?.description,
    module?.contentHtml,
    scormObj?.intro,
  ].filter(Boolean).join(' '));

  // Handle bridge messages from WebView
  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[ScormPlayer Bridge Event]:', data?.type, data?.lessonStatus);

      if (data?.type === 'OPEN_YOUTUBE') {
        const vid = data.videoId || detectedYtId;
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

      if (data?.type === 'VIDEO_ENDED') {
        setCompleted(true);
        if (module?.id) {
          MobileAPI.toggleActivityCompletion(courseId || module?.course || 1, module.id, true, currentUser)
            .catch(e => console.warn('[ScormPlayer] Completion sync note:', e));
        }
      }

      if (dataModel) {
        await dataModel.handleBridgeEvent(data);
      }
    } catch (e) {}
  };

  const currentSco  = scoes[currentScoIdx];
  const hasPrev     = currentScoIdx > 0;
  const hasNext     = currentScoIdx < scoes.length - 1;
  const hasMultiple = scoes.length > 1;

  const webSource = scormHtml
    ? { html: scormHtml, baseUrl: resolvedBaseHref || 'https://mh.unilearn.org.in' }
    : resolvedUri
      ? { uri: resolvedUri }
      : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <StatusBar barStyle="light-content" backgroundColor="#003B5C" hidden={isLandscape} />

      {/* Top Header */}
      {!isLandscape && (
        <View style={[styles.topBar, { backgroundColor: theme.headerBg || '#003B5C', paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <View style={[styles.badge, { backgroundColor: completed ? '#22C55E' : 'rgba(0,174,239,0.25)' }]}>
              <Text style={styles.badgeText}>
                {completed ? '✓ COMPLETED' : `SCORM ${currentScoIdx + 1}/${Math.max(scoes.length, 1)}`}
              </Text>
            </View>
            <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                setErrorMsg(null);
                webViewRef.current?.reload();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <RotateCw size={19} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.headerBtn, { marginLeft: 12 }]}
              onPress={toggleLandscape}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Maximize size={19} color="#FFFFFF" />
            </TouchableOpacity>

            {hasMultiple && (
              <TouchableOpacity
                style={[styles.headerBtn, { marginLeft: 12 }]}
                onPress={() => setShowToc(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <List size={21} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {/* Floating Minimize Button for Landscape Mode */}
      {isLandscape && (
        <TouchableOpacity
          style={styles.floatingMinimize}
          onPress={toggleLandscape}
        >
          <Minimize size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Loading bar */}
      {loading && (
        <View style={[styles.loadingBar, { backgroundColor: theme.surfaceSubtle || '#001122' }]}>
          <ActivityIndicator size="small" color="#00AEEF" />
          <Text style={[styles.loadingText, { color: theme.textDim || '#888' }]}>
            Loading interactive player... {loadProgress > 0 ? `${Math.round(loadProgress * 100)}%` : ''}
          </Text>
        </View>
      )}

      {/* Main WebView */}
      {webSource ? (
        <View style={styles.webViewWrapper}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={webSource}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            scalesPageToFit={true}
            javaScriptCanOpenWindowsAutomatically={true}
            setSupportMultipleWindows={false}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            injectedJavaScriptBeforeContentLoaded={dataModel?.generateBridgeScript()}
            injectedJavaScript={`
              (function() {
                try {
                  var iframe = document.getElementById('scorm_object') || document.getElementById('bofrm') || document.querySelector('iframe');
                  if (iframe) {
                    iframe.style.width = '100vw';
                    iframe.style.height = '100vh';
                    iframe.style.border = 'none';
                  }
                  var hideSelectors = ['#page-header', '#nav-drawer', '.navbar', '.header-main', '#page-navbar', '.activity-header'];
                  hideSelectors.forEach(function(sel) {
                    var el = document.querySelector(sel);
                    if (el) el.style.display = 'none';
                  });
                  document.body.style.margin = '0';
                  document.body.style.padding = '0';
                } catch(e) {}
              })();
              ${dataModel?.generateBridgeScript() || ''}
              true;
            `}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={[styles.centerLoading, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color="#00AEEF" />
                <Text style={[styles.centerLoadingText, { color: theme.textDim }]}>
                  Loading Interactive Learning Content...
                </Text>
              </View>
            )}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={(request) => {
              // Block accidental navigation away from the interactive content to web login page
              if (request.url.includes('/login/') || request.url.includes('/login.php') || request.url.includes('/my/')) {
                return false;
              }
              return true;
            }}
            onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
            onLoadStart={() => {
              console.log('[ScormPlayer WebView] Load started');
              setLoading(true);
            }}
            onLoadEnd={() => {
              console.log('[ScormPlayer WebView] Load finished');
              setLoading(false);
            }}
            onError={(e) => {
              console.warn('[ScormPlayer WebView] Load error:', e.nativeEvent.description);
              setLoading(false);
            }}
            onHttpError={(e) => {
              console.warn('[ScormPlayer WebView] HTTP error:', e.nativeEvent.statusCode);
            }}
          />
        </View>
      ) : !loading ? (
        <View style={styles.noContent}>
          <AlertCircle size={44} color="#EF4444" />
          <Text style={[styles.noContentText, { color: theme.text }]}>
            {errorMsg || 'Unable to load this module.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={initScorm}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Prev / Next navigation bar for multi-SCO */}
      {hasMultiple && (
        <View style={[styles.navBar, { backgroundColor: theme.headerBg || '#001A2E' }]}>
          <TouchableOpacity
            style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
            onPress={goPrev}
            disabled={!hasPrev}
          >
            <ChevronLeft size={20} color={hasPrev ? '#FFFFFF' : '#444'} />
            <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>Previous</Text>
          </TouchableOpacity>

          <Text style={styles.navPageIndicator}>
            {currentScoIdx + 1} / {scoes.length}
          </Text>

          <TouchableOpacity
            style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
            onPress={goNext}
            disabled={!hasNext}
          >
            <Text style={[styles.navBtnText, !hasNext && styles.navBtnTextDisabled]}>Next</Text>
            <ChevronRight size={20} color={hasNext ? '#FFFFFF' : '#444'} />
          </TouchableOpacity>
        </View>
      )}




      {/* Table of Contents Modal */}
      {hasMultiple && (
        <Modal
          visible={showToc}
          animationType="slide"
          transparent
          onRequestClose={() => setShowToc(false)}
        >
          <View style={styles.tocBackdrop}>
            <View style={[styles.tocSheet, { backgroundColor: theme.card || '#1E293B' }]}>
              <View style={styles.tocHeader}>
                <Text style={[styles.tocTitle, { color: theme.text || '#FFFFFF' }]}>
                  Module Contents ({scoes.length})
                </Text>
                <TouchableOpacity onPress={() => setShowToc(false)}>
                  <X size={22} color={theme.text || '#FFFFFF'} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={scoes}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.tocItem,
                      index === currentScoIdx && styles.tocItemActive,
                      { borderBottomColor: theme.cardBorder || '#334155' },
                    ]}
                    onPress={() => goToSco(index)}
                  >
                    <Text style={[styles.tocItemNum, { color: '#00AEEF' }]}>{index + 1}</Text>
                    <Text
                      style={[
                        styles.tocItemTitle,
                        { color: index === currentScoIdx ? '#00AEEF' : (theme.text || '#FFFFFF') },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title || item.identifier || `Section ${index + 1}`}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  topBar:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 50 : 14, paddingBottom: 10 },
  headerBtn:          { padding: 6, borderRadius: 8 },
  titleContainer:     { flex: 1, marginHorizontal: 8, alignItems: 'center' },
  badge:              { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 2 },
  badgeText:          { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  topBarTitle:        { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  headerRight:        { flexDirection: 'row', alignItems: 'center' },
  floatingMinimize: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 8 },
  loadingText:        { fontSize: 12 },
  webViewWrapper:     { flex: 1, width: '100%', height: '100%' },
  webView:            { flex: 1, width: '100%', height: '100%' },
  centerLoading:      { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerLoadingText:  { fontSize: 13, fontWeight: '600' },
  navBar:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  navBtn:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#00AEEF', gap: 4 },
  navBtnDisabled:     { backgroundColor: 'rgba(255,255,255,0.1)' },
  navBtnText:         { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  navBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
  navPageIndicator:   { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  completionToast:    { position: 'absolute', bottom: 80, left: 20, right: 20, backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, elevation: 6 },
  completionText:     { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  noContent:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  noContentText:      { fontSize: 15, textAlign: 'center' },
  retryBtn:           { backgroundColor: '#00AEEF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText:          { color: '#FFFFFF', fontWeight: '700' },
  tocBackdrop:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  tocSheet:           { maxHeight: '65%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 0, overflow: 'hidden' },
  tocHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#334155' },
  tocTitle:           { fontSize: 16, fontWeight: '800' },
  tocItem:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  tocItemActive:      { backgroundColor: 'rgba(0,174,239,0.08)' },
  tocItemNum:         { fontSize: 14, fontWeight: '800', width: 28 },
  tocItemTitle:       { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
