import { Link } from 'react-router-dom'
import { css } from '../css'
import { useLang, langBtn } from '../LangContext'
import { STR } from '../data/landing'
import Social from '../components/Social'
import StoreBadges from '../components/StoreBadges'

const I = {
  mic: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z" /></svg>,
  call: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 14.4l-3.1-.9a1.3 1.3 0 0 0-1.3.35l-1.25 1.25a13 13 0 0 1-5.6-5.6L8.5 8.2a1.3 1.3 0 0 0 .35-1.3l-.9-3.1A1.3 1.3 0 0 0 6.7 2.8H4.3A1.4 1.4 0 0 0 2.9 4.3 17 17 0 0 0 19.7 21.1a1.4 1.4 0 0 0 1.5-1.4v-2.4a1.3 1.3 0 0 0-1.7-1.9z" /></svg>,
  gift: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7h-2.2a3 3 0 0 0-5.3-2.6L12 5l-.5-.6A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7V8h2v4h7a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM4 14h7v7H5a1 1 0 0 1-1-1v-6zm9 7v-7h7v6a1 1 0 0 1-1 1h-6z" /></svg>,
  vipStar: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.6 10.4a1 1 0 0 1-1 .6H5.6a1 1 0 0 1-1-.6L3 8z" /></svg>,
  diamond: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l3 6-9 12L3 9z" /></svg>,
  people: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3 0-7 1.5-7 4.5V20h14v-2.5C16 14.5 12 13 9 13zm8-2a4 4 0 0 0 0-8 5 5 0 0 1 0 8zm.5 2c1.7.9 3.5 2.3 3.5 4.5V20h2v-2.5c0-2.6-3-4-5.5-4z" /></svg>,
  store: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8h-3a4 4 0 0 0-8 0H5a1 1 0 0 0-1 .94l-.8 10A2 2 0 0 0 5.2 21h13.6a2 2 0 0 0 2-2.06l-.8-10A1 1 0 0 0 19 8zm-7-2a2 2 0 0 1 2 2h-4a2 2 0 0 1 2-2z" /></svg>,
  image: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3.5 4A1.5 1.5 0 1 0 10 8.5 1.5 1.5 0 0 0 8.5 7zM5 19h14v-3l-4-4-3.5 4.5L9 14l-4 5z" /></svg>,
  heart: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" /></svg>,
  wallet: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3zm0 2h17a1 1 0 0 1 1 1v2h-3.5a2.5 2.5 0 0 0 0 5H21v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm14.5 4a1 1 0 1 0 0 2H21v-2h-3.5z" /></svg>,
  shieldCheck: <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-4 8.5-8 9.5C8 19.5 4 16 4 11V5l8-3zm-1.2 13.4l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.8 12.4l3 3z" /></svg>,
}

const PURPLE = { border: '1px solid rgba(225,18,18,.08)', shadow: '0 6px 20px rgba(225,18,18,.06)', hover: '0 18px 40px rgba(225,18,18,.18)' }
const GOLD = { border: '1px solid rgba(255,215,0,.28)', shadow: '0 6px 20px rgba(255,180,0,.1)', hover: '0 18px 40px rgba(255,180,0,.22)' }

const featureCards = [
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#b00814,#e11212)', iconColor: '#fff', iconShadow: 'rgba(225,18,18,.32)', icon: I.mic },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#e11212,#8b0000)', iconColor: '#fff', iconShadow: 'rgba(225,18,18,.32)', icon: I.call },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#ff4d4d,#b00814)', iconColor: '#fff', iconShadow: 'rgba(176,8,20,.32)', icon: I.gift },
  { kind: GOLD, iconBg: 'linear-gradient(135deg,#FFD700,#E0B400)', iconColor: '#3A2A00', iconShadow: 'rgba(224,180,0,.35)', icon: I.vipStar },
  { kind: GOLD, iconBg: 'linear-gradient(135deg,#E0B400,#e11212)', iconColor: '#fff', iconShadow: 'rgba(225,18,18,.32)', icon: I.diamond },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#f2454e,#e11212)', iconColor: '#fff', iconShadow: 'rgba(225,18,18,.32)', icon: I.people },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#8b0000,#ff5a47)', iconColor: '#fff', iconShadow: 'rgba(139,0,0,.32)', icon: I.store },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#e11212,#b00814)', iconColor: '#fff', iconShadow: 'rgba(225,18,18,.32)', icon: I.image },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#ff4d4d,#e11212)', iconColor: '#fff', iconShadow: 'rgba(176,8,20,.32)', icon: I.heart },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#FFD700,#E0B400)', iconColor: '#3A2A00', iconShadow: 'rgba(224,180,0,.35)', icon: I.wallet },
  { kind: PURPLE, iconBg: 'linear-gradient(135deg,#8b0000,#e11212)', iconColor: '#fff', iconShadow: 'rgba(139,0,0,.32)', icon: I.shieldCheck },
]

const stepGrads = ['linear-gradient(135deg,#b00814,#e11212)', 'linear-gradient(135deg,#e11212,#8b0000)', 'linear-gradient(135deg,#8b0000,#ff5a47)']
const stepShadows = ['0 10px 24px rgba(225,18,18,.3)', '0 10px 24px rgba(225,18,18,.3)', '0 10px 24px rgba(139,0,0,.3)']

const checkIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z" /></svg>
const tierStar = (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.6 10.4a1 1 0 0 1-1 .6H5.6a1 1 0 0 1-1-.6L3 8z" /></svg>

export default function Landing() {
  const { lang, dir, setLang } = useLang()
  const t = STR[lang === 'en' ? 'en' : 'ar']

  const navHover = {
    onMouseOver: (e) => { e.currentTarget.style.color = '#e11212' },
    onMouseOut: (e) => { e.currentTarget.style.color = '#443838' },
  }
  const footHover = {
    onMouseOver: (e) => { e.currentTarget.style.color = '#fff' },
    onMouseOut: (e) => { e.currentTarget.style.color = '#e6c7c7' },
  }

  return (
    <div dir={dir} style={css('position:relative;overflow-x:hidden;background:#faf7f7;color:#170b0b;min-height:100vh;line-height:1.5')}>
      <div style={css('position:absolute;top:-120px;inset-inline-start:-100px;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(225,18,18,.28),transparent 70%);filter:blur(20px);pointer-events:none;z-index:0')} />
      <div style={css('position:absolute;top:240px;inset-inline-end:-140px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(176,8,20,.22),transparent 70%);filter:blur(20px);pointer-events:none;z-index:0')} />

      {/* HEADER */}
      <header style={css('position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(247,243,255,.72);border-bottom:1px solid rgba(225,18,18,.12)')}>
        <div style={css('max-width:1200px;margin:0 auto;padding:14px clamp(16px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap')}>
          <a href="#top" style={css('display:flex;align-items:center;gap:10px')}>
            <img src="/linkup-full-black.png" alt="LinkUp" style={css('height:40px;width:auto;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(225,18,18,.28))')} />
          </a>
          <nav style={css('display:flex;align-items:center;gap:clamp(8px,1.6vw,22px);flex-wrap:wrap;font-weight:700;font-size:15px;color:#443838')}>
            <a href="#features" style={css('padding:6px 2px')} {...navHover}>{t.nav.features}</a>
            <a href="#how" style={css('padding:6px 2px')} {...navHover}>{t.nav.how}</a>
            <a href="#vip" style={css('padding:6px 2px')} {...navHover}>{t.nav.vip}</a>
            <Link to="/about" style={css('padding:6px 2px')} {...navHover}>{t.nav.about}</Link>
            <Link to="/contact" style={css('padding:6px 2px')} {...navHover}>{t.nav.contact}</Link>
          </nav>
          <div style={css('display:flex;align-items:center;gap:12px')}>
            <div style={css('display:flex;align-items:center;background:#fff;border:1px solid rgba(225,18,18,.2);border-radius:999px;padding:3px;box-shadow:0 2px 8px rgba(225,18,18,.08)')}>
              <button onClick={() => setLang('ar')} style={lang === 'ar' ? langBtn.active : langBtn.inactive}>العربية</button>
              <button onClick={() => setLang('en')} style={lang === 'en' ? langBtn.active : langBtn.inactive}>EN</button>
            </div>
            <a href="#download" style={css('display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:999px;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(120deg,#b00814,#e11212,#8b0000);box-shadow:0 8px 22px rgba(225,18,18,.4)')} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1zM5 19h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2z" /></svg>
              {t.dl_short}
            </a>
          </div>
        </div>
      </header>

      <a id="top" />

      {/* HERO */}
      <section style={css('position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:clamp(36px,6vw,80px) clamp(16px,4vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:clamp(32px,5vw,64px);align-items:center')}>
        <div>
          <span style={css('display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;background:rgba(225,18,18,.1);color:#e11212;font-weight:800;font-size:13px;margin-bottom:22px')}>
            <span style={css('width:8px;height:8px;border-radius:50%;background:#b00814;animation:lu-pulse 1.6s infinite')} />{t.heroBadge}
          </span>
          <h1 style={css("font-family:'Plus Jakarta Sans','Tajawal',sans-serif;font-weight:800;font-size:clamp(34px,6vw,60px);line-height:1.1;letter-spacing:-1px;margin-bottom:20px")}>
            <span style={{ display: 'block' }}>{t.heroT1}</span>
            <span style={css('display:block;background:linear-gradient(120deg,#b00814,#e11212,#8b0000);-webkit-background-clip:text;background-clip:text;color:transparent')}>{t.heroT2}</span>
          </h1>
          <p style={css('font-size:clamp(16px,2.4vw,21px);color:#6e6060;max-width:520px;margin-bottom:32px;text-wrap:pretty')}>{t.heroSub}</p>

          <div id="download" style={css('display:flex;gap:14px;flex-wrap:wrap;margin-bottom:26px')}>
            <StoreBadges />
          </div>

          <div style={css('display:flex;align-items:center;gap:10px;color:#7c6e6e;font-size:14px;font-weight:600')}>
            <div style={{ display: 'flex' }}>
              <span style={css('width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#b00814,#e11212);border:2px solid #faf7f7;margin-inline-start:-8px')} />
              <span style={css('width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#e11212,#8b0000);border:2px solid #faf7f7;margin-inline-start:-8px')} />
              <span style={css('width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8b0000,#ff5a47);border:2px solid #faf7f7;margin-inline-start:-8px')} />
            </div>
            <span style={css('display:inline-flex;gap:2px;color:#FFB400')}>★★★★★</span>
            <span>{t.heroRating}</span>
          </div>
        </div>

        <div style={css('position:relative;display:flex;justify-content:center')}>
          <div style={{ ...css('position:absolute;top:8%;inset-inline-start:-4%;z-index:3;animation:lu-float 4.2s ease-in-out infinite'), '--r': '-8deg' }}>
            <div style={css('display:flex;align-items:center;gap:8px;background:#fff;padding:10px 14px;border-radius:16px;box-shadow:0 12px 30px rgba(225,18,18,.25)')}>
              <span style={css('width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#ff4d4d,#b00814);display:grid;place-items:center')}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" /></svg></span>
              <span style={css('font-weight:800;font-size:13px;color:#170b0b')}>+199</span>
            </div>
          </div>
          <div style={{ ...css('position:absolute;top:38%;inset-inline-end:-6%;z-index:3;animation:lu-float 5s ease-in-out infinite .6s'), '--r': '7deg' }}>
            <div style={css('display:flex;align-items:center;gap:8px;background:#fff;padding:10px 14px;border-radius:16px;box-shadow:0 12px 30px rgba(139,0,0,.25)')}>
              <span style={css('width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#FFD700,#E0B400);display:grid;place-items:center')}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.6 10.4a1 1 0 0 1-1 .6H5.6a1 1 0 0 1-1-.6L3 8z" /></svg></span>
              <span style={css('font-weight:800;font-size:13px;color:#170b0b')}>VIP</span>
            </div>
          </div>
          <div style={css('position:absolute;bottom:6%;inset-inline-start:2%;z-index:3;animation:lu-float2 4.6s ease-in-out infinite .3s')}>
            <div style={css('display:flex;align-items:center;gap:8px;background:#fff;padding:9px 13px;border-radius:14px;box-shadow:0 10px 26px rgba(225,18,18,.22)')}>
              <span style={css('width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#e11212,#8b0000);display:grid;place-items:center')}><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M20 7h-2.2a3 3 0 0 0-5.3-2.6L12 5l-.5-.6A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7V8h2v4h7a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM4 14h7v7H5a1 1 0 0 1-1-1v-6zm9 7v-7h7v6a1 1 0 0 1-1 1h-6z" /></svg></span>
              <span style={css('font-weight:800;font-size:12px;color:#170b0b')}>Gift</span>
            </div>
          </div>

          <div style={css('position:relative;z-index:2;width:clamp(240px,70vw,300px);aspect-ratio:9/19;background:#0a0a0a;border-radius:42px;padding:11px;box-shadow:0 40px 90px rgba(20,6,6,.45),0 0 0 2px rgba(225,18,18,.25);overflow:hidden')}>
            <div style={css('position:absolute;top:18px;left:50%;transform:translateX(-50%);width:90px;height:24px;background:#0a0a0a;border-radius:0 0 16px 16px;z-index:5')} />
            <div style={css('width:100%;height:100%;border-radius:32px;overflow:hidden;background:linear-gradient(165deg,#1e0808 0%,#320c0e 45%,#180809 100%);position:relative;display:flex;flex-direction:column')}>
              <div style={css('padding:34px 16px 12px;display:flex;align-items:center;justify-content:space-between')}>
                <div style={css('display:flex;flex-direction:column')}>
                  <span style={css('color:#fff;font-weight:800;font-size:14px')}>{t.roomTitle}</span>
                  <span style={css('display:inline-flex;align-items:center;gap:5px;color:#f4d3d3;font-size:10px;font-weight:600')}><span style={css('display:inline-flex;align-items:center;gap:4px;background:#b00814;color:#fff;padding:2px 7px;border-radius:6px')}><span style={css('width:5px;height:5px;border-radius:50%;background:#fff;animation:lu-pulse 1.4s infinite')} />{t.roomLive}</span>{t.roomListeners}</span>
                </div>
                <span style={css('width:30px;height:30px;border-radius:10px;background:rgba(255,255,255,.12);display:grid;place-items:center;color:#fff')}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg></span>
              </div>
              <div style={css('flex:1;padding:8px 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px;align-content:start')}>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}>
                  <div style={css('position:relative;width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#FFD700,#E0B400);padding:2px;box-shadow:0 0 0 2px rgba(255,215,0,.4)')}>
                    <div style={css('width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#b00814,#e11212)')} />
                    <span style={css('position:absolute;top:-9px;left:50%;transform:translateX(-50%)')}><svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD700"><path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.6 10.4a1 1 0 0 1-1 .6H5.6a1 1 0 0 1-1-.6L3 8z" /></svg></span>
                    <span style={css('position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(255,215,0,.5);animation:lu-ring 2s infinite')} />
                  </div>
                  <span style={css('color:#f7e2e2;font-size:9px;font-weight:700')}>{t.hostLabel}</span>
                </div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#e11212,#8b0000);box-shadow:0 4px 12px rgba(0,0,0,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#8b0000,#ff5a47);box-shadow:0 4px 12px rgba(0,0,0,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#ff4d4d,#b00814);box-shadow:0 4px 12px rgba(0,0,0,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.1);border:1.5px dashed rgba(255,255,255,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#f2454e,#e11212);box-shadow:0 4px 12px rgba(0,0,0,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.1);border:1.5px dashed rgba(255,255,255,.3)')} /></div>
                <div style={css('display:flex;flex-direction:column;align-items:center;gap:5px')}><div style={css('width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.1);border:1.5px dashed rgba(255,255,255,.3)')} /></div>
              </div>
              <span style={css('position:absolute;bottom:78px;inset-inline-end:24px;animation:lu-float 3.4s ease-in-out infinite')}><svg width="22" height="22" viewBox="0 0 24 24" fill="#ff4d4d"><path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z" /></svg></span>
              <div style={css('padding:10px 14px 16px;display:flex;align-items:center;gap:8px')}>
                <div style={css('flex:1;height:38px;border-radius:999px;background:rgba(255,255,255,.12);display:flex;align-items:center;padding:0 14px;color:#e6b0b0;font-size:11px')}>…</div>
                <span style={css('width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;color:#fff')}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z" /></svg></span>
                <span style={css('width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#FFD700,#E0B400);display:grid;place-items:center;color:#3A2A00')}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7h-2.2a3 3 0 0 0-5.3-2.6L12 5l-.5-.6A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7V8h2v4h7a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM4 14h7v7H5a1 1 0 0 1-1-1v-6zm9 7v-7h7v6a1 1 0 0 1-1 1h-6z" /></svg></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section style={css('position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:0 clamp(16px,4vw,40px) clamp(24px,4vw,40px)')}>
        <div style={css('display:flex;flex-wrap:wrap;justify-content:center;gap:14px 30px;padding:18px 24px;background:#fff;border-radius:20px;box-shadow:0 10px 30px rgba(225,18,18,.1);border:1px solid rgba(225,18,18,.08)')}>
          <span style={css('display:inline-flex;align-items:center;gap:9px;font-weight:700;color:#443838;font-size:15px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#e11212"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3 0-7 1.5-7 4.5V20h14v-2.5C16 14.5 12 13 9 13zm8-2a4 4 0 0 0 0-8 5 5 0 0 1 0 8zm.5 2c1.7.9 3.5 2.3 3.5 4.5V20h2v-2.5c0-2.6-3-4-5.5-4z" /></svg>{t.trustA}</span>
          <span style={css('display:inline-flex;align-items:center;gap:9px;font-weight:700;color:#443838;font-size:15px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b00814" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>{t.trustB}</span>
          <span style={css('display:inline-flex;align-items:center;gap:9px;font-weight:700;color:#443838;font-size:15px')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#8b0000"><rect x="6" y="2" width="12" height="20" rx="3" /><rect x="10.5" y="17.5" width="3" height="1.6" rx=".8" fill="#fff" /></svg>{t.trustC}</span>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={css('position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(16px,4vw,40px)')}>
        <div style={css('text-align:center;margin-bottom:clamp(30px,5vw,52px)')}>
          <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:10px')}>{t.kFeatures}</span>
          <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);letter-spacing:-.5px;margin-bottom:12px')}>{t.featTitle}</h2>
          <p style={css('color:#6e6363;font-size:clamp(15px,2vw,18px);max-width:620px;margin:0 auto')}>{t.featSub}</p>
        </div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:18px')}>
          {featureCards.map((c, i) => (
            <div
              key={i}
              style={css(`background:#fff;border-radius:20px;padding:26px;border:${c.kind.border};box-shadow:${c.kind.shadow};transition:transform .25s,box-shadow .25s`)}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = c.kind.hover }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = c.kind.shadow }}
            >
              <div style={css(`width:54px;height:54px;border-radius:16px;background:${c.iconBg};display:grid;place-items:center;color:${c.iconColor};margin-bottom:16px;box-shadow:0 8px 18px ${c.iconShadow}`)}>{c.icon}</div>
              <h3 style={css('font-weight:800;font-size:18px;margin-bottom:7px')}>{t.features[i].t}</h3>
              <p style={css('color:#6e6363;font-size:14.5px;line-height:1.6')}>{t.features[i].d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={css('position:relative;z-index:1;background:#fff;border-block:1px solid rgba(225,18,18,.08)')}>
        <div style={css('max-width:1100px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(16px,4vw,40px)')}>
          <div style={css('text-align:center;margin-bottom:clamp(30px,5vw,52px)')}>
            <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:10px')}>{t.kHow}</span>
            <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);letter-spacing:-.5px')}>{t.howTitle}</h2>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:22px')}>
            {t.steps.map((s, i) => (
              <div key={i} style={css('text-align:center;padding:30px 22px;border-radius:20px;background:linear-gradient(165deg,#faf7f7,#fcf8f8);border:1px solid rgba(225,18,18,.1)')}>
                <div style={css(`width:60px;height:60px;border-radius:50%;background:${stepGrads[i]};color:#fff;display:grid;place-items:center;font-weight:800;font-size:26px;margin:0 auto 18px;box-shadow:${stepShadows[i]}`)}>{s.n}</div>
                <h3 style={css('font-weight:800;font-size:19px;margin-bottom:8px')}>{s.t}</h3>
                <p style={css('color:#6e6363;font-size:15px')}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIP */}
      <section id="vip" style={css('position:relative;z-index:1;overflow:hidden;background:linear-gradient(150deg,#180809 0%,#3a0e10 55%,#180809 100%);color:#fff')}>
        <div style={css('position:absolute;top:-80px;inset-inline-end:-60px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,.18),transparent 70%);filter:blur(10px)')} />
        <div style={css('max-width:1200px;margin:0 auto;padding:clamp(44px,6vw,84px) clamp(16px,4vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:clamp(32px,5vw,60px);align-items:center;position:relative')}>
          <div>
            <span style={css('display:inline-flex;align-items:center;gap:8px;color:#FFD700;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:14px')}>{tierStar('#FFD700')}{t.kVip}</span>
            <h2 style={css('font-weight:800;font-size:clamp(28px,4.6vw,46px);line-height:1.12;margin-bottom:16px;background:linear-gradient(120deg,#FFD700,#FFF3B0,#FFD700);-webkit-background-clip:text;background-clip:text;color:transparent')}>{t.vipTitle}</h2>
            <p style={css('color:#f4d3d3;font-size:clamp(15px,2vw,18px);max-width:520px;margin-bottom:26px')}>{t.vipSub}</p>
            <div style={css('display:grid;gap:12px;max-width:460px')}>
              {t.vipFeat.map((f, i) => (
                <div key={i} style={css('display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,215,0,.18);border-radius:14px')}>
                  <span style={css('width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#FFD700,#E0B400);display:grid;place-items:center;color:#3A2A00')}>{checkIcon}</span>
                  <span style={css('font-weight:700;font-size:15px')}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={css('background:linear-gradient(165deg,rgba(255,255,255,.1),rgba(255,255,255,.03));border:1px solid rgba(255,215,0,.3);border-radius:26px;padding:28px;backdrop-filter:blur(10px);box-shadow:0 30px 70px rgba(0,0,0,.4)')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:22px')}>
                <span style={css('font-weight:800;font-size:16px;color:#FFE9A0')}>Aristocracy</span>
                <span style={css('background:linear-gradient(120deg,#FFD700,#E0B400);color:#3A2A00;font-weight:800;font-size:12px;padding:5px 12px;border-radius:999px;background-size:200% 100%;animation:lu-shine 3s linear infinite')}>SVIP</span>
              </div>
              <div style={css('display:flex;flex-direction:column;gap:10px')}>
                <div style={css('display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:rgba(225,18,18,.25);border:1px solid rgba(242,69,78,.4)')}><span style={css('width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f2454e,#e11212);display:grid;place-items:center')}>{tierStar('#fff')}</span><span style={css('font-weight:800;font-size:16px')}>{t.vipTiers[0]}</span></div>
                <div style={css('display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:rgba(139,0,0,.22);border:1px solid rgba(139,0,0,.4)')}><span style={css('width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#8b0000,#ff5a47);display:grid;place-items:center')}>{tierStar('#fff')}</span><span style={css('font-weight:800;font-size:16px')}>{t.vipTiers[1]}</span></div>
                <div style={css('display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:rgba(176,8,20,.2);border:1px solid rgba(176,8,20,.4)')}><span style={css('width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#ff4d4d,#b00814);display:grid;place-items:center')}>{tierStar('#fff')}</span><span style={css('font-weight:800;font-size:16px')}>{t.vipTiers[2]}</span></div>
                <div style={css('display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:rgba(255,215,0,.14);border:1px solid rgba(255,215,0,.45)')}><span style={css('width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FFD700,#E0B400);display:grid;place-items:center;color:#3A2A00')}>{tierStar('currentColor')}</span><span style={css('font-weight:800;font-size:16px;color:#FFE9A0')}>{t.vipTiers[3]}</span></div>
                <div style={css('display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:linear-gradient(120deg,rgba(255,215,0,.28),rgba(224,180,0,.18));border:1px solid rgba(255,215,0,.6)')}><span style={css('width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FFF3B0,#FFD700);display:grid;place-items:center;color:#3A2A00')}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l3 6-9 12L3 9z" /></svg></span><span style={css('font-weight:800;font-size:16px;color:#FFF3B0')}>{t.vipTiers[4]}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CREATORS & AGENCIES */}
      <section style={css('position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:clamp(44px,6vw,84px) clamp(16px,4vw,40px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:clamp(32px,5vw,56px);align-items:center')}>
        <div style={{ order: 2 }}>
          <div style={css('position:relative;background:linear-gradient(165deg,#fff,#fcf8f8);border:1px solid rgba(225,18,18,.12);border-radius:26px;padding:30px;box-shadow:0 24px 60px rgba(225,18,18,.14)')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:22px')}>
              <span style={css('font-weight:800;font-size:15px;color:#443838')}>{t.earnPanelTitle}</span>
              <span style={css('display:inline-flex;align-items:center;gap:6px;color:#22A06B;font-weight:800;font-size:14px')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 16l5-5 4 4 7-7M14 8h6v6" /></svg>+38%</span>
            </div>
            <div style={css('display:flex;align-items:flex-end;gap:10px;height:130px;margin-bottom:18px')}>
              <div style={css('flex:1;height:42%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f1cccc,#f2454e)')} />
              <div style={css('flex:1;height:60%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f0a0a0,#e11212)')} />
              <div style={css('flex:1;height:50%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f1cccc,#f2454e)')} />
              <div style={css('flex:1;height:78%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f06a6a,#e11212)')} />
              <div style={css('flex:1;height:66%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f0a0a0,#e11212)')} />
              <div style={css('flex:1;height:100%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#FFD700,#E0B400)')} />
            </div>
            <div style={css('display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:linear-gradient(120deg,#FFD700,#E0B400);color:#3A2A00')}>
              <span style={css('width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.4);display:grid;place-items:center')}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3 0-7 1.5-7 4.5V20h14v-2.5C16 14.5 12 13 9 13zm8-2a4 4 0 0 0 0-8 5 5 0 0 1 0 8zm.5 2c1.7.9 3.5 2.3 3.5 4.5V20h2v-2.5c0-2.6-3-4-5.5-4z" /></svg></span>
              <div style={css('display:flex;flex-direction:column')}><span style={css('font-weight:800;font-size:15px')}>{t.earnBadgeTitle}</span><span style={css('font-size:12px;font-weight:600;opacity:.8')}>{t.earnBadgeSub}</span></div>
            </div>
          </div>
        </div>
        <div style={{ order: 1 }}>
          <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:12px')}>{t.kEarn}</span>
          <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);line-height:1.15;letter-spacing:-.5px;margin-bottom:16px')}>{t.earnTitle}</h2>
          <p style={css('color:#6e6363;font-size:clamp(15px,2vw,18px);max-width:520px;margin-bottom:26px')}>{t.earnSub}</p>
          <div style={css('display:grid;gap:16px;max-width:500px')}>
            <div style={css('display:flex;gap:14px')}><span style={css('flex:none;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#b00814,#e11212);display:grid;place-items:center;color:#fff')}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3 0-7 1.5-7 4.5V20h14v-2.5C16 14.5 12 13 9 13zm8-2a4 4 0 0 0 0-8 5 5 0 0 1 0 8zm.5 2c1.7.9 3.5 2.3 3.5 4.5V20h2v-2.5c0-2.6-3-4-5.5-4z" /></svg></span><div><h3 style={css('font-weight:800;font-size:16px;margin-bottom:3px')}>{t.earn[0].t}</h3><p style={css('color:#6e6363;font-size:14px')}>{t.earn[0].d}</p></div></div>
            <div style={css('display:flex;gap:14px')}><span style={css('flex:none;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#e11212,#8b0000);display:grid;place-items:center;color:#fff')}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-8.5 13.5L7 13l1.4-1.4 2.1 2.1 4.6-4.6L16.5 10z" /></svg></span><div><h3 style={css('font-weight:800;font-size:16px;margin-bottom:3px')}>{t.earn[1].t}</h3><p style={css('color:#6e6363;font-size:14px')}>{t.earn[1].d}</p></div></div>
            <div style={css('display:flex;gap:14px')}><span style={css('flex:none;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#FFD700,#E0B400);display:grid;place-items:center;color:#3A2A00')}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3zm0 2h17a1 1 0 0 1 1 1v2h-3.5a2.5 2.5 0 0 0 0 5H21v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" /></svg></span><div><h3 style={css('font-weight:800;font-size:16px;margin-bottom:3px')}>{t.earn[2].t}</h3><p style={css('color:#6e6363;font-size:14px')}>{t.earn[2].d}</p></div></div>
          </div>
        </div>
      </section>

      {/* ENTERTAINMENT */}
      <section style={css('position:relative;z-index:1;background:#fff;border-block:1px solid rgba(225,18,18,.08)')}>
        <div style={css('max-width:1100px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(16px,4vw,40px)')}>
          <div style={css('text-align:center;margin-bottom:clamp(28px,5vw,48px)')}>
            <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:10px')}>{t.kEnt}</span>
            <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);letter-spacing:-.5px;margin-bottom:12px')}>{t.entTitle}</h2>
            <p style={css('color:#6e6363;font-size:clamp(15px,2vw,18px);max-width:600px;margin:0 auto')}>{t.entSub}</p>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:16px')}>
            <div style={css('border-radius:20px;padding:26px 18px;text-align:center;background:linear-gradient(160deg,#ff4d4d,#b00814);color:#fff;box-shadow:0 14px 34px rgba(176,8,20,.28)')}><span style={css('display:grid;place-items:center;width:48px;height:48px;margin:0 auto 12px;border-radius:14px;background:rgba(255,255,255,.2)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7h-2.2a3 3 0 0 0-5.3-2.6L12 5l-.5-.6A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7V8h2v4h7a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM4 14h7v7H5a1 1 0 0 1-1-1v-6zm9 7v-7h7v6a1 1 0 0 1-1 1h-6z" /></svg></span><span style={css('font-weight:800;font-size:15px')}>{t.ent[0]}</span></div>
            <div style={css('border-radius:20px;padding:26px 18px;text-align:center;background:linear-gradient(160deg,#FFD700,#E0B400);color:#3A2A00;box-shadow:0 14px 34px rgba(224,180,0,.3)')}><span style={css('display:grid;place-items:center;width:48px;height:48px;margin:0 auto 12px;border-radius:14px;background:rgba(255,255,255,.4)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h4V11H3v10zm7 0h4V3h-4v18zm7 0h4v-7h-4v7z" /></svg></span><span style={css('font-weight:800;font-size:15px')}>{t.ent[1]}</span></div>
            <div style={css('border-radius:20px;padding:26px 18px;text-align:center;background:linear-gradient(160deg,#8b0000,#ff5a47);color:#fff;box-shadow:0 14px 34px rgba(139,0,0,.28)')}><span style={css('display:grid;place-items:center;width:48px;height:48px;margin:0 auto 12px;border-radius:14px;background:rgba(255,255,255,.2)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v6a6 6 0 0 1-4 5.65V17h3v2H7v-2h3v-2.35A6 6 0 0 1 6 9V3h12zM4 4h1v3a3 3 0 0 1-1-2.24V4zm15 0h1v.76A3 3 0 0 1 19 7V4z" /></svg></span><span style={css('font-weight:800;font-size:15px')}>{t.ent[2]}</span></div>
          </div>
        </div>
      </section>

      {/* SAFETY */}
      <section id="safety" style={css('position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:clamp(44px,6vw,80px) clamp(16px,4vw,40px)')}>
        <div style={css('text-align:center;margin-bottom:clamp(28px,5vw,48px)')}>
          <span style={css('display:inline-flex;align-items:center;gap:8px;color:#8b0000;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:10px')}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-4 8.5-8 9.5C8 19.5 4 16 4 11V5l8-3z" /></svg>{t.kSafe}</span>
          <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);letter-spacing:-.5px;margin-bottom:12px')}>{t.safeTitle}</h2>
          <p style={css('color:#6e6363;font-size:clamp(15px,2vw,18px);max-width:600px;margin:0 auto')}>{t.safeSub}</p>
        </div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px')}>
          <div style={css('background:linear-gradient(165deg,#fff,#fef8f8);border:1px solid rgba(139,0,0,.14);border-radius:20px;padding:26px')}><span style={css('display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,#8b0000,#ff5a47);color:#fff;margin-bottom:14px')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 8.2-8 9.5C7.5 19.2 4 16 4 11V5l8-3zm0 5a2.5 2.5 0 0 0-1 4.78V14h2v-2.22A2.5 2.5 0 0 0 12 7z" /></svg></span><h3 style={css('font-weight:800;font-size:17px;margin-bottom:6px')}>{t.safe[0].t}</h3><p style={css('color:#6e6363;font-size:14.5px')}>{t.safe[0].d}</p></div>
          <div style={css('background:linear-gradient(165deg,#fff,#fdf8f8);border:1px solid rgba(225,18,18,.14);border-radius:20px;padding:26px')}><span style={css('display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,#e11212,#f2454e);color:#fff;margin-bottom:14px')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" /><path d="M3 2.5L21.5 21l-1.4 1.4L1.6 3.9z" /></svg></span><h3 style={css('font-weight:800;font-size:17px;margin-bottom:6px')}>{t.safe[1].t}</h3><p style={css('color:#6e6363;font-size:14.5px')}>{t.safe[1].d}</p></div>
          <div style={css('background:linear-gradient(165deg,#fff,#fff5f5);border:1px solid rgba(176,8,20,.14);border-radius:20px;padding:26px')}><span style={css('display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,#b00814,#ff4d4d);color:#fff;margin-bottom:14px')}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4zm-1.5 8a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zM9 16h6v-1c0-1.7-1.3-2.5-3-2.5s-3 .8-3 2.5v1z" /></svg></span><h3 style={css('font-weight:800;font-size:17px;margin-bottom:6px')}>{t.safe[2].t}</h3><p style={css('color:#6e6363;font-size:14.5px')}>{t.safe[2].d}</p></div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={css('position:relative;z-index:1;background:#fff;border-block:1px solid rgba(225,18,18,.08)')}>
        <div style={css('max-width:1100px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(16px,4vw,40px)')}>
          <div style={css('text-align:center;margin-bottom:clamp(28px,5vw,48px)')}>
            <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:14px;letter-spacing:1px;margin-bottom:10px')}>{t.kTesti}</span>
            <h2 style={css('font-weight:800;font-size:clamp(26px,4.4vw,42px);letter-spacing:-.5px')}>{t.testiTitle}</h2>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:20px')}>
            {t.testi.map((q, i) => (
              <div key={i} style={css('background:linear-gradient(165deg,#fdf9f9,#fbf5f5);border:1px solid rgba(225,18,18,.1);border-radius:20px;padding:26px')}>
                <div style={css('display:inline-flex;gap:2px;color:#FFB400;margin-bottom:14px')}>★★★★★</div>
                <p style={css('font-size:16px;color:#2a1414;line-height:1.7;margin-bottom:18px;font-weight:500')}>“{q.q}”</p>
                <div style={css('display:flex;align-items:center;gap:12px')}>
                  <span style={css(`width:44px;height:44px;border-radius:50%;background:${['linear-gradient(135deg,#b00814,#e11212)', 'linear-gradient(135deg,#e11212,#8b0000)', 'linear-gradient(135deg,#FFD700,#E0B400)'][i]}`)} />
                  <div><div style={css('font-weight:800;font-size:15px')}>{q.n}</div><div style={css('color:#9a8686;font-size:13px')}>{q.r}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={css('position:relative;z-index:1;overflow:hidden;background:linear-gradient(125deg,#b00814 0%,#e11212 50%,#8b0000 100%)')}>
        <div style={css('position:absolute;top:-60px;inset-inline-start:10%;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.12);filter:blur(8px)')} />
        <div style={css('position:absolute;bottom:-80px;inset-inline-end:6%;width:260px;height:260px;border-radius:50%;background:rgba(255,215,0,.18);filter:blur(8px)')} />
        <div style={css('max-width:1000px;margin:0 auto;padding:clamp(46px,6vw,90px) clamp(16px,4vw,40px);text-align:center;position:relative;color:#fff')}>
          <img src="/linkup-id-logo.png" alt="LinkUp" style={css('width:72px;height:72px;object-fit:contain;margin-bottom:18px;filter:drop-shadow(0 8px 20px rgba(0,0,0,.3))')} />
          <h2 style={css('font-weight:800;font-size:clamp(28px,5vw,48px);line-height:1.12;letter-spacing:-.5px;margin-bottom:14px;text-wrap:balance')}>{t.finalTitle}</h2>
          <p style={css('font-size:clamp(16px,2.2vw,20px);opacity:.92;max-width:560px;margin:0 auto 30px')}>{t.finalSub}</p>
          <div style={css('display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:18px')}>
            <div style={css('display:flex;gap:14px;flex-wrap:wrap;justify-content:center')}>
              <StoreBadges padding="12px 22px" shadow="0 12px 28px rgba(0,0,0,.3)" />
            </div>
            <div style={css('display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.14);padding:12px 16px;border-radius:16px;backdrop-filter:blur(6px)')}>
              <div style={css('width:74px;height:74px;border-radius:12px;background:#fff;padding:7px;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(7,1fr);gap:1.5px')}>
                <span style={css('background:#180809;grid-column:1/4;grid-row:1/4;border-radius:3px')} /><span style={css('background:#180809;grid-column:5/8;grid-row:1/4;border-radius:3px')} /><span style={css('background:#180809;grid-column:1/4;grid-row:5/8;border-radius:3px')} /><span style={css('background:#e11212;grid-column:5/6;grid-row:5/6')} /><span style={css('background:#180809;grid-column:6/7;grid-row:6/7')} /><span style={css('background:#e11212;grid-column:7/8;grid-row:5/6')} /><span style={css('background:#180809;grid-column:5/6;grid-row:7/8')} /><span style={css('background:#e11212;grid-column:7/8;grid-row:7/8')} />
              </div>
              <span style={css('font-weight:700;font-size:14px;max-width:90px;text-align:start')}>{t.qrLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={css('position:relative;z-index:1;background:#150808;color:#e6c7c7')}>
        <div style={css('max-width:1200px;margin:0 auto;padding:clamp(38px,5vw,60px) clamp(16px,4vw,40px) 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:32px')}>
          <div>
            <div style={css('display:flex;align-items:center;gap:10px;margin-bottom:14px')}><img src="/linkup-id-logo.png" alt="LinkUp" style={css('width:40px;height:40px;object-fit:contain')} /><span style={css('font-weight:800;font-size:20px;color:#fff')}>LinkUp</span></div>
            <p style={css('font-size:14.5px;line-height:1.7;max-width:300px;color:#c7a9a9')}>{t.footerTagline}</p>
            <div style={css('display:flex;gap:10px;margin-top:18px;flex-wrap:wrap')}>
              <Social box={40} icon={19} radius={12} />
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:11px')}>
            <div style={css('font-weight:800;color:#fff;font-size:15px;margin-bottom:3px')}>{t.fLinksTitle}</div>
            <a href="#top" style={css('font-size:14.5px')} {...footHover}>{t.lHome}</a>
            <a href="#features" style={css('font-size:14.5px')} {...footHover}>{t.lFeatures}</a>
            <Link to="/about" style={css('font-size:14.5px')} {...footHover}>{t.lAbout}</Link>
            <Link to="/contact" style={css('font-size:14.5px')} {...footHover}>{t.lContact}</Link>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:11px')}>
            <div style={css('font-weight:800;color:#fff;font-size:15px;margin-bottom:3px')}>{t.fLegalTitle}</div>
            <Link to="/privacy" style={css('font-size:14.5px')} {...footHover}>{t.lPrivacy}</Link>
            <Link to="/delete-account" style={css('font-size:14.5px')} {...footHover}>{t.lDelete}</Link>
            <Link to="/contact" style={css('font-size:14.5px')} {...footHover}>{t.lSupport}</Link>
          </div>
          <div>
            <div style={css('font-weight:800;color:#fff;font-size:15px;margin-bottom:12px')}>{t.dlTitle}</div>
            <div style={css('display:flex;flex-direction:column;gap:10px;max-width:200px')}>
              <a href="#download" style={css('display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.08);border-radius:11px;padding:9px 14px;color:#fff;font-weight:700;font-size:14px')} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.16)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.4 2.5-.4 6.2 1 8.3.7 1 1.4 2.1 2.5 2.1 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.1z" /></svg>App Store</a>
              <a href="#download" style={css('display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,.08);border-radius:11px;padding:9px 14px;color:#fff;font-weight:700;font-size:14px')} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.16)' }} onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)' }}><svg width="18" height="18" viewBox="0 0 24 24"><path d="M3.6 2.3c-.3.2-.5.6-.5 1.1v17.2c0 .5.2.9.5 1.1l9.3-9.7L3.6 2.3z" fill="#ff5a47" /><path d="M16.4 8.9 12.9 12l3.5 3.1 4-2.3c.7-.4.7-1.4 0-1.8l-4-2.1z" fill="#FFCE00" /><path d="M3.6 2.3 12.9 12l3.5-3.1L5.6 2.6c-.7-.4-1.5-.5-2-.3z" fill="#00F076" /><path d="M3.6 21.7c.5.2 1.3.1 2-.3l10.8-6.3L12.9 12 3.6 21.7z" fill="#FF3A44" /></svg>Google Play</a>
            </div>
          </div>
        </div>
        <div style={css('border-top:1px solid rgba(255,255,255,.08)')}><div style={css('max-width:1200px;margin:0 auto;padding:18px clamp(16px,4vw,40px);display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;font-size:13.5px;color:#a88f8f')}><span>{t.footerRights}</span><a href="https://linkuplivechat.com" style={css('color:#eaadad;font-weight:700')} onMouseOver={(e) => { e.currentTarget.style.color = '#fff' }} onMouseOut={(e) => { e.currentTarget.style.color = '#eaadad' }}>linkuplivechat.com</a></div></div>
      </footer>
    </div>
  )
}
