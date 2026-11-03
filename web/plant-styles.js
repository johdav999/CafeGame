// Appearance selections travel through the game command queue and shift save.
(() => {
  const panel=document.createElement('section');panel.id='plant-style-controls';panel.hidden=true;
  panel.innerHTML='<h3>Plant and pot</h3><p>Mix any plant with any pot. Style changes are free; purchase price, floor space and furnishing points stay the same.</p><div class="actions"><label>Plant set <select id="plant-slot"><option value="20">Sage plant set</option><option value="21">Terracotta plant set</option></select></label><label>Plant <select id="plant-style"></select></label><label>Pot <select id="pot-style"></select></label></div>';
  document.getElementById('scene-items').after(panel);
  const plant=document.getElementById('plant-style'),pot=document.getElementById('pot-style'),slot=document.getElementById('plant-slot');
  let signature;
  function render() {
    const state=window.cafeEquipmentState,selected=Number(document.getElementById('layout-id').value);
    const id=selected>=20 && selected<=21?selected:Number(slot.value);
    panel.hidden=!state?.plantNames;if(panel.hidden)return;
    slot.value=String(id);
    const next=JSON.stringify([id,state.plantStyles,state.potStyles,state.editable,window.cafeHostError]);
    if(next===signature)return;signature=next;
    for(const [select,names,value] of [[plant,state.plantNames,state.plantStyles[id-20]],[pot,state.potNames,state.potStyles[id-20]]]) {
      if(select.options.length!==names.length)select.replaceChildren(...names.map((name,n)=>{const option=document.createElement('option');option.value=n;option.textContent=name;return option;}));
      select.value=String(value);select.disabled=!state.editable || !!window.cafeHostError;
    }
  }
  slot.addEventListener('change',()=>{const field=document.getElementById('layout-id');field.value=slot.value;field.dispatchEvent(new Event('change'));});
  for(const select of [plant,pot])select.addEventListener('change',()=>Module._cafe_equipment(4,Number(slot.value),Number(plant.value),0,Number(pot.value)));
  document.getElementById('layout-id').addEventListener('change',render);
  const publish=window.cafeEquipment;
  window.cafeEquipment=json=>{publish(json);render();};
})();
