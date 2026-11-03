// Real engine audio acceptance, using only local generated assets.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 await fs.mkdir('build/evidence',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,
  args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const evidence={date:new Date().toISOString(),browser:browser.version(),autoplayPolicy:'permissive browser policy; engine gesture gate asserted separately',localFiles:process.env.CAFE_LOCAL_FILES==='1',primitiveModels:process.env.CAFE_AUDIO_ONLY==='1',runs:[]};
 const backends=process.env.CAFE_BACKENDS?.split(',')||['webgl2','automatic'];
 assert.ok(backends.every(b=>['webgl2','automatic'].includes(b)));
 try{for(const backend of backends){
  const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];
  if(evidence.primitiveModels)await page.context().route('**/assets/models/**',route=>route.abort());
  // Sandboxed Windows sessions can deny loopback sockets. Route the same built
  // site through Playwright without changing its origin, game or engine runtime.
  if(evidence.localFiles){
   const root=path.resolve('build/browser/site'),origin=new URL(process.env.CAFE_URL||'http://127.0.0.1:4173').origin;
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.glb':'model/gltf-binary','.wav':'audio/wav','.png':'image/png'};
   await page.context().route('**/*',async route=>{
    const url=new URL(route.request().url()),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(url.origin!==origin || !file.startsWith(root+path.sep) || (evidence.primitiveModels && url.pathname.startsWith('/assets/models/')))return route.abort();
    try{await route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:await fs.readFile(file)});}
    catch{await route.fulfill({status:404,body:'Not found'});}
   });
  }
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
  const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:60000});
  const command=async n=>page.evaluate(n=>Module._cafe_command(n),n);
  try{
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
   await wait(()=>window.cafeAssetsReady && window.cafeInspectorState);
   assert.equal(await page.evaluate(()=>window.cafeAssetState.audio),13);
   assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures.filter(f=>f.startsWith('audio/'))),[]);
   if(!evidence.primitiveModels)assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
   console.log(`${backend}: all 13 audio assets loaded`);
   assert.equal(await page.evaluate(()=>window.cafeAudioState.active),false);
   await page.getByRole('button',{name:'Begin guided shift',exact:true}).click();
   await wait(()=>window.cafeCampaignState.enabled && window.cafeCampaignState.phase===0);
   await page.getByRole('button',{name:'Open day',exact:true}).click();
   await wait(()=>window.cafeAudioState.active && window.cafeAudioState.cues[3]>0);
   await page.evaluate(()=>Module._cafe_scenario(2));await wait(()=>!window.cafeCampaignState.enabled && window.cafeDiagnosticState.stock===100);
   await page.getByRole('tab',{name:'Menu',exact:true}).click();
   await wait(()=>window.cafeAudioState.cues[11]>0);
   await page.locator('#serve-tab').click();
   for(let product=0;product<5;product++){
    if(product){await page.evaluate(p=>Module._cafe_guest(0,p,-1),product);await wait(p=>window.cafeMenuState.tickets.some(t=>t.phase===0 && t.items[0].product===p),product);}
    await wait(()=>!document.getElementById('next-action').disabled);
    await page.locator('#next-action').click();
    await wait(()=>window.cafeState.ready && !document.getElementById('next-action').disabled);
    await page.locator('#next-action').click();await wait(n=>window.cafeState.served===n,product+1);
    console.log(`${backend}: product ${product} served`);
   }
   await wait(()=>window.cafeAudioState.cues[10]>0);
   const cues=await page.evaluate(()=>window.cafeAudioState.cues);
   for(let id=0;id<12;id++)assert.ok(cues[id]>0,`Cue ${id} never played`);
   // Every engine source must obey master/effects/ambience gain composition.
   await page.evaluate(()=>{Module._cafe_audio(2,0);Module._cafe_audio(3,0);});
   await wait(()=>[...EngineAudioDevices.get(cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
   await page.evaluate(()=>{Module._cafe_audio(2,.55);Module._cafe_audio(3,.3);Module._cafe_audio(1,1);});
   await wait(()=>[...EngineAudioDevices.get(cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
   await page.evaluate(()=>Module._cafe_audio(1,0));
   await command(2);await wait(()=>window.cafeState.paused && !window.cafeAudioState.active);
   const paused=await page.evaluate(()=>window.cafeAudioState.cues);await page.waitForTimeout(300);
   assert.deepEqual(await page.evaluate(()=>window.cafeAudioState.cues),paused);
   await page.locator('[data-command="2"]').click();await wait(()=>!window.cafeState.paused);
   // Some browser/device combinations require a fresh activation gesture after
   // the queued simulation Resume has committed.
   await page.locator('#serve-tab').click();await wait(()=>window.cafeAudioState.active);
   const rejected=await page.evaluate(()=>{const ptr=Module._malloc(4);try{HEAPF32[ptr/4]=NaN;return [Module._cafe_sound(0,ptr,1,16000),Module._cafe_sound(13,ptr,1,16000),Module._cafe_sound(3,ptr,480001,16000)];}finally{Module._free(ptr);}});
   assert.deepEqual(rejected,[0,0,0]);
   await page.evaluate(()=>{Module._cafe_suspend(1);});await wait(()=>!window.cafeAudioState.active);
   await page.evaluate(()=>Module._cafe_suspend(0));await page.locator('#serve-tab').click();await wait(()=>window.cafeAudioState.active);
   // Cancellation retires the actual machine voice; restore/reset must not replay
   // arrival/payment/ready events from an already populated snapshot.
   await page.evaluate(()=>Module._cafe_guest(1,2,-1));await wait(()=>window.cafeMenuState.tickets.some(t=>t.phase===0));
   await wait(()=>!document.getElementById('next-action').disabled);
   const before=await page.evaluate(()=>window.cafeAudioState.cues[0]);await page.locator('#next-action').click();
   await wait(n=>window.cafeAudioState.cues[0]>n,before);
   await command(5);await wait(()=>!window.cafeState.ready && window.cafeState.brewing===0);
   await page.evaluate(()=>Module._cafe_scenario(2));await wait(()=>window.cafeDiagnosticState.stock===100);
   await page.waitForTimeout(700);
   assert.equal(await page.evaluate(()=>window.cafeAudioState.voices),1,'Only ambience survives scenario replacement');
   assert.deepEqual(errors,[]);
   evidence.runs.push({backend,cues,assets:await page.evaluate(()=>window.cafeAssetState),rejected,errors});
   console.log(`${backend}: all 12 cues, volume/mute, pause/resume, visibility, invalid replacement and reset passed`);
  }catch(error){console.error(`${backend}: ${error.stack}`);console.error(await page.evaluate(()=>{
    const a=window.cafeAudioState,d=window.EngineAudioDevices?.get(a?.device);
    return JSON.stringify({assets:window.cafeAssetState,audio:a,device:d?{error:d.error,active:d.active,suspended:d.suspended,activated:d.activated,state:d.context?.state}:null,game:window.cafeState,hostError:window.cafeHostError,hidden:document.hidden});
   }).catch(()=> 'Page unavailable'));throw error;}finally{await page.close();}
 }}finally{await fs.writeFile('build/evidence/audio-browser.json',JSON.stringify(evidence,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
