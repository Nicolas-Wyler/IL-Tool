import { validResolution } from './preferences.js';
const FORMAT = 'IL Tool';
const VERSION = 1;
const views = ['complex', 'intensity', 'phase', 'realSquared'];
const numericText = value => typeof value === 'string' && (value === '' || Number.isFinite(Number(value)));
const camera = value => value && [value.zoom, value.x, value.y].every(Number.isFinite) && value.zoom >= .025 && value.zoom <= 100;
export const cleanProjectName = name => String(name ?? '').trim() || 'Untitled';
export function projectFilename(name) {
  return `${cleanProjectName(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')}.iltool`;
}
export function projectFingerprint(settings) {
  const { timeSeconds, running, projectSavedFingerprint, selectionMode, schemaVersion, presetVersion, paletteVersion, autoFramingVersion, ...values } = settings;
  return JSON.stringify({ ...values, rows: values.rows.map(({ selected, ...row }) => row) });
}
export function serializeSettings(settings) {
  const { projectSavedFingerprint, ...saved } = settings;
  const text = JSON.stringify({ format: FORMAT, version: VERSION, settings: saved }, null, 2);
  parseSettings(text);
  return text;
}
export function parseSettings(text) {
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('Invalid IL Tool file.'); }
  const s = file?.settings;
  if (file?.format !== FORMAT || file.version !== VERSION || !s || s.schemaVersion !== 3
      || !['wave', 'pitch'].includes(s.editMode) || !views.includes(s.view)
      || !['wavelength', 'workingDistance', 'gratingWidth'].every(key => numericText(s[key]))
      || !Array.isArray(s.rows) || s.rows.length > 10000
      || !s.rows.every(row => row && ['theta', 'phase', 'pitch', 'efficiency', 'azimuth', 'radius'].every(key => numericText(row[key]))
        && /^#[0-9a-f]{6}$/i.test(row.color) && typeof row.selected === 'boolean' && [-1, 1].includes(row.angleSign))
      || !camera(s.fieldViewport) || !camera(s.layoutViewport)
      || !Number.isFinite(s.timeSeconds) || !Number.isFinite(s.playbackSpeed) || s.playbackSpeed < 1 / 64 || s.playbackSpeed > 64
      || typeof s.running !== 'boolean' || s.autoFramingVersion !== 1 || s.paletteVersion !== 1 || typeof s.presetVersion !== 'string'
      || s.projectName !== undefined && typeof s.projectName !== 'string'
      || s.exportResolution !== undefined && !validResolution(s.exportResolution)
      || s.selectionMode !== undefined && typeof s.selectionMode !== 'boolean') {
    throw new Error('Invalid IL Tool file.');
  }
  return s;
}

export function setupFileControls({ capture, restore, checkpoint }) {
  const exportButton = document.querySelector('#export'), load = document.querySelector('#load'), input = document.querySelector('#load-file');
  const nameInput = document.querySelector('#project-name'), title = document.querySelector('#project-title');
  const settingsName = document.querySelector('#settings-project-name'), prompt = document.querySelector('#name-prompt');
  const promptInput = document.querySelector('#prompt-project-name');
  let resolveName = null;
  let baseline = nameInput.dataset.savedFingerprint || projectFingerprint(capture());
  let editingName = false, editStart = nameInput.value, suppressUnload = false;
  nameInput.dataset.savedFingerprint = baseline;
  const dirty = () => projectFingerprint(capture()) !== baseline;
  function refresh() {
    const changed = dirty(), name = cleanProjectName(nameInput.value);
    title.textContent = name + (changed ? '*' : '');
    title.dataset.dirty = String(changed);
    const narrow = document.querySelector('.app-brand').classList.contains('hide-project-title');
    load.textContent = `Load${changed && narrow ? '*' : ''}`;
    load.setAttribute('aria-label', changed && narrow ? 'Load, unsaved changes' : 'Load');
    title.setAttribute('aria-label', `${name}${changed ? ', unsaved changes' : ''}. Rename project`);
    if (settingsName.value !== nameInput.value) settingsName.value = nameInput.value;
  }
  function commitName(cancel = false) {
    if (!editingName) return;
    editingName = false;
    nameInput.value = cancel ? editStart : cleanProjectName(nameInput.value);
    nameInput.hidden = true; title.hidden = false;
    if (nameInput.value !== editStart) nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    refresh();
  }
  title.addEventListener('click', () => {
    editingName = true; editStart = cleanProjectName(nameInput.value); nameInput.value = editStart;
    title.hidden = true; nameInput.hidden = false; nameInput.focus(); nameInput.select();
  });
  nameInput.addEventListener('blur', () => commitName());
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault(); commitName(event.key === 'Escape'); title.focus();
    }
  });
  function markSaved(snapshot = capture()) {
    baseline = projectFingerprint(snapshot); nameInput.dataset.savedFingerprint = baseline; refresh();
    document.dispatchEvent(new Event('viewchange'));
  }
  settingsName.addEventListener('input', () => { nameInput.value = settingsName.value; refresh(); });
  settingsName.addEventListener('change', () => { nameInput.value = cleanProjectName(settingsName.value); refresh(); });
  document.addEventListener('headervisibilitychange', () => {
    if (document.querySelector('.app-brand').classList.contains('hide-project-title')) commitName();
    refresh();
  });
  document.querySelector('#close-name-prompt').addEventListener('click', () => prompt.close('cancel'));
  document.querySelector('#name-prompt-form').addEventListener('submit', event => {
    if (!promptInput.value.trim()) { event.preventDefault(); promptInput.focus(); return; }
    nameInput.value = cleanProjectName(promptInput.value);
    nameInput.dispatchEvent(new Event('change', { bubbles: true })); refresh();
  });
  prompt.addEventListener('close', () => {
    resolveName?.(prompt.returnValue === 'export'); resolveName = null;
  });
  const ensureProjectName = () => {
    commitName();
    if (cleanProjectName(nameInput.value).toLowerCase() !== 'untitled') return Promise.resolve(true);
    return new Promise(resolve => {
      resolveName = resolve; promptInput.value = ''; prompt.returnValue = 'cancel'; prompt.showModal(); promptInput.focus();
    });
  };
  document.addEventListener('projectrestore', () => {
    baseline = nameInput.dataset.savedFingerprint || projectFingerprint(capture());
    nameInput.dataset.savedFingerprint = baseline;
    editingName = false; nameInput.hidden = true; title.hidden = false; refresh();
  });
  document.addEventListener('projectreload', () => { suppressUnload = true; });
  for (const type of ['input', 'change', 'click', 'tablecommit', 'viewchange']) document.addEventListener(type, refresh);
  window.addEventListener('beforeunload', event => {
    if (!suppressUnload && dirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  exportButton.setAttribute('aria-keyshortcuts', 'Meta+S Control+S'); load.setAttribute('aria-keyshortcuts', 'Meta+O Control+O');
  exportButton.title = 'Export (Cmd/Ctrl+S)'; load.title = 'Load (Cmd/Ctrl+O)';
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.isComposing) return;
    const button = { s: exportButton, o: load }[event.key.toLowerCase()];
    if (!button) return;
    event.preventDefault(); event.stopPropagation(); if (!event.repeat) button.click();
  }, true);
  function message(text) {
    const toast = document.createElement('div'); toast.className = 'update-toast'; toast.role = 'status'; toast.textContent = text;
    document.body.append(toast); setTimeout(() => toast.remove(), 2500);
  }
  async function open(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('File is too large.');
    const saved = parseSettings(await file.text());
    checkpoint();
    restore({ ...saved, projectName: cleanProjectName(file.name.replace(/\.(iltool|json)$/i, '')), projectSavedFingerprint: null });
    markSaved(); checkpoint();
    document.dispatchEvent(new Event('viewchange', { bubbles: true })); message('Loaded');
  }
  function failed(error) { if (error.name !== 'AbortError') message(error.message || 'Could not open file.'); }
  load.addEventListener('click', async () => {
    commitName();
    if (dirty() && !window.confirm('Discard unsaved changes and load another project?')) return;
    input.click();
  });
  input.addEventListener('change', async () => {
    try { if (input.files[0]) await open(input.files[0]); } catch (error) { failed(error); } finally { input.value = ''; }
  });
  refresh();
  return { ensureProjectName, markSaved };
}
