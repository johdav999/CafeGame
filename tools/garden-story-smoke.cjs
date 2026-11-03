const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
(async()=>{
 const directory='build/evidence/garden-story-browser';await fs.mkdir(directory,{recursive:true});let server,browser;const reports=[];
 try{
  const url=process.env.CAFE_URL||'http://127.0.0.1:4194';
  if(process.env.CAFE_START_SERVER==='1'){server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:'4194'},stdio:'ignore',windowsHide:true});let ready=false;for(let n=0;n<40&&!ready;n++){try{ready=(await fetch(url)).ok;}catch{}if(!ready)await new Promise(r=>setTimeout(r,200));}assert.ok(ready);}
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-proxy-server','--enable-unsafe-swiftshader',...(process.env.CAFE_SOFTWARE_RENDERING==='0'?[]:['--use-angle=swiftshader'])]});
  for(const backend of (process.env.CAFE_GARDEN_BACKEND?[process.env.CAFE_GARDEN_BACKEND]:['webgl2','automatic'])){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],stages=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
   await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.25,configurable:true}));
   const wait=(fn,arg,timeout=240000)=>page.waitForFunction(fn,arg,{timeout,polling:100}).catch(async e=>{console.error(JSON.stringify(await page.evaluate(()=>({error:window.cafeHostError,campaign:window.cafeCampaignState,menu:window.cafeMenuState,staff:window.cafeStaffState,save:document.getElementById('save-status').textContent}))));await page.screenshot({path:`${directory}/${backend}-failure.png`});const saved=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));if(saved)await fs.writeFile(`${directory}/${backend}-interrupted.save`,Buffer.from(saved,'base64'));throw e;});
   const click=async selector=>{if(await page.locator('#achievement-dialog[open]').count())await page.keyboard.press('Escape');return page.evaluate(selector=>{const b=document.querySelector(selector);if(!b||b.disabled)throw Error(`Control unavailable: ${selector}`);b.click();},selector);};
   const select=(id,value)=>page.evaluate(({id,value})=>{const field=document.getElementById(id);field.value=String(value);field.dispatchEvent(new Event('change',{bubbles:true}));},{id,value});
   await page.goto(`${url}/?backend=${backend}`);await wait(()=>window.cafeAssetsReady&&window.cafeCampaignState?.garden);
   const graphics=await page.evaluate(()=>{const canvas=document.getElementById('viewport'),gl=canvas.getContext('webgl2');if(!gl)return {surface:[canvas.width,canvas.height],adapter:'WebGPU adapter not inspected'};const ext=gl.getExtension('WEBGL_debug_renderer_info');return {surface:[canvas.width,canvas.height],adapter:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
   const load=async bytes=>{await page.evaluate(bytes=>{localStorage.setItem('cafegame.shift.v1',bytes);document.getElementById('save-status').textContent='Loading story';Module._cafe_command(4);},Buffer.from(bytes).toString('base64'));await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));};
   if(process.env.CAFE_GARDEN_OWNED==='0'){
    assert.equal(await page.evaluate(()=>cafeGardenState.owned),false);await click('[data-command="2"]');await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({cash:cafeEconomyState.cash,served:cafeState.served,tickets:cafeMenuState.tickets})),bytes=(await fs.readFile('build/evidence/garden-g5/party-complete.save')).toString('base64');
    await page.evaluate(bytes=>{localStorage.setItem('cafegame.shift.v1',bytes);Module._cafe_command(4);},bytes);await wait(()=>document.getElementById('save-status').textContent.includes('requires installed and owned'));
    assert.deepEqual(await page.evaluate(()=>({cash:cafeEconomyState.cash,served:cafeState.served,tickets:cafeMenuState.tickets})),before);assert.equal(await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1')),bytes);assert.deepEqual(errors,[]);reports.push({backend,unavailable:true,preserved:true,errors});await page.close();continue;
   }
   assert.equal(await page.evaluate(()=>cafeGardenState.owned),true);
   // Continue only normal period breaks; preparation and summary stay manual.
   await page.evaluate(()=>{window.g5Travel={doorway:false,outdoor:false,cold:false};setInterval(()=>{if(window.cafeClockState?.stage===2&&window.cafeCampaignState?.phase===1&&!window.cafeState?.paused){const b=document.getElementById('period-continue');if(b&&!b.disabled)b.click();}for(const a of window.cafeStaffAnimations||[]){if(a.x>5.6&&a.x<6.5)g5Travel.doorway=true;if(a.x>6.5)g5Travel.outdoor=true;}if(window.cafeStaffState?.staff.some(s=>s.reason.includes('Cold-preparation')))g5Travel.cold=true;},200);});
   const snapshot=async stage=>{
    await click('[data-command="2"]');await wait(()=>cafeState.paused);
    const before=await page.evaluate(()=>({cash:cafeEconomyState.cash,served:cafeState.served,garden:cafeCampaignState.garden,tickets:cafeMenuState.tickets}));
    await page.evaluate(()=>{document.getElementById('save-status').textContent='Saving story';Module._cafe_command(3);});await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
    const bytes=await page.evaluate(()=>localStorage.getItem('cafegame.shift.v1'));await load(Buffer.from(bytes,'base64'));
    await fs.writeFile(`${directory}/${backend}-last.save`,Buffer.from(bytes,'base64'));
    assert.deepEqual(await page.evaluate(()=>({cash:cafeEconomyState.cash,served:cafeState.served,garden:cafeCampaignState.garden,tickets:cafeMenuState.tickets})),before);
    await click('[data-command="2"]');await wait(()=>!cafeState.paused);stages.push(stage);console.log(`${backend}: ${stage}`);return bytes;
   };
   const open=async()=>{await wait(()=>cafeCampaignState.canOpen);await click('[data-campaign="1"]');await wait(()=>cafeCampaignState.phase===1);if(await page.evaluate(()=>cafeDemandState.automatic)){await click('[data-command="17"]');await wait(()=>!cafeDemandState.automatic);}};
   const close=async()=>{await click('[data-campaign="2"]');await wait(()=>cafeCampaignState.phase===3);};
   const next=async()=>{await wait(()=>cafeCampaignState.canNext);await click('[data-campaign="3"]');await wait(()=>cafeCampaignState.phase===0);};
   const ticket=async(first,profile=1,seating=-1)=>{
    const served=await page.evaluate(()=>cafeState.served);await select('guest-profile',profile);await select('guest-first',first);await select('guest-second',-1);await select('guest-seating',seating);
    await wait(()=>!document.querySelector('[data-command="6"]').disabled);await click('[data-command="6"]');
    await wait(served=>cafeState.served>served||cafeMenuState.tickets.some(t=>!t.paid),served);
    const id=await page.evaluate(()=>cafeMenuState.tickets.find(t=>!t.paid).guest);await service(id);await wait(served=>cafeState.served===served+1,served);
    await wait(()=>cafeMenuState.tickets.length===0);return id;
   };
   const service=async id=>{
    const table=await page.evaluate(id=>cafeMenuState.tickets.find(t=>t.guest===id).table,id);
    if(table){await wait(id=>cafeMenuState.tickets.find(t=>t.guest===id)?.service==='Waiting to order',id);await click(`.customer-badge[data-guest="${id}"]`);await wait(id=>cafeMenuState.tickets.find(t=>t.guest===id)?.taken,id);await wait(id=>{const b=document.querySelector(`.prepare-order[data-guest="${id}"]`);return b&&!b.disabled;},id);await click(`.prepare-order[data-guest="${id}"]`);}
    else {await wait(()=>!document.getElementById('next-action').disabled);await click('#next-action');}
    await wait(id=>cafeMenuState.tickets.find(t=>t.guest===id)?.service==='Ready to serve',id);await wait(id=>{const b=document.querySelector(`.serve-order[data-guest="${id}"]`);return b&&!b.disabled;},id);await click(`.serve-order[data-guest="${id}"]`);
   };
   if(process.env.CAFE_GARDEN_INSPECT_COMPLETE==='1'){
    await load(await fs.readFile(directory+'/complete.save'));if(await page.locator('#achievement-dialog[open]').count())await page.keyboard.press('Escape');await wait(()=>!document.getElementById('achievement-dialog').open);await click('[data-mode="menu"]');await page.evaluate(()=>document.getElementById('garden-restoration').scrollIntoView());
    assert.match(await page.locator('#garden-story-status').textContent(),/restoration complete/i);await page.screenshot({path:directory+'/'+backend+'-complete.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:directory+'/'+backend+'-narrow.png'});assert.deepEqual(errors,[]);reports.push({backend,graphics,path:'completed played save, modal acknowledged, desktop and narrow layout',errors});await page.close();continue;
   }
   if(backend==='automatic'){
    await load(await fs.readFile('build/evidence/garden-g5/party-late.save'));await wait(()=>cafeCampaignState.phase===3);assert.equal(await page.evaluate(()=>cafeCampaignState.garden.chapters),31);await snapshot('late party completion and restore');await page.screenshot({path:`${directory}/automatic-complete.png`});assert.deepEqual(errors,[]);reports.push({backend,graphics,renderer:await page.locator('#status').textContent(),path:'validated native late-party fixture',stages,errors});await page.close();continue;
   }
   await load(await fs.readFile('build/evidence/garden-g5/eligible-base.save'));const base=await page.evaluate(()=>({day:cafeCampaignState.day,goals:cafeCampaignState.goals,regulars:cafeCampaignState.regulars}));
   await click('#garden-story-start');await wait(()=>cafeCampaignState.garden.started);assert.deepEqual(await page.evaluate(()=>({day:cafeCampaignState.day,goals:cafeCampaignState.goals,regulars:cafeCampaignState.regulars})),base);
   await click('#garden-open');await wait(()=>cafeCampaignState.garden.chapters===1);await select('layout-id',101);await wait(()=>!document.getElementById('layout-apply').disabled);await click('#layout-apply');await wait(()=>cafeGardenState.tables===1);await snapshot('courtyard restored');
   await open();await ticket(0,0,1);await wait(()=>cafeCampaignState.garden.chapters===3);await snapshot('first outdoor delivery');await close();await next();
   await select('layout-id',30);await wait(()=>!document.getElementById('layout-apply').disabled);await click('#layout-apply');await wait(()=>cafeEquipmentState.catalog[7].owned);
   const replenish=async(n,target)=>{await select('supply-ingredient',n);for(let pass=0;pass<12;pass++){await wait(n=>!cafeSupplyState.pending&&!cafeMenuState.ingredients[n].restocking,n);const i=await page.evaluate(n=>cafeMenuState.ingredients[n],n);if(i.stock>=target)return;if(i.stored){const expected=Math.min(target,i.stock+Math.min(4,i.stored));await wait(()=>!document.getElementById('ingredient-restock').disabled);await click('#ingredient-restock');await wait(({n,expected})=>!cafeMenuState.ingredients[n].restocking&&cafeMenuState.ingredients[n].stock>=expected,{n,expected});}else{await wait(()=>!document.getElementById('ingredient-order').disabled);await click('#ingredient-order');await wait(()=>cafeSupplyState.pending);await wait(()=>!cafeSupplyState.pending);}}throw Error('Could not restock '+n);};
   for(const n of [5,6,7])await replenish(n,8);await open();for(const p of [5,6,7])await ticket(p);await wait(()=>cafeCampaignState.garden.chapters===7);await snapshot('summer chapter and earned finish');
   for(let n=0;n<3;n++){await wait(n=>{const b=document.querySelector(`[data-garden-regular="${n}"]`);return b&&!b.disabled;},n);await click(`[data-garden-regular="${n}"]`);await wait(n=>cafeMenuState.tickets.some(t=>t.name===['Astrid','Otto','Liv'][n]),n);const id=await page.evaluate(n=>cafeMenuState.tickets.find(t=>t.name===['Astrid','Otto','Liv'][n]).guest,n);await service(id);await wait(n=>cafeCampaignState.garden.metMask&(1<<n),n);await snapshot(`garden regular ${n} served`);await wait(()=>cafeMenuState.tickets.length===0);}
   await wait(()=>cafeCampaignState.garden.chapters===15);await close();await next();await select('finish-select',3);await wait(()=>cafeEquipmentState.finish===3);
   await click('#staff-hire');await wait(()=>cafeStaffState.staff.length===2);
   for(const [n,count] of [[0,6],[1,6],[5,6],[6,3],[7,3]])await replenish(n,count);
   await wait(()=>!document.getElementById('garden-party-prepare').disabled);await click('#garden-party-prepare');await wait(()=>cafeCampaignState.garden.party===1);await snapshot('party preparation');await open();await close();await wait(()=>cafeCampaignState.garden.party===3);await snapshot('party failure');await next();
   await wait(()=>!document.getElementById('garden-party-prepare').disabled);await click('#garden-party-prepare');await wait(()=>cafeCampaignState.garden.party===1);await open();
   for(let n=0;n<6;n++)await ticket(6);await snapshot('six paid party tickets');
   console.log('Waiting for the ordinary full party clock; period breaks use the normal Continue control.');await wait(()=>cafeCampaignState.phase===3,undefined,1200000);
   assert.equal(await page.evaluate(()=>cafeCampaignState.garden.chapters),31);assert.equal(await page.evaluate(()=>cafeCampaignState.garden.rewards),5000);const complete=await snapshot('party complete');await fs.writeFile(`${directory}/complete.save`,Buffer.from(complete,'base64'));
   const travel=await page.evaluate(()=>g5Travel);assert.equal(travel.doorway,true);assert.equal(travel.outdoor,true);assert.equal(travel.cold,true);
   await page.evaluate(()=>document.querySelector('[data-mode="menu"]').click());await page.evaluate(()=>document.getElementById('garden-restoration').scrollIntoView());await page.screenshot({path:`${directory}/webgl2-complete.png`});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${directory}/webgl2-narrow.png`});
   await click('[data-campaign="4"]');await wait(()=>cafeCampaignState.phase===0);assert.equal(await page.evaluate(()=>cafeCampaignState.garden.chapters),15);assert.equal(await page.evaluate(()=>cafeCampaignState.garden.rewards),4000);
   await load(Buffer.from(complete,'base64'));await next();assert.equal(await page.evaluate(()=>cafeCampaignState.garden.chapters),31);await snapshot('continued play');assert.deepEqual(errors,[]);
   reports.push({backend,graphics,renderer:await page.locator('#status').textContent(),path:'migrated base through all chapters and full party clock with scene travel',stages,travel,errors});await page.close();
  }
  await fs.writeFile(`${directory}/${process.env.CAFE_GARDEN_OWNED==='0'?'unavailable':process.env.CAFE_GARDEN_INSPECT_COMPLETE==='1'?'layout':'report'}.json`,JSON.stringify(reports,null,2));
 }finally{await browser?.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
