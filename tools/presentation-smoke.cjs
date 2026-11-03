const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('build/evidence',{recursive:true});
 const hardware=process.env.CAFE_HARDWARE_GPU==='1';
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server',...(hardware?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),...(process.env.CAFE_DISABLE_WEBGPU==='1'?['--disable-blink-features=WebGPU']:[])]});
 const evidence={date:new Date().toISOString(),browser:browser.version(),hardwareRequested:hardware,platform:process.platform,runs:[]};
 const backends=process.env.CAFE_BACKENDS?.split(',') || (hardware?['automatic']:['webgl2','automatic']);
 if(backends.some(b=>!['webgl2','automatic'].includes(b)))throw Error('Unknown CAFE_BACKENDS entry');
 try{for(const backend of backends){
  const label=hardware?`hardware-${backend}`:backend;
  const page=await browser.newPage({viewport:hardware?{width:1280,height:800}:{width:1000,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!hardware)await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
  if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  const mode=async name=>page.getByRole('tab',{name:new RegExp('^'+name)}).click();
  const command=async n=>page.locator(`[data-command="${n}"]`).click();
  const wait=async fn=>page.waitForFunction(fn,null,{timeout:60000});
  try{
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
   await wait(()=>window.cafeAssetsReady && window.cafeInspectorState && !document.querySelector('[data-command="2"]').disabled);
   const assets=await page.evaluate(()=>window.cafeAssetState);assert.deepEqual(assets.failures,[]);assert.equal(assets.models,25);assert.equal(assets.audio,12);
   await page.getByRole('button',{name:'Begin guided shift',exact:true}).click();await wait(()=>window.cafeCampaignState.enabled && window.cafeCampaignState.phase===0);
   await page.getByRole('button',{name:'Open day',exact:true}).click();await wait(()=>window.cafeCampaignState.phase===1);
   await page.locator('#visits-drawer > summary').click();await command(17);await wait(()=>!window.cafeDemandState.automatic);
   await page.locator('#supplies-drawer summary').click();await command(10);await wait(()=>!window.cafeSupplyState.automatic);
   await page.locator('#guest-profile').selectOption('1');await page.locator('#guest-first').selectOption('0');
   for(let n=0;n<6;n++){
    await command(6);await page.waitForFunction(()=>window.cafeMenuState.tickets.some(t=>t.phase===0),null,{timeout:30000});
    // A real shortage is resolved through the normal restock controls.
    if(await page.evaluate(()=>window.cafeMenuState.ingredients[0].stock===0)){
     await page.locator('#supplies-drawer').evaluate(d=>d.open=true);await command(9);
    }
    if(await page.evaluate(()=>!window.cafeQualityState.usable)){
     await command(12);await wait(()=>window.cafeQualityState.usable && !window.cafeQualityState.maintenance);
    }
    await page.waitForFunction(()=>!document.getElementById('next-action').disabled,null,{timeout:60000});await page.locator('#next-action').click();
    await page.waitForFunction(()=>window.cafeState.ready && !document.getElementById('next-action').disabled,null,{timeout:60000});await page.locator('#next-action').click();
    await page.waitForFunction(n=>window.cafeState.served>=n,n+1,{timeout:30000});
    console.log(`${backend}: ticket ${n+1} paid`);
   }
   await mode('Menu');await page.locator('#staff-panel summary').click();await page.getByRole('button',{name:'Hire staff · 15.00',exact:true}).click();await wait(()=>window.cafeStaffState.staff.length===2);
   await page.locator('[data-campaign="2"]').click();await wait(()=>window.cafeCampaignState.phase===3);await page.screenshot({path:`build/evidence/release-results-${label}.png`});
   await page.locator('[data-campaign="3"]').click();await wait(()=>window.cafeCampaignState.day===2 && window.cafeCampaignState.phase===0);
   await mode('Build');await page.getByRole('button',{name:'Upgrade espresso · 30.00',exact:true}).click();await wait(()=>window.cafeEquipmentState.fast);
   // Preferences are presentation-only, persist, and never alter session bytes.
   await mode('Menu');await command(3);await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
   const save=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
   await page.locator('#settings-panel summary').click();await page.locator('#audio-muted').check();
   await wait(()=>[...EngineAudioDevices.get(window.cafeAudioState.device).voices.values()].every(v=>v.gainNode.gain.value===0));
   await page.locator('#reduced-motion').check();await page.locator('#ui-size').selectOption('1.15');
   assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),save);
   await page.locator('#audio-muted').uncheck();await wait(()=>window.cafeAudioState.active && window.cafeAudioState.voices>=1);
   // Camera is usable from keyboard and mouse, even while paused.
   await command(2);await wait(()=>window.cafeState.paused);const time=await page.evaluate(()=>window.cafeInspectorState.report.timeMs);
   await page.locator('#viewport').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('+');await page.keyboard.press('r');
   assert.equal(await page.locator('#camera-controls').count(),0);
   const sceneBounds=await page.locator('#viewport').boundingBox();
   await page.mouse.move(sceneBounds.x+sceneBounds.width/2,sceneBounds.y+sceneBounds.height/2);
   await page.mouse.down();await page.mouse.move(sceneBounds.x+sceneBounds.width/2+40,sceneBounds.y+sceneBounds.height/2+20,{steps:5});await page.mouse.up();
   await page.mouse.wheel(0,-100);await page.keyboard.press('r');
   assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.timeMs),time);
   const journeyMetrics=await page.evaluate(()=>{const m=window.cafeRenderMeasurements,a=m.intervals.filter(n=>n>0).sort((a,b)=>a-b);return {viewport:[innerWidth,innerHeight],devicePixelRatio,firstFrameMs:m.firstFrameMs,frameSamples:a.length,medianFrameMs:a[Math.floor(a.length/2)],p95FrameMs:a[Math.floor(a.length*.95)],engine:m.engine};});
   await mode('Serve');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`build/evidence/release-desktop-${label}.png`});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:`build/evidence/release-narrow-${label}.png`});
   const layout=await page.evaluate(()=>({scene:document.getElementById('viewport').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth,selected:document.querySelector('[role=tab][aria-selected=true]').id}));assert.ok(layout.scene>=220);assert.equal(layout.overflow,false);
   await page.getByRole('tab',{name:/^Serve/}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#build-tab').getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowRight');
   await page.reload();await wait(()=>window.cafeAssetsReady && window.cafeInspectorState);await mode('Menu');await page.locator('#settings-panel summary').click();assert.equal(await page.locator('#ui-size').inputValue(),'1.15');assert.equal(await page.locator('#reduced-motion').isChecked(),true);await command(4);await wait(()=>window.cafeCampaignState.day===2 && window.cafeEquipmentState.fast);
   assert.equal(await page.evaluate(()=>window.cafeStaffState.staff.length),2);
   assert.deepEqual(errors,[]);
   const metrics=await page.evaluate(async()=>{let adapter=null;if(navigator.gpu){const a=await navigator.gpu.requestAdapter();if(a)adapter={fallback:a.info?.isFallbackAdapter,description:a.info?.description,device:a.info?.device,vendor:a.info?.vendor};}const m=window.cafeRenderMeasurements,intervals=m.intervals.filter(n=>n>0).sort((a,b)=>a-b);return {devicePixelRatio,firstFrameMs:m.firstFrameMs,frameSamples:intervals.length,medianFrameMs:intervals[Math.floor(intervals.length/2)],p95FrameMs:intervals[Math.floor(intervals.length*.95)],engine:m.engine,adapter,assets:window.cafeAssetState,status:document.getElementById('status').textContent};});
   evidence.runs.push({backend,journeyMetrics,...metrics});console.log(`${backend}: first shift, shortage/restock, six payments, hire, close/results, day two, upgrade, settings, camera, keyboard tabs, narrow layout and restore passed`);
  }catch(error){console.error('Player state',JSON.stringify(await page.evaluate(()=>({error:window.cafeHostError,status:document.getElementById('status').textContent,assets:window.cafeAssetState,ready:window.cafeAssetsReady,state:window.cafeState,campaign:window.cafeCampaignState,menu:window.cafeMenuState,quality:window.cafeQualityState,workflow:window.cafeWorkflowState,engine:window.cafeRenderMeasurements.engine})),null,2));await page.screenshot({path:`build/evidence/release-failure-${backend}.png`});throw error;}finally{await page.close();}
 }}finally{await fs.writeFile(`build/evidence/release-presentation${hardware?'-hardware':''}.json`,JSON.stringify(evidence,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
