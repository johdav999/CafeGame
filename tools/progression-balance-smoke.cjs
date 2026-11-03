const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence=[];
try{for(const backend of ['webgl2','automatic']){
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173/?backend='+backend);
 await page.waitForFunction(()=>window.cafeClockState&&window.cafeEquipmentState&&window.cafeAssetsReady,null,{timeout:120000});
 const load=async file=>{
  const bytes=await fs.readFile(file);
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading balance fixture';Module._cafe_command(4);},bytes.toString('base64'));
  await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'),null,{timeout:60000});
 };
 await load('build/evidence/progression-fixtures/morning-build.bin');
 await page.waitForFunction(()=>cafeClockState.stage===2&&cafeClockState.minutes===720&&cafeLayoutState.editable);
 assert.equal(await page.evaluate(()=>cafeCampaignState.goals&4),0);
 assert.equal(await page.evaluate(()=>cafeEquipmentState.extraTablesReason),'');
 assert.ok(await page.locator('#period-build').isVisible());
 await page.locator('#period-build').click();
 await page.waitForFunction(()=>document.getElementById('build-tab').getAttribute('aria-selected')==='true');
 assert.equal(await page.locator('[data-place-item="4"]').isEnabled(),true);
 const before=await page.evaluate(()=>({cash:cafeEconomyState.cash,clock:cafeClockState.minutes,wages:cafeEconomyState.staffedMs}));
 const target=await page.evaluate(()=>{
  const c=document.getElementById('viewport'),r=c.getBoundingClientRect();
  for(let y=10;y<r.height;y+=5)for(let x=10;x<r.width;x+=5){
   if(document.elementFromPoint(r.left+x,r.top+y)!==c)continue;
   const cell=Module._cafe_floor_pick(x/r.width,y/r.height,r.width/r.height);if(cell<0)continue;
   const wx=(cell%24-2)*.5-6,wz=(Math.floor(cell/24)-4)*.5-5;
   if(Module._cafe_layout_preview(4,wx,wz,0)===0)return{x:r.left+x,y:r.top+y};
  }return null;
 });
 assert.ok(target,'A valid visible table placement must exist during the campaign break');
 const item=await page.locator('[data-place-item="4"]').boundingBox();
 await page.mouse.move(item.x+item.width/2,item.y+item.height/2);
 await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:15});
 await page.waitForFunction(()=>document.getElementById('placement-label').dataset.valid==='true');
 await page.screenshot({path:'build/evidence/progression-'+backend+'-placement.png'});
 await page.mouse.up();
 await page.waitForFunction(()=>cafeLayoutState.tables.filter(t=>t.id<=4).length===4);
 assert.equal(await page.evaluate(()=>cafeEconomyState.cash),before.cash-600);
 assert.equal(await page.evaluate(()=>cafeClockState.minutes),720);
 await page.evaluate(()=>Module._cafe_command(3));
 await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
 await page.evaluate(()=>Module._cafe_command(4));
 await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
 assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(t=>t.id<=4).length),4);
 await page.mouse.move(1,1);await page.screenshot({path:'build/evidence/progression-'+backend+'-morning-built.png'});
 await page.locator('#period-continue').click();
 await page.waitForFunction(()=>cafeClockState.period===1&&cafeClockState.running);
 await load('build/evidence/progression-fixtures/lunch-build.bin');
 await page.waitForFunction(()=>cafeClockState.minutes===840&&cafeClockState.stage===2);
 await page.locator('#period-build').click();
 assert.equal(await page.evaluate(()=>cafeLayoutState.editable),true);
 assert.equal(await page.evaluate(()=>cafeLayoutState.tables.filter(t=>t.id<=4).length),4);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(250);
 assert.ok(await page.locator('#period-build').isVisible());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'build/evidence/progression-'+backend+'-mobile-break.png'});
 // A genuine rules-14 summary and its nested opening checkpoint still load.
 await load('build/evidence/achievement-fixtures/campaign-summary.save');
 await page.waitForFunction(()=>cafeCampaignState.phase===3);
 assert.deepEqual(errors,[]);
 evidence.push({backend,firstDayPurchase:true,dragAndDrop:true,bothBreaks:true,mobile:true,saveLoad:true,previousRules14:true,errors});
 console.log(backend+': first-day table purchase without clean shift, drag/drop, both build breaks, mobile and migration passed');
 await page.close();
}}finally{await fs.writeFile('build/evidence/progression-browser.json',JSON.stringify(evidence,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
