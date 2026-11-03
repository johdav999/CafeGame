import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const execute=promisify(execFile);
export function parseStressArgs(args) {
  const out={seconds:3600,seeds:[123],scale:256};const seen=new Set();
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]?.slice(2);
    if(!args[i]?.startsWith('--') || !['host','compare','seconds','seeds','scale','output'].includes(key) || seen.has(key) || !args[i+1] || args[i+1].startsWith('--'))throw new Error(`Invalid or repeated option: ${args[i]}`);
    seen.add(key);out[key]=args[i+1];
  }
  const positive=(s,max)=>/^\d+$/.test(String(s)) && Number.isSafeInteger(Number(s)) && Number(s)>0 && Number(s)<=max;
  if(!positive(out.seconds,86400) || Number(out.seconds)<60)throw new Error('Duration must be 60..86400 whole seconds');
  out.seconds=Number(out.seconds);out.scale=Number(out.scale);
  if(![16,64,256,1024].includes(out.scale))throw new Error('Scale must be 16, 64, 256 or 1024 records');
  if(typeof out.seeds==='string') {
    const seeds=out.seeds.split(',');if(seeds.length>8 || !seeds.every(s=>positive(s,4294967295)))throw new Error('Use 1..8 nonzero uint32 seeds');out.seeds=seeds.map(Number);
  }
  return out;
}
// Timing measurements vary with the host. Compare only canonical state/results.
export function deterministicStress(result) {
  const {p50BatchUs,p95BatchUs,scale,...stable}=result;
  return {...stable,scale:scale.map(({records,snapshotBytes})=>({records,snapshotBytes}))};
}
export async function main(args) {
  const options=parseStressArgs(args);
  const candidates=['build/cloud/simulation/cafe_stress','build/simulation/cafe_stress','build/simulation/Release/cafe_stress.exe','build/simulation/cafe_stress.exe','build/simulation-wasm/cafe_stress.cjs'];
  const host=resolve(options.host ?? candidates.find(existsSync) ?? 'build/simulation/cafe_stress');
  const run=async(file,seed)=> {
    const executable=resolve(file);if(!existsSync(executable))throw new Error(`Build the independent tests targets first: ${executable}`);
    const params=[String(options.seconds),String(seed),String(options.scale)];
    const wasm=executable.endsWith('.cjs');
    const {stdout}=await execute(wasm?process.execPath:executable,wasm?[executable,...params]:params,{encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024,windowsHide:true});
    const report=JSON.parse(stdout);if(report.kind!=='stress-replay' || report.seconds!==options.seconds || report.seed!==seed)throw new Error('Unexpected stress report');return report;
  };
  const runs=[];
  for(const seed of options.seeds) {
    const primary=await run(host,seed);let comparison;
    if(options.compare) {
      comparison=await run(options.compare,seed);
      if(JSON.stringify(deterministicStress(primary))!==JSON.stringify(deterministicStress(comparison)))throw new Error(`Native/Wasm replay divergence at seed ${seed}`);
    }
    runs.push({primary,...(comparison?{comparison,matched:true}:{})});process.stderr.write(`Passed ${options.seconds}s / seed ${seed}${comparison?' with exact deterministic parity':''}\n`);
  }
  const output=JSON.stringify({schema:1,policy:'stress-v2-crew-zero-travel-100ms',timing:'steady-clock microseconds; no GPU or universal time thresholds',runs},null,2)+'\n';
  if(options.output){await mkdir(dirname(resolve(options.output)),{recursive:true});await writeFile(options.output,output);process.stderr.write(`Wrote ${options.output}\n`);}else process.stdout.write(output);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
