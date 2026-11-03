const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
(async()=>{
 await fs.mkdir('build/evidence/garden-service-browser',{recursive:true});
 let server,browser;const reports=[];
 try{
  if(process.env.CAFE_START_SERVER==='1'){
   process.env.CAFE_URL='http://127.0.0.1:4188';
   server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:'4188'},stdio:'ignore',windowsHide:true});
   let ready=false;for(let n=0;n<30&&!ready;n++){try{ready=(await fetch(process.env.CAFE_URL)).ok;}catch{}if(!ready)await new Promise(r=>setTimeout(r,200));}
   assert.ok(ready,'Temporary preview server must start');
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-proxy-server',
   ...(process.env.CAFE_SOFTWARE_RENDERING==='0'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
  for(const backend of ['webgl2','automatic']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],stages=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
   const wait=(fn,arg,timeout=180000)=>page.waitForFunction(fn,arg,{timeout,polling:50}).catch(async e=>{
    console.error(JSON.stringify(await page.evaluate(()=>({tickets:window.cafeMenuState?.tickets,staff:window.cafeStaffState,game:window.cafeState,campaign:window.cafeCampaignState,error:window.cafeHostError,save:document.getElementById('save-status')?.textContent}))));
    await page.screenshot({path:`build/evidence/garden-service-browser/${backend}-failure.png`});throw e;
   });
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
   await wait(()=>window.cafeAssetsReady&&window.cafeGardenState);
   const owned=process.env.CAFE_GARDEN_OWNED!=='0';
   assert.equal(await page.evaluate(()=>cafeGardenState.owned),owned,'Choose the matching ownership fixture build');
   const opening=await fs.readFile('build/evidence/garden-g3/opening.save');
   if(!owned){
    await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({served:cafeState.served,cash:cafeEconomyState.cash,tickets:cafeMenuState.tickets}));
    await page.evaluate(bytes=>{localStorage.setItem('cafegame.shift.v1',bytes);document.getElementById('save-status').textContent='Loading G3';Module._cafe_command(4);},opening.toString('base64'));
    await wait(()=>document.getElementById('save-status').textContent.includes('requires installed and owned'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),opening.toString('base64'));
    assert.deepEqual(await page.evaluate(()=>({served:cafeState.served,cash:cafeEconomyState.cash,tickets:cafeMenuState.tickets})),before);
    assert.deepEqual(errors,[]);reports.push({backend,owned:false,preserved:true,errors});await page.close();continue;
   }
   await page.evaluate(bytes=>{localStorage.setItem('cafegame.shift.v1',bytes);Module._cafe_command(4);},opening.toString('base64'));
   await wait(()=>cafeMenuState.tickets.length===4&&cafeStaffState.staff.length===3);
   await page.evaluate(()=>{
    window.g3TravelEvidence={maxConcurrent:0,doorway:false,outdoor:false};
    function sample(){const e=window.g3TravelEvidence;e.maxConcurrent=Math.max(e.maxConcurrent,(window.cafeStaffState?.staff||[]).filter(s=>s.task).length);
     for(const a of window.cafeStaffAnimations||[]){if(a.x>6.3)e.outdoor=true;if(a.x>5.6&&a.x<6.5&&a.z> -1.2&&a.z< -.3)e.doorway=true;}
     requestAnimationFrame(sample);
    }requestAnimationFrame(sample);
   });
   const snapshot=async stage=>{
    await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({served:cafeState.served,sales:cafeEconomyState.sales,tickets:cafeMenuState.tickets.map(t=>[t.guest,t.seat,t.destination,t.seatingPreference,t.paid,t.taken,t.service])}));
    await page.evaluate(()=>{document.getElementById('save-status').textContent='Saving G3';Module._cafe_command(3);});
    await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
    const bytes=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));
    await page.evaluate(()=>{document.getElementById('save-status').textContent='Restoring G3';Module._cafe_command(4);});
    await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),bytes);
    assert.deepEqual(await page.evaluate(()=>({served:cafeState.served,sales:cafeEconomyState.sales,tickets:cafeMenuState.tickets.map(t=>[t.guest,t.seat,t.destination,t.seatingPreference,t.paid,t.taken,t.service])})),before);
    await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>cafeState.served),before.served);
    stages.push(stage);await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!cafeState.paused);
   };
   await wait(()=>cafeGuestAnimations.some(g=>g.clip==='Walking'&&g.x>5.6&&g.x<6.5));
   await snapshot('guest doorway travel');
   await wait(()=>cafeMenuState.tickets.every(t=>t.service==='Waiting to order'));
   const ids=await page.evaluate(()=>cafeMenuState.tickets.map(t=>t.guest));
   assert.deepEqual(await page.evaluate(()=>cafeMenuState.tickets.map(t=>t.seat)),[0,4,1,5]);
   assert.equal(await page.evaluate(()=>cafeGuestAnimations.filter(g=>g.clip==='Seated'&&g.x>6).length),2);
   assert.match(await page.locator('#order-tickets').innerText(),/Prefers outdoors.*Outdoor table/);
   for(const id of ids)await page.locator(`.customer-badge[data-guest="${id}"]`).click();
   await wait(()=>g3TravelEvidence.doorway&&cafeStaffState.staff.some(s=>s.reason.includes('Outdoor')));
   await snapshot('staff doorway travel');
   await wait(()=>cafeMenuState.tickets.every(t=>t.taken));
   for(const [index,id] of ids.entries()){
    await wait(id=>{const b=document.querySelector(`.prepare-order[data-guest="${id}"]`);return b&&!b.disabled;},id);
    await page.locator(`.prepare-order[data-guest="${id}"]`).click();
    await wait(id=>cafeMenuState.tickets.find(t=>t.guest===id)?.service==='Ready to serve',id);
    if(index===1)await snapshot('prepared outdoor ticket');
    await page.locator(`.serve-order[data-guest="${id}"]`).click();
    if(index===1){await wait(()=>cafeStaffState.staff.some(s=>s.task==='cafe:deliver'&&s.reason.includes('Outdoor')));await snapshot('outdoor delivery');}
   }
   await wait(()=>cafeState.served===4);
   assert.equal(await page.evaluate(()=>cafeEconomyState.sales),1700);
   assert.equal(await page.evaluate(()=>cafeMenuState.tickets.filter(t=>t.paid).length),4);
   await snapshot('outdoor dining');
   await page.screenshot({path:`build/evidence/garden-service-browser/${backend}-dining.png`});
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`build/evidence/garden-service-browser/${backend}-narrow.png`});await page.setViewportSize({width:1440,height:1000});
   await page.evaluate(()=>Module._cafe_campaign(2));await wait(()=>cafeCampaignState.phase===2);
   await wait(()=>cafeStaffState.staff.some(s=>s.task==='cafe:clean'&&s.reason.includes('Outdoor')));
   await snapshot('outdoor cleaning');
   await wait(()=>cafeCampaignState.phase===3);
   assert.equal(await page.evaluate(()=>cafeMenuState.tickets.length),0);
   assert.equal(await page.evaluate(()=>cafeState.served),4);assert.equal(await page.evaluate(()=>cafeEconomyState.sales),1700);
   const evidence=await page.evaluate(()=>g3TravelEvidence);assert.equal(evidence.maxConcurrent,3);assert.equal(evidence.outdoor,true);assert.equal(evidence.doorway,true);
   await snapshot('closing summary');
   await page.evaluate(()=>Module._cafe_campaign(4));await wait(()=>cafeCampaignState.phase===0);
   assert.equal(await page.evaluate(()=>cafeState.served),0);assert.equal(await page.evaluate(()=>cafeGardenState.tables),2);
   assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),stages,...evidence,served:4,sales:1700,errors});
   console.log(`${backend}: outdoor service, restore, closing and restart passed`);await page.close();
  }
  await fs.writeFile(`build/evidence/garden-service-browser/${process.env.CAFE_GARDEN_OWNED==='0'?'unavailable':'report'}.json`,JSON.stringify(reports,null,2));
 }finally{await browser?.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
