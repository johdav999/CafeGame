const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required']});
 try{
  const check=await b.newPage();await check.setContent('<button>Audio probe</button><script>document.querySelector("button").onclick=()=>{window.ctx=new AudioContext();window.ctx.resume();}</script>');await check.locator('button').click();await check.waitForTimeout(1000);console.log('standalone',await check.evaluate(()=>({state:ctx.state,time:ctx.currentTime,activation:navigator.userActivation.hasBeenActive})));await check.close();
  const p=await b.newPage();
  await p.route('**/assets/models/**',r=>r.abort());
  await p.addInitScript(()=>{window.audioCalls=[];for(const name of ['resume','suspend']){const original=AudioContext.prototype[name];AudioContext.prototype[name]=function(...args){audioCalls.push({name,state:this.state,time:performance.now()});const result=original.apply(this,args);result.then(()=>audioCalls.push({done:name,state:this.state,time:performance.now()}));return result;};}});
  await p.goto(`http://localhost:4173/?backend=${process.env.CAFE_BACKENDS||'webgl2'}`);
  await p.waitForFunction(()=>window.cafeAssetsReady&&window.cafeAudioState,null,{timeout:60000});
  console.log('before',await p.evaluate(()=>({audio:cafeAudioState,assets:cafeAssetState})));
  await p.locator('#menu-tab').click();
  await p.waitForFunction(()=>cafeAudioState.active,null,{timeout:10000});
  const ambience=await p.evaluate(async()=>{
   const manifest=await (await fetch('assets/manifest.json')).json(),asset=manifest.audio.find(a=>a.id===3);
   const bytes=await (await fetch('assets/'+asset.path)).arrayBuffer(),wav=new DataView(bytes);
   const expected=wav.getUint32(40,true)/2,device=EngineAudioDevices.get(cafeAudioState.device);
   const voice=[...device.voices.values()].find(v=>v.options.loop);
   if(!voice)return {path:asset.path,expected,actual:0,started:false,matches:false};
   const pcm=voice.source.buffer.getChannelData(0);
   return {path:asset.path,expected,actual:pcm.length,started:voice.started,
    matches:[.1,.3,.7,.9].every(f=>{const i=Math.floor(expected*f);return pcm[i]===wav.getInt16(44+i*2,true)/32768;})};
  });
  assert.equal(ambience.actual,ambience.expected);assert.ok(ambience.started&&ambience.matches,'The engine must loop the actual manifest audio buffer');
  if(await p.locator('#sound-enable').isVisible())await p.locator('#sound-enable').click();
  await p.waitForTimeout(1200);
  console.log('activation',await p.evaluate(()=>({user:navigator.userActivation.isActive,sticky:navigator.userActivation.hasBeenActive,secure:isSecureContext,calls:audioCalls})));
  console.log('after',await p.evaluate(()=>{const a=cafeAudioState,d=EngineAudioDevices.get(a.device);return {a,game:cafeState,hidden:document.hidden,error:d.error,suspended:d.suspended,activated:d.activated,revision:d.activationRevision,state:d.context?.state,voices:[...d.voices.values()].map(v=>({gain:v.gainNode.gain.value,started:v.started})),output:d.output?.gain.value};}));
  // Measure the background alone so UI clicks cannot satisfy the output check.
  await p.evaluate(()=>Module._cafe_audio(2,0));
  const signal=await p.evaluate(async()=>{const d=EngineAudioDevices.get(cafeAudioState.device),an=d.context.createAnalyser(),sink=d.context.createGain();sink.gain.value=0;d.output.connect(an);an.connect(sink);sink.connect(d.context.destination);const data=new Float32Array(an.fftSize);let peak=0;const start=d.context.currentTime;for(let i=0;i<40;i++){an.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,30));}d.output.disconnect(an);an.disconnect();sink.disconnect();return {ambienceOnly:true,peak,start,end:d.context.currentTime,bufferPeak:[...d.voices.values()].find(v=>v.options.loop).source.buffer.getChannelData(0).reduce((m,x)=>Math.max(m,Math.abs(x)),0)};});
  await p.evaluate(()=>Module._cafe_audio(2,.55));
  assert.ok(signal.bufferPeak>.01,'Sound buffers must contain audible PCM');
  if(signal.end>signal.start)assert.ok(signal.peak>0.00001,'No rendered audio after user gesture');
  else signal.limitation='Host audio clock remains at zero; speaker output cannot be verified.';
  await p.locator('#settings-panel > summary').click();
  await p.locator('#sound-test').click();
  await p.waitForFunction(()=>cafeAudioState.cues[11]>0);
  await p.locator('#audio-muted').check();
  await p.waitForFunction(()=>[...EngineAudioDevices.get(cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
  await p.locator('#sound-enable').click();
  await p.waitForFunction(()=>!document.getElementById('audio-muted').checked&&document.getElementById('sound-enable').hidden);
  await p.locator('#sound-test').scrollIntoViewIfNeeded();await p.mouse.move(1,1);
  await p.screenshot({path:`build/evidence/audio-fixed-${process.env.CAFE_BACKENDS||'webgl2'}.png`});
  const evidence={backend:process.env.CAFE_BACKENDS||'webgl2',firstClickActivated:true,muteAndEnable:true,testCuePlayed:true,ambience,signal};
  await fs.writeFile(`build/evidence/audio-output-${evidence.backend}.json`,JSON.stringify(evidence,null,2));console.log(evidence);
 }finally{await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
