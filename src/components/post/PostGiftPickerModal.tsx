/**
 * موديل إرسال هدية على منشور — يستهدف صاحب المنشور مباشرة
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';

import { Text } from '@/components/ui';
import { ChatGiftPickerModal } from '@/components/chat/ChatGiftPickerModal';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/hooks/useAuth';
import { sendGiftOnPost } from '@/services/firebase/posts';
import type { Gift as GiftType } from '@/services/firebase/shop';
import { firestore } from '@/services/firebase';
import type { ProfileGender } from '@/constants/defaultAvatars';
import { getDefaultAvatar } from '@/constants/defaultAvatars';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import { lu } from '@/theme/lu-brand';

type Props = {
  visible: boolean;
  postId: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  authorGender?: ProfileGender;
  onClose: () => void;
  onSent?: (gift: GiftType, quantity: number) => void;
};

export function PostGiftPickerModal({
  visible,
  postId,
  authorUid,
  authorName,
  authorAvatar,
  authorGender,
  onClose,
  onSent,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gifts, giftCategories } = useConfig();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [successGift, setSuccessGift] = useState<{ gift: GiftType; qty: number } | null>(null);
  const sendLockRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const balance = user?.stats?.coins ?? 0;

  const fallbackAvatar = useMemo(
    () => getDefaultAvatar(authorGender ?? 'female', authorUid),
    [authorGender, authorUid],
  );
  const [resolvedAvatar, setResolvedAvatar] = useState(
    () => authorAvatar?.trim() || fallbackAvatar,
  );

  useEffect(() => {
    if (!visible) return;
    const cached = authorAvatar?.trim();
    setResolvedAvatar(cached || fallbackAvatar);

    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'users', authorUid));
        if (cancelled) return;
        setResolvedAvatar(
          resolveUserDocAvatar(snap.exists() ? snap.data() : undefined, authorUid),
        );
      } catch {
        if (!cancelled) setResolvedAvatar(cached || fallbackAvatar);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, authorUid, authorAvatar, fallbackAvatar]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const recipients = useMemo(
    () => [
      {
        uid: authorUid,
        name: authorName,
        avatar: resolvedAvatar,
        gender: authorGender,
      },
    ],
    [authorUid, authorName, resolvedAvatar, authorGender],
  );

  const handleSend = async (gift: GiftType, quantity: number) => {
    if (sending || sendLockRef.current) return;
    sendLockRef.current = true;
    setSending(true);
    try {
      await sendGiftOnPost(postId, gift, authorUid, authorName, quantity);
      setSuccessGift({ gift, qty: quantity });
      onSent?.(gift, quantity);
      closeTimerRef.current = setTimeout(() => {
        setSuccessGift(null);
        onClose();
        closeTimerRef.current = null;
      }, 1800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('chat.giftSendFailed');
      alert(msg);
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  };

  if (successGift) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.successOverlay}>
          <LinearGradient
            colors={['#3A1316', '#8A0E0E', '#E11414']}
            style={[styles.successCard, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.successIconWrap}>
              <Gift size={36} color="#fff" strokeWidth={2} />
            </View>
            <Text style={styles.successTitle}>{t('feed.giftSentTitle')}</Text>
            <Text style={styles.successBody}>
              {t('feed.giftSentBody', {
                gift: successGift.qty > 1
                  ? `${successGift.gift.name} ×${successGift.qty}`
                  : successGift.gift.name,
                name: authorName,
              })}
            </Text>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return (
    <ChatGiftPickerModal
      visible={visible}
      gifts={gifts}
      categories={giftCategories}
      balance={balance}
      sending={sending}
      titleKey="feed.sendGiftToAuthor"
      initialRecipientUid={authorUid}
      recipients={recipients}
      onClose={onClose}
      onSend={handleSend}
      onRecharge={() => {
        onClose();
        router.push('/wallet/recharge' as any);
      }}
    />
  );
}

const styles = StyleSheet.create({
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 8, 8, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
    ...lu.shadows.grad,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    fontFamily: lu.fonts.body,
  },
});
