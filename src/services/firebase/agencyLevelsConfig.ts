/**
 * إعدادات مستويات الوكالة من Firestore — config/agencyLevels
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';
import {
  resolveAgencyLevelsConfig,
  type AgencyLevelsRuntimeConfig,
} from '@/services/agencyLevels';

export type AgencyLevelsConfigDoc = AgencyLevelsRuntimeConfig;

const DEFAULT = resolveAgencyLevelsConfig();

export function subscribeToAgencyLevelsConfig(
  callback: (config: AgencyLevelsRuntimeConfig) => void,
): () => void {
  const ref = doc(firestore, 'config', 'agencyLevels');
  return onSnapshot(
    ref,
    (snap) => {
      callback(resolveAgencyLevelsConfig(snap.exists() ? (snap.data() as AgencyLevelsConfigDoc) : null));
    },
    () => callback(DEFAULT),
  );
}

export { DEFAULT as DEFAULT_AGENCY_LEVELS_CONFIG };
