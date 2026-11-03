// Offline authoring only: decode existing ElevenLabs MP3s with Chromium's codec,
// then produce the game's bounded mono 16 kHz PCM WAVs. No provider calls.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=path.resolve(root,process.env.CAFE_AUDIO_SOURCE||'assets/generated/elevenlabs-cafe-20261028');
const output=path.join(root,'assets/audio');
const names=['brew','cup','door','ambience','grinder','steam','payment','ready','pour','pastry','clean','ui'];
const only=process.env.CAFE_AUDIO_ONLY_NAME;
if(only && !names.includes(only))throw Error('Unknown audio name');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');

function prepare(input,loop,levels={}){
 const samples=Float32Array.from(input);let dc=0;
 for(const x of samples){if(!Number.isFinite(x))throw Error('Nonfinite decoded sample');dc+=x;}
 dc/=samples.length;for(let i=0;i<samples.length;i++)samples[i]-=dc;
 let pcm=samples;
 if(loop){
  // Overlap the end and beginning into a single continuous period. Match the
  // loop junction to adjacent original samples rather than inserting silence.
  const overlap=4800,period=samples.length-overlap;
  pcm=new Float32Array(period);
  pcm.set(samples.subarray(overlap,period),0);
  for(let i=0;i<overlap;i++){
   const t=i/(overlap-1),fade=.5-.5*Math.cos(Math.PI*t);
   pcm[period-overlap+i]=samples[period+i]*(1-fade)+samples[i]*fade;
  }
 }else{
  let peak=0;for(const x of pcm)peak=Math.max(peak,Math.abs(x));
  const threshold=Math.max(.0001,peak*.002);
  let first=0,last=pcm.length-1;
  while(first<last && Math.abs(pcm[first])<threshold)first++;
  while(last>first && Math.abs(pcm[last])<threshold)last--;
  pcm=pcm.slice(Math.max(0,first-240),Math.min(pcm.length,last+1601));
  for(let i=0;i<Math.min(80,pcm.length);i++)pcm[i]*=i/80;
  for(let i=0;i<Math.min(640,pcm.length);i++)pcm[pcm.length-1-i]*=i/640;
 }
 let peak=0,sum=0;for(const x of pcm){peak=Math.max(peak,Math.abs(x));sum+=x*x;}
 const rms=Math.sqrt(sum/pcm.length);
 if(rms<.00001)throw Error('Silent audio');
 const gain=Math.min((levels.rms??(loop?.035:.09))/rms,(levels.peak??(loop?.20:.45))/peak);
 const wav=Buffer.alloc(44+pcm.length*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);
 wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);
 for(let i=0;i<pcm.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]*gain))*32767),44+i*2);
 if(wav.length>1024*1024 || pcm.length>(loop?480000:160000))throw Error('Runtime budget exceeded');
 return {wav,metrics:{duration:pcm.length/16000,peak:peak*gain,rms:rms*gain,gain,dcRemoved:dc,
  loop,loopCrossfadeSeconds:loop?.3:0,loopBoundaryDelta:loop?Math.abs(pcm[0]-pcm[pcm.length-1])*gain:null}};
}

module.exports={prepare};
if(require.main===module)(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server']});
 const records=[];
 try{
  const page=await browser.newPage();
  await fs.mkdir(path.join(source,'original-local-backup'),{recursive:true});
  for(let id=0;id<names.length;id++){
   if(only && names[id]!==only)continue;
   const name=names[id],encoded=await fs.readFile(path.join(source,name+'.mp3'));
   const receipt=JSON.parse(await fs.readFile(path.join(source,name+'.mp3.json'),'utf8'));
   if(receipt.provider!=='elevenlabs' || receipt.bytes!==encoded.length)throw Error('Receipt mismatch: '+name);
   const samples=await page.evaluate(async base64=>{
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const context=new OfflineAudioContext(1,1,16000);
    const decoded=await context.decodeAudioData(bytes.buffer);
    const render=new OfflineAudioContext(1,decoded.length,16000),source=render.createBufferSource();
    source.buffer=decoded;source.connect(render.destination);source.start();
    return Array.from((await render.startRendering()).getChannelData(0));
   },encoded.toString('base64'));
   const {wav,metrics}=prepare(samples,name==='ambience');
   const target=path.join(output,name+'.wav');
   try{await fs.copyFile(target,path.join(source,'original-local-backup',name+'.wav'),fs.constants.COPYFILE_EXCL);}catch(e){if(!['ENOENT','EEXIST'].includes(e.code))throw e;}
   await fs.writeFile(target,wav);
   records.push({id,path:'audio/'+name+'.wav',source:path.relative(root,path.join(source,name+'.mp3')).split(path.sep).join('/'),
    sourceSha256:hash(encoded),sha256:hash(wav),bytes:wav.length,sampleRate:16000,channels:1,bitsPerSample:16,
    provider:receipt.provider,request:receipt.request,requestId:receipt.request_id,generatedAt:receipt.created_at,metrics});
   console.log(name+': '+metrics.duration.toFixed(2)+' s, peak '+metrics.peak.toFixed(3)+', RMS '+metrics.rms.toFixed(3));
  }
  if(only){
   const previous=JSON.parse(await fs.readFile(path.join(output,'elevenlabs-provenance.json'),'utf8'));
   for(const record of previous.assets)if(!records.some(r=>r.id===record.id))records.push(record);
   records.sort((a,b)=>a.id-b.id);
  }
  await fs.writeFile(path.join(output,'elevenlabs-provenance.json'),JSON.stringify({
   approval:'user-requested-elevenlabs-generation-and-integration-2026-10-28',
   preparation:'tools/prepare-cafe-audio.cjs; Chromium MP3 decode and mono resample, DC removal, one-shot trim/fades, 300ms ambience overlap, bounded RMS/peak normalization',
   usageRights:'Generated with the owner-provided ElevenLabs account at their request. Account plan and distribution entitlement have not been independently verified.',
   listeningReview:'Not performed by the agent; headphone/speaker acceptance remains required.',assets:records},null,2)+'\n');
  const manifestPath=path.join(root,'assets/manifest.json');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  manifest.audio=records.map(a=>({id:a.id,path:a.path,sampleRate:a.sampleRate,
   approval:'user-requested-elevenlabs-generation-and-integration-2026-10-28',provenance:'audio/elevenlabs-provenance.json'}));
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
