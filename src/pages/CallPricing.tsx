import { useEffect, useState } from 'react';
import { Phone, Video, Mic, Save, Cloud, Users, Info, MessageSquare, Image, AudioLines } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getConfigCallPricing,
  saveConfigCallPricing,
  DEFAULT_CONFIG_CALL_PRICING,
  logAdminAction,
  formatNumber,
  type ConfigCallPricing,
  type ConfigCallPricingRates,
} from '@/services/admin';

function CoinInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="call-pricing-field">
      <label>{label}</label>
      <div className="call-pricing-input-wrap">
        <span className="coin-suffix">كوينز</span>
        <input
          type="number"
          min={0}
          max={500000}
          step={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
    </div>
  );
}

function RateSection({
  title,
  subtitle,
  icon,
  rates,
  onChange,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rates: ConfigCallPricingRates;
  onChange: (next: ConfigCallPricingRates) => void;
}) {
  return (
    <div className="card call-pricing-card">
      <div className="card-header">
        <div className="call-pricing-card-title">
          <div className="call-pricing-card-icon">{icon}</div>
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="call-pricing-rate-block">
          <div className="call-pricing-rate-head">
            <div className="icon-wrap voice">
              <Mic size={16} />
            </div>
            <span>صوت — سعر الدقيقة</span>
          </div>
          <div className="call-pricing-fields">
            <CoinInput
              label="مطابقة/مكالمة صوت"
              value={rates.voicePerMinute}
              onChange={(voicePerMinute) => onChange({ ...rates, voicePerMinute })}
            />
          </div>
        </div>

        <div className="call-pricing-rate-block">
          <div className="call-pricing-rate-head">
            <div className="icon-wrap video">
              <Video size={16} />
            </div>
            <span>فيديو — الدقيقة الأولى ثم التالية</span>
          </div>
          <div className="call-pricing-fields two-col">
            <CoinInput
              label="الدقيقة الأولى"
              value={rates.videoFirstMinute}
              onChange={(videoFirstMinute) => onChange({ ...rates, videoFirstMinute })}
            />
            <CoinInput
              label="من الدقيقة الثانية"
              value={rates.videoAfterMinute}
              onChange={(videoAfterMinute) => onChange({ ...rates, videoAfterMinute })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CallPricingPage() {
  const [pricing, setPricing] = useState<ConfigCallPricing>(DEFAULT_CONFIG_CALL_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const p = await getConfigCallPricing();
      setPricing(p);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfigCallPricing(pricing);
      await logAdminAction(
        'تعديل تسعير المكالمات',
        'callPricing',
        `مطابقة صوت ${formatNumber(pricing.match.voicePerMinute)} | شات صوت ${formatNumber(pricing.chat.voicePerMinute)}`,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-container"><Loading /></div>;

  const msg = pricing.messages;
  const summaryItems = [
    { label: 'مطابقة — صوت/دقيقة', value: pricing.match.voicePerMinute },
    { label: 'مطابقة — فيديو (د1)', value: pricing.match.videoFirstMinute },
    { label: 'شات — صوت/دقيقة', value: pricing.chat.voicePerMinute },
    { label: 'شات — فيديو (د1)', value: pricing.chat.videoFirstMinute },
    ...(msg.enabled
      ? [
          { label: 'رسالة نصية', value: msg.textMessage },
          { label: 'رسالة صوتية', value: msg.voiceMessage },
          { label: 'إرسال صورة', value: msg.imageMessage },
        ]
      : []),
  ];

  return (
    <div className="page-container call-pricing-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Phone size={26} style={{ verticalAlign: 'middle', marginLeft: 8, color: 'var(--brand-primary)' }} />
            تسعير المكالمات والمطابقة والشات
          </h1>
          <p>
            ضبط أسعار المكالمات والمطابقة ورسائل الشات (نص، صوت، صور) بالكوينز — أي تعديل يُطبَّق فوراً في التطبيق.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saved ? '✓ تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ الأسعار'}
        </button>
      </div>

      <div className="call-pricing-sync">
        <Cloud size={16} />
        مرتبط بالتطبيق — التعديلات تُطبَّق فوراً على المطابقة والمكالمات
      </div>

      <div className="call-pricing-summary">
        {summaryItems.map((item) => (
          <div key={item.label} className="call-pricing-summary-item">
            <div className="label">{item.label}</div>
            <div className="value">
              {formatNumber(item.value)}
              <span>كوينز</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card call-pricing-card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="call-pricing-card-title">
            <div className="call-pricing-card-icon"><MessageSquare size={22} color="#e11212" /></div>
            <div>
              <h3>رسائل الشات</h3>
              <p>يُخصم من المرسل عند كل رسالة نصية أو صوتية أو صورة — حسابات الدعم معفاة</p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pricing.messages.enabled}
              onChange={(e) => setPricing((p) => ({
                ...p,
                messages: { ...p.messages, enabled: e.target.checked },
              }))}
            />
            <span>تفعيل تسعير رسائل الشات</span>
          </label>
          {pricing.messages.enabled && (
            <div className="call-pricing-fields three-col">
              <MessagePriceInput
                icon={<MessageSquare size={16} />}
                label="رسالة نصية"
                value={pricing.messages.textMessage}
                onChange={(textMessage) => setPricing((p) => ({
                  ...p,
                  messages: { ...p.messages, textMessage },
                }))}
              />
              <MessagePriceInput
                icon={<AudioLines size={16} />}
                label="تسجيل صوتي"
                value={pricing.messages.voiceMessage}
                onChange={(voiceMessage) => setPricing((p) => ({
                  ...p,
                  messages: { ...p.messages, voiceMessage },
                }))}
              />
              <MessagePriceInput
                icon={<Image size={16} />}
                label="إرسال صورة"
                value={pricing.messages.imageMessage}
                onChange={(imageMessage) => setPricing((p) => ({
                  ...p,
                  messages: { ...p.messages, imageMessage },
                }))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="call-pricing-grid">
        <RateSection
          title="مطابقة الصوت والفيديو"
          subtitle="المطابقة العشوائية — يُخصم من المستخدم غير المضيفة"
          icon={<Users size={22} color="#e11212" />}
          rates={pricing.match}
          onChange={(match) => setPricing((p) => ({ ...p, match }))}
        />
        <RateSection
          title="مكالمات الشات"
          subtitle="صوت وفيديو — تُخصم من المتصل عند الاتصال بمضيفة"
          icon={<Phone size={22} color="#e11212" />}
          rates={pricing.chat}
          onChange={(chat) => setPricing((p) => ({ ...p, chat }))}
        />
      </div>

      <div className="card call-pricing-notes">
        <h4>
          <Info size={16} color="var(--brand-primary)" />
          ملاحظات
        </h4>
        <ul>
          <li>مطابقة الصوت: سعر ثابت لكل دقيقة.</li>
          <li>مطابقة/مكالمة الفيديو: الدقيقة الأولى بسعر مختلف، ثم يُطبَّق سعر الدقيقة الثانية فما بعد.</li>
          <li>مكالمات الشات: تُخصم من المتصل عند الاتصال بمضيفة أنثى (ما لم يكن معفى).</li>
          <li>المطابقة العشوائية: يُخصم من المستخدم غير المضيفة أثناء المكالمة.</li>
          <li>رسائل الشات: يُخصم من المرسل لكل رسالة نصية أو صوتية أو صورة (قابل للتعطيل).</li>
          <li>محادثات الدعم الرسمية وحسابات النظام معفاة من رسوم الرسائل.</li>
        </ul>
      </div>
    </div>
  );
}

function MessagePriceInput({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="call-pricing-field">
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}
      </label>
      <div className="call-pricing-input-wrap">
        <span className="coin-suffix">كوينز</span>
        <input
          type="number"
          min={0}
          max={500000}
          step={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
    </div>
  );
}
