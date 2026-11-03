const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/achievement-ui';await fs.mkdir(dir,{recursive:true});
 const summary=(await fs.readFile('build/evidence/achievement-fixtures/campaign-summary.save')).toString('base64');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:.75}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{try{return await page.waitForFunction(fn,null,{timeout:120000});}catch(e){console.error(await page.evaluate(()=>({campaign:window.cafeCampaignState,game:window.cafeState,error:window.cafeHostError,dialog:document.getElementById('achievement-dialog')?.outerHTML})));throw e;}};
  const load=async()=>{await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},summary);await wait(()=>window.cafeCampaignState?.phase===3);};
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`,{waitUntil:'domcontentloaded',timeout:120000});await wait(()=>window.cafeAssetsReady);
  assert.equal(await page.locator('#achievement-shelf').isVisible(),false);assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  await load();const earned=await page.evaluate(()=>window.cafeCampaignState.journal.achievements.filter(g=>g.complete && g.new));assert.ok(earned.length>=2);
  const dialog=page.locator('#achievement-dialog');await dialog.waitFor({state:'visible'});const cash=await page.evaluate(()=>window.cafeEconomyState.cash);
  for(const [index,goal] of earned.entries()){
   await page.waitForFunction(name=>document.getElementById('achievement-title').textContent===name,goal.name);
   assert.equal(await page.locator('#achievement-description').textContent(),goal.description);assert.match(await dialog.locator('.achievement-reward').textContent(),/\+5\.00.*Already added/);
   assert.match(await dialog.locator('.achievement-hero img').getAttribute('src'),new RegExp(`badge-${goal.id}.webp$`));await dialog.locator('.achievement-hero img').evaluate(img=>img.decode());
   for(let n=0;n<5;n++)await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(n=>n.contains(document.activeElement)),true);
   await page.mouse.move(1,1);if(index===0)await page.screenshot({path:`${dir}/${backend}-popup.png`});await dialog.locator('.achievement-primary').click();
  }
  await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  const geometry=await page.evaluate(()=>{const a=document.getElementById('achievement-shelf').getBoundingClientRect(),b=document.getElementById('play-drawer').getBoundingClientRect();return {shelf:{x:a.x,y:a.y,right:a.right,width:a.width},drawerX:b.x};});assert.ok(geometry.shelf.right<geometry.drawerX && geometry.shelf.y>=80);
  assert.equal(await page.locator('.achievement-shelf-badge').count(),earned.length);await page.screenshot({path:`${dir}/${backend}-shelf.png`});
  await page.locator('.achievement-shelf-heading').click();assert.equal(await dialog.locator('.achievement-collection-card').count(),18);
  await page.waitForFunction(()=>[...document.querySelectorAll('.achievement-collection img')].every(i=>i.complete && i.naturalWidth>0));await page.screenshot({path:`${dir}/${backend}-collection.png`});
  await dialog.locator('[data-achievement="17"]').click();assert.equal(await page.locator('#achievement-title').textContent(),'Tools of the trade');assert.match(await dialog.locator('.achievement-reward').textContent(),/Awarded once at closing/);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.reload({waitUntil:'domcontentloaded'});await wait(()=>window.cafeAssetsReady);await load();await wait(()=>!document.getElementById('achievement-shelf').hidden);assert.equal(await dialog.isVisible(),false,'Acknowledged awards must not replay after reload/restore');
  await page.setViewportSize({width:390,height:844});await page.locator('.achievement-shelf-heading').click();await dialog.waitFor({state:'visible'});
  const box=await dialog.boundingBox();assert.ok(box.x>=0 && box.x+box.width<=391 && box.y>=0 && box.y+box.height<=845);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${dir}/${backend}-mobile-collection.png`});await dialog.locator('[data-achievement="0"]').click();await page.screenshot({path:`${dir}/${backend}-mobile-popup.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>Module._cafe_campaign(3));await wait(()=>window.cafeCampaignState.phase===0);await page.evaluate(()=>Module._cafe_campaign(1));await wait(()=>window.cafeCampaignState.phase===1);
  await page.locator('.achievement-shelf-badge').first().click();await wait(()=>window.cafeState.paused);await page.keyboard.press('Escape');await wait(()=>!window.cafeState.paused);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused);await page.locator('.achievement-shelf-badge').first().click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.cafeState.paused),true,'An existing pause belongs to the player');
  // Presentation-only stress fixture: all eighteen earned icons must fit a
  // scrollable shelf without changing any real progress, rewards or wallet.
  await page.evaluate(()=>{const original=window.cafeCampaign;window.cafeCampaign=json=>{const c=JSON.parse(json);c.journal.achievements.forEach(g=>{g.complete=1;g.new=0;});c.journal.earned=18;original(JSON.stringify(c));};});
  await wait(()=>document.querySelectorAll('.achievement-shelf-badge').length===18);
  const shelfStress=await page.locator('.achievement-shelf-grid').evaluate(n=>({overflowX:n.scrollWidth>n.clientWidth,scrolling:n.scrollHeight>n.clientHeight,height:n.clientHeight}));assert.equal(shelfStress.overflowX,false);assert.equal(shelfStress.scrolling,true);assert.ok(shelfStress.height<=95);
  await page.screenshot({path:`${dir}/${backend}-all-badges-shelf-fixture.png`});
  assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),realAwards:earned.map(g=>g.id),reward:500,queuedPopups:true,keyboardFocus:true,earnedShelf:geometry,all18IconsLoaded:true,all18ShelfFixture:shelfStress,mobile:true,notificationDeduplication:true,noDuplicatePayment:true,pauseOwnership:true,errors});console.log(`${backend}: real achievement popups, badges, reward idempotency, mobile, keyboard and pause ownership passed`);await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
