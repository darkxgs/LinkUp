import { FileText, ImageIcon, Mic } from 'lucide-react';
import type { SupportMessage } from '@/services/supportChat';
import { SUPPORT_UID } from '@/services/supportChat';
import { timeAgo } from '@/services/admin';

interface Props {
  message: SupportMessage;
}

export function SupportMessageBubble({ message }: Props) {
  const fromSupport = message.fromUid === SUPPORT_UID;

  const body = () => {
    if (message.type === 'image' && message.imageUrl) {
      return (
        <a
          href={message.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="support-msg-image-link"
        >
          <img src={message.imageUrl} alt="صورة" className="support-msg-image" />
        </a>
      );
    }
    if (message.type === 'voice' && message.voiceUrl) {
      const sec = message.voiceDuration ?? 0;
      return (
        <div className="support-msg-voice">
          <Mic size={18} />
          <audio controls preload="metadata" src={message.voiceUrl}>
            <a href={message.voiceUrl} target="_blank" rel="noopener noreferrer">
              تشغيل الصوت
            </a>
          </audio>
          {sec > 0 && <span className="support-msg-voice-dur">{sec}ث</span>}
        </div>
      );
    }
    if (message.type === 'file' && message.fileUrl) {
      return (
        <a
          href={message.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="support-msg-file"
        >
          <FileText size={20} />
          <span>
            <strong>{message.fileName ?? message.text ?? 'ملف'}</strong>
            <small>اضغط للفتح</small>
          </span>
        </a>
      );
    }
    if (message.type === 'image') {
      return (
        <p className="support-msg-placeholder">
          <ImageIcon size={16} /> صورة (الرابط غير متوفر)
        </p>
      );
    }
    return <p>{message.text || '—'}</p>;
  };

  return (
    <div className={`support-bubble ${fromSupport ? 'out' : 'in'}`}>
      {body()}
      <span>{timeAgo(message.createdAt)}</span>
    </div>
  );
}
