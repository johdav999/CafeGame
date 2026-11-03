const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const evidence=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1030,height:764}}),errors=[];
  // Keep software rendering inexpensive so fixed movement ticks can keep up.
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.25,configurable:true}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/models/**',r=>/\/(Barista-animated|cafe-table|cafe-chair)\.glb$/.test(r.request().url())?r.continue():r.abort());
  const wait=async(fn,arg)=>{try{return await page.waitForFunction(fn,arg,{timeout:90000,polling:20});}catch(e){console.error(await page.evaluate(()=>({assets:window.cafeAssetState,staff:window.cafeStaffAnimations,hostError:window.cafeHostError,status:document.querySelector('#status')?.textContent,state:window.cafeState,layout:window.cafeLayoutState,workflow:window.cafeWorkflowState,occupancy:window.cafeOccupancyState})));throw e;}};
  const command=n=>page.evaluate(n=>Module._cafe_command(n),n);
  await page.goto(`http://localhost:4173/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady&&window.cafeStaffAnimations?.length);
  for(const rotation of [0,1,2,3]){
   await page.evaluate(()=>Module._cafe_scenario(4));await wait(()=>window.cafeLayoutState?.editable);
   // One table in a non-default location makes the cleaned table unambiguous.
   await page.evaluate(()=>Module._cafe_layout(1,2,0,0,0));await wait(()=>cafeLayoutState.tables.filter(t=>t.id<=4).length===1);
   await page.evaluate(r=>Module._cafe_layout(0,1,-2,-.5,r),rotation);
   await wait(r=>cafeLayoutState.tables.find(t=>t.id===1).rotation===r,rotation);
   await command(15);await wait(()=>!cafeLayoutState.closed);
   await page.evaluate(()=>Module._cafe_guest(2,0,-1));await wait(()=>cafeMenuState.tickets.length===1);
   await command(0);await wait(()=>cafeState.ready&&cafeWorkflowState.handoverReady);
   await command(1);await wait(()=>cafeOccupancyState.dining===1);
   await wait(()=>cafeWorkflowState.key==='cafe:clean'&&cafeWorkflowState.state===2);
   await command(2);await wait(()=>cafeState.paused);
   const sample=await page.evaluate(()=>({staff:cafeStaffAnimations[0],table:cafeLayoutState.tables.find(t=>t.id===1),work:cafeWorkflowState}));
   const t=sample.table,center={x:-6+(t.x+(rotation%2?8:4)/2)*.5,z:-5+(t.z+(rotation%2?4:8)/2)*.5};
   let x=sample.staff.x-center.x,z=sample.staff.z-center.z;
   for(let r=0;r<rotation;r++){const old=x;x=z;z=-old;}
   assert.ok(Math.abs(Math.abs(x)-1.25)<.2,`Cleaner must stand beside the tabletop: ${JSON.stringify({x,z})}`);
   assert.ok(Math.abs(z)<.45,'Cleaner must not stand at a chair end');
   const expected=Math.atan2(center.x-sample.staff.x,center.z-sample.staff.z);
   assert.ok(Math.cos(sample.staff.yaw-expected)>.95,'Cleaner must face the table');
   if(rotation===0){await page.mouse.move(1,1);await page.screenshot({path:`build/evidence/table-cleaning-${backend}.png`});}
   evidence.push({backend,rotation,center,local:{x,z},...sample});
   console.log(`${backend}: rotation ${rotation}, cleaner at table side (${x.toFixed(2)}, ${z.toFixed(2)})`);
   await command(2);await wait(()=>!cafeState.paused);
   await wait(()=>cafeWorkflowState.dirty===0&&cafeOccupancyState.guests===0);
  }
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await fs.writeFile('build/evidence/table-cleaning.json',JSON.stringify(evidence,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 console.log(`Passed ${evidence.length} cleanup approaches: moved table, all rotations, both backends.`);
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
