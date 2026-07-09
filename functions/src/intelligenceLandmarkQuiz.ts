/**
 * جولة معالم ديناميكية — Wikidata + Wikimedia Commons
 * صور حقيقية وأسماء عربية بدون تخزين ثابت في التطبيق.
 */
import { onRequest } from 'firebase-functions/v2/https';

const USER_AGENT = 'LinkUpGames/1.0 (landmark-quiz; +https://linkup-dc45f.web.app)';
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

const COUNTRY_ALIASES: Record<string, string> = {
  'الإمارات العربية المتحدة': 'الإمارات',
  'المملكة العربية السعودية': 'السعودية',
  'الولايات المتحدة الأمريكية': 'الولايات المتحدة',
  'الولايات المتحدة': 'الولايات المتحدة',
  'المملكة المتحدة لبريطانيا العظمى وأيرلندا الشمالية': 'المملكة المتحدة',
  'كوريا الجنوبية': 'كوريا الجنوبية',
  'كوريا الشمالية': 'كوريا الشمالية',
};

const REGIONS: Record<string, string[]> = {
  gulf: ['السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'اليمن'],
  levant: ['سوريا', 'لبنان', 'الأردن', 'فلسطين', 'العراق'],
  maghreb: ['مصر', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان'],
  europe: ['فرنسا', 'ألمانيا', 'إيطاليا', 'إسبانيا', 'المملكة المتحدة', 'روسيا', 'اليونان', 'سويسرا', 'النرويج', 'هولندا', 'بلجيكا', 'النمسا', 'البرتغال', 'بولندا', 'التشيك'],
  americas: ['الولايات المتحدة', 'كندا', 'البرازيل', 'الأرجنتين', 'المكسيك', 'بيرو', 'تشيلي', 'كولومبيا'],
  asia: ['الصين', 'اليابان', 'الهند', 'تركيا', 'إيران', 'باكستان', 'إندونيسيا', 'ماليزيا', 'كوريا الجنوبية', 'تايلاند', 'فيتنام'],
};

type LandmarkRow = {
  item: string;
  itemLabel: string;
  image: string;
  countryLabel: string;
  sitelinks?: number;
};

type QuizRound = {
  landmarkName: string;
  countryName: string;
  imageUrl: string;
  options: string[];
  provider: 'wikidata';
};

let countriesCache: { list: string[]; at: number } | null = null;
let poolCache: { key: string; rows: LandmarkRow[]; at: number } | null = null;
const POOL_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 14_000;

/** احتياطي سريع إذا تأخر Wikidata */
const FALLBACK_LANDMARKS: LandmarkRow[] = [
  { item: 'Q80989', itemLabel: 'برج إيفل', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tour_eiffel_at_sunrise_from_the_trocadero.jpg', countryLabel: 'فرنسا', sitelinks: 90 },
  { item: 'Q42382', itemLabel: 'الكعبة المشرفة', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kaaba.jpg', countryLabel: 'السعودية', sitelinks: 80 },
  { item: 'Q12403', itemLabel: 'تاج محل', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Taj_Mahal%2C_Agra%2C_India.jpg', countryLabel: 'الهند', sitelinks: 85 },
  { item: 'Q9202', itemLabel: 'تمثال الحرية', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Front_view_of_Statue_of_Liberty_%28cropped%29.jpg', countryLabel: 'الولايات المتحدة', sitelinks: 88 },
  { item: 'Q12560', itemLabel: 'الأهرامات', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kheops-Pyramid.jpg', countryLabel: 'مصر', sitelinks: 75 },
  { item: 'Q12501', itemLabel: 'سور الصين العظيم', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Great_Wall_of_China_at_Jinshanling-edit.jpg', countryLabel: 'الصين', sitelinks: 70 },
  { item: 'Q23438', itemLabel: 'الكولوسيوم', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Colosseo_2020.jpg', countryLabel: 'إيطاليا', sitelinks: 72 },
  { item: 'Q1721', itemLabel: 'البتراء', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Al_Khazneh_Petra_edit_2.jpg', countryLabel: 'الأردن', sitelinks: 65 },
  { item: 'Q83210', itemLabel: 'برج خليفة', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Burj_Khalifa.jpg', countryLabel: 'الإمارات', sitelinks: 60 },
  { item: 'Q580184', itemLabel: 'جامع الشيخ زايد', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sheikh_Zayed_Mosque%2C_Abu_Dhabi%2C_UAE.jpg', countryLabel: 'الإمارات', sitelinks: 55 },
];

async function fetchWithTimeout(url: string, init: RequestInit, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCountry(name: string): string {
  const trimmed = (name || '').trim();
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

function tierSitelinks(tier: number): { min: number; max: number } {
  if (tier >= 5) return { min: 5, max: 14 };
  if (tier >= 4) return { min: 8, max: 22 };
  if (tier >= 3) return { min: 15, max: 35 };
  if (tier >= 2) return { min: 25, max: 80 };
  return { min: 40, max: 999 };
}

function commonsImageUrl(raw: string, width = 720): string {
  if (!raw) return '';
  if (raw.includes('Special:FilePath/')) {
    const base = raw.replace('http://', 'https://').split('?')[0];
    return `${base}?width=${width}`;
  }
  return raw;
}

function pickRegion(country: string): string {
  for (const [region, list] of Object.entries(REGIONS)) {
    if (list.includes(country)) return region;
  }
  return 'other';
}

function pickWrongCountries(correct: string, count: number, all: string[], strategy: string): string[] {
  const wrong: string[] = [];
  let pool = all.filter((c) => c !== correct);
  if (strategy === 'region') {
    const region = pickRegion(correct);
    const regional = (REGIONS[region] || []).filter((c) => c !== correct);
    if (regional.length >= count) pool = regional;
  }
  while (wrong.length < count && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!wrong.includes(pick)) wrong.push(pick);
  }
  return wrong;
}

async function fetchCountries(): Promise<string[]> {
  if (countriesCache && Date.now() - countriesCache.at < POOL_TTL_MS) {
    return countriesCache.list;
  }
  try {
    const res = await fetchWithTimeout('https://restcountries.com/v3.1/all?fields=translations', {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error('restcountries');
    const data = (await res.json()) as Array<{ translations?: { ara?: { common?: string } } }>;
    const list = Array.from(
      new Set(
        data
          .map((c) => normalizeCountry(c.translations?.ara?.common || ''))
          .filter((n) => n.length > 1),
      ),
    ).sort((a, b) => a.localeCompare(b, 'ar'));
    countriesCache = { list, at: Date.now() };
    return list;
  } catch {
    const fallback = Array.from(new Set(Object.values(REGIONS).flat())).sort();
    countriesCache = { list: fallback, at: Date.now() };
    return fallback;
  }
}

async function fetchLandmarkPool(tier: number): Promise<LandmarkRow[]> {
  const { min, max } = tierSitelinks(tier);
  const cacheKey = `${min}-${max}`;
  if (poolCache && poolCache.key === cacheKey && Date.now() - poolCache.at < POOL_TTL_MS) {
    return poolCache.rows;
  }

  const query = `
SELECT ?item ?itemLabel ?image ?countryLabel ?sitelinks WHERE {
  VALUES ?kind { wd:Q570116 wd:Q33506 wd:Q41176 wd:Q839954 }
  ?item wdt:P31/wdt:P279* ?kind .
  ?item wdt:P18 ?image .
  ?item wdt:P17 ?country .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${min} && ?sitelinks <= ${max})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
}
LIMIT 50`;

  try {
    const res = await fetchWithTimeout(WIKIDATA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
        'User-Agent': USER_AGENT,
      },
      body: `query=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`wikidata ${res.status}`);

    const json = (await res.json()) as {
      results: { bindings: Array<Record<string, { value: string }>> };
    };

    const rows: LandmarkRow[] = [];
    const seen = new Set<string>();

    for (const b of json.results.bindings) {
      const item = b.item?.value;
      const image = b.image?.value;
      const countryLabel = normalizeCountry(b.countryLabel?.value || '');
      const itemLabel = (b.itemLabel?.value || '').trim();
      const sitelinks = Number(b.sitelinks?.value || 0);
      if (!item || !image || !countryLabel || !itemLabel) continue;
      if (seen.has(item)) continue;
      seen.add(item);
      rows.push({ item, itemLabel, image, countryLabel, sitelinks });
    }

    if (rows.length) {
      poolCache = { key: cacheKey, rows, at: Date.now() };
      return rows;
    }
  } catch (e) {
    console.warn('wikidata pool fallback', e);
  }

  const fallback = FALLBACK_LANDMARKS.filter((r) => {
    const s = r.sitelinks || 0;
    return s >= min && s <= max;
  });
  const rows = fallback.length ? fallback : FALLBACK_LANDMARKS;
  poolCache = { key: cacheKey, rows, at: Date.now() };
  return rows;
}

function preferArabicLabel(row: LandmarkRow): string {
  const label = row.itemLabel || '';
  if (/[\u0600-\u06FF]/.test(label)) return label.replace(/\s*\(\d+\)\s*$/, '').trim();
  return label.replace(/\s*\(\d+\)\s*$/, '').trim();
}

async function buildRound(tier: number, optionCount: number, wrongStrategy: string): Promise<QuizRound> {
  const [pool, countries] = await Promise.all([fetchLandmarkPool(tier), fetchCountries()]);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const landmarkName = preferArabicLabel(pick);
  const countryName = pick.countryLabel;
  const wrong = pickWrongCountries(countryName, Math.max(1, optionCount - 1), countries, wrongStrategy);
  const options = [...wrong, countryName].sort(() => Math.random() - 0.5);

  return {
    landmarkName,
    countryName,
    imageUrl: commonsImageUrl(pick.image, 720),
    options,
    provider: 'wikidata',
  };
}

function setCors(res: import('express').Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'public, max-age=60');
}

export const getLandmarkQuizRound = onRequest({ cors: true, maxInstances: 5, timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const tier = Math.min(5, Math.max(1, Number(req.query.tier) || 1));
  const optionCount = Math.min(6, Math.max(3, Number(req.query.options) || 4));
  const wrongStrategy = String(req.query.strategy || (tier >= 3 ? 'region' : 'random'));

  try {
    const round = await buildRound(tier, optionCount, wrongStrategy);
    res.status(200).json({
      ok: true,
      round,
      tier,
      attribution: 'Wikidata · Wikimedia Commons · REST Countries',
    });
  } catch (e) {
    console.error('getLandmarkQuizRound', e);
    res.status(502).json({ ok: false, error: 'تعذّر جلب سؤال من المزود' });
  }
});

export const getLandmarkCountries = onRequest({ cors: true, maxInstances: 3 }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const list = await fetchCountries();
    res.status(200).json({ ok: true, countries: list });
  } catch {
    res.status(502).json({ ok: false, countries: [] });
  }
});
