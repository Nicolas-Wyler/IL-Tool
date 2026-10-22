import { numberText, setNumber, formatNumbers } from './numbers.js';
export function cellRange(anchor, end) {
  return { top: Math.min(anchor.row, end.row), bottom: Math.max(anchor.row, end.row),
    left: Math.min(anchor.col, end.col), right: Math.max(anchor.col, end.col) };
}

export function parseCells(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
}

// Checkbox selection acts on rows; cell selection acts on a rectangular range.
export function setupTable(table, { addRow, removeRows }) {
  const body = table.tBodies[0];
  let anchor = null, end = null, editing = null, original = '', rowAction = false;
  const checkedRows = () => [...body.rows].filter(row => row.querySelector('.row-select')?.checked);
  table.addEventListener('change', event => {
    if (event.target.matches('input[type=checkbox]')) { stopEditing(); rowAction = true; anchor = end = null; paint(); }
  });
  const rows = () => [...body.rows].map(row => [...row.querySelectorAll('input[type="number"]')]);
  const writable = input => input.dataset.derived !== 'true';
  const locate = target => {
    const input = target.closest('td')?.querySelector('input[type="number"]');
    if (!input) return null;
    const grid = rows();
    const row = grid.findIndex(cells => cells.includes(input));
    return row < 0 ? null : { row, col: grid[row].indexOf(input) };
  };
  function prepare() {
    for (const input of body.querySelectorAll('input[type="number"]')) {
      input.readOnly = !writable(input) || input !== editing;
      input.tabIndex = -1;
      input.closest('td').tabIndex = -1;
      input.closest('td').setAttribute('role', 'gridcell');
    }
  }
  function paint() {
    prepare();
    const range = anchor && end ? cellRange(anchor, end) : null;
    rows().forEach((cells, row) => cells.forEach((input, col) => {
      const selected = Boolean(range && row >= range.top && row <= range.bottom && col >= range.left && col <= range.right);
      const cell = input.closest('td');
      cell.classList.toggle('selected', selected);
      cell.setAttribute('aria-selected', String(selected));
      cell.tabIndex = end?.row === row && end?.col === col ? 0 : -1;
    }));
    if (!end) rows()[0]?.[0]?.closest('td').setAttribute('tabindex', '0');
  }
  function select(point, extend = false) {
    rowAction = false;
    if (!extend || !anchor) anchor = point;
    end = point;
    paint();
    rows()[point.row]?.[point.col]?.closest('td').focus();
  }
  function notify(commit = true) {
    body.dispatchEvent(new Event('input', { bubbles: true }));
    if (commit) body.dispatchEvent(new Event('tablecommit', { bubbles: true }));
  }
  function stopEditing(commit = true) {
    if (!editing) return;
    const input = editing, changed = numberText(input) !== original;
    input.readOnly = true;
    editing = null;
    setNumber(input, numberText(input));
    if (commit && changed) input.dispatchEvent(new Event('tablecommit', { bubbles: true }));
  }
  function edit(point, value) {
    select(point);
    if (!writable(rows()[point.row][point.col])) return;
    editing = rows()[point.row][point.col];
    original = numberText(editing);
    editing.readOnly = false;
    editing.focus();
    if (value === undefined) editing.select();
    else { setNumber(editing, value); notify(false); }
  }
  function move(dr, dc, extend = false) {
    const grid = rows();
    if (!grid.length) return;
    select({ row: Math.max(0, Math.min(grid.length - 1, end.row + dr)),
      col: Math.max(0, Math.min(grid[0].length - 1, end.col + dc)) }, extend);
  }
  function clear() {
    const range = cellRange(anchor, end);
    rows().forEach((cells, row) => cells.forEach((input, col) => {
      if (writable(input) && row >= range.top && row <= range.bottom && col >= range.left && col <= range.right) setNumber(input, '');
    }));
    notify();
  }
  table.addEventListener('pointerdown', event => {
    const point = locate(event.target);
    if (!point || (editing === event.target && !event.shiftKey)) return;
    event.preventDefault();
    stopEditing();
    if (event.shiftKey) select(point, true);
    else edit(point);
  });
  table.addEventListener('dblclick', event => {
    const point = locate(event.target);
    if (point && rows()[point.row][point.col] !== editing) edit(point);
  });
  table.addEventListener('focusout', event => {
    if (event.target === editing) stopEditing();
    if (!table.contains(event.relatedTarget)) {
      anchor = end = null;
      paint();
    }
  });
  table.addEventListener('keydown', event => {
    if (event.target.matches('input[type="color"], button')) return;
    if (rowAction && checkedRows().length) {
      const command = event.metaKey || event.ctrlKey, key = event.key.toLowerCase();
      if (command && key === 'a') {
        event.preventDefault();
        const all = table.querySelector('#select-all'); all.checked = true; all.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault(); removeRows(checkedRows()); notify();
      } else if (command && key === 'd') {
        event.preventDefault();
        const selected = checkedRows().map(row => [...row.querySelectorAll('input[type="number"]')]);
        selected.slice(1).forEach(cells => cells.forEach((input, col) => { if (writable(input)) setNumber(input, numberText(selected[0][col])); }));
        notify();
      }
      return;
    }
    if (event.target.matches('input[type="checkbox"]')) return;
    if (!end) {
      const point = locate(event.target);
      if (!point) return;
      anchor = end = point;
    }
    const key = event.key.toLowerCase();
    const command = event.metaKey || event.ctrlKey;
    if (editing && command && ['a', 'd'].includes(key)) { stopEditing(); select(end); }
    if (editing) {
      if (event.key === 'Escape') {
        event.preventDefault();
        const input = editing, value = original;
        setNumber(input, value);
        stopEditing(false);
        select(end);
        // Chromium finalizes a number field's native editing buffer on Escape.
        requestAnimationFrame(() => { setNumber(input, value); notify(false); });
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        stopEditing();
        move(event.key === 'Enter' ? (event.shiftKey ? -1 : 1) : 0,
          event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0);
      }
      return;
    }
    if (command && key === 'a') {
      event.preventDefault();
      const grid = rows();
      anchor = { row: 0, col: 0 };
      end = { row: grid.length - 1, col: grid[0].length - 1 };
      paint();
    } else if (command && key === 'd') {
      event.preventDefault();
      const range = cellRange(anchor, end), grid = rows();
      const source = range.top === range.bottom ? range.top - 1 : range.top;
      if (source >= 0) {
        for (let row = source + 1; row <= range.bottom; row++) {
          for (let col = range.left; col <= range.right; col++) {
            if (writable(grid[row][col])) setNumber(grid[row][col], numberText(grid[source][col]));
          }
        }
        notify();
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      clear();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      move(event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0,
        event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0, event.shiftKey);
    } else if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault();
      if (event.key === 'Enter') edit(end);
      else {
        const grid = rows(), width = grid[0].length;
        const index = end.row * width + end.col + (event.shiftKey ? -1 : 1);
        if (index >= 0 && index < grid.length * width) select({ row: Math.floor(index / width), col: index % width });
        else (event.shiftKey ? table.previousElementSibling?.querySelector('input') : table.parentElement.nextElementSibling?.querySelector('button'))?.focus();
      }
    } else if (event.key === 'F2') {
      event.preventDefault(); edit(end);
    } else if (!command && !event.altKey && event.key.length === 1 && /[0-9.+-]/.test(event.key)) {
      edit(end, '');
    }
  });
  for (const type of ['copy', 'cut']) table.addEventListener(type, event => {
    if (rowAction && checkedRows().length && event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', checkedRows().map(row => [...row.querySelectorAll('input[type="number"]')].map(numberText).join('\t')).join('\n'));
      if (type === 'cut') { removeRows(checkedRows()); notify(); }
      return;
    }
    if (editing || !anchor || !end || !event.clipboardData) return;
    event.preventDefault();
    const range = cellRange(anchor, end), grid = rows();
    const text = grid.slice(range.top, range.bottom + 1).map(cells =>
      cells.slice(range.left, range.right + 1).map(input => numberText(input)).join('\t')).join('\n');
    event.clipboardData.setData('text/plain', text);
    if (type === 'cut') clear();
  });
  table.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    if (rowAction && checkedRows().length) {
      event.preventDefault();
      const values = parseCells(event.clipboardData.getData('text/plain'));
      if (values.some(row => row.some(value => value.trim() !== '' && !Number.isFinite(Number(value))))) return;
      const targets = checkedRows().map(row => [...body.rows].indexOf(row));
      const start = targets[0];
      while (rows().length < start + values.length) addRow();
      const grid = rows();
      const single = values.length === 1 && values[0].length === 1;
      const count = single ? targets.length : values.length;
      for (let i = 0; i < count; i++) {
        const row = single ? targets[i] : targets[i] ?? start + i;
        const cells = single ? grid[row].map(() => values[0][0]) : values[i];
        cells.forEach((value, col) => { if (grid[row]?.[col] && writable(grid[row][col])) setNumber(grid[row][col], value.trim()); });
      }
      notify(); return;
    }
    if (!anchor || !end) return;
    const text = event.clipboardData.getData('text/plain');
    if (editing) {
      if (!/[\t\n\r]/.test(text)) return;
      stopEditing(); select(end);
    }
    event.preventDefault();
    const values = parseCells(text);
    if (values.some(row => row.some(value => value.trim() !== '' && !Number.isFinite(Number(value))))) return;
    const range = cellRange(anchor, end);
    let bottom = range.top + values.length - 1;
    let right = Math.min(rows()[0].length - 1, range.left + Math.max(...values.map(row => row.length)) - 1);
    const single = values.length === 1 && values[0].length === 1;
    if (single) { bottom = range.bottom; right = range.right; }
    while (rows().length <= bottom) addRow();
    const grid = rows();
    for (let row = range.top; row <= bottom; row++) {
      for (let col = range.left; col <= right; col++) {
        if (writable(grid[row][col])) setNumber(grid[row][col], (single ? values[0][0] : values[row - range.top][col - range.left] ?? '').trim());
      }
    }
    anchor = { row: range.top, col: range.left };
    end = { row: bottom, col: right };
    paint();
    grid[range.top][range.left].closest('td').focus();
    notify();
  });
  new MutationObserver(() => {
    if (end && (end.row >= rows().length)) anchor = end = null;
    paint();
  }).observe(body, { childList: true });
  paint();
  return { refresh: () => { stopEditing(); paint(); } };
}
