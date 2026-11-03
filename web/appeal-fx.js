// Presentation only. All decorative pixels are authored by ImageGen.
(() => {
window.createCafeAppealFx = (summary, value) => {
 const icon=summary.querySelector('.imagegen-icon');
 const layer=document.createElement('span');layer.className='appeal-fx';layer.setAttribute('aria-hidden','true');
 const gain=document.createElement('span');gain.className='appeal-gain';layer.append(gain);
 const sprites=['halo','sparkle','sparkle','sparkle'].map((kind,i)=>{
  const img=document.createElement('img');img.src=`assets/ui/appeal-${kind}.webp`;img.alt='';img.className=`appeal-${kind}`;
  img.draggable=false;layer.append(img);return img;
 });
 summary.append(layer);
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const reduced=()=>media.matches || document.body.classList.contains('reduce-motion');
 let previous,displayed=0,target=0,frame=0,timer=0,total=0,animations=[],burstAt=-Infinity,soundAt=-Infinity,disposed=false;
 const stop=()=>{cancelAnimationFrame(frame);clearTimeout(timer);animations.forEach(a=>a.cancel());animations=[];layer.hidden=true;total=0;burstAt=-Infinity;};
 const settle=()=>{stop();displayed=target;value.textContent=String(target);};
 const animate=(el,keys,options)=>{const a=el.animate(keys,options);animations.push(a);};
 const reset=()=>{stop();previous=undefined;soundAt=-Infinity;};
 const update=score=>{
  if(disposed || !Number.isFinite(score))return;
  score=Math.max(0,Math.min(100,Math.round(score)));target=score;
  if(previous===undefined || document.hidden){previous=score;settle();return;}
  if(score===previous)return;
  const delta=score-previous,milestone=[50,75,100].some(n=>previous<n && score>=n);previous=score;
  if(delta<=0){settle();return;}
  const now=performance.now(),from=displayed;cancelAnimationFrame(frame);clearTimeout(timer);total+=delta;gain.textContent=`+${total}`;layer.hidden=false;
  // Effects bus owns volume/mute/gesture/pause; reduced motion still permits sound.
  if(now-soundAt>=700){window.Module?._cafe_audio?.(5,0);soundAt=now;}

  if(reduced()){animations.forEach(a=>a.cancel());animations=[];burstAt=-Infinity;sprites.forEach(el=>el.hidden=true);displayed=score;value.textContent=String(score);}
  else {
   const started=performance.now();
   const tick=now=>{if(reduced()){settle();return;}const t=Math.min(1,(now-started)/400);displayed=from+(target-from)*(1-(1-t)**3);value.textContent=String(Math.round(displayed));if(t<1)frame=requestAnimationFrame(tick);};
   frame=requestAnimationFrame(tick);
   // Do not rewind an active burst when several score updates arrive together.
   if(now-burstAt>=700){
    animations.forEach(a=>a.cancel());animations=[];burstAt=now;
    sprites.forEach(el=>el.hidden=true);
    animate(value,[{transform:'scale(1)',color:'#243c32'},{transform:'scale(1.22)',color:'#b77918',offset:.3},{transform:'scale(1.12)',color:'#b77918',offset:.65},{transform:'scale(1)',color:'#243c32'}],{duration:650,easing:'ease-out'});
    animate(icon,[{transform:'translateY(0) rotate(0) scale(1)'},{transform:`translateY(-${milestone?10:7}px) rotate(-12deg) scale(${milestone?1.3:1.2})`,offset:.3},{transform:'translateY(1px) rotate(6deg)',offset:.7},{transform:'translateY(0) rotate(0) scale(1)'}],{duration:650,easing:'ease-in-out'});
    animate(gain,[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,fill:'forwards'});
    sprites.slice(1).forEach((el,i)=>{el.hidden=false;const [x,y]=[[-21,-17],[23,-20],[28,10]][i];animate(el,[{opacity:0,transform:`translate(${x*.4}px,${y*.4}px) scale(.65)`},{opacity:1,transform:`translate(${x*.75}px,${y*.75}px) scale(1.05)`,offset:.25},{opacity:1,offset:.55},{opacity:0,transform:`translate(${x}px,${y}px) scale(.8)`}],{duration:950,delay:i*50,fill:'both'});});
   }
   if(milestone){sprites[0].hidden=false;animate(sprites[0],[{opacity:0,transform:'scale(.55)'},{opacity:.85,offset:.2},{opacity:0,transform:'scale(1.5)'}],{duration:900,fill:'both'});}
  }
  timer=setTimeout(settle,1500);
 };
 layer.hidden=true;
 const onVisibility=()=>{if(document.hidden)settle();};
 const onMotion=()=>{if(reduced())settle();};
 const observer=new MutationObserver(onMotion);observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onMotion);
 window.addEventListener('cafe-session-replaced',reset);
 window.addEventListener('pagehide',()=>{disposed=true;stop();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onMotion);window.removeEventListener('cafe-session-replaced',reset);},{once:true});
 return {update};
};
})();
