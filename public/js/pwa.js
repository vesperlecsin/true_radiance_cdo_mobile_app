// Registers the service worker and shows an "Install app" prompt. Skipped inside the Capacitor app.
(function () {
  if (window.Capacitor || !/^https?:$/.test(location.protocol)) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || localStorage.getItem('tr-install-dismissed')) return;

  function bar(html, onInstall) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#9c2d4f;color:#fff;' +
      'border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:10px;font:500 14px system-ui,sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.25)';
    el.innerHTML = '<span style="flex:1">' + html + '</span>' +
      (onInstall ? '<button id="tr-i" style="background:#fff;color:#9c2d4f;border:0;border-radius:999px;padding:8px 16px;font-weight:700">Install</button>' : '') +
      '<button id="tr-x" aria-label="Close" style="background:none;border:0;color:#fff;font-size:20px;line-height:1">&times;</button>';
    document.body.appendChild(el);
    el.querySelector('#tr-x').onclick = () => { el.remove(); try { localStorage.setItem('tr-install-dismissed', '1'); } catch (e) {} };
    if (onInstall) el.querySelector('#tr-i').onclick = () => { el.remove(); onInstall(); };
  }

  // Android / Chrome: real install button
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    bar('Install the True Radiance app for faster booking.', () => e.prompt());
  });

  // iPhone Safari has no install API, so show the manual steps
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  if (isIos && isSafari) {
    window.addEventListener('load', () => setTimeout(() =>
      bar('Install this app: tap <b>Share</b> &#x2B06;&#xFE0F; then <b>Add to Home Screen</b>.', null), 2500));
  }
})();
