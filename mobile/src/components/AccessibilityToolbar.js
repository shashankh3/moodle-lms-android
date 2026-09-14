import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import {
  Settings,
  Eye,
  Sliders,
  Type,
  X,
  Minimize2,
  Maximize2,
  SunMoon,
} from 'lucide-react-native';

export default function AccessibilityToolbar() {
  const {
    showAccessibilityToolbar,
    fontSizeMultiplier,
    setFontSizeMultiplier,
    fontType,
    toggleDyslexicFont,
    highContrast,
    toggleHighContrast,
    readingRuler,
    toggleReadingRuler,
    openAccessibilityModal,
    resetAccessibility,
  } = useTheme();

  const [minimized, setMinimized] = useState(false);

  const rulerY = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dy: rulerY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        rulerY.extractOffset();
      },
    })
  ).current;

  const toolbarPan = React.useRef(new Animated.ValueXY()).current;
  const toolbarPanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: Animated.event(
        [null, { dx: toolbarPan.x, dy: toolbarPan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        toolbarPan.extractOffset();
      },
    })
  ).current;

  if (!showAccessibilityToolbar) {
    return null;
  }

  const handleDecreaseFont = () => {
    if (fontSizeMultiplier > 0.85) {
      setFontSizeMultiplier(Math.round((fontSizeMultiplier - 0.15) * 100) / 100);
    }
  };

  const handleIncreaseFont = () => {
    if (fontSizeMultiplier < 1.45) {
      setFontSizeMultiplier(Math.round((fontSizeMultiplier + 0.15) * 100) / 100);
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Reading Ruler Guide Overlay */}
      {readingRuler && (
        <View style={styles.readingRulerGuide} pointerEvents="box-none">
          <Animated.View 
            style={[styles.readingRulerBand, { transform: [{ translateY: rulerY }] }]} 
            {...panResponder.panHandlers}
          />
        </View>
      )}

      {/* Floating Toolbar Widget */}
      <Animated.View 
        style={[
          styles.toolbarWrapper, 
          { transform: toolbarPan.getTranslateTransform() }
        ]} 
        pointerEvents="box-none"
        {...toolbarPanResponder.panHandlers}
      >
        <View style={[styles.toolbarCard, highContrast && styles.toolbarHighContrast]}>
          {minimized ? (
            <TouchableOpacity
              style={styles.minimizedBtn}
              onPress={() => setMinimized(false)}
              activeOpacity={0.8}
            >
              <View style={styles.a11yCircle}>
                <Text style={styles.a11yIconText}>♿</Text>
              </View>
              <Maximize2 size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.toolbarContent}>
              {/* Header / Title */}
              <View style={styles.toolbarHeader}>
                <View style={styles.headerLeft}>
                  <View style={styles.a11yBadge}>
                    <Text style={styles.a11yBadgeText}>♿ A11Y</Text>
                  </View>
                  <Text style={styles.toolbarTitle}>Toolbar</Text>
                </View>

                <View style={styles.headerControls}>
                  <TouchableOpacity
                    style={styles.toolIconBtn}
                    onPress={openAccessibilityModal}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Settings size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.toolIconBtn}
                    onPress={() => setMinimized(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Minimize2 size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Actions Row */}
              <View style={styles.toolsRow}>
                {/* Font Size A- */}
                <TouchableOpacity
                  style={[styles.toolBtn, fontSizeMultiplier <= 0.85 && styles.toolBtnDisabled]}
                  onPress={handleDecreaseFont}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toolBtnText}>A-</Text>
                </TouchableOpacity>

                {/* Font Size Indicator */}
                <View style={styles.sizeIndicator}>
                  <Text style={styles.sizeIndicatorText}>
                    {Math.round(fontSizeMultiplier * 100)}%
                  </Text>
                </View>

                {/* Font Size A+ */}
                <TouchableOpacity
                  style={[styles.toolBtn, fontSizeMultiplier >= 1.45 && styles.toolBtnDisabled]}
                  onPress={handleIncreaseFont}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toolBtnText}>A+</Text>
                </TouchableOpacity>

                {/* Dyslexic Font Toggle */}
                <TouchableOpacity
                  style={[
                    styles.toolBtnToggle,
                    fontType === 'dyslexic' && styles.toolBtnToggleActive,
                  ]}
                  onPress={toggleDyslexicFont}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.toolBtnToggleText,
                      fontType === 'dyslexic' && styles.toolBtnToggleTextActive,
                      { fontFamily: 'casual' },
                    ]}
                  >
                    Dyslexia
                  </Text>
                </TouchableOpacity>

                {/* High Contrast Toggle */}
                <TouchableOpacity
                  style={[
                    styles.toolBtnToggle,
                    highContrast && styles.toolBtnToggleActive,
                  ]}
                  onPress={toggleHighContrast}
                  activeOpacity={0.7}
                >
                  <SunMoon size={13} color={highContrast ? '#0F172A' : '#FFFFFF'} style={{ marginRight: 3 }} />
                  <Text
                    style={[
                      styles.toolBtnToggleText,
                      highContrast && styles.toolBtnToggleTextActive,
                    ]}
                  >
                    Contrast
                  </Text>
                </TouchableOpacity>

                {/* Reading Ruler Toggle */}
                <TouchableOpacity
                  style={[
                    styles.toolBtnToggle,
                    readingRuler && styles.toolBtnToggleActive,
                  ]}
                  onPress={toggleReadingRuler}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.toolBtnToggleText,
                      readingRuler && styles.toolBtnToggleTextActive,
                    ]}
                  >
                    Ruler
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toolbarWrapper: {
    position: 'absolute',
    bottom: 74,
    left: 12,
    right: 12,
  },
  readingRulerGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readingRulerBand: {
    width: '100%',
    height: 52,
    backgroundColor: 'rgba(255, 245, 157, 0.45)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.7)',
  },
  toolbarCard: {
    backgroundColor: '#004F7A',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  toolbarHighContrast: {
    backgroundColor: '#000000',
    borderColor: '#FFFF00',
    borderWidth: 2,
  },
  minimizedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  a11yCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#00AEEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  a11yIconText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  toolbarContent: {
    flexDirection: 'column',
    gap: 8,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  a11yBadge: {
    backgroundColor: '#00AEEF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  a11yBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  toolbarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolIconBtn: {
    padding: 4,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  toolBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnDisabled: {
    opacity: 0.4,
  },
  toolBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  sizeIndicator: {
    paddingHorizontal: 4,
  },
  sizeIndicatorText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  toolBtnToggleActive: {
    backgroundColor: '#00AEEF',
  },
  toolBtnToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toolBtnToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
