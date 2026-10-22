import assert from 'node:assert/strict';
import { zoomAt, scaleLength, MIN_ZOOM, MAX_ZOOM } from '../dist/viewport.js';
import { fillSuperposition, superpositionAt } from '../dist/field.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const view = { zoom: 1, x: 25, y: -10 };
for (const factor of [0.001, 0.5, 2, 1e6]) {
  const next = zoomAt(view, factor, .3, -.2, 100);
  assert.ok(next.zoom >= MIN_ZOOM && next.zoom <= MAX_ZOOM);
  near(next.x + .3 * 100 / next.zoom, view.x + .3 * 100 / view.zoom);
  near(next.y - .2 * 100 / next.zoom, view.y - .2 * 100 / view.zoom);
}
near(zoomAt(view, .001, 0, 0, 100).zoom, MIN_ZOOM);
near(zoomAt(view, 1e6, 0, 0, 100).zoom, MAX_ZOOM);
for (const width of [.001, 1, 13.5, 100, 2000, 1e7]) {
  const scale = scaleLength(width);
  assert.ok(scale > width / 20 && scale <= width / 5);
}

const waves = [{ wavelength: 13.5, amplitude: 1, theta: -30, azimuth: 120, phase: 25 }];
const real = new Float64Array(20), imaginary = new Float64Array(20);
fillSuperposition(real, imaginary, 5, 4, 80, 0, waves, 17, -23);
for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
  const expected = superpositionAt(17 + (x + .5) * 16 - 40, -23 + 40 - (y + .5) * 20, 0, waves);
  near(real[y * 5 + x], expected.re);
  near(imaginary[y * 5 + x], expected.im);
}
console.log('Passed: cursor-anchored zoom, zoom bounds, scale bars, and physically sampled panned fields.');
