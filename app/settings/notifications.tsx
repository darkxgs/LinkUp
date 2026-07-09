/**
 * LinkUp — إعدادات الإشعارات التفصيلية
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Users, UserPlus, UsersRound, BellOff,
  UserPlus as FollowIcon, MessageCircle, Bell, Home,
  Heart, AtSign, Gift,
} from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import {
  subscribeNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
  type NotifAudience,
  type QuickNotifFilter,
} from '@/services/firebase/notificationSettings';

const QUICK_FILTERS: { id: QuickNotifFilter; labelKey: string; Icon: typeof Users }[] = [
  { id: 'all', labelKey: 'notifSettings.quickAll', Icon: Users },
  { id: 'followers', labelKey: 'notifSettings.quickFollowers', Icon: UserPlus },
  { id: 'friends', labelKey: 'notifSettings.quickFriends', Icon: UsersRound },
  { id: 'none', labelKey: 'notifSettings.quickNone', Icon: BellOff },
];

const AUDIENCE_OPTIONS: { id: NotifAudience; labelKey: string }[] = [
  { id: 'everyone', labelKey: 'notifSettings.everyone' },
  { id: 'followers', labelKey: 'notifSettings.followers' },
  { id: 'friends', labelKey: 'notifSettings.friends' },
  { id: 'none', labelKey: 'notifSettings.none' },
];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeNotificationSettings(user.uid, setSettings);
  }, [user?.uid]);

  const patch = async (p: Partial<NotificationSettings>) => {
    if (!user?.uid) return;
    setSettings((s) => (s ? { ...s, ...p } : s));
    try {
      await updateNotificationSettings(user.uid, p);
    } catch {
      subscribeNotificationSettings(user.uid, setSettings);
    }
  };

  const audienceLabel = (v?: NotifAudience) =>
    t(AUDIENCE_OPTIONS.find((o) => o.id === v)?.labelKey ?? 'notifSettings.everyone');

  const audienceFields: {
    key: keyof NotificationSettings;
    labelKey: string;
    Icon: typeof FollowIcon;
  }[] = [
    { key: 'followNotif', labelKey: 'notifSettings.follow', Icon: FollowIcon },
    { key: 'roomJoin', labelKey: 'notifSettings.roomJoin', Icon: Home },
    { key: 'likeNotif', labelKey: 'notifSettings.like', Icon: Heart },
    { key: 'commentNotif', labelKey: 'notifSettings.comment', Icon: MessageCircle },
    { key: 'mentionNotif', labelKey: 'notifSettings.mention', Icon: AtSign },
    { key: 'postGiftNotif', labelKey: 'notifSettings.postGifts', Icon: Gift },
  ];

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{t('notifSettings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.sectionTitle}>{t('notifSettings.quickTitle')}</Text>
        <View style={styles.quickRow}>
          {QUICK_FILTERS.map(({ id, labelKey, Icon }) => {
            const active = settings?.quickFilter === id;
            return (
              <Pressable
                key={id}
                style={[styles.quickCard, active && styles.quickCardActive]}
                onPress={() => patch({ quickFilter: id })}
              >
                <Icon size={22} color={active ? '#E11414' : '#9CA3AF'} />
                <Text style={[styles.quickLabel, active && { color: '#E11414' }]}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('notifSettings.instantTitle')}</Text>
        <View style={styles.card}>
          {audienceFields.slice(0, 1).map(({ key, labelKey, Icon }) => (
            <Pressable
              key={key}
              style={styles.row}
              onPress={() => setPickerKey(key)}
            >
              <View style={styles.rowRight}>
                <Icon size={18} color="#6B7280" />
                <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              </View>
              <Text style={styles.rowValue}>{audienceLabel(settings?.[key] as NotifAudience)}</Text>
            </Pressable>
          ))}
          <View style={styles.row}>
            <View style={styles.rowRight}>
              <MessageCircle size={18} color="#6B7280" />
              <Text style={styles.rowLabel}>{t('notifSettings.privateMessage')}</Text>
            </View>
            <Switch
              value={settings?.privateMessage ?? true}
              onValueChange={(v) => patch({ privateMessage: v })}
              trackColor={{ false: '#E5E7EB', true: '#E11414' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowRight}>
              <Bell size={18} color="#6B7280" />
              <Text style={styles.rowLabel}>{t('notifSettings.privateOutside')}</Text>
            </View>
            <Switch
              value={settings?.privateMessageOutside ?? true}
              onValueChange={(v) => patch({ privateMessageOutside: v })}
              trackColor={{ false: '#E5E7EB', true: '#E11414' }}
              thumbColor="#fff"
            />
          </View>
          {audienceFields.slice(1, 2).map(({ key, labelKey, Icon }) => (
            <Pressable key={key} style={styles.row} onPress={() => setPickerKey(key)}>
              <View style={styles.rowRight}>
                <Icon size={18} color="#6B7280" />
                <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              </View>
              <Text style={styles.rowValue}>{audienceLabel(settings?.[key] as NotifAudience)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('notifSettings.contentTitle')}</Text>
        <View style={styles.card}>
          {audienceFields.slice(2).map(({ key, labelKey, Icon }) => (
            <Pressable key={key} style={styles.row} onPress={() => setPickerKey(key)}>
              <View style={styles.rowRight}>
                <Icon size={18} color="#6B7280" />
                <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              </View>
              <Text style={styles.rowValue}>{audienceLabel(settings?.[key] as NotifAudience)}</Text>
            </Pressable>
          ))}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowRight}>
              <Gift size={18} color="#6B7280" />
              <Text style={styles.rowLabel}>{t('notifSettings.postGiftReceive')}</Text>
            </View>
            <Switch
              value={settings?.postGiftReceive ?? true}
              onValueChange={(v) => patch({ postGiftReceive: v })}
              trackColor={{ false: '#E5E7EB', true: '#E11414' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {pickerKey ? (
          <View style={styles.pickerOverlay}>
            <Pressable style={styles.pickerBackdrop} onPress={() => setPickerKey(null)} />
            <View style={styles.pickerSheet}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    patch({ [pickerKey]: opt.id } as Partial<NotificationSettings>);
                    setPickerKey(null);
                  }}
                >
                  <Text style={styles.pickerText}>{t(opt.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F7F7F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 17, color: lu.colors.ink },
  sectionTitle: {
    fontSize: 13,
    color: '#9CA3AF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  quickCardActive: { borderWidth: 1.5, borderColor: '#E11414' },
  quickLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F2',
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 15, color: lu.colors.ink },
  rowValue: { fontSize: 14, color: '#9CA3AF' },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  pickerItem: { paddingVertical: 16, paddingHorizontal: 24 },
  pickerText: { fontSize: 16, color: lu.colors.ink, textAlign: 'center' },
});
