import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PartyPopper, Radio, Users, Gift, Clock, RefreshCw, Square, Check, X, Calendar,
} from 'lucide-react';
import { Badge } from '@/components/Common';
import {
  getAgencyPartyEventsAll,
  getPartyLiveStats,
  getPartyLifecyclePhase,
  partyEventEndAt,
  reviewAgencyPartyRequest,
  stopAgencyPartyEvent,
  PARTY_EVENT_TYPE_LABELS,
  PARTY_LIFECYCLE_LABELS,
  formatNumber,
  timeAgo,
  type AdminAgencyPartyRequest,
  type AdminPartyLiveStats,
  type PartyLifecyclePhase,
} from '@/services/admin';

type PartyTab = 'all' | 'live' | 'scheduled' | 'pending' | 'history';

const TAB_ITEMS: { key: PartyTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'live', label: 'قائمة الآن' },
  { key: 'scheduled', label: 'مجدولة' },
  { key: 'pending', label: 'بانتظار الموافقة' },
  { key: 'history', label: 'السجل' },
];

const PHASE_BADGE: Record<PartyLifecyclePhase, 'green' | 'gold' | 'blue' | 'gray' | 'purple'> = {
  live: 'green',
  scheduled: 'blue',
  pending: 'gold',
  ended: 'gray',
  cancelled: 'purple',
  rejected: 'gray',
};

function formatRange(startAt: number, durationMinutes: number, stoppedAt?: number) {
  const endAt = partyEventEndAt({ startAt, durationMinutes, stoppedAt });
  const start = new Date(startAt).toLocaleString('ar');
  const end = new Date(endAt).toLocaleString('ar', { hour: '2-digit', minute: '2-digit' });
  return `${start} → ${end}`;
}

function remainingLabel(endAt: number, now = Date.now()) {
  const ms = endAt - now;
  if (ms <= 0) return 'انتهت';
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} د متبقية`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} س ${m} د`;
}

interface Props {
  agencyId: string;
  liveRoomId?: string;
  onChanged?: () => void;
}

export default function AgencyPartyManager({ agencyId, liveRoomId, onChanged }: Props) {
  const [events, setEvents] = useState<AdminAgencyPartyRequest[]>([]);
  const [tab, setTab] = useState<PartyTab>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statsById, setStatsById] = useState<Record<string, AdminPartyLiveStats>>({});
  const [statsBusy, setStatsBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const list = await getAgencyPartyEventsAll(agencyId);
      setEvents(list);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const phases = useMemo(
    () => events.map((e) => ({ event: e, phase: getPartyLifecyclePhase(e) })),
    [events],
  );

  const counts = useMemo(() => {
    const c = { live: 0, scheduled: 0, pending: 0, history: 0 };
    for (const { phase } of phases) {
      if (phase === 'live') c.live += 1;
      else if (phase === 'scheduled') c.scheduled += 1;
      else if (phase === 'pending') c.pending += 1;
      else c.history += 1;
    }
    return c;
  }, [phases]);

  const filtered = useMemo(() => {
    if (tab === 'all') return phases;
    if (tab === 'live') return phases.filter((p) => p.phase === 'live');
    if (tab === 'scheduled') return phases.filter((p) => p.phase === 'scheduled');
    if (tab === 'pending') return phases.filter((p) => p.phase === 'pending');
    return phases.filter((p) => ['ended', 'cancelled', 'rejected'].includes(p.phase));
  }, [phases, tab]);

  const refreshStats = async (event: AdminAgencyPartyRequest, phase: PartyLifecyclePhase) => {
    if (!event.roomId) return;
    setStatsBusy(event.id);
    try {
      const now = Date.now();
      const to = phase === 'live' ? now : partyEventEndAt(event);
      const from = event.startAt;
      const stats = await getPartyLiveStats(event.roomId, { from, to: Math.max(from, to) });
      setStatsById((prev) => ({ ...prev, [event.id]: stats }));
    } finally {
      setStatsBusy(null);
    }
  };

  const refreshAllLiveStats = async () => {
    const live = phases.filter((p) => p.phase === 'live');
    await Promise.all(live.map(({ event, phase }) => refreshStats(event, phase)));
  };

  useEffect(() => {
    if (counts.live > 0) {
      void refreshAllLiveStats();
    }
  }, [counts.live, events.length]);

  const handleApprove = async (req: AdminAgencyPartyRequest) => {
    if (!confirm(`الموافقة على حفلة "${req.description.slice(0, 50)}"؟`)) return;
    setBusy(`approve-${req.id}`);
    try {
      await reviewAgencyPartyRequest(req.id, 'approve');
      await load();
      onChanged?.();
      alert('تمت الموافقة — ستظهر في برنامج الحفل.');
    } catch (e: unknown) {
      alert('فشل: ' + ((e as Error)?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (req: AdminAgencyPartyRequest) => {
    const reason = prompt('سبب الرفض (اختياري):') ?? 'مرفوض';
    if (reason === null) return;
    setBusy(`reject-${req.id}`);
    try {
      await reviewAgencyPartyRequest(req.id, 'reject', { rejectionReason: reason });
      await load();
      onChanged?.();
    } catch (e: unknown) {
      alert('فشل: ' + ((e as Error)?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async (req: AdminAgencyPartyRequest, phase: PartyLifecyclePhase) => {
    const label = phase === 'live' ? 'إيقاف الحفلة القائمة' : 'إلغاء الحفلة المجدولة';
    if (!confirm(`${label} "${req.description.slice(0, 50)}"؟\n\nستختفي من التطبيق فوراً.`)) return;
    const reason = prompt('سبب الإيقاف (اختياري):') ?? 'أوقفتها الإدارة';
    if (reason === null) return;
    setBusy(`stop-${req.id}`);
    try {
      await stopAgencyPartyEvent(req.id, { reason });
      await load();
      onChanged?.();
      alert('تم إيقاف الفعالية.');
    } catch (e: unknown) {
      alert('فشل: ' + ((e as Error)?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const liveHighlight = counts.live > 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PartyPopper size={18} color="#d21e2a" />
            برنامج الحفلات / الفعاليات
            {liveHighlight && <Badge variant="green">LIVE {counts.live}</Badge>}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            إدارة كاملة حسب الحالة — حضور، دعم (هدايا)، إيقاف فوري
            {liveRoomId ? ` · غرفة الوكالة: ${liveRoomId.slice(0, 10)}…` : ''}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> تحديث
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
        <MiniStat icon={<Radio size={18} color="#10B981" />} value={counts.live} label="قائمة الآن" highlight={counts.live > 0} />
        <MiniStat icon={<Calendar size={18} color="#b00814" />} value={counts.scheduled} label="مجدولة" />
        <MiniStat icon={<Clock size={18} color="#F59E0B" />} value={counts.pending} label="بانتظار الموافقة" />
        <MiniStat icon={<PartyPopper size={18} color="#9CA3AF" />} value={counts.history} label="منتهية / موقوفة" />
      </div>

      {liveHighlight && (
        <div className="agency-alert-banner" style={{ marginBottom: 14, background: 'rgba(16,185,129,0.1)', borderColor: '#10B981', color: '#047857' }}>
          <Radio size={18} />
          {counts.live} حفلة قائمة الآن — يمكنك متابعة الحضور والدعم وإيقافها من البطاقات أدناه
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {TAB_ITEMS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'live' && counts.live > 0 ? ` (${counts.live})` : ''}
            {t.key === 'pending' && counts.pending > 0 ? ` (${counts.pending})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          لا توجد فعاليات في هذا القسم
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(({ event, phase }) => {
            const stats = statsById[event.id];
            const endAt = partyEventEndAt(event);
            const showStats = phase === 'live' || phase === 'ended' || phase === 'cancelled';
            return (
              <div
                key={event.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: phase === 'live' ? '1px solid rgba(16,185,129,0.35)' : '1px solid var(--border-light)',
                  background: phase === 'live'
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(210,30,42,0.06))'
                    : phase === 'pending'
                      ? 'rgba(245,158,11,0.06)'
                      : 'var(--bg-hover, #F9FAFB)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <Badge variant={PHASE_BADGE[phase]}>{PARTY_LIFECYCLE_LABELS[phase]}</Badge>
                      <Badge variant="purple">{PARTY_EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</Badge>
                      {event.allowPublicPromotion && <Badge variant="blue">ترويج عام</Badge>}
                      {phase === 'live' && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
                          {remainingLabel(endAt)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{event.description}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                      <div>{formatRange(event.startAt, event.durationMinutes, event.stoppedAt)} · {event.durationMinutes} د</div>
                      <div>
                        {event.requesterName} · غرفة {event.roomId.slice(0, 10)}… · {timeAgo(event.createdAt)}
                      </div>
                      {event.stopReason && phase === 'cancelled' && (
                        <div style={{ color: '#e11212' }}>سبب الإيقاف: {event.stopReason}</div>
                      )}
                      {event.rejectionReason && phase === 'rejected' && (
                        <div>سبب الرفض: {event.rejectionReason}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {phase === 'pending' && (
                      <>
                        <button type="button" className="btn-primary" disabled={!!busy} onClick={() => void handleApprove(event)}>
                          <Check size={14} /> موافقة
                        </button>
                        <button type="button" className="btn-danger" disabled={!!busy} onClick={() => void handleReject(event)}>
                          <X size={14} /> رفض
                        </button>
                      </>
                    )}
                    {(phase === 'live' || phase === 'scheduled') && (
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={!!busy}
                        onClick={() => void handleStop(event, phase)}
                      >
                        <Square size={14} /> {phase === 'live' ? 'إيقاف الآن' : 'إلغاء'}
                      </button>
                    )}
                    {showStats && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={statsBusy === event.id}
                        onClick={() => void refreshStats(event, phase)}
                      >
                        <RefreshCw size={14} /> {stats ? 'تحديث الإحصائيات' : 'عرض الإحصائيات'}
                      </button>
                    )}
                  </div>
                </div>

                {showStats && stats && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: 10,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <StatPill icon={<Users size={15} />} label="في الغرفة" value={String(stats.roomMemberCount)} />
                    <StatPill icon={<Users size={15} color="#b00814" />} label="حضور مباشر" value={String(stats.audienceCount)} />
                    <StatPill icon={<Gift size={15} color="#d21e2a" />} label="دعم (هدايا)" value={formatNumber(stats.supportCoins)} />
                    <StatPill icon={<Gift size={15} />} label="عدد الهدايا" value={String(stats.giftCount)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon, value, label, highlight,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="stat-card"
      style={{
        padding: 12,
        border: highlight ? '1px solid rgba(16,185,129,0.35)' : undefined,
        background: highlight ? 'rgba(16,185,129,0.06)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 10, padding: '8px 10px', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
    </div>
  );
}
