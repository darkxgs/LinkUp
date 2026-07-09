import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Gift, Crown, Sparkles, Image as ImageIcon, Check, Cloud } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  lookupUserByIdentifier,
  getConfigStoreState,
  getConfigVipSystem,
  getAristocracyConfig,
  getRoomFrames,
  grantStoreItemToUser,
  grantFrameToUser,
  grantVipLevelToUser,
  grantAristocracyToUser,
  logAdminAction,
  type ConfigStoreItem,
  type ConfigStoreCategory,
  type ConfigVipLevel,
  type ConfigAristocracyLevel,
  type RoomFrame,
} from '@/services/admin';

type GiftTab = 'store' | 'frames' | 'vip' | 'aristocracy';
type Resolved = { uid: string; displayName: string; avatar: string; publicAccountId: string };

const TABS: { key: GiftTab; label: string; icon: typeof Gift }[] = [
  { key: 'store', label: 'المتجر (دخوليات/فقاعات/...)', icon: Gift },
  { key: 'frames', label: 'إطارات الصورة', icon: ImageIcon },
  { key: 'vip', label: 'عضويات SVIP', icon: Crown },
  { key: 'aristocracy', label: 'الأرستقراطية', icon: Sparkles },
];

function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const id = String(x.id ?? '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function MediaThumb({ imageUrl, videoUrl, animationUrl, color }: {
  imageUrl?: string; videoUrl?: string; animationUrl?: string; color?: string;
}) {
  const img = imageUrl || animationUrl;
  const box: React.CSSProperties = {
    width: 56, height: 56, borderRadius: 10, objectFit: 'contain',
    border: '1px solid var(--border)', background: color || '#0e0e16', flexShrink: 0,
  };
  if (videoUrl && !img) return <video src={videoUrl} muted loop autoPlay playsInline style={{ ...box, objectFit: 'cover' }} />;
  if (img) return <img src={img} alt="" style={box} />;
  return <div style={{ ...box, display: 'grid', placeItems: 'center', color: '#888' }}><Gift size={22} /></div>;
}

export default function GiftPrivilegesPage() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GiftTab>('store');

  const [identifier, setIdentifier] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [granting, setGranting] = useState<string | null>(null);

  const [storeItems, setStoreItems] = useState<ConfigStoreItem[]>([]);
  const [storeCats, setStoreCats] = useState<ConfigStoreCategory[]>([]);
  const [storeCat, setStoreCat] = useState<string>('all');
  const [frames, setFrames] = useState<RoomFrame[]>([]);
  const [vipLevels, setVipLevels] = useState<ConfigVipLevel[]>([]);
  const [aristoLevels, setAristoLevels] = useState<ConfigAristocracyLevel[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [store, vip, aristo, frameList] = await Promise.all([
          getConfigStoreState(),
          getConfigVipSystem(),
          getAristocracyConfig(),
          getRoomFrames(),
        ]);
        setStoreItems(dedupeById(store.items.filter((i) => i.enabled !== false)));
        setStoreCats(dedupeById(store.categories.filter((c) => c.enabled !== false)));
        setFrames(dedupeById(frameList.filter((f) => f.enabled !== false)));
        setVipLevels(vip.levels.filter((l) => l.enabled !== false && l.level >= 1).sort((a, b) => a.level - b.level));
        setAristoLevels((aristo?.levels ?? []).filter((l) => l.enabled !== false).sort((a, b) => a.level - b.level));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLookup = async () => {
    const id = identifier.trim();
    if (!id) return;
    setResolving(true);
    setMsg(null);
    setResolved(null);
    try {
      const u = await lookupUserByIdentifier(id);
      setResolved({ uid: u.uid, displayName: u.displayName, avatar: u.avatar, publicAccountId: u.publicAccountId });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'تعذّر العثور على المستخدم' });
    } finally {
      setResolving(false);
    }
  };

  const runGrant = async (key: string, label: string, fn: () => Promise<void>) => {
    if (!resolved) {
      setMsg({ ok: false, text: 'ابحث عن المستخدم أولاً' });
      return;
    }
    setGranting(key);
    setMsg(null);
    try {
      await fn();
      const period = days > 0 ? `${days} يوم` : 'دائم';
      await logAdminAction('منح امتياز', resolved.displayName, `${label} → ${resolved.uid} (${period})`);
      setMsg({ ok: true, text: `تم منح «${label}» إلى ${resolved.displayName} (${period})` });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'فشل المنح' });
    } finally {
      setGranting(null);
    }
  };

  const filteredStore = useMemo(() => {
    const q = search.trim().toLowerCase();
    return storeItems.filter((i) =>
      (storeCat === 'all' || i.category === storeCat) &&
      (!q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
    );
  }, [storeItems, storeCat, search]);

  if (loading) return <Loading />;

  const catLabel = (id: string) => storeCats.find((c) => c.id === id)?.labels?.ar ?? id;

  return (
    <div className="page-container">
      <div className="filters-bar" style={{ alignItems: 'center' }}>
        <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Cloud size={16} /> منح الامتيازات — مرتبط بالتطبيق
        </div>
      </div>

      {/* بطاقة اختيار المستخدم + المدة */}
      <div className="card" style={{ padding: 18, marginBottom: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px' }}>
            <label className="form-label">المستخدم (ID أو الإيميل أو الرقم العام)</label>
            <input
              className="form-input"
              value={identifier}
              placeholder="uid / email@example.com / 12345678"
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleLookup(); }}
            />
          </div>
          <button className="btn btn-secondary" disabled={resolving} onClick={() => void handleLookup()}>
            {resolving ? <Loader2 size={16} className="spin" /> : <Search size={16} />} بحث
          </button>
          <div style={{ width: 150 }}>
            <label className="form-label">مدة الظهور (أيام، 0 = دائم)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        {resolved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, background: 'var(--surface-2, rgba(255,255,255,0.04))' }}>
            {resolved.avatar
              ? <img src={resolved.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#333', display: 'grid', placeItems: 'center' }}><Check size={18} /></div>}
            <div style={{ lineHeight: 1.5 }}>
              <strong>{resolved.displayName}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{resolved.publicAccountId} — {resolved.uid}</div>
            </div>
          </div>
        )}

        {msg && (
          <div style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? 'var(--success)' : 'var(--danger, #ef4444)' }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* تبويبات */}
      <div className="filters-bar" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* المتجر */}
      {tab === 'store' && (
        <>
          <div className="filters-bar" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              className="form-input"
              style={{ maxWidth: 240 }}
              placeholder="بحث بالاسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={`btn btn-sm ${storeCat === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStoreCat('all')}>الكل</button>
            {storeCats.map((c) => (
              <button key={c.id} className={`btn btn-sm ${storeCat === c.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStoreCat(c.id)}>
                {c.labels?.ar ?? c.id}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filteredStore.map((item) => (
              <div key={item.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <MediaThumb imageUrl={item.imageUrl} videoUrl={item.videoUrl || item.videoUrlMp4} animationUrl={item.animationUrl} color={item.bgColor1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{catLabel(item.category)}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!resolved || granting === `store:${item.id}`}
                  onClick={() => void runGrant(`store:${item.id}`, item.name, () => grantStoreItemToUser(resolved!.uid, item, days))}
                >
                  {granting === `store:${item.id}` ? <Loader2 size={14} className="spin" /> : <Gift size={14} />} منح
                </button>
              </div>
            ))}
            {filteredStore.length === 0 && <p style={{ color: 'var(--text-muted)' }}>لا عناصر مطابقة.</p>}
          </div>
        </>
      )}

      {/* الإطارات */}
      {tab === 'frames' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {frames.map((f) => (
            <div key={f.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <MediaThumb imageUrl={f.imageUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>إطار صورة</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={!resolved || granting === `frame:${f.id}`}
                onClick={() => void runGrant(`frame:${f.id}`, f.name, () => grantFrameToUser(resolved!.uid, f, days))}
              >
                {granting === `frame:${f.id}` ? <Loader2 size={14} className="spin" /> : <Gift size={14} />} منح
              </button>
            </div>
          ))}
          {frames.length === 0 && <p style={{ color: 'var(--text-muted)' }}>لا إطارات معرّفة.</p>}
        </div>
      )}

      {/* SVIP */}
      {tab === 'vip' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {vipLevels.map((l) => (
            <div key={l.level} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <MediaThumb imageUrl={l.imageUrl || l.imageAnimatedUrl} color={l.accentColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{l.label || `SVIP ${l.level}`}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>المستوى {l.level} — يفتح كل امتيازات هذا المستوى</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={!resolved || granting === `vip:${l.level}`}
                onClick={() => void runGrant(`vip:${l.level}`, l.label || `SVIP ${l.level}`, () => grantVipLevelToUser(resolved!.uid, l.level, days))}
              >
                {granting === `vip:${l.level}` ? <Loader2 size={14} className="spin" /> : <Crown size={14} />} منح
              </button>
            </div>
          ))}
          {vipLevels.length === 0 && <p style={{ color: 'var(--text-muted)' }}>لا مستويات SVIP مفعّلة.</p>}
        </div>
      )}

      {/* الأرستقراطية */}
      {tab === 'aristocracy' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {aristoLevels.map((l) => (
            <div key={l.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <MediaThumb imageUrl={l.imageUrl} color={l.accentColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{l.nameAr}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  تصنيف {l.level}{l.grantedVipLevel ? ` — يمنح SVIP ${l.grantedVipLevel}` : ''}
                </span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={!resolved || granting === `aristo:${l.level}`}
                onClick={() => void runGrant(`aristo:${l.level}`, l.nameAr, () => grantAristocracyToUser(resolved!.uid, l, days))}
              >
                {granting === `aristo:${l.level}` ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} منح
              </button>
            </div>
          ))}
          {aristoLevels.length === 0 && <p style={{ color: 'var(--text-muted)' }}>لا تصنيفات أرستقراطية مفعّلة.</p>}
        </div>
      )}
    </div>
  );
}
