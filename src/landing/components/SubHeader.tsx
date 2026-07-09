import { Link } from 'react-router-dom'
import { css } from '../css'
import { useLang, langBtn } from '../LangContext'

// Shared header for the interior pages (About / Contact / Privacy / Delete-Account).
export default function SubHeader({ maxWidth = 1080, backHome, arrowFlip }) {
  const { lang, setLang } = useLang()

  return (
    <header style={css('position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(247,243,255,.8);border-bottom:1px solid rgba(225,18,18,.12)')}>
      <div style={css(`max-width:${maxWidth}px;margin:0 auto;padding:14px clamp(16px,4vw,40px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap`)}>
        <Link to="/" style={css('display:flex;align-items:center;gap:10px')}>
          <img src="/linkup-full-black.png" alt="LinkUp" style={css('height:38px;width:auto;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(225,18,18,.28))')} />
        </Link>
        <div style={css('display:flex;align-items:center;gap:12px')}>
          <div style={css('display:flex;align-items:center;background:#fff;border:1px solid rgba(225,18,18,.2);border-radius:999px;padding:3px')}>
            <button onClick={() => setLang('ar')} style={lang === 'ar' ? langBtn.active : langBtn.inactive}>العربية</button>
            <button onClick={() => setLang('en')} style={lang === 'en' ? langBtn.active : langBtn.inactive}>EN</button>
          </div>
          <Link
            to="/"
            style={css('display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:999px;font-weight:800;font-size:14px;color:#e11212;background:rgba(225,18,18,.1)')}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(225,18,18,.18)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(225,18,18,.1)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `scaleX(${arrowFlip})` }}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            {backHome}
          </Link>
        </div>
      </div>
    </header>
  )
}
