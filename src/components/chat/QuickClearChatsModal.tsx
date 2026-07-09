/**
 * QuickClearChatsModal — مسح سريع للمحادثات القديمة
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { quickClearOldChatMessages, type QuickClearDays } from '@/services/firebase/chat';
import { lu } from '@/theme/lu-brand';

const OPTIONS: QuickClearDays[] = [4, 14, 21, 90];

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone?: (cleared: number) => void;
}

export function QuickClearChatsModal({ visible, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const [selected, setSelected] = useState<QuickClearDays>(14);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const cleared = await quickClearOldChatMessages(selected);
      onDone?.(cleared);
      onClose();
      showAlert({
        type: 'success',
        title: t('chat.quickClearDone'),
        message: t('chat.quickClearDoneMsg', { count: cleared, days: selected }),
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: e?.message ?? t('chat.quickClearFailed'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text variant="h4" weight="bold" color={lu.colors.ink} style={styles.title}>
            {t('chat.quickClearTitle')}
          </Text>
          <Text variant="body" color={lu.colors.muted} style={styles.subtitle}>
            {t('chat.quickClearHint')}
          </Text>

          <View style={styles.options}>
            {OPTIONS.map((days) => {
              const active = selected === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => setSelected(days)}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                >
                  <View style={[styles.checkbox, active && styles.checkboxActive]}>
                    {active ? <View style={styles.checkboxInner} /> : null}
                  </View>
                  <Text variant="body" color={lu.colors.ink} weight={active ? 'bold' : 'regular'}>
                    {t('chat.quickClearSinceDays', { days })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => void handleConfirm()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="body" color="#fff" weight="bold">
                  {t('common.ok')}
                </Text>
              )}
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} disabled={busy} onPress={onClose}>
              <Text variant="body" color={lu.colors.pink} weight="semibold">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  options: {
    gap: 4,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  optionRowActive: {
    backgroundColor: 'rgba(240, 43, 43, 0.06)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: lu.colors.purple,
    backgroundColor: 'rgba(240, 43, 43, 0.12)',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: lu.colors.purple,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#E5E7EB',
  },
  btnGhost: {
    backgroundColor: '#FEE2E2',
  },
});
