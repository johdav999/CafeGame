const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-blink-features=WebGPU']});
 try{
  let stage='startup';const page=await browser.newPage({viewport:{width:900,height:720}}),errors=[];page.on('pageerror',e=>errors.push({stage,message:e.message,stack:e.stack}));
  await page.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});Object.defineProperty(window,'devicePixelRatio',{value:.5});});
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=webgl2`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeState,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.cafeAudioState.active),false);
  await page.getByRole('button',{name:'Begin guided shift',exact:true}).click();await page.waitForFunction(()=>window.cafeAudioState.active && window.cafeAudioState.voices>0);
  await page.getByRole('tab',{name:'Menu',exact:true}).click();await page.locator('#settings-panel > summary').click();await page.locator('#audio-muted').check();
  await page.waitForFunction(()=>[...EngineAudioDevices.get(window.cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
  await page.locator('#audio-muted').uncheck();await page.locator('#ambience-volume').fill('0');
  await page.waitForFunction(()=>[...EngineAudioDevices.get(window.cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
  await page.locator('#ambience-volume').fill('60');await page.waitForFunction(()=>[...EngineAudioDevices.get(window.cafeAudioState.device).voices.values()].some(v=>Math.abs(v.gainNode.gain.value-.6)<.001));
  await page.locator('[data-command="2"]').click();await page.waitForFunction(()=>window.cafeState.paused && !window.cafeAudioState.active);
  await page.locator('[data-command="2"]').click();await page.waitForFunction(()=>!window.cafeState.paused && window.cafeAudioState.active);
  stage='corrupt replacement';const rejected=await page.evaluate(()=>{const p=Module._malloc(16);try{HEAPU8.fill(0,p,p+16);const model=Module._cafe_model(0,p,16);HEAPF32[p/4]=NaN;const sound=Module._cafe_sound(0,p,1,16000);return {model,sound};}finally{Module._free(p);}});assert.deepEqual(rejected,{model:0,sound:0});
  stage='shutdown';
  await page.evaluate(()=>{Module._cafe_shutdown();Module._cafe_suspend(1);Module._cafe_shutdown();});
  await page.close();
  stage='missing assets';const fallback=await browser.newPage({viewport:{width:900,height:720}});fallback.on('pageerror',e=>errors.push({stage,message:e.message,stack:e.stack}));
  await fallback.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});Object.defineProperty(window,'devicePixelRatio',{value:.5});});
  await fallback.route('**/assets/models/**',r=>r.abort());await fallback.route('**/assets/audio/**',r=>r.abort());await fallback.route('**/audio-system.js',r=>r.abort());
  await fallback.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=webgl2`);await fallback.waitForFunction(()=>window.cafeAssetsReady && window.cafeInspectorState,null,{timeout:60000});
  assert.equal(await fallback.evaluate(()=>window.cafeAssetState.models),0);assert.equal(await fallback.evaluate(()=>window.cafeAssetState.audio),0);assert.equal(await fallback.evaluate(()=>window.cafeAssetState.failures.length),34);assert.equal(await fallback.evaluate(()=>!!window.cafeHostError),false);
  await fallback.getByRole('button',{name:'Begin guided shift',exact:true}).click();await fallback.waitForFunction(()=>window.cafeCampaignState.enabled);await fallback.getByRole('button',{name:'Open day',exact:true}).click();await fallback.waitForFunction(()=>window.cafeCampaignState.phase===1);
  await fallback.locator('#visits-drawer > summary').click();await fallback.locator('#guest-profile').selectOption('1');await fallback.locator('[data-command="6"]').click();await fallback.waitForFunction(()=>!document.getElementById('next-action').disabled);await fallback.locator('#next-action').click();await fallback.waitForFunction(()=>window.cafeState.ready && !document.getElementById('next-action').disabled,null,{timeout:60000});await fallback.locator('#next-action').click();await fallback.waitForFunction(()=>window.cafeState.served===1);
  await fallback.screenshot({path:'build/evidence/release-primitive-fallback.png'});assert.deepEqual(errors,[]);await fallback.close();
  console.log('Gesture unlock, real bus mute/volume, pause/resume, corrupt replacement and missing-model/audio/adapter primitive service passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
