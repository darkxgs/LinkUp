/**
 * Google Sign-In — Cloud Functions + إعدادات OAuth
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './index';

export type GoogleAuthConfig = {
  enabled: boolean;
  webClientId: string;
  androidClientId: string;
  iosClientId: string;
};

export type VerifyGoogleSignInResult = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  isNewUser: boolean;
};

let cachedConfig: GoogleAuthConfig | null = null;

export async function fetchGoogleAuthConfig(force = false): Promise<GoogleAuthConfig> {
  if (cachedConfig && !force) return cachedConfig;
  const fn = httpsCallable<void, GoogleAuthConfig>(functions, 'getGoogleAuthConfig');
  const res = await fn();
  cachedConfig = res.data;
  return res.data;
}

export async function verifyGoogleSignInOnServer(idToken: string): Promise<VerifyGoogleSignInResult> {
  const fn = httpsCallable<{ idToken: string }, VerifyGoogleSignInResult>(functions, 'verifyGoogleSignIn');
  const res = await fn({ idToken });
  return res.data;
}
