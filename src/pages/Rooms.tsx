import { useEffect, useState } from 'react';
import { Search, Radio, Lock, LockOpen, Users, Gift, Wifi, X, Trash2, Mic, EyeOff } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import {
  getRooms, getRoomById, forceCloseRoom, deleteRoom, logAdminAction,
  setRoomLocked, setRoomSeatsCount, AGENCY_SEAT_OPTIONS,
  formatNumber, type AdminRoom,
} from '@/services/admin';
import { AVATAR_FALLBACK } from '@/utils/avatarFallback';

type RoomFilter = 'all' | 'agency' | 'private';

export default function RoomsPage() {
  const { isSuper, can } = useAdminProfile();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seatRoom, setSeatRoom] = useState<AdminRoom | null>(null);
  const [idSearchResult, setIdSearchResult] = useState<AdminRoom | null | undefined>(undefined);
  const [idSearching, setIdSearching] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    setIdSearchResult(undefined);
    getRooms().then((r) => { setRooms(r); setLoading(false); }).catch((e) => {
      console.error('load rooms', e);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الغرف');
      setLoading(false);
    });
  };

  useEffect(load, []);

  // إصلاح #24 — بحث مباشر بالمعرّف عند الضغط على Enter أو الزر
  const handleIdSearch = async () => {
    const q = search.trim();
    if (!q) return;
    // أولاً: ابحث في الذاكرة
    const inMemory = rooms.find((r) => r.id === q || r.id.includes(q));
    if (inMemory) { setIdSearchResult(inMemory); return; }
    // ثانياً: اذهب مباشرة إلى Realtime DB
    setIdSearching(true);
    const found = await getRoomById(q);
    setIdSearchResult(found ?? null);
    setIdSearching(false);
  };

  const baseFiltered = rooms.filter((r) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.hostName?.toLowerCase().includes(q);
    const matchFilter =
      filter === 'agency' ? r.isAgencyRoom :
      filter === 'private' ? r.isPrivate :
      true;
    return matchSearch && matchFilter;
  });

  // إذا كان نتيجة بحث مباشرة موجودة، نعرضها فقط
  const filtered = idSearchResult !== undefined
    ? (idSearchResult ? [idSearchResult] : [])
    : baseFiltered;

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

  // إصلاح #25 — تبديل حالة القفل
  const handleToggleLock = async (room: AdminRoom) => {
    const nextLocked = !room.isLocked;
    const action = nextLocked ? 'قفل الغرفة' : 'فتح الغرفة';
    if (!confirm(`${action} "${room.name}"؟`)) return;
    setBusy(room.id);
    try {
      await setRoomLocked(room.id, nextLocked);
      await logAdminAction(action, room.name, room.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleSetSeats = async (room: AdminRoom, seatsCount: typeof AGENCY_SEAT_OPTIONS[number]) => {
    if ((room.seatsCount ?? 9) === seatsCount) { setSeatRoom(null); return; }
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

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
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
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Gift size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{formatNumber(rooms.reduce((s, r) => s + (r.totalGifts ?? 0), 0))}</div>
          <div className="stat-card-label">إجمالي الهدايا</div>
        </div>
        {/* إصلاح #29 — عداد الغرف الخاصة */}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <EyeOff size={26} color="#8B5CF6" />
          </div>
          <div className="stat-card-value">{rooms.filter((r) => r.isPrivate).length}</div>
          <div className="stat-card-label">غرف خاصة</div>
        </div>
      </div>

      <div className="filters-bar" style={{ gap: 10, flexWrap: 'wrap' }}>
        {/* إصلاح #24 — بحث مباشر بالمعرّف */}
        <div className="search-box" style={{ flexGrow: 1 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="ابحث عن غرفة باسمها أو معرّفها..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIdSearchResult(undefined); }}
            onKeyDown={(e) => e.key === 'Enter' && void handleIdSearch()}
          />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void handleIdSearch()}
          disabled={idSearching || !search.trim()}
          style={{ whiteSpace: 'nowrap' }}
          title="بحث مباشر في قاعدة البيانات بالمعرّف الكامل"
        >
          {idSearching ? '...' : 'بحث بالمعرّف'}
        </button>
        {idSearchResult !== undefined && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setIdSearchResult(undefined); setSearch(''); }}
            style={{ whiteSpace: 'nowrap' }}
          >
            <X size={14} /> مسح
          </button>
        )}

        {/* إصلاح #29 — فلترة النوع */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            ['all', 'الكل'],
            ['agency', 'وكالات'],
            ['private', 'خاصة'],
          ] as [RoomFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={() => { setFilter(key); setIdSearchResult(undefined); }}
            >
              {label}
            </button>
          ))}
        </div>

        <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontWeight: 600 }}>
          {idSearchResult !== undefined
            ? (idSearchResult ? '1 نتيجة (بحث مباشر)' : 'لم تُوجد الغرفة')
            : `${filtered.length} غرفة`}
        </span>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, marginBottom: 12, color: 'var(--danger, #EF4444)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {idSearchResult === null && (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          لم يتم العثور على غرفة بهذا المعرّف في قاعدة البيانات.
        </div>
      )}

      <div className="card">
        {!isSuper && !can('rooms:view') ? (
          <Empty text="غير مصرح لك بعرض الغرف الصوتية. يرجى مراجعة المسؤول." />
        ) : loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="لا توجد غرف" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الغرفة</th>
                  <th>الدولة</th>
                  <th>المضيف</th>
                  <th>الفئة</th>
                  <th>المقاعد</th>
                  <th>الأعضاء</th>
                  <th>الهدايا</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="table-user">
                        <img src={r.banner || AVATAR_FALLBACK} alt="" loading="lazy" style={{ borderRadius: 10 }} />
                        <div className="table-user-info">
                          <p>
                            {r.name}
                            {r.isLocked && <Lock size={12} style={{ display: 'inline', marginRight: 4, color: '#F59E0B' }} />}
                            {r.isPrivate && <EyeOff size={12} style={{ display: 'inline', marginRight: 4, color: '#8B5CF6' }} />}
                          </p>
                          <span>{r.id}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="blue">{r.country || '—'}</Badge></td>
                    <td style={{ fontSize: 13 }}>{r.hostName || r.hostUid?.slice(0, 10)}</td>
                    <td>
                      <Badge variant={r.isPrivate ? 'purple' : r.isAgencyRoom ? 'green' : 'gray'}>
                        {r.isPrivate ? 'خاصة' : r.category || 'عام'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setSeatRoom(r)}
                        disabled={busy === r.id || (!isSuper && !can('rooms:seats'))}
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
                        {r.isActive && (isSuper || can('rooms:close')) && (
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
                        {/* إصلاح #25 — زر القفل/الفتح */}
                        {(isSuper || can('rooms:lock')) && (
                          <button
                            className="action-icon"
                            onClick={() => handleToggleLock(r)}
                            disabled={busy === r.id}
                            title={r.isLocked ? 'فتح الغرفة' : 'قفل الغرفة'}
                            style={{ color: r.isLocked ? '#10B981' : '#8B5CF6' }}
                          >
                            {r.isLocked ? <LockOpen size={15} /> : <Lock size={15} />}
                          </button>
                        )}
                        {(isSuper || can('rooms:delete')) && (
                          <button
                            className="action-icon delete"
                            onClick={() => handleDelete(r)}
                            disabled={busy === r.id}
                            title="حذف نهائي"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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
              {seatRoom.isAgencyRoom ? ' (غرفة وكالة — يُحدَّث حد الوكالة أيضاً)' : ''}
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
