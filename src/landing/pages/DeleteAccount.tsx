import { useState } from 'react'
import { css } from '../css'
import { useLang } from '../LangContext'
import { STR } from '../data/deleteAccount'
import SubHeader from '../components/SubHeader'
import SubFooter from '../components/SubFooter'

const inputStyle = css('padding:13px 15px;border-radius:12px;border:1.5px solid rgba(225,18,18,.18);background:#fff;font-size:15px;color:#170b0b;transition:border-color .2s,box-shadow .2s')
const labelTxt = css('font-weight:700;font-size:14px;color:#443838')
const stepGrads = ['linear-gradient(135deg,#b00814,#e11212)', 'linear-gradient(135deg,#f2454e,#e11212)', 'linear-gradient(135deg,#e11212,#8b0000)', 'linear-gradient(135deg,#8b0000,#ff5a47)']

export default function DeleteAccount() {
  const { lang, dir } = useLang()
  const t = STR[lang === 'en' ? 'en' : 'ar']
  const [submitted, setSubmitted] = useState(false)

  return (
    <div dir={dir} style={css('position:relative;overflow-x:hidden;background:#faf7f7;color:#170b0b;min-height:100vh;line-height:1.5')}>
      <SubHeader maxWidth={1000} backHome={t.backHome} arrowFlip={t.arrowFlip} />

      <section style={css('position:relative;overflow:hidden;background:linear-gradient(125deg,#e11212 0%,#b00814 100%);color:#fff')}>
        <div style={css('position:absolute;top:-70px;inset-inline-end:8%;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.12);filter:blur(6px)')} />
        <div style={css('max-width:1000px;margin:0 auto;padding:clamp(40px,6vw,72px) clamp(16px,4vw,40px);position:relative')}>
          <span style={css('display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.18);margin-bottom:18px')}><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7zm3-3h6l1 2H8l1-2zM4 5h16v2H4z" /></svg></span>
          <h1 style={css('font-weight:800;font-size:clamp(28px,5vw,46px);letter-spacing:-.5px;margin-bottom:10px')}>{t.title}</h1>
          <p style={css('font-size:clamp(15px,2.2vw,19px);opacity:.92;max-width:560px;margin-bottom:14px')}>{t.sub}</p>
          <span style={css('display:inline-block;font-size:13.5px;font-weight:600;background:rgba(255,255,255,.16);padding:6px 14px;border-radius:999px')}>{t.updated}</span>
        </div>
      </section>

      <main style={css('position:relative;max-width:1000px;margin:0 auto;padding:clamp(32px,5vw,56px) clamp(16px,4vw,40px);display:grid;gap:18px')}>
        <div style={css('background:#fff;border-radius:20px;padding:clamp(22px,3vw,32px);border:1px solid rgba(225,18,18,.08);box-shadow:0 6px 20px rgba(225,18,18,.05)')}>
          <h2 style={css('font-weight:800;font-size:clamp(18px,2.6vw,23px);margin-bottom:20px;display:flex;align-items:center;gap:10px')}><span style={css('width:8px;height:8px;border-radius:3px;background:linear-gradient(135deg,#b00814,#e11212);flex:none')} />{t.stepsTitle}</h2>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:14px')}>
            {t.steps.map((s, i) => (
              <div key={i} style={css('padding:18px;border-radius:16px;background:linear-gradient(165deg,#faf7f7,#fcf8f8);border:1px solid rgba(225,18,18,.1)')}>
                <div style={css(`width:40px;height:40px;border-radius:50%;background:${stepGrads[i]};color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px;margin-bottom:12px`)}>{s.n}</div>
                <h3 style={css('font-weight:800;font-size:15.5px;margin-bottom:4px')}>{s.t}</h3>
                <p style={css('color:#6e6363;font-size:13.5px;line-height:1.6')}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        {t.sections.map((sec, i) => (
          <div key={i} style={css('background:#fff;border-radius:20px;padding:clamp(22px,3vw,32px);border:1px solid rgba(225,18,18,.08);box-shadow:0 6px 20px rgba(225,18,18,.05)')}>
            <h2 style={css('font-weight:800;font-size:clamp(18px,2.6vw,23px);margin-bottom:14px;display:flex;align-items:center;gap:10px')}><span style={css('width:8px;height:8px;border-radius:3px;background:linear-gradient(135deg,#b00814,#e11212);flex:none')} />{sec.h}</h2>
            <div style={css('display:grid;gap:10px')}>
              {sec.p.map((para, j) => (
                <p key={j} style={css('color:#574b4b;font-size:15.5px;line-height:1.75')}>{para}</p>
              ))}
            </div>
          </div>
        ))}

        <div style={css('background:linear-gradient(165deg,#fff,#fcf8f8);border:1px solid rgba(225,18,18,.14);border-radius:22px;padding:clamp(24px,3.5vw,38px);box-shadow:0 14px 40px rgba(225,18,18,.12)')}>
          <h2 style={css('font-weight:800;font-size:clamp(20px,2.8vw,26px);margin-bottom:8px')}>{t.formTitle}</h2>
          <p style={css('color:#6e6363;font-size:15px;margin-bottom:24px')}>{t.formSub}</p>

          {submitted ? (
            <div style={css('display:flex;gap:14px;align-items:flex-start;padding:22px;border-radius:16px;background:rgba(34,160,107,.1);border:1px solid rgba(34,160,107,.3)')}>
              <span style={css('flex:none;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#22A06B,#15B886);display:grid;place-items:center;color:#fff')}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z" /></svg></span>
              <div><h3 style={css('font-weight:800;font-size:18px;margin-bottom:6px;color:#177A52')}>{t.successTitle}</h3><p style={css('color:#3D6B58;font-size:14.5px;line-height:1.7')}>{t.successMsg}</p></div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }} style={css('display:grid;gap:16px')}>
              <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px')}>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblName}</span><input type="text" required placeholder={t.phName} style={inputStyle} /></label>
                <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblContact}</span><input type="text" required placeholder={t.phContact} style={inputStyle} /></label>
              </div>
              <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblUser}</span><input type="text" required placeholder={t.phUser} style={inputStyle} /></label>
              <label style={css('display:grid;gap:7px')}><span style={labelTxt}>{t.lblReason}</span><textarea rows="3" placeholder={t.phReason} style={{ ...inputStyle, resize: 'vertical' }} /></label>
              <label style={css('display:flex;align-items:flex-start;gap:10px;cursor:pointer')}><input type="checkbox" required style={css('width:20px;height:20px;margin-top:2px;accent-color:#e11212;flex:none')} /><span style={css('font-size:14px;color:#574b4b;line-height:1.6')}>{t.confirm}</span></label>
              <button type="submit" style={css('justify-self:start;display:inline-flex;align-items:center;gap:9px;padding:14px 28px;border:none;border-radius:999px;font-weight:800;font-size:16px;color:#fff;cursor:pointer;background:linear-gradient(120deg,#b00814,#e11212,#8b0000);box-shadow:0 10px 26px rgba(225,18,18,.36)')} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>{t.submit}
              </button>
            </form>
          )}
        </div>
      </main>

      <SubFooter
        maxWidth={1000}
        footerRights={t.footerRights}
        links={[
          { to: '/', label: t.lHome },
          { to: '/privacy', label: t.lPrivacy },
          { to: '/about', label: t.lAbout },
          { to: '/contact', label: t.lContact },
        ]}
      />
    </div>
  )
}
