const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of (process.env.CAFE_BACKENDS?.split(',')||['webgl2','automatic'])){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(process.env.CAFE_RENDER_SCALE)await page.addInitScript(scale=>Object.defineProperty(window,'devicePixelRatio',{value:scale,configurable:true}),Number(process.env.CAFE_RENDER_SCALE));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>=30,null,{timeout:90000});
  const assets=await page.evaluate(()=>window.cafeAssetState);
  assert.deepEqual(assets.failures,[]);assert.equal(assets.models,25);assert.equal(assets.audio,12);
  await page.getByRole('button',{name:'Begin guided shift',exact:true}).click();
  await page.screenshot({path:`build/evidence/cafe-models-${backend}.png`});
  for(const [view,yaw,tilt] of [['orbit-right',1.4,0],['orbit-left',-1.4,0],['overhead',0,.4]]){
    const frames=await page.evaluate(([yaw,tilt])=>{Module._cafe_camera(0,0,0);Module._cafe_camera(1,yaw,tilt);return window.cafeRenderMeasurements.frames;},[yaw,tilt]);
    await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>n+3,frames,{timeout:60000});
    await page.screenshot({path:`build/evidence/cafe-models-${backend}-${view}.png`});
  }
  const closeFrame=await page.evaluate(()=>{Module._cafe_camera(0,0,0);Module._cafe_camera(3,-3.8,0);return window.cafeRenderMeasurements.frames;});
  await page.waitForFunction(n=>window.cafeRenderMeasurements.frames>n+3,closeFrame,{timeout:60000});
  await page.screenshot({path:`build/evidence/cafe-models-${backend}-close.png`});
  // Rejected replacements must leave the published models intact, including new slots.
  const rejected=await page.evaluate(()=>{const p=Module._malloc(16);try{HEAPU8.fill(0,p,p+16);return [0,5,6,7,8,9,10,11,12,22,23,24,-1].map(id=>Module._cafe_model(id,p,16));}finally{Module._free(p);}});
  assert.ok(rejected.every(x=>x===0));
  reports.push({backend,assets,status:await page.locator('#status').textContent(),errors});
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();await fs.writeFile('build/evidence/cafe-models-browser.json',JSON.stringify(reports,null,2));}
 console.log(JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
