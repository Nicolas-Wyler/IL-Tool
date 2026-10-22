import { numberValue } from './numbers.js';
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 100;
export const SNAP_DURATION = 160;
const SINGLE_FINGER_WINDOW = 2000;

export function zoomAt(view, factor, x, y, baseWidth, minimum = MIN_ZOOM) {
  const zoom = Math.max(minimum, Math.min(MAX_ZOOM, view.zoom * factor));
  const shift = baseWidth / view.zoom - baseWidth / zoom;
  return { zoom, x: view.x + x * shift, y: view.y + y * shift };
}

export function scaleLength(width) {
  const target = width / 5;
  const power = 10 ** Math.floor(Math.log10(target));
  return [5, 2, 1].map(value => value * power).find(value => value <= target) ?? power / 2;
}

export function scaleLabel(length, unit) {
  const units = ['m', 'mm', 'µm', 'nm', 'pm', 'fm', 'am', 'zm', 'ym'];
  let index = units.indexOf(unit);
  while (length < 1 - 1e-10 && index >= 0 && index < units.length - 1) { length *= 1000; unit = units[++index]; }
  return `${Math.round(length)} ${unit}`;
}

export function transitionView(from, to, progress) {
  const t = 1 - (1 - Math.max(0, Math.min(1, progress))) ** 3;
  return { zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * t),
    x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export function setupViewport(surface, { widthInput, getWidth, recenter, minZoom = .1, elasticZoom = false, unit, render }) {
  let view = { zoom: 1, x: 0, y: 0 }, drag = null, touch = null, frame = null, motion = null, wheelTimer = null;
  const gestureMinimum = elasticZoom ? minZoom / 4 : minZoom;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const home = document.createElement('button');
  home.type = 'button'; home.className = 'viewport-home'; home.title = 'Home';
  home.setAttribute('aria-label', 'Reset plot view');
  home.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/></svg>';
  const scale = document.createElement('div'); scale.className = 'plot-scale'; scale.innerHTML = '<span></span><i></i>';
  const hint = document.createElement('div'); hint.className = 'zoom-hint'; hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Use Cmd/Ctrl + mouse wheel to zoom';
  surface.append(home, scale, hint);
  let hintTimer, homeTimer;
  const hideHome = () => {
    if (drag || touch || motion !== null || wheelTimer !== null) { homeTimer = setTimeout(hideHome, 650); return; }
    surface.classList.remove('show-home');
  };
  const showHome = () => {
    clearTimeout(homeTimer); surface.classList.add('show-home');
    homeTimer = setTimeout(hideHome, 650);
  };
  surface.addEventListener('pointerenter', showHome);
  const baseWidth = () => getWidth ? getWidth() : numberValue(widthInput);
  const bounds = () => ({ width: baseWidth() / view.zoom, x: view.x, y: view.y });
  const centered = () => {
    const zoom = Math.max(minZoom, view.zoom);
    const center = recenter?.({ width: baseWidth() / zoom, x: view.x, y: view.y });
    return center || zoom !== view.zoom ? { ...view, zoom, ...center } : null;
  };
  function decorate() {
    const { width } = bounds();
    if (!Number.isFinite(width) || width <= 0) { scale.hidden = true; return; }
    scale.hidden = false;
    const length = scaleLength(width);
    scale.style.width = `${length / width * 100}%`;
    scale.querySelector('span').textContent = scaleLabel(length, unit);
    const defaultCenter = recenter?.({ width: baseWidth(), x: 0, y: 0 }) ?? { x: 0, y: 0 };
    home.disabled = view.zoom === 1 && Math.abs(view.x - defaultCenter.x) < 1e-9 && Math.abs(view.y - defaultCenter.y) < 1e-9;
  }
  function changed() {
    showHome();
    decorate();
    if (frame === null) frame = requestAnimationFrame(() => {
      frame = null; render(); surface.dispatchEvent(new Event('viewchange', { bubbles: true }));
    });
  }
  function cancelMotion() {
    cancelAnimationFrame(motion); motion = null;
    clearTimeout(wheelTimer); wheelTimer = null;
  }
  function animateTo(target) {
    cancelMotion();
    if (reducedMotion.matches) { view = target; changed(); return; }
    const from = { ...view }, started = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - started) / SNAP_DURATION);
      view = progress === 1 ? { ...target } : transitionView(from, target, progress);
      motion = progress < 1 ? requestAnimationFrame(step) : null;
      changed();
    }
    motion = requestAnimationFrame(step);
  }
  function snap() {
    const target = centered();
    if (target && (Math.abs(target.x - view.x) > 1e-9 || Math.abs(target.y - view.y) > 1e-9 || Math.abs(target.zoom - view.zoom) > 1e-9)) animateTo(target);
  }
  function coast({ vx = 0, vy = 0, vz = 0, ax = 0, ay = 0 }) {
    cancelMotion();
    if (view.zoom < minZoom) { snap(); return; }
    if (reducedMotion.matches || Math.abs(vx) + Math.abs(vy) + Math.abs(vz) < 1e-8) { snap(); return; }
    const started = performance.now(); let previous = started;
    function step(now) {
      const elapsed = now - started, dt = Math.min(32, now - previous); previous = now;
      const decay = Math.exp(-elapsed / 55);
      view = zoomAt(view, Math.exp(vz * dt * decay), ax, ay, baseWidth(), gestureMinimum);
      view.x += vx * dt * decay * .25; view.y += vy * dt * decay * .25;
      if (elapsed < 130) motion = requestAnimationFrame(step);
      else { motion = null; snap(); }
      changed();
    }
    motion = requestAnimationFrame(step);
  }
  function settle(velocity) {
    if (centered()) snap(); else coast(velocity);
  }
  home.addEventListener('click', () => {
    const center = recenter?.({ width: baseWidth(), x: 0, y: 0 }) ?? { x: 0, y: 0 };
    animateTo({ zoom: 1, ...center });
  });
  widthInput?.addEventListener('input', () => home.click());
  surface.addEventListener('wheel', event => {
    clearTimeout(hintTimer);
    if (!event.metaKey && !event.ctrlKey) {
      surface.classList.add('show-zoom-hint');
      hintTimer = setTimeout(() => surface.classList.remove('show-zoom-hint'), 650); return;
    }
    surface.classList.remove('show-zoom-hint'); event.preventDefault(); cancelMotion();
    const side = baseWidth(); if (!Number.isFinite(side) || side <= 0) return;
    const rect = surface.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    const amount = -Math.max(-200, Math.min(200, delta)) * .003;
    const ax = (event.clientX - rect.left) / rect.width - .5, ay = .5 - (event.clientY - rect.top) / rect.height;
    view = zoomAt(view, Math.exp(amount * (elasticZoom && view.zoom < minZoom ? .35 : 1)), ax, ay, side, gestureMinimum); changed();
    wheelTimer = setTimeout(() => { wheelTimer = null; coast({ vz: Math.max(-.002, Math.min(.002, amount * .15 / 16)), ax, ay }); }, 35);
  }, { passive: false });
  surface.addEventListener('contextmenu', event => event.preventDefault());
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || ![0, 2].includes(event.button) || event.target.closest('button')) return;
    event.preventDefault(); cancelMotion();
    const rect = surface.getBoundingClientRect(), { width } = bounds();
    if (!Number.isFinite(width) || width <= 0) return;
    drag = { pointer: event.pointerId, px: event.clientX, py: event.clientY, x: view.x, y: view.y,
      stepX: width / rect.width, stepY: width / rect.height, lastX: event.clientX, lastY: event.clientY, time: event.timeStamp, vx: 0, vy: 0 };
    surface.setPointerCapture(event.pointerId); surface.classList.add('panning'); showHome();
  });
  surface.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) {
      const rect = home.getBoundingClientRect();
      if (event.pointerType !== 'touch' && event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom) showHome();
      return;
    }
    const dt = Math.max(8, event.timeStamp - drag.time);
    drag.vx = -(event.clientX - drag.lastX) * drag.stepX / dt;
    drag.vy = (event.clientY - drag.lastY) * drag.stepY / dt;
    drag.lastX = event.clientX; drag.lastY = event.clientY; drag.time = event.timeStamp;
    view.x = drag.x - (event.clientX - drag.px) * drag.stepX;
    view.y = drag.y + (event.clientY - drag.py) * drag.stepY; changed();
  });
  const endDrag = event => {
    if (!drag) return;
    const velocity = event.type === 'pointerup' && event.timeStamp - drag.time < 80 ? drag : {};
    drag = null; surface.classList.remove('panning'); showHome(); settle(velocity);
  };
  surface.addEventListener('pointerup', endDrag);
  surface.addEventListener('pointercancel', endDrag);
  surface.addEventListener('lostpointercapture', endDrag);
  let oneFingerUntil = 0;
  const touchGeometry = touches => {
    const a = touches[0], b = touches[1] ?? a, rect = surface.getBoundingClientRect();
    return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      x: ((a.clientX + b.clientX) / 2 - rect.left) / rect.width - .5,
      y: .5 - ((a.clientY + b.clientY) / 2 - rect.top) / rect.height };
  };
  const beginTouch = event => {
    cancelMotion();
    touch = { ...touchGeometry(event.touches), count: event.touches.length, view: { ...view }, last: { ...view }, width: bounds().width, time: event.timeStamp };
    surface.classList.add('panning'); showHome();
  };
  surface.addEventListener('touchstart', event => {
    if (event.target.closest('button')) return;
    if (event.touches.length !== 2 && !(event.touches.length === 1 && performance.now() < oneFingerUntil)) return;
    event.preventDefault(); oneFingerUntil = Infinity; beginTouch(event);
  }, { passive: false });
  surface.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== touch.count) return;
    event.preventDefault();
    const now = touchGeometry(event.touches), dt = Math.max(8, event.timeStamp - touch.time);
    const zoom = touch.count === 1 ? touch.view.zoom
      : Math.max(gestureMinimum, Math.min(MAX_ZOOM, touch.view.zoom * now.distance / Math.max(1, touch.distance)));
    const width = baseWidth() / zoom;
    view = { zoom, x: touch.view.x + touch.x * touch.width - now.x * width,
      y: touch.view.y + touch.y * touch.width - now.y * width };
    touch.velocity = { vx: (view.x - touch.last.x) / dt, vy: (view.y - touch.last.y) / dt, vz: Math.log(view.zoom / touch.last.zoom) / dt };
    touch.last = { ...view }; touch.time = event.timeStamp; changed();
  }, { passive: false });
  const endTouch = event => {
    if (touch && event.touches.length !== touch.count) {
      if (event.type !== 'touchcancel' && event.touches.length === 1) { beginTouch(event); return; }
      const velocity = event.timeStamp - touch.time < 80 ? touch.velocity ?? {} : {};
      touch = null; oneFingerUntil = event.type === 'touchcancel' ? 0 : performance.now() + SINGLE_FINGER_WINDOW;
      surface.classList.remove('panning'); showHome(); settle(velocity);
    }
  };
  surface.addEventListener('touchend', endTouch); surface.addEventListener('touchcancel', endTouch);
  decorate();
  return {
    bounds, refresh: () => { if (!drag && !touch && motion === null && wheelTimer === null) snap(); decorate(); },
    capture: () => ({ ...view }),
    restore: saved => {
      cancelMotion();
      if (saved && [saved.zoom, saved.x, saved.y].every(Number.isFinite) && saved.zoom > 0) {
        view = { zoom: Math.max(minZoom, Math.min(MAX_ZOOM, saved.zoom)), x: saved.x, y: saved.y };
      } else view = { zoom: 1, x: 0, y: 0 };
      view = centered() ?? view; decorate();
    }
  };
}
