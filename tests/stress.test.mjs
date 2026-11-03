import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStressArgs, deterministicStress } from '../tools/stress.mjs';
test('stress inputs bound work and reject ambiguous options',()=>{
  assert.equal(parseStressArgs([]).seconds,3600);
  assert.deepEqual(parseStressArgs(['--seconds','86400','--seeds','1,4294967295','--scale','1024']).seeds,[1,4294967295]);
  for(const args of [['--seconds','59'],['--seconds','86401'],['--seconds','1.5'],['--scale','512'],['--seeds','0'],['--seeds','4294967296'],['--host'],['--other','x'],['--seconds','60','--seconds','61']])assert.throws(()=>parseStressArgs(args));
});
test('stress parity excludes wall timings and retains record and snapshot bounds',()=>{
  const sample={digest:'42',finalHash:'99',peakJobs:4,p50BatchUs:1,p95BatchUs:2,scale:[{records:16,snapshotBytes:800,enqueueUs:3,idle1000TicksUs:4,productionUs:5}]};
  const other={...sample,p95BatchUs:800,scale:[{...sample.scale[0],idle1000TicksUs:999}]};
  assert.deepEqual(deterministicStress(sample),deterministicStress(other));
  assert.notDeepEqual(deterministicStress(sample),deterministicStress({...other,peakJobs:5}));
});
