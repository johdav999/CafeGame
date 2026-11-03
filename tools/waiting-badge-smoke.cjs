const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/waiting-badge';await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.75}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:120000});
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`,{waitUntil:'domcontentloaded',timeout:120000});await wait(()=>window.cafeAssetsReady);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  await page.evaluate(()=>Module._cafe_scenario(2));await wait(()=>window.cafeMenuState?.tickets.length===1 && window.cafeMenuState.tickets[0].service==='Waiting to order');
  const id=await page.evaluate(()=>window.cafeMenuState.tickets[0].guest),badge=page.locator(`.customer-badge[data-guest="${id}"]`);
  await badge.waitFor({state:'visible'});await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  assert.match(await badge.textContent(),/^\d+s$/);assert.equal(await badge.locator('img').count(),1);assert.match(await badge.locator('img').getAttribute('src'),/menu.webp$/);
  assert.equal(await badge.locator('.badge-patience').isVisible(),false);assert.match(await badge.getAttribute('aria-label'),/Espresso.*Waiting to order.*seconds patience/);
  await badge.locator('img').evaluate(img=>img.decode());await badge.locator('img').hover();await page.locator('#cafe-tooltip').waitFor({state:'visible'});assert.match(await page.locator('#cafe-tooltip').textContent(),/Espresso.*Waiting to order/);await page.keyboard.press('Escape');
  await badge.focus();await page.locator('#cafe-tooltip').waitFor({state:'visible'});assert.match(await page.locator('#cafe-tooltip').textContent(),/Guest.*Espresso/);await page.keyboard.press('Escape');
  await page.mouse.move(1,1);await page.screenshot({path:`${dir}/${backend}-desktop.png`});await badge.screenshot({path:`${dir}/${backend}-badge.png`});
  await page.setViewportSize({width:390,height:844});await wait(()=>document.querySelector('.customer-overlay').clientWidth<400);await page.screenshot({path:`${dir}/${backend}-narrow.png`});
  const geometry=await badge.boundingBox();assert.ok(geometry.width>=44 && geometry.height>=44 && geometry.x>=0 && geometry.x+geometry.width<=391);
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!window.cafeState.paused);
  // The simplified badge still activates the real table-order action.
  await badge.click();await wait(()=>window.cafeMenuState.tickets[0].taken);
  await wait(()=>document.querySelector('.customer-badge img')?.getAttribute('src').endsWith('service-waiting.webp'));
  await page.evaluate(id=>Module._cafe_service(1,id),id);await wait(()=>window.cafeMenuState.tickets[0].service==='Preparing');
  await wait(()=>!document.querySelector('.customer-badge').classList.contains('waiting-service'));assert.ok(await badge.locator('img').count()>1);
  await wait(()=>window.cafeMenuState.tickets[0].service==='Ready to serve');await wait(()=>document.querySelector('.customer-badge').dataset.state==='ready');assert.match(await badge.textContent(),/Ready/);
  await page.screenshot({path:`${dir}/${backend}-ready.png`});assert.deepEqual(errors,[]);
  reports.push({backend,renderer:await page.locator('#status').textContent(),onlyWaitingIconAndSeconds:true,tooltip:true,keyboardFocus:true,mobileTouchTarget:geometry,clickTakesOrder:true,preparingAndReady:true,errors});console.log(`${backend}: waiting badge, tooltip, mobile and service transitions passed`);await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
