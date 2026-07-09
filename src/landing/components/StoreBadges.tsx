import { css } from '../css'

const AppleIcon = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.4 2.5-.4 6.2 1 8.3.7 1 1.4 2.1 2.5 2.1 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.1zM14.5 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z" /></svg>
)

const PlayIcon = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M3.6 2.3c-.3.2-.5.6-.5 1.1v17.2c0 .5.2.9.5 1.1l9.3-9.7L3.6 2.3z" fill="#ff5a47" /><path d="M16.4 8.9 12.9 12l3.5 3.1 4-2.3c.7-.4.7-1.4 0-1.8l-4-2.1z" fill="#FFCE00" /><path d="M3.6 2.3 12.9 12l3.5-3.1L5.6 2.6c-.7-.4-1.5-.5-2-.3z" fill="#00F076" /><path d="M3.6 21.7c.5.2 1.3.1 2-.3l10.8-6.3L12.9 12 3.6 21.7z" fill="#FF3A44" /></svg>
)

// padding e.g. "11px 20px"; appleSize/playSize tune the icon dimensions per section.
export default function StoreBadges({ href = '#', padding = '11px 20px', appleSize = 26, playSize = 24, shadow = '0 10px 26px rgba(18,11,34,.28)' }) {
  const linkStyle = css(`display:inline-flex;align-items:center;gap:11px;background:#120707;color:#fff;border-radius:14px;padding:${padding};box-shadow:${shadow}`)
  const labelWrap = css('display:flex;flex-direction:column;line-height:1.1;text-align:start')
  const up = (e) => { e.currentTarget.style.transform = 'translateY(-3px)' }
  const down = (e) => { e.currentTarget.style.transform = 'translateY(0)' }

  return (
    <>
      <a href={href} style={linkStyle} onMouseOver={up} onMouseOut={down}>
        <AppleIcon size={appleSize} />
        <span style={labelWrap}>
          <span style={{ fontSize: '11px', opacity: 0.85 }}>Download on the</span>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>App Store</span>
        </span>
      </a>
      <a href={href} style={linkStyle} onMouseOver={up} onMouseOut={down}>
        <PlayIcon size={playSize} />
        <span style={labelWrap}>
          <span style={{ fontSize: '11px', opacity: 0.85 }}>GET IT ON</span>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>Google Play</span>
        </span>
      </a>
    </>
  )
}
