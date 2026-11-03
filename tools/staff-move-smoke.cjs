const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const executablePath=process.env.BROWSER_EXECUTABLE||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE_RENDERING==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000}).catch(async e=>{
   console.error(await page.evaluate(()=>({error:window.cafeHostError,staff:window.cafeStaffAnimations,state:window.cafeState,layout:window.cafeLayoutState,message:document.getElementById('staff-move-message')?.textContent})));
   await page.screenshot({path:`build/evidence/staff-move-failure-${backend}.png`});throw e;
  });
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>10);
  await page.evaluate(()=>Module._cafe_scenario(4));
  await wait(()=>window.cafeLayoutState.closed && window.cafeStaffAnimations?.length);
  console.log(`${backend}: scene ready`);
  const pick=()=>page.evaluate(()=>{
   const c=document.getElementById('viewport'),r=c.getBoundingClientRect();
   const a=window.cafeStaffAnimations[0],p=Module._malloc(8);
   Module._cafe_floor_project(a.x,a.z,r.width/r.height,p);
   const foot={x:r.left+HEAPF32[p/4]*r.width,y:r.top+HEAPF32[p/4+1]*r.height};Module._free(p);
   for(let dy=-120;dy<=0;dy+=8)for(let dx=-32;dx<=32;dx+=8){
    const px=foot.x+dx,py=foot.y+dy,x=(px-r.left)/r.width,y=(py-r.top)/r.height;
    if(document.elementFromPoint(px,py)===c && Module._cafe_staff_pick(x,y,r.width/r.height,0))return {x:px,y:py};
   }
  });
  const staff=await pick();assert.ok(staff,'Staff can be picked on the visible mesh');
  console.log(`${backend}: found staff`);
  await page.mouse.click(staff.x,staff.y);
  await wait(()=>!document.getElementById('staff-move-control').hidden);
  // Project a clear dining-floor cell using the actual camera, then click it.
  const destination=await page.evaluate(()=>{
   const c=document.getElementById('viewport'),r=c.getBoundingClientRect(),p=Module._malloc(8);
   try{
    Module._cafe_floor_project(.25,2.25,r.width/r.height,p);
    return {x:r.left+HEAPF32[p/4]*r.width,y:r.top+HEAPF32[p/4+1]*r.height};
   }finally{Module._free(p);}
  });
  await page.mouse.click(destination.x,destination.y);
  await wait(()=>document.getElementById('staff-move-message').textContent.startsWith('Walking'));
  console.log(`${backend}: walking`);
  await wait(()=>Math.abs(window.cafeStaffAnimations[0].z+3.4)>.5);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  const paused=await page.evaluate(()=>({x:window.cafeStaffAnimations[0].x,z:window.cafeStaffAnimations[0].z}));
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>({x:window.cafeStaffAnimations[0].x,z:window.cafeStaffAnimations[0].z})),paused);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!window.cafeState.paused);
  await wait(()=>Math.hypot(window.cafeStaffAnimations[0].x-.25,window.cafeStaffAnimations[0].z-2.25)<.2);
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(()=>Math.hypot(window.cafeStaffAnimations[0].x-.25,window.cafeStaffAnimations[0].z-2.25)<.2),'Staff stays at destination');
  await page.evaluate(()=>Module._cafe_staff_move(5*24+12));
  await wait(()=>document.getElementById('staff-move-message').textContent.startsWith('Choose'));
  await page.locator('#viewport').focus();await page.keyboard.press('Escape');
  await wait(()=>document.getElementById('staff-move-control').hidden);
  await page.mouse.click((await pick()).x,(await pick()).y);
  await page.locator('#build-tab').click();await wait(()=>document.getElementById('staff-move-control').hidden);
  await page.locator('#serve-tab').click();
  await page.evaluate(()=>{Module._cafe_command(15);Module._cafe_guest(1,0,-1);Module._cafe_command(33);});
  await wait(()=>window.cafeState.ready);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`build/evidence/staff-move-${backend}.png`});
  console.log(`${backend}: visible selection, floor click, obstacle rejection, arrival, idle position, pause, deselect and service handoff passed`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
