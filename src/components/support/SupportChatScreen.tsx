/**
 * محادثة دعم LinkUp — واجهة مخصصة + مرفقات + اختصارات شغالة
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  Send,
  Building2,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Paperclip,
  X,
  Headphones,
  Camera,
  Images,
  FileText,
  Mic,
} from 'lucide-react-native';

import { Text, VoiceMessagePlayer, VoiceRecorder } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import {
  getOrCreateConversation,
  sendChatMessage,
  sendImageMessage,
  sendVoiceMessage,
  sendFileMessage,
  subscribeToMessages,
  markConversationAsRead,
  type ChatMessage,
} from '@/services/firebase/chat';
import { getOfficialAccountConfig, SUPPORT_UID, resolveOfficialChatDisplayName, type OfficialAccountUid } from '@/services/supportAccount';
import { LinkUpSupportAvatar } from './LinkUpSupportAvatar';

const QUICK_ACTIONS = [
  { id: 'agency' as const, icon: Building2, color: '#E11414', route: '/agency/hub' },
  { id: 'wallet' as const, icon: Wallet, color: '#F59E0B', route: '/wallet' },
  { id: 'report' as const, icon: ShieldAlert, color: '#EF4444', route: '/report?source=support' },
];

export function SupportChatScreen({ officialUid = SUPPORT_UID }: { officialUid?: OfficialAccountUid }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const account = getOfficialAccountConfig(officialUid);
  const peerUid = officialUid;
  const peerName = resolveOfficialChatDisplayName(officialUid) ?? account?.name ?? 'LinkUp';

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const invertedMessages = React.useMemo(() => {
    return [...messages].reverse();
  }, [messages]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const setup = async () => {
      if (!user) return;
      try {
        const convId = await getOrCreateConversation(peerUid, peerName, '');
        setConversationId(convId);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void setup();
  }, [user?.uid, peerUid, peerName]);

  useEffect(() => {
    if (!conversationId) return;
    void markConversationAsRead(conversationId);
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      void markConversationAsRead(conversationId);
    });
    return unsub;
  }, [conversationId]);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || sending) return;
    setSending(true);
    try {
      await sendChatMessage(conversationId, peerUid, inputText.trim());
      setInputText('');
    } catch {
      Alert.alert(t('common.error'), t('chat.messageSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const runUpload = async (fn: () => Promise<void>) => {
    if (!conversationId || uploading) return;
    setShowAttach(false);
    setUploading(true);
    try {
      await fn();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg === 'FILE_TOO_LARGE') {
        Alert.alert(t('common.error'), t('supportChat.fileTooLarge'));
      } else {
        Alert.alert(t('common.error'), t('chat.messageSendFailed'));
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), t('supportChat.galleryDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runUpload(() =>
      sendImageMessage(
        conversationId!,
        peerUid,
        asset.uri,
        asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
      ),
    );
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), t('supportChat.cameraDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runUpload(() =>
      sendImageMessage(
        conversationId!,
        peerUid,
        asset.uri,
        asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
      ),
    );
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runUpload(() =>
      sendFileMessage(
        conversationId!,
        peerUid,
        asset.uri,
        asset.name ?? 'file',
        asset.mimeType ?? undefined,
      ),
    );
  };

  const handleSendVoice = async (uri: string, durationSec: number) => {
    await runUpload(() =>
      sendVoiceMessage(conversationId!, peerUid, uri, durationSec),
    );
  };

  const renderMessageBody = (item: ChatMessage, fromTeam: boolean) => {
    if (item.type === 'image' && item.imageUrl) {
      return (
        <Pressable onPress={() => setFullImage(item.imageUrl!)}>
          <Image source={{ uri: item.imageUrl }} style={styles.msgImage} contentFit="cover" />
        </Pressable>
      );
    }
    if (item.type === 'voice' && item.voiceUrl) {
      return (
        <VoiceMessagePlayer
          voiceUrl={item.voiceUrl}
          duration={item.voiceDuration ?? 0}
          isMine={!fromTeam}
        />
      );
    }
    if (item.type === 'file' && item.fileUrl) {
      return (
        <Pressable
          style={styles.fileBubble}
          onPress={() => void Linking.openURL(item.fileUrl!)}
        >
          <FileText size={22} color={fromTeam ? '#D81D1D' : '#fff'} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.fileName, fromTeam && styles.fileNameTeam]}
              numberOfLines={2}
            >
              {item.fileName ?? item.text ?? t('supportChat.file')}
            </Text>
            <Text style={[styles.fileTap, fromTeam && styles.fileTapTeam]}>
              {t('supportChat.tapToOpen')}
            </Text>
          </View>
        </Pressable>
      );
    }
    return (
      <Text style={[styles.msgText, fromTeam && styles.msgTextTeam]}>{item.text}</Text>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#8A0E0E" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
          <BackChevron size={22} color="#5F1E1E" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <LinkUpSupportAvatar size={40} />
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text weight="bold" style={styles.headerTitle}>
                {t('supportChat.headerTitle')}
              </Text>
              <ShieldCheck size={16} color="#EA2626" strokeWidth={2.5} />
            </View>
            <Text style={styles.headerSub}>{peerName}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/report?source=support' as any)}
          style={styles.headerBtn}
          hitSlop={10}
        >
          <ShieldAlert size={20} color="#5F1E1E" strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.trustBar}>
        <Clock size={13} color="#D81D1D" />
        <Text style={styles.trustText}>{t('supportChat.trustLine')}</Text>
      </View>

      <View style={styles.teamCard}>
        <View style={styles.teamCardIcon}>
          <Headphones size={22} color="#D81D1D" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="bold" style={styles.teamTitle}>
            {t('supportChat.teamTitle')}
          </Text>
          <Text style={styles.teamDesc}>{t('supportChat.teamDesc')}</Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Pressable
              key={a.id}
              style={styles.quickChip}
              onPress={() => router.push(a.route as any)}
            >
              <View style={[styles.quickChipIcon, { backgroundColor: `${a.color}18` }]}>
                <Icon size={18} color={a.color} strokeWidth={2.2} />
              </View>
              <Text style={styles.quickChipLabel}>{t(`supportChat.quick.${a.id}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        ref={listRef}
        data={invertedMessages}
        inverted
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const fromTeam = item.fromUid === peerUid;
          return (
            <View style={[styles.msgRow, fromTeam ? styles.msgRowTeam : styles.msgRowMe]}>
              {fromTeam ? <LinkUpSupportAvatar size={32} /> : null}
              <View style={[styles.bubble, fromTeam ? styles.bubbleTeam : styles.bubbleMe]}>
                {fromTeam ? (
                  <View style={styles.teamLabel}>
                    <Text style={styles.teamLabelText}>{t('supportChat.teamBadge')}</Text>
                  </View>
                ) : null}
                {renderMessageBody(item, fromTeam)}
                <Text style={[styles.msgTime, fromTeam && styles.msgTimeTeam]}>
                  {new Date(item.createdAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
            <LinkUpSupportAvatar size={64} />
            <Text weight="bold" style={styles.emptyTitle}>
              {t('supportChat.emptyTitle')}
            </Text>
            <Text style={styles.emptySub}>{t('supportChat.emptySub')}</Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        {uploading ? (
          <ActivityIndicator color="#8A0E0E" style={{ marginHorizontal: 8 }} />
        ) : (
          <Pressable onPress={() => setShowAttach(true)} style={styles.attachBtn}>
            <Paperclip size={22} color="#8A0E0E" strokeWidth={2.2} />
          </Pressable>
        )}
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('supportChat.placeholder')}
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={800}
        />
        {inputText.trim() ? (
          <Pressable
            onPress={() => void handleSend()}
            disabled={sending}
            style={styles.sendBtn}
          >
            <Send size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <VoiceRecorder onRecorded={handleSendVoice} color="#8A0E0E" />
        )}
      </View>

      <Modal visible={showAttach} transparent animationType="slide">
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAttach(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text weight="bold" style={styles.sheetTitle}>
              {t('supportChat.attachTitle')}
            </Text>
            <View style={styles.sheetGrid}>
              <AttachOption
                icon={Camera}
                label={t('supportChat.attachCamera')}
                color="#E11414"
                onPress={() => void handleTakePhoto()}
              />
              <AttachOption
                icon={Images}
                label={t('supportChat.attachGallery')}
                color="#ED4444"
                onPress={() => void handlePickGallery()}
              />
              <AttachOption
                icon={FileText}
                label={t('supportChat.attachFile')}
                color="#E11414"
                onPress={() => void handlePickDocument()}
              />
              <AttachOption
                icon={Mic}
                label={t('supportChat.attachVoice')}
                color="#10B981"
                onPress={() => {
                  setShowAttach(false);
                  Alert.alert(t('supportChat.attachVoice'), t('supportChat.voiceHint'));
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!fullImage} transparent animationType="fade">
        <Pressable style={styles.fullBg} onPress={() => setFullImage(null)}>
          {fullImage ? (
            <Image source={{ uri: fullImage }} style={styles.fullImg} contentFit="contain" />
          ) : null}
          <Pressable style={styles.fullClose} onPress={() => setFullImage(null)}>
            <X size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AttachOption({
  icon: Icon,
  label,
  color,
  onPress,
}: {
  icon: typeof Camera;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.attachOption} onPress={onPress}>
      <View style={[styles.attachOptionIcon, { backgroundColor: `${color}18` }]}>
        <Icon size={24} color={color} strokeWidth={2.2} />
      </View>
      <Text style={styles.attachOptionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FEF2F2' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, color: '#1A0A0C' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FCDDDD',
  },
  trustText: { fontSize: 12, color: '#AF1E1E', fontWeight: '600', flex: 1 },
  teamCard: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F9C4C4',
  },
  teamCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamTitle: { fontSize: 14, color: '#1A0A0C' },
  teamDesc: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickChipLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  msgRow: { flexDirection: 'row', marginBottom: 10, gap: 8, maxWidth: '92%' },
  msgRowTeam: { alignSelf: 'flex-start' },
  msgRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, maxWidth: '100%' },
  bubbleTeam: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopStartRadius: 4,
  },
  bubbleMe: {
    backgroundColor: '#8A0E0E',
    borderTopEndRadius: 4,
  },
  teamLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  teamLabelText: { fontSize: 10, fontWeight: '800', color: '#D81D1D' },
  msgText: { fontSize: 15, color: '#fff', lineHeight: 22 },
  msgTextTeam: { color: '#1E293B' },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 4, textAlign: I18nManager.isRTL ? 'left' : 'right' },
  msgTimeTeam: { color: '#94A3B8', textAlign: I18nManager.isRTL ? 'right' : 'left' },
  msgImage: { width: 200, height: 140, borderRadius: 10, marginBottom: 4 },
  fileBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 },
  fileName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  fileNameTeam: { color: '#1E293B' },
  fileTap: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  fileTapTeam: { color: '#64748B' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 17, color: '#1A0A0C', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingHorizontal: 24 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A0A0C',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8A0E0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, color: '#1A0A0C', textAlign: 'center', marginBottom: 16 },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  attachOption: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attachOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachOptionLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  fullBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  fullImg: { width: '100%', height: '80%' },
  fullClose: {
    position: 'absolute',
    top: 56,
    end: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
