const {chromium}=require('playwright');
const {writeFile,mkdir}=require('node:fs/promises');
(async()=>{
 await mkdir('build/evidence',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--no-proxy-server']});
 const report={date:new Date().toISOString(),browser:browser.version(),launch:'headless; no software-renderer flags; no physical mobile',errors:[]};
 try{const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/assets/manifest.json`);
  report.adapter=await page.evaluate(async()=>{if(!navigator.gpu)return null;const a=await navigator.gpu.requestAdapter();if(!a)return null;return {fallback:a.info?.isFallbackAdapter ?? a.isFallbackAdapter ?? null,vendor:a.info?.vendor,architecture:a.info?.architecture,description:a.info?.description,device:a.info?.device};});
  report.hardwareIdentified=!!report.adapter && report.adapter.fallback===false && !/swiftshader|software|llvmpipe|warp|basic render/i.test(JSON.stringify(report.adapter));
  if(report.hardwareIdentified){await page.goto(`${process.env.CAFE_URL||'http://127.0.0.1:4173'}/?backend=automatic`);await page.waitForFunction(()=>window.cafeAssetsReady && window.cafeRenderMeasurements?.frames>=60,null,{timeout:60000});report.render=await page.evaluate(()=>({status:document.getElementById('status').textContent,assets:window.cafeAssetState,measurements:window.cafeRenderMeasurements}));}
  console.log(JSON.stringify(report,null,2));
 }finally{await writeFile('build/evidence/release-device-probe.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
