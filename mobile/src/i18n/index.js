import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

const LANGUAGE_KEY = '@app_language';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const savedDataJSON = await AsyncStorage.getItem(LANGUAGE_KEY);
      const lng = savedDataJSON ? savedDataJSON : 'en';
      callback(lng);
    } catch (error) {
      console.log('Error reading language', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch (error) {
      console.log('Error saving language', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: en,
      hi: hi,
      mr: mr,
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
