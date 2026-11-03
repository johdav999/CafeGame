// Verify every new mesh through the full guest lifecycle and the shared roster.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try {for(const backend of ['webgl2','automatic']) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
  await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  assert.equal(await page.evaluate(()=>window.cafeAssetState.models),25);
  await page.evaluate(()=>{Module._cafe_scenario(2);});
  await wait(()=>window.cafeGuestAnimations?.length===1 && window.cafeGuestAnimations[0].clip==='Idle');
  await page.evaluate(()=>Module._cafe_command(0));
  await wait(()=>window.cafeState.ready && window.cafeWorkflowState?.handoverReady);
  await page.evaluate(()=>{Module._cafe_command(6);Module._cafe_command(6);Module._cafe_command(6);});
  await wait(()=>window.cafeGuestAnimations?.length===4);
  const roster=await page.evaluate(()=>window.cafeGuestAnimations.map(g=>({guest:g.guest,model:g.model})));
  assert.deepEqual(roster.map(g=>g.model),[1,12,13,14]);
  await page.waitForTimeout(4000);
  await page.locator('#viewport').screenshot({path:`build/evidence/guest-roster-${backend}.png`});
  for(const name of ['sage','forest','oat']) {
   // Slot 1 lets the same first-guest service scenario exercise each actual GLB.
   const accepted=await page.evaluate(async name=>{const b=new Uint8Array(await(await fetch(`assets/models/Guest-${name}-animated.glb`)).arrayBuffer());const p=Module._malloc(b.length);try{HEAPU8.set(b,p);return Module._cafe_model(1,p,b.length);}finally{Module._free(p);}},name);
   assert.equal(accepted,1);
   await page.evaluate(()=>Module._cafe_scenario(2));
   await wait(()=>window.cafeGuestAnimations?.length===1 && window.cafeGuestAnimations[0].clip==='Walking');
   const walking=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.waitForFunction(g=>{const a=window.cafeGuestAnimations[0];return a.poseRevision>g.poseRevision && Math.hypot(a.x-g.x,a.z-g.z)>.1;},walking);
   await page.locator('#viewport').screenshot({path:`build/evidence/guest-${name}-walking-${backend}.png`});
   await wait(()=>window.cafeGuestAnimations[0]?.clip==='Idle');
   await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
   const paused=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.cafeGuestAnimations[0]),paused);
   const rejected=await page.evaluate(async()=>{const b=new Uint8Array(await(await fetch('assets/models/neighbor-standing.glb')).arrayBuffer());const p=Module._malloc(b.length);try{HEAPU8.set(b,p);return [1,12,13,14].map(id=>Module._cafe_model(id,p,b.length));}finally{Module._free(p);}});
   assert.deepEqual(rejected,[0,0,0,0]);
   await page.evaluate(()=>{Module._cafe_command(2);Module._cafe_command(0);});
   await wait(()=>window.cafeState.ready && window.cafeWorkflowState?.handoverReady);
   await page.evaluate(()=>Module._cafe_command(1));
   await wait(()=>window.cafeGuestAnimations.some(g=>g.clip==='Seated' && g.time>.3));
   await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
   await page.locator('#viewport').screenshot({path:`build/evidence/guest-${name}-seated-${backend}.png`});
   const seated=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.evaluate(()=>Module._cafe_command(3));await wait(()=>document.querySelector('#save-status').textContent.startsWith('Shift saved'));
   await page.evaluate(()=>Module._cafe_command(4));await wait(()=>document.querySelector('#save-status').textContent==='Saved shift restored.');
   if(await page.evaluate(()=>window.cafeState.paused))await page.evaluate(()=>Module._cafe_command(2));
   await wait(()=>window.cafeGuestAnimations?.length===1);
   assert.equal(await page.evaluate(()=>window.cafeGuestAnimations[0].model),1);
   await wait(()=>window.cafeGuestAnimations.length===0);
   reports.push({name,backend,status:await page.locator('#status').textContent(),roster,walking,seated,passed:true});
   console.log(`${name} ${backend}: lifecycle passed`);
  }
  assert.deepEqual(errors,[]);await page.close();
 }} finally {await fs.writeFile('build/evidence/guest-variants-browser.json',JSON.stringify(reports,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
