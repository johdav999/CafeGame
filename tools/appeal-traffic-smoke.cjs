const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const dir='build/evidence/appeal-traffic';await fs.mkdir(dir,{recursive:true});
 const fixture=(await fs.readFile(`${dir}/appeal-63.bin`)).toString('base64');
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-proxy-server']});
 const reports=[];
 try{for(const backend of ['webgl2','automatic']){
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=${backend}`);
  await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeInspectorState?.report,null,{timeout:120000});
  await page.evaluate(data=>{localStorage.setItem('cafegame.shift.v1',data);Module._cafe_command(4);},fixture);
  await page.waitForFunction(()=>window.cafeState.served===6 && window.cafeInspectorState.report.attractiveness===63);
  const initial=await page.evaluate(()=>({admitted:window.cafeDemandState.admitted,visitors:window.cafeInspectorState.report.visitingGuests,cap:window.cafeInspectorState.report.visitorLimit}));
  assert.equal(initial.visitors,0);assert.equal(initial.cap,5);
  // No manual guest insertion or clock acceleration: await real automatic traffic.
  await page.waitForFunction(n=>window.cafeDemandState.admitted>n,initial.admitted,{timeout:20000});
  const nextMs=await page.evaluate(()=>window.cafeDemandState.remaining);assert.ok(nextMs>0 && nextMs<=20000);
  await page.waitForFunction(()=>window.cafeInspectorState.report.visitingGuests>=2,null,{timeout:22000});
  await page.evaluate(()=>Module._cafe_command(2));await page.waitForFunction(()=>window.cafeState.paused);
  const result=await page.evaluate(()=>({appeal:window.cafeInspectorState.report.attractiveness,visitors:window.cafeInspectorState.report.visitingGuests,cap:window.cafeInspectorState.report.visitorLimit,admitted:window.cafeDemandState.admitted,renderer:document.getElementById('status').textContent}));
  assert.ok(result.visitors<=result.cap);assert.equal(result.admitted,initial.admitted+2);
  await page.screenshot({path:`${dir}/${backend}.png`});assert.deepEqual(errors,[]);
  reports.push({backend,initial,nextMs,...result,errors});await page.close();
 }}finally{await browser.close();}
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(reports,null,2));console.log(reports);
})().catch(e=>{console.error(e);process.exitCode=1;});
