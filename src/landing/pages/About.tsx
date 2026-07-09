import { Link } from 'react-router-dom'
import { css } from '../css'
import { useLang } from '../LangContext'
import { STR } from '../data/about'
import SubHeader from '../components/SubHeader'
import SubFooter from '../components/SubFooter'

const valueIcons = [
  { bg: 'linear-gradient(135deg,#b00814,#e11212)', color: '#fff', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3 0-7 1.5-7 4.5V20h14v-2.5C16 14.5 12 13 9 13zm8-2a4 4 0 0 0 0-8 5 5 0 0 1 0 8zm.5 2c1.7.9 3.5 2.3 3.5 4.5V20h2v-2.5c0-2.6-3-4-5.5-4z" /></svg> },
  { bg: 'linear-gradient(135deg,#8b0000,#ff5a47)', color: '#fff', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-4 8.5-8 9.5C8 19.5 4 16 4 11V5l8-3zm-1.2 13.4l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.8 12.4l3 3z" /></svg> },
  { bg: 'linear-gradient(135deg,#FFD700,#E0B400)', color: '#3A2A00', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7h-2.2a3 3 0 0 0-5.3-2.6L12 5l-.5-.6A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7V8h2v4h7a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM4 14h7v7H5a1 1 0 0 1-1-1v-6zm9 7v-7h7v6a1 1 0 0 1-1 1h-6z" /></svg> },
  { bg: 'linear-gradient(135deg,#f2454e,#e11212)', color: '#fff', icon: <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z" /></svg> },
]

export default function About() {
  const { lang, dir } = useLang()
  const t = STR[lang === 'en' ? 'en' : 'ar']

  return (
    <div dir={dir} style={css('position:relative;overflow-x:hidden;background:#faf7f7;color:#170b0b;min-height:100vh;line-height:1.5')}>
      <SubHeader maxWidth={1080} backHome={t.backHome} arrowFlip={t.arrowFlip} />

      <section style={css('position:relative;overflow:hidden;background:linear-gradient(135deg,#180809 0%,#3a0e10 55%,#180809 100%);color:#fff')}>
        <div style={css('position:absolute;top:-60px;inset-inline-start:-40px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(176,8,20,.3),transparent 70%);filter:blur(16px)')} />
        <div style={css('position:absolute;bottom:-80px;inset-inline-end:-40px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(139,0,0,.3),transparent 70%);filter:blur(16px)')} />
        <div style={css('max-width:1080px;margin:0 auto;padding:clamp(46px,7vw,86px) clamp(16px,4vw,40px);position:relative;text-align:center')}>
          <img src="/linkup-id-logo.png" alt="LinkUp" style={css('width:84px;height:84px;object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 8px 22px rgba(0,0,0,.4))')} />
          <h1 style={css('font-weight:800;font-size:clamp(30px,5.5vw,52px);letter-spacing:-1px;margin-bottom:14px')}>{t.title}</h1>
          <p style={css('font-size:clamp(16px,2.4vw,20px);color:#f4d3d3;max-width:640px;margin:0 auto;text-wrap:pretty')}>{t.sub}</p>
        </div>
      </section>

      <main style={css('position:relative;max-width:1080px;margin:0 auto;padding:clamp(32px,5vw,56px) clamp(16px,4vw,40px);display:grid;gap:24px')}>
        <div style={css('background:#fff;border-radius:22px;padding:clamp(26px,4vw,40px);border:1px solid rgba(225,18,18,.08);box-shadow:0 8px 26px rgba(225,18,18,.06)')}>
          <span style={css('display:inline-block;color:#e11212;font-weight:800;font-size:13px;letter-spacing:1px;margin-bottom:12px')}>{t.storyKicker}</span>
          <h2 style={css('font-weight:800;font-size:clamp(22px,3.4vw,32px);margin-bottom:16px;letter-spacing:-.5px')}>{t.storyTitle}</h2>
          <div style={css('display:grid;gap:12px')}>
            {t.story.map((para, i) => (
              <p key={i} style={css('color:#574b4b;font-size:16px;line-height:1.8')}>{para}</p>
            ))}
          </div>
        </div>

        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px')}>
          <div style={css('background:linear-gradient(160deg,#e11212,#b00814);border-radius:22px;padding:clamp(24px,3.5vw,34px);color:#fff;box-shadow:0 16px 40px rgba(225,18,18,.28)')}>
            <span style={css('display:grid;place-items:center;width:52px;height:52px;border-radius:15px;background:rgba(255,255,255,.2);margin-bottom:16px')}><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 5.9 6.3.5-4.8 4.1 1.5 6.2L12 15.6 6.6 18.7l1.5-6.2L3.3 8.4l6.3-.5L12 2z" /></svg></span>
            <h3 style={css('font-weight:800;font-size:21px;margin-bottom:10px')}>{t.missionTitle}</h3>
            <p style={css('font-size:15.5px;line-height:1.75;opacity:.95')}>{t.missionText}</p>
          </div>
          <div style={css('background:linear-gradient(160deg,#8b0000,#ff5a47);border-radius:22px;padding:clamp(24px,3.5vw,34px);color:#fff;box-shadow:0 16px 40px rgba(139,0,0,.28)')}>
            <span style={css('display:grid;place-items:center;width:52px;height:52px;border-radius:15px;background:rgba(255,255,255,.2);margin-bottom:16px')}><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg></span>
            <h3 style={css('font-weight:800;font-size:21px;margin-bottom:10px')}>{t.visionTitle}</h3>
            <p style={css('font-size:15.5px;line-height:1.75;opacity:.95')}>{t.visionText}</p>
          </div>
        </div>

        <div>
          <h2 style={css('font-weight:800;font-size:clamp(22px,3.4vw,30px);margin-bottom:18px;text-align:center;letter-spacing:-.5px')}>{t.valuesTitle}</h2>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px')}>
            {t.values.map((v, i) => (
              <div key={i} style={css('background:#fff;border-radius:20px;padding:26px;border:1px solid rgba(225,18,18,.08);box-shadow:0 6px 20px rgba(225,18,18,.05)')}>
                <span style={css(`display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:${valueIcons[i].bg};color:${valueIcons[i].color};margin-bottom:14px`)}>{valueIcons[i].icon}</span>
                <h3 style={css('font-weight:800;font-size:17px;margin-bottom:6px')}>{v.t}</h3>
                <p style={css('color:#6e6363;font-size:14.5px;line-height:1.6')}>{v.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={css('position:relative;overflow:hidden;background:linear-gradient(125deg,#b00814 0%,#e11212 50%,#8b0000 100%);border-radius:24px;padding:clamp(32px,4.5vw,48px);text-align:center;color:#fff;box-shadow:0 20px 50px rgba(225,18,18,.3)')}>
          <h2 style={css('font-weight:800;font-size:clamp(22px,3.6vw,34px);margin-bottom:10px;letter-spacing:-.5px')}>{t.ctaTitle}</h2>
          <p style={css('font-size:clamp(15px,2vw,18px);opacity:.92;max-width:480px;margin:0 auto 24px')}>{t.ctaSub}</p>
          <div style={css('display:flex;gap:14px;flex-wrap:wrap;justify-content:center')}>
            <a href="#" style={css('display:inline-flex;align-items:center;gap:11px;background:#120707;color:#fff;border-radius:14px;padding:12px 22px;box-shadow:0 12px 28px rgba(0,0,0,.3)')} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.4 2.5-.4 6.2 1 8.3.7 1 1.4 2.1 2.5 2.1 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.1z" /></svg><span style={css('display:flex;flex-direction:column;line-height:1.1;text-align:start')}><span style={css('font-size:11px;opacity:.85')}>Download on the</span><span style={css('font-size:17px;font-weight:700')}>App Store</span></span></a>
            <a href="#" style={css('display:inline-flex;align-items:center;gap:11px;background:#120707;color:#fff;border-radius:14px;padding:12px 22px;box-shadow:0 12px 28px rgba(0,0,0,.3)')} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}><svg width="22" height="22" viewBox="0 0 24 24"><path d="M3.6 2.3c-.3.2-.5.6-.5 1.1v17.2c0 .5.2.9.5 1.1l9.3-9.7L3.6 2.3z" fill="#ff5a47" /><path d="M16.4 8.9 12.9 12l3.5 3.1 4-2.3c.7-.4.7-1.4 0-1.8l-4-2.1z" fill="#FFCE00" /><path d="M3.6 2.3 12.9 12l3.5-3.1L5.6 2.6c-.7-.4-1.5-.5-2-.3z" fill="#00F076" /><path d="M3.6 21.7c.5.2 1.3.1 2-.3l10.8-6.3L12.9 12 3.6 21.7z" fill="#FF3A44" /></svg><span style={css('display:flex;flex-direction:column;line-height:1.1;text-align:start')}><span style={css('font-size:11px;opacity:.85')}>GET IT ON</span><span style={css('font-size:17px;font-weight:700')}>Google Play</span></span></a>
          </div>
        </div>
      </main>

      <SubFooter
        maxWidth={1080}
        centered
        footerRights={t.footerRights}
        links={[
          { to: '/', label: t.lHome },
          { to: '/privacy', label: t.lPrivacy },
          { to: '/delete-account', label: t.lDelete },
          { to: '/contact', label: t.lContact },
        ]}
      />
    </div>
  )
}
