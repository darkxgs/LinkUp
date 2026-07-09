import { css } from '../css'

// Social row reused across all footers. Sizes are parametrised to match each page
// (landing uses 40/19/12, About 42/20/12, the slim footers 36/18/10).
export default function Social({ box = 40, icon = 19, radius = 12 }) {
  const base = `width:${box}px;height:${box}px;border-radius:${radius}px;background:rgba(255,255,255,.08);display:grid;place-items:center;color:#fff;transition:background .2s,transform .2s`

  const items = [
    {
      label: 'Facebook', color: '#1877F2',
      svg: <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6v1.9h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>,
    },
    {
      label: 'Instagram', color: '#E1306C',
      svg: <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>,
    },
    {
      label: 'TikTok', color: '#000',
      svg: <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.1 1.5 3.7 3.5 3.9v2.7c-1.3 0-2.5-.4-3.5-1.1v6.2a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.6 2.6 0 1 0 1.8 2.5V3h2.7z" /></svg>,
    },
    {
      label: 'X', color: '#000',
      svg: <svg width={Math.round(icon * 0.9)} height={Math.round(icon * 0.9)} viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.2l-7 8 8.2 10.9h-6.4l-5-6.6-5.8 6.6H1.5l7.5-8.6L1 3h6.6l4.6 6.1L17.5 3zm-1.1 16h1.8L7.6 4.8H5.7L16.4 19z" /></svg>,
    },
    {
      label: 'YouTube', color: '#FF0000',
      svg: <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.4-.4-5a2.8 2.8 0 0 0-2-2C18.8 4.5 12 4.5 12 4.5s-6.8 0-8.6.5a2.8 2.8 0 0 0-2 2C1 8.6 1 12 1 12s0 3.4.4 5a2.8 2.8 0 0 0 2 2c1.8.5 8.6.5 8.6.5s6.8 0 8.6-.5a2.8 2.8 0 0 0 2-2c.4-1.6.4-5 .4-5zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" /></svg>,
    },
  ]

  return (
    <>
      {items.map((it) => (
        <a
          key={it.label}
          href="#"
          aria-label={it.label}
          style={css(base)}
          onMouseOver={(e) => { e.currentTarget.style.background = it.color; e.currentTarget.style.transform = 'translateY(-3px)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {it.svg}
        </a>
      ))}
    </>
  )
}
