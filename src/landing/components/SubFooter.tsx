import { Link } from 'react-router-dom'
import { css } from '../css'
import Social from './Social'

// Slim footer for interior pages. `centered` renders the stacked About-style layout;
// otherwise the space-between row used by Contact / Privacy / Delete.
export default function SubFooter({ maxWidth = 1080, centered = false, links = [], footerRights }) {
  const linkRow = links.map((l) => (
    <Link
      key={l.to + l.label}
      to={l.to}
      style={{ fontSize: '14px', fontWeight: 600 }}
      onMouseOver={(e) => { e.currentTarget.style.color = centered ? '#fff' : '#fff' }}
      onMouseOut={(e) => { e.currentTarget.style.color = centered ? '#c7a9a9' : '#c7a9a9' }}
    >
      {l.label}
    </Link>
  ))

  if (centered) {
    return (
      <footer style={css('background:#150808;color:#c7a9a9')}>
        <div style={css(`max-width:${maxWidth}px;margin:0 auto;padding:34px clamp(16px,4vw,40px);display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center`)}>
          <div style={css('display:flex;align-items:center;gap:10px')}>
            <img src="/linkup-id-logo.png" alt="LinkUp" style={css('width:36px;height:36px;object-fit:contain')} />
            <span style={css('font-weight:800;font-size:18px;color:#fff')}>LinkUp</span>
          </div>
          <div style={css('display:flex;gap:12px')}>
            <Social box={42} icon={20} radius={12} />
          </div>
          <div style={css('display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;font-size:14px;font-weight:600')}>
            {linkRow}
          </div>
          <span style={css('font-size:13px;color:#a88f8f')}>{footerRights}</span>
        </div>
      </footer>
    )
  }

  return (
    <footer style={css('background:#150808;color:#c7a9a9')}>
      <div style={css(`max-width:${maxWidth}px;margin:0 auto;padding:30px clamp(16px,4vw,40px);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px`)}>
        <div style={css('display:flex;align-items:center;gap:10px')}>
          <img src="/linkup-id-logo.png" alt="LinkUp" style={css('width:34px;height:34px;object-fit:contain')} />
          <span style={css('font-weight:800;font-size:17px;color:#fff')}>LinkUp</span>
        </div>
        <div style={css('display:flex;gap:9px')}>
          <Social box={36} icon={18} radius={10} />
        </div>
        <div style={css('display:flex;flex-wrap:wrap;gap:8px 20px;font-size:14px;font-weight:600')}>
          {linkRow}
        </div>
        <span style={css('font-size:13px;color:#a88f8f')}>{footerRights}</span>
      </div>
    </footer>
  )
}
