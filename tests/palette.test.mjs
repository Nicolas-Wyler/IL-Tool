import assert from 'node:assert/strict';
import { makePalette, needsPaletteRepair, validColor } from '../dist/palette.js';

for (const count of [0, 1, 6, 12, 100, 10000]) {
  const colors = makePalette(count, .37);
  assert.equal(colors.length, count);
  assert.equal(new Set(colors).size, count);
  assert.ok(colors.every(validColor));
}
const colors = makePalette(6, .37);
assert.deepEqual(makePalette(6, .37), colors);
assert.notDeepEqual(makePalette(6, 1.37), colors);
const reserved = makePalette(6, .37, colors);
assert.ok(reserved.every(color => !colors.includes(color)));
const blue = { color: '#67c5ff' };
assert.equal(needsPaletteRepair([blue, blue]), true);
assert.equal(needsPaletteRepair([{ color:'#ABCDEF' }, { color:'#abcdef' }]), true);
assert.equal(needsPaletteRepair([{ color:'#123abc' }, { color:'#abcdef' }]), false);
assert.equal(needsPaletteRepair([blue, { ...blue, manualColor:true }]), false);
assert.equal(needsPaletteRepair([{ ...blue, manualColor:true }, { ...blue, manualColor:true }]), false);
assert.equal(needsPaletteRepair([{ color:'invalid' }]), true);
assert.equal(needsPaletteRepair([{}]), true);
console.log('Passed: distinct palettes through 10,000 rows, reserved manual colors, automatic duplicate repair, and intentional manual duplicates.');
