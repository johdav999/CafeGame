// Real browser/Wasm acceptance for the mobile catalogue and explicit placement flow.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.CAFE_URL||'http://127.0.0.1:4173/';
const evidence='build/evidence/mobile-build';
(async()=>{
 await fs.mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server']});
 const report=[];
 try{
  for(const backend of ['webgl2','automatic']){
   const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:844,height:390},deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}?backend=${backend}`);
   const wait=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:90000});
   await wait(()=>window.cafeInspectorState&&Module._cafe_floor_pick&&window.cafeBuildPlacement);
   await page.evaluate(()=>Module._cafe_scenario(4));await wait(()=>window.cafeLayoutState.editable);
   await page.locator('#build-tab').click();
   await page.locator('#mobile-build-header').waitFor({state:'visible'});
   const cash=()=>page.evaluate(()=>window.cafeEconomyState.cash);
   async function fits(ids){
    const bounds=await page.evaluate(ids=>ids.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),ids);
    const viewport=page.viewportSize();
    for(const r of bounds){assert(r.width>0&&r.height>0,`${r.id} has no size`);assert(r.x>=-1&&r.y>=-1&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1,`${r.id} outside viewport: ${JSON.stringify(r)}`);}
    const scene=await page.locator('#viewport').boundingBox();assert(scene.height>=viewport.height*.4&&scene.width>=viewport.width*.4,'café scene must remain usable');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false,'page overflow');
    return bounds;
   }
   await fits(['mobile-build-header','play-drawer','mobile-build-tools']);
   await page.screenshot({path:`${evidence}/${backend}-browse.png`});
   await page.locator('#mobile-build-category-decor').tap();
   assert.equal(await page.locator('[data-place-item="1"]').isVisible(),false);
   assert.equal(await page.locator('[data-place-item="20"]').isVisible(),true);
   const initial=await cash();
   const select=async id=>{await page.locator(`[data-place-item="${id}"]`).tap();await wait(()=>window.cafeBuildPlacement.state.active&&document.getElementById('play-shell').dataset.buildPlacing==='true');};
   const target=async(id,valid=true)=>page.evaluate(({id,valid})=>{
    const c=document.getElementById('viewport'),r=c.getBoundingClientRect(),item=window.cafeEquipmentState.catalog.find(i=>i.id===id),rot=Number(document.getElementById('layout-rotation').value),w=rot%2?(item?.depth||8):(item?.width||4),d=rot%2?(item?.width||4):(item?.depth||8),old=window.cafeLayoutState.tables.find(i=>i.id===id),seen=new Set();
    for(let y=12;y<r.height;y+=7)for(let x=12;x<r.width;x+=7){
     if(document.elementFromPoint(r.left+x,r.top+y)!==c)continue;
     const cell=Module._cafe_floor_pick(x/r.width,y/r.height,r.width/r.height);if(cell<0||seen.has(cell))continue;seen.add(cell);
     const gx=(cell<480?cell%24:24+(cell-480)%12)-Math.floor(w/2),gz=(cell<480?Math.floor(cell/24):Math.floor((cell-480)/12))-Math.floor(d/2);
     if(old&&old.x===gx&&old.z===gz)continue;
     if((Module._cafe_layout_preview(id,gx*.5-6,gz*.5-5,rot)===0)===valid)return{x:r.left+x,y:r.top+y,gx,gz,rot};
    }throw Error(`No visible ${valid?'valid':'invalid'} floor target for ${id}`);
   },{id,valid});
   const tap=async p=>page.touchscreen.tap(p.x,p.y);
   await select(20);assert(await page.locator('#play-drawer').isHidden());assert(await page.locator('#mobile-build-confirm').isDisabled());
   await fits(['mobile-build-header','mobile-build-placement']);
   await tap(await target(20,false));assert(await page.locator('#mobile-build-confirm').isDisabled());assert.equal(await cash(),initial);
   await tap(await target(20));await wait(()=>window.cafeBuildPlacement.state.valid);
   const rotation=await page.locator('#layout-rotation').inputValue();await page.locator('#mobile-build-rotate').tap();
   assert.equal(await page.locator('#layout-rotation').inputValue(),String((Number(rotation)+1)%4));
   await tap(await target(20));await wait(()=>window.cafeBuildPlacement.state.valid);
   assert.equal(await cash(),initial,'preview must not spend money');
   await page.screenshot({path:`${evidence}/${backend}-place.png`});
   await page.evaluate(()=>{document.getElementById('mobile-build-confirm').click();document.getElementById('mobile-build-confirm').click();});
   await wait(()=>window.cafeLayoutState.tables.some(p=>p.id===20)&&!window.cafeBuildPlacement.state.pending);
   assert.equal(await cash(),initial-200,'purchase charges exactly once');
   await select(20);const destination=await target(20);await tap(destination);await wait(()=>window.cafeBuildPlacement.state.valid);
   await page.locator('#mobile-build-confirm').tap();
   await wait(t=>window.cafeLayoutState.tables.some(p=>p.id===20&&p.x===t.gx&&p.z===t.gz)&&!window.cafeBuildPlacement.state.pending,destination);
   assert.equal(await cash(),initial-200,'moving is free');
   const layout=await page.evaluate(()=>JSON.stringify(window.cafeLayoutState.tables));
   await select(20);await tap(await target(20));await page.locator('#mobile-build-cancel').tap();
   await wait(()=>!window.cafeBuildPlacement.state.active);
   assert.equal(await page.evaluate(()=>JSON.stringify(window.cafeLayoutState.tables)),layout);assert.equal(await cash(),initial-200);
   await select(20);await page.locator('#mobile-build-sell').tap();await page.locator('#mobile-build-sale-cancel').tap();
   assert(await page.locator('#mobile-build-sale').isHidden());assert.equal(await cash(),initial-200);
   await page.locator('#mobile-build-sell').tap();await page.keyboard.press('Escape');
   assert(await page.locator('#mobile-build-sale').isHidden());assert.equal(await page.evaluate(()=>window.cafeBuildPlacement.state.active),true,'Escape dismisses the sale dialog without discarding placement');
   await page.locator('#mobile-build-sell').tap();await page.locator('#mobile-build-sale-confirm').tap();
   await wait(()=>!window.cafeLayoutState.tables.some(p=>p.id===20)&&!window.cafeBuildPlacement.state.pending);assert.equal(await cash(),initial-100);
   await page.locator('#mobile-build-owned').tap();assert(await page.locator('[data-place-item="20"]').isHidden());
   await page.locator('#mobile-build-owned').tap();
   for(const size of [{width:568,height:320},{width:390,height:844},{width:1194,height:834}]){
    await page.setViewportSize(size);
    if(size.width<size.height)await page.locator('#landscape-dismiss').tap();
    await fits(['mobile-build-header','play-drawer','mobile-build-tools']);
    await page.screenshot({path:`${evidence}/${backend}-${size.width}-browse.png`});
    await select(20);await fits(['mobile-build-header','mobile-build-placement']);
    await page.locator('#mobile-build-cancel').tap();
    await page.locator('#play-drawer').waitFor({state:'visible'});
   }
   await page.locator('#mobile-build-category-equipment').tap();
   await page.locator('#equipment-panel>summary').tap();assert(await page.locator('#finish-select').isVisible());
   await page.locator('#finish-select').selectOption('1');await wait(()=>window.cafeEquipmentState.finish===1);
   await page.locator('#mobile-build-done').tap();assert(await page.locator('#serve-tab').isVisible());assert(await page.locator('#mobile-build-header').isHidden());
   await page.locator('#build-tab').tap();
   await page.evaluate(()=>Module._cafe_command(15));await wait(()=>!window.cafeLayoutState.closed);
   await page.locator('#mobile-build-category-tables').tap();await wait(()=>[...document.querySelectorAll('.build-card')].every(b=>b.disabled));
   assert(await page.locator('#build-state-action').isVisible());
   await page.locator('#build-state-action').tap();await wait(()=>window.cafeLayoutState.editable);
   await page.locator('#mobile-build-category-decor').tap();await select(20);
   const beforePause=await cash();await page.evaluate(()=>Module._cafe_command(2));await wait(()=>window.cafeState.paused&&!window.cafeBuildPlacement.state.active);
   assert.equal(await cash(),beforePause);await page.locator('#build-state-action').tap();await wait(()=>!window.cafeState.paused);
   assert.deepEqual(errors,[]);report.push({backend,phone:true,purchase:true,freeMove:true,cancel:true,sale:true,errors});console.log(`${backend}: mobile purchase, preview, rotation, free move, cancellation, sale, gating and responsive layouts passed`);
   await context.close();
   const desktop=await browser.newPage({viewport:{width:1440,height:900}});
   await desktop.goto(`${base}?backend=${backend}`);await desktop.waitForFunction(()=>window.cafeBuildPlacement&&window.cafeInspectorState,null,{timeout:90000});
   await desktop.locator('#build-tab').click();assert(await desktop.locator('#mobile-build-header').isHidden());assert(await desktop.locator('#scene-place').isVisible());
   await desktop.close();
   const tablet=await browser.newPage({...devices['iPad Pro 11'],viewport:{width:1194,height:834},deviceScaleFactor:1});
   await tablet.goto(`${base}?backend=${backend}`);await tablet.waitForFunction(()=>window.cafeBuildPlacement&&window.cafeInspectorState,null,{timeout:90000});
   assert.equal(await tablet.evaluate(()=>document.documentElement.dataset.device),'tablet');
   await tablet.locator('#build-tab').tap();assert(await tablet.locator('#mobile-build-header').isVisible());
   await tablet.screenshot({path:`${evidence}/${backend}-tablet.png`});await tablet.close();
  }
  await fs.writeFile(`${evidence}/report.json`,JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
