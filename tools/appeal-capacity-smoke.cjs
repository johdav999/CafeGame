const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/appeal-capacity';await fs.mkdir(dir,{recursive:true});
 const high=(await fs.readFile('build/evidence/appeal-capacity-fixtures/bounded-traffic.bin')).toString('base64');
 const previous=(await fs.readFile('build/evidence/appeal-capacity-fixtures/previous-visitors.bin')).toString('base64');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.75}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{try{return await page.waitForFunction(fn,null,{timeout:120000});}catch(e){console.error(await page.evaluate(()=>({demand:window.cafeInspectorState.report,menu:window.cafeMenuState,host:window.cafeHostError,save:document.getElementById('save-status').textContent})));throw e;}};
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`,{waitUntil:'domcontentloaded',timeout:120000});await wait(()=>window.cafeState && window.cafeInspectorState?.report);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused && window.cafeAssetsReady);
  const initial=await page.evaluate(()=>window.cafeInspectorState.report);
  assert.equal(initial.attractiveness,30);assert.equal(initial.attractivenessMenu,10);assert.equal(initial.attractivenessExperience,10);assert.equal(initial.attractivenessFurnishings,10);assert.equal(initial.visitorLimit,2);assert.equal(initial.visitingGuests,2);
  await page.locator('#attractiveness > summary').click();assert.match(await page.locator('#attractiveness-capacity').textContent(),/2 guests/);
  await page.mouse.move(1,1);await page.keyboard.press('Escape');await page.screenshot({path:`${dir}/${backend}-start.png`});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${dir}/${backend}-mobile.png`});await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{Module._cafe_command(2);Module._cafe_guest(1,0,-1);Module._cafe_command(6);});await wait(()=>!window.cafeState.paused);
  await wait(()=>window.cafeInspectorState.report.missed>0);assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.visitingGuests),2);assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.length),2);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},high);
  await wait(()=>window.cafeInspectorState.report.visitingGuests===9 && window.cafeMenuState.tickets.length===9);
  assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.attractiveness),100);assert.equal(await page.evaluate(()=>window.cafeInspectorState.report.visitorLimit),9);
  await page.evaluate(()=>Module._cafe_command(3));await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));await page.evaluate(()=>Module._cafe_command(4));await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
  assert.equal(await page.evaluate(()=>window.cafeMenuState.tickets.length),9);await page.screenshot({path:`${dir}/${backend}-maximum.png`});
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},previous);
  await wait(()=>window.cafeInspectorState.report.visitingGuests===7 && window.cafeInspectorState.report.visitorLimit===2);assert.match(await page.locator('#save-status').textContent(),/upgraded/);
  assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),startingScore:30,split:[10,10,10],initialGuests:2,playerAndAutomaticCap:true,maximumScore:100,maximumGuests:9,nineGuestSaveLoad:true,previousSavePreservesGuests:true,mobile:true,errors});console.log(`${backend}: start 30, combined visitor cap, nine-guest save/load and previous-save migration passed`);await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
