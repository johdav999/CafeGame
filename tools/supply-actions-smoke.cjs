const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/supply-actions';await fs.mkdir(dir,{recursive:true});
 const fixture=(await fs.readFile('build/evidence/supply-actions-fixtures/shortages.bin')).toString('base64');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{try{return await page.waitForFunction(fn,null,{timeout:120000});}catch(e){console.error(await page.evaluate(()=>({menu:window.cafeMenuState,supply:window.cafeSupplyState,error:window.cafeHostError,buttons:[...document.querySelectorAll('.service-supply-action')].map(b=>({text:b.textContent,hidden:b.hidden,disabled:b.disabled,title:b.title}))})));throw e;}};
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`,{waitUntil:'domcontentloaded',timeout:120000});await wait(()=>window.cafeAssetsReady);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},fixture);
  await wait(()=>window.cafeMenuState?.tickets.length===1 && window.cafeMenuState.tickets[0].shortages?.join(',')==='0,2');
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  const action=index=>page.locator(`.service-supply-action[data-ingredient="${index}"]:not([hidden])`);
  assert.equal(await page.evaluate(()=>window.cafeMenuState.ingredients[0].stock),1);
  for(const [index,name] of [[0,'Beans'],[2,'Milk'],[4,'Pastry']]){await action(index).waitFor({state:'visible'});assert.match(await action(index).textContent(),new RegExp(`Order ${name}`));}
  assert.equal(await page.locator('.service-supply-action:visible').count(),3);
  await page.screenshot({path:`${dir}/${backend}-desktop.png`});
  await page.setViewportSize({width:390,height:844});await page.locator('#next-action').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const i of [0,2,4]){const box=await action(i).boundingBox();assert.ok(box.x>=0 && box.x+box.width<=391);}
  await page.screenshot({path:`${dir}/${backend}-mobile.png`});await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!window.cafeState.paused);
  assert.equal(await page.locator('#next-action').isDisabled(),true);assert.match(await page.locator('#next-reason').textContent(),/Restock Beans and Milk/);
  await action(0).click();await wait(()=>window.cafeMenuState.ingredients[0].incoming===12);
  assert.equal(await action(2).isVisible(),true);assert.equal(await action(2).isDisabled(),true);
  await wait(()=>window.cafeMenuState.ingredients[0].stored===12);assert.equal(await action(2).isEnabled(),true);
  await action(2).click();await wait(()=>window.cafeMenuState.ingredients[2].incoming===12);
  assert.match(await action(0).textContent(),/Refill Beans/);await action(0).click();await wait(()=>window.cafeMenuState.ingredients[0].stock>=2);
  await wait(()=>window.cafeMenuState.ingredients[2].stored===12);assert.match(await action(2).textContent(),/Refill Milk/);await action(2).click();
  await wait(()=>window.cafeMenuState.tickets[0].shortages.length===0 && !document.getElementById('next-action').disabled);
  assert.equal(await action(4).isVisible(),true,'An unrelated empty product must retain its order action');
  await page.screenshot({path:`${dir}/${backend}-replenished.png`});await page.locator('#next-action').click();await wait(()=>window.cafeMenuState.tickets[0].service==='Preparing');
  assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),partialStock:true,tableOrder:true,multipleActions:true,deliveryDoesNotHideOthers:true,orderDeliveryRefill:true,prepareUnblocks:true,mobile:true,errors});console.log(`${backend}: table/mixed ticket shortages, multiple order actions, delivery/refill and preparation passed`);await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
