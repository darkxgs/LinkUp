/**
 * HostTasksTracker — تتبع وقت الاتصال والتفاعل اليومي للمضيفة
 *
 * قاعدة العدّ: الوقت يُحتسب عندما يكون التطبيق بالمقدمة، **أو** عندما تكون
 * المستخدمة داخل غرفة حية — الجلسة الصوتية تبقى حية بالخدمة الأمامية حتى مع
 * قفل الشاشة/التبديل للخلفية، فهي فعلياً «متصلة». (كان العدّ يقف مع قفل
 * الشاشة رغم بقائها بالغرفة، ويصفّر الأساس عند العودة فترمى كل دقائق
 * الخلفية — 25 من 71 دقيقة فعلية.)
 *
 * كما يُرحَّل باقي الدقيقة بين النبضات: الأساس يتقدم بقدر ما احتُسب فقط —
 * floor مع تصفير الأساس كان يرمي حتى 59 ثانية كل نبضة/قفلة شاشة.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { trackHostOnlineMinutes } from '@/services/firebase/hostTasks';
import { canEarnHostTasks } from '@/utils/genderAccess';
import { useRoomSessionStore } from '@/stores/roomSessionStore';

const TICK_MS = 2 * 60 * 1000;

export function HostTasksTracker() {
  const { user } = useAuth();
  const lastTickRef = useRef(Date.now());
  const isActiveRef = useRef(AppState.currentState === 'active');
  // دقائق فشل تسجيلها (تعارض كتابة على وثيقة ساخنة) — تُرحَّل للنبضة التالية بدل الضياع
  const pendingMinutesRef = useRef(0);

  // يُعاد التقييم مع كل تحديث للمستخدم — كان الشرط داخل effect بمعتمدية uid
  // فقط، فلو وصل المستخدم قبل اكتمال ترطيب gender/isVerified لا يُركَّب
  // العدّاد أبداً طوال الجلسة
  const canEarn = !!user?.uid && canEarnHostTasks(user);

  useEffect(() => {
    if (!canEarn) return;

    const inLiveRoom = () => useRoomSessionStore.getState().roomId != null;
    const countable = () => isActiveRef.current || inLiveRoom();

    const tick = () => {
      if (!countable()) return;
      const now = Date.now();
      const elapsedMin = Math.floor((now - lastTickRef.current) / 60_000);
      // الأساس يتقدم بالمحتسب فقط — الباقي (<60ث) يُستكمل بالنبضة التالية
      lastTickRef.current += elapsedMin * 60_000;
      const total = elapsedMin + pendingMinutesRef.current;
      if (total >= 1) {
        pendingMinutesRef.current = 0;
        void trackHostOnlineMinutes(total, false).catch(() => {
          pendingMinutesRef.current += total;
        });
      }
    };

    lastTickRef.current = Date.now();
    const iv = setInterval(tick, TICK_MS);

    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      if (active && !isActiveRef.current) {
        // العودة للمقدمة: خارج الغرفة وقتُ الخلفية غير محسوب فنعيد الأساس؛
        // داخل الغرفة يبقى الأساس كما هو فيُحتسب وقت الخلفية كاملاً
        if (!inLiveRoom()) lastTickRef.current = Date.now();
      } else if (!active && isActiveRef.current) {
        tick();
      }
      isActiveRef.current = active;
    });

    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [user?.uid, canEarn]);

  return null;
}
