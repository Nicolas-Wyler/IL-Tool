import assert from 'node:assert/strict';
import { createHistory } from '../dist/history.js';
import { formatNumber, numberValue } from '../dist/numbers.js';
import { maskBounds, maskWidth, centerIfFits, interferenceWidth } from '../dist/framing.js';
import { defaultRows, linkRow, gratingAzimuth, waveFromRow } from '../dist/linked-rows.js';
import { gratingSquare } from '../dist/grating-geometry.js';

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

assert.equal(formatNumber('23.0940107676'), '23.09');
assert.equal(formatNumber('20'), '20.0');
assert.equal(formatNumber(''), '');
assert.equal(formatNumber('1.2'), '1.2');
assert.equal(formatNumber('1.23'), '1.23');
assert.equal(formatNumber('1.299'), '1.3');
assert.equal(formatNumber('.00001'), '1.0e-5');
assert.equal(numberValue({ value: '23.09', dataset: { rawValue: '23.0940107676' } }), 23.0940107676);

const rows = defaultRows().map(row => {
  const linked = linkRow(row, 20, 2000, 'wave');
  return { ...linked, gratingAzimuth: gratingAzimuth(linked) };
});
const bounds = maskBounds(rows, 20, 2000, 80), width = maskWidth(bounds);
assert.ok(centerIfFits(bounds, width));
assert.equal(centerIfFits(bounds, width / 4), null);
const center = centerIfFits(bounds, width);
for (const row of rows) {
  const square = gratingSquare({ wavelengthNm: 20, pitchNm: Number(row.pitch), workingDistanceUm: 2000, widthUm: 80, azimuthDeg: row.gratingAzimuth });
  assert.ok(square.corners.every(point => Math.abs(point.x - center.x) < width / 2 && Math.abs(point.y - center.y) < width / 2));
}
const asymmetric = maskBounds([rows[0]], 20, 2000, 80);
assert.ok(centerIfFits(asymmetric, maskWidth(asymmetric)).x < 0);
const waves = rows.map(row => waveFromRow(row, 20));
assert.ok(Math.abs(interferenceWidth(waves, 20) - 100 / Math.sqrt(3)) < 1e-6);
assert.equal(interferenceWidth([], 20), 100);
assert.equal(interferenceWidth([{ wavelength:20, theta:0, azimuth:0, amplitude:1 }], 20), 100);
console.log('Passed: undo/redo with structural edits and branch invalidation, rounded display with retained precision, automatic framing, and recenter fit limits.');
