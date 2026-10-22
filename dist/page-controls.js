import { SNAP_DURATION } from './viewport.js';

export function setupPageControls() {
  const scroll = document.querySelector('.app-scroll');
  const content = document.querySelector('.scroll-content');
  const releaseTouchButton = () => document.querySelectorAll('.touch-pressed').forEach(button => button.classList.remove('touch-pressed'));
  document.addEventListener('pointerdown', event => {
    const touch = event.pointerType !== 'mouse';
    document.body.classList.toggle('touch-input', touch); releaseTouchButton();
    const button = event.target.closest('button');
    if (touch && button && !button.disabled) button.classList.add('touch-pressed');
  });
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && !event.sourceCapabilities?.firesTouchEvents) document.body.classList.remove('touch-input');
  });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, releaseTouchButton);
  window.addEventListener('blur', releaseTouchButton);
  const header = document.querySelector('.app-brand');
  const brandName = header.querySelector('.brand-name');
  const brandIcon = header.querySelector('.brand-icon');
  const fileControls = header.querySelector('.file-controls');
  const controls = document.querySelector('.plot-controls-bar .view-controls');
  const slot = document.createElement('div'); slot.className = 'view-controls-slot';
  controls.before(slot); slot.append(controls);
  let headerBottom = 0;
  function handoff() {
    const rect = slot.getBoundingClientRect();
    const shift = Math.max(-headerBottom, Math.min(0, rect.top - headerBottom));
    header.style.transform = shift ? `translateY(${shift}px)` : '';
    const pinned = rect.top < headerBottom;
    controls.classList.toggle('pinned', pinned);
    controls.style.left = pinned ? `${rect.left}px` : '';
    controls.style.top = pinned ? `${Math.max(0, rect.top)}px` : '';
    controls.style.width = pinned ? `${rect.width}px` : '';
  }
  function layout() {
    const gap = parseFloat(getComputedStyle(header).columnGap) || 0;
    const available = header.clientWidth - fileControls.getBoundingClientRect().width - brandIcon.getBoundingClientRect().width - 2 * gap;
    const hideBrand = available - Math.ceil(brandName.scrollWidth) - gap < 160;
    const hideProject = hideBrand && available < 160;
    const changed = header.classList.contains('hide-project-title') !== hideProject;
    header.classList.toggle('hide-brand-name', hideBrand);
    header.classList.toggle('hide-project-title', hideProject);
    if (changed) document.dispatchEvent(new Event('headervisibilitychange'));
    headerBottom = header.offsetTop + header.offsetHeight;
    const reserve = `${Math.max(0, headerBottom + 8 - scroll.offsetTop)}px`;
    if (content.style.getPropertyValue('--header-reserve') !== reserve) content.style.setProperty('--header-reserve', reserve);
    handoff(); fits();
  }
  const fits = () => document.body.classList.toggle('fits-viewport', scroll.scrollHeight <= scroll.clientHeight + 1);
  const observer = new ResizeObserver(layout);
  for (const element of [scroll, content, header, brandName, fileControls, slot, document.querySelector('.plot-controls-bar')]) observer.observe(element);
  window.addEventListener('resize', layout);
  scroll.addEventListener('scroll', handoff, { passive: true });
  layout();
  let pull = 0, settleTimer = null, animation = null;
  const setPull = value => { content.style.top = value ? `${value}px` : ''; handoff(); };
  function settlePull() {
    cancelAnimationFrame(animation);
    const start = pull, began = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - began) / SNAP_DURATION);
      pull = start * (1 - progress) ** 3; setPull(pull);
      animation = progress < 1 ? requestAnimationFrame(step) : null;
    }
    animation = requestAnimationFrame(step);
  }
  scroll.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY)
        || scroll.scrollHeight <= scroll.clientHeight + 1) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1);
    const edge = delta < 0 && scroll.scrollTop <= .5 || delta > 0 && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - .5;
    if (!edge) return;
    event.preventDefault(); clearTimeout(settleTimer); cancelAnimationFrame(animation);
    pull = Math.max(-36, Math.min(36, pull - delta * .12)); setPull(pull);
    settleTimer = setTimeout(settlePull, 70);
  }, { passive: false });
  document.addEventListener('keydown', event => {
    const command = event.metaKey || event.ctrlKey;
    const editing = event.target.closest?.('input[type=text]:not([readonly]), input[type=number]:not([readonly]), textarea, [contenteditable=true]');
    if (command && event.key.toLowerCase() === 'a' && !editing) event.preventDefault();
    if ((event.metaKey || event.ctrlKey) && ['+', '=', '-', '_', '0'].includes(event.key)) event.preventDefault();
  }, true);
  document.addEventListener('wheel', event => {
    if ((event.metaKey || event.ctrlKey) && !event.target.closest('.field-surface, .placeholder-square')) event.preventDefault();
  }, { passive: false });
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, event => event.preventDefault(), { passive: false });
  document.addEventListener('touchmove', event => {
    const plot = event.target.closest('.field-surface, .placeholder-square');
    if (event.touches.length > 1 && !plot) event.preventDefault();
    else if (document.body.classList.contains('fits-viewport') && !event.target.closest('.table-scroll') && !plot) event.preventDefault();
  }, { passive: false });
}
