export function setupPageControls() {
  const main = document.querySelector('main');
  const fits = () => document.body.classList.toggle('fits-viewport', main.getBoundingClientRect().height <= window.innerHeight + 1);
  new ResizeObserver(fits).observe(main);
  window.addEventListener('resize', fits);
  fits();
  document.addEventListener('keydown', event => {
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
