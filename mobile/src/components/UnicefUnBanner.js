import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Image } from 'expo-image';

export default function UnicefUnBanner({ onOpenUnicef, onOpenUnov }) {
  const handleUnicef = () => {
    if (onOpenUnicef) onOpenUnicef();
    else Linking.openURL('https://www.unicef.org/').catch(() => {});
  };

  const handleUnov = () => {
    if (onOpenUnov) onOpenUnov();
    else Linking.openURL('https://www.unov.org/').catch(() => {});
  };

  return (
    <View style={styles.bannerContainer}>
      {/* UNICEF Official White Logo */}
      <TouchableOpacity
        onPress={handleUnicef}
        activeOpacity={0.75}
        style={styles.logoTouch}
      >
        <Image
          source={require('../../assets/unicef-white-logo.svg')}
          style={styles.unicefLogo}
          contentFit="contain"
          transition={200}
        />
      </TouchableOpacity>

      {/* Subtle Vertical Divider */}
      <View style={styles.divider} />

      {/* UNOV (United Nations Office at Vienna) Official HD Logo */}
      <TouchableOpacity
        onPress={handleUnov}
        activeOpacity={0.75}
        style={styles.logoTouch}
      >
        <Image
          source={require('../../assets/unov-white-logo.svg')}
          style={styles.unovLogo}
          contentFit="contain"
          transition={200}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 18,
  },
  logoTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  unicefLogo: {
    width: 116,
    height: 28,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  unovLogo: {
    width: 172,
    height: 28,
  },
});
