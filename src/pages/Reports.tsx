import { useEffect, useState, useMemo } from 'react';
import {
  Flag, Search, CheckCircle2, XCircle, Eye, Clock, Mic, Image as ImageIcon, Video,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  subscribeReports,
  updateReportStatus,
  fetchReporterDisplayName,
  fetchReportMessageMedia,
  REASON_LABELS,
  STATUS_LABELS,
  SOURCE_LABELS,
  TARGET_TYPE_LABELS,
  type UserReport,
  type ReportStatus,
} from '@/services/reports';
import { logAdminAction, formatDate } from '@/services/admin';

type StatusFilter = 'all' | ReportStatus;

const STATUS_VARIANT: Record<ReportStatus, string> = {
  pending: 'gold',
  reviewing: 'blue',
  resolved: 'green',
  dismissed: 'gray',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selected, setSelected] = useState<UserReport | null>(null);
  const [reporterName, setReporterName] = useState('');
  const [targetName, setTargetName] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState<{
    voiceUrl?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    voiceDuration?: number | null;
    messageType?: string | null;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeReports((list) => {
      setReports(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) {
      setReporterName('');
      setTargetName('');
      setAdminNote('');
      return;
    }
    setAdminNote(selected.adminNote ?? '');
    if (selected.reporterDisplayName) {
      setReporterName(selected.reporterDisplayName);
    } else {
      void fetchReporterDisplayName(selected.reporterUid).then(setReporterName);
    }
    if (selected.targetDisplayName) {
      setTargetName(selected.targetDisplayName);
    } else if (selected.targetUid) {
      void fetchReporterDisplayName(selected.targetUid).then(setTargetName);
    } else {
      setTargetName('');
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) {
      setResolvedMedia(null);
      return;
    }

    const fromReport = {
      voiceUrl: selected.messageVoiceUrl,
      imageUrl: selected.messageImageUrl,
      videoUrl: selected.messageVideoUrl,
      voiceDuration: selected.messageVoiceDuration,
      messageType: selected.messageType,
    };

    if (fromReport.voiceUrl || fromReport.imageUrl || fromReport.videoUrl) {
      setResolvedMedia(fromReport);
      return;
    }

    if (!selected.messageId) {
      setResolvedMedia(fromReport.messageType ? fromReport : null);
      return;
    }

    void fetchReportMessageMedia(selected.messageId).then((media) => {
      if (!media) {
        setResolvedMedia(fromReport.messageType ? fromReport : null);
        return;
      }
      setResolvedMedia({
        voiceUrl: media.messageVoiceUrl ?? fromReport.voiceUrl,
        imageUrl: media.messageImageUrl ?? fromReport.imageUrl,
        videoUrl: media.messageVideoUrl ?? fromReport.videoUrl,
        voiceDuration: media.messageVoiceDuration ?? fromReport.voiceDuration,
        messageType: media.messageType ?? fromReport.messageType,
      });
    });
  }, [selected?.id, selected?.messageId, selected?.messageVoiceUrl, selected?.messageImageUrl, selected?.messageVideoUrl, selected?.messageType, selected?.messageVoiceDuration]);

  const filtered = useMemo(() => reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.reporterUid.toLowerCase().includes(q) ||
      (r.reporterDisplayName ?? '').toLowerCase().includes(q) ||
      (r.targetUid ?? '').toLowerCase().includes(q) ||
      (r.targetDisplayName ?? '').toLowerCase().includes(q) ||
      (r.messageText ?? '').toLowerCase().includes(q) ||
      r.details.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }), [reports, statusFilter, search]);

  const counts = useMemo(() => ({
    pending: reports.filter((r) => r.status === 'pending').length,
    reviewing: reports.filter((r) => r.status === 'reviewing').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  }), [reports]);

  const setStatus = async (status: ReportStatus) => {
    if (!selected || processing) return;
    setProcessing(true);
    try {
      await updateReportStatus(selected.id, status, adminNote);
      await logAdminAction(
        'تحديث بلاغ',
        selected.id.slice(0, 10),
        `${STATUS_LABELS[status]}${adminNote ? ` — ${adminNote.slice(0, 40)}` : ''}`,
      );
      setSelected({ ...selected, status, adminNote: adminNote.trim(), updatedAt: Date.now() });
    } catch (e: any) {
      alert(e?.message ?? 'فشل التحديث');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="page-container reports-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Flag size={28} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            البلاغات
          </h1>
          <p>بلاغات المستخدمين من التطبيق وشات الدعم</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {counts.pending > 0 && (
            <Badge variant="gold">{counts.pending} جديد</Badge>
          )}
          {counts.reviewing > 0 && (
            <Badge variant="blue">{counts.reviewing} قيد المراجعة</Badge>
          )}
        </div>
      </div>

      <div className="tabs">
        {(['all', 'pending', 'reviewing', 'resolved', 'dismissed'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="support-layout reports-layout">
        <aside className="support-inbox">
          <div className="search-box" style={{ marginBottom: 12 }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              placeholder="بحث بالاسم أو المعرف أو التفاصيل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <Empty text="لا توجد بلاغات" />
          ) : (
            <div className="support-conv-list">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`support-conv-item ${selected?.id === r.id ? 'active' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <div className="reports-list-icon">
                    {r.targetType === 'post' && r.postImageUrl ? (
                      <img src={r.postImageUrl} alt="" className="reports-list-avatar" />
                    ) : r.targetAvatar ? (
                      <img src={r.targetAvatar} alt="" className="reports-list-avatar" />
                    ) : (
                      <Flag size={18} color="var(--brand-primary)" />
                    )}
                  </div>
                  <div className="support-conv-body">
                    <div className="support-conv-top">
                      <span className="support-conv-name">
                        {r.targetType === 'post'
                          ? `بلاغ منشور${r.targetDisplayName ? `: ${r.targetDisplayName}` : ''}`
                          : r.targetType === 'message'
                          ? `بلاغ رسالة${r.targetDisplayName ? `: ${r.targetDisplayName}` : ''}`
                          : r.targetDisplayName
                            ? `بلاغ على: ${r.targetDisplayName}`
                            : (REASON_LABELS[r.reason] ?? r.reason)}
                      </span>
                      <span className="support-conv-time">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="support-conv-preview">
                      {r.targetType === 'post' && r.postText
                        ? `"${r.postText.slice(0, 48)}${r.postText.length > 48 ? '…' : ''}"`
                        : r.messageType === 'voice'
                        ? '🎤 رسالة صوتية'
                        : r.messageType === 'image'
                          ? '🖼️ صورة'
                          : r.messageType === 'video'
                            ? '🎬 فيديو'
                            : r.messageText
                              ? `"${r.messageText.slice(0, 48)}${r.messageText.length > 48 ? '…' : ''}"`
                              : `${REASON_LABELS[r.reason] ?? r.reason}${r.details ? ` — ${r.details.slice(0, 48)}` : ''}`}
                      {!r.messageText && !r.messageType && !r.postText && r.details.length > 48 ? '…' : ''}
                    </p>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'gray'}>
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="support-thread reports-detail">
          {!selected ? (
            <div className="support-empty-thread">
              <Flag size={48} color="var(--brand-primary-light)" />
              <h3>اختر بلاغاً</h3>
              <p>عرض التفاصيل والمرفقات وتحديث الحالة</p>
            </div>
          ) : (
            <>
              <header className="support-thread-header">
                <div>
                  <h3>{REASON_LABELS[selected.reason]}</h3>
                  <code>{selected.id}</code>
                </div>
                <Badge variant={STATUS_VARIANT[selected.status] ?? 'gray'}>
                  {STATUS_LABELS[selected.status]}
                </Badge>
              </header>

              <div className="reports-detail-body">
                <section className="reports-meta-grid">
                  <div>
                    <label>المُبلّغ</label>
                    <p>{reporterName || '…'}</p>
                    <code>{selected.reporterUid}</code>
                  </div>
                  <div>
                    <label>المصدر</label>
                    <p>{SOURCE_LABELS[selected.source] ?? selected.source}</p>
                  </div>
                  <div>
                    <label>الهدف</label>
                    <p>{TARGET_TYPE_LABELS[selected.targetType] ?? selected.targetType}</p>
                    {selected.targetUid && (
                      <div className="reports-target-row">
                        {selected.targetAvatar ? (
                          <img src={selected.targetAvatar} alt="" className="reports-target-avatar" />
                        ) : null}
                        <div>
                          <p>{targetName || '…'}</p>
                          <code>{selected.targetUid}</code>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label>التاريخ</label>
                    <p>{formatDate(selected.createdAt)}</p>
                  </div>
                  {selected.postId ? (
                    <div>
                      <label>معرّف المنشور</label>
                      <code>{selected.postId}</code>
                    </div>
                  ) : null}
                  {selected.postText ? (
                    <div className="reports-message-preview">
                      <label>نص المنشور المُبلَّغ عنه</label>
                      <p>{selected.postText}</p>
                    </div>
                  ) : null}
                  {selected.postImageUrl ? (
                    <div className="reports-message-preview reports-media-block">
                      <label>صورة المنشور</label>
                      <img src={selected.postImageUrl} alt="منشور" className="reports-media-thumb" />
                    </div>
                  ) : null}
                  {selected.messageId ? (
                    <div>
                      <label>معرّف الرسالة</label>
                      <code>{selected.messageId}</code>
                    </div>
                  ) : null}
                  {selected.messageText ? (
                    <div className="reports-message-preview">
                      <label>نص الرسالة المُبلَّغ عنها</label>
                      <p>{selected.messageText}</p>
                      {selected.messageType ? (
                        <code>{TARGET_TYPE_LABELS.message ?? 'رسالة'} · {selected.messageType}</code>
                      ) : null}
                    </div>
                  ) : selected.messageType ? (
                    <div className="reports-message-preview">
                      <label>نوع الرسالة</label>
                      <code>{selected.messageType}</code>
                    </div>
                  ) : null}
                  {resolvedMedia?.voiceUrl ? (
                    <div className="reports-message-preview reports-media-block">
                      <label>
                        <Mic size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                        الرسالة الصوتية
                        {resolvedMedia.voiceDuration
                          ? ` (${Math.round(resolvedMedia.voiceDuration)} ث)`
                          : ''}
                      </label>
                      <audio
                        controls
                        preload="metadata"
                        src={resolvedMedia.voiceUrl}
                        className="reports-audio-player"
                      />
                      <a
                        href={resolvedMedia.voiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 8 }}
                      >
                        فتح الرابط
                      </a>
                    </div>
                  ) : null}
                  {resolvedMedia?.imageUrl ? (
                    <div className="reports-message-preview reports-media-block">
                      <label>
                        <ImageIcon size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                        الصورة المُبلَّغ عنها
                      </label>
                      <a href={resolvedMedia.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img src={resolvedMedia.imageUrl} alt="صورة البلاغ" className="reports-media-thumb" />
                      </a>
                    </div>
                  ) : null}
                  {resolvedMedia?.videoUrl ? (
                    <div className="reports-message-preview reports-media-block">
                      <label>
                        <Video size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                        الفيديو المُبلَّغ عنه
                      </label>
                      <video
                        controls
                        preload="metadata"
                        src={resolvedMedia.videoUrl}
                        className="reports-video-player"
                      />
                    </div>
                  ) : null}
                  {selected.conversationId ? (
                    <div>
                      <label>المحادثة</label>
                      <code>{selected.conversationId}</code>
                    </div>
                  ) : null}
                </section>

                <section className="reports-section">
                  <label>التفاصيل</label>
                  <p className="reports-details-text">{selected.details || '—'}</p>
                </section>

                {selected.photoUrls.length > 0 && (
                  <section className="reports-section">
                    <label>مرفقات ({selected.photoUrls.length})</label>
                    <div className="reports-photos">
                      {selected.photoUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img src={url} alt={`مرفق ${i + 1}`} />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <section className="reports-section">
                  <label>ملاحظة الأدمن</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="ملاحظة داخلية (اختياري)"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                </section>

                <div className="reports-actions">
                  {selected.status !== 'reviewing' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={processing}
                      onClick={() => void setStatus('reviewing')}
                    >
                      <Eye size={16} />
                      قيد المراجعة
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={processing}
                    onClick={() => void setStatus('resolved')}
                  >
                    <CheckCircle2 size={16} />
                    تم الحل
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={processing}
                    onClick={() => void setStatus('dismissed')}
                  >
                    <XCircle size={16} />
                    رفض / إغلاق
                  </button>
                  {selected.status !== 'pending' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={processing}
                      onClick={() => void setStatus('pending')}
                    >
                      <Clock size={14} />
                      إعادة للانتظار
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
