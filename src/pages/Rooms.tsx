import { useEffect, useState } from 'react';
import { Search, Radio, Lock, Users, Gift, Wifi, X, Trash2, Mic } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getRooms, forceCloseRoom, deleteRoom, logAdminAction,
  setRoomSeatsCount, AGENCY_SEAT_OPTIONS,
  formatNumber, type AdminRoom,
} from '@/services/admin';
import { AVATAR_FALLBACK } from '@/utils/avatarFallback';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seatRoom, setSeatRoom] = useState<AdminRoom | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getRooms().then((r) => { setRooms(r); setLoading(false); }).catch((e) => {
      console.error('load rooms', e);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الغرف');
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search)
  );

  const handleClose = async (room: AdminRoom) => {
    if (!confirm(`إغلاق غرفة "${room.name}"؟ سيتم إخراج كل المشاركين.`)) return;
    setBusy(room.id);
    try {
      await forceCloseRoom(room.id);
      await logAdminAction('إغلاق روم', room.name, room.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (room: AdminRoom) => {
    if (!confirm(`حذف غرفة "${room.name}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    setBusy(room.id);
    try {
      await deleteRoom(room.id);
      await logAdminAction('حذف روم', room.name, room.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleSetSeats = async (room: AdminRoom, seatsCount: typeof AGENCY_SEAT_OPTIONS[number]) => {
    if ((room.seatsCount ?? 9) === seatsCount) {
      setSeatRoom(null);
      return;
    }
    if (!confirm(`تطبيق ${seatsCount} مايك على غرفة "${room.name}"؟\n\nسيتم إعادة بناء المقاعد فوراً.`)) return;
    setBusy(room.id);
    try {
      await setRoomSeatsCount(room.id, seatsCount);
      await logAdminAction('تعديل عدد المايكات', `${room.name} → ${seatsCount}`, room.id);
      setSeatRoom(null);
      load();
      alert(`تم تطبيق ${seatsCount} مايك على الغرفة.`);
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Radio size={22} color="#d21e2a" /> الغرف الصوتية المباشرة
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          غرف بث صوتي لحظية (Realtime DB) — تختلف عن «الوكالات». يمكنك إغلاق أي غرفة بثّ أو حذفها.
        </p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <Radio size={26} color="#d21e2a" />
          </div>
          <div className="stat-card-value">{rooms.length}</div>
          <div className="stat-card-label">إجمالي الغرف</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <Wifi size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{rooms.filter((r) => r.isActive).length}</div>
          <div className="stat-card-label">غرف نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(252,211,77,0.18)' }}>
            <Gift size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{formatNumber(rooms.reduce((s, r) => s + (r.totalGifts ?? 0), 0))}</div>
          <div className="stat-card-label">إجمالي الهدايا</div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} color="var(--text-muted)" />
          <input placeholder="ابحث عن غرفة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontWeight: 600 }}>{filtered.length} غرفة</span>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, marginBottom: 12, color: 'var(--danger, #EF4444)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty text="لا توجد غرف نشطة" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>الغرفة</th><th>الدولة</th><th>المضيف</th><th>الفئة</th><th>المقاعد</th><th>الأعضاء</th><th>الهدايا</th><th>الحالة</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="table-user">
                        <img src={r.banner || AVATAR_FALLBACK} alt="" loading="lazy" style={{ borderRadius: 10 }} />
                        <div className="table-user-info">
                          <p>{r.name} {r.isLocked && <Lock size={12} style={{ display: 'inline' }} />}</p>
                          <span>{r.id}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="blue">{r.country || '—'}</Badge></td>
                    <td style={{ fontSize: 13 }}>{r.hostName || r.hostUid?.slice(0, 10)}</td>
                    <td><Badge variant="purple">{r.category || 'عام'}</Badge></td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setSeatRoom(r)}
                        disabled={busy === r.id}
                        title="تعديل عدد المايكات"
                      >
                        <Mic size={13} />
                        {r.seatsCount ?? 9}
                        {r.maxSeatsCount && r.maxSeatsCount !== (r.seatsCount ?? 9) ? ` / ${r.maxSeatsCount}` : ''}
                        {r.isAgencyRoom ? ' · وكالة' : ''}
                      </button>
                    </td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} />{r.memberCount}</div></td>
                    <td style={{ fontWeight: 700 }}>{formatNumber(r.totalGifts ?? 0)}</td>
                    <td>{r.isActive ? <Badge variant="green">نشطة</Badge> : <Badge variant="gray">مغلقة</Badge>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.isActive && (
                          <button
                            className="action-icon"
                            onClick={() => handleClose(r)}
                            disabled={busy === r.id}
                            title="إغلاق الروم"
                            style={{ color: '#F59E0B' }}
                          >
                            <X size={15} />
                          </button>
                        )}
                        <button
                          className="action-icon delete"
                          onClick={() => handleDelete(r)}
                          disabled={busy === r.id}
                          title="حذف نهائي"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {seatRoom && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !busy && setSeatRoom(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={20} color="#d21e2a" />
              عدد المايكات — {seatRoom.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              الحالي: {seatRoom.seatsCount ?? 9} مايك
              {seatRoom.isAgencyRoom ? ' (غرفة وكالة — يُحدَّث حد الوكالة أيضاً)' : ''}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AGENCY_SEAT_OPTIONS.map((n) => {
                const active = (seatRoom.seatsCount ?? 9) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    className={active ? 'btn-primary' : 'btn-secondary'}
                    disabled={busy === seatRoom.id}
                    onClick={() => void handleSetSeats(seatRoom, n)}
                    style={{ minWidth: 52 }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => setSeatRoom(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
