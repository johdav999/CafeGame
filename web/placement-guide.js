// World-aligned placement overlays use the engine camera and layout preview.
(() => {
const scene=document.querySelector('.game'),canvas=document.getElementById('viewport'),ns='http://www.w3.org/2000/svg';
const svg=document.createElementNS(ns,'svg');svg.id='placement-guide';svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.style.display='none';
const path=className=>{const p=document.createElementNS(ns,'path');p.setAttribute('class',className);svg.append(p);return p;};
const blocked=path('guide-blocked'),valid=path('guide-valid'),footprint=path('guide-footprint'),access=path('guide-access');scene.append(svg);
const key=document.createElement('div');key.id='placement-guide-key';key.hidden=true;key.innerHTML='<strong>Placement guide</strong><span class="guide-good">Green floor: valid drop positions</span><span>Red: footprint or route blocked</span><span>Gold square: keep access clear</span><small>Q rotates · Escape cancels</small>';scene.append(key);
let selected=null,points=null,mask=null,maskSignature='',pointer=0,lastDraw=0,current=null,generation=0;
function dims(){const i=window.cafeEquipmentState?.catalog.find(i=>i.id===selected.id),w=i?.width||4,d=i?.depth||8;return{w,d,r:selected.rotation,rw:selected.rotation%2?d:w,rd:selected.rotation%2?w:d};}
function project(x,z){if(!Module._cafe_floor_project(x,z,canvas.clientWidth/canvas.clientHeight,pointer))return null;return[HEAPF32[pointer/4],HEAPF32[pointer/4+1]];}
const quad=(a,b,c,d)=>[a,b,c,d].every(Boolean)?`M${a.join(',')}L${b.join(',')}L${c.join(',')}L${d.join(',')}Z`:'';
function floorRect(x,z,w,d){return quad(project(-6+x*.5,-5+z*.5),project(-6+(x+w)*.5,-5+z*.5),project(-6+(x+w)*.5,-5+(z+d)*.5),project(-6+x*.5,-5+(z+d)*.5));}
function draw(now,run){
 if(!selected||run!==generation)return;
 if(!Module._cafe_floor_project||!Module._cafe_layout_preview){requestAnimationFrame(t=>draw(t,run));return;}
 if(now-lastDraw>180){
  lastDraw=now;if(!pointer)pointer=Module._malloc(8);
  const cols=window.cafeGardenState?.open?36:24,stride=cols+1;const {w,d,r,rw,rd}=dims(),signature=JSON.stringify([selected,window.cafeLayoutState?.tables]);
  if(signature!==maskSignature){maskSignature=signature;mask=[];for(let z=0;z<20;z++)for(let x=0;x<cols;x++)mask.push(Module._cafe_layout_preview(selected.id,-6+(x-Math.floor(rw/2))*.5,-5+(z-Math.floor(rd/2))*.5,r)===0);}
  points=[];for(let z=0;z<=20;z++)for(let x=0;x<=cols;x++)points.push(project(-6+x*.5,-5+z*.5));
  let good='',bad='';for(let z=0;z<20;z++)for(let x=0;x<cols;x++){const q=quad(points[z*stride+x],points[z*stride+x+1],points[(z+1)*stride+x+1],points[(z+1)*stride+x]);if(mask[z*cols+x])good+=q;else bad+=q;}
  valid.setAttribute('d',good);blocked.setAttribute('d',bad);svg.dataset.validCells=String(mask.filter(Boolean).length);
  if(current){footprint.setAttribute('d',floorRect(current.x,current.z,rw,rd));footprint.dataset.valid=String(current.valid);
   const a=[[current.x+Math.floor(w/2),current.z+d],[current.x-1,current.z+Math.floor(w/2)],[current.x+Math.floor((w-1)/2),current.z-1],[current.x+d,current.z+Math.floor((w-1)/2)]][r];access.setAttribute('d',floorRect(a[0],a[1],1,1));}
 }
 requestAnimationFrame(t=>draw(t,run));
}
window.cafePlacementGuide={show(id,rotation){document.body.classList.add('placing-object');const run=++generation;selected={id,rotation};current=null;maskSignature='';lastDraw=-Infinity;svg.style.display='';key.hidden=false;footprint.setAttribute('d','');access.setAttribute('d','');requestAnimationFrame(t=>draw(t,run));},move(x,z,rotation,isValid){if(!selected)return;selected.rotation=rotation;current={x,z,valid:isValid};lastDraw=-Infinity;},hide(){document.body.classList.remove('placing-object');++generation;selected=null;current=null;svg.style.display='none';key.hidden=true;},};
addEventListener('pagehide',()=>{if(pointer&&Module._free)Module._free(pointer);pointer=0;selected=null;});
})();
