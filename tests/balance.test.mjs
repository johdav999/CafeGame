import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, csvReport } from '../tools/balance.mjs';
test('balance CLI rejects invalid durations, seeds and ambiguous options',()=>{
  assert.deepEqual(parseArgs([]).seeds,[1,2,3]);
  assert.deepEqual(parseArgs(['--seeds','1,4294967295','--seconds','3600']).seeds,[1,4294967295]);
  for(const args of [['--seconds','0'],['--seconds','1.5'],['--seconds','3601'],['--seeds','0'],['--seeds','4294967296'],['--seeds','1,x'],['--seconds'],['--unknown','x'],['--format','yaml'],['--seconds','1','--seconds','2']])assert.throws(()=>parseArgs(args));
});
test('balance CSV preserves quoted labels and stable columns',()=>{
  assert.equal(csvReport([{scenario:'A,"B"',served:2},{scenario:'C',served:3}]),'"scenario","served"\n"A,""B""","2"\n"C","3"\n');
});
