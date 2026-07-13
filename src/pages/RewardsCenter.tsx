import { useEffect, useState } from 'react';
import { Gift, Save, Cloud, Plus, Trash2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getRewardsCenterConfig,
  saveRewardsCenterConfig,
  DEFAULT_REWARDS_CENTER,
  logAdminAction,
  formatNumber,
  type ConfigRewardsCenter,
  type ConfigRewardTask,
  type ConfigCheckInDay,
} from '@/services/admin';

type Tab = 'general' | 'checkin' | 'daily' | 'newuser';

export default function RewardsCenterPage() {
  const [config, setConfig] = useState<ConfigRewardsCenter>(DEFAULT_REWARDS_CENTER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');

  const load = async () => {
    setLoading(true);
    let data = await getRewardsCenterConfig();
    if (!data) {
      data = DEFAULT_REWARDS_CENTER;
      await saveRewardsCenterConfig(data);
    }
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (p: Partial<ConfigRewardsCenter>) => setConfig((c) => ({ ...c, ...p }));

  const updateTask = (section: 'dailyTasks' | 'newUserTasks', idx: number, p: Partial<ConfigRewardTask>) => {
    setConfig((c) => {
      const list = [...c[section]];
      list[idx] = { ...list[idx]!, ...p };
      return { ...c, [section]: list };
    });
  };

  const addTask = (section: 'dailyTasks' | 'newUserTasks') => {
    const id = `task-${Date.now()}`;
    const task: ConfigRewardTask = {
      id,
      enabled: true,
      order: config[section].length + 1,
      titleAr: 'مهمة جديدة',
      titleEn: 'New task',
      metric: 'game_bet',
      target: 1,
      rewardType: 'coins',
      rewardAmount: 5,
      route: '/games/wheel',
      iconKey: 'game',
    };
    patch({ [section]: [...config[section], task] });
  };

  const removeTask = (section: 'dailyTasks' | 'newUserTasks', idx: number) => {
    patch({ [section]: config[section].filter((_, i) => i !== idx) });
  };

  const updateCheckInDay = (
    section: 'freeCheckInDays' | 'premiumCheckInDays',
    idx: number,
    p: Partial<ConfigCheckInDay>,
  ) => {
    setConfig((c) => {
      const list = [...c[section]];
      list[idx] = { ...list[idx]!, ...p };
      return { ...c, [section]: list };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveRewardsCenterConfig(config);
    await logAdminAction('حفظ مركز المكافآت', config.titleAr);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  if (loading) return <Loading />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'عام' },
    { id: 'checkin', label: 'تسجيل الدخول' },
    { id: 'daily', label: 'المهام اليومية' },
    { id: 'newuser', label: 'مهام الجدد' },
  ];

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
          <Cloud size={16} /> مرتبط بالتطبيق — التعديلات فورية
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.id)}>
            <Gift size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 800, display: 'grid', gap: 14 }}>
        {tab === 'general' && (
          <>
            <h3 style={{ margin: 0 }}>إعدادات عامة</h3>
            <label className="form-label">
              <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
              {' '}مفعّل في التطبيق
            </label>
            <div className="form-row">
              <label className="form-label">العنوان (عربي)
                <input className="form-input" value={config.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
              </label>
              <label className="form-label">تسمية البطاقات (عربي)
                <input className="form-input" value={config.freeCardsLabelAr} onChange={(e) => patch({ freeCardsLabelAr: e.target.value })} />
              </label>
            </div>
            <label className="form-label">وصف المهام اليومية
              <input className="form-input" value={config.dailyTasksSubtitleAr} onChange={(e) => patch({ dailyTasksSubtitleAr: e.target.value })} />
            </label>
            <label className="form-label">وصف مهام الجدد
              <input className="form-input" value={config.newUserTasksSubtitleAr} onChange={(e) => patch({ newUserTasksSubtitleAr: e.target.value })} />
            </label>
          </>
        )}

        {tab === 'checkin' && (
          <>
            <h3 style={{ margin: 0 }}>تسجيل الدخول والترقية</h3>
            <div className="form-row">
              <label className="form-label">سعر الترقية (كوينز)
                <input className="form-input" type="number" value={config.upgradePriceCoins}
                  onChange={(e) => patch({ upgradePriceCoins: Number(e.target.value) || 0 })} />
              </label>
              <label className="form-label">عرض السعر (مثل $1.99)
                <input className="form-input" value={config.upgradePriceLabel} onChange={(e) => patch({ upgradePriceLabel: e.target.value })} />
              </label>
            </div>
            <label className="form-label">نص معلومات الترقية
              <input className="form-input" value={config.premiumMaxInfoAr} onChange={(e) => patch({ premiumMaxInfoAr: e.target.value })} />
            </label>
            <label className="form-label">نص نافذة الشرح
              <textarea className="form-input" rows={4} value={config.upgradeModalAr} onChange={(e) => patch({ upgradeModalAr: e.target.value })} />
            </label>

            <strong>مكافآت المجانية (7 أيام)</strong>
            {config.freeCheckInDays.map((d, idx) => (
              <div key={d.day} className="form-row" style={{ alignItems: 'end' }}>
                <label className="form-label">يوم {d.day}
                  <select className="form-input" value={d.rewardType}
                    onChange={(e) => updateCheckInDay('freeCheckInDays', idx, { rewardType: e.target.value as ConfigCheckInDay['rewardType'] })}>
                    <option value="coins">كوينز 🪙</option>
                    <option value="pearls">ماسة (Pearls) 💎</option>
                    <option value="message_cards">بطاقة رسائل 💌</option>
                    <option value="frame">إطار</option>
                    <option value="gift">هدية</option>
                  </select>
                </label>
                <label className="form-label">الكمية
                  <input className="form-input" type="number" value={d.amount}
                    onChange={(e) => updateCheckInDay('freeCheckInDays', idx, { amount: Number(e.target.value) || 0 })} />
                </label>
              </div>
            ))}

            <strong style={{ marginTop: 12 }}>مكافآت الترقية (7 أيام)</strong>
            {config.premiumCheckInDays.map((d, idx) => (
              <div key={`p-${d.day}`} className="form-row" style={{ alignItems: 'end' }}>
                <label className="form-label">يوم {d.day}
                  <input className="form-input" type="number" value={d.amount}
                    onChange={(e) => updateCheckInDay('premiumCheckInDays', idx, { amount: Number(e.target.value) || 0 })} />
                </label>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>كوينز</span>
              </div>
            ))}
            <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13 }}>
              إجمالي الترقية: <strong>{formatNumber(config.premiumCheckInDays.reduce((s, d) => s + d.amount, 0))}</strong> كوين
            </div>
          </>
        )}

        {(tab === 'daily' || tab === 'newuser') && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{tab === 'daily' ? 'المهام اليومية' : 'مهام المستخدمين الجدد'}</h3>
              <button className="btn btn-ghost" onClick={() => addTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks')}>
                <Plus size={14} /> مهمة
              </button>
            </div>
            {(tab === 'daily' ? config.dailyTasks : config.newUserTasks).map((task, idx) => (
              <div key={task.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label><input type="checkbox" checked={task.enabled}
                    onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { enabled: e.target.checked })} /> مفعّلة</label>
                  <button className="action-icon ban" onClick={() => removeTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <input className="form-input" value={task.titleAr} placeholder="العنوان"
                  onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { titleAr: e.target.value })} />
                <div className="form-row">
                  <label className="form-label">المقياس
                    <select className="form-input" value={task.metric}
                      onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { metric: e.target.value })}>
                      <option value="messages_to_female">5 رسائل لفتاة</option>
                      <option value="relationship_level_2">مستوى علاقة 2</option>
                      <option value="chat_rounds">جولات دردشة</option>
                      <option value="game_bet">مراهنة لعبة</option>
                      <option value="profile_complete">اكتمال الملف</option>
                    </select>
                  </label>
                  <label className="form-label">الهدف
                    <input className="form-input" type="number" value={task.target}
                      onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { target: Number(e.target.value) || 1 })} />
                  </label>
                </div>
                <div className="form-row">
                  <label className="form-label">المكافأة
                    {/* إصلاح #21 — أضفنا pearls (ماسة) خياراً صريحاً */}
                    <select className="form-input" value={task.rewardType}
                      onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { rewardType: e.target.value as 'coins' | 'message_cards' | 'pearls' })}>
                      <option value="coins">كوينز 🪙</option>
                      <option value="pearls">ماسة (Pearls) 💎</option>
                      <option value="message_cards">بطاقات رسائل 💌</option>
                    </select>
                  </label>
                  <label className="form-label">الكمية
                    <input className="form-input" type="number" value={task.rewardAmount}
                      onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { rewardAmount: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="form-label">المسار
                    <input className="form-input" value={task.route}
                      onChange={(e) => updateTask(tab === 'daily' ? 'dailyTasks' : 'newUserTasks', idx, { route: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
