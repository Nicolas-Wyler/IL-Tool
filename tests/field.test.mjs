import assert from 'node:assert/strict';
import { LIGHT_SPEED, fieldAt, superpositionAt, fillSuperposition } from '../dist/field.js';

const wave = { wavelength: 20, amplitude: 1, theta: 30, phase: 0, azimuth: 0 };
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

// Azimuth wraps for negative angles, multiple turns, and large finite inputs.
for (const [azimuth, equivalent] of [[-450, 270], [450, 90], [-360, 0], [720.25, .25], [360e12 + 45, 45]]) {
  const actual = fieldAt(7, 13, 1e-17, { ...wave, azimuth });
  const expected = fieldAt(7, 13, 1e-17, { ...wave, azimuth: equivalent });
  near(actual.re, expected.re);
  near(actual.im, expected.im);
}
const hugeAngle = fieldAt(7, 13, 0, { ...wave, azimuth: 1e308 });
assert.ok(Number.isFinite(hugeAngle.re) && Number.isFinite(hugeAngle.im));

for (const [phase, equivalent] of [[-450, 270], [450, 90], [360e12 + 45, 45], [1e308, 1e308 % 360]]) {
  const actual = fieldAt(7, 13, 1e-17, { ...wave, phase });
  const expected = fieldAt(7, 13, 1e-17, { ...wave, phase: equivalent });
  near(actual.re, expected.re);
  near(actual.im, expected.im);
}

// Complex amplitudes add before squaring: two identical waves give fourfold intensity.
near(superpositionAt(7, 3, 0, [wave, wave]).intensity, 4);
for (const time of [0, 1e-17, 2e-17]) {
  near(superpositionAt(7, 3, time, [wave, { ...wave, phase: 180 }]).intensity, 0);
}

// Opposite in-plane directions give cos² interference fringes at fixed intensity.
const opposite = { ...wave, azimuth: 180 };
near(superpositionAt(0, 0, 0, [wave, opposite]).intensity, 4);
near(superpositionAt(10, 0, 0, [wave, opposite]).intensity, 0);
near(superpositionAt(20, 0, 0, [wave, opposite]).intensity, 4);
near(superpositionAt(0, 0, 1e-17, [wave, opposite]).intensity, 4);

// Different wavelengths retain different frequencies at a shared physical time.
const longWave = { ...wave, wavelength: 40 };
const beatHalfPeriod = 1 / (2 * LIGHT_SPEED * (1 / 20e-9 - 1 / 40e-9));
near(superpositionAt(0, 0, 0, [wave, longWave]).intensity, 4);
near(superpositionAt(0, 0, beatHalfPeriod, [wave, longWave]).intensity, 0);

// Check the exact raster calculation against independent pointwise field sums.
const waves = [wave, { ...wave, phase: 51, azimuth: 45, amplitude: .7 },
  { ...wave, wavelength: 31, theta: 73, azimuth: 90, amplitude: .4 }];
const width = 640, height = 4, side = 100, time = 1.3e-17;
const real = new Float64Array(width * height), imaginary = new Float64Array(width * height);
fillSuperposition(real, imaginary, width, height, side, time, waves);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const u = ((x + .5) / width - .5) * side;
    const v = (.5 - (y + .5) / height) * side;
    const expected = superpositionAt(u, v, time, waves);
    near(real[y * width + x], expected.re);
    near(imaginary[y * width + x], expected.im);
  }
}

const single = superpositionAt(7, 3, time, [wave]);
const original = fieldAt(7, 3, time, wave);
near(single.re, original.re);
near(single.im, original.im);
fillSuperposition(real, imaginary, width, height, side, time, []);
assert.ok(real.every(value => value === 0) && imaginary.every(value => value === 0));
console.log('Passed: coherent addition, cancellation, spatial interference, mixed-frequency beats, raster accuracy, single-wave equivalence, and empty field.');
