import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { generateYouTubePlayerHtml } from './CourseContentViewerScreen';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';

export default function LessonPlayerScreen({ route, navigation }) {
  const { module, courseId, courseName } = route?.params || {};
  const lessonId = module?.instance || module?.id;
  const title = module?.name || 'Lesson';

  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [currentPageId, setCurrentPageId] = useState(null);
  const [currentPageData, setCurrentPageData] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  
  const webViewRef = useRef(null);

  // Orientation unlock
  useEffect(() => {
    async function enableRotation() {
      await ScreenOrientation.unlockAsync();
    }
    enableRotation();

    const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
      const { orientationInfo } = evt;
      const landscape =
        orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(landscape);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    }
  };

  // Initialize Lesson
  useEffect(() => {
    async function initLesson() {
      try {
        setLoading(true);
        // 1. Get all pages in the lesson
        const allPages = await MobileAPI.getLessonPages(lessonId);
        setPages(allPages || []);

        if (allPages && allPages.length > 0) {
          const firstPageId = allPages[0].page.id;
          setCurrentPageId(firstPageId);
          await loadPageData(firstPageId);
        } else {
          // No pages found
          setIsFinished(true);
        }
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    }
    if (lessonId) {
      initLesson();
    }
  }, [lessonId]);

  const loadPageData = async (pageId) => {
    setLoading(true);
    try {
      const data = await MobileAPI.getLessonPageData(lessonId, pageId);
      if (data && data.page) {
        setCurrentPageData(data);
        setCurrentPageId(data.page.id);

        // Auto-complete if this is the ONLY page in the lesson
        if (pages.length === 1) {
          const answers = data.answers || [];
          if (answers.length > 0) {
            MobileAPI.processLessonPage(lessonId, pageId, [{
              name: 'answerid',
              value: String(answers[0].id)
            }]).catch(e => console.warn('Silent auto-complete failed:', e));
          }
        }
      } else {
        throw new Error('Invalid page data received');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = async () => {
    if (!currentPageData) return;

    try {
      setLoading(true);
      // Moodle Lesson Process Page expects data array for answers/navigation.
      // For content pages (qtype=20), we usually submit the answer ID that represents the jump.
      const answers = currentPageData.answers || [];
      const firstAnswer = answers[0];
      
      const dataToSubmit = [];
      if (firstAnswer) {
        // Different question types require different data. For content, usually just the answer ID to jump.
        dataToSubmit.push({
          name: `answerid`,
          value: String(firstAnswer.id)
        });
      }

      const res = await MobileAPI.processLessonPage(lessonId, currentPageId, dataToSubmit);
      
      if (res && res.newpageid) {
        // If it returns a new page ID and it's not a special end of lesson flag (-9)
        if (res.newpageid === -9 || res.newpageid === -1) {
          setIsFinished(true);
        } else {
          await loadPageData(res.newpageid);
        }
      } else {
        // Fallback: simply increment if we have local pages array and can find the next one
        const currentIndex = pages.findIndex(p => p.page.id === currentPageId);
        if (currentIndex !== -1 && currentIndex < pages.length - 1) {
          await loadPageData(pages[currentIndex + 1].page.id);
        } else {
          setIsFinished(true); // End of lesson
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to navigate to next page');
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const extractYouTubeId = (html) => {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : null;
  };

  const generateMobileHtml = (htmlContent) => {
    const youtubeId = extractYouTubeId(htmlContent);
    let cleanHtml = htmlContent || '';
    let mediaBlock = '';

    const bg = theme.background;
    const text = theme.text;
    const cardBg = theme.surface;
    const border = theme.cardBorder || '#E2E8F0';

    if (youtubeId) {
      // Clean raw htmlContent to avoid duplicated iframe when youtube player is rendered
      cleanHtml = cleanHtml
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<div class="embed-responsive[^>]*>[\s\S]*?<\/div>/gi, '');

      // Check if there is any actual readable text remaining
      const hasText = cleanHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim().length > 0;

      // If there is ONLY a video (no text), make it full screen exactly like CourseContentViewerScreen
      if (!hasText) {
        return generateYouTubePlayerHtml(youtubeId, theme.isDark);
      }

      // If there is text alongside the video, use a 16:9 edge-to-edge block at the top
      mediaBlock = `
        <div style="width: 100%; background: #000; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=0&playsinline=1&modestbranding=1" 
            title="Video Lesson" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" 
            allowfullscreen 
            referrerpolicy="strict-origin-when-cross-origin"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
          ></iframe>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            .content-pad {
              padding: 16px;
            }
            img { max-width: 100% !important; height: auto !important; border-radius: 8px; margin: 10px 0; }
            iframe { width: 100%; border: 0; min-height: 240px; margin: 10px 0; border-radius: 14px; }
            .embed-responsive { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 14px; }
            .embed-responsive iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
            a { color: #00AEEF; text-decoration: none; font-weight: 600; }
            h1, h2, h3, h4, h5, h6 { margin-top: 18px; margin-bottom: 8px; }
            ul, ol { padding-left: 22px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          ${mediaBlock}
          ${cleanHtml ? `<div class="content-pad">${cleanHtml}</div>` : ''}
        </body>
      </html>
    `;
  };

  // Render Logic
  if (isFinished) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor="#003B5C" />
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>

        <View style={styles.finishedContainer}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <CheckCircle2 size={64} color="#10B981" />
          </View>
          <Text style={[styles.finishedTitle, { color: theme.text }]}>
            {t('lesson_completed', 'Lesson Completed!')}
          </Text>
          <Text style={[styles.finishedSub, { color: theme.textDim }]}>
            {t('lesson_completed_desc', 'You have reached the end of this lesson.')}
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionBtnText}>{t('back_to_course', 'Back to Course')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentIndex = pages.findIndex(p => p.page.id === currentPageId);
  const totalPages = pages.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#003B5C" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }, isLandscape && styles.headerLandscape]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {totalPages > 0 && (
            <Text style={styles.headerSub}>
              {t('page', 'Page')} {currentIndex + 1} {t('of', 'of')} {totalPages}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerBtnRight}
          onPress={toggleOrientation}
        >
          {isLandscape ? <Minimize2 size={24} color="#FFFFFF" /> : <Maximize2 size={24} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {loading && !currentPageData && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textDim }]}>
            {t('loading_lesson', 'Loading lesson...')}
          </Text>
        </View>
      )}

      {/* WebView Content */}
      <View style={styles.contentContainer}>
        {currentPageData && currentPageData.page && (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ 
              html: generateMobileHtml(currentPageData.page.contents),
              baseUrl: 'https://mh.unilearn.org.in' 
            }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={(e) => {
              try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'OPEN_YOUTUBE') {
                  const vid = data.videoId || extractYouTubeId(currentPageData?.page?.contents);
                  if (vid) {
                    const appUrl = `vnd.youtube:${vid}`;
                    const webUrl = `https://www.youtube.com/watch?v=${vid}`;
                    Linking.canOpenURL(appUrl).then(can => {
                      if (can) Linking.openURL(appUrl);
                      else Linking.openURL(webUrl);
                    }).catch(() => Linking.openURL(webUrl));
                  }
                }
              } catch(err) {}
            }}
          />
        )}
      </View>

      {/* Footer Navigation (Hidden for single page lessons) */}
      {totalPages > 1 && (
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.cardBorder, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity 
            style={[styles.footerBtn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleNextPage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.footerBtnText}>
                  {currentIndex === totalPages - 1 ? t('finish_lesson', 'Finish Lesson') : t('next_page', 'Next Page')}
                </Text>
                {currentIndex !== totalPages - 1 && <ArrowRight size={20} color="#FFFFFF" />}
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerLandscape: {
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
    paddingBottom: 4,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerBtnRight: {
    padding: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  footerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  finishedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  finishedTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  finishedSub: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  }
});
