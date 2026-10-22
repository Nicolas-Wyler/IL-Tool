import { SNAP_DURATION } from './viewport.js';

export function setupPageControls() {
  const scroll = document.querySelector('.app-scroll');
  const content = document.querySelector('.scroll-content');
  const fits = () => document.body.classList.toggle('fits-viewport', scroll.scrollHeight <= scroll.clientHeight + 1);
  const observer = new ResizeObserver(fits);
  observer.observe(scroll); observer.observe(document.querySelector('.scroll-content'));
  window.addEventListener('resize', fits);
  fits();
  let pull = 0, settleTimer = null, animation = null;
  const setPull = value => { content.style.transform = value ? `translateY(${value}px)` : ''; };
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
