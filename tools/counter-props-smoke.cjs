const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const names=['kettle','milk-jug','counter-beans','stored-beans','queue-marker'];
(async()=>{
 const dir='build/evidence/counter-props';await fs.mkdir(dir,{recursive:true});
 const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.CAFE_PROP_CANDIDATES){
   await page.route('**/assets/manifest.json',async route=>{
    const candidate=structuredClone(manifest);
    names.forEach((name,n)=>{if(!candidate.models.some(m=>m.id===25+n))candidate.models.push({id:25+n,path:`models/cafe-${name}.glb`});});
    await route.fulfill({json:candidate});
   });
   for(const name of names)await page.route(`**/assets/models/cafe-${name}.glb`,route=>route.fulfill({path:`assets/generated/counter-props-20261030/${name}/final/cafe-${name}.glb`,contentType:'model/gltf-binary'}));
  }
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>=10,null,{timeout:180000});
  const assets=await page.evaluate(()=>window.cafeAssetState);
  assert.deepEqual(assets.failures,[]);assert.equal(assets.models,30);
  await page.evaluate(()=>{Module._cafe_scenario(2);});
  await page.waitForFunction(()=>window.cafeMenuState?.ingredients[0].stock===100);
  await page.evaluate(()=>{if(!window.cafeState.paused)Module._cafe_command(2);});
  for(const [name,yaw,tilt,zoom] of [['default',0,0,0],['left',-1.4,0,-3.8],['right',1.4,0,-3.8],['overhead',0,.6,-3.8],['close',0,0,-3.8]]){
   const frame=await page.evaluate(([yaw,tilt,zoom])=>{Module._cafe_camera(0,0,0);Module._cafe_camera(1,yaw,tilt);Module._cafe_camera(3,zoom,0);return window.cafeRenderMeasurements.frames;},[yaw,tilt,zoom]);
   await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>n+3,frame,{timeout:90000});
   await page.screenshot({path:`${dir}/${backend}-${name}.png`});
  }
  const rejected=await page.evaluate(()=>{const p=Module._malloc(16);try{HEAPU8.fill(0,p,p+16);return [25,26,27,28,29].map(id=>Module._cafe_model(id,p,16));}finally{Module._free(p);}});
  assert.deepEqual(rejected,[0,0,0,0,0]);
  await page.evaluate(()=>Module._cafe_command(3));
  await page.waitForFunction(()=>document.getElementById('save-status').textContent.startsWith('Shift saved'));
  await page.evaluate(()=>Module._cafe_scenario(1));
  await page.waitForFunction(()=>window.cafeMenuState.ingredients[0].stock===1);
  await page.screenshot({path:`${dir}/${backend}-low-stock.png`});
  await page.evaluate(()=>Module._cafe_command(4));
  await page.waitForFunction(()=>document.getElementById('save-status').textContent==='Saved shift restored.');
  assert.equal(await page.evaluate(()=>window.cafeMenuState.ingredients[0].stock),100);
  await page.screenshot({path:`${dir}/${backend}-restored.png`});
  assert.deepEqual(errors,[]);
  reports.push({backend,renderer:await page.locator('#status').textContent(),assets,rejectedInvalidReplacements:rejected,saveRestore:true,errors});
  await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await browser.close();}
 console.log(JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
