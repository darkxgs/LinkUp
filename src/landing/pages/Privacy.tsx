import { css } from '../css'
import { useLang } from '../LangContext'
import { STR } from '../data/privacy'
import SubHeader from '../components/SubHeader'
import SubFooter from '../components/SubFooter'

export default function Privacy() {
  const { lang, dir } = useLang()
  const t = STR[lang === 'en' ? 'en' : 'ar']

  return (
    <div dir={dir} style={css('position:relative;overflow-x:hidden;background:#faf7f7;color:#170b0b;min-height:100vh;line-height:1.5')}>
      <SubHeader maxWidth={1000} backHome={t.backHome} arrowFlip={t.arrowFlip} />

      <section style={css('position:relative;overflow:hidden;background:linear-gradient(125deg,#b00814 0%,#e11212 55%,#8b0000 100%);color:#fff')}>
        <div style={css('position:absolute;top:-70px;inset-inline-end:8%;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.12);filter:blur(6px)')} />
        <div style={css('max-width:1000px;margin:0 auto;padding:clamp(40px,6vw,72px) clamp(16px,4vw,40px);position:relative')}>
          <span style={css('display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.18);margin-bottom:18px')}><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l8 3v6c0 5-4 8.5-8 9.5C8 19.5 4 16 4 11V5l8-3zm-1.2 13.4l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.8 12.4l3 3z" /></svg></span>
          <h1 style={css('font-weight:800;font-size:clamp(28px,5vw,46px);letter-spacing:-.5px;margin-bottom:10px')}>{t.title}</h1>
          <p style={css('font-size:clamp(15px,2.2vw,19px);opacity:.92;max-width:560px;margin-bottom:14px')}>{t.sub}</p>
          <span style={css('display:inline-block;font-size:13.5px;font-weight:600;background:rgba(255,255,255,.16);padding:6px 14px;border-radius:999px')}>{t.updated}</span>
        </div>
      </section>

      <main style={css('position:relative;max-width:1000px;margin:0 auto;padding:clamp(32px,5vw,56px) clamp(16px,4vw,40px)')}>
        <div style={css('display:grid;gap:18px')}>
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
        </div>
      </main>

      <SubFooter
        maxWidth={1000}
        footerRights={t.footerRights}
        links={[
          { to: '/', label: t.lHome },
          { to: '/about', label: t.lAbout },
          { to: '/delete-account', label: t.lDelete },
          { to: '/contact', label: t.lContact },
        ]}
      />
    </div>
  )
}
