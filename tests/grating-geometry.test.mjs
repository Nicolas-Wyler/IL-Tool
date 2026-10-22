import assert from 'node:assert/strict';
import { gratingSquare } from '../dist/grating-geometry.js';
import { normalizeGratingState } from '../dist/gratings.js';

const parameters = { wavelengthNm: 20, pitchNm: 64, workingDistanceUm: 2000, widthUm: 80, azimuthDeg: 0 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const expectedRadius = 20 * 2000 / Math.sqrt(64 ** 2 - 20 ** 2);
for (const azimuthDeg of [0, 45, 90, 180, -90, 450]) {
  const square = gratingSquare({ ...parameters, azimuthDeg });
  near(square.r, expectedRadius);
  near(Math.hypot(square.center.x, square.center.y), expectedRadius);
  near(square.center.x, expectedRadius * Math.cos(azimuthDeg * Math.PI / 180));
  near(square.center.y, expectedRadius * Math.sin(azimuthDeg * Math.PI / 180));
  const { corners } = square;
  near(corners.reduce((sum, point) => sum + point.x, 0) / 4, square.center.x);
  near(corners.reduce((sum, point) => sum + point.y, 0) / 4, square.center.y);
  for (let i = 0; i < 4; i++) {
    const next = corners[(i + 1) % 4];
    near(Math.hypot(next.x - corners[i].x, next.y - corners[i].y), 80);
  }
  near(corners[1].x - corners[0].x, 80 * Math.cos(azimuthDeg * Math.PI / 180));
  near(corners[1].y - corners[0].y, 80 * Math.sin(azimuthDeg * Math.PI / 180));
}
near(gratingSquare({ ...parameters, workingDistanceUm: 1000 }).r, expectedRadius / 2);
near(gratingSquare({ ...parameters, workingDistanceUm: 0 }).r, 0);
assert.equal(gratingSquare({ ...parameters, pitchNm: 20 }), null);
assert.equal(gratingSquare({ ...parameters, pitchNm: 19 }), null);
assert.equal(gratingSquare({ ...parameters, widthUm: 0 }), null);
assert.equal(gratingSquare({ ...parameters, azimuthDeg: NaN }), null);

const legacy = normalizeGratingState({ schemaVersion: 2, rows: [['64', '1', '45']], fields: ['2000', '80', '100'] });
assert.equal(legacy.fields[2], '2000');
const custom = normalizeGratingState({ schemaVersion: 2, rows: [], fields: ['2000', '80', '2000000'] });
assert.equal(custom.fields[2], '2000');
const current = { schemaVersion: 3, rows: [['120', '.5', '-450']], fields: ['1500', '60', '3000'] };
assert.deepEqual(normalizeGratingState(current), current);
const colored = { ...current, rows: [['120', '.5', '-450', '#23abff']], viewport: { zoom: 2, x: 100, y: -50 } };
assert.deepEqual(normalizeGratingState(colored), colored);
console.log('Passed: radial offset, nm/µm units, azimuth and rotation, side lengths, invalid diffraction orders, and view-unit migration.');
