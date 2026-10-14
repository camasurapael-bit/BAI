/* Registers the service worker and powers the "Install app" buttons. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

let deferred = null;
const buttons = () => document.querySelectorAll('[data-install]');
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

function show(v){ buttons().forEach(b => { b.hidden = !v; }); }

addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (!isStandalone()) show(true); });
addEventListener('appinstalled', () => { deferred = null; show(false); });
document.addEventListener('DOMContentLoaded', () => {
  show(false);
  if (isIOS && !isStandalone()) show(true);          // iOS has no install prompt: show instructions instead
  buttons().forEach(b => b.addEventListener('click', async ev => {
    ev.preventDefault();
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; show(false); }
    else if (isIOS) alert('To install: tap the Share button in Safari, then "Add to Home Screen".');
  }));
});
