/**
 * DeferredMount — يؤجّل تركيب الأبناء حتى ينتهي أول إطار وتفاعلات البدء.
 *
 * الفائدة: المكوّنات الخلفية (heartbeat، بانرات، حُرّاس، مستمعو FCM…) تفتح
 * شبكة/اشتراكات فور تركيبها. تأجيلها لبضع لحظات بعد ظهور أول شاشة يجعل
 * التطبيق يُعرض ويصبح قابلاً للتصفّح فوراً بدل أن يتزاحم كل شيء عند الإقلاع.
 *
 * الاستخدام:
 *   <DeferredMount><UserHeartbeat /></DeferredMount>
 *   <DeferredMount delay={1500}><BroadcastBanner /></DeferredMount>
 */

import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

export const DeferredMount: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 600,
}) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // ننتظر انتهاء تفاعلات/أنيميشن البدء ثم مهلة صغيرة إضافية
    const handle = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setReady(true), delay);
    });
    return () => {
      handle.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, [delay]);

  if (!ready) return null;
  return <>{children}</>;
};
