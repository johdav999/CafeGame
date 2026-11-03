const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/window-wall';await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of (process.env.CAFE_BACKENDS||'webgl2,automatic').split(',')){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:Number(process.env.CAFE_RENDER_SCALE||.75)}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.CAFE_WINDOW_CANDIDATE){
   await page.route('**/assets/manifest.json',async route=>{
    const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
    manifest.models.push({id:24,path:'models/cafe-window-wall.glb'});
    await route.fulfill({json:manifest});
   });
   await page.route('**/assets/models/cafe-window-wall.glb',route=>route.fulfill({path:process.env.CAFE_WINDOW_CANDIDATE,contentType:'model/gltf-binary'}));
  }
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>=10,null,{timeout:180000});
  const assets=await page.evaluate(()=>window.cafeAssetState);assert.deepEqual(assets.failures,[]);assert.equal(assets.models,25);assert.equal(assets.audio,12);
  await page.evaluate(()=>Module._cafe_command(2));
  for(const [name,yaw,tilt,zoom] of [['default',0,0,0],['left',-1.4,0,0],['right',1.4,0,0],['overhead',0,.4,0],['close',0,0,-3.8]]){
   const frame=await page.evaluate(([yaw,tilt,zoom])=>{Module._cafe_camera(0,0,0);Module._cafe_camera(1,yaw,tilt);Module._cafe_camera(3,zoom,0);return window.cafeRenderMeasurements.frames;},[yaw,tilt,zoom]);
   await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>n+3,frame,{timeout:90000});
   await page.screenshot({path:`${dir}/${backend}-${name}.png`});
  }
  const rejected=await page.evaluate(()=>{const p=Module._malloc(16);try{HEAPU8.fill(0,p,p+16);return Module._cafe_model(24,p,16);}finally{Module._free(p);}});assert.equal(rejected,0);
  await page.screenshot({path:`${dir}/${backend}-after-rejection.png`});
  assert.deepEqual(errors,[]);reports.push({backend,renderer:await page.locator('#status').textContent(),assets,rejectedInvalidReplacement:true,errors});await page.close();
 }}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
 console.log(JSON.stringify(reports,null,2));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
