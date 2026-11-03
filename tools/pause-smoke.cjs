// Real pointer gestures must survive HUD updates between press and release.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE_RENDERING==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:800,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Input/clock coverage does not require imported models or sound assets.
  await page.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:.25,configurable:true}));
  await page.route('**/assets/manifest.json',route=>route.fulfill({json:{models:[],audio:[]}}));
  try{
   await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
   await page.waitForFunction(()=>window.cafeInspectorState && window.cafeRenderMeasurements.frames>3,null,{timeout:90000});
   const frames=async()=>{
    const start=await page.evaluate(()=>window.cafeRenderMeasurements.frames);
    await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>=n+3,start,{timeout:30000});
   };
   const press=async paused=>{
    const button=page.locator('[data-command="2"]');
    assert.equal(await button.getAttribute('aria-label'),paused?'Pause shift':'Resume shift');
    await button.hover();
    await page.mouse.down();
    await frames(); // Reproduce a press spanning several simulation/HUD updates.
    await page.mouse.up();
    await page.waitForFunction(value=>window.cafeState.paused===value,paused,{timeout:10000});
   };
   for(const width of [800,390]){
    await page.setViewportSize({width,height:844});await frames();
    await press(true);
    const frozen=await page.evaluate(()=>({time:window.cafeInspectorState.report.timeMs,staffed:window.cafeEconomyState.staffed,brewing:window.cafeState.brewing}));
    await frames();
    assert.deepEqual(await page.evaluate(()=>({time:window.cafeInspectorState.report.timeMs,staffed:window.cafeEconomyState.staffed,brewing:window.cafeState.brewing})),frozen);
    await press(false);
    await page.waitForFunction(time=>window.cafeInspectorState.report.timeMs>time,frozen.time);
    // Keyboard activation uses the same semantic button and command path.
    await buttonFocus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.cafeState.paused);
    await page.keyboard.press('Enter');await page.waitForFunction(()=>!window.cafeState.paused);
    reports.push({backend,width,passed:true});
   }
   async function buttonFocus(){await page.locator('[data-command="2"]').focus();}
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }}finally{await browser.close();}
 await fs.mkdir('build/evidence',{recursive:true});
 await fs.writeFile('build/evidence/pause-browser.json',JSON.stringify(reports,null,2)+'\n');
 console.log(JSON.stringify(reports));
})().catch(error=>{console.error(error);process.exitCode=1;});
