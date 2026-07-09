/**
 * توجيه صوت LiveKit — سماعة سلكية / بلوتوث قبل السبيكر
 */
import { Platform } from 'react-native';

import { ensureLiveKitGlobals } from '@/services/livekitNative';

export type LiveKitAudioSession = Awaited<ReturnType<typeof ensureLiveKitGlobals>>;
export type CommunicationAudioMode = 'room' | 'voice' | 'video';

const ANDROID_AUDIO_TYPE = {
  manageAudioFocus: true,
  audioMode: 'inCommunication',
  audioFocusMode: 'gain',
  audioStreamType: 'voiceCommunication',
  audioAttributesUsageType: 'voiceCommunication',
  audioAttributesContentType: 'speech',
} as const;

/** ترتيب LiveKit الافتراضي — السماعة السلكية/البلوتوث قبل السبيكر */
const PREFERRED_OUTPUT_LIST = ['bluetooth', 'headset', 'speaker', 'earpiece'] as const;

export function getCommunicationAudioConfig(
  mode: CommunicationAudioMode,
  preferSpeaker: boolean,
) {
  const iosDefaultOutput = preferSpeaker ? 'speaker' : 'earpiece';
  const iosAudioMode =
    mode === 'video' ? 'videoChat' : mode === 'voice' ? 'voiceChat' : 'videoChat';

  return {
    android: {
      preferredOutputList: [...PREFERRED_OUTPUT_LIST],
      audioTypeOptions: { ...ANDROID_AUDIO_TYPE } as any,
    },
    ios: {
      defaultOutput: iosDefaultOutput,
      audioCategory: 'playAndRecord',
      audioMode: iosAudioMode,
      // بدون defaultToSpeaker — iOS يوجّه تلقائياً للسماعة السلكية عند التوصيل
      audioCategoryOptions: ['allowBluetooth', 'allowBluetoothA2DP'],
    } as any,
  };
}

/**
 * يختار أفضل مخرج صوت: سماعة سلكية/بلوتوث أولاً، ثم سبيكر أو سماعة الأذن حسب التفضيل.
 * على iOS: `default` يحترم السماعة السلكية؛ `forceSpeaker` فقط عند تفعيل السبيكر يدوياً.
 */
export async function applyBestAudioOutput(
  AudioSession: LiveKitAudioSession,
  preferSpeaker: boolean,
  forceSpeaker = false,
): Promise<void> {
  if (Platform.OS === 'ios') {
    await AudioSession.selectAudioOutput(forceSpeaker ? 'force_speaker' : 'default');
    return;
  }

  const outputs = await AudioSession.getAudioOutputs().catch(() => [] as string[]);
  if (outputs.includes('headset')) {
    await AudioSession.selectAudioOutput('headset');
    return;
  }
  if (outputs.includes('bluetooth')) {
    await AudioSession.selectAudioOutput('bluetooth');
    return;
  }
  if (preferSpeaker && outputs.includes('speaker')) {
    await AudioSession.selectAudioOutput('speaker');
    return;
  }
  if (!preferSpeaker && outputs.includes('earpiece')) {
    await AudioSession.selectAudioOutput('earpiece');
    return;
  }
  if (outputs.includes('speaker')) {
    await AudioSession.selectAudioOutput('speaker');
    return;
  }
  await AudioSession.selectAudioOutput('default');
}

type RouteWatcherOptions = {
  getPreferSpeaker: () => boolean;
  getForceSpeaker?: () => boolean;
  onApply: (preferSpeaker: boolean, forceSpeaker: boolean) => Promise<void>;
};

let watcherCount = 0;
let watcherOptions: RouteWatcherOptions | null = null;
let devicesUpdatedListener: (() => void) | null = null;
let androidPollTimer: ReturnType<typeof setInterval> | null = null;
let lastAndroidOutputsKey = '';

async function reapplyAudioRoute(): Promise<void> {
  const opts = watcherOptions;
  if (!opts) return;
  const preferSpeaker = opts.getPreferSpeaker();
  const forceSpeaker = opts.getForceSpeaker?.() ?? false;
  if (Platform.OS === 'ios') {
    // عند توصيل/فصل سماعة: default يوجّه تلقائياً للسماعة السلكية
    try {
      const AudioSession = await ensureLiveKitGlobals();
      await AudioSession.selectAudioOutput('default');
    } catch {
      // ignore
    }
    return;
  }
  await opts.onApply(preferSpeaker, forceSpeaker);
}

function outputsKey(outputs: string[]): string {
  return [...outputs].sort().join('|');
}

function startAndroidOutputPoll(): void {
  if (Platform.OS !== 'android' || androidPollTimer) return;
  androidPollTimer = setInterval(() => {
    void (async () => {
      try {
        const AudioSession = await ensureLiveKitGlobals();
        const outputs = await AudioSession.getAudioOutputs().catch(() => [] as string[]);
        const key = outputsKey(outputs);
        if (key === lastAndroidOutputsKey) return;
        lastAndroidOutputsKey = key;
        await reapplyAudioRoute();
      } catch {
        // ignore
      }
    })();
  }, 1500);
}

function stopAndroidOutputPoll(): void {
  if (androidPollTimer) {
    clearInterval(androidPollTimer);
    androidPollTimer = null;
  }
  lastAndroidOutputsKey = '';
}

/** يستمع لتغيّر أجهزة الصوت (توصيل/فصل سماعة) ويعيد توجيه الصوت */
export function startAudioRouteWatcher(options: RouteWatcherOptions): () => void {
  watcherCount += 1;
  watcherOptions = options;

  if (!devicesUpdatedListener) {
    devicesUpdatedListener = () => {
      void reapplyAudioRoute();
    };

    void import('@livekit/react-native')
      .then((mod) => {
        mod.audioDeviceModuleEvents?.addDevicesUpdatedListener?.(devicesUpdatedListener!);
      })
      .catch(() => {});

    startAndroidOutputPoll();
  }

  return () => stopAudioRouteWatcher();
}

export function stopAudioRouteWatcher(): void {
  watcherCount = Math.max(0, watcherCount - 1);
  if (watcherCount > 0) return;

  if (devicesUpdatedListener) {
    void import('@livekit/react-native')
      .then((mod) => {
        mod.audioDeviceModuleEvents?.removeDevicesUpdatedListener?.(devicesUpdatedListener!);
      })
      .catch(() => {});
    devicesUpdatedListener = null;
  }

  stopAndroidOutputPoll();
  watcherOptions = null;
}
