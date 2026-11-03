// Verify staff return behind the desk after serving and cleaning a seated guest.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const reports=[];
 try {for(const backend of ['webgl2','automatic']) {
  const page=await browser.newPage({viewport:{width:1030,height:764}}),errors=[];
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.25,configurable:true}));
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:90000,polling:30});
  const command=n=>page.evaluate(n=>Module._cafe_command(n),n);
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady&&window.cafeStaffAnimations?.length);
  await page.evaluate(()=>Module._cafe_scenario(2));
  await wait(()=>cafeMenuState?.tickets.length===1&&cafeMenuState.ingredients[0].stock===100);
  await command(0);
  await wait(()=>cafeState.ready&&cafeWorkflowState.handoverReady);
  await command(1);
  await wait(()=>cafeOccupancyState.dining===1);
  await wait(()=>cafeWorkflowState.key==='cafe:clean'&&cafeWorkflowState.state===2);
  const cleaning=await page.evaluate(()=>cafeStaffAnimations[0]);
  assert.ok(cleaning.z>-2,'Cleanup must exercise a location in the dining area');
  await wait(()=>cafeWorkflowState.dirty===0&&cafeOccupancyState.guests===0);
  await wait(()=>{const a=cafeStaffAnimations[0];return a.clip==='Idle'&&a.z<-3&&Math.abs(a.x-2)<.5&&Math.cos(a.yaw)>.95;});
  const home=await page.evaluate(()=>cafeStaffAnimations[0]);
  await page.waitForTimeout(500);
  const still=await page.evaluate(()=>cafeStaffAnimations[0]);
  assert.equal(still.x,home.x);assert.equal(still.z,home.z);
  assert.deepEqual(errors,[]);
  await fs.mkdir('build/evidence',{recursive:true});
  await page.screenshot({path:`build/evidence/barista-waiting-${backend}.png`});
  reports.push({backend,cleaning,home,errors});
  console.log(`${backend}: barista returned behind desk and faces customers`);
  await page.close();
 }}finally {await fs.writeFile('build/evidence/barista-waiting.json',JSON.stringify(reports,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
