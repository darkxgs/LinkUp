#!/usr/bin/env node
/**
 * يبني landmarks-quiz-bank.json — صور مباشرة + مسارات محلية
 * تشغيل: node build-landmarks-bank.mjs && node download-landmark-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SLUGS = {
  'برج إيفل': 'eiffel',
  'تاج محل': 'taj-mahal',
  'تمثال الحرية': 'statue-liberty',
  'الأهرامات': 'pyramids',
  'أهرامات الجيزة': 'pyramids-giza',
  'سور الصين العظيم': 'great-wall',
  'برج خليفة': 'burj-khalifa',
  'برج خليفة دبي': 'burj-khalifa-dubai',
  'الكولوسيوم': 'colosseum',
  'ماتشو بيتشو': 'machu-picchu',
  'ساعة بيغ بن': 'big-ben',
  'دار أوبرا سيدني': 'sydney-opera',
  'برج بيزا المائل': 'pisa-tower',
  'البتراء': 'petra',
  'المسجد الأقصى': 'al-aqsa',
  'قبة الصخرة': 'dome-rock',
  'الكعبة المشرفة': 'kaaba',
  'جامع الشيخ زايد': 'sheikh-zayed',
  'مسجد السلطان أحمد': 'blue-mosque',
  'مسجد آيا صوفيا': 'hagia-sophia',
  'جبل فوجي': 'fuji',
  'جبل فوتجي': 'fuji-mtn',
  'تمثال المسيح الفادي': 'christ-redeemer',
  'بوابة براندنبورغ': 'brandenburg',
  'جسر البوابة الذهبية': 'golden-gate',
  'ستونهنج': 'stonehenge',
  'متحف اللوفر': 'louvre',
  'قصر الكرملين': 'kremlin',
  'جامع القرويين': 'al-quaraouiyine',
  'أبراج الكويت': 'kuwait-towers',
  'قصر فرساي': 'versailles',
  'معبد البارثينون': 'parthenon',
  'معبد الكرنك': 'karnak',
  'سوق الحميدية': 'hamidiyah',
  'قلعة حلب': 'aleppo-citadel',
  'مبنى الكابيتول': 'us-capitol',
  'صخرة الروشة': 'preikestolen',
  'جسر البوسفور': 'bosphorus',
  'بحيرة جنيف': 'lake-geneva',
  'جبال الألب': 'matterhorn',
  'جبال الألب السويسرية': 'alps-swiss',
  'برج العرب': 'burj-al-arab',
  'المسجد الحرام': 'haram',
  'معبد أنغكور وات': 'angkor-wat',
  'ساغرادا فاميليا': 'sagrada-familia',
  'قلعة نيوشفانشتاين': 'neuschwanstein',
  'شلالات نياغرا': 'niagara',
  'قصر بكنغهام': 'buckingham',
  'جسر لندن': 'tower-bridge',
  'مبنى إمباير ستيت': 'empire-state',
  'أبو الهول': 'sphinx',
  'مسجد محمد علي': 'muhammad-ali-mosque',
  'برج طوكيو': 'tokyo-tower',
  'برج كوالالمبور': 'petronas',
  'حديقة تيانانمن': 'tiananmen',
};

function slugify(name) {
  const clean = cleanName(name);
  if (SLUGS[clean]) return SLUGS[clean];
  return clean
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/gi, '')
    .toLowerCase()
    .slice(0, 40) || 'landmark';
}

/** رابط صورة مباشر — upload.wikimedia.org (بدون /thumb/ لأنه يعطي 400 أحياناً) */
function directFromFile(commonsPath) {
  const decoded = decodeURIComponent(commonsPath);
  return `https://upload.wikimedia.org/wikipedia/commons/${decoded}`;
}

function directImageUrl(url) {
  if (!url) return '';
  const s = String(url).split('?')[0];
  if (s.includes('/thumb/')) {
    const m = s.match(/\/thumb\/(.+?)\/\d+px-/i);
    if (m) return `https://upload.wikimedia.org/wikipedia/commons/${m[1]}`;
  }
  const bad = s.match(
    /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:[a-f0-9]\/[a-f0-9]{2}\/)?[^/]+\.(?:jpg|jpeg|png|webp))\/\d+px-/i,
  );
  if (bad) return bad[1];
  if (s.includes('upload.wikimedia.org/wikipedia/commons/') && !s.includes('/thumb/')) {
    return s;
  }
  return '';
}

const EXTRA = [
  { landmarkName: 'برج العرب', countryAr: 'الإمارات', region: 'gulf', tier: 1, file: 'd/dc/Burj_al_Arab_2024.jpg' },
  { landmarkName: 'معبد أنغكور وات', countryAr: 'كمبوديا', region: 'asia', tier: 2, file: '4/41/Angkor_Wat.jpg' },
  { landmarkName: 'ساغرادا فاميليا', countryAr: 'إسبانيا', region: 'europe', tier: 2, file: '9/93/Sagrada_Familia_01.jpg' },
  { landmarkName: 'قلعة نيوشفانشتاين', countryAr: 'ألمانيا', region: 'europe', tier: 2, file: '1/1b/Neuschwanstein_Castle_LOC_main_edit2.jpg' },
  { landmarkName: 'شلالات نياغرا', countryAr: 'كندا', region: 'americas', tier: 1, file: '7/7b/Niagara_Falls_from_Skylon_Tower.jpg' },
  { landmarkName: 'قصر بكنغهام', countryAr: 'المملكة المتحدة', region: 'europe', tier: 1, file: '2/2c/Buckingham_Palace%2C_London_-_April_2009.jpg' },
  { landmarkName: 'جسر لندن', countryAr: 'المملكة المتحدة', region: 'europe', tier: 2, file: '6/63/Tower_Bridge_from_Shad_Thames.jpg' },
  { landmarkName: 'مبنى إمباير ستيت', countryAr: 'الولايات المتحدة', region: 'americas', tier: 1, file: '1/10/Empire_State_Building_%28aerial_view%29.jpg' },
  { landmarkName: 'أبو الهول', countryAr: 'مصر', region: 'maghreb', tier: 1, file: 'e/e3/Sphinx_with_the_Giza_pyramids_in_the_background.jpg' },
  { landmarkName: 'مسجد محمد علي', countryAr: 'مصر', region: 'maghreb', tier: 2, file: 'e/e0/Mosque_of_Muhammad_Ali_Pasha%2C_Cairo.jpg' },
  { landmarkName: 'برج طوكيو', countryAr: 'اليابان', region: 'asia', tier: 1, file: '3/37/Tokyo_Shibuya_Crossing_2018.jpg' },
  { landmarkName: 'برج كوالالمبور', countryAr: 'ماليزيا', region: 'asia', tier: 2, file: '8/85/Petronas_Twin_Towers_2019.jpg' },
  { landmarkName: 'حديقة تيانانمن', countryAr: 'الصين', region: 'asia', tier: 2, file: 'a/a6/Tiananmen_Gate.jpg' },
];

const REGIONS = {
  gulf: ['السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'اليمن'],
  levant: ['سوريا', 'لبنان', 'الأردن', 'فلسطين', 'العراق'],
  maghreb: ['مصر', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان'],
  europe: ['فرنسا', 'ألمانيا', 'إيطاليا', 'إسبانيا', 'المملكة المتحدة', 'روسيا', 'اليونان', 'سويسرا', 'النرويج', 'هولندا', 'بلجيكا', 'النمسا', 'البرتغال', 'بولندا', 'كرواتيا', 'ماليزيا', 'كمبوديا'],
  americas: ['الولايات المتحدة', 'كندا', 'البرازيل', 'الأرجنتين', 'المكسيك', 'بيرو', 'تشيلي', 'كولومبيا'],
  asia: ['الصين', 'اليابان', 'الهند', 'تركيا', 'إيران', 'باكستان', 'إندونيسيا', 'ماليزيا', 'كوريا الجنوبية', 'تايلاند', 'فيتنام', 'كمبوديا', 'نيبال'],
  africa: ['جنوب أفريقيا', 'زيمبابوي', 'كينيا', 'نيجيريا', 'إثيوبيا'],
  oceania: ['أستراليا', 'نيوزيلندا'],
};

function cleanName(name) {
  return String(name || '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

function guessRegion(country) {
  for (const [r, list] of Object.entries(REGIONS)) {
    if (list.includes(country)) return r;
  }
  return 'other';
}

function makeItem(base) {
  const slug = slugify(base.landmarkName);
  return {
    ...base,
    slug,
    localImage: `assets/landmarks/${slug}.jpg`,
  };
}

const dbPath = path.join(__dirname, 'flag_landmark_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const countries = db.filter((x) => x.type === 'flag').map((x) => x.nameAr);
const seen = new Set();
const items = [];

for (const x of db.filter((i) => i.type === 'landmark')) {
  const landmarkName = cleanName(x.landmarkName);
  const key = landmarkName + '|' + x.nameAr;
  if (seen.has(key)) continue;
  seen.add(key);
  const imageUrl = directImageUrl(x.imageUrl);
  if (!imageUrl) continue;
  items.push(
    makeItem({
      id: x.id,
      landmarkName,
      countryAr: x.nameAr,
      imageUrl,
      region: guessRegion(x.nameAr),
      tier: 1,
    }),
  );
}

let n = items.length;
for (const e of EXTRA) {
  const key = e.landmarkName + '|' + e.countryAr;
  if (seen.has(key)) continue;
  seen.add(key);
  n += 1;
  items.push(
    makeItem({
      id: 'bank_' + n,
      landmarkName: e.landmarkName,
      countryAr: e.countryAr,
      imageUrl: directFromFile(e.file),
      region: e.region,
      tier: e.tier || 2,
    }),
  );
}

const out = {
  version: 2,
  updatedAt: new Date().toISOString().slice(0, 10),
  attribution: 'صور حقيقية — Wikimedia Commons (مستضافة محلياً على LinkUp)',
  source: 'local-bank',
  countries,
  regions: REGIONS,
  items,
};

fs.writeFileSync(path.join(__dirname, 'landmarks-quiz-bank.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', items.length, 'landmarks');
