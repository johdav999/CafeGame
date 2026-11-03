// Original artwork generated with OpenAI ImageGen; see assets/ui/provenance.json.
// HTML labels carry meaning; these transparent images are decorative.
(() => {
const names=new Set('espresso americano latte tea croissant coin sun serve build menu goal clock work check door stock person clean pause play attractiveness beans water milk tea-leaves pastry-stock service-clean-alert service-repair-alert service-refill-alert service-waiting takeaway'.split(' '));
const products=new Set('espresso americano latte tea croissant coin'.split(' '));
window.cafeArtIcon=name=>{
 if(name==='seat')name='build';
 if(!names.has(name))return null;
 const img=document.createElement('img');
 img.src=`assets/ui/${name}.webp`;img.alt='';img.setAttribute('aria-hidden','true');
 img.className=`service-icon imagegen-icon${products.has(name)?' illustrated-icon':''}`;
 img.width=192;img.height=192;img.draggable=false;
 return img;
};
})();
