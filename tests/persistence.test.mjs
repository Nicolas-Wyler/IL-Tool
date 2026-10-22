import assert from 'node:assert/strict';
import { normalizeWaveState } from '../dist/persistence.js';

const local = normalizeWaveState({
  waves: [{ wavelength: '13.5', amplitude: '', theta: '-45', phase: '450', azimuth: '-450' },
    { wavelength: '20', amplitude: '.5', theta: '30', phase: '-90', azimuth: '90' }],
  width: '200', view: 'intensity', running: true, playbackSpeed: .5, timeSeconds: 2e-17
});
assert.equal(local.wavelength, '13.5');
assert.deepEqual(local.waves, [['', '-45', '450', '-450'], ['.5', '30', '-90', '90']]);
assert.equal(local.running, true);
assert.equal(local.playbackSpeed, .5);

const legacyCloud = normalizeWaveState({ waves: [['40', '1', '20', '90', '180']] });
assert.equal(legacyCloud.wavelength, '40');
assert.deepEqual(legacyCloud.waves, [['1', '20', '90', '180']]);

const current = { schemaVersion: 2, wavelength: '31', waves: [['1', '-10', '450', '720']],
  gratings: { schemaVersion: 2, rows: [['64', '.4', '15']], fields: ['2000', '80', '100'] } };
const normalized = normalizeWaveState(current);
assert.equal(normalized.wavelength, '31');
assert.deepEqual(normalized.waves, current.waves);
assert.deepEqual(normalized.gratings, current.gratings);
assert.deepEqual(normalizeWaveState({ waves: [] }).waves, []);
assert.equal(normalizeWaveState(null), null);
assert.equal(normalizeWaveState({ waves: [null] }), null);
console.log('Passed: local object rows, cloud legacy rows, shared-wavelength migration, grating settings, and empty states.');
