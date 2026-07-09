/**
 * إعدادات «مايك المدير الثاني» — config/agencySecondHostMic (لوحة التحكم لاحقاً).
 * سعر شراء مقعد مدير ثانٍ للوكالة. افتراضي 2000 كوين (قابل للتعديل من الأدمن مستقبلاً).
 */
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from './index';

export interface SecondHostMicConfig {
  enabled: boolean;
  price: number;
}

export const DEFAULT_SECOND_HOST_MIC_CONFIG: SecondHostMicConfig = {
  enabled: true,
  price: 2000,
};

function parse(d: Record<string, unknown> | undefined): SecondHostMicConfig {
  if (!d) return DEFAULT_SECOND_HOST_MIC_CONFIG;
  return {
    enabled: d.enabled !== false,
    price: Number(d.price) || DEFAULT_SECOND_HOST_MIC_CONFIG.price,
  };
}

export function subscribeToSecondHostMicConfig(
  callback: (config: SecondHostMicConfig) => void,
): () => void {
  const ref = doc(firestore, 'config', 'agencySecondHostMic');
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? parse(snap.data()) : DEFAULT_SECOND_HOST_MIC_CONFIG),
    () => callback(DEFAULT_SECOND_HOST_MIC_CONFIG),
  );
}

export async function getSecondHostMicConfig(): Promise<SecondHostMicConfig> {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencySecondHostMic'));
    return snap.exists() ? parse(snap.data()) : DEFAULT_SECOND_HOST_MIC_CONFIG;
  } catch {
    return DEFAULT_SECOND_HOST_MIC_CONFIG;
  }
}
