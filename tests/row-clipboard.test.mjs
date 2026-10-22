import assert from 'node:assert/strict';
import { rowPasteAssignments, parseCells } from '../dist/table.js';
assert.deepEqual(rowPasteAssignments([1, 3, 5], 1), [{ target:1, source:0 }, { target:3, source:0 }, { target:5, source:0 }]);
assert.deepEqual(rowPasteAssignments([0, 2, 4, 6], 2), [{ target:0, source:0 }, { target:2, source:1 }, { target:4, source:0 }, { target:6, source:1 }]);
assert.deepEqual(parseCells('1\t2\r\n3\t4\r\n'), [['1','2'],['3','4']]);
console.log('Passed: row paste broadcasts and repeats across every selected row, including nonadjacent selections.');
