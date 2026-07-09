/**
 * تسجيل مكالمات 1-to-1 في سجل المحادثة (مثل واتساب)
 */
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { getOrCreateConversation, getChatMessagePreviewLabel, buildConversationUnhidePatchForBoth } from './chat';
import { getUser } from './users';

export type ChatCallLogStatus = 'completed' | 'missed' | 'declined';

const loggedChannels = new Set<string>();

function buildCallPreview(
  callType: 'voice' | 'video',
  status: ChatCallLogStatus,
): string {
  const voice = callType === 'voice';
  if (status === 'completed') {
    return voice ? '📞 مكالمة صوتية' : '📹 مكالمة فيديو';
  }
  if (status === 'declined') {
    return voice ? '📞 مكالمة صوتية مرفوضة' : '📹 مكالمة فيديو مرفوضة';
  }
  return voice ? '📞 مكالمة صوتية فائتة' : '📹 مكالمة فيديو فائتة';
}

export async function logChatCallMessage(params: {
  callerUid: string;
  calleeUid: string;
  channelName: string;
  callType: 'voice' | 'video';
  status: ChatCallLogStatus;
  durationSeconds?: number;
}): Promise<void> {
  const me = auth.currentUser;
  if (!me) return;

  const {
    callerUid,
    calleeUid,
    channelName,
    callType,
    status,
    durationSeconds = 0,
  } = params;

  if (!callerUid || !calleeUid || !channelName || callerUid === calleeUid) return;
  if (me.uid !== callerUid && me.uid !== calleeUid) return;

  if (loggedChannels.has(channelName)) return;

  try {
    const existing = await getDocs(
      query(
        collection(firestore, 'messages'),
        where('callChannelName', '==', channelName),
        limit(1),
      ),
    );
    if (!existing.empty) {
      loggedChannels.add(channelName);
      return;
    }
  } catch {
    // استمر — قد لا يوجد فهرس بعد
  }

  loggedChannels.add(channelName);

  const otherUid = me.uid === callerUid ? calleeUid : callerUid;
  let otherName = '';
  let otherAvatar = '';
  try {
    const otherDoc = await getUser(otherUid);
    otherName = otherDoc?.displayName ?? '';
    otherAvatar = otherDoc?.avatar ?? '';
  } catch {
    // ignore
  }

  let conversationId: string;
  try {
    conversationId = await getOrCreateConversation(otherUid, otherName, otherAvatar);
  } catch {
    return;
  }

  const preview = buildCallPreview(callType, status);
  const now = Date.now();
  const duration =
    status === 'completed' ? Math.max(0, Math.floor(durationSeconds)) : 0;

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: callerUid,
    toUid: calleeUid,
    text: preview,
    type: 'call',
    callType,
    callStatus: status,
    callDurationSeconds: duration,
    callChannelName: channelName,
    createdAt: now,
    isRead: false,
  });

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: preview,
    lastMessageAt: now,
    [`unreadBy.${otherUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(callerUid, calleeUid),
  });
}

/** معاينة رسالة مكالمة في قائمة المحادثات */
export function getCallMessagePreviewLabel(
  msg: {
    callType?: 'voice' | 'video';
    callStatus?: ChatCallLogStatus;
    text?: string;
  },
): string {
  if (msg.callType && msg.callStatus) {
    return buildCallPreview(msg.callType, msg.callStatus);
  }
  return getChatMessagePreviewLabel(msg as any);
}
