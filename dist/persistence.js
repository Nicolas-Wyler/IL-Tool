const STATE_KEY = 'plane-wave-state';
const LEGACY_LOCAL_KEY = 'plane-wave-session-v1';

export function normalizeWaveState(saved) {
  if (!saved || !Array.isArray(saved.waves)) return null;
  if (!saved.waves.every(row => row && typeof row === 'object')) return null;
  const first = saved.waves[0];
  const legacyWavelength = Array.isArray(first) ? (saved.schemaVersion !== 2 ? first[0] : undefined) : first?.wavelength;
  const names = ['amplitude', 'theta', 'phase', 'azimuth'];
  const defaults = ['1', '30', '0', '0'];
  const waves = saved.waves.map(row => names.map((name, index) => {
    const value = Array.isArray(row) ? row[index + (saved.schemaVersion === 2 ? 0 : 1)] : row[name];
    return String(value ?? defaults[index]);
  }));
  return {
    ...saved, schemaVersion: 2, wavelength: String(saved.wavelength ?? legacyWavelength ?? '13.5'), waves,
    width: String(saved.width ?? '100'),
    view: ['complex', 'intensity', 'phase', 'realSquared'].includes(saved.view) ? saved.view : 'complex',
    timeSeconds: Number.isFinite(saved.timeSeconds) && saved.timeSeconds >= 0 ? saved.timeSeconds : 0,
    playbackSpeed: Number.isFinite(saved.playbackSpeed) ? Math.max(1 / 64, Math.min(64, saved.playbackSpeed)) : 1,
    running: Boolean(saved.running)
  };
}

export function setupPersistence({ capture, restore }) {
  try {
    const saved = localStorage.getItem(STATE_KEY) ?? sessionStorage.getItem(LEGACY_LOCAL_KEY);
    if (saved) restore(JSON.parse(saved));
  } catch { /* Keep the app usable if storage is unavailable or invalid. */ }

  const save = () => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(capture())); } catch {}
  };
  save();
  // Bubble listeners run after row, input, view, and playback handlers.
  for (const event of ['input', 'change', 'click', 'viewchange']) document.addEventListener(event, save);
  document.addEventListener('visibilitychange', save);
  window.addEventListener('pagehide', save);
  // Retain animation time too, including when iOS closes a background app.
  setInterval(() => { if (document.visibilityState === 'visible') save(); }, 1000);
}
