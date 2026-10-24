import {test} from 'node:test'; import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
test('static assertion calibration',()=>assert.equal('owned-left','owned-right'));
test('static missing file calibration',()=>readFile(new URL('./owned-absent',import.meta.url)));
test('static timeout calibration',{timeout:25},async()=>await new Promise(resolve=>setTimeout(resolve,100)));
