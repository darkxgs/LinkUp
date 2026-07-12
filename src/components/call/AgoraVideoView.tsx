/**
 * عرض فيديو مكالمة Agora — RtcSurfaceView بتحميل كسول
 *
 * استثناء مقنن: استيراد react-native-agora مسموح في هذا الملف فقط إلى
 * جانب agoraEngine.ts، وبشرط ألا يُقيَّم الموديول إلا عند أول رندر فعلي
 * لفيديو Agora (import ديناميكي داخل useEffect) — الـAPK المنشور عند
 * المستخدمين (علم livekit) لا يمر من هنا أبداً فلا يُقيَّم الموديول الأصلي
 * ولا ينكسر الإقلاع (نفس قاعدة التحميل الكسول في agoraEngine).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';

type AgoraModule = typeof import('react-native-agora');

/** كاش الموديول بعد أول تحميل — العروض التالية ترندر فوراً بلا وميض */
let cachedAgoraModule: AgoraModule | null = null;

interface Props {
  /** uid الرقمي من المحرك (numericUidFor) — المحلي دائماً 0 */
  uid: number;
  local: boolean;
  style?: ViewStyle;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
}

export function AgoraVideoView({ uid, local, style, mirror, objectFit = 'cover' }: Props) {
  const [mod, setMod] = useState<AgoraModule | null>(cachedAgoraModule);

  useEffect(() => {
    if (mod) return;
    let mounted = true;
    void import('react-native-agora')
      .then((m) => {
        cachedAgoraModule = m;
        if (mounted) setMod(m);
      })
      .catch(() => {
        // الموديول الأصلي غير متوفر (بيئة قديمة) — لا عرض فيديو، الصوت يستمر
      });
    return () => {
      mounted = false;
    };
  }, [mod]);

  if (!mod) return null;

  const { RtcSurfaceView, RenderModeType, VideoMirrorModeType, VideoSourceType } = mod;
  return (
    <RtcSurfaceView
      style={style ? { ...StyleSheet.absoluteFillObject, ...style } : StyleSheet.absoluteFillObject}
      // العرض المحلي (PiP) فوق عرض بعيد ملء الشاشة — على أندرويد لا يظهر
      // SurfaceView فوق آخر بدون هذا العلم
      zOrderMediaOverlay={local}
      canvas={{
        uid: local ? 0 : uid,
        ...(local ? { sourceType: VideoSourceType.VideoSourceCamera } : {}),
        renderMode:
          objectFit === 'contain'
            ? RenderModeType.RenderModeFit
            : RenderModeType.RenderModeHidden,
        // بلا mirror صريح نترك Auto: أمامية محلية معكوسة افتراضياً والبعيد لا
        mirrorMode: mirror
          ? VideoMirrorModeType.VideoMirrorModeEnabled
          : VideoMirrorModeType.VideoMirrorModeAuto,
      }}
    />
  );
}
