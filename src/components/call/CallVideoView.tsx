/**
 * عرض فيديو المكالمة — غلاف رفيع حول AgoraVideoView الكسول.
 * (كان يميّز بين VideoTrack من LiveKit ومرجع Agora — بعد إزالة LiveKit
 * بقي مسار Agora وحده، والشاشات تمرر snapshot.localVideoTrack/remoteVideoTrack كما هي.)
 */
import React from 'react';
import { ViewStyle } from 'react-native';
import type { AgoraCallVideoRef } from '@/services/rtc/agoraCallSession';

import { AgoraVideoView } from './AgoraVideoView';

interface Props {
  track?: AgoraCallVideoRef;
  style?: ViewStyle;
  mirror?: boolean;
  objectFit?: 'cover' | 'contain';
}

export function CallVideoView({ track, style, mirror, objectFit = 'cover' }: Props) {
  if (!track) return null;

  return (
    <AgoraVideoView
      uid={track.uid}
      local={track.local}
      style={style}
      mirror={mirror}
      objectFit={objectFit}
    />
  );
}
