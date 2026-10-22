import assert from 'node:assert/strict';
import { fillCenterSquares } from '../dist/center-squares.js';

const size = 101;
function image(squares, bounds = { width: 100, x: 0, y: 0 }) {
  const data = new Uint8ClampedArray(size * size * 4);
  fillCenterSquares(data, size, size, bounds, squares);
  return (u, v) => {
    const x = Math.round(((u - bounds.x) / bounds.width + .5) * size - .5);
    const y = Math.round((.5 - (v - bounds.y) / bounds.width) * size - .5);
    return data[(y * size + x) * 4];
  };
}
const square = (azimuth, efficiency) => ({ width: 40, azimuth, efficiency });
const sample = image([square(0, .25), square(45, .75)]);
assert.equal(sample(0, 0), 255); // Maximum overlap.
assert.equal(sample(18, 18), 64); // Only the 0° square: .25 of total.
assert.equal(sample(25, 0), 191); // Only the 45° square: .75 of total.
assert.equal(sample(40, 0), 0);
const doubled = image([square(0, .5), square(45, 1.5 / 1)]); // Invalid efficiencies are omitted.
assert.equal(doubled(18, 18), 255);
const rescaled = image([square(0, .1), square(45, .3)]);
assert.equal(rescaled(18, 18), sample(18, 18));
assert.equal(rescaled(25, 0), sample(25, 0));
assert.equal(image([square(0, 0)])(0, 0), 0);
assert.equal(image([])(0, 0), 0);
const panned = image([square(0, 1)], { width: 50, x: 30, y: 0 });
assert.equal(panned(10, 0), 255);
assert.equal(panned(40, 0), 0);
console.log('Passed: linear efficiency, additive overlaps, white normalization, rotation, empty/zero intensity, and panned footprints.');
