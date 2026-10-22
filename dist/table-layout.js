export function distributeColumns(available, minimums) {
  const widths = minimums.map(() => 0), pending = new Set(minimums.map((_, i) => i));
  let remaining = Math.max(available, minimums.reduce((sum, value) => sum + value, 0));
  while (pending.size) {
    const share = remaining / pending.size;
    const fixed = [...pending].filter(i => minimums[i] > share);
    if (!fixed.length) { for (const i of pending) widths[i] = share; break; }
    for (const i of fixed) { widths[i] = minimums[i]; remaining -= widths[i]; pending.delete(i); }
  }
  return widths;
}

export function setupTableLayout(table) {
  const headers = [...table.tHead.rows[0].cells].slice(1, -1);
  const columns = [...table.querySelectorAll('col')].slice(1, -1);
  const measure = document.createElement('canvas').getContext('2d');
  const fontOf = element => {
    const style = getComputedStyle(element);
    return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  };
  let frame = null;
  function layout() {
    frame = null;
    const minimums = headers.map((header, column) => {
      const compact = header.querySelector('.header-compact');
      measure.font = fontOf(header);
      let minimum = measure.measureText(compact.textContent).width + 20;
      for (const row of table.tBodies[0].rows) {
        const input = row.cells[column + 1].querySelector('input');
        if (!input) continue;
        measure.font = fontOf(input);
        minimum = Math.max(minimum, measure.measureText(input.value || input.placeholder).width + 20);
      }
      return Math.ceil(minimum);
    });
    const widths = distributeColumns(table.parentElement.clientWidth - 80, minimums);
    table.style.width = `${80 + widths.reduce((sum, width) => sum + width, 0)}px`;
    widths.forEach((width, index) => {
      columns[index].style.width = `${width}px`;
      const header = headers[index], full = header.querySelector('.header-full'), compact = header.querySelector('.header-compact');
      measure.font = fontOf(header);
      const abbreviated = measure.measureText(full.textContent).width + 20 > width;
      full.hidden = abbreviated; compact.hidden = !abbreviated;
    });
  }
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(layout); };
  new ResizeObserver(schedule).observe(table.parentElement);
  new MutationObserver(schedule).observe(table.tBodies[0], { childList: true, subtree: true });
  for (const type of ['input', 'change', 'focusout', 'tablecommit']) document.addEventListener(type, schedule);
  schedule();
}
