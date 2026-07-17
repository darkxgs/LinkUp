/**
 * LinkUp App — Firebase JS SDK
 * يعمل على Expo Go بدون prebuild
 * Connected to linkup-dc45f project
 */

import Constants from 'expo-constants';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth, type Persistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
import * as Firestore from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import { getFunctions, Functions } from 'firebase/functions';

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  databaseURL: extra.firebaseDatabaseURL,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
  measurementId: extra.firebaseMeasurementId,
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore.Firestore;
let storage: FirebaseStorage;
let realtimeDb: Database;
let functions: Functions;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
  firestore = Firestore.getFirestore(app);
  storage = getStorage(app);
  realtimeDb = getDatabase(app);
  functions = getFunctions(app, 'us-central1');
} else {
  app = getApp();
  auth = getAuth(app);
  firestore = Firestore.getFirestore(app);
  storage = getStorage(app);
  realtimeDb = getDatabase(app);
  functions = getFunctions(app, 'us-central1');
}

/** تجاهل أخطاء الصلاحيات بعد تسجيل الخروج — تمنع LogBox الأحمر */
function isExpectedLogoutFirestoreError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // نتجاهل الخطأ فقط عند عدم وجود جلسة (خروج فعلي). مع وجود مستخدم، الخطأ
  // حقيقي (قاعدة قديمة/غير منشورة مثلاً) — نمرّره بدل ابتلاعه، وإلا يبقى
  // مستمع مثل شاشة الإشعارات بلا نجاح ولا خطأ فتعلق الدوّارة للأبد.
  return (
    (code === 'permission-denied' || code === 'unauthenticated') &&
    !auth.currentUser
  );
}

function wrapFirestoreListenerError(onError?: (error: Error) => void): (error: Error) => void {
  return (error) => {
    if (isExpectedLogoutFirestoreError(error)) return;
    if (onError) onError(error);
  };
}

const nativeOnSnapshot = Firestore.onSnapshot;

function safeOnSnapshot(...args: unknown[]): ReturnType<typeof nativeOnSnapshot> {
  const call = nativeOnSnapshot as (...params: unknown[]) => ReturnType<typeof nativeOnSnapshot>;

  if (args.length === 2 && typeof args[1] === 'function') {
    const [ref, onNext] = args;
    return call(ref, onNext, wrapFirestoreListenerError());
  }

  if (args.length >= 3 && typeof args[1] === 'function') {
    const [ref, onNext, onError, onCompletion] = args;
    return call(
      ref,
      onNext,
      wrapFirestoreListenerError(onError as ((error: Error) => void) | undefined),
      onCompletion,
    );
  }

  if (args.length >= 2 && typeof args[1] === 'object' && args[1] !== null) {
    const observer = args[1] as { next?: (snap: unknown) => void; error?: (error: Error) => void; complete?: () => void };
    if (typeof observer.next === 'function') {
      const [ref, , onCompletion] = args;
      return call(
        ref,
        {
          ...observer,
          error: wrapFirestoreListenerError(observer.error),
        },
        onCompletion,
      );
    }
  }

  if (args.length >= 3 && typeof args[1] === 'object' && args[1] !== null && typeof args[2] === 'function') {
    const [ref, options, onNext, onError, onCompletion] = args;
    return call(
      ref,
      options,
      onNext,
      wrapFirestoreListenerError(onError as ((error: Error) => void) | undefined),
      onCompletion,
    );
  }

  return call(...args);
}

// يطبّق على كل import { onSnapshot } from 'firebase/firestore' في التطبيق
(Firestore as unknown as { onSnapshot: typeof nativeOnSnapshot }).onSnapshot =
  safeOnSnapshot as typeof nativeOnSnapshot;

export const onSnapshot = safeOnSnapshot;

export { isExpectedLogoutFirestoreError };

export { app, auth, firestore, storage, realtimeDb, functions };

export const verifyFirebaseConnection = async (): Promise<boolean> => {
  try {
    const ok = !!app && !!auth && !!firestore && !!realtimeDb;
    if (ok) {
      // اسم المشروع الحقيقي من الإعدادات — كان نصاً قديماً مضللاً من القالب الأصلي
      console.log(`✅ Firebase connected: ${app.options?.projectId ?? 'unknown'}`);
    }
    return ok;
  } catch (e) {
    console.error('Firebase verification failed:', e);
    return false;
  }
};

// Check if Firebase is properly configured
export const isFirebaseReady = (): boolean => {
  return (
    !!firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    firebaseConfig.apiKey.length > 20
  );
};
