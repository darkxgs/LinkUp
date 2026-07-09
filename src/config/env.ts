/**
 * Sada App — Environment Configuration
 * Type-safe access to environment variables
 */

import Constants from 'expo-constants';

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? Constants.expoConfig?.extra?.[key] ?? fallback;
  if (!value) {
    if (__DEV__) {
      console.warn(`⚠️ Missing env variable: ${key}`);
    }
    return '';
  }
  return value;
};

export const env = {
  // App
  isDevelopment: process.env.EXPO_PUBLIC_ENV === 'development' || __DEV__,
  isStaging: process.env.EXPO_PUBLIC_ENV === 'staging',
  isProduction: process.env.EXPO_PUBLIC_ENV === 'production',
  
  // Firebase
  firebase: {
    apiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
    databaseURL: getEnv('EXPO_PUBLIC_FIREBASE_DATABASE_URL'),
    measurementId: getEnv('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  },
  
  // Cloud Functions
  functionsRegion: getEnv('EXPO_PUBLIC_FUNCTIONS_REGION', 'us-central1'),
  
  // EAS
  easProjectId: getEnv('EAS_PROJECT_ID'),
  
  // App Check
  appCheck: {
    debugTokenIOS: getEnv('EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN_IOS'),
    debugTokenAndroid: getEnv('EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN_ANDROID'),
  },
  
  // Optional services
  sentryDSN: getEnv('EXPO_PUBLIC_SENTRY_DSN'),
  mixpanelToken: getEnv('EXPO_PUBLIC_MIXPANEL_TOKEN'),
} as const;
