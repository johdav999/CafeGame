// Load genuine native-authored near-boundary saves through the normal UI loader.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const evidence=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.5,configurable:true}));
  await page.route('**/assets/models/**',r=>r.abort());
  const wait=async(fn,arg)=>{try{return await page.waitForFunction(fn,arg,{timeout:60000,polling:30});}catch(e){console.error(await page.evaluate(()=>({clock:window.cafeClockState,campaign:window.cafeCampaignState,state:window.cafeState,layout:window.cafeLayoutState,layoutMessage:document.getElementById('layout-status')?.textContent,save:document.getElementById('save-status')?.textContent,error:window.cafeHostError})));throw e;}};
  await page.goto(`http://localhost:4173/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady&&window.cafeClockState);
  const load=async name=>{
   const bytes=await fs.readFile(`build/evidence/schedule-fixtures/${name}.bin`);
   await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);document.getElementById('save-status').textContent='Loading schedule fixture';Module._cafe_command(4);},bytes.toString('base64'));
   await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
  };
  const clock=()=>page.evaluate(()=>window.cafeClockState);
  const boundaries=[];
  for(const [name,minutes,period,label] of [['morning',720,0,'Start Lunch'],['lunch',840,1,'Start Afternoon'],['afternoon',1080,2,'Start day 2']]){
   await load(name);await wait(m=>cafeClockState.minutes===m&&cafeClockState.stage===2,minutes);
   assert.equal((await clock()).period,period);assert.ok(await page.locator('#period-continue').isVisible());
   assert.equal(await page.locator('#period-continue').textContent(),label);
   const held=await clock();await page.waitForTimeout(300);assert.deepEqual(await clock(),held);
   if(period===0){
    const cash=await page.evaluate(()=>cafeEconomyState.cash);
    const target=await page.evaluate(()=>{for(let z=0;z<=12;z++)for(let x=0;x<=20;x++){const wx=-6+x*.5,wz=-5+z*.5;if(Module._cafe_layout_preview(3,wx,wz,0)===0)return {x:wx,z:wz};}return null;});
    assert.ok(target,'A planning break must allow a valid furnishing placement');
    await page.evaluate(p=>Module._cafe_layout(2,3,p.x,p.z,0),target);
    await wait(()=>cafeLayoutState.tables.filter(t=>t.id<=4).length===3);
    assert.equal(await page.evaluate(()=>cafeEconomyState.cash),cash-600);assert.equal((await clock()).minutes,720);
    await page.evaluate(()=>Module._cafe_command(3));await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
    await page.evaluate(()=>Module._cafe_command(4));await wait(()=>document.getElementById('save-status').textContent.startsWith('Saved shift restored'));
    assert.equal((await clock()).stage,2);
    await page.mouse.move(1,1);await page.screenshot({path:`build/evidence/day-clock-${backend}.png`});
   }
   boundaries.push(held);
   await page.locator('#period-continue').click();await wait(()=>cafeClockState.stage===0&&cafeClockState.running);
   assert.equal((await clock()).period,period===2?0:period+1);assert.equal((await clock()).day,period===2?2:1);
  }
  await load('campaign-morning');await wait(()=>cafeClockState.stage===2&&cafeCampaignState.phase===1);
  assert.ok(await page.evaluate(()=>cafeLayoutState.editable));
  await page.evaluate(()=>Module._cafe_layout(0,1,-4.5,-.5,0));
  await wait(()=>cafeLayoutState.tables.find(t=>t.id===1).x===3);
  await page.locator('#period-continue').click();await wait(()=>cafeClockState.period===1&&cafeClockState.running);
  await load('campaign-afternoon');await wait(()=>cafeCampaignState.phase===3&&cafeClockState.stage===2);
  assert.equal((await clock()).minutes,1080);
  await page.locator('#period-continue').click();await wait(()=>cafeCampaignState.phase===0&&cafeClockState.day===2);
  assert.equal((await clock()).minutes,480);assert.equal((await clock()).running,false);
  await load('pause');await page.evaluate(()=>Module._cafe_command(2));await wait(()=>cafeState.paused);
  const paused=await clock();await page.waitForTimeout(200);assert.deepEqual(await clock(),paused);
  await page.evaluate(()=>Module._cafe_command(2));await wait(()=>!cafeState.paused);
  await load('afternoon');await wait(()=>cafeClockState.stage===2);
  await page.setViewportSize({width:390,height:844});
  await wait(()=>innerWidth===390);
  assert.ok(await page.locator('#period-continue').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile clock must fit the viewport');
  await page.mouse.move(1,1);await page.screenshot({path:`build/evidence/day-clock-mobile-${backend}.png`});
  assert.deepEqual(errors,[]);evidence.push({backend,boundaries,purchases:true,saveLoad:true,campaignTransitions:true,manualPause:true,mobile:true,errors});
  console.log(`${backend}: 12:00/14:00/18:00 stops, purchases, continuation, day rollover, campaign, save/load, pause and mobile passed`);
  await page.close();
 }}finally{await fs.writeFile('build/evidence/day-clock-browser.json',JSON.stringify(evidence,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
