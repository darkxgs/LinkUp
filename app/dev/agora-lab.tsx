/**
 * مختبر Agora — شاشة داخلية مخفية لاختبار أساس العميل (المرحلة 3 من الترحيل)
 *
 * الوصول: بالمسار /dev/agora-lab يدوياً فقط (غير مسجلة في أي تبويب/قائمة).
 * تعرض محتواها فقط في وضع التطوير أو لمعرّفات مدرجة في
 * Firestore config/settings.agoraTestUids.
 * نصوص عربية مباشرة بلا مفاتيح ترجمة — شاشة داخلية.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import {
  agoraEngine,
  type AgoraRole,
  type AgoraSpeakerInfo,
} from '@/services/rtc/agoraEngine';
import {
  joinWithTransportLadder,
  resetAgoraTransportPreference,
  type AgoraTransportMode,
} from '@/services/rtc/agoraConnect';
import { attachTokenRenewal, getAgoraTokenCached } from '@/services/rtc/agoraToken';

const MAX_LOG_ENTRIES = 50;

interface LogEntry {
  ts: string;
  text: string;
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type AccessState = 'checking' | 'allowed' | 'denied';

export default function AgoraLabScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [access, setAccess] = useState<AccessState>(__DEV__ ? 'allowed' : 'checking');
  const [channel, setChannel] = useState('room_agora_lab');
  const [busy, setBusy] = useState(false);
  const [joinedMode, setJoinedMode] = useState<AgoraTransportMode | null>(null);
  const [role, setRole] = useState<AgoraRole>('audience');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [forceMode, setForceMode] = useState<AgoraTransportMode | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [speakers, setSpeakers] = useState<AgoraSpeakerInfo[]>([]);
  const detachRenewalRef = useRef<(() => void) | null>(null);

  const appendLog = useCallback((text: string) => {
    setLog((prev) => [{ ts: nowStamp(), text }, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  // حارس الوصول: __DEV__ أو uid ضمن config/settings.agoraTestUids
  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    void (async () => {
      try {
        const uid = user?.uid;
        if (!uid) {
          if (!cancelled) setAccess('denied');
          return;
        }
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('@/services/firebase/index');
        const snap = await getDoc(doc(firestore, 'config', 'settings'));
        const raw = snap.exists()
          ? (snap.data() as Record<string, unknown>).agoraTestUids
          : undefined;
        const allowed = Array.isArray(raw) && raw.includes(uid);
        if (!cancelled) setAccess(allowed ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // الاشتراك بموزّع الأحداث — speaking في عرض مستقل، والبقية في السجل
  useEffect(() => {
    if (access !== 'allowed') return;
    const unsubscribe = agoraEngine.subscribe((event) => {
      if (event.type === 'speaking') {
        setSpeakers(event.speakers);
        return;
      }
      switch (event.type) {
        case 'connected':
          appendLog('اتصال ناجح (connected)');
          break;
        case 'disconnected':
          appendLog('انقطع الاتصال (disconnected)');
          setJoinedMode(null);
          setSpeakers([]);
          break;
        case 'reconnecting':
          appendLog('جارٍ إعادة الاتصال...');
          break;
        case 'reconnected':
          appendLog('أعيد الاتصال (rejoin)');
          break;
        case 'participantJoined':
          appendLog(`انضم مشارك: ${event.identity}`);
          break;
        case 'participantLeft':
          appendLog(`غادر مشارك: ${event.identity}`);
          break;
        case 'trackMuted':
          appendLog(`${event.identity} — ${event.muted ? 'كتم مايكه' : 'فك الكتم'}`);
          break;
        case 'tokenWillExpire':
          appendLog('التوكن سينتهي قريباً (تجديد تلقائي)');
          break;
        case 'tokenRequired':
          appendLog('التوكن انتهى — مطلوب إعادة انضمام');
          break;
        case 'proxyConnected':
          appendLog(`اتصال عبر بروكسي (نوع ${event.proxyType})`);
          break;
        case 'audioRouteChanged':
          appendLog(`تغيّر مسار الصوت (route=${event.route})`);
          break;
      }
    });
    return unsubscribe;
  }, [access, appendLog]);

  // فك ربط التجديد عند مغادرة الشاشة
  useEffect(
    () => () => {
      detachRenewalRef.current?.();
      detachRenewalRef.current = null;
    },
    [],
  );

  const handleJoin = useCallback(
    async (joinRole: AgoraRole) => {
      const name = channel.trim();
      if (!name || busy) return;
      setBusy(true);
      try {
        appendLog(`طلب توكن (${joinRole === 'broadcaster' ? 'متحدث' : 'مستمع'})...`);
        const tokenRes = await getAgoraTokenCached(name, joinRole === 'broadcaster');
        appendLog(`وصل التوكن — identity: ${tokenRes.identity}`);
        const mode = await joinWithTransportLadder({
          appId: tokenRes.appId,
          token: tokenRes.token,
          channel: name,
          identity: tokenRes.identity,
          role: joinRole,
          ...(forceMode ? { forceMode } : {}),
        });
        agoraEngine.setAudioProfileForRooms();
        agoraEngine.setSpeakerphone(speakerOn);
        setJoinedMode(mode);
        setRole(joinRole);
        setMuted(joinRole !== 'broadcaster' ? false : muted);
        appendLog(
          `انضمام ناجح عبر: ${mode === 'direct' ? 'مباشر' : mode === 'udp' ? 'UDP proxy' : 'TCP proxy'}`,
        );
        // ربط تجديد التوكن التلقائي لهذه الجلسة
        detachRenewalRef.current?.();
        detachRenewalRef.current = attachTokenRenewal(agoraEngine, {
          roomName: name,
          canPublish: joinRole === 'broadcaster',
          onTokenRequired: () => appendLog('tokenRequired — أعد الانضمام يدوياً'),
        });
      } catch (e) {
        appendLog(`فشل الانضمام: ${(e as Error)?.message ?? String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [appendLog, busy, channel, forceMode, muted, speakerOn],
  );

  const handleLeave = useCallback(async () => {
    detachRenewalRef.current?.();
    detachRenewalRef.current = null;
    await agoraEngine.leaveChannel();
    setJoinedMode(null);
    setSpeakers([]);
    appendLog('غادرت القناة');
  }, [appendLog]);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    agoraEngine.setMicMuted(next);
    setMuted(next);
    appendLog(next ? 'كتمت المايك' : 'فككت كتم المايك');
  }, [appendLog, muted]);

  const handleToggleSpeaker = useCallback(() => {
    const next = !speakerOn;
    agoraEngine.setSpeakerphone(next);
    setSpeakerOn(next);
    appendLog(next ? 'مكبّر الصوت: يعمل' : 'مكبّر الصوت: متوقف');
  }, [appendLog, speakerOn]);

  const handleToggleRole = useCallback(() => {
    const next: AgoraRole = role === 'broadcaster' ? 'audience' : 'broadcaster';
    agoraEngine.setRole(next);
    setRole(next);
    appendLog(next === 'broadcaster' ? 'الدور: متحدث' : 'الدور: مستمع');
  }, [appendLog, role]);

  const handleRenewToken = useCallback(async () => {
    const name = channel.trim();
    if (!name) return;
    try {
      const fresh = await getAgoraTokenCached(name, role === 'broadcaster', undefined, {
        forceFresh: true,
      });
      agoraEngine.renewToken(fresh.token);
      appendLog('جُدّد التوكن يدوياً');
    } catch (e) {
      appendLog(`فشل تجديد التوكن: ${(e as Error)?.message ?? String(e)}`);
    }
  }, [appendLog, channel, role]);

  const pickForceMode = useCallback(
    (mode: AgoraTransportMode | null) => {
      setForceMode(mode);
      if (mode === null) resetAgoraTransportPreference();
      appendLog(
        mode === null
          ? 'وضع النقل: سلّم آلي (ومسح التفضيل المحفوظ)'
          : mode === 'direct'
            ? 'وضع النقل: مباشر (مفروض)'
            : mode === 'udp'
              ? 'وضع النقل: UDP proxy (مفروض)'
              : 'وضع النقل: TCP proxy (مفروض)',
      );
    },
    [appendLog],
  );

  if (access === 'checking') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#8b5cf6" />
      </View>
    );
  }

  if (access === 'denied') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.deniedText}>غير متاح</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.title}>مختبر Agora</Text>
        <Text style={styles.subtitle}>
          الحالة: {joinedMode ? `متصل (${joinedMode})` : 'غير متصل'}
          {joinedMode ? ` — ${role === 'broadcaster' ? 'متحدث' : 'مستمع'}` : ''}
        </Text>

        <Text style={styles.sectionTitle}>اسم القناة</Text>
        <TextInput
          style={styles.input}
          value={channel}
          onChangeText={setChannel}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!joinedMode && !busy}
          placeholder="room_agora_lab"
          placeholderTextColor="#666"
        />

        <Text style={styles.sectionTitle}>الاتصال</Text>
        <View style={styles.row}>
          <LabButton
            label="انضمام متحدث"
            onPress={() => void handleJoin('broadcaster')}
            disabled={busy || !!joinedMode}
          />
          <LabButton
            label="انضمام مستمع"
            onPress={() => void handleJoin('audience')}
            disabled={busy || !!joinedMode}
          />
          <LabButton
            label="مغادرة"
            onPress={() => void handleLeave()}
            disabled={busy || !joinedMode}
            danger
          />
        </View>
        {busy ? <ActivityIndicator color="#8b5cf6" style={{ marginTop: 8 }} /> : null}

        <Text style={styles.sectionTitle}>أدوات الجلسة</Text>
        <View style={styles.row}>
          <LabButton
            label={muted ? 'فك كتم المايك' : 'كتم المايك'}
            onPress={handleToggleMute}
            disabled={!joinedMode}
          />
          <LabButton
            label={speakerOn ? 'إيقاف المكبّر' : 'تشغيل المكبّر'}
            onPress={handleToggleSpeaker}
            disabled={!joinedMode}
          />
        </View>
        <View style={styles.row}>
          <LabButton
            label={role === 'broadcaster' ? 'تحويل لمستمع' : 'تحويل لمتحدث'}
            onPress={handleToggleRole}
            disabled={!joinedMode}
          />
          <LabButton
            label="تجديد التوكن"
            onPress={() => void handleRenewToken()}
            disabled={!joinedMode}
          />
        </View>

        <Text style={styles.sectionTitle}>وضع النقل (للانضمام القادم)</Text>
        <View style={styles.row}>
          <LabButton
            label="سلّم آلي"
            onPress={() => pickForceMode(null)}
            active={forceMode === null}
          />
          <LabButton
            label="مباشر"
            onPress={() => pickForceMode('direct')}
            active={forceMode === 'direct'}
          />
          <LabButton
            label="فرض UDP"
            onPress={() => pickForceMode('udp')}
            active={forceMode === 'udp'}
          />
          <LabButton
            label="فرض TCP proxy"
            onPress={() => pickForceMode('tcp')}
            active={forceMode === 'tcp'}
          />
        </View>

        <Text style={styles.sectionTitle}>مستويات الصوت الخام (speaking)</Text>
        {speakers.length === 0 ? (
          <Text style={styles.emptyText}>لا تقارير بعد</Text>
        ) : (
          speakers.map((s) => (
            <Text key={s.identity} style={styles.speakerText}>
              {s.identity}: {s.level.toFixed(3)}
            </Text>
          ))
        )}

        <Text style={styles.sectionTitle}>سجل الأحداث (آخر {MAX_LOG_ENTRIES})</Text>
        {log.length === 0 ? (
          <Text style={styles.emptyText}>لا أحداث بعد</Text>
        ) : (
          log.map((entry, i) => (
            <Text key={`${entry.ts}-${i}`} style={styles.logText}>
              [{entry.ts}] {entry.text}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function LabButton({
  label,
  onPress,
  disabled,
  danger,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && styles.buttonDanger,
        active && styles.buttonActive,
        (disabled || pressed) && styles.buttonDim,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    paddingHorizontal: 16,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedText: {
    color: '#999',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  subtitle: {
    color: '#a78bfa',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  sectionTitle: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#1c1c2e',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDanger: {
    backgroundColor: '#4a1f2b',
  },
  buttonActive: {
    backgroundColor: '#5b21b6',
  },
  buttonDim: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
  },
  speakerText: {
    color: '#7dd3fc',
    fontSize: 12,
    textAlign: 'right',
  },
  logText: {
    color: '#bbb',
    fontSize: 12,
    marginBottom: 2,
    textAlign: 'right',
  },
});
