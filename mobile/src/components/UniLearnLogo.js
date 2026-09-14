import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { navigationRef } from '../navigation/navigationRef';

export default function UniLearnLogo({ size = 36, showMaharashtra = true, onOpenDashboard, darkBg = false, pill = false, navigation }) {
  const height = size;
  // Aspect ratio of the original graphic is 212:56
  const imageWidth = (height / 56) * 212;

  const handleOpenDashboard = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (hErr) {}

    if (onOpenDashboard) {
      onOpenDashboard();
      return;
    }
    // 100% Native In-App Navigation to Maharashtra State Dashboard
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate('MaharashtraDashboard');
        return;
      }
      if (navigationRef && navigationRef.isReady && navigationRef.isReady()) {
        navigationRef.navigate('MaharashtraDashboard');
        return;
      }
    } catch (e) {
      console.warn('In-app navigation to MaharashtraDashboard note:', e);
    }

    // Direct redirect fallback
    Linking.openURL('https://mh.unilearn.org.in/dashboard/').catch(() => {});
  };

  const isPill = darkBg || pill;

  return (
    <View style={[styles.container, isPill && styles.pillContainer]}>
      <Image
        source={require('../../assets/unilearn-logo.png')}
        style={{ width: imageWidth, height: height, resizeMode: 'contain' }}
      />

      {showMaharashtra && (
        <View style={styles.mhContainer}>
          <View style={[styles.divider, isPill ? styles.dividerLight : null, { height: size * 0.85 }]} />
          <View style={styles.maharashtraCol}>
            <Text style={[styles.mhText, isPill ? styles.mhTextPill : (darkBg ? styles.mhTextDark : null), { fontSize: Math.round(size * 0.44) }]}>
              MAHARASHTRA
            </Text>
            <TouchableOpacity
              style={[
                styles.dashPill,
                {
                  paddingHorizontal: Math.max(6, Math.round(size * 0.18)),
                  paddingVertical: Math.max(2, Math.round(size * 0.05)),
                },
              ]}
              onPress={handleOpenDashboard}
              activeOpacity={0.65}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.dashText, { fontSize: Math.round(size * 0.32) }]}>DASHBOARD</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    height: 36,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  mhContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  divider: {
    width: 1.5,
    backgroundColor: '#94A3B8',
  },
  dividerLight: {
    backgroundColor: '#CBD5E1',
  },
  maharashtraCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  mhText: {
    fontWeight: '900',
    color: '#004F7A',
    letterSpacing: 0.5,
  },
  mhTextPill: {
    color: '#004F7A',
  },
  mhTextDark: {
    color: '#FFFFFF',
  },
  dashPill: {
    backgroundColor: '#00AEEF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: '#00AEEF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  dashText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

