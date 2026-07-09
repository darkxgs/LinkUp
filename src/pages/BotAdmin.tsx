/**
 * إدارة بوت تيليغرام — Lit-App Bot Admin
 * يتصل بـ https://www.api.linkuppay.store/docs
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Key,
  Users,
  Receipt,
  Coins,
  Activity,
  RefreshCw,
  Search,
  ExternalLink,
  Save,
  Power,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Layers,
  Cloud,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  formatNumber,
  getConfigSettings,
  getBotAdminPanelConfig,
  saveBotAdminPanelConfig,
  logAdminAction,
} from '@/services/admin';
import {
  botGetStats,
  botListOrders,
  botListUsers,
  botListAccessKeys,
  botListKeysPaginated,
  botCreateAccessKey,
  botCreateAccessKeysBulk,
  botDeleteAccessKey,
  botListRates,
  botGetRate,
  botUpdateRate,
  botDeactivateRate,
  botHealthCheck,
  botGetOrder,
  botGetUser,
  getBotAdminApiKey,
  setBotAdminApiKey,
  isBotAdminConfigured,
  BotAdminApiError,
  BOT_ADMIN_API_ENDPOINTS,
  type BotStatsResponse,
  type BotOrder,
  type BotUser,
  type BotAccessKey,
  type BotCoinRate,
} from '@/services/botAdminApi';

type Tab = 'overview' | 'orders' | 'users' | 'keys' | 'rates';

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: Activity },
  { id: 'orders', label: 'طلبات الشحن', icon: Receipt },
  { id: 'users', label: 'مستخدمو البوت', icon: Users },
  { id: 'keys', label: 'مفاتيح الوصول', icon: Key },
  { id: 'rates', label: 'أسعار الصرف', icon: Coins },
];

/** الشبكات المعتمدة على السيرفر */
const BOT_PAYMENT_CHAINS = ['tron', 'bsc', 'ethereum'] as const;

/** عملة الدفع المشفرة — ليست كوينز LinkUp */
const BOT_PAYMENT_COINS = ['USDT'] as const;

const DEFAULT_APP_COIN_RATE = 10_000;

/** باقة البوت الافتراضية: 10000 كوين LinkUp مقابل 0.93$ */
const DEFAULT_BOT_PACKAGE_COINS = 10_000;
const DEFAULT_BOT_PACKAGE_PRICE_USD = 0.93;

function coinsPerUsdFromPackage(coins: number, priceUsd: number): number {
  if (priceUsd <= 0 || coins <= 0) return 0;
  return Math.round((coins / priceUsd) * 100) / 100;
}

function estimateCoinsForPayment(usd: number, ratePerUsd: number): number {
  return Math.floor(usd * ratePerUsd);
}

function isValidPaymentCoin(coin: string): boolean {
  const t = coin.trim();
  return /^[A-Za-z]{2,10}$/.test(t) && !/^\d+$/.test(t);
}

function fmtIso(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function orderStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'success') return <Badge variant="green">مكتمل</Badge>;
  if (s === 'pending') return <Badge variant="gold">معلّق</Badge>;
  if (s === 'failed' || s === 'error') return <Badge variant="red">فشل</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

function normalizeKeyRow(row: BotAccessKey | Record<string, unknown>): BotAccessKey {
  const r = row as Record<string, unknown>;
  return {
    key: String(r.key ?? ''),
    is_claimed: r.is_claimed === true,
    claimed_by_user_id: r.claimed_by_user_id != null ? Number(r.claimed_by_user_id) : null,
    claimed_at: r.claimed_at != null ? String(r.claimed_at) : null,
    created_at: r.created_at != null ? String(r.created_at) : null,
  };
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function PaginationBar({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (next: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={offset <= 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        <ChevronRight size={16} /> السابق
      </button>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        صفحة {page} من {pages} — {total} عنصر
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}
      >
        التالي <ChevronLeft size={16} />
      </button>
    </div>
  );
}

export default function BotAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [configured, setConfigured] = useState(false);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [health, setHealth] = useState<{ status?: string; database?: string } | null>(null);
  const [stats, setStats] = useState<BotStatsResponse | null>(null);

  const [orders, setOrders] = useState<BotOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const ordersLimit = 50;
  const [orderStatus, setOrderStatus] = useState('');
  const [orderUserId, setOrderUserId] = useState('');
  const [orderTx, setOrderTx] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<BotOrder | null>(null);

  const [users, setUsers] = useState<BotUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const usersLimit = 50;
  const [userLookupId, setUserLookupId] = useState('');
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null);

  const [keys, setKeys] = useState<BotAccessKey[]>([]);
  const [keysTotal, setKeysTotal] = useState(0);
  const [keysOffset, setKeysOffset] = useState(0);
  const keysLimit = 100;
  const [keysFilter, setKeysFilter] = useState<'all' | 'claimed' | 'available'>('all');
  const [keysListMode, setKeysListMode] = useState<'paginated' | 'all'>('paginated');
  const [keyCreateCustom, setKeyCreateCustom] = useState('');
  const [keyCreatePrefix, setKeyCreatePrefix] = useState('LIT');
  const [keyBulkCount, setKeyBulkCount] = useState(10);
  const [keyBulkPrefix, setKeyBulkPrefix] = useState('LIT');
  const [keyBulkLength, setKeyBulkLength] = useState(24);
  const [keyBusy, setKeyBusy] = useState(false);
  const [createdKeys, setCreatedKeys] = useState<string[] | null>(null);

  const [rates, setRates] = useState<BotCoinRate[]>([]);
  const [appCoinRate, setAppCoinRate] = useState(DEFAULT_APP_COIN_RATE);
  const [packagePricing, setPackagePricing] = useState({
    coins: DEFAULT_BOT_PACKAGE_COINS,
    priceUsd: DEFAULT_BOT_PACKAGE_PRICE_USD,
  });
  const [rateForm, setRateForm] = useState({
    coin: 'USDT',
    chain: 'tron',
    rate_per_usd: coinsPerUsdFromPackage(DEFAULT_BOT_PACKAGE_COINS, DEFAULT_BOT_PACKAGE_PRICE_USD),
  });
  const [rateLookup, setRateLookup] = useState({ coin: 'USDT', chain: 'tron' });
  const [rateLookupResult, setRateLookupResult] = useState<BotCoinRate | null>(null);
  const [rateBusy, setRateBusy] = useState(false);

  useEffect(() => {
    if (!configured || tab !== 'rates') return;
    void (async () => {
      const [s, cloud] = await Promise.all([getConfigSettings(), getBotAdminPanelConfig()]);
      const rate = s?.coinRate && s.coinRate > 0 ? s.coinRate : DEFAULT_APP_COIN_RATE;
      setAppCoinRate(rate);
      const coins = cloud?.packageCoins && cloud.packageCoins > 0
        ? cloud.packageCoins
        : DEFAULT_BOT_PACKAGE_COINS;
      const priceUsd = cloud?.packagePriceUsd && cloud.packagePriceUsd > 0
        ? cloud.packagePriceUsd
        : DEFAULT_BOT_PACKAGE_PRICE_USD;
      const ratePerUsd = coinsPerUsdFromPackage(coins, priceUsd);
      setPackagePricing({ coins, priceUsd });
      if (ratePerUsd > 0) {
        setRateForm((f) => ({ ...f, rate_per_usd: ratePerUsd }));
      }
    })();
  }, [configured, tab]);

  const computedRatePerUsd = coinsPerUsdFromPackage(packagePricing.coins, packagePricing.priceUsd);

  const applyPackageToRate = () => {
    const next = coinsPerUsdFromPackage(packagePricing.coins, packagePricing.priceUsd);
    if (next <= 0) {
      alert('أدخل كوينز وسعر دولار صالحين');
      return;
    }
    setRateForm((f) => ({ ...f, rate_per_usd: next }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloud = await getBotAdminPanelConfig();
        const envKey = (import.meta.env.VITE_BOT_ADMIN_API_KEY as string | undefined)?.trim() ?? '';
        const key = cloud?.apiKey?.trim() || envKey || getBotAdminApiKey();
        if (cancelled) return;
        if (key) {
          setBotAdminApiKey(key);
          setApiKeyInput(key);
          setConfigured(true);
        }
      } finally {
        if (!cancelled) setKeyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    setKeySaving(true);
    setKeySaved(false);
    setError(null);
    try {
      if (!trimmed) {
        setBotAdminApiKey('');
        await saveBotAdminPanelConfig({ apiKey: '' });
        setConfigured(false);
        return;
      }
      setBotAdminApiKey(trimmed);
      await saveBotAdminPanelConfig({ apiKey: trimmed });
      setConfigured(true);
      setKeySaved(true);
      await logAdminAction('حفظ مفتاح Bot Admin API', 'بوت تيليغرام');
      setTimeout(() => setKeySaved(false), 2500);
    } catch (e) {
      setError((e as Error)?.message ?? 'تعذّر حفظ المفتاح في السحابة');
    } finally {
      setKeySaving(false);
    }
  };

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (!isBotAdminConfigured()) {
      setError('أدخل مفتاح Admin API أولاً');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof BotAdminApiError ? e.message : (e as Error)?.message ?? 'خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverview = useCallback(() =>
    run(async () => {
      const [h, s] = await Promise.all([botHealthCheck(), botGetStats()]);
      setHealth(h);
      setStats(s);
    }), [run]);

  const loadOrders = useCallback(() =>
    run(async () => {
      const res = await botListOrders({
        limit: ordersLimit,
        offset: ordersOffset,
        status: orderStatus || undefined,
        user_id: orderUserId ? Number(orderUserId) : undefined,
        tx_hash: orderTx || undefined,
      });
      setOrders(res.orders);
      setOrdersTotal(res.total);
    }), [run, orderStatus, orderUserId, orderTx, ordersOffset, ordersLimit]);

  const loadUsers = useCallback(() =>
    run(async () => {
      const res = await botListUsers({ limit: usersLimit, offset: usersOffset });
      setUsers(res.users);
      setUsersTotal(res.total);
    }), [run, usersOffset, usersLimit]);

  const loadKeys = useCallback(() =>
    run(async () => {
      const claimedOnly =
        keysFilter === 'claimed' ? true : keysFilter === 'available' ? false : null;
      if (keysListMode === 'all') {
        const res = await botListAccessKeys(claimedOnly);
        const rows = res.keys.map(normalizeKeyRow);
        setKeys(rows);
        setKeysTotal(rows.length);
        return;
      }
      const res = await botListKeysPaginated({
        limit: keysLimit,
        offset: keysOffset,
        claimed_only: claimedOnly,
      });
      const rows = (Array.isArray(res) ? res : []).map(normalizeKeyRow);
      setKeys(rows);
      setKeysTotal(rows.length < keysLimit ? keysOffset + rows.length : keysOffset + keysLimit + 1);
    }), [run, keysFilter, keysOffset, keysLimit, keysListMode]);

  const loadRates = useCallback(() =>
    run(async () => {
      setRates(await botListRates());
    }), [run]);

  useEffect(() => {
    if (!configured) return;
    if (tab === 'overview') void loadOverview();
    else if (tab === 'orders') void loadOrders();
    else if (tab === 'users') void loadUsers();
    else if (tab === 'keys') void loadKeys();
    else if (tab === 'rates') void loadRates();
  }, [tab, configured, loadOverview, loadOrders, loadUsers, loadKeys, loadRates]);

  const openOrder = async (id: number) => {
    try {
      setSelectedOrder(await botGetOrder(id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const openUser = async (id: number) => {
    try {
      setSelectedUser(await botGetUser(id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const lookupUserById = async () => {
    const id = Number(userLookupId.trim());
    if (!Number.isFinite(id) || id <= 0) {
      alert('أدخل Telegram User ID صالح');
      return;
    }
    await openUser(id);
  };

  const handleCreateKey = async () => {
    setKeyBusy(true);
    try {
      const res = await botCreateAccessKey({
        key: keyCreateCustom.trim() || null,
        prefix: keyCreatePrefix.trim() || 'LIT',
      });
      setCreatedKeys(res.keys);
      setKeyCreateCustom('');
      alert(res.message || `تم إنشاء ${res.count} مفتاح`);
      await loadKeys();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setKeyBusy(false);
    }
  };

  const handleBulkKeys = async () => {
    const count = Math.floor(Number(keyBulkCount));
    if (count < 1 || count > 10000) {
      alert('العدد بين 1 و 10000');
      return;
    }
    if (!confirm(`توليد ${count} مفتاح؟`)) return;
    setKeyBusy(true);
    try {
      const res = await botCreateAccessKeysBulk({
        count,
        prefix: keyBulkPrefix.trim() || 'LIT',
        length: Math.max(8, Math.min(64, Math.floor(Number(keyBulkLength) || 24))),
      });
      setCreatedKeys(res.keys);
      alert(res.message || `تم توليد ${res.count} مفتاح`);
      await loadKeys();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setKeyBusy(false);
    }
  };

  const handleDeleteKey = async (key: string, isClaimed: boolean) => {
    if (isClaimed) {
      alert('لا يمكن حذف مفتاح مُستخدم');
      return;
    }
    if (!confirm(`حذف المفتاح ${key}؟`)) return;
    setKeyBusy(true);
    try {
      await botDeleteAccessKey(key);
      alert('تم حذف المفتاح');
      await loadKeys();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setKeyBusy(false);
    }
  };

  const handleLookupRate = async () => {
    if (!rateLookup.coin.trim() || !rateLookup.chain.trim()) {
      alert('أدخل العملة والسلسلة');
      return;
    }
    setRateBusy(true);
    try {
      setRateLookupResult(
        await botGetRate(rateLookup.coin.trim(), rateLookup.chain.trim()),
      );
    } catch (e) {
      setRateLookupResult(null);
      alert((e as Error).message);
    } finally {
      setRateBusy(false);
    }
  };

  const handleUpdateRate = async (chainOverride?: string) => {
    const coin = rateForm.coin.trim().toUpperCase();
    const chain = (chainOverride ?? rateForm.chain).trim().toLowerCase();
    if (!isValidPaymentCoin(coin)) {
      alert(
        'حقل «عملة الدفع» لازم يكون رمز كريبتو (مثل USDT) — مو عدد كوينز.\n' +
          'كوينز LinkUp تُدخل في «كوينز لكل دولار» (rate_per_usd).',
      );
      return;
    }
    if (!chain || rateForm.rate_per_usd <= 0) {
      alert('أدخل شبكة وسعر صالح');
      return;
    }
    setRateBusy(true);
    try {
      const res = await botUpdateRate({
        coin,
        chain,
        rate_per_usd: rateForm.rate_per_usd,
      });
      alert(res.message || (res.success ? `تم حفظ ${coin}/${chain}` : 'فشل'));
      await loadRates();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRateBusy(false);
    }
  };

  const handleUpdateRateAllChains = async () => {
    const coin = rateForm.coin.trim().toUpperCase();
    if (!isValidPaymentCoin(coin) || rateForm.rate_per_usd <= 0) {
      alert('تحقق من عملة الدفع (USDT) وعدد الكوينز لكل دولار');
      return;
    }
    if (!confirm(
      `حفظ الباقة: ${formatNumber(packagePricing.coins)} كوين = $${packagePricing.priceUsd}\n` +
      `(rate_per_usd = ${formatNumber(rateForm.rate_per_usd)}) على كل الشبكات؟`,
    )) return;
    setRateBusy(true);
    try {
      for (const chain of BOT_PAYMENT_CHAINS) {
        await botUpdateRate({ coin, chain, rate_per_usd: rateForm.rate_per_usd });
      }
      await saveBotAdminPanelConfig({
        packageCoins: packagePricing.coins,
        packagePriceUsd: packagePricing.priceUsd,
      });
      alert(`تم: ${formatNumber(packagePricing.coins)} كوين = $${packagePricing.priceUsd} على كل الشبكات`);
      await loadRates();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRateBusy(false);
    }
  };

  const handleDeactivateRate = async (coin: string, chain: string) => {
    if (!confirm(`إلغاء تفعيل سعر ${coin} / ${chain}؟`)) return;
    setRateBusy(true);
    try {
      const res = await botDeactivateRate(coin, chain);
      alert(res.message || 'تم');
      await loadRates();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRateBusy(false);
    }
  };

  const refresh = () => {
    if (tab === 'overview') void loadOverview();
    else if (tab === 'orders') void loadOrders();
    else if (tab === 'users') void loadUsers();
    else if (tab === 'keys') void loadKeys();
    else if (tab === 'rates') void loadRates();
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Bot size={28} color="#8B5CF6" />
            بوت تيليغرام — Lit-App
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            إدارة الشحن، المستخدمين، المفاتيح وأسعار الصرف عبر{' '}
            <a href="https://www.api.linkuppay.store/docs" target="_blank" rel="noreferrer" style={{ color: '#8B5CF6' }}>
              Bot Admin API <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </a>
          </p>
        </div>
        {configured && (
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} />
            تحديث
          </button>
        )}
      </div>

      {/* API Key setup */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Key size={18} color="#F59E0B" />
          <strong>مفتاح Admin API</strong>
          {configured ? (
            <Badge variant="green"><CheckCircle2 size={12} style={{ marginLeft: 4 }} /> متصل</Badge>
          ) : (
            <Badge variant="gold">غير مُعرَّف</Badge>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          Bearer token من إعدادات البوت (<code>ADMIN_API_KEYS</code>). يُحفظ في Firebase ويُحمَّل تلقائياً عند فتح الصفحة — مرة واحدة تكفي.
        </p>
        {keyLoading ? (
          <Loading />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="password"
              className="form-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Bearer API Key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={() => void saveApiKey()} disabled={keySaving}>
              <Save size={16} />
              {keySaving ? 'جاري الحفظ…' : 'حفظ المفتاح'}
            </button>
            {keySaved && <Badge variant="green">تم الحفظ في لوحة التحكم</Badge>}
            {configured && !keySaved && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <Cloud size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
                محفوظ — يُحمَّل تلقائياً
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="agency-alert-banner" style={{ marginBottom: 16, borderColor: '#EF4444' }}>
          <AlertCircle size={16} style={{ display: 'inline', marginLeft: 6 }} />
          {error}
        </div>
      )}

      {!keyLoading && !configured ? (
        <Empty text="أدخل مفتاح API واضغط «حفظ المفتاح» — مرة واحدة يكفي" />
      ) : !keyLoading && configured ? (
        <>
          <div className="tabs-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`btn ${tab === id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {loading && <Loading text="جارٍ الاتصال بالبوت..." />}

          {!loading && tab === 'overview' && stats && (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-card-value">{formatNumber(stats.orders.total)}</div>
                  <div className="stat-card-label">إجمالي الطلبات</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value">{formatNumber(stats.orders.last_24h)}</div>
                  <div className="stat-card-label">آخر 24 ساعة</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value">{formatNumber(stats.users.total)}</div>
                  <div className="stat-card-label">مستخدمون موثّقون</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value">{formatNumber(stats.access_keys.claimed)}</div>
                  <div className="stat-card-label">مفاتيح مُستخدَمة</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value">{formatNumber(stats.access_keys.available)}</div>
                  <div className="stat-card-label">مفاتيح متاحة</div>
                </div>
              </div>

              {health && (
                <div className="card" style={{ padding: 14 }}>
                  <strong>حالة الخادم: </strong>
                  <Badge variant={health.status === 'healthy' ? 'green' : 'gold'}>
                    {health.status ?? '—'}
                  </Badge>
                  <span style={{ marginRight: 12, color: 'var(--text-muted)' }}>
                    قاعدة البيانات: {health.database ?? '—'}
                  </span>
                </div>
              )}

              {Object.keys(stats.orders.by_status).length > 0 && (
                <div className="card" style={{ marginTop: 16, padding: 14 }}>
                  <strong>الطلبات حسب الحالة</strong>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                    {Object.entries(stats.orders.by_status).map(([st, n]) => (
                      <span key={st}>{st}: <strong>{n}</strong></span>
                    ))}
                  </div>
                </div>
              )}

              <div className="card" style={{ marginTop: 16, padding: 14 }}>
                <strong>جميع مسارات API المدعومة في اللوحة</strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 10px' }}>
                  مطابقة لـ <a href="https://www.api.linkuppay.store/docs" target="_blank" rel="noreferrer">Swagger Docs</a>
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Path</th>
                        <th>الوصف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BOT_ADMIN_API_ENDPOINTS.map((ep) => (
                        <tr key={`${ep.method}-${ep.path}`}>
                          <td><Badge variant={ep.method === 'GET' ? 'blue' : ep.method === 'DELETE' ? 'red' : 'gold'}>{ep.method}</Badge></td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{ep.path}</td>
                          <td>{ep.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!loading && tab === 'orders' && (
            <>
              <div className="filters-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <input
                  className="form-input"
                  placeholder="الحالة (completed, pending...)"
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  style={{ width: 160 }}
                />
                <input
                  className="form-input"
                  placeholder="Telegram User ID"
                  value={orderUserId}
                  onChange={(e) => setOrderUserId(e.target.value)}
                  style={{ width: 140 }}
                />
                <input
                  className="form-input"
                  placeholder="TX Hash"
                  value={orderTx}
                  onChange={(e) => setOrderTx(e.target.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <button type="button" className="btn btn-primary" onClick={() => { setOrdersOffset(0); void loadOrders(); }}>
                  <Search size={16} />
                  بحث
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {ordersTotal} طلب — اضغط على الصف للتفاصيل (GET /api/v1/orders/)
              </p>
              {orders.length === 0 ? (
                <Empty text="لا توجد طلبات" />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>المستخدم</th>
                        <th>كوينز LinkUp</th>
                        <th>عملة الدفع / شبكة</th>
                        <th>الحالة</th>
                        <th>Lit-App UID</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => void openOrder(o.id)}>
                          <td>{o.id}</td>
                          <td>{o.user_id}</td>
                          <td>{o.amount != null ? formatNumber(o.amount) : '—'}</td>
                          <td>{o.coin ?? '—'} {o.chain ? `(${o.chain})` : ''}</td>
                          <td>{orderStatusBadge(o.status)}</td>
                          <td style={{ fontSize: 12 }}>{o.lit_app_user_id ?? '—'}</td>
                          <td style={{ fontSize: 12 }}>{fmtIso(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar
                offset={ordersOffset}
                limit={ordersLimit}
                total={ordersTotal}
                onChange={setOrdersOffset}
              />
            </>
          )}

          {!loading && tab === 'users' && (
            <>
              <div className="filters-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <input
                  className="form-input"
                  placeholder="Telegram User ID للبحث المباشر"
                  value={userLookupId}
                  onChange={(e) => setUserLookupId(e.target.value)}
                  style={{ width: 200 }}
                />
                <button type="button" className="btn btn-primary" onClick={() => void lookupUserById()}>
                  <Search size={16} />
                  GET /users/{'{id}'}
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {usersTotal} مستخدم موثّق — GET /api/v1/users/
              </p>
              {users.length === 0 ? (
                <Empty text="لا يوجد مستخدمون" />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Telegram ID</th>
                        <th>الاسم</th>
                        <th>Username</th>
                        <th>المفتاح</th>
                        <th>اللغة</th>
                        <th>تاريخ التوثيق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id} style={{ cursor: 'pointer' }} onClick={() => void openUser(u.user_id)}>
                          <td>{u.user_id}</td>
                          <td>{u.first_name ?? '—'}</td>
                          <td>{u.username ? `@${u.username}` : '—'}</td>
                          <td style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.claimed_key ?? '—'}
                          </td>
                          <td>{u.language ?? 'en'}</td>
                          <td style={{ fontSize: 12 }}>{fmtIso(u.verified_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationBar
                offset={usersOffset}
                limit={usersLimit}
                total={usersTotal}
                onChange={setUsersOffset}
              />
            </>
          )}

          {!loading && tab === 'keys' && (
            <>
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} /> إنشاء مفتاح واحد — POST /api/v1/keys/create
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                    <span style={{ fontSize: 12 }}>مفتاح مخصص (اختياري — يُولَّد تلقائياً إن فارغ)</span>
                    <input
                      className="form-input"
                      placeholder="LIT-..."
                      value={keyCreateCustom}
                      onChange={(e) => setKeyCreateCustom(e.target.value)}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>البادئة</span>
                    <input
                      className="form-input"
                      value={keyCreatePrefix}
                      onChange={(e) => setKeyCreatePrefix(e.target.value)}
                      style={{ width: 80 }}
                    />
                  </label>
                  <button type="button" className="btn btn-primary" disabled={keyBusy} onClick={() => void handleCreateKey()}>
                    <Plus size={16} /> إنشاء
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} /> توليد دفعة — POST /api/v1/keys/bulk
                </strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>العدد (1–10000)</span>
                    <input type="number" className="form-input" value={keyBulkCount} onChange={(e) => setKeyBulkCount(Number(e.target.value))} style={{ width: 100 }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>البادئة</span>
                    <input className="form-input" value={keyBulkPrefix} onChange={(e) => setKeyBulkPrefix(e.target.value)} style={{ width: 80 }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>طول عشوائي</span>
                    <input type="number" className="form-input" value={keyBulkLength} onChange={(e) => setKeyBulkLength(Number(e.target.value))} style={{ width: 90 }} />
                  </label>
                  <button type="button" className="btn btn-gold" disabled={keyBusy} onClick={() => void handleBulkKeys()}>
                    <Layers size={16} /> توليد دفعة
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {(['all', 'claimed', 'available'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn ${keysFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setKeysFilter(f); setKeysOffset(0); }}
                  >
                    {f === 'all' ? 'الكل' : f === 'claimed' ? 'مُستخدَمة' : 'متاحة'}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn ${keysListMode === 'paginated' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setKeysListMode('paginated'); setKeysOffset(0); }}
                >
                  GET /keys/list
                </button>
                <button
                  type="button"
                  className={`btn ${keysListMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setKeysListMode('all')}
                >
                  GET /users/keys/all
                </button>
              </div>
              {keys.length === 0 ? (
                <Empty text="لا توجد مفاتيح" />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>المفتاح</th>
                        <th>الحالة</th>
                        <th>المستخدم</th>
                        <th>تاريخ الاستخدام</th>
                        <th>تاريخ الإنشاء</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k.key}>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{k.key}</td>
                          <td>
                            {k.is_claimed ? <Badge variant="blue">مُستخدَم</Badge> : <Badge variant="green">متاح</Badge>}
                          </td>
                          <td>{k.claimed_by_user_id ?? '—'}</td>
                          <td style={{ fontSize: 12 }}>{fmtIso(k.claimed_at)}</td>
                          <td style={{ fontSize: 12 }}>{fmtIso(k.created_at)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="نسخ"
                                onClick={() => void copyText(k.key).then(() => alert('تم النسخ'))}
                              >
                                <Copy size={14} />
                              </button>
                              {!k.is_claimed && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  title="حذف — DELETE /api/v1/keys/{key}"
                                  disabled={keyBusy}
                                  onClick={() => void handleDeleteKey(k.key, k.is_claimed)}
                                >
                                  <Trash2 size={14} color="#EF4444" />
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
              {keysListMode === 'paginated' && (
                <PaginationBar
                  offset={keysOffset}
                  limit={keysLimit}
                  total={keysTotal}
                  onChange={setKeysOffset}
                />
              )}
            </>
          )}

          {!loading && tab === 'rates' && (
            <>
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <strong>استعلام سعر محدد — GET /api/v1/rates/{'{coin}'}/{'{chain}'}</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
                  <input className="form-input" value={rateLookup.coin} onChange={(e) => setRateLookup((r) => ({ ...r, coin: e.target.value }))} style={{ width: 100 }} placeholder="USDT" />
                  <input className="form-input" value={rateLookup.chain} onChange={(e) => setRateLookup((r) => ({ ...r, chain: e.target.value }))} style={{ width: 120 }} placeholder="tron" />
                  <button type="button" className="btn btn-secondary" disabled={rateBusy} onClick={() => void handleLookupRate()}>
                    <Search size={16} /> استعلام
                  </button>
                </div>
                {rateLookupResult && (
                  <div style={{ marginTop: 12, fontSize: 14, padding: 10, background: 'var(--bg-muted)', borderRadius: 8 }}>
                    {rateLookupResult.coin_type} / {rateLookupResult.chain}:{' '}
                    <strong>{formatNumber(rateLookupResult.rate_per_usd)}</strong> —{' '}
                    {rateLookupResult.is_active ? <Badge variant="green">نشط</Badge> : <Badge variant="gray">معطّل</Badge>}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <strong>باقة شحن البوت — POST /api/v1/rates/update</strong>
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  حدّد كم كوين LinkUp يحصل عليها المستخدم مقابل مبلغ محدد — مثال: <strong>10000 كوين = $0.93</strong> (مو $1).
                  السيرفر يحفظ <code>rate_per_usd</code> = كوينز ÷ سعر الدولار.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>كوينز LinkUp</span>
                    <input
                      type="number"
                      step="1"
                      min={1}
                      className="form-input"
                      value={packagePricing.coins}
                      onChange={(e) => {
                        const coins = Number(e.target.value);
                        setPackagePricing((p) => ({ ...p, coins }));
                        const rate = coinsPerUsdFromPackage(coins, packagePricing.priceUsd);
                        if (rate > 0) setRateForm((f) => ({ ...f, rate_per_usd: rate }));
                      }}
                      style={{ width: 130 }}
                    />
                  </label>
                  <span style={{ paddingBottom: 10, color: 'var(--text-muted)' }}>=</span>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>السعر بالدولار ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0.01}
                      className="form-input"
                      value={packagePricing.priceUsd}
                      onChange={(e) => {
                        const priceUsd = Number(e.target.value);
                        setPackagePricing((p) => ({ ...p, priceUsd }));
                        const rate = coinsPerUsdFromPackage(packagePricing.coins, priceUsd);
                        if (rate > 0) setRateForm((f) => ({ ...f, rate_per_usd: rate }));
                      }}
                      style={{ width: 130 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>rate_per_usd (للـ API)</span>
                    <input
                      type="number"
                      step="0.01"
                      min={1}
                      className="form-input"
                      value={rateForm.rate_per_usd}
                      onChange={(e) => setRateForm((f) => ({ ...f, rate_per_usd: Number(e.target.value) }))}
                      style={{ width: 140 }}
                      title="يُحسب تلقائياً من الباقة — يمكن تعديله يدوياً"
                    />
                  </label>
                </div>

                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-muted)', borderRadius: 8, fontSize: 13, lineHeight: 1.8 }}>
                  <div>
                    <strong>المعاينة:</strong>{' '}
                    ${packagePricing.priceUsd} → {formatNumber(packagePricing.coins)} كوين
                    {' · '}
                    $2 → {formatNumber(estimateCoinsForPayment(2, rateForm.rate_per_usd))} كوين
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    rate_per_usd = {formatNumber(computedRatePerUsd)} (كل $1 يعطي ~{formatNumber(computedRatePerUsd)} كوين)
                    {' — '}
                    سعر التطبيق العام: {formatNumber(appCoinRate)} كوين / $1
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>عملة الدفع</span>
                    <select
                      className="form-input"
                      value={rateForm.coin}
                      onChange={(e) => setRateForm((f) => ({ ...f, coin: e.target.value }))}
                      style={{ width: 100 }}
                    >
                      {BOT_PAYMENT_COINS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>الشبكة</span>
                    <select
                      className="form-input"
                      value={rateForm.chain}
                      onChange={(e) => setRateForm((f) => ({ ...f, chain: e.target.value }))}
                      style={{ width: 120 }}
                    >
                      {BOT_PAYMENT_CHAINS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-secondary" onClick={applyPackageToRate} disabled={rateBusy}>
                    إعادة حساب السعر
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void handleUpdateRate()} disabled={rateBusy}>
                    <Save size={16} />
                    حفظ شبكة واحدة
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void handleUpdateRateAllChains()} disabled={rateBusy}>
                    <Layers size={16} />
                    حفظ كل الشبكات ({formatNumber(rateForm.rate_per_usd)})
                  </button>
                </div>
              </div>

              {rates.length === 0 ? (
                <Empty text="لا توجد أسعار نشطة — GET /api/v1/rates/" />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>عملة الدفع</th>
                        <th>الشبكة</th>
                        <th>كوينز / $1 (API)</th>
                        <th>تقريباً</th>
                        <th>نشط</th>
                        <th>آخر تحديث</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((r) => (
                        <tr key={`${r.coin_type}-${r.chain}`}>
                          <td>{r.coin_type}</td>
                          <td>{r.chain}</td>
                          <td>{formatNumber(r.rate_per_usd)}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            $0.93 ≈ {formatNumber(estimateCoinsForPayment(0.93, r.rate_per_usd))}
                          </td>
                          <td>{r.is_active ? <Badge variant="green">نعم</Badge> : <Badge variant="gray">لا</Badge>}</td>
                          <td style={{ fontSize: 12 }}>{fmtIso(r.updated_at)}</td>
                          <td>
                            {r.is_active && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                disabled={rateBusy}
                                onClick={() => void handleDeactivateRate(r.coin_type, r.chain)}
                              >
                                <Power size={14} />
                                إلغاء
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>طلب #{selectedOrder.id}</h3>
            <dl style={{ fontSize: 14, lineHeight: 1.8 }}>
              <dt>المستخدم</dt><dd>{selectedOrder.user_id}</dd>
              <dt>الحالة</dt><dd>{orderStatusBadge(selectedOrder.status)}</dd>
              <dt>كوينز LinkUp المضافة</dt><dd>{selectedOrder.amount != null ? formatNumber(selectedOrder.amount) : '—'}</dd>
              <dt>الخدمة</dt><dd>{selectedOrder.service ?? '—'}</dd>
              <dt>عملة الدفع (coin) / الشبكة</dt><dd>{selectedOrder.coin ?? '—'} / {selectedOrder.chain ?? '—'}</dd>
              <dt>TX Hash</dt><dd style={{ wordBreak: 'break-all', fontSize: 12 }}>{selectedOrder.transaction_hash ?? '—'}</dd>
              <dt>Lit-App User</dt><dd>{selectedOrder.lit_app_user_id ?? '—'}</dd>
              <dt>أُنشئ</dt><dd>{fmtIso(selectedOrder.created_at)}</dd>
              <dt>اكتمل</dt><dd>{fmtIso(selectedOrder.completed_at)}</dd>
            </dl>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>إغلاق</button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>مستخدم Telegram {selectedUser.user_id}</h3>
            <dl style={{ fontSize: 14, lineHeight: 1.8 }}>
              <dt>الاسم</dt><dd>{selectedUser.first_name ?? '—'}</dd>
              <dt>Username</dt><dd>{selectedUser.username ? `@${selectedUser.username}` : '—'}</dd>
              <dt>المفتاح</dt><dd style={{ wordBreak: 'break-all' }}>{selectedUser.claimed_key ?? '—'}</dd>
              <dt>اللغة</dt><dd>{selectedUser.language ?? 'en'}</dd>
              <dt>تاريخ التوثيق</dt><dd>{fmtIso(selectedUser.verified_at)}</dd>
            </dl>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedUser(null)}>إغلاق</button>
          </div>
        </div>
      )}

      {createdKeys && createdKeys.length > 0 && (
        <div className="modal-backdrop" onClick={() => setCreatedKeys(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3>مفاتيح جديدة ({createdKeys.length})</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>انسخها الآن — لن تُعرض مرة أخرى بنفس السهولة</p>
            <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 12 }}>
              {createdKeys.map((k) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all' }}>{k}</code>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText(k)}>
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void copyText(createdKeys.join('\n')).then(() => alert('تم نسخ الكل'))}
            >
              <Copy size={16} /> نسخ الكل
            </button>
            <button type="button" className="btn btn-secondary" style={{ marginRight: 8 }} onClick={() => setCreatedKeys(null)}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
