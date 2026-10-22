const FORMAT = 'IL Tool';
const VERSION = 1;
const views = ['complex', 'intensity', 'phase', 'realSquared'];
const numericText = value => typeof value === 'string' && (value === '' || Number.isFinite(Number(value)));
const camera = value => value && [value.zoom, value.x, value.y].every(Number.isFinite) && value.zoom >= .05 && value.zoom <= 100;

export function serializeSettings(settings) {
  const text = JSON.stringify({ format: FORMAT, version: VERSION, settings }, null, 2);
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
      || typeof s.running !== 'boolean' || s.autoFramingVersion !== 1 || s.paletteVersion !== 1 || typeof s.presetVersion !== 'string') {
    throw new Error('Invalid IL Tool file.');
  }
  return s;
}

export function setupFileControls({ capture, restore, checkpoint }) {
  const save = document.querySelector('#save');
  const load = document.querySelector('#load');
  const input = document.querySelector('#load-file');
  const type = { description: 'IL Tool settings', accept: { 'application/json': ['.iltool', '.json'] } };
  function message(text) {
    const toast = document.createElement('div');
    toast.className = 'update-toast'; toast.role = 'status'; toast.textContent = text;
    document.body.append(toast); setTimeout(() => toast.remove(), 2500);
  }
  async function open(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('File is too large.');
    const saved = parseSettings(await file.text());
    checkpoint(); restore(saved); checkpoint();
    document.dispatchEvent(new Event('viewchange', { bubbles: true }));
    message('Loaded');
  }
  function failed(error) { if (error.name !== 'AbortError') message(error.message || 'Could not open file.'); }
  save.addEventListener('click', async () => {
    try {
      const text = serializeSettings(capture());
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({ suggestedName: 'IL Tool.iltool', types: [type] });
        const writer = await handle.createWritable();
        await writer.write(text); await writer.close(); message('Saved');
      } else {
        const file = new File([text], 'IL Tool.iltool', { type: 'application/json' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
        else {
          const url = URL.createObjectURL(file), link = document.createElement('a');
          link.href = url; link.download = file.name; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      }
    } catch (error) { failed(error); }
  });
  load.addEventListener('click', async () => {
    if (!('showOpenFilePicker' in window)) { input.click(); return; }
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false, types: [type] });
      await open(await handle.getFile());
    } catch (error) { failed(error); }
  });
  input.addEventListener('change', async () => {
    try { if (input.files[0]) await open(input.files[0]); }
    catch (error) { failed(error); }
    finally { input.value = ''; }
  });
}
