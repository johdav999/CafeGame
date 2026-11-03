const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('build/evidence',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 const evidence={date:new Date().toISOString(),browser:browser.version(),forcedFallback:process.env.CAFE_DISABLE_WEBGPU==='1',softwareRequested:process.env.CAFE_SOFTWARE==='1',runs:[]};
 try{for(const backend of (process.env.CAFE_BACKENDS?.split(',')||['webgl2','automatic'])){
  const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Reduce only the 3D render resolution on slow software adapters; CSS layout
  // and input coordinates remain at the full desktop/mobile viewport sizes.
  if(process.env.CAFE_RENDER_SCALE){const scale=Number(process.env.CAFE_RENDER_SCALE);assert.ok(scale>=.25 && scale<=2);await page.addInitScript(s=>Object.defineProperty(window,'devicePixelRatio',{value:s,configurable:true}),scale);evidence.renderScale=scale;}
  if(process.env.CAFE_DISABLE_WEBGPU==='1')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  const cmd=async n=>page.locator(`[data-command="${n}"]`).click(),wait=async fn=>page.waitForFunction(fn,null,{timeout:60000});
  const mode=async name=>page.getByRole('tab',{name:new RegExp('^'+name)}).click();
  try{
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
   await wait(()=>window.cafeAssetsReady && window.cafeInspectorState && Module._cafe_viewport);
   await page.getByRole('button',{name:'Begin guided shift',exact:true}).click();await wait(()=>window.cafeCampaignState.enabled);
   await page.locator('#next-action').click();await wait(()=>window.cafeCampaignState.phase===1);
   await page.locator('#visits-drawer > summary').click();await cmd(17);await wait(()=>!window.cafeDemandState.automatic);
   await page.locator('#guest-first').selectOption('0');await page.locator('#guest-second').selectOption('4');
   for(let n=0;n<3;n++){await page.locator('#guest-profile').selectOption(n===0?'0':'1');await cmd(6);await page.waitForFunction(count=>window.cafeMenuState.tickets.length===count,n+1);}
   await page.locator('#visits-drawer > summary').click();
   await wait(()=>document.querySelectorAll('.customer-badge:not([hidden])').length===3 && document.querySelectorAll('.visual-ticket').length===3);
   const ids=await page.evaluate(()=>window.cafeMenuState.tickets.map(t=>t.guest));
   assert.equal(await page.locator('.ticket-products .service-icon').count(),6);
   await page.locator(`.customer-badge[data-guest="${ids[1]}"]`).click();
   assert.match(await page.locator('#customer-selection').textContent(),new RegExp(`Guest #${ids[1]}.*queue order`));
   assert.match(await page.locator('#next-action').textContent(),new RegExp(`Prepare #${ids[0]}`));
   assert.equal(await page.locator('.visual-ticket.selected .ticket-select').getAttribute('aria-pressed'),'true');
   await cmd(2);await wait(()=>window.cafeState.paused);
   const before=await page.evaluate(()=>({time:window.cafeInspectorState.report.timeMs,patience:window.cafeDemandState.guests.map(g=>g.remaining),frames:window.cafeRenderMeasurements.frames,pins:[...document.querySelectorAll('.customer-badge')].map(b=>b.style.transform)}));
   await page.locator('#viewport').focus();await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(old=>window.cafeRenderMeasurements.frames>old.frames+4 && [...document.querySelectorAll('.customer-badge')].some((b,i)=>b.style.transform!==old.pins[i]),before);
   assert.deepEqual(await page.evaluate(()=>({time:window.cafeInspectorState.report.timeMs,patience:window.cafeDemandState.guests.map(g=>g.remaining)})),{time:before.time,patience:before.patience});
   await page.keyboard.press('r');
   // Pure presentation fixture checks urgency without altering any simulation data.
   const urgent=await page.evaluate(id=>{const g=window.cafeDemandState.guests.find(g=>g.id===id);g.remaining=g.budget*.15;window.cafeInspector(JSON.stringify(window.cafeInspectorState));const card=[...document.querySelectorAll('.visual-ticket')].find(li=>li.querySelector('.ticket-select').getAttribute('aria-label').includes(`Guest ${id} order`));return {urgency:card.dataset.urgency,label:card.querySelector('.patience').textContent};},ids[0]);assert.equal(urgent.urgency,'urgent');assert.match(urgent.label,/Low patience/);
   await page.screenshot({path:`build/evidence/service-desktop-${backend}.png`});
   await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.customer-overlay').clientWidth<400);
   await page.locator(`.customer-badge[data-guest="${ids[2]}"]`).tap();
   const geometry=await page.evaluate(()=>{const bounds=document.querySelector('.game').getBoundingClientRect(),rects=[...document.querySelectorAll('.customer-badge:not([hidden])')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});return {overflow:document.documentElement.scrollWidth>innerWidth,bounds:{x:bounds.x,y:bounds.y,w:bounds.width,h:bounds.height},rects};});
   assert.equal(geometry.overflow,false);assert.equal(geometry.rects.length,3);
   assert.equal(await page.locator('#coins').isVisible(),true,'Cash must remain visible in the compact header');
   assert.ok(await page.locator('#hud-pause button').getAttribute('aria-label'),'Icon-only pause needs an accessible name');
   await page.waitForFunction(()=>[...document.querySelectorAll('img.imagegen-icon')].every(img=>img.complete && img.naturalWidth>0));
   assert.ok(await page.locator('img.imagegen-icon').count()>10,'Generated icons must be used throughout the HUD');
   assert.match(await page.locator('#play-drawer').evaluate(n=>getComputedStyle(n).borderImageSource),/assets\/ui\/panel.webp/);
   assert.match(await page.locator('#hud-pause button').evaluate(n=>getComputedStyle(n).borderImageSource),/assets\/ui\/button.webp/);
   const actionVisible=await page.locator('#next-action').evaluate(button=>{const a=button.getBoundingClientRect(),b=document.getElementById('play-drawer').getBoundingClientRect();return a.top>=b.top && a.bottom<=b.bottom;});assert.equal(actionVisible,true,'Primary action scrolled out of the drawer');
   for(let i=0;i<geometry.rects.length;i++){const a=geometry.rects[i],b=geometry.bounds;assert.ok(a.x>=b.x && a.y>=b.y && a.x+a.w<=b.x+b.w+1 && a.y+a.h<=b.y+b.h+1);for(let j=i+1;j<geometry.rects.length;j++){const c=geometry.rects[j];assert.ok(!(a.x<c.x+c.w && a.x+a.w>c.x && a.y<c.y+c.h && a.y+a.h>c.y),'World badges overlap');}}
   await page.screenshot({path:`build/evidence/service-narrow-${backend}.png`});
   await page.setViewportSize({width:1440,height:960});await cmd(2);await wait(()=>!window.cafeState.paused);
   await page.locator('#next-action').click();await wait(()=>window.cafeState.ready && !document.getElementById('next-action').disabled);
   await page.screenshot({path:`build/evidence/service-ready-${backend}.png`});
   assert.match(await page.locator('#next-action').textContent(),new RegExp(`Serve #${ids[0]}`));assert.equal(await page.locator(`.customer-badge[data-guest="${ids[0]}"]`).getAttribute('data-state'),'ready');
   await page.locator('#next-action').click();await wait(()=>window.cafeState.served===1 && window.cafeMenuState.tickets.some(t=>t.phase===3));
   assert.equal(await page.evaluate(()=>window.cafeEconomyState.sales),850);
   await wait(()=>document.querySelector('.service-guide').open===false && document.querySelectorAll('.visual-ticket').length===2);
   assert.equal(await page.locator(`.customer-badge[data-guest="${ids[0]}"] .badge-patience`).isVisible(),false);
   assert.equal(await page.locator(`.customer-badge[data-guest="${ids[0]}"]`).getAttribute('data-urgency'),'calm');
   await mode('Menu');await cmd(2);await wait(()=>window.cafeState.paused);await cmd(3);await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));await cmd(4);await wait(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
   await mode('Serve');await cmd(2);await wait(()=>!window.cafeState.paused && document.querySelectorAll('.customer-badge:not([hidden])').length===3);assert.equal(await page.evaluate(()=>window.cafeState.served),1);
   assert.deepEqual(errors,[]);const timing=await page.evaluate(()=>{const a=window.cafeRenderMeasurements.intervals.filter(t=>t>0).sort((a,b)=>a-b);return {frames:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)]};});evidence.runs.push({backend,status:await page.locator('#status').textContent(),customers:ids,geometry,timing,passed:true});console.log(`${backend}: icon tickets, world patience, selection/FIFO, camera, pause, urgency, touch/narrow collision layout, ready/service, dining and restored markers passed`);
  }catch(error){console.error(await page.evaluate(()=>({error:window.cafeHostError,state:window.cafeState,menu:window.cafeMenuState,pins:document.querySelector('.customer-overlay')?.innerHTML})));await page.screenshot({path:`build/evidence/service-failure-${backend}.png`});throw error;}finally{await page.close();}
 }}finally{await fs.writeFile(`build/evidence/service-ui${process.env.CAFE_DISABLE_WEBGPU==='1'?'-fallback':''}.json`,JSON.stringify(evidence,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
