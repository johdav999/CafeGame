const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
(async()=>{
 const owned=process.env.CAFE_GARDEN_OWNED==='1';
 let server;
 if(process.env.CAFE_START_SERVER==='1'){
  const port='4187';process.env.CAFE_URL=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
  let ready=false;for(let attempt=0;attempt<30&&!ready;attempt++){
   try{ready=(await fetch(process.env.CAFE_URL)).ok;}catch{}
   if(!ready)await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!ready){server.kill();throw Error('Local garden preview server did not start');}
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report=[];await fs.mkdir('build/evidence/garden-browser',{recursive:true});
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:90000});
  await wait(()=>window.cafeAssetsReady&&window.cafeGardenState&&window.cafeLayoutState);
  assert.equal(await page.evaluate(()=>cafeGardenState.owned),owned);
  const load=async(name,accepted)=>{
   const bytes=await fs.readFile(`build/evidence/garden-g1/${name}`);
   await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading garden test';Module._cafe_command(4);},bytes.toString('base64'));
   await wait(()=>document.getElementById('save-status').textContent!=='Loading garden test');
   const message=await page.locator('#save-status').textContent();
   assert.equal(message.startsWith('Saved shift restored'),accepted,message);
   // Loading never overwrites the stored slot, including a successful migration.
   assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),bytes.toString('base64'));
  };
  await load('base-migrated.save',true);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
  if(!owned){
   const before=await page.evaluate(()=>({wallet:cafeEconomyState.cash,layout:cafeLayoutState.tables,garden:cafeGardenState}));
   await load('garden-selected.save',false);
   assert.match(await page.locator('#save-status').textContent(),/requires installed and owned/);
   assert.deepEqual(await page.evaluate(()=>({wallet:cafeEconomyState.cash,layout:cafeLayoutState.tables,garden:cafeGardenState})),before);
   await page.evaluate(()=>Module._cafe_command(42));await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>cafeGardenState.open),false);
  }else{
   await load('garden-selected.save',true);
   await page.locator('#menu-tab').click();await page.locator('#garden-open').click();await wait(()=>cafeGardenState.open);
   await page.locator('#garden-workshop').click();await wait(()=>cafeLayoutState.closed&&cafeGardenState.open&&!cafeCampaignState.enabled);
   await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!cafeState.paused);
   await page.locator('#build-tab').click();
   await page.waitForSelector('[data-place-item="101"]');
   await page.locator('[data-place-item="101"]').press('Enter');
   const point=await page.evaluate(()=>{const p=Module._malloc(8),canvas=document.getElementById('viewport'),r=canvas.getBoundingClientRect();Module._cafe_floor_project(8.15,-2.35,r.width/r.height,p);const result={x:r.left+HEAPF32[p/4]*r.width,y:r.top+HEAPF32[p/4+1]*r.height};Module._free(p);return result;});
   await page.mouse.click(point.x,point.y);
   await wait(()=>cafeLayoutState.tables.some(p=>p.id===101));
   await page.locator('#build-coordinate-editor summary').click();
   await page.locator('#layout-id').selectOption('102');
   await page.locator('#layout-apply').click();await wait(()=>cafeGardenState.tables===2);
   const cash=await page.evaluate(()=>cafeEconomyState.cash);
   for(const r of [1,2,3,0]){
    await page.locator('#layout-id').selectOption('101');await page.locator('#layout-rotation').selectOption(String(r));
    assert.equal(await page.locator('#layout-apply').isEnabled(),true,JSON.stringify(await page.evaluate(()=>({fields:['id','x','z','rotation'].map(n=>({value:document.getElementById('layout-'+n).value,valid:document.getElementById('layout-'+n).validity.valid})),preview:document.getElementById('layout-preview').textContent,layout:cafeLayoutState,paused:cafeState.paused}))));
    await page.locator('#layout-apply').click();await wait(r=>cafeLayoutState.tables.find(p=>p.id===101)?.rotation===r,r);
   }
   await page.evaluate(()=>Module._cafe_layout(0,101,6,-3,0));
   await wait(()=>document.getElementById('layout-status').textContent.includes('clear'));
   assert.equal(await page.evaluate(()=>cafeEconomyState.cash),cash);
   assert.equal(await page.evaluate(()=>cafeLayoutState.tables.find(p=>p.id===101).x),26);
   await page.evaluate(()=>Module._cafe_command(3));await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
   await page.locator('#layout-sell').click();await wait(()=>cafeGardenState.tables===1);
   await page.evaluate(()=>Module._cafe_command(4));await wait(()=>cafeGardenState.tables===2);
   // Exercise actual engine navigation through the doorway with an idle worker.
   const selected=await page.evaluate(()=>{
    const c=document.getElementById('viewport'),r=c.getBoundingClientRect(),a=cafeStaffAnimations[0],p=Module._malloc(8);
    Module._cafe_floor_project(a.x,a.z,r.width/r.height,p);const x=HEAPF32[p/4],y=HEAPF32[p/4+1];Module._free(p);
    for(let dy=.01;dy<.22;dy+=.005)for(const dx of [0,-.005,.005]){const id=Module._cafe_staff_pick(x+dx,y-dy,r.width/r.height,1);if(id)return id;}return 0;
   });assert.ok(selected,'Select an idle worker in the rendered scene');
   await page.evaluate(()=>Module._cafe_staff_move(480+8*12+9));
   await wait(()=>cafeStaffAnimations.some(a=>a.x>10.5));
   await page.evaluate(()=>Module._cafe_camera(0,0,0));
   await page.screenshot({path:`build/evidence/garden-browser/${backend}-courtyard.png`});
   await load('garden-courtyard.save',true);assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(p=>p.id<=4||p.id===101||p.id===102).length),6);
  }
  assert.deepEqual(errors,[]);report.push({backend,owned,passed:true,renderer:await page.locator('#status').textContent()});await page.close();
 }
 if(process.env.CAFE_BASE_REGRESSION==='1')await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['tools/browser-smoke.cjs'],{env:process.env,stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Base browser smoke exited ${code}`)));
 });
 }finally{await browser.close();server?.kill();}
 await fs.writeFile(`build/evidence/garden-browser/${owned?'owned':'unavailable'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
