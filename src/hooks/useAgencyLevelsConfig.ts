import { useEffect, useState } from 'react';
import {
  resolveAgencyLevelsConfig,
  type AgencyLevelsRuntimeConfig,
} from '@/services/agencyLevels';
import { subscribeToAgencyLevelsConfig } from '@/services/firebase/agencyLevelsConfig';

export function useAgencyLevelsConfig(): AgencyLevelsRuntimeConfig {
  const [config, setConfig] = useState<AgencyLevelsRuntimeConfig>(() =>
    resolveAgencyLevelsConfig(),
  );

  useEffect(() => subscribeToAgencyLevelsConfig(setConfig), []);

  return config;
}
