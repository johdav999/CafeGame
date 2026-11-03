// Offline preparation of the two user-supplied recordings. No provider calls.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {prepare}=require('./prepare-cafe-audio.cjs');
const root=path.resolve(__dirname,'..'),overlap=4800;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function balance(input){
 const mean=input.reduce((a,b)=>a+b,0)/input.length;
 let sum=0,peak=0;const samples=Float32Array.from(input,x=>x-mean);
 for(const x of samples){sum+=x*x;peak=Math.max(peak,Math.abs(x));}
 const rms=Math.sqrt(sum/samples.length);if(rms<.00001)throw Error('Silent source');
 const gain=Math.min(.06/rms,.3/peak);
 return {samples:samples.map(x=>x*gain),metrics:{sourceRms:rms,sourcePeak:peak,gain,dcRemoved:mean}};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),clips=[],sources=[];
  for(const name of ['cafesound1.wav','cafesound2.wav']){
   const file='assets/audio/'+name,bytes=await fs.readFile(path.join(root,file));
   const decoded=await page.evaluate(async encoded=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const decoder=new OfflineAudioContext(1,1,16000),audio=await decoder.decodeAudioData(bytes.buffer);
    const context=new OfflineAudioContext(1,audio.length,16000),source=context.createBufferSource();
    source.buffer=audio;source.connect(context.destination);source.start();
    return Array.from((await context.startRendering()).getChannelData(0));
   },bytes.toString('base64'));
   const clip=balance(decoded);if(clip.samples.length<overlap*2)throw Error('Source too short');
   clips.push(clip.samples);sources.push({path:file,sha256:sha256(bytes),bytes:bytes.length,duration:decoded.length/16000,...clip.metrics});
  }
  const [a,b]=clips,joined=new Float32Array(a.length+b.length-overlap);
  joined.set(a.subarray(0,a.length-overlap));
  for(let i=0;i<overlap;i++){
   const mix=.5-.5*Math.cos(Math.PI*i/(overlap-1));
   joined[a.length-overlap+i]=a[a.length-overlap+i]*(1-mix)+b[i]*mix;
  }
  joined.set(b.subarray(overlap),a.length);
  // The existing circular overlap handles the second-to-first transition.
  const {wav,metrics}=prepare(joined,true,{rms:.06,peak:.3});
  await fs.writeFile(path.join(root,'assets/audio/cafe-background.wav'),wav);
  const record={approval:'user-supplied-and-requested-integration-2026-10-28',provider:'user-provided',
   listeningReview:'Not auditioned by the agent; waveform, format, loop seam and browser loading validated separately.',
   preparation:'tools/prepare-cafe-background.cjs; mono 16 kHz resampling, per-clip level matching and DC removal, two 300 ms cosine crossfades, bounded RMS/peak normalization',
   sources,asset:{id:3,path:'audio/cafe-background.wav',provider:'user-provided',sha256:sha256(wav),bytes:wav.length,sampleRate:16000,channels:1,bitsPerSample:16,metrics}};
  await fs.writeFile(path.join(root,'assets/audio/cafe-background-provenance.json'),JSON.stringify(record,null,2)+'\n');
  const manifestPath=path.join(root,'assets/manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  const asset=manifest.audio.find(a=>a.id===3);if(!asset)throw Error('Ambience slot missing');
  Object.assign(asset,{path:record.asset.path,approval:record.approval,provenance:'audio/cafe-background-provenance.json'});
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({sources:sources.map(s=>({path:s.path,duration:s.duration})),output:record.asset},null,2));
 }finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
