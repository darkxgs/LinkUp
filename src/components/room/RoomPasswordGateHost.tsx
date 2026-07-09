import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoomPasswordGateModal } from '@/components/room/RoomPasswordGateModal';
import { useRoomEntryGateStore } from '@/stores/roomEntryGateStore';

/** موديل كلمة مرور الغرفة المقفلة — يظهر فوق أي شاشة قبل الدخول */
export function RoomPasswordGateHost() {
  const { t } = useTranslation();
  const visible = useRoomEntryGateStore((s) => s.visible);
  const room = useRoomEntryGateStore((s) => s.room);
  const passwordError = useRoomEntryGateStore((s) => s.passwordError);
  const submitPassword = useRoomEntryGateStore((s) => s.submitPassword);
  const cancel = useRoomEntryGateStore((s) => s.cancel);

  return (
    <RoomPasswordGateModal
      visible={visible}
      isAgencyRoom={Boolean(room?.isAgencyRoom || room?.agencyId)}
      error={passwordError ? t(passwordError) : ''}
      onSubmit={submitPassword}
      onCancel={cancel}
    />
  );
}
