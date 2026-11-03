// Review all authored character textures under unchanged cafe lighting.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const label=process.env.CAFE_COLOR_LABEL||'after',dir='build/evidence/character-colors';
 await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of (process.env.CAFE_BACKENDS||'webgl2,automatic').split(',')){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.75}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:120000});
  await page.goto(`http://127.0.0.1:4173/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  await wait(()=>window.cafeGuestAnimations?.length===3);
  const roster=await page.evaluate(()=>window.cafeGuestAnimations.map(g=>g.model));assert.deepEqual(roster,[1,12,13]);
  await page.evaluate(()=>{Module._cafe_command(2);Module._cafe_camera(0,0,0);Module._cafe_camera(3,-3.8,0);});
  await wait(()=>window.cafeState.paused);
  for(const variant of ['roster','oat']){
   if(variant==='oat'){
    const accepted=await page.evaluate(async()=>{const b=new Uint8Array(await(await fetch('assets/models/Guest-oat-animated.glb')).arrayBuffer()),p=Module._malloc(b.length);try{HEAPU8.set(b,p);return Module._cafe_model(1,p,b.length);}finally{Module._free(p);}});assert.equal(accepted,1);
   }
  for(const [name,yaw,panX,panZ,zoom] of [['front',-.3,1,-1,-3.8],['side',.7,0,-2,-3.8],['overview',0,0,0,0]]){
   const frame=await page.evaluate(([yaw,x,z,zoom])=>{Module._cafe_camera(0,0,0);Module._cafe_camera(1,yaw,0);Module._cafe_camera(2,x,z);Module._cafe_camera(3,zoom,0);return window.cafeRenderMeasurements.frames;},[yaw,panX,panZ,zoom]);
   await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>n+3,frame);
   await page.screenshot({path:`${dir}/${label}-${backend}-${variant}-${name}.png`});
  }
  }
  const paused=await page.evaluate(()=>({staff:window.cafeStaffAnimations,guests:window.cafeGuestAnimations}));
  assert.ok(paused.staff.length);assert.deepEqual(errors,[]);
  reports.push({backend,renderer:await page.locator('#status').textContent(),roster,oatReplacement:true,paused,errors});console.log(`${label} ${backend}: character roster rendered`);await page.close();
 }}finally{await fs.writeFile(`${dir}/${label}.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 console.log(JSON.stringify(reports,null,2));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
