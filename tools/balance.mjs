import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function parseArgs(args) {
  const result={scenario:'all',seeds:[1,2,3],seconds:300,format:'json'};
  const seen=new Set();
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]?.replace(/^--/,'');
    if(!args[i]?.startsWith('--') || !['host','scenario','seeds','seconds','format','output'].includes(key) || seen.has(key) || !args[i+1] || args[i+1].startsWith('--'))throw new Error(`Invalid or repeated option: ${args[i]}`);
    seen.add(key);result[key]=args[i+1];
  }
  const uint=(text,max)=>/^\d+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text)>0 && Number(text)<=max;
  if(typeof result.seeds==='string') {
    const values=result.seeds.split(',');if(values.length>32 || !values.every(s=>uint(s,4294967295)))throw new Error('Use 1..32 nonzero uint32 seeds');
    result.seeds=values.map(Number);
  }
  if(!uint(String(result.seconds),3600))throw new Error('Duration must be 1..3600 whole seconds');
  result.seconds=Number(result.seconds);
  if(!['json','csv'].includes(result.format))throw new Error('Format must be json or csv');
  return result;
}
export function csvReport(rows) {
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]);
  const cell=value=>`"${String(value).replaceAll('"','""')}"`;
  return [keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\n')+'\n';
}
export async function main(args) {
  const options=parseArgs(args);
  const candidates=['build/cloud/simulation/cafe_balance','build/simulation/cafe_balance','build/simulation/Release/cafe_balance.exe','build/simulation/cafe_balance.exe','build/simulation-wasm/cafe_balance.cjs'];
  const host=resolve(options.host ?? candidates.find(existsSync) ?? 'build/simulation/cafe_balance');
  if(!existsSync(host))throw new Error('Build tests/CMakeLists.txt first, or pass --host PATH to cafe_balance');
  const invoke=args=>{
    const command=host.endsWith('.cjs')?process.execPath:host;
    const result=spawnSync(command,host.endsWith('.cjs')?[host,...args]:args,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true});
    if(result.error || result.status!==0)throw new Error(result.error?.message || result.stderr || `Balance host exited ${result.status}`);
    return JSON.parse(result.stdout);
  };
  const content=invoke(['--validate']);
  const keys=content.scenarios.map(s=>s.key);
  if(options.scenario!=='all' && !keys.includes(options.scenario))throw new Error(`Unknown scenario. Choose ${keys.join(', ')} or all`);
  const rows=[];
  for(const key of options.scenario==='all'?keys:[options.scenario])for(const seed of options.seeds)rows.push(invoke([key,String(seed),String(options.seconds)]));
  const output=options.format==='csv'?csvReport(rows):JSON.stringify({schema:1,policy:'reference-v1-zero-travel-100ms',units:{money:'integer minor currency',time:'milliseconds',quality:'0..1000'},runs:rows},null,2)+'\n';
  if(options.output){await mkdir(dirname(resolve(options.output)),{recursive:true});await writeFile(options.output,output);process.stderr.write(`Wrote ${rows.length} runs to ${options.output}\n`);}
  else process.stdout.write(output);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
