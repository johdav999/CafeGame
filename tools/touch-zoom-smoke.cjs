// Exercise real browser touch events against the built game and camera projection.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const evidence='build/evidence/touch-zoom';
(async()=>{
 await fs.mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-proxy-server']});
 const report=[];
 try{for(const backend of ['webgl2','automatic']){
  const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:844,height:390},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(process.env.CAFE_URL||'http://127.0.0.1:4173/');url.searchParams.set('backend',backend);
  await page.goto(url.href);await page.waitForFunction(()=>window.cafeInspectorState&&Module._cafe_floor_project&&window.cafeBuildPlacement,null,{timeout:90000});
  await page.evaluate(()=>Module._cafe_scenario(4));await page.waitForFunction(()=>window.cafeLayoutState.editable);
  await page.evaluate(()=>{
   window.zoomCalls=[];window.zoomCommands=[];
   const camera=Module._cafe_camera,command=Module._cafe_command;
   Module._cafe_camera=(...args)=>{zoomCalls.push(args);return camera(...args);};
   Module._cafe_command=(...args)=>{zoomCommands.push(args);return command(...args);};
  });
  const cdp=await context.newCDPSession(page);
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const scale=()=>page.evaluate(()=>{
   const p=Module._malloc(8),c=document.getElementById('viewport'),points=[];
   try{for(const x of [-2,2]){if(!Module._cafe_floor_project(x,0,c.clientWidth/c.clientHeight,p))throw Error('Cannot project floor');points.push([HEAPF32[p/4],HEAPF32[p/4+1]]);}
    return Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);
   }finally{Module._free(p);}
  });
  const clear=()=>page.evaluate(()=>{zoomCalls.length=0;zoomCommands.length=0;});
  const pinch=async(from,to,{remaining=false,cancel=false}={})=>{
   const r=await page.locator('#viewport').boundingBox(),x=r.x+r.width*.48,y=r.y+r.height*.45;
   const points=span=>[{id:1,x:x-span/2,y},{id:2,x:x+span/2,y}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from).slice(0,1)});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
   for(let n=1;n<=8;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*n/8)});
   if(cancel)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   else{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points(to).slice(1)});
    if(remaining)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:2,x:x+to/2+35,y:y+25}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }
   await settle();
  };
  await settle();const initial=await scale();await clear();await pinch(90,180,{remaining:true});const closer=await scale();
  assert(closer>initial*1.05,'spreading fingers must zoom the actual camera in');
  let calls=await page.evaluate(()=>zoomCalls);assert(calls.some(c=>c[0]===3&&c[1]<0));assert(!calls.some(c=>c[0]===1||c[0]===2),'pinch and remaining finger must not orbit or pan');
  assert.deepEqual(await page.evaluate(()=>zoomCommands),[],'pinching must not invoke gameplay actions');
  assert.equal(await page.evaluate(()=>visualViewport.scale),1,'pinch must zoom the game, not the browser page');
  await pinch(180,90);assert((await scale())<closer*.95,'closing fingers must zoom out');
  await pinch(36,280);await pinch(36,280);const nearLimit=await scale();await pinch(36,280);assert(Math.abs((await scale())-nearLimit)<.001,'near zoom limit');
  await pinch(280,36);await pinch(280,36);const farLimit=await scale();await pinch(280,36);assert(Math.abs((await scale())-farLimit)<.001,'far zoom limit');
  await clear();const r=await page.locator('#viewport').boundingBox(),a={id:1,x:r.x+r.width*.35,y:r.y+r.height*.45};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:a.x+40}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert((await page.evaluate(()=>zoomCalls)).some(c=>c[0]===1),'one-finger orbit must still work after pinching');
  // A fresh one-finger tap still follows the service picking path.
  await page.evaluate(()=>{window.originalStaffPick=Module._cafe_staff_pick;window.originalServicePick=Module._cafe_service_pick;Module._cafe_staff_pick=()=>0;Module._cafe_service_pick=()=>1;});
  await clear();await page.touchscreen.tap(a.x,a.y);assert((await page.evaluate(()=>zoomCommands)).some(c=>c[0]===33));
  await clear();await pinch(90,140,{remaining:true});assert.deepEqual(await page.evaluate(()=>zoomCommands),[]);
  await page.evaluate(()=>{Module._cafe_staff_pick=originalStaffPick;Module._cafe_service_pick=originalServicePick;});
  await page.locator('#build-tab').tap();await page.locator('#mobile-build-category-decor').tap();await page.locator('[data-place-item="20"]').tap();
  await page.waitForFunction(()=>document.getElementById('play-shell').dataset.buildPlacing==='true');await settle();
  const target=await page.evaluate(()=>{
   const c=document.getElementById('viewport'),r=c.getBoundingClientRect();
   for(let y=80;y<r.height-140;y+=8)for(let x=16;x<r.width-16;x+=8){
    if(document.elementFromPoint(r.x+x,r.y+y)!==c)continue;
    const cell=Module._cafe_floor_pick(x/r.width,y/r.height,r.width/r.height);if(cell<0||cell>=480)continue;
    if(Module._cafe_layout_preview(20,(cell%24)*.5-6,Math.floor(cell/24)*.5-5,0)===0)return{x:r.x+x,y:r.y+y};
   }throw Error('No valid plant position');
  });
  await page.touchscreen.tap(target.x,target.y);await page.waitForFunction(()=>window.cafeBuildPlacement.state.valid);
  const before=await page.evaluate(()=>({fields:['x','z','rotation'].map(n=>document.getElementById('layout-'+n).value),tables:JSON.stringify(cafeLayoutState.tables),cash:cafeEconomyState.cash}));
  await clear();await pinch(90,140,{remaining:true});
  assert.equal(await page.evaluate(()=>cafeBuildPlacement.state.active),true);
  assert.deepEqual(await page.evaluate(()=>['x','z','rotation'].map(n=>document.getElementById('layout-'+n).value)),before.fields,'pinching preserves the placement anchor');
  assert.equal(await page.evaluate(()=>JSON.stringify(cafeLayoutState.tables)),before.tables);assert.equal(await page.evaluate(()=>cafeEconomyState.cash),before.cash);
  await pinch(140,100,{cancel:true});assert.equal(await page.evaluate(()=>cafeBuildPlacement.state.active),true,'cancelled pinch preserves the draft');
  await page.locator('#mobile-build-cancel').tap();await page.locator('#play-drawer').waitFor({state:'visible'});
  await page.locator('#mobile-build-done').tap();
  await page.evaluate(()=>Module._cafe_command(2));await page.waitForFunction(()=>cafeState.paused);
  await clear();await pinch(100,150);assert((await page.evaluate(()=>zoomCalls)).some(c=>c[0]===3),'zoom remains available while paused');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await clear();await pinch(100,140);assert((await page.evaluate(()=>zoomCalls)).some(c=>c[0]===3),'zoom recovers after blur');
  await page.screenshot({path:`${evidence}/${backend}.png`});
  assert.deepEqual(errors,[]);report.push({backend,initialScale:initial,closerScale:closer,nearLimitScale:nearLimit,farLimitScale:farLimit,placementPreserved:true,errors});
  console.log(`${backend}: pinch in/out, camera limits, orbit, tap, placement, cancellation and paused zoom passed`);
  await cdp.detach();await context.close();
 }
 await fs.writeFile(`${evidence}/report.json`,JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
