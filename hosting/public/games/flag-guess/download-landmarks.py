#!/usr/bin/env python3
"""تحميل صور المعالم محلياً — مرة واحدة قبل النشر."""
import json
import os
import re
import ssl
import time
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), 'assets', 'landmarks')
os.makedirs(OUT, exist_ok=True)

# روابط مباشرة (ملف كامل من Commons أو مصدر ثابت) — تم التحقق منها
LANDMARKS = {
    'الكعبة المشرفة': 'https://upload.wikimedia.org/wikipedia/commons/0/06/Kaaba.jpg',
    'برج إيفل': 'https://upload.wikimedia.org/wikipedia/commons/a/af/Tour_eiffel_at_sunrise_from_the_trocadero.jpg',
    'تاج محل': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Taj_Mahal%2C_Agra%2C_India.jpg',
    'تمثال الحرية': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Front_view_of_Statue_of_Liberty_%28cropped%29.jpg',
    'الأهرامات': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Kheops-Pyramid.jpg',
    'أهرامات الجيزة': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Kheops-Pyramid.jpg',
    'سور الصين العظيم': 'https://upload.wikimedia.org/wikipedia/commons/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg',
    'برج خليفة': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Burj_Khalifa.jpg',
    'برج خليفة دبي': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Burj_Khalifa.jpg',
    'الكولوسيوم': 'https://upload.wikimedia.org/wikipedia/commons/d/de/Colosseo_2020.jpg',
    'ماتشو بيتشو': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Machu_Picchu%2C_Peru.jpg',
    'ساعة بيغ بن': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg',
    'دار أوبرا سيدني': 'https://upload.wikimedia.org/wikipedia/commons/4/40/Sydney_Opera_House_Spitfire_over_flight.jpg',
    'برج بيزا المائل': 'https://upload.wikimedia.org/wikipedia/commons/6/66/The_Leaning_Tower_of_Pisa_SB.jpeg',
    'البتراء': 'https://upload.wikimedia.org/wikipedia/commons/6/62/Al_Khazneh_Petra_edit_2.jpg',
    'المسجد الأقصى': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Al-Aqsa_Mosque.jpg',
    'قبة الصخرة': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Dome_of_the_Rock_02.jpg',
    'جامع الشيخ زايد': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Sheikh_Zayed_Mosque%2C_Abu_Dhabi%2C_UAE.jpg',
    'مسجد السلطان أحمد': 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Blue_Mosque%2C_Istanbul%2C_Turkey.jpg',
    'مسجد آيا صوفيا': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Hagia_Sophia_Mars_2013.jpg',
    'جبل فوجي': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/080103_hiru_fuji_sanzenjuroku_ichi.jpg',
    'جبل فوتجي': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/080103_hiru_fuji_sanzenjuroku_ichi.jpg',
    'تمثال المسيح الفادي': 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Christ_the_Redeemer_-_Cristo_Redentor.jpg',
    'بوابة براندنبورغ': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Brandenburger_Tor_abends.jpg',
    'جسر البوابة الذهبية': 'https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg',
    'ستونهنج': 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Stonehenge2007_07_30.jpg',
    'متحف اللوفر': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Louvre_Museum_Wikimedia_Commons.jpg',
    'قصر الكرملين': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Moscow_Kremlin%2C_Russia.jpg',
    'جامع القرويين': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Mosque_of_Al-Quaraouiyine.jpg',
    'أبراج الكويت': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Kuwait_Towers.jpg',
    'قصر فرساي': 'https://upload.wikimedia.org/wikipedia/commons/7/78/Chateau_de_Versailles.jpg',
    'معبد البارثينون': 'https://upload.wikimedia.org/wikipedia/commons/d/da/The_Parthenon_in_Athens.jpg',
    'معبد الكرنك': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Karnak_Temple_Ruins_Egypt.jpg',
    'سوق الحميدية': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Al-Hamidiyah_Souq%2C_Damascus.jpg',
    'قلعة حلب': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Aleppo_Citadel_2011.jpg',
    'مبنى الكابيتول': 'https://upload.wikimedia.org/wikipedia/commons/3/3d/United_States_Capitol_-_west_front.jpg',
    'صخرة الروشة': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Preikestolen_2013.jpg',
    'جسر البوسفور': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Bosphorus_Bridge_at_night.jpg',
    'بحيرة جنيف': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Lake_Geneva_from_Chexbres.jpg',
    'جبال الألب': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Matterhorn_from_Domh%C3%BCtte_-_2.jpg',
    'جبال الألب السويسرية': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Matterhorn_from_Domh%C3%BCtte_-_2.jpg',
}

SLUGS = {
    'الكعبة المشرفة': 'kaaba',
    'برج إيفل': 'eiffel',
    'تاج محل': 'taj-mahal',
    'تمثال الحرية': 'statue-liberty',
    'الأهرامات': 'pyramids',
    'أهرامات الجيزة': 'pyramids',
    'سور الصين العظيم': 'great-wall',
    'برج خليفة': 'burj-khalifa',
    'برج خليفة دبي': 'burj-khalifa',
    'الكولوسيوم': 'colosseum',
    'ماتشو بيتشو': 'machu-picchu',
    'ساعة بيغ بن': 'big-ben',
    'دار أوبرا سيدني': 'sydney-opera',
    'برج بيزا المائل': 'pisa-tower',
    'البتراء': 'petra',
    'المسجد الأقصى': 'al-aqsa',
    'قبة الصخرة': 'dome-rock',
    'جامع الشيخ زايد': 'sheikh-zayed',
    'مسجد السلطان أحمد': 'blue-mosque',
    'مسجد آيا صوفيا': 'hagia-sophia',
    'جبل فوجي': 'fuji',
    'جبل فوتجي': 'fuji',
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
    'جبال الألب السويسرية': 'matterhorn',
}

ctx = ssl.create_default_context()

def slugify(name):
    return SLUGS.get(name, re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'))

def download(name, url, slug):
    path = os.path.join(OUT, slug + '.jpg')
    if os.path.exists(path) and os.path.getsize(path) > 8000:
        print('skip', slug)
        return True
    req = urllib.request.Request(url, headers={
        'User-Agent': 'LinkUpGames/1.0 (landmark-cache; +https://linkup-dc45f.web.app)',
        'Accept': 'image/*',
    })
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            data = resp.read()
        if len(data) < 5000:
            print('tiny', slug, len(data))
            return False
        with open(path, 'wb') as f:
            f.write(data)
        print('ok', slug, len(data))
        return True
    except Exception as e:
        print('fail', slug, e)
        return False

manifest = {}
for i, (name, url) in enumerate(LANDMARKS.items()):
    slug = slugify(name)
    if slug in manifest.values():
        continue
    if i > 0:
        time.sleep(2.5)
    if download(name, url, slug):
        manifest[name] = slug

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump({'slugs': SLUGS, 'files': sorted(set(manifest.values()))}, f, ensure_ascii=False, indent=2)

print('done', len(manifest))
