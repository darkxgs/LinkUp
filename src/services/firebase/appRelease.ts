/**
 * إصدار التطبيق التجريبي — Firestore: config/appRelease
 */
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from './index';

export interface AppReleaseConfig {
  enabled: boolean;
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  promptUpdate: boolean;
  forceUpdate: boolean;
  downloadUrl: string;
  landingUrl?: string;
  fileSizeBytes?: number;
  releaseNotesAr: string;
  releaseNotesEn: string;
  updateTitleAr: string;
  updateTitleEn: string;
  updateMessageAr: string;
  updateMessageEn: string;
  updatedAt: number;
}

export const DEFAULT_APP_RELEASE: AppReleaseConfig = {
  enabled: false,
  versionName: '1.0.0',
  versionCode: 1,
  minVersionCode: 1,
  promptUpdate: true,
  forceUpdate: false,
  downloadUrl: '',
  releaseNotesAr: '',
  releaseNotesEn: '',
  updateTitleAr: 'تحديث جديد متوفر',
  updateTitleEn: 'New update available',
  updateMessageAr: 'يوجد إصدار أحدث من التطبيق. حمّل التحديث للاستمرار بأفضل تجربة.',
  updateMessageEn: 'A newer version is available. Download the update for the best experience.',
  updatedAt: 0,
};

function mergeConfig(data: Partial<AppReleaseConfig> | undefined): AppReleaseConfig {
  if (!data) return DEFAULT_APP_RELEASE;
  return { ...DEFAULT_APP_RELEASE, ...data };
}

export const subscribeToAppRelease = (
  cb: (config: AppReleaseConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'appRelease');
  return onSnapshot(
    ref,
    (snap) => {
      cb(snap.exists() ? mergeConfig(snap.data() as Partial<AppReleaseConfig>) : DEFAULT_APP_RELEASE);
    },
    () => cb(DEFAULT_APP_RELEASE),
  );
};

export const getAppReleaseOnce = async (): Promise<AppReleaseConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'appRelease'));
    if (snap.exists()) return mergeConfig(snap.data() as Partial<AppReleaseConfig>);
  } catch {
    /* fallback */
  }
  return DEFAULT_APP_RELEASE;
};

export function getUpdatePageUrl(release: AppReleaseConfig): string {
  if (release.downloadUrl?.trim()) return release.downloadUrl.trim();
  if (release.landingUrl?.trim()) return release.landingUrl.trim();
  return '';
}

export type AppUpdateCheck = {
  required: boolean;
  optional: boolean;
  release: AppReleaseConfig;
};

export function evaluateAppUpdate(
  release: AppReleaseConfig,
  installedVersionCode: number,
): AppUpdateCheck {
  if (!release.enabled || !release.downloadUrl?.trim()) {
    return { required: false, optional: false, release };
  }
  if (installedVersionCode < release.minVersionCode) {
    return { required: true, optional: false, release };
  }
  if (release.forceUpdate && installedVersionCode < release.versionCode) {
    return { required: true, optional: false, release };
  }
  if (release.promptUpdate && installedVersionCode < release.versionCode) {
    return { required: false, optional: true, release };
  }
  return { required: false, optional: false, release };
}
