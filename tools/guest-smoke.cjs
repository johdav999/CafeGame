// Full guest lifecycle with imported skinning on both supported browser renderers.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('build/evidence',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try {for(const backend of ['webgl2','automatic']) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000});
  try {
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}&tools=1`);
   await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
   assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
   await page.evaluate(()=>Module._cafe_scenario(2));
   await wait(()=>window.cafeDiagnosticState.stock===100);
   await wait(()=>window.cafeGuestAnimations?.some(g=>g.clip==='Walking'));
   const walking=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.waitForFunction(g=>{const a=window.cafeGuestAnimations[0];return a && a.poseRevision>g.poseRevision && Math.hypot(a.x-g.x,a.z-g.z)>.1;},walking);
   await page.locator('#viewport').screenshot({path:`build/evidence/guest-walking-${backend}.png`});
   await wait(()=>window.cafeGuestAnimations[0]?.clip==='Idle');
   const idle=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.waitForFunction(t=>window.cafeGuestAnimations[0].time!==t,idle.time);
   await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
   const paused=await page.evaluate(()=>window.cafeGuestAnimations[0]);
   await page.waitForTimeout(350);
   assert.deepEqual(await page.evaluate(()=>window.cafeGuestAnimations[0]),paused);
   const rejected=await page.evaluate(async()=>{const bytes=new Uint8Array(await (await fetch('assets/models/neighbor-standing.glb')).arrayBuffer());const p=Module._malloc(bytes.length);try{HEAPU8.set(bytes,p);return Module._cafe_model(1,p,bytes.length);}finally{Module._free(p);}});
   assert.equal(rejected,0);assert.equal(await page.evaluate(()=>window.cafeGuestAnimations[0].clip),'Idle');
   await page.evaluate(()=>Module._cafe_command(2));
   await page.evaluate(()=>Module._cafe_command(0));
   await wait(()=>window.cafeState.ready && window.cafeWorkflowState?.handoverReady);
   await page.evaluate(()=>Module._cafe_command(1));
   await wait(()=>window.cafeGuestAnimations.some(g=>g.clip==='Seated' && g.time>.3));
   await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
   const seated=await page.evaluate(()=>window.cafeGuestAnimations.find(g=>g.clip==='Seated'));
   await page.locator('#viewport').screenshot({path:`build/evidence/guest-seated-${backend}.png`});
   await page.evaluate(()=>Module._cafe_command(3));
   await wait(()=>document.querySelector('#save-status').textContent.startsWith('Shift saved'));
   await page.evaluate(()=>Module._cafe_command(4));
   await wait(()=>document.querySelector('#save-status').textContent==='Saved shift restored.');
   if(await page.evaluate(()=>window.cafeState.paused))await page.evaluate(()=>Module._cafe_command(2));
   await wait(()=>window.cafeGuestAnimations.some(g=>g.clip==='Seated'));
   await wait(()=>window.cafeGuestAnimations.length===0);
   assert.deepEqual(errors,[]);
   reports.push({backend,status:await page.locator('#status').textContent(),walking,idle,paused,seated,errors,passed:true});
   console.log(`${backend}: guest walk/idle/seated, pause, rejected replacement, save/load and departure passed`);
  } catch(e) {console.error(await page.evaluate(()=>({state:window.cafeState,guests:window.cafeGuestAnimations,assets:window.cafeAssetState,error:window.cafeHostError})));throw e;} finally {await page.close();}
 }} finally {
  await fs.writeFile('build/evidence/guest-browser.json',JSON.stringify(reports,null,2));
  // Keep successful evidence even if a Windows browser shutdown stalls.
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
