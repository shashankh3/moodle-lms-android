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
      {/* Left Column (UNICEF) - exactly 50% */}
      <View style={styles.logoColumn}>
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
      </View>

      {/* Right Column (UNOV) - exactly 50% */}
      <View style={styles.logoColumn}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  logoColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  unicefLogo: {
    width: 105,
    height: 25,
  },
  unovLogo: {
    width: 148,
    height: 24,
  },
});
