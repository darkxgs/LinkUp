const makeSvg = (content) => `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${content}</svg>`;

window.shapesData = [
  { id: 'circle', color: '#FF3B30', svg: makeSvg('<circle cx="50" cy="50" r="35" fill="currentColor"/>') },
  { id: 'square', color: '#007AFF', svg: makeSvg('<rect x="20" y="20" width="60" height="60" rx="10" fill="currentColor"/>') },
  { id: 'triangle', color: '#34C759', svg: makeSvg('<polygon points="50,15 85,80 15,80" fill="currentColor"/>') },
  { id: 'star', color: '#FFCC00', svg: makeSvg('<polygon points="50,10 61,40 98,40 68,62 79,96 50,75 21,96 32,62 2,40 39,40" fill="currentColor"/>') },
  { id: 'heart', color: '#FF2D55', svg: makeSvg('<path d="M50,90 C50,90 10,60 10,35 C10,15 30,10 45,25 C48,28 50,33 50,33 C50,33 52,28 55,25 C70,10 90,15 90,35 C90,60 50,90 50,90 Z" fill="currentColor"/>') },
  { id: 'diamond', color: '#AF52DE', svg: makeSvg('<polygon points="50,10 85,50 50,90 15,50" fill="currentColor"/>') },
  { id: 'hexagon', color: '#FF9500', svg: makeSvg('<polygon points="28,15 72,15 94,50 72,85 28,85 6,50" fill="currentColor"/>') }
];
