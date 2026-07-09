import { useState } from 'react'
import { css } from '../css'
import { useLang } from '../LangContext'
import { STR } from '../data/contact'
import SubHeader from '../components/SubHeader'
import SubFooter from '../components/SubFooter'

const inputStyle = css('padding:13px 15px;border-radius:12px;border:1.5px solid rgba(225,18,18,.18);background:#fff;font-size:15px;color:#170b0b;transition:border-color .2s,box-shadow .2s')
const labelTxt = css('font-weight:700;font-size:14px;color:#443838')

const methods = [
  { bg: 'linear-gradient(135deg,#b00814,#e11212)', mail: 'support@linkuplivechat.com', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 4.2V18h16V8.2l-8 5-8-5z" /></svg> },
  { bg: 'linear-gradient(135deg,#E0B400,#b00814)', mail: 'safety@linkuplivechat.com', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-4 8.5-8 9.5C8 19.5 4 16 4 11V5l8-3z" /></svg> },
  { bg: 'linear-gradient(135deg,#8b0000,#ff5a47)', mail: null, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" /></svg> },
]

export default function Contact() {
  const { lang, dir } = useLang()
  const t = STR[lang === 'en' ? 'en' : 'ar']
  const [submitted, setSubmitted] = useState(false)

  const m = [
    { t: t.m1t, v: t.m1v, n: t.m1n },
    { t: t.m3t, v: t.m3v, n: t.m3n },
    { t: t.m4t, v: t.m4v, n: t.m4n },
  ]

  return (
    <div dir={dir} style={css('position:relative;overflow-x:hidden;background:#faf7f7;color:#170b0b;min-height:100vh;line-height:1.5')}>
      <SubHeader maxWidth={1080} backHome={t.backHome} arrowFlip={t.arrowFlip} />

      <section style={css('position:relative;overflow:hidden;background:linear-gradient(125deg,#8b0000 0%,#e11212 60%,#b00814 100%);color:#fff')}>
        <div style={css('position:absolute;top:-70px;inset-inline-end:8%;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.12);filter:blur(6px)')} />
        <div style={css('max-width:1080px;margin:0 auto;padding:clamp(40px,6vw,72px) clamp(16px,4vw,40px);position:relative')}>
          <span style={css('display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.18);margin-bottom:18px')}><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 4.2V18h16V8.2l-8 5-8-5zM4.5 6l7.5 4.7L19.5 6h-15z" /></svg></span>
          <h1 style={css('font-weight:800;font-size:clamp(28px,5vw,46px);letter-spacing:-.5px;margin-bottom:10px')}>{t.title}</h1>
          <p style={css('font-size:clamp(15px,2.2vw,19px);opacity:.92;max-width:560px;margin-bottom:14px')}>{t.sub}</p>
          <span style={css('display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;background:rgba(255,255,255,.16);padding:6px 14px;border-radius:999px')}><span style={css('width:8px;height:8px;border-radius:50%;background:#7CF5B0')} />{t.responseNote}</span>
        </div>
      </section>

      <main style={css('position:relative;max-width:1080px;margin:0 auto;padding:clamp(32px,5vw,56px) clamp(16px,4vw,40px)')}>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:24px;align-items:start')}>
          <div style={css('display:grid;gap:14px')}>
            {methods.map((meth, i) => (
              <div key={i} style={css('display:flex;gap:14px;align-items:flex-start;background:#fff;border-radius:18px;padding:20px;border:1px solid rgba(225,18,18,.08);box-shadow:0 6px 20px rgba(225,18,18,.05)')}>
                <span style={css(`flex:none;width:48px;height:48px;border-radius:14px;background:${meth.bg};display:grid;place-items:center;color:#fff`)}>{meth.icon}</span>
                <div>
                  <h3 style={css('font-weight:800;font-size:16.5px;margin-bottom:3px')}>{m[i].t}</h3>
                  {meth.mail
                    ? <a href={`mailto:${meth.mail}`} style={css('color:#e11212;font-weight:700;font-size:15px')}>{m[i].v}</a>
                    : <span style={css('color:#e11212;font-weight:700;font-size:15px')}>{m[i].v}</span>}
                  <p style={css('color:#7c6e6e;font-size:13.5px;margin-top:4px')}>{m[i].n}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={css('background:linear-gradient(165deg,#fff,#fcf8f8);border:1px solid rgba(225,18,18,.14);border-radius:22px;padding:clamp(24px,3.5vw,36px);box-shadow:0 14px 40px rgba(225,18,18,.12)')}>
            <h2 style={css('font-weight:800;font-size:clamp(20px,2.8vw,26px);margin-bottom:8px')}>{t.formTitle}</h2>
            <p style={css('color:#6e6363;font-size:15px;margin-bottom:24px')}>{t.formSub}</p>

            {submitted ? (
              <div style={css('display:flex;gap:14px;align-items:flex-start;padding:22px;border-radius:16px;background:rgba(34,160,107,.1);border:1px solid rgba(34,160,107,.3)')}>
                <span style={css('flex:none;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#22A06B,#15B886);display:grid;place-items:center;color:#fff')}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z" /></svg></span>
                <div><h3 style={css('font-weight:800;font-size:18px;margin-bottom:6px;color:#177A52')}>{t.successTitle}</h3><p style={css('color:#3D6B58;font-size:14.5px;line-height:1.7')}>{t.successMsg}</p></div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }} style={css('display:grid;gap:16px')}>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblName}</span><input type="text" required placeholder={t.phName} style={inputStyle} /></label>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblEmail}</span><input type="email" required placeholder={t.phEmail} style={inputStyle} /></label>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblSubject}</span><input type="text" required placeholder={t.phSubject} style={inputStyle} /></label>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblMessage}</span><textarea rows="4" required placeholder={t.phMessage} style={{ ...inputStyle, resize: 'vertical' }} /></label>
                <button type="submit" style={css('justify-self:start;display:inline-flex;align-items:center;gap:9px;padding:14px 28px;border:none;border-radius:999px;font-weight:800;font-size:16px;color:#fff;cursor:pointer;background:linear-gradient(120deg,#b00814,#e11212,#8b0000);box-shadow:0 10px 26px rgba(225,18,18,.36)')} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>{t.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <SubFooter
        maxWidth={1080}
        footerRights={t.footerRights}
        links={[
          { to: '/', label: t.lHome },
          { to: '/about', label: t.lAbout },
          { to: '/privacy', label: t.lPrivacy },
          { to: '/delete-account', label: t.lDelete },
        ]}
      />
    </div>
  )
}
