import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

export async function registerForPushNotificationsAsync() {
  // Remote push notifications were removed from Expo Go on Android in SDK 53+.
  // Calling or importing expo-notifications in Expo Go causes a fatal crash.
  if (isRunningInExpoGo()) {
    console.log('[PushNotificationService] Running in Expo Go: remote push notifications disabled.');
    return null;
  }

  let Notifications;
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn('[PushNotificationService] Could not load expo-notifications:', e);
    return null;
  }

  let token = null;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (e) {
      console.warn('[PushNotificationService] Failed to set notification channel:', e);
    }
  }

  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      // Moodle AirNotifier expects native FCM/APNs token, not the Expo token
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData?.data;
    } catch (e) {
      console.warn("Could not get device push token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export function getDeviceInfo() {
  return {
    appid: 'com.moodle.lms.app',
    name: Device.deviceName || 'Expo Device',
    model: Device.modelName || 'Unknown Model',
    platform: Platform.OS,
    version: Device.osVersion || 'Unknown',
    uuid: Device.osBuildId || Device.deviceName || 'unknown-uuid',
  };
}
