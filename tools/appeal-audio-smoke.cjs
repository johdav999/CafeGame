// Exercises the real engine audio path while controlling only the HUD score.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required']});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Keep this audio check independent of model decoding and GPU asset budgets.
  await page.route('**/assets/models/**',r=>r.abort());
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady&&window.cafeInspectorState?.report&&window.cafeAudioState,null,{timeout:60000}).catch(async e=>{
   console.error(await page.evaluate(()=>({assets:window.cafeAssetState,ready:window.cafeAssetsReady,audio:window.cafeAudioState,hostError:window.cafeHostError,status:document.body.innerText.slice(0,500)})),errors);throw e;
  });
  assert.equal(await page.evaluate(()=>cafeAssetState.audio),13);
  assert.deepEqual(await page.evaluate(()=>cafeAssetState.failures.filter(f=>f.startsWith('audio/'))),[]);
  await page.locator('#menu-tab').click();
  await page.waitForFunction(()=>cafeAudioState.active);
  await page.evaluate(()=>{
   const publish=window.cafeInspector;window.testScore=40;
   window.cafeInspector=json=>{const s=JSON.parse(json);s.report.attractiveness=testScore;publish(JSON.stringify(s));};
   window.score=n=>{window.testScore=n;window.cafeInspector(JSON.stringify(cafeInspectorState));};
   dispatchEvent(new Event('cafe-session-replaced'));score(40);
  });
  const count=()=>page.evaluate(()=>cafeAudioState.cues[12]);
  const initial=await count();
  await page.evaluate(()=>{score(45);score(50);});
  await page.waitForFunction(n=>cafeAudioState.cues[12]===n+1,initial);
  const pcm=await page.evaluate(async()=>{
   const bytes=await(await fetch('assets/audio/appeal.wav')).arrayBuffer(),wav=new DataView(bytes);
   const device=EngineAudioDevices.get(cafeAudioState.device),expected=wav.getUint32(40,true)/2;
   const voice=[...device.voices.values()].find(v=>!v.options.loop&&v.source.buffer.length===expected);
   return {started:!!voice?.started,samples:expected,matches:!!voice&&[.1,.3,.7,.9].every(f=>{const i=Math.floor(expected*f);return voice.source.buffer.getChannelData(0)[i]===wav.getInt16(44+i*2,true)/32768;})};
  });
  assert.ok(pcm.started&&pcm.matches,'Engine must play the actual packaged appeal PCM');
  await page.evaluate(()=>{score(49);dispatchEvent(new Event('cafe-session-replaced'));score(80);});
  await page.waitForTimeout(150);assert.equal(await count(),initial+1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>score(85));
  await page.waitForFunction(n=>cafeAudioState.cues[12]===n+2,initial);
  await page.evaluate(()=>Module._cafe_command(2));await page.waitForFunction(()=>cafeState.paused);
  await page.evaluate(()=>Module._cafe_audio(5,0));await page.waitForTimeout(100);assert.equal(await count(),initial+2);
  await page.locator('#hud-pause').click();await page.waitForFunction(()=>!cafeState.paused&&cafeAudioState.active);
  await page.evaluate(()=>{Module._cafe_audio(1,1);Module._cafe_audio(5,0);});
  await page.waitForFunction(n=>cafeAudioState.cues[12]===n+3,initial);
  assert.ok(await page.evaluate(()=>[...EngineAudioDevices.get(cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0)));
  assert.deepEqual(errors,[]);reports.push({backend,passed:true,pcm,rapidGainCoalesced:true,resetAndDecreaseSilent:true,reducedMotionSound:true,pauseAndMute:true,modelFallbacks:true});
  await page.close();
 }}finally{await browser.close();}
 await fs.mkdir('build/evidence',{recursive:true});await fs.writeFile('build/evidence/appeal-audio.json',JSON.stringify(reports,null,2));console.log(reports);
})().catch(e=>{console.error(e);process.exitCode=1;});
