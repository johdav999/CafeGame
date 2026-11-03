const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('build/evidence/storage-shelves',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,null,{timeout:120000});
  await page.goto(`http://127.0.0.1:4173/?backend=${backend}`);
  await wait(()=>window.cafeAssetsReady);
  assert.deepEqual(await page.evaluate(()=>window.cafeAssetState.failures),[]);
  assert.equal(await page.evaluate(()=>window.cafeAssetState.models),25);
  await page.evaluate(()=>Module._cafe_scenario(4));
  await wait(()=>window.cafeLayoutState.editable && window.cafeEconomyState.cash===100000);
  await page.evaluate(()=>Module._cafe_equipment(0,2,-.5,1,0));
  await wait(()=>window.cafeLayoutState.tables.some(p=>p.id===11));
  const cash=await page.evaluate(()=>window.cafeEconomyState.cash);assert.equal(cash,98000);
  for(let rotation=0;rotation<4;rotation++){
   await page.evaluate(r=>Module._cafe_equipment(1,2,-.5,1,r),rotation);
   await page.waitForFunction(r=>window.cafeLayoutState.tables.some(p=>p.id===11 && p.rotation===r),rotation);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.mouse.move(800,100);
   await page.screenshot({path:`build/evidence/storage-shelves/rotation-${rotation}-${backend}.png`});
  }
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  await page.evaluate(()=>Module._cafe_command(3));
  await wait(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
  await page.evaluate(()=>Module._cafe_equipment(2,2,0,0,0));
  await wait(()=>!window.cafeLayoutState.tables.some(p=>p.id===11));
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),99000);
  await page.evaluate(()=>Module._cafe_command(4));
  await wait(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
  assert.equal(await page.evaluate(()=>window.cafeLayoutState.tables.find(p=>p.id===11).rotation),3);
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  const rejected=await page.evaluate(()=>{const p=Module._malloc(16);try{HEAPU8.fill(0,p,p+16);return Module._cafe_model(23,p,16);}finally{Module._free(p);}});
  assert.equal(rejected,0);
  assert.deepEqual(errors,[]);
  reports.push({backend,renderer:await page.locator('#status').textContent(),purchase:true,rotations:4,sell:true,restore:true,rejectedInvalidModel:true,errors});
  await page.close();
 }}finally{await browser.close();await fs.writeFile('build/evidence/storage-shelves/report.json',JSON.stringify(reports,null,2));}
 console.log(JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
