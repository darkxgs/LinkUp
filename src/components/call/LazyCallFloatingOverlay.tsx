import React from 'react';
import { useCallSessionStore } from '@/stores/callSessionStore';
import { CallFloatingOverlay } from './CallFloatingOverlay';

export function LazyCallFloatingOverlay() {
  const isMinimized = useCallSessionStore((s) => s.isMinimized);
  const peerUid = useCallSessionStore((s) => s.peerUid);

  if (!isMinimized || !peerUid) return null;
  return <CallFloatingOverlay />;
}
