(() => {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) return;
  let revision = null, checking = false, refreshing = false;
  const check = async () => {
    if (checking || refreshing) return;
    checking = true;
    try {
      const response = await fetch('/__dev/version', { cache: 'no-store' });
      if (!response.ok) return;
      const current = (await response.json()).revision;
      if (typeof current !== 'string') return;
      if (revision !== null && current !== revision) {
        refreshing = true;
        if (document.dispatchEvent(new Event('developmentreload', { cancelable: true }))) location.reload();
      }
      revision = current;
    } catch { /* Stay usable offline; retry after the local server returns. */ }
    finally { checking = false; }
  };
  check(); setInterval(check, 750);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
