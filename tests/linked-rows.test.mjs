import assert from 'node:assert/strict';
import { defaultRows, linkRow, pitchFromTheta, phaseFromPath, waveFromRow, gratingAzimuth, normalizeLinkedState } from '../dist/linked-rows.js';
import { inPlaneWavevector } from '../dist/field.js';
import { gratingSquare } from '../dist/grating-geometry.js';
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
near(pitchFromTheta(20, 30), 40);
near(pitchFromTheta(20, -30), 40);
assert.equal(pitchFromTheta(20, 0), Infinity);
for (const theta of [30, -30, 60, -60]) {
  const row = linkRow({ theta: String(theta), phase: '450', efficiency: '.25', azimuth: '120' }, 20, 2000, 'wave');
  near(Number(row.radius), 2000 * Math.tan(Math.abs(theta) * Math.PI / 180));
  const reverse = linkRow(row, 20, 2000, 'pitch');
  near(Number(reverse.theta), theta);
  const pathNm = 2000 * 1000 / Math.cos(theta * Math.PI / 180);
  const expectedPhase = (pathNm % 20) / 20 * 360;
  near(((Number(row.phase) - expectedPhase + 540) % 360) - 180, 0, 1e-3);
  const phaseError = ((Number(reverse.phase) - expectedPhase + 540) % 360) - 180;
  near(phaseError, 0, 1e-3);
  const wave = waveFromRow(row, 20);
  near(wave.amplitude, .5);
  const square = gratingSquare({ wavelengthNm: 20, pitchNm: Number(row.pitch), workingDistanceUm: 2000, widthUm: 80, azimuthDeg: gratingAzimuth(row) });
  const k = inPlaneWavevector(wave);
  assert.ok(k.ku * square.center.x + k.kv * square.center.y < 0);
}
const normal = gratingSquare({ wavelengthNm: 20, pitchNm: Infinity, workingDistanceUm: 2000, widthUm: 80, azimuthDeg: 0 });
assert.equal(normal.r, 0);
assert.equal(linkRow({ pitch: '19', theta: '30' }, 20, 2000, 'pitch').theta, '');
assert.equal(linkRow({ pitch: '' }, 20, 2000, 'pitch').phase, '');
assert.equal(linkRow({ theta: '', phase: '' }, 20, 2000, 'wave').pitch, '');
near(phaseFromPath(20, 2000, 0), 0);
near(phaseFromPath(20, 0, 30), 0);
assert.equal(defaultRows().length, 6);
assert.deepEqual(defaultRows().map(row => row.azimuth), ['0','60','120','180','240','300']);
assert.ok(defaultRows().every(row => row.pitch === '40' && row.efficiency === '1'));
const preset = linkRow(defaultRows()[0], 3.1, 2000, 'pitch');
near(Number(preset.theta), 4.44, .005);
near(Number(preset.phase), 202.35, .005);
near(Number(preset.radius), 155.47, .005);
const legacy = normalizeLinkedState({ schemaVersion: 2, wavelength: '20', waves: [['.5','-30','450','120']],
  gratings: { schemaVersion: 3, rows: [['64','.4','30','#123abc'],['80','.2','60','#abcdef']], fields: ['1500','50','3000'] } });
assert.equal(legacy.rows.length, 2);
assert.equal(legacy.rows[0].theta, '-30');
assert.equal(legacy.rows[0].phase, '450');
assert.equal(legacy.rows[0].efficiency, '.4');
assert.equal(legacy.rows[0].color, '#123abc');
assert.ok(Number(legacy.rows[1].theta) < 0);
assert.equal(legacy.workingDistance, '1500');
assert.equal(legacy.layoutWidth, '3000');
const current = { schemaVersion: 3, editMode: 'pitch', rows: [{theta:'-30',phase:'20',pitch:'40',efficiency:'.4',azimuth:'120',color:'#123abc',angleSign:-1}] };
assert.deepEqual(normalizeLinkedState(current), current);
console.log('Passed: bidirectional pitch/angle links, optical-path phase and units, efficiency amplitude, inward propagation for both signs, defaults, and saved-state migration.');

near(Number(linkRow({ pitch: '40', theta: '-30', angleSign: 1 }, 20, 2000, 'pitch').theta), 30);
near(Number(linkRow({ pitch: '40', theta: '30', angleSign: -1 }, 20, 2000, 'pitch').theta), -30);

// Phase is always derived, including when old projects contain a free phase.
const target = { theta: '0', phase: '123', pitch: '40', angleSign: 1 };
near(Number(linkRow(target, 20, 1.005, 'wave').phase), 90);
near(Number(linkRow(target, 20, 1.01, 'wave').phase), 180);
near(Number(linkRow(target, 10, 1.005, 'wave').phase), 180);
near(Number(linkRow({ ...target, theta: '60' }, 20, 1.005, 'wave').phase), 180, 1e-6);
assert.equal(linkRow({ ...target, theta: '' }, 20, 1, 'wave').phase, '');
assert.equal(linkRow({ ...target, theta: '90' }, 20, 1, 'wave').phase, '');
assert.equal(linkRow({ ...target, pitch: '19' }, 20, 1, 'pitch').phase, '');
for (const theta of [-60, -30, 0, 30, 60]) {
  const row = linkRow({ ...target, theta: String(theta) }, 20, 1.005, 'wave');
  if (theta !== 0) near(Number(linkRow(row, 20, 1.005, 'pitch').phase), Number(row.phase), 1e-6);
}
