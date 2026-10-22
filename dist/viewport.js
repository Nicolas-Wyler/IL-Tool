import { numberValue, formatNumber } from './numbers.js';
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 100;

export function zoomAt(view, factor, x, y, baseWidth) {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
  const shift = baseWidth / view.zoom - baseWidth / zoom;
  return { zoom, x: view.x + x * shift, y: view.y + y * shift };
}

export function scaleLength(width) {
  const target = width / 5;
  const power = 10 ** Math.floor(Math.log10(target));
  return [5, 2, 1].map(value => value * power).find(value => value <= target) ?? power / 2;
}

export function setupViewport(surface, { widthInput, getWidth, recenter, unit, render }) {
  let view = { zoom: 1, x: 0, y: 0 }, drag = null, touch = null, frame = null;
  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'viewport-home';
  home.title = 'Home';
  home.setAttribute('aria-label', 'Reset plot view');
  home.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/></svg>';
  const scale = document.createElement('div');
  scale.className = 'plot-scale';
  scale.innerHTML = '<span></span><i></i>';
  const hint = document.createElement('div');
  hint.className = 'zoom-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Use Cmd/Ctrl + mouse wheel to zoom';
  surface.append(home, scale, hint);
  let hintTimer;
  const baseWidth = () => getWidth ? getWidth() : numberValue(widthInput);
  function bounds() {
    return { width: baseWidth() / view.zoom, x: view.x, y: view.y };
  }
  function decorate() {
    const { width } = bounds();
    if (!Number.isFinite(width) || width <= 0) { scale.hidden = true; return; }
    scale.hidden = false;
    const length = scaleLength(width);
    scale.style.width = `${length / width * 100}%`;
    scale.querySelector('span').textContent = `${formatNumber(length)} ${unit}`;
    const defaultCenter = recenter?.({ width: baseWidth(), x: 0, y: 0 }) ?? { x: 0, y: 0 };
    home.disabled = view.zoom === 1 && Math.abs(view.x - defaultCenter.x) < 1e-9 && Math.abs(view.y - defaultCenter.y) < 1e-9;
  }
  function changed() {
    decorate();
    if (frame === null) frame = requestAnimationFrame(() => {
      frame = null;
      render();
      surface.dispatchEvent(new Event('viewchange', { bubbles: true }));
    });
  }
  function snap() {
    const center = recenter?.(bounds());
    if (center) { view.x = center.x; view.y = center.y; }
  }
  function reset() { view = { zoom: 1, x: 0, y: 0 }; snap(); changed(); }
  home.addEventListener('click', reset);
  widthInput?.addEventListener('input', reset);
  surface.addEventListener('wheel', event => {
    clearTimeout(hintTimer);
    if (!event.metaKey && !event.ctrlKey) {
      surface.classList.add('show-zoom-hint');
      hintTimer = setTimeout(() => surface.classList.remove('show-zoom-hint'), 650);
      return;
    }
    surface.classList.remove('show-zoom-hint');
    event.preventDefault();
    const side = baseWidth();
    if (!Number.isFinite(side) || side <= 0) return;
    const rect = surface.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    view = zoomAt(view, Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003),
      (event.clientX - rect.left) / rect.width - 0.5, 0.5 - (event.clientY - rect.top) / rect.height, side);
    snap();
    changed();
  }, { passive: false });
  surface.addEventListener('contextmenu', event => event.preventDefault());
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || ![0, 2].includes(event.button) || event.target.closest('button')) return;
    event.preventDefault();
    const rect = surface.getBoundingClientRect(), { width } = bounds();
    if (!Number.isFinite(width) || width <= 0) return;
    drag = { pointer: event.pointerId, px: event.clientX, py: event.clientY, x: view.x, y: view.y, stepX: width / rect.width, stepY: width / rect.height };
    surface.setPointerCapture(event.pointerId);
    surface.classList.add('panning');
  });
  surface.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    view.x = drag.x - (event.clientX - drag.px) * drag.stepX;
    view.y = drag.y + (event.clientY - drag.py) * drag.stepY;
    changed();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null; surface.classList.remove('panning'); snap(); changed();
  };
  surface.addEventListener('pointerup', endDrag);
  surface.addEventListener('pointercancel', endDrag);
  surface.addEventListener('lostpointercapture', endDrag);
  const touchGeometry = touches => {
    const [a, b] = touches, rect = surface.getBoundingClientRect();
    return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      x: ((a.clientX + b.clientX) / 2 - rect.left) / rect.width - .5,
      y: .5 - ((a.clientY + b.clientY) / 2 - rect.top) / rect.height };
  };
  surface.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    touch = { ...touchGeometry(event.touches), view: { ...view }, width: bounds().width };
  }, { passive: false });
  surface.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 2) return;
    event.preventDefault();
    const now = touchGeometry(event.touches);
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touch.view.zoom * now.distance / Math.max(1, touch.distance)));
    const width = baseWidth() / zoom;
    view = { zoom, x: touch.view.x + touch.x * touch.width - now.x * width,
      y: touch.view.y + touch.y * touch.width - now.y * width };
    changed();
  }, { passive: false });
  const endTouch = event => { if (touch && event.touches.length !== 2) { touch = null; snap(); changed(); } };
  surface.addEventListener('touchend', endTouch);
  surface.addEventListener('touchcancel', endTouch);
  decorate();
  return {
    bounds, refresh: () => { if (!drag && !touch) snap(); decorate(); }, capture: () => ({ ...view }),
    restore: saved => {
      if (saved && [saved.zoom, saved.x, saved.y].every(Number.isFinite) && saved.zoom > 0) {
        view = { zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, saved.zoom)), x: saved.x, y: saved.y };
      } else view = { zoom: 1, x: 0, y: 0 };
      snap(); decorate();
    }
  };
}
