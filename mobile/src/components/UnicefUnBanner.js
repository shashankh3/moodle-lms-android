import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

export default function UnicefUnBanner() {
  return (
    <View style={styles.bannerContainer}>
      <Image
        source={require('../../assets/unicef-un-banner.png')}
        style={styles.bannerImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
