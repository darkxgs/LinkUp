/**
 * Social Auth — تسجيل الدخول عبر Google / Facebook / Phone
 *
 * يستخدم expo-auth-session (OAuth web flow) + Firebase Auth credentials.
 * يعمل في development build وفي production build.
 *
 * ⚠️ متطلبات الإعداد قبل التشغيل:
 *
 *  Google:
 *   1) Firebase Console → Authentication → Sign-in method → Google → فعّل
 *   2) Google Cloud Console → APIs & Credentials → أنشئ OAuth Client IDs:
 *      - Web Client ID (للاستخدام مع Firebase)
 *      - Android Client ID (يحتاج SHA-1 من EAS)
 *      - iOS Client ID
 *   3) ضع المعرّفات في app.json → extra.googleAuth
 *
 *  Facebook:
 *   1) Firebase Console → فعّل Facebook
 *   2) developers.facebook.com → أنشئ تطبيق → احصل على App ID
 *   3) ضعه في app.json → extra.facebookAppId
 *
 *  Phone:
 *   1) Firebase Console → فعّل Phone Auth
 *   2) أضف SHA-1 لـ Firebase project (للأندرويد)
 *
 * (حتى يكتمل الإعداد، التطبيق يعرض رسالة إرشادية بدل أن يفشل صامتاً)
 */

import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import {
  signInWithCredential,
  linkWithCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from '@firebase/auth';
import Constants from 'expo-constants';
import { auth, firestore } from './firebase/index';
import { fetchGoogleAuthConfig, verifyGoogleSignInOnServer } from './firebase/googleAuth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// إكمال الجلسة عند العودة من المتصفّح
WebBrowser.maybeCompleteAuthSession();

type GoogleAuthExtra = {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
};

const localGoogleConfig: GoogleAuthExtra =
  (Constants.expoConfig?.extra as { googleAuth?: GoogleAuthExtra })?.googleAuth ?? {};

let remoteGoogleConfig: GoogleAuthExtra | null = null;

export async function loadGoogleAuthConfig(): Promise<GoogleAuthExtra> {
  if (remoteGoogleConfig?.webClientId) return remoteGoogleConfig;
  try {
    const remote = await fetchGoogleAuthConfig();
    if (remote.enabled && remote.webClientId) {
      remoteGoogleConfig = {
        webClientId: remote.webClientId,
        androidClientId: remote.androidClientId,
        iosClientId: remote.iosClientId,
      };
      return remoteGoogleConfig;
    }
  } catch {
    // fallback محلي
  }
  return localGoogleConfig;
}

export function getLocalGoogleAuthConfig(): GoogleAuthExtra {
  return remoteGoogleConfig ?? localGoogleConfig;
}

const facebookAppId = (Constants.expoConfig?.extra as any)?.facebookAppId ?? '';

export const isGoogleAuthConfigured = (): boolean => {
  const cfg = getLocalGoogleAuthConfig();
  return Boolean(cfg.webClientId) && Boolean(cfg.iosClientId || cfg.androidClientId);
};

export const isFacebookAuthConfigured = (): boolean => Boolean(facebookAppId);

// Google Sign-In Hook
// =========================================================
/**
 * استخدامه في الشاشة:
 *   const { promptGoogleSignIn, isReady } = useGoogleSignIn();
 *   <Button onPress={promptGoogleSignIn} disabled={!isReady} />
 */
function useGoogleSignInActive() {
  const cfg = getLocalGoogleAuthConfig();
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: cfg.webClientId,
    iosClientId: cfg.iosClientId,
    androidClientId: cfg.androidClientId,
  });

  const promptGoogleSignIn = async () => {
    const googleConfig = await loadGoogleAuthConfig();
    if (!googleConfig.webClientId) {
      throw new Error(
        'لم يتم إعداد Google Sign-In — شغّل scripts/setup-google-auth.mjs ثم انشر Cloud Functions',
      );
    }
    const result = await promptAsync();
    if (result.type !== 'success') {
      throw new Error(
        result.type === 'cancel'
          ? 'ألغى المستخدم تسجيل الدخول'
          : 'فشل تسجيل الدخول بـ Google',
      );
    }
    const idToken = result.authentication?.idToken;
    const accessToken = result.authentication?.accessToken;
    if (!idToken && !accessToken) {
      throw new Error('لم يتم استلام التوكن من Google');
    }
    if (!idToken) {
      throw new Error('Google idToken مطلوب — تأكد من إعداد webClientId');
    }

    await verifyGoogleSignInOnServer(idToken);

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const userCred = await signInWithCredential(auth, credential);
    await ensureUserDoc(userCred.user);
    void import('@/services/loginSession').then((m) => m.recordLoginSession('google'));
    return userCred.user;
  };

  return { promptGoogleSignIn, isReady: !!request && !!cfg.webClientId };
}

export const useGoogleSignIn = () => useGoogleSignInActive();

/** ربط Google بحساب مسجّل الدخول حالياً */
function useGoogleAccountLinkActive() {
  const cfg = getLocalGoogleAuthConfig();
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: cfg.webClientId,
    iosClientId: cfg.iosClientId,
    androidClientId: cfg.androidClientId,
  });

  const linkGoogleAccount = async () => {
    const googleConfig = await loadGoogleAuthConfig();
    if (!googleConfig.webClientId) {
      throw new Error(
        'لم يتم إعداد Google Sign-In — شغّل scripts/setup-google-auth.mjs',
      );
    }
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('يجب تسجيل الدخول أولاً');

    const result = await promptAsync();
    if (result.type !== 'success') {
      throw new Error(
        result.type === 'cancel' ? 'ألغى المستخدم الربط' : 'فشل ربط Google',
      );
    }
    const idToken = result.authentication?.idToken;
    const accessToken = result.authentication?.accessToken;
    if (!idToken && !accessToken) throw new Error('لم يتم استلام التوكن من Google');

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    await linkWithCredential(fbUser, credential);
    await setDoc(
      doc(firestore, 'users', fbUser.uid),
      { linkedGoogle: true, updatedAt: Date.now() },
      { merge: true },
    );
  };

  return { linkGoogleAccount, isReady: !!request };
}

export const useGoogleAccountLink = () => useGoogleAccountLinkActive();

// =========================================================
// Facebook Sign-In Hook
// =========================================================
function useFacebookSignInActive() {
  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: facebookAppId,
  });

  const promptFacebookSignIn = async () => {
    if (!facebookAppId) {
      throw new Error(
        'لم يتم إعداد Facebook Sign-In بعد — راجع التعليمات في social-auth.ts',
      );
    }
    const result = await promptAsync();
    if (result.type !== 'success') {
      throw new Error(
        result.type === 'cancel'
          ? 'ألغى المستخدم تسجيل الدخول'
          : 'فشل تسجيل الدخول بـ Facebook',
      );
    }
    const accessToken = result.authentication?.accessToken;
    if (!accessToken) throw new Error('لم يتم استلام التوكن من Facebook');

    const credential = FacebookAuthProvider.credential(accessToken);
    const userCred = await signInWithCredential(auth, credential);
    await ensureUserDoc(userCred.user);
    void import('@/services/loginSession').then((m) => m.recordLoginSession('facebook'));
    return userCred.user;
  };

  return { promptFacebookSignIn, isReady: !!request };
}

export const useFacebookSignIn = () => useFacebookSignInActive();

/** ربط Facebook بحساب مسجّل الدخول حالياً */
function useFacebookAccountLinkActive() {
  const [request, , promptAsync] = Facebook.useAuthRequest({
    clientId: facebookAppId,
  });

  const linkFacebookAccount = async () => {
    if (!facebookAppId) {
      throw new Error(
        'لم يتم إعداد Facebook Sign-In بعد — راجع التعليمات في social-auth.ts',
      );
    }
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('يجب تسجيل الدخول أولاً');

    const result = await promptAsync();
    if (result.type !== 'success') {
      throw new Error(
        result.type === 'cancel' ? 'ألغى المستخدم الربط' : 'فشل ربط Facebook',
      );
    }
    const accessToken = result.authentication?.accessToken;
    if (!accessToken) throw new Error('لم يتم استلام التوكن من Facebook');

    const credential = FacebookAuthProvider.credential(accessToken);
    await linkWithCredential(fbUser, credential);
    await setDoc(
      doc(firestore, 'users', fbUser.uid),
      { linkedFacebook: true, updatedAt: Date.now() },
      { merge: true },
    );
  };

  return { linkFacebookAccount, isReady: !!request };
}

export const useFacebookAccountLink = () => useFacebookAccountLinkActive();

// =========================================================
// Phone Sign-In
// =========================================================
/**
 * إرسال رمز SMS لرقم هاتف.
 * يُعيد ConfirmationResult لتأكيد الرمز لاحقاً.
 *
 * ⚠️ في React Native + Firebase JS SDK، Phone Auth يحتاج reCAPTCHA verifier.
 * الحل الأبسط: استخدم Firebase Phone Auth عبر expo-firebase-recaptcha
 * أو الانتقال لـ @react-native-firebase/auth الذي يدعمه نتيف.
 *
 * هنا نوفّر هيكل الدالة — الإعداد الكامل يتطلب recaptcha modal.
 */
export const sendPhoneVerification = async (
  phoneNumber: string,
  recaptchaVerifier: any,
): Promise<ConfirmationResult> => {
  if (!recaptchaVerifier) {
    throw new Error('reCAPTCHA verifier مطلوب — أضف <FirebaseRecaptchaVerifierModal />');
  }
  // signInWithPhoneNumber متاح في Firebase JS SDK مع recaptcha
  const confirmation = await signInWithPhoneNumber(
    auth,
    phoneNumber,
    recaptchaVerifier,
  );
  return confirmation;
};

export const verifyPhoneCode = async (
  confirmation: ConfirmationResult,
  code: string,
) => {
  const userCred = await confirmation.confirm(code);
  await ensureUserDoc(userCred.user);
  return userCred.user;
};

// =========================================================
// إنشاء/تحديث وثيقة المستخدم بعد تسجيل دخول اجتماعي
// =========================================================
async function ensureUserDoc(user: any) {
  if (!user?.uid) return;
  const ref = doc(firestore, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initialStats = {
      coins: 0,
      pearls: 0,
      casinoCoins: 0,
      level: 1,
      xp: 0,
      followers: 0,
      following: 0,
      visitors: 0,
      totalRoomsCreated: 0,
    };
    // مستخدم جديد — بدون أي رصيد ابتدائي
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? 'مستخدم',
      avatar: user.photoURL ?? '',
      provider: user.providerData?.[0]?.providerId ?? 'unknown',
      createdAt: Date.now(),
      lastSeen: serverTimestamp(),
      stats: initialStats,
      ...initialStats,
    });
  } else {
    // مستخدم موجود — حدّث lastSeen
    await setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true });
  }
}
