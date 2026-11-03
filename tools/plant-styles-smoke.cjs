const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('build/evidence/plants',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server',...(process.env.CAFE_SOFTWARE==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
 const report=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:120000});
  await page.goto(`http://127.0.0.1:4173/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady && window.cafeEquipmentState?.plantNames);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  assert.equal(await page.evaluate(()=>window.cafeAssetState.models),25);
  await page.evaluate(()=>Module._cafe_scenario(4));
  await wait(()=>window.cafeLayoutState.editable && window.cafeEconomyState.cash===100000);
  await page.locator('#build-tab').click();
  await page.evaluate(()=>Module._cafe_equipment(0,3,-.5,1,0));
  await wait(()=>window.cafeLayoutState.tables.some(p=>p.id===20));
  await page.evaluate(()=>Module._cafe_equipment(0,4,.5,2,0));
  await wait(()=>window.cafeLayoutState.tables.some(p=>p.id===21));
  const cash=await page.evaluate(()=>window.cafeEconomyState.cash);
  async function style(id,plant,pot){
   await page.locator('#plant-slot').selectOption(String(id));
   await page.locator('#plant-style').selectOption(String(plant));
   await page.waitForFunction(([id,value])=>window.cafeEquipmentState.plantStyles[id-20]===value,[id,plant]);
   await page.locator('#pot-style').selectOption(String(pot));
   await page.waitForFunction(([id,value])=>window.cafeEquipmentState.potStyles[id-20]===value,[id,pot]);
  }
  for(let plant=0;plant<4;plant++){
   for(let pot=0;pot<3;pot++)await style(20,plant,pot);
   await style(20,plant,plant%3);await style(21,(plant+1)%4,(plant+1)%3);
   // One frame boundary after state publication ensures the selected meshes rendered.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.locator('#plant-style-controls').scrollIntoViewIfNeeded();await page.mouse.move(800,160);
   await page.screenshot({path:`build/evidence/plants/styles-${plant}-${backend}.png`});
   await page.locator('#viewport').screenshot({path:`build/evidence/plants/scene-${plant}-${backend}.png`});
  }
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  const styles=await page.evaluate(()=>[window.cafeEquipmentState.plantStyles,window.cafeEquipmentState.potStyles]);
  await page.evaluate(()=>Module._cafe_command(3));
  await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
  await style(20,0,0);
  await page.evaluate(()=>Module._cafe_command(4));
  await wait(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
  assert.deepEqual(await page.evaluate(()=>[window.cafeEquipmentState.plantStyles,window.cafeEquipmentState.potStyles]),styles);
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  assert.deepEqual(errors,[]);
  report.push({backend,renderer:await page.locator('#status').textContent(),styles,cash,errors});
  console.log(backend,'all 12 plant/pot combinations, free style changes, save/load, and assets passed');
  await page.close();
 }}finally{await fs.writeFile('build/evidence/plants/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
