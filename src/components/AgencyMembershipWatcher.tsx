/**
 * عند إزالة المستخدم من الوكالة (أو مغادرته) يختفي agencyId من وثيقة المستخدم.
 * نعرض تنبيهاً فورياً حتى لا يعتمد فقط على جرس الإشعارات.
 *
 * المغادرة الطوعية من الـHub تعرض تنبيه نجاح خاص — نكتم هذا الـwatcher مرة واحدة.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/components/ui';

let suppressRemovalAlertUntil = 0;

/** استدعِ قبل leaveMyAgency / بعد نجاح المغادرة لتفادي تنبيه مزدوج */
export function suppressNextAgencyRemovalAlert(ms = 8000): void {
  suppressRemovalAlertUntil = Date.now() + ms;
}

export function AgencyMembershipWatcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const prevAgencyIdRef = useRef<string | null | undefined>(undefined);
  const isAr = i18n.language?.startsWith('ar') === true;

  useEffect(() => {
    const nextId = user?.agencyId ? String(user.agencyId) : null;
    const prevId = prevAgencyIdRef.current;

    // أول قراءة بعد الإقلاع — لا تنبيه (تجنب إنذار كاذب عند استعادة الجلسة)
    if (prevId === undefined) {
      prevAgencyIdRef.current = nextId;
      return;
    }

    prevAgencyIdRef.current = nextId;

    // تسجيل الخروج يصفّر المستخدم — ليس مغادرة وكالة
    if (!user?.uid) return;

    if (prevId && !nextId) {
      if (Date.now() < suppressRemovalAlertUntil) return;
      showAlert({
        type: 'info',
        title: isAr ? 'الوكالة' : 'Agency',
        message: isAr
          ? 'لم تعد عضواً في الوكالة. تحقق من الإشعارات للتفاصيل.'
          : 'You are no longer a member of the agency. Check notifications for details.',
      });
    }
  }, [user?.agencyId, user?.uid, showAlert, isAr]);

  return null;
}
