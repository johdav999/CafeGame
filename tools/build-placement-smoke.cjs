const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {for(const backend of ['webgl2','automatic']) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4173/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeInspectorState && Module._cafe_floor_pick,null,{timeout:120000});
  await page.evaluate(()=>Module._cafe_scenario(4));
  await page.waitForFunction(()=>window.cafeLayoutState.editable);
  await page.evaluate(()=>document.getElementById('build-tab').click());
  const target=async valid=>page.evaluate(valid=>{
   const c=document.getElementById('viewport'),r=c.getBoundingClientRect();
   for(let y=10;y<r.height;y+=6)for(let x=10;x<r.width;x+=6){
    if(document.elementFromPoint(r.left+x,r.top+y)!==c)continue;
    const cell=Module._cafe_floor_pick(x/r.width,y/r.height,r.width/r.height);if(cell<0)continue;
    const wx=(cell%24)*.5-6,wz=Math.floor(cell/24)*.5-5;
    if((Module._cafe_layout_preview(20,wx,wz,0)===0)===valid)return {x:r.left+x,y:r.top+y};
   }throw Error('No visible target');
  },valid);
  const drag=async p=>{const b=page.locator('[data-place-item="20"]');await b.scrollIntoViewIfNeeded();const r=await b.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();};
  const cash=await page.evaluate(()=>window.cafeEconomyState.cash);
  await drag(await target(false));
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash);
  await drag(await target(true));
  await page.waitForFunction(()=>window.cafeLayoutState.tables.some(p=>p.id===20));
  assert.equal(await page.evaluate(()=>window.cafeEconomyState.cash),cash-200);
  await page.locator('[data-place-item="20"]').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#scene-cancel').isVisible(),false);
  await page.screenshot({path:`build/evidence/build-placement-${backend}.png`});
  assert.deepEqual(errors,[]);console.log(`${backend}: valid purchase, invalid drop, cancellation passed`);
  await page.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
