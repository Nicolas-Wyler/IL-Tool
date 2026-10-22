// Bump this and the service-worker cache name for every published release.
const VERSION = 'plane-wave-v28-local';
const VERSION_KEY = 'plane-wave-version';
const STATE_KEY = 'plane-wave-update-state';

export function setupUpdates({ capture, restore }) {
  let refreshing = false;
  const reload = () => {
    if (refreshing) return;
    refreshing = true;
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(capture())); } catch {}
    location.reload();
  };
  let updated = false;
  try {
    const previous = localStorage.getItem(VERSION_KEY);
    updated = previous !== null && previous !== VERSION;
    localStorage.setItem(VERSION_KEY, VERSION);
    const saved = sessionStorage.getItem(STATE_KEY);
    if (saved) {
      sessionStorage.removeItem(STATE_KEY);
      restore(JSON.parse(saved));
      updated = true;
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
  if (updated) {
    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
    requestAnimationFrame(() => { toast.textContent = 'Updated'; });
    setTimeout(() => toast.remove(), 2500);
  }
  if (['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
    let revision = null;
    let checking = false;
    const check = async () => {
      if (checking || refreshing) return;
      checking = true;
      try {
        const response = await fetch('/__dev/version', { cache: 'no-store' });
        if (!response.ok) return;
        const current = (await response.json()).revision;
        if (typeof current !== 'string') return;
        if (revision !== null && current !== revision) reload();
        revision = current;
      } catch { /* Keep the offline app usable during local server restarts. */ }
      finally { checking = false; }
    };
    check();
    setInterval(check, 750);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }
  if (!('serviceWorker' in navigator)) return;
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    const check = () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    setInterval(check, 60_000);
    check();
  }).catch(error => console.error('Offline setup failed', error));
}
