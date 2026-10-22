import { setupPageControls } from './page-controls.js';
import { setupTableLayout } from './table-layout.js';
import { setupExport } from './exports.js';
import { setupPreferences, DEFAULT_RESOLUTION, validResolution } from './preferences.js';
import { setupFileControls } from './settings.js';
import { numberText, numberValue, setNumber, formatNumbers, setupNumbers } from './numbers.js';
import { createHistory } from './history.js';
import { interferenceWidth } from './framing.js';
import { setupPersistence } from './persistence.js';
import { setupViewport } from './viewport.js';
import { setupTable } from './table.js';
import { setupGratings } from './gratings.js';
import { setupUpdates } from './updates.js';
import { LIGHT_SPEED, fillSuperposition, colorField } from './field.js';

import { linkRow, waveFromRow, gratingAzimuth, defaultRows, normalizeLinkedState } from './linked-rows.js';

const DEFAULT_PRESET = '2026-10-22-contact-holes';
const form = document.querySelector('#parameters');
const waveList = document.querySelector('#waves');
const waveTemplate = waveList.firstElementChild.cloneNode(true);
const wavelengthInput = document.querySelector('#wavelength');
const workingDistance = document.querySelector('#working-distance');
const gratingWidth = document.querySelector('#grating-width');
const projectName = document.querySelector('#project-name');
const modeSwitch = document.querySelector('#edit-mode');
const view = document.querySelector('#view');
const play = document.querySelector('#play');
const slower = document.querySelector('#slower');
const faster = document.querySelector('#faster');
const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const pixels = context.createImageData(canvas.width, canvas.height);
const real = new Float64Array(canvas.width * canvas.height);
const imaginary = new Float64Array(canvas.width * canvas.height);
let fieldViewport, parameters, gratings, table, history;
setupNumbers();
let timeSeconds = 0, running = false, lastFrame = null, frameId = null, playbackSpeed = 1;
let nextWaveId = 1, editMode = 'wave';
let exportResolution = DEFAULT_RESOLUTION;
const rowNames = ['theta', 'phase', 'pitch', 'efficiency', 'azimuth', 'radius'];
const colorAt = hue => {
  hue = ((hue % 6) + 6) % 6;
  const x = 1 - Math.abs(hue % 2 - 1);
  return '#' + [[1,x,0],[x,1,0],[0,1,x],[0,x,1],[x,0,1],[1,0,x]][Math.floor(hue)]
    .map(channel => Math.round((.28 + .65 * channel) * 255).toString(16).padStart(2, '0')).join('');
};
const randomColor = () => colorAt(Math.random() * 6);
function recolorRows() {
  const inputs = [...waveList.querySelectorAll('.row-color')];
  if (!inputs.length) return;
  let offset = Math.random() * 6, colors;
  for (let attempt = 0; attempt < 12; attempt++) {
    colors = inputs.map((_, index) => colorAt(offset + 6 * index / inputs.length));
    if (colors.every((color, index) => color !== inputs[index].value)) break;
    offset += .037;
  }
  inputs.forEach((input, index) => { input.value = colors[index]; });
}
function captureRows() {
  return [...waveList.children].map(row => ({
    ...Object.fromEntries(rowNames.map(name => [name, numberText(row.querySelector(`[name="${name}"]`))])),
    color: row.querySelector('.row-color').value, selected: row.dataset.selected === 'true', angleSign: Number(row.dataset.angleSign) || 1
  }));
}
function syncRows() {
  [...waveList.children].forEach((row, index) => {
    const linked = linkRow(captureRow(row), numberValue(wavelengthInput), numberValue(workingDistance), editMode);
    row.dataset.angleSign = linked.angleSign;
    for (const name of rowNames) {
      const input = row.querySelector(`[name="${name}"]`);
      const derived = name === 'radius' || (editMode === 'pitch' ? name === 'theta' || name === 'phase' : name === 'pitch');
      input.dataset.derived = String(derived);
      if (derived) setNumber(input, linked[name]);
      input.required = !derived;
      input.readOnly = derived || document.activeElement !== input;
      input.closest('td').classList.toggle('derived', derived);
      input.setAttribute('aria-readonly', String(derived));
      input.placeholder = (name === 'pitch' && linked.theta !== '' && Number(linked.theta) === 0)
        || (name === 'radius' && Math.abs(Number(linked.theta)) === 90) ? '∞' : '';
    }
  });
  modeSwitch.setAttribute('aria-checked', String(editMode === 'pitch'));
}
function captureRow(row) {
  return { ...Object.fromEntries(rowNames.map(name => [name, numberText(row.querySelector(`[name="${name}"]`))])),
    angleSign: Number(row.dataset.angleSign) || 1 };
}
function readParameters() {
  const inputs = [...form.querySelectorAll('input[type="number"]')];
  for (const input of inputs) {
    input.setCustomValidity('');
    if (['wavelength', 'width', 'gratingWidth'].includes(input.name) && numberValue(input) <= 0) {
      input.setCustomValidity('Enter a value greater than zero.');
    }
    if (input.name === 'efficiency' && (numberValue(input) < 0 || numberValue(input) > 1)) input.setCustomValidity('Enter an efficiency between zero and one.');
    if (input.name === 'theta' && Math.abs(numberValue(input)) > 90) input.setCustomValidity('Enter an angle between −90° and 90°.');
    if (input.name === 'pitch' && editMode === 'pitch' && numberValue(input) <= numberValue(wavelengthInput)) {
      input.setCustomValidity('Pitch must exceed wavelength.');
    }
  }
  const valid = inputs.every(input => input.name === 'radius' || input.name === 'pitch' && editMode === 'wave'
    || input.validity.valid && Number.isFinite(numberValue(input)));
  play.disabled = !valid || waveList.children.length === 0;
  if (!valid) { stop(); return false; }
  const waves = captureRows().map(row => waveFromRow(row, numberValue(wavelengthInput)));
  const amplitude = waves.reduce((sum, wave) => sum + wave.amplitude, 0);
  parameters = { waves, ceiling: Math.max(1, amplitude ** 2) };
  if (waves.length === 0) stop();
  return true;
}
function render() {
  if (!parameters) return;
  const mode = view.value;
  // The constructive-interference bound gives every view the same linear scale.
  const { ceiling } = parameters;
  fieldViewport.refresh();
  const bounds = fieldViewport.bounds();
  fillSuperposition(real, imaginary, canvas.width, canvas.height, bounds.width, timeSeconds, parameters.waves, bounds.x, bounds.y);
  colorField(real, imaginary, mode, ceiling, pixels.data);
  context.putImageData(pixels, 0, 0);
  document.querySelector('#intensity-max').textContent = '1';
  canvas.parentElement.dataset.view = mode;
  document.querySelector('#intensity-label').textContent = mode === 'realSquared' ? '[Re(Ẽ)]² (a.u.)' : '|Ẽ|² (a.u.)';
  document.querySelector('#brightness-legend').hidden = mode === 'phase';
  document.querySelector('#phase-legend').hidden = mode === 'intensity' || mode === 'realSquared';
  canvas.setAttribute('aria-label', `${view.selectedOptions[0].textContent} heatmap, ${bounds.width} nm square, ${parameters.waves.length} waves`);
}

function tick(now) {
  if (!running) return;
  if (lastFrame !== null) {
    // Use one shared physical time: at base speed the first wave takes two
    // wall-clock seconds per period using the shared wavelength.
    timeSeconds += (now - lastFrame) / 1000 * (parameters.waves[0].wavelength * 1e-9 / LIGHT_SPEED) / 2 * playbackSpeed;
  }
  lastFrame = now;
  render();
  frameId = requestAnimationFrame(tick);
}

function stop() {
  running = false;
  cancelAnimationFrame(frameId);
  frameId = null;
  lastFrame = null;
  play.textContent = 'Run';
  play.setAttribute('aria-pressed', 'false');
}

play.addEventListener('click', () => {
  if (running) { stop(); return; }
  if (!readParameters() || parameters.waves.length === 0) return;
  running = true;
  lastFrame = null;
  play.textContent = 'Stop';
  play.setAttribute('aria-pressed', 'true');
  frameId = requestAnimationFrame(tick);
});

function changeSpeed(factor) {
  playbackSpeed = Math.max(1 / 64, Math.min(64, playbackSpeed * factor));
  slower.disabled = playbackSpeed === 1 / 64;
  faster.disabled = playbackSpeed === 64;
  slower.title = `Slower (${playbackSpeed / 2}×)`;
  faster.title = `Faster (${playbackSpeed * 2}×)`;
}
slower.addEventListener('click', () => changeSpeed(0.5));
faster.addEventListener('click', () => changeSpeed(2));

function update() {
  syncRows();
  if (readParameters()) render();
  gratings?.render();
}
function addWave(saved) {
  if (!saved) saved = waveList.lastElementChild ? captureRow(waveList.lastElementChild) : {};
  const row = waveTemplate.cloneNode(true), id = nextWaveId++;
  row.setAttribute('aria-label', `Row ${id}`);
  row.dataset.angleSign = saved.angleSign ?? (Number(saved.theta ?? 30) < 0 ? -1 : 1);
  for (const input of row.querySelectorAll('input[type="number"]')) {
    const label = row.querySelector(`label[for="${input.id}"]`);
    input.id = `${input.name}-${id}`;
    label.htmlFor = input.id;
    if (saved[input.name] !== undefined) setNumber(input, saved[input.name]);
  }
  row.querySelector('.row-color').value = saved.color ?? randomColor();
  row.dataset.selected = String(Boolean(saved.selected));
  row.querySelector('[data-remove-row]').setAttribute('aria-label', `Remove row ${id}`);
  waveList.append(row);
  syncRows(); formatNumbers(row); syncSelection();
  return row;
}
waveList.replaceChildren();
document.querySelector('#add').addEventListener('click', () => { addWave(); recolorRows(); update(); history?.checkpoint(); });
waveList.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove-row]');
  if (!remove) return;
  remove.closest('tr').remove();
  recolorRows();
  syncSelection(); update(); history?.checkpoint();
});
modeSwitch.addEventListener('click', () => {
  editMode = editMode === 'wave' ? 'pitch' : 'wave';
  update();
  table.refresh(); history?.checkpoint();
});
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
view.addEventListener('change', render);
document.addEventListener('visibilitychange', () => { lastFrame = null; });
function syncSelection() {
  for (const row of waveList.children) {
    const selected = row.dataset.selected === 'true';
    row.classList.toggle('row-selected', selected); row.setAttribute('aria-selected', String(selected));
  }
}
fieldViewport = setupViewport(document.querySelector('.field-surface'), {
  getWidth: () => interferenceWidth(captureRows().map(row => waveFromRow(row, numberValue(wavelengthInput))), numberValue(wavelengthInput)), elasticZoom: true, unit: 'nm', render
});
table = setupTable(document.querySelector('#wave-table'), {
  addRow: () => { addWave(); recolorRows(); },
  removeRows: rows => { rows.forEach(row => row.remove()); recolorRows(); syncSelection(); },
  duplicateRows: rows => {
    const copies = rows.map(captureRow);
    for (const row of waveList.children) row.dataset.selected = 'false';
    copies.forEach(values => addWave({ ...values, selected: true }));
    recolorRows(); syncSelection();
  },
  insertRows: (values, index) => {
    const before = waveList.children[index] ?? null;
    for (const row of waveList.children) row.dataset.selected = 'false';
    values.forEach(value => waveList.insertBefore(addWave({ ...value, selected: true }), before));
    recolorRows(); syncSelection();
  }
});
gratings = setupGratings({ getRows: () => captureRows().map(row => ({ ...row, gratingAzimuth: gratingAzimuth(row) })) });
const state = {
  capture: () => ({
    schemaVersion: 3, autoFramingVersion: 1, paletteVersion: 1, presetVersion: DEFAULT_PRESET, rows: captureRows(), editMode,
    wavelength: numberText(wavelengthInput), workingDistance: numberText(workingDistance), gratingWidth: numberText(gratingWidth),
    view: view.value, fieldViewport: fieldViewport.capture(),
    layoutViewport: gratings.capture().viewport,
    timeSeconds, playbackSpeed, running, exportResolution, projectName: projectName.value,
    projectSavedFingerprint: projectName.dataset.savedFingerprint ?? null, selectionMode: table?.isSelecting() ?? false
  }),
  restore: saved => {
    saved = normalizeLinkedState(saved);
    if (!saved) return;
    stop();
    setNumber(wavelengthInput, saved.wavelength ?? '3.1');
    setNumber(workingDistance, saved.workingDistance ?? '2000');
    setNumber(gratingWidth, saved.gratingWidth ?? '80');
    editMode = saved.editMode;
    waveList.replaceChildren(); nextWaveId = 1;
    saved.rows.forEach(addWave);
    if (saved.paletteVersion !== 1 || saved.rows.some(row => !row.color)) recolorRows();
    view.value = saved.view ?? 'complex';
    fieldViewport.restore(saved.autoFramingVersion === 1 ? saved.fieldViewport : null);
    gratings.restore({ viewport: saved.autoFramingVersion === 1 ? saved.layoutViewport : null });
    timeSeconds = saved.timeSeconds ?? 0;
    playbackSpeed = saved.playbackSpeed ?? 1;
    changeSpeed(1);
    projectName.value = saved.projectName ?? 'Untitled';
    exportResolution = validResolution(saved.exportResolution) ? saved.exportResolution : DEFAULT_RESOLUTION;
    setNumber(document.querySelector('#export-resolution'), exportResolution);
    projectName.dataset.savedFingerprint = saved.projectSavedFingerprint ?? '';
    table.setSelectionMode(saved.selectionMode ?? false, false);
    update(); table.refresh(); syncSelection(); formatNumbers();
    document.dispatchEvent(new Event('projectrestore'));
    if (saved.running && !play.disabled) play.click();
  }
};
state.restore({ schemaVersion: 3, rows: defaultRows(), wavelength: '3.1', editMode: 'pitch' });
setupPersistence(state);
setupUpdates(state);

history = createHistory({
  capture: () => {
    const { timeSeconds, running, playbackSpeed, fieldViewport, layoutViewport, projectSavedFingerprint, ...parameters } = state.capture();
    return parameters;
  },
  restore: snapshot => state.restore({ ...state.capture(), ...snapshot }),
  onChange: ({ canUndo, canRedo }) => {
    document.querySelector('#undo').disabled = !canUndo;
    document.querySelector('#redo').disabled = !canRedo;
  }
});
document.querySelector('#undo').addEventListener('click', () => history.undo());
document.querySelector('#redo').addEventListener('click', () => history.redo());
document.querySelector('#refresh').addEventListener('click', () => {
  table.refresh(); update(); formatNumbers();
  document.dispatchEvent(new Event('checkupdates'));
});
document.addEventListener('tablecommit', () => history.checkpoint());
document.addEventListener('change', () => history.checkpoint());
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
  event.preventDefault(); event.stopPropagation();
  if (event.shiftKey) history.redo(); else history.undo();
}, true);

const projectControls = setupFileControls({ capture: state.capture, restore: saved => state.restore({ ...saved, presetVersion: DEFAULT_PRESET }), checkpoint: () => history.checkpoint() });
setupExport({ capture: state.capture, fieldBounds: () => fieldViewport.bounds(), maskBounds: () => gratings.bounds(), valid: readParameters,
  prepare: projectControls.ensureProjectName, onExport: projectControls.markSaved });
setupPreferences({ getResolution: () => exportResolution, setResolution: value => { exportResolution = value; } });
setupTableLayout(document.querySelector('#wave-table'));

setupPageControls();
