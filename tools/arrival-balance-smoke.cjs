const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/arrival-balance';await fs.mkdir(dir,{recursive:true});
 const fixture=(await fs.readFile('build/evidence/arrival-balance-fixtures/bounded-traffic.bin')).toString('base64');
 const previous=(await fs.readFile('build/evidence/arrival-balance-fixtures/previous-balance.bin')).toString('base64');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.75}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{try{return await page.waitForFunction(fn,null,{timeout:120000});}catch(e){console.error(await page.evaluate(()=>({menu:window.cafeMenuState,host:window.cafeHostError,save:document.getElementById('save-status').textContent})));throw e;}};
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`,{waitUntil:'domcontentloaded',timeout:120000});await wait(()=>window.cafeAssetsReady);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},fixture);
  await wait(()=>window.cafeMenuState?.tickets.length===7 && window.cafeMenuState.tickets.filter(t=>t.service==='Waiting for a table').length===2);
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.filter(t=>t.takeaway).length),3);
  const badge=page.locator('.customer-badge[data-guest="1"]'),card=page.getByRole('button',{name:/View Guest 1 takeaway order/});
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  assert.equal(await badge.getAttribute('data-service'),'takeaway');assert.match(await badge.locator('img').getAttribute('src'),/takeaway.webp$/);assert.match(await badge.textContent(),/^\d+s$/);
  assert.match(await card.locator('.ticket-avatar img').getAttribute('src'),/takeaway.webp$/);assert.match(await card.textContent(),/Takeaway/);
  assert.match(await page.locator('.customer-badge[data-guest="2"] img').first().getAttribute('src'),/service-waiting.webp$/);
  await badge.locator('img').evaluate(img=>img.decode());await badge.hover();await page.locator('#cafe-tooltip').waitFor({state:'visible'});assert.match(await page.locator('#cafe-tooltip').textContent(),/Takeaway/);await page.keyboard.press('Escape');await page.mouse.move(1,1);
  await page.screenshot({path:`${dir}/${backend}-desktop.png`});await badge.screenshot({path:`${dir}/${backend}-takeaway-badge.png`});
  await page.setViewportSize({width:390,height:844});await wait(()=>document.querySelector('.customer-overlay').clientWidth<400);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${dir}/${backend}-mobile.png`});await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!window.cafeState.paused);await badge.click();
  await wait(()=>!document.getElementById('next-action').disabled);await page.locator('#next-action').click();await wait(()=>window.cafeState.ready && window.cafeWorkflowState.handoverReady);
  assert.match(await badge.locator('img').first().getAttribute('src'),/takeaway.webp$/);await page.screenshot({path:`${dir}/${backend}-takeaway-ready.png`});
  await page.locator('#next-action').click();await wait(()=>window.cafeState.served===1);
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.filter(t=>t.service==='Waiting for a table').length),2);
  // Validated previous content-version-11 fixture: no guests or balances are lost.
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},previous);
  await wait(()=>window.cafeMenuState.tickets.length===1 && window.cafeMenuState.tickets[0].shortages?.join(',')==='0,2');
  assert.equal(await page.evaluate(()=>!!window.cafeMenuState.tickets[0].takeaway),false);assert.match(await page.getByRole('button',{name:/View Guest 1 order/}).locator('.ticket-avatar img').getAttribute('src'),/person.webp$/);
  assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),tableWaiters:2,takeawayQueue:3,desktopMobile:true,takeawayIcons:true,counterService:true,previousSaveRestored:true,errors});console.log(`${backend}: capped table queue, takeaway icons/counter service, mobile layout and previous-save migration passed`);await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
