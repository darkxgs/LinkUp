/**
 * أمير الوكلاء — وسام شهري لأكبر وكالة
 * Firestore: config/agencyPrince
 */
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';
import type { AgencyPrinceConfig } from './agencyPrinceTypes';

export {
  currentMonthKey,
  readUserAgencyPrince,
  isAgencyPrinceUser,
  resolveAgencyPrinceBadgeUrl,
  resolveAgencyPrinceBadgeForUser,
} from './agencyPrinceBadge';

export type {
  AgencyPrinceHolder,
  AgencyPrinceConfig,
  UserAgencyPrince,
} from './agencyPrinceTypes';

export const DEFAULT_AGENCY_PRINCE_CONFIG: AgencyPrinceConfig = {
  enabled: true,
  titleAr: 'أمير الوكلاء',
  titleEn: 'Prince of Agents',
  subtitleAr: 'للوكيل صاحب أكبر وكالة وأعلى أداء خلال الشهر',
  subtitleEn: 'For the agent with the top-performing agency this month',
  rulesAr: [
    'يُمنح أمير الوكلاء لصاحب الوكالة الأولى حسب أرباح المضيفين خلال الشهر.',
    'يشمل الوسام شارة مميزة ودخولية حصرية في غرف الوكالة.',
  ],
  rulesEn: [],
  badgeImageUrl: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
  crownImageUrl: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
  entryImageUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  accentColor: '#F59E0B',
  autoAssignMonthly: true,
  currentHolder: null,
};

export const subscribeToAgencyPrince = (
  cb: (config: AgencyPrinceConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'agencyPrince');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_AGENCY_PRINCE_CONFIG, ...(snap.data() as Partial<AgencyPrinceConfig>) });
      } else {
        cb(DEFAULT_AGENCY_PRINCE_CONFIG);
      }
    },
    () => cb(DEFAULT_AGENCY_PRINCE_CONFIG),
  );
};

export const getAgencyPrinceConfigOnce = async (): Promise<AgencyPrinceConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyPrince'));
    return snap.exists()
      ? ({ ...DEFAULT_AGENCY_PRINCE_CONFIG, ...(snap.data() as Partial<AgencyPrinceConfig>) })
      : DEFAULT_AGENCY_PRINCE_CONFIG;
  } catch {
    return DEFAULT_AGENCY_PRINCE_CONFIG;
  }
};
