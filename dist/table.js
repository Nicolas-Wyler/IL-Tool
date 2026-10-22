import { numberText, setNumber } from './numbers.js';
export function cellRange(anchor, end) {
  return { top: Math.min(anchor.row, end.row), bottom: Math.max(anchor.row, end.row),
    left: Math.min(anchor.col, end.col), right: Math.max(anchor.col, end.col) };
}

export function parseCells(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
}

export function rowPasteAssignments(targets, sourceCount) {
  return targets.map((target, index) => ({ target, source: index % sourceCount }));
}

// Selection mode acts on rows; cell selection acts on a rectangular range.
export function setupTable(table, { addRow, removeRows, duplicateRows, insertRows }) {
  const body = table.tBodies[0];
  let anchor = null, end = null, editing = null, original = '', rowInsertion = null, rowClipboard = null;
  let selecting = false, rowAnchor = null;
  const checkedRows = () => [...body.rows].filter(row => row.dataset.selected === 'true');
  const selectButton = document.querySelector('#select-rows');
  const actionButtons = Object.fromEntries(['copy', 'paste', 'duplicate', 'delete'].map(name => [name, document.querySelector(`#${name}-rows`)]));
  function controls() {
    selectButton.setAttribute('aria-pressed', String(selecting));
    document.querySelector('#add').disabled = selecting;
    document.querySelector('#add').hidden = selecting;
    table.classList.toggle('selecting-rows', selecting);
    actionButtons.copy.disabled = actionButtons.duplicate.disabled = actionButtons.delete.disabled = checkedRows().length === 0;
    actionButtons.paste.disabled = !rowClipboard?.values.length;
    for (const button of Object.values(actionButtons)) button.hidden = !selecting || button.disabled;
  }
  function paintRows() {
    for (const row of body.rows) {
      const selected = row.dataset.selected === 'true';
      row.classList.toggle('row-selected', selected); row.setAttribute('aria-selected', String(selected));
    }
    controls();
  }
  function clearRows() {
    for (const row of body.rows) row.dataset.selected = 'false';
    rowAnchor = null; paintRows();
  }
  function setSelectionMode(value, clear = true) {
    stopEditing(); selecting = Boolean(value); anchor = end = null;
    if (clear || !selecting) clearRows(); paint(); paintRows();
  }
  selectButton.addEventListener('click', () => setSelectionMode(!selecting));
  document.addEventListener('pointerdown', event => {
    if (table.contains(event.target) || event.target.closest?.('.table-actions')) return;
    if (selecting) setSelectionMode(false);
    else { stopEditing(); anchor = end = null; clearRows(); paint(); }
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
      input.readOnly = selecting || !writable(input) || input !== editing;
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
    rowInsertion = null;
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
    if (selecting) {
      const row = event.target.closest('tbody tr');
      if (!row || event.target.closest('[data-remove-row]')) return;
      event.preventDefault(); stopEditing(); anchor = end = null;
      const index = [...body.rows].indexOf(row);
      if (event.shiftKey && rowAnchor !== null) {
        const top = Math.min(rowAnchor, index), bottom = Math.max(rowAnchor, index);
        [...body.rows].forEach((item, i) => { item.dataset.selected = String(i >= top && i <= bottom); });
      } else { row.dataset.selected = String(row.dataset.selected !== 'true'); rowAnchor = index; }
      row.tabIndex = 0; row.focus(); paint(); paintRows();
      return;
    }
    const point = locate(event.target);
    if (!point || (editing === event.target && !event.shiftKey)) return;
    event.preventDefault();
    stopEditing();
    if (event.shiftKey) select(point, true);
    else edit(point);
  });
  table.addEventListener('dblclick', event => {
    if (selecting) return;
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
    if (selecting) return;
    if (event.target.matches('input[type="color"], button')) return;
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
  const rowContext = event => table.contains(event.target)
    || !event.target.closest?.('input, textarea, select, [contenteditable=true]');
  const rowValues = row => ({
    ...Object.fromEntries([...row.querySelectorAll('input[type="number"]')].map(input => [input.name, numberText(input)])),
    angleSign: Number(row.dataset.angleSign) || 1
  });
  const names = () => rows()[0]?.map(input => input.name) ?? ['theta', 'phase', 'pitch', 'efficiency', 'azimuth', 'radius'];
  function removeSelected() {
    const selected = checkedRows();
    if (!selected.length) return;
    rowInsertion = [...body.rows].indexOf(selected[0]);
    removeRows(selected); anchor = end = null; paint(); notify();
  }
  document.addEventListener('keydown', event => {
    if (!(selecting || checkedRows().length) || !rowContext(event) || event.altKey || event.isComposing) return;
    const command = event.metaKey || event.ctrlKey, key = event.key.toLowerCase();
    if (command && key === 'a') {
      event.preventDefault(); event.stopPropagation(); stopEditing();
      for (const row of body.rows) row.dataset.selected = 'true';
      paintRows();
    } else if (command && key === 'd') {
      event.preventDefault(); event.stopPropagation(); stopEditing();
      if (!event.repeat && checkedRows().length) { duplicateRows(checkedRows()); anchor = end = null; paint(); paintRows(); notify(); }
    } else if (!editing && !command && (key === 'backspace' || key === 'delete')) {
      event.preventDefault(); event.stopPropagation(); removeSelected();
    }
  }, true);
  function copyRows() {
    if (!checkedRows().length) return;
    const values = checkedRows().map(rowValues), columns = names();
    const text = values.map(row => columns.map(name => row[name]).join('\t')).join('\n');
    rowClipboard = { text, values }; rowInsertion = null; controls();
    navigator.clipboard?.writeText(text).catch(() => {});
  }
  actionButtons.copy.addEventListener('click', copyRows);
  actionButtons.paste.addEventListener('click', () => {
    if (!rowClipboard?.values.length) return;
    const values = rowClipboard.values.map(row => ({ ...row }));
    insertRows(values, body.rows.length); anchor = end = null; paint(); paintRows(); notify();
  });
  actionButtons.duplicate.addEventListener('click', () => {
    if (!checkedRows().length) return;
    duplicateRows(checkedRows()); anchor = end = null; paint(); paintRows(); notify();
  });
  actionButtons.delete.addEventListener('click', removeSelected);
  for (const type of ['copy', 'cut']) document.addEventListener(type, event => {
    if (!checkedRows().length || !rowContext(event) || !event.clipboardData) return;
    event.preventDefault(); event.stopPropagation(); stopEditing();
    const values = checkedRows().map(rowValues), columns = names();
    const text = values.map(row => columns.map(name => row[name]).join('\t')).join('\n');
    rowClipboard = { text, values }; controls();
    if (type === 'copy') rowInsertion = null;
    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('application/x-il-tool-rows', JSON.stringify(values));
    if (type === 'cut') removeSelected();
  }, true);
  document.addEventListener('paste', event => {
    if (!rowContext(event) || !event.clipboardData) return;
    const text = event.clipboardData.getData('text/plain');
    let copied = null;
    try {
      const data = JSON.parse(event.clipboardData.getData('application/x-il-tool-rows'));
      if (Array.isArray(data) && data.length && data.every(row => row && names().every(name => typeof row[name] === 'string'
          && (row[name].trim() === '' || Number.isFinite(Number(row[name])))))) copied = data;
    } catch {}
    if (!copied && rowClipboard?.text === text) copied = rowClipboard.values;
    const selected = checkedRows();
    if (!selected.length && !copied) return;
    const values = parseCells(text);
    if (values.some(row => row.some(value => value.trim() !== '' && !Number.isFinite(Number(value))))) return;
    event.preventDefault(); event.stopPropagation(); stopEditing();
    const columns = names();
    const incoming = copied ?? values.map(values => Object.fromEntries(columns.map((name, i) => [name, values[i]?.trim() ?? ''])));
    if (copied && selecting) {
      rowClipboard = { text, values: copied };
      insertRows(copied, body.rows.length); rowInsertion = null;
    } else if (!selected.length) {
      const index = rowInsertion ?? (end ? end.row + 1 : body.rows.length);
      insertRows(incoming, index); rowInsertion = null;
    } else {
      const assignments = rowPasteAssignments(selected.map(row => [...body.rows].indexOf(row)), incoming.length);
      for (const { target, source } of assignments) {
        const row = body.rows[target], data = incoming[source];
        const single = !copied && values.length === 1 && values[0].length === 1;
        for (const input of row.querySelectorAll('input[type="number"]')) {
          if (writable(input)) setNumber(input, single ? values[0][0].trim() : data[input.name] ?? '');
        }
        if (!single && data.theta !== '' && Number.isFinite(Number(data.theta))) row.dataset.angleSign = Number(data.theta) < 0 ? -1 : 1;
      }
      if (incoming.length > selected.length) {
        const index = [...body.rows].indexOf(selected.at(-1)) + 1;
        insertRows(incoming.slice(selected.length), index);
      }
    }
    anchor = end = null; paint(); paintRows(); notify();
  }, true);
  for (const type of ['copy', 'cut']) table.addEventListener(type, event => {
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
    paint(); paintRows();
  }).observe(body, { childList: true });
  paint(); paintRows();
  return { isSelecting: () => selecting, setSelectionMode, refresh: () => { stopEditing(); paint(); paintRows(); } };
}
