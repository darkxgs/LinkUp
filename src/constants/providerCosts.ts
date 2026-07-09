export interface ProviderCosts {
  agoraVoicePerMin: number;
  agoraVideoPerMin: number;
  livekitPerMin: number;
  currency: string;
}

export const DEFAULT_PROVIDER_COSTS: ProviderCosts = {
  agoraVoicePerMin: 0.004,
  agoraVideoPerMin: 0.015,
  livekitPerMin: 0.003,
  currency: 'USD',
};
