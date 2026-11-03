// Offline packaging of the requested ElevenLabs attractiveness cue; no API calls.
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {prepare}=require('./prepare-cafe-audio.cjs');
(async()=>{
 const source='assets/generated/appeal-chime/appeal.mp3';
 const encoded=await fs.readFile(source),receipt=JSON.parse(await fs.readFile(source+'.json','utf8'));
 if(receipt.provider!=='elevenlabs' || receipt.bytes!==encoded.length)throw Error('Receipt mismatch');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 let samples;
 try{const page=await browser.newPage();samples=await page.evaluate(async base64=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const context=new OfflineAudioContext(1,1,16000),decoded=await context.decodeAudioData(bytes.buffer);
  const render=new OfflineAudioContext(1,decoded.length,16000),node=render.createBufferSource();
  node.buffer=decoded;node.connect(render.destination);node.start();
  return Array.from((await render.startRendering()).getChannelData(0));
 },encoded.toString('base64'));}finally{await browser.close();}
 const {wav,metrics}=prepare(samples,false,{rms:.075,peak:.4});
 if(metrics.duration>1.7)throw Error('Unexpectedly long reward cue');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const path='audio/appeal.wav',id=12;
 const record={id,path,source,sourceSha256:hash(encoded),sha256:hash(wav),bytes:wav.length,sampleRate:16000,channels:1,bitsPerSample:16,
  provider:receipt.provider,request:receipt.request,requestId:receipt.request_id,generatedAt:receipt.created_at,metrics};
 await fs.writeFile('assets/'+path,wav);
 const provenancePath='assets/audio/elevenlabs-provenance.json',provenance=JSON.parse(await fs.readFile(provenancePath,'utf8'));
 provenance.assets=provenance.assets.filter(a=>a.id!==id);provenance.assets.push(record);
 await fs.writeFile(provenancePath,JSON.stringify(provenance,null,2)+'\n');
 const manifestPath='assets/manifest.json',manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 manifest.audio=manifest.audio.filter(a=>a.id!==id);
 manifest.audio.push({id,path,sampleRate:16000,approval:'user-requested-elevenlabs-attractiveness-sound-2026-10-29',provenance:'audio/elevenlabs-provenance.json'});
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log({path,bytes:wav.length,metrics});
})().catch(e=>{console.error(e);process.exitCode=1;});
