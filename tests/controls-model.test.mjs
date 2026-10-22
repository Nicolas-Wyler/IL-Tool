import assert from 'node:assert/strict';
import { createHistory, parameterSnapshot } from '../dist/history.js';
import { formatNumber, numberValue } from '../dist/numbers.js';
import { maskBounds, maskWidth, centerIfFits, maskViewCenter, interferenceWidth } from '../dist/framing.js';
import { defaultRows, linkRow, gratingAzimuth, waveFromRow } from '../dist/linked-rows.js';
import { gratingSquare } from '../dist/grating-geometry.js';
import { distributeColumns } from '../dist/table-layout.js';

assert.deepEqual(distributeColumns(600, [50,100,150]), [200,200,200]);
assert.deepEqual(distributeColumns(330, [50,100,150]), [80,100,150]);
assert.deepEqual(distributeColumns(250, [50,100,150]), [50,100,150]);

let state = { value: 1, rows: ['a'], colors: ['#123abc'] };
const history = createHistory({ capture: () => state, restore: saved => { state = saved; } });
state.value = 2;
history.checkpoint();
state.rows.push('b'); state.colors.push('#abcdef');
history.checkpoint();
history.undo();
assert.deepEqual(state, { value: 2, rows: ['a'], colors: ['#123abc'] });
history.undo(); assert.equal(state.value, 1);
history.redo(); assert.equal(state.value, 2);
state.value = 3;
history.checkpoint(); history.redo(); assert.equal(state.value, 3);
history.undo(); assert.equal(state.value, 2);
state.value = 4; history.redo(); assert.equal(state.value, 4); // An uncommitted edit invalidates redo.

// Clicking Undo exits row selection before its click handler runs. That UI
// change must not create a new undo step or repeatedly restore the same edit.
let project = { rows: [{ pitch: '40', color: '#123abc', selected: false }], selectionMode: false };
const rowHistory = createHistory({ capture: () => parameterSnapshot(project), restore: snapshot => { project = { ...project, ...snapshot }; } });
project.rows.push({ pitch: '40', color: '#abcdef', selected: true });
project.selectionMode = true; rowHistory.checkpoint();
project.selectionMode = false; project.rows.forEach(row => { row.selected = false; });
rowHistory.undo(); assert.equal(project.rows.length, 1);
rowHistory.redo(); assert.equal(project.rows.length, 2);
assert.equal(project.rows[1].color, '#abcdef');

assert.equal(formatNumber('23.0940107676'), '23.09');
assert.equal(formatNumber('20'), '20');
assert.equal(formatNumber(''), '');
assert.equal(formatNumber('1.2'), '1.2');
assert.equal(formatNumber('1.23'), '1.23');
assert.equal(formatNumber('1.299'), '1.3');
assert.equal(formatNumber('.00001'), '1e-5');
assert.equal(numberValue({ value: '23.09', dataset: { rawValue: '23.0940107676' } }), 23.0940107676);

const rows = defaultRows().map(row => {
  const linked = linkRow(row, 20, 2000, 'pitch');
  return { ...linked, gratingAzimuth: gratingAzimuth(linked) };
});
const bounds = maskBounds(rows, 20, 2000, 80), width = maskWidth(bounds);
assert.ok(centerIfFits(bounds, width));
assert.equal(centerIfFits(bounds, width / 4), null);
const extent = { minX: -200, maxX: 300, minY: -100, maxY: 100 };
assert.deepEqual(maskViewCenter(extent, { width: 100, x: 10000, y: -10000 }), { x: 340, y: -140 });
assert.deepEqual(maskViewCenter(extent, { width: 100, x: -10000, y: 10000 }), { x: -240, y: 140 });
assert.equal(maskViewCenter(extent, { width: 100, x: 0, y: 0 }), null);
assert.equal(maskViewCenter(extent, { width: 100, x: 340, y: 140 }), null);
assert.deepEqual(maskViewCenter(extent, { width: 600, x: 10000, y: 0 }), { x: 50, y: 0 });
assert.deepEqual(maskViewCenter({ minX: 0, maxX: 1, minY: -100, maxY: 100 }, { width: 100, x: 10000, y: 0 }), { x: 50, y: 0 });
const center = centerIfFits(bounds, width);
for (const row of rows) {
  const square = gratingSquare({ wavelengthNm: 20, pitchNm: Number(row.pitch), workingDistanceUm: 2000, widthUm: 80, azimuthDeg: row.gratingAzimuth });
  assert.ok(square.corners.every(point => Math.abs(point.x - center.x) < width / 2 && Math.abs(point.y - center.y) < width / 2));
}
const asymmetric = maskBounds([rows[0]], 20, 2000, 80);
assert.ok(centerIfFits(asymmetric, maskWidth(asymmetric)).x < 0);
const waves = rows.map(row => waveFromRow(row, 20));
assert.ok(Math.abs(interferenceWidth(waves, 20) - 200) < 1e-6);
assert.equal(interferenceWidth([], 20), 200);
assert.equal(interferenceWidth([{ wavelength:20, theta:0, azimuth:0, amplitude:1 }], 20), 200);
console.log('Passed: undo/redo with structural edits and branch invalidation, rounded display with retained precision, automatic framing, and recenter fit limits.');

assert.equal(formatNumber('1.01'), '1.01');
assert.equal(formatNumber('0'), '0');
