/**
 * WebView embed — قفل ارتفاع الشاشة وتجنّب الفراغ/السكرول الزائد
 */
export function initEmbedViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isEmbed =
    document.documentElement.classList.contains('linkup-embed')
    || !!window.ReactNativeWebView
    || /(?:^|[?&])embed=1(?:&|$)/.test(window.location.search || '');

  if (!isEmbed) return;

  const apply = () => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const root = document.documentElement;
    root.style.setProperty('--lu-app-h', `${h}px`);
    root.style.setProperty('--lu-app-w', `${w}px`);
    root.style.height = `${h}px`;
    root.style.maxHeight = `${h}px`;
    document.body.style.height = `${h}px`;
    document.body.style.maxHeight = `${h}px`;
    const appRoot = document.getElementById('root');
    if (appRoot) {
      appRoot.style.height = `${h}px`;
      appRoot.style.maxHeight = `${h}px`;
      const antApp = appRoot.querySelector('.ant-app');
      if (antApp) {
        antApp.style.height = `${h}px`;
        antApp.style.maxHeight = `${h}px`;
      }
    }
    window.dispatchEvent(new Event('resize'));
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  requestAnimationFrame(apply);
  setTimeout(apply, 80);
  setTimeout(apply, 400);
  setTimeout(apply, 1200);
}
