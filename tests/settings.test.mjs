import assert from 'node:assert/strict';
import { serializeSettings, parseSettings } from '../dist/settings.js';
const state = {
  schemaVersion: 3, autoFramingVersion: 1, paletteVersion: 1, presetVersion: '2026-10-22-unified-screenshot',
  editMode: 'pitch', wavelength: '13.51234567890123', workingDistance: '2000', gratingWidth: '80',
  rows: [{ theta: '-31.123456789', phase: '722.123456789', pitch: '27.123456789', efficiency: '.35', azimuth: '-999.75', radius: '1207.123456789', color: '#123abc', selected: true, angleSign: -1 }],
  view: 'realSquared', fieldViewport: { zoom: 3.125, x: -12.75, y: 17.321 },
  layoutViewport: { zoom: 10, x: 500, y: -777 }, timeSeconds: 1.23456789e-16, playbackSpeed: .125, running: true
};
assert.deepEqual(parseSettings(serializeSettings(state)), state);
assert.deepEqual(parseSettings(serializeSettings({ ...state, rows: [], running: false })), { ...state, rows: [], running: false });
for (const invalid of ['{}', 'no json', JSON.stringify({ format:'Other', version:1, settings:state }),
  JSON.stringify({ format:'IL Tool', version:2, settings:state }),
  JSON.stringify({ format:'IL Tool', version:1, settings:{ ...state, fieldViewport:{ zoom:0, x:0, y:0 } } }),
  JSON.stringify({ format:'IL Tool', version:1, settings:{ ...state, rows:[{ ...state.rows[0], theta:'NaN' }] } })]) {
  assert.throws(() => parseSettings(invalid), /Invalid IL Tool/);
}
console.log('Passed: full settings round trip preserves raw precision, rows, colors, selection, mode, cameras, time, speed and playback; invalid files rejected.');
