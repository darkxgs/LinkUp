import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Gift, Plus, Pencil, Trash2, X, Save, Coins, RotateCcw, Cloud } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getLuckyBagGifts, saveLuckyBagGifts, DEFAULT_LUCKY_BAG_GIFTS,
  logAdminAction, formatNumber, type LuckyBagGift,
} from '@/services/admin';

const ICON_OPTIONS = [
  'Flower2', 'Heart', 'Cake', 'Music', 'Star', 'Sparkles', 'Flame', 'Rainbow',
  'Diamond', 'Gem', 'Crown', 'Rocket', 'Castle', 'Car', 'Ship', 'Plane', 'Sun', 'Wand2', 'Gift',
];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const RARITY_LABEL: Record<string, string> = { common: 'عادي', rare: 'نادر', epic: 'ملحمي', legendary: 'أسطوري' };
const RARITY_VARIANT: Record<string, string> = { common: 'gray', rare: 'blue', epic: 'purple', legendary: 'gold' };

const EMPTY: LuckyBagGift = {
  id: '', name: '', iconName: 'Gift', iconColor: '#e11e2a', value: 100, weight: 10, rarity: 'common',
};

export default function LuckyBagPage() {
  const [gifts, setGifts] = useState<LuckyBagGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LuckyBagGift | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const g = await getLuckyBagGifts();
    setGifts(g);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalWeight = gifts.reduce((sum, g) => sum + (g.weight || 0), 0);

  const handleSave = async (gift: LuckyBagGift) => {
    if (!gift.name.trim()) return;
    let updated: LuckyBagGift[];
    if (isNew) {
      const id = gift.id || `lb_${Date.now()}`;
      updated = [...gifts, { ...gift, id }];
      await logAdminAction('إضافة هدية حقيبة حظ', gift.name, `${gift.value} عملة`);
    } else {
      updated = gifts.map((g) => (g.id === gift.id ? gift : g));
      await logAdminAction('تعديل هدية حقيبة حظ', gift.name, `${gift.value} عملة`);
    }
    setGifts(updated);
    await saveLuckyBagGifts(updated);
    setEditing(null);
    setIsNew(false);
  };

  const handleDelete = async (gift: LuckyBagGift) => {
    if (!confirm(`حذف هدية "${gift.name}"؟`)) return;
    const updated = gifts.filter((g) => g.id !== gift.id);
    setGifts(updated);
    await saveLuckyBagGifts(updated);
    await logAdminAction('حذف هدية حقيبة حظ', gift.name);
  };

  const handleResetDefaults = async () => {
    if (!confirm('استعادة الهدايا الافتراضية؟ سيُستبدل الموجود حالياً.')) return;
    setGifts(DEFAULT_LUCKY_BAG_GIFTS);
    await saveLuckyBagGifts(DEFAULT_LUCKY_BAG_GIFTS);
    await logAdminAction('استعادة هدايا حقيبة الحظ الافتراضية', '');
  };

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> الهدايا تظهر عشوائياً عند فتح حقيبة الحظ في الغرف
        </div>
        <div style={{ display: 'flex', gap: 8, marginRight: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleResetDefaults}>
            <RotateCcw size={16} /> استعادة الافتراضي
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
            <Plus size={18} /> إضافة هدية
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(255,46,147,0.12)' }}>
            <Gift size={26} color="#e11e2a" />
          </div>
          <div className="stat-card-value">{gifts.length}</div>
          <div className="stat-card-label">عدد الهدايا</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(255,154,46,0.15)' }}>
            <Coins size={26} color="#FF9A2E" />
          </div>
          <div className="stat-card-value">{formatNumber(totalWeight)}</div>
          <div className="stat-card-label">مجموع الأوزان</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(155,43,240,0.12)' }}>
            <Icons.Sparkles size={26} color="#c21520" />
          </div>
          <div className="stat-card-value">
            {gifts.filter((g) => g.rarity === 'legendary' || g.rarity === 'epic').length}
          </div>
          <div className="stat-card-label">هدايا نادرة</div>
        </div>
      </div>

      {loading ? <Loading /> : gifts.length === 0 ? <Empty text="لا توجد هدايا — أضف هدية أو استعد الافتراضي" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {gifts.map((g) => {
            const IconComp = (Icons as any)[g.iconName] ?? Gift;
            const prob = totalWeight > 0 ? ((g.weight / totalWeight) * 100).toFixed(1) : '0';
            return (
              <div key={g.id} className="card" style={{ padding: 16, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4 }}>
                  <button className="action-icon edit" onClick={() => { setEditing(g); setIsNew(false); }}>
                    <Pencil size={14} />
                  </button>
                  <button className="action-icon ban" onClick={() => handleDelete(g)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{
                  width: 60, height: 60, borderRadius: 16, margin: '8px auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${g.iconColor}1A`,
                }}>
                  <IconComp size={30} color={g.iconColor} strokeWidth={2} />
                </div>
                <p style={{ fontWeight: 700, fontSize: 15, textAlign: 'center', marginBottom: 4 }}>{g.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                  <Coins size={14} color="#FF9A2E" />
                  <span style={{ fontWeight: 700, color: 'var(--gold-dark)' }}>{formatNumber(g.value)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>الوزن {g.weight}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#c21520' }}>{prob}%</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Badge variant={RARITY_VARIANT[g.rarity ?? 'common']}>{RARITY_LABEL[g.rarity ?? 'common']}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <LuckyBagEditModal
          form={editing}
          isNew={isNew}
          onClose={() => { setEditing(null); setIsNew(false); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function LuckyBagEditModal({
  form: initial, isNew, onClose, onSave,
}: {
  form: LuckyBagGift;
  isNew: boolean;
  onClose: () => void;
  onSave: (g: LuckyBagGift) => void;
}) {
  const [form, setForm] = useState<LuckyBagGift>(initial);
  const IconComp = (Icons as any)[form.iconName] ?? Gift;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? 'إضافة هدية جديدة' : 'تعديل الهدية'}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{
            width: 72, height: 72, borderRadius: 18, margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${form.iconColor}1A`,
          }}>
            <IconComp size={36} color={form.iconColor} />
          </div>

          <div className="form-group">
            <label className="form-label">اسم الهدية</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">القيمة (عملات)</label>
              <input className="form-input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الوزن الاحتمالي</label>
              <input className="form-input" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">الأيقونة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
              {ICON_OPTIONS.map((ic) => {
                const I = (Icons as any)[ic] ?? Gift;
                const active = form.iconName === ic;
                return (
                  <button key={ic} onClick={() => setForm({ ...form, iconName: ic })}
                    style={{
                      width: 42, height: 42, borderRadius: 10,
                      border: `2px solid ${active ? form.iconColor : 'var(--border)'}`,
                      background: active ? `${form.iconColor}12` : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                    <I size={20} color={active ? form.iconColor : 'var(--text-secondary)'} />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">اللون</label>
              <input className="form-input" type="color" value={form.iconColor} onChange={(e) => setForm({ ...form, iconColor: e.target.value })} style={{ height: 46, padding: 4 }} />
            </div>
            <div className="form-group">
              <label className="form-label">الندرة</label>
              <select className="form-input" value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as any })}>
                {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>
            <Save size={16} /> حفظ ونشر للتطبيق
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
