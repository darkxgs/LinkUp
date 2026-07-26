import { useEffect, useState } from 'react';
import { Save, Coins, Percent, Bell, Shield, Globe, Cloud, Gift, Database, Zap, Link2 } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getConfigSettings, saveConfigSettings, logAdminAction,
  seedAllConfig,
  type ConfigSettings,
} from '@/services/admin';
import { SHARE_LINK_BASE, SHARE_LINK_EXAMPLE } from '@/lib/shareLinks';

const DEFAULTS: ConfigSettings = {
  coinRate: 10000,
  minWithdraw: 10,
  minHostWithdraw: 10,
  minAgentWithdraw: 10,
  hostWithdrawAmounts: [10, 20, 40, 70, 100, 140, 200],
  agentWithdrawAmounts: [20, 55, 90, 130, 210, 300, 400, 510, 900],
  allowCustomHostWithdraw: true,
  allowCustomAgentWithdraw: true,
  hostAgentWithdrawWeekDays: [6],
  hostSelfWithdrawAnytime: true,
  agentWithdrawCooldownDays: 30,
  agentBatchDivisor: 5,
  pearlUsdRate: 1000,
  giftCommission: 30,
  agencyCommission: 20,
  bdReferralCommissionPercent: 10,
  bdReferralBenefitMonths: 6,
  transferCommission: 5,
  minTransferAmount: 100,
  coinsToPearlsRate: 50000,
  casinoToCoinsRate: 9000,
  casinoToPearlsRate: 1,
  selfWithdrawCommission: 10,
  agentWithdrawCommission: 2,
  lockedMessagePrice: 200,
  lockedMessageCommission: 20,
  maintenanceMode: false,
  allowRegistration: true,
  requireVerification: false,
  // الافتراضي «يتطلب موافقة الوكيل» ليطابق الباك-إند — كان false يُكتب صراحةً فيعطّل الموافقة
  agencyJoinRequiresApproval: true,
  welcomeBonus: 0,
  firstRechargeBonus: 50_000,
  inAppRechargeEnabled: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<ConfigSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState('');

  useEffect(() => {
    getConfigSettings().then((s) => {
      if (s) setSettings({ ...DEFAULTS, ...s });
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await saveConfigSettings(settings);
    await logAdminAction('تعديل إعدادات النظام', 'الإعدادات العامة');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSeed = async () => {
    if (!confirm('سيتم ملء الهدايا والعضويات والباقات بالقيم الافتراضية. متابعة؟')) return;
    setSeeding(true);
    setSeedResult('');
    const res = await seedAllConfig();
    setSeedResult(res.message);
    setSeeding(false);
    if (res.ok) {
      const s = await getConfigSettings();
      if (s) setSettings({ ...DEFAULTS, ...s });
    }
  };

  if (loading) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} /> مرتبط بالتطبيق — التعديلات تُطبّق فوراً
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Coins size={18} color="#F59E0B" /> الاقتصاد</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">سعر العملة (عملة لكل دولار)</label>
              <input className="form-input" type="number" value={settings.coinRate}
                onChange={(e) => setSettings({ ...settings, coinRate: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الحد الأدنى العام للسحب (ماسة)</label>
              <input className="form-input" type="number" value={settings.minWithdraw}
                onChange={(e) => setSettings({ ...settings, minWithdraw: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">كم ماسة = 1 دولار (للعرض)</label>
              <input className="form-input" type="number" value={settings.pearlUsdRate ?? 1000}
                onChange={(e) => setSettings({ ...settings, pearlUsdRate: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={14} /> مكافأة التسجيل (عملات)
              </label>
              <input className="form-input" type="number" value={settings.welcomeBonus}
                onChange={(e) => setSettings({ ...settings, welcomeBonus: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={14} /> هدية أول شحن — حساب عادي (عملات)
              </label>
              <input
                className="form-input"
                type="number"
                value={settings.firstRechargeBonus ?? 50_000}
                onChange={(e) => setSettings({ ...settings, firstRechargeBonus: +e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Percent size={18} color="#d21e2a" /> العمولات</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">عمولة الهدايا (%)</label>
              <input className="form-input" type="number" value={settings.giftCommission}
                onChange={(e) => setSettings({ ...settings, giftCommission: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">عمولة الوكالات (%)</label>
              <input className="form-input" type="number" value={settings.agencyCommission}
                onChange={(e) => setSettings({ ...settings, agencyCommission: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">عمولة BD — نسبة من دخل الوكالة المُحالة (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={settings.bdReferralCommissionPercent ?? 10}
                onChange={(e) => setSettings({ ...settings, bdReferralCommissionPercent: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                عندما يدعو وكيل مستخدماً لفتح وكالة عبر مركز BD
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">عمولة BD — مدة الاستفادة (أشهر)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="60"
                value={settings.bdReferralBenefitMonths ?? 6}
                onChange={(e) => setSettings({ ...settings, bdReferralBenefitMonths: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                من تاريخ تفعيل الوكالة الجديدة
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">عمولة التحويل بين المستخدمين (%)</label>
              <input className="form-input" type="number" min="0" max="100" value={settings.transferCommission ?? 5}
                onChange={(e) => setSettings({ ...settings, transferCommission: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الحد الأدنى لتحويل واحد (عملة/ماسة)</label>
              <input className="form-input" type="number" min="1" value={settings.minTransferAmount ?? 100}
                onChange={(e) => setSettings({ ...settings, minTransferAmount: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">🔒 سعر فتح الرسالة المقفلة (كوين)</label>
              <input className="form-input" type="number" min="0" value={settings.lockedMessagePrice ?? 200}
                onChange={(e) => setSettings({ ...settings, lockedMessagePrice: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">🔒 عمولة الإدارة من فتح الرسالة (%)</label>
              <input className="form-input" type="number" min="0" max="100" value={settings.lockedMessageCommission ?? 20}
                onChange={(e) => setSettings({ ...settings, lockedMessageCommission: +e.target.value })} />
            </div>
          </div>
        </div>

        {/* === قسم معدّلات التحويل الداخلي بين العملات === */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={18} color="#F59E0B" /> معدّلات التحويل بين العملات
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              "كم وحدة من المصدر = 1 وحدة من الهدف". مثال: 100 يعني 100 عملة = 1 ماسة.
            </p>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">كوينز ← ماسة (للسحب)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={settings.coinsToPearlsRate ?? 50000}
                onChange={(e) => setSettings({ ...settings, coinsToPearlsRate: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {(settings.coinsToPearlsRate ?? 50000).toLocaleString()} كوين = 1 ماسة
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">كازينو ← كوينز (المسار الوحيد للكازينو)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={settings.casinoToCoinsRate ?? 9000}
                onChange={(e) => setSettings({ ...settings, casinoToCoinsRate: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                1 كازينو = {(settings.casinoToCoinsRate ?? 9000).toLocaleString()} كوين
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">كازينو ← ماسة</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={settings.casinoToPearlsRate ?? 1}
                onChange={(e) => setSettings({ ...settings, casinoToPearlsRate: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                1 كازينو = {(settings.casinoToPearlsRate ?? 1).toLocaleString()} ماسة
              </p>
            </div>
            <p style={{ fontSize: 12, color: '#B45309', marginTop: 12, lineHeight: 1.6, padding: 10, background: '#FFFBEB', borderRadius: 8 }}>
              التحويل العكسي ممنوع: ماسة→كوينز، كوينز→كازينو، كازينو→ماسة. السحب بالماسة فقط.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={18} color="#e11212" /> قواعد السحب (ماسة فقط)
            </h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">الحد الأدنى — المضيفة</label>
              <input className="form-input" type="number" min="1"
                value={settings.minHostWithdraw ?? settings.minWithdraw ?? 10}
                onChange={(e) => setSettings({ ...settings, minHostWithdraw: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الحد الأدنى — الوكيل</label>
              <input className="form-input" type="number" min="1"
                value={settings.minAgentWithdraw ?? settings.minWithdraw ?? 10}
                onChange={(e) => setSettings({ ...settings, minAgentWithdraw: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">مبالغ سحب المضيفة (ماسة، مفصولة بفاصلة)</label>
              <input className="form-input" type="text"
                value={(settings.hostWithdrawAmounts ?? [10, 20, 40, 70, 100, 140, 200]).join(', ')}
                onChange={(e) => setSettings({
                  ...settings,
                  hostWithdrawAmounts: e.target.value.split(',').map((s) => +s.trim()).filter((n) => n > 0),
                })} />
            </div>
            <div className="form-group">
              <label className="form-label">مبالغ سحب الوكيل (ماسة، مفصولة بفاصلة)</label>
              <input className="form-input" type="text"
                value={(settings.agentWithdrawAmounts ?? [20, 55, 90, 130, 210, 300, 400, 510, 900]).join(', ')}
                onChange={(e) => setSettings({
                  ...settings,
                  agentWithdrawAmounts: e.target.value.split(',').map((s) => +s.trim()).filter((n) => n > 0),
                })} />
            </div>
            <div className="form-group">
              <label className="form-label">أيام السحب عبر الوكيل (0=أحد … 6=سبت)</label>
              <input className="form-input" type="text"
                value={(settings.hostAgentWithdrawWeekDays ?? [6]).join(', ')}
                onChange={(e) => setSettings({
                  ...settings,
                  hostAgentWithdrawWeekDays: e.target.value.split(',').map((s) => +s.trim()).filter((n) => n >= 0 && n <= 6),
                })} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>افتراضي: 6 (السبت — اليوم السادس)</p>
            </div>
            <div className="form-group">
              <label className="form-label">فترة سحب الوكيل (أيام)</label>
              <input className="form-input" type="number" min="1"
                value={settings.agentWithdrawCooldownDays ?? 30}
                onChange={(e) => setSettings({ ...settings, agentWithdrawCooldownDays: +e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">مضاعفات سحب الوكيل (مثلاً 5)</label>
              <input className="form-input" type="number" min="1"
                value={settings.agentBatchDivisor ?? 5}
                onChange={(e) => setSettings({ ...settings, agentBatchDivisor: +e.target.value })} />
            </div>
            <Toggle label="السماح بمبلغ مخصص للمضيفة" icon={Coins}
              checked={settings.allowCustomHostWithdraw !== false}
              onChange={(v) => setSettings({ ...settings, allowCustomHostWithdraw: v })} />
            <Toggle label="السماح بمبلغ مخصص للوكيل" icon={Coins}
              checked={settings.allowCustomAgentWithdraw !== false}
              onChange={(v) => setSettings({ ...settings, allowCustomAgentWithdraw: v })} />
            <Toggle label="السحب الذاتي للمضيفة في أي وقت" icon={Shield}
              checked={settings.hostSelfWithdrawAnytime !== false}
              onChange={(v) => setSettings({ ...settings, hostSelfWithdrawAnytime: v })} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Percent size={18} color="#10B981" /> عمولات السحب
            </h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">السحب الذاتي — كل الحسابات (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={settings.selfWithdrawCommission ?? 10}
                onChange={(e) => setSettings({ ...settings, selfWithdrawCommission: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>افتراضي 10% — USDT / PayPal / بنك</p>
            </div>
            <div className="form-group">
              <label className="form-label">حساب الوكيل — سحب ذاتي (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={settings.agentWithdrawCommission ?? 2}
                onChange={(e) => setSettings({ ...settings, agentWithdrawCommission: +e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>افتراضي 2%</p>
            </div>
            <div className="form-group">
              <label className="form-label">السحب بالنيابة عبر الوكيل (%)</label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ثابت 2% من إعداد agentWithdrawCommission — للمضيف/ة في وكالة</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={18} color="#e11212" /> النظام</h3>
          </div>
          <div className="card-body">
            <Toggle label="وضع الصيانة" icon={Shield} checked={settings.maintenanceMode}
              onChange={(v) => setSettings({ ...settings, maintenanceMode: v })} />
            <Toggle label="السماح بالتسجيل" icon={Globe} checked={settings.allowRegistration}
              onChange={(v) => setSettings({ ...settings, allowRegistration: v })} />
            <Toggle label="إلزام توثيق الحساب" icon={Bell} checked={settings.requireVerification}
              onChange={(v) => setSettings({ ...settings, requireVerification: v })} />
            <Toggle label="موافقة الوكيل على طلبات الانضمام (كود + دعوة)" icon={Shield}
              checked={!!settings.agencyJoinRequiresApproval}
              onChange={(v) => setSettings({ ...settings, agencyJoinRequiresApproval: v })} />
            <Toggle
              label="شحن داخل التطبيق (بوابة دفع)"
              icon={Zap}
              checked={!!settings.inAppRechargeEnabled}
              onChange={(v) => setSettings({ ...settings, inAppRechargeEnabled: v })}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', paddingRight: 4 }}>
              عند الإيقاف: الشحن يتم فقط من «المحفظة ← شحن سريع بالمعرّف» في لوحة التحكم.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Link2 size={18} color="#e11212" /> الروابط القانونية والتطبيق</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">شروط الخدمة (Terms of Service)</label>
              <input className="form-input" type="text" value={settings.termsUrl || ''}
                onChange={(e) => setSettings({ ...settings, termsUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">سياسة الخصوصية (Privacy Policy)</label>
              <input className="form-input" type="text" value={settings.privacyUrl || ''}
                onChange={(e) => setSettings({ ...settings, privacyUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">حقوق الملكية (Copyright Policy)</label>
              <input className="form-input" type="text" value={settings.copyrightUrl || ''}
                onChange={(e) => setSettings({ ...settings, copyrightUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">سلامة الأطفال (Child Safety)</label>
              <input className="form-input" type="text" value={settings.childSafetyUrl || ''}
                onChange={(e) => setSettings({ ...settings, childSafetyUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">إرشادات المجتمع (Community Guidelines)</label>
              <input className="form-input" type="text" value={settings.communityUrl || ''}
                onChange={(e) => setSettings({ ...settings, communityUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">من نحن (About Us)</label>
              <input className="form-input" type="text" value={settings.aboutUsUrl || ''}
                onChange={(e) => setSettings({ ...settings, aboutUsUrl: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">سياسة الاسترجاع (Return Policy)</label>
              <input className="form-input" type="text" value={settings.returnUrl || ''}
                onChange={(e) => setSettings({ ...settings, returnUrl: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={18} color="#b00814" /> Deep Linking — المشاركة
          </h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
            روابط المشاركة (غرف، بروفايل، منشورات) تُنشأ عبر Cloud Function وتُفتح على دومينك الرسمي.
          </p>
          <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>الدومين: </span>
              <a href={SHARE_LINK_BASE} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                {SHARE_LINK_BASE}
              </a>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>مثال: </span>
              <code style={{ fontSize: 12 }}>{SHARE_LINK_EXAMPLE}</code>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.5 }}>
            مسار <code>/r/*</code> على Vercel يُوجّه تلقائياً إلى Cloud Function <code>shareRedirect</code>.
            لـ App Links على iOS/Android: حدّث ملفات <code>.well-known</code> في <code>public/</code> بـ Team ID وبصمة الشهادة.
          </p>
        </div>
      </div>

      {/* بطاقة التهيئة الأولية */}
      <div className="card" style={{ marginTop: 20, border: '1px dashed var(--brand-primary)' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(225,18,18,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Database size={24} color="#e11212" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>التهيئة الأولية</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              املأ الهدايا والعضويات وباقات الشحن بالقيم الافتراضية بضغطة واحدة (لأول تشغيل)
            </p>
            {seedResult && (
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: seedResult.includes('نجاح') ? 'var(--success)' : 'var(--danger)' }}>
                {seedResult}
              </p>
            )}
          </div>
          <button className="btn btn-gold" onClick={handleSeed} disabled={seeding}>
            <Zap size={18} /> {seeding ? 'جارٍ التهيئة...' : 'تهيئة الآن'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> {saved ? 'تم الحفظ والنشر ✓' : 'حفظ ونشر للتطبيق'}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, icon: Icon, checked, onChange }: {
  label: string; icon: any; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={18} color="var(--text-secondary)" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      </div>
      <button onClick={() => onChange(!checked)}
        style={{
          width: 46, height: 26, borderRadius: 13, padding: 3,
          background: checked ? 'var(--brand-primary)' : 'var(--border)',
          transition: 'background 0.2s', display: 'flex',
          justifyContent: checked ? 'flex-start' : 'flex-end',
        }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}
