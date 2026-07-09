import Constants from 'expo-constants';

/** رقم البناء المثبّت (Android versionCode / iOS build) */
export function getInstalledVersionCode(): number {
  const androidCode = Constants.expoConfig?.android?.versionCode;
  if (typeof androidCode === 'number' && androidCode > 0) return androidCode;

  const raw = Constants.nativeBuildVersion;
  const parsed = parseInt(String(raw ?? ''), 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  return 1;
}

export function getInstalledVersionName(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
