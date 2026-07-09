import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuActionSheet, type ActionSheetConfig } from '@/components/ui/LuActionSheet';
import { SECOND_HOST_SEAT_INDEX } from '@/services/firebase/roomSeats';

type Props = {
  visible: boolean;
  seatIdx: number;
  locked: boolean;
  onClose: () => void;
  onTakeMic: () => void;
  onToggleLock?: () => void;
  onInvite?: () => void;
  /** إخفاء «أخذ المايك» — لمقعد المدير الثاني عندما المستخدم غير مؤهل */
  hideTakeMic?: boolean;
};

export function AgencyEmptySeatSheet({
  visible,
  seatIdx,
  locked,
  onClose,
  onTakeMic,
  onToggleLock,
  onInvite,
  hideTakeMic = false,
}: Props) {
  const { t } = useTranslation();
  const isSecondHost = seatIdx === SECOND_HOST_SEAT_INDEX;

  const config = useMemo<ActionSheetConfig>(
    () => ({
      title: isSecondHost
        ? t('room.secondHostSeatSheetTitle')
        : t('room.emptySeatSheetTitle', { seat: seatIdx }),
      message: locked
        ? isSecondHost
          ? t('room.secondHostSeatSheetLockedHint')
          : t('room.emptySeatSheetLockedHint')
        : isSecondHost
          ? t('room.secondHostSeatSheetHint')
          : t('room.emptySeatSheetHint'),
      buttons: [
        ...(!hideTakeMic
          ? [
              {
                text: isSecondHost
                  ? t('room.secondHostSeatTake')
                  : t('room.emptySeatTakeMic'),
                onPress: onTakeMic,
              },
            ]
          : []),
        ...(onToggleLock
          ? [
              {
                text: locked ? t('room.emptySeatUnlock') : t('room.emptySeatLock'),
                onPress: onToggleLock,
              },
            ]
          : []),
        ...(onInvite
          ? [
              {
                text: isSecondHost ? t('room.secondHostSeatInvite') : t('room.emptySeatInvite'),
                onPress: onInvite,
              },
            ]
          : []),
        { text: t('common.cancel'), style: 'cancel' },
      ],
    }),
    [hideTakeMic, isSecondHost, locked, onInvite, onTakeMic, onToggleLock, seatIdx, t],
  );

  return <LuActionSheet visible={visible} config={config} onClose={onClose} />;
}
