window.policyConfig = {
  MIN_BET: 5000,
  ALLOWED_BETS: [5000, 10000, 25000, 50000],
  REWARD_MULTIPLIER: 20,
  DAILY_LIMIT_RESET_HOUR_LOCAL: 0,
  COIN_ICON_SVG: `<svg class="coin-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1.3em; height: 1.3em; vertical-align: middle; display: inline-block; filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.6));">
    <circle cx="12" cy="12" r="10" fill="url(#coinGrad)" stroke="#F59E0B" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="7" fill="none" stroke="#F59E0B" stroke-width="1" stroke-dasharray="2 1"/>
    <text x="12" y="16.2" font-family="'Tajawal', sans-serif" font-weight="900" font-size="11.5" fill="#D97706" text-anchor="middle">$</text>
    <defs>
      <radialGradient id="coinGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 12) rotate(45) scale(10)">
        <stop stop-color="#FDE047"/>
        <stop offset="0.7" stop-color="#F59E0B"/>
        <stop offset="1" stop-color="#B45309"/>
      </radialGradient>
    </defs>
  </svg>`,
};
