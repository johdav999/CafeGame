import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('integrated cafe WAVs match provenance and the browser PCM contract',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
 const provenance=JSON.parse(readFileSync(new URL('../assets/audio/elevenlabs-provenance.json',import.meta.url)));
 assert.equal(manifest.audio.length,13);assert.equal(new Set(manifest.audio.map(a=>a.id)).size,13);
 assert.equal(manifest.audio.find(a=>a.id===12)?.path,'audio/appeal.wav');
 for(const asset of manifest.audio){
  const background=asset.provenance==='audio/cafe-background-provenance.json'?JSON.parse(readFileSync(new URL('../assets/'+asset.provenance,import.meta.url))):null;
  const record=background?background.asset:provenance.assets.find(a=>a.id===asset.id);assert.equal(record.path,asset.path);
  const wav=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(wav).digest('hex'),record.sha256);
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(4),wav.length-8);
  assert.equal(wav.toString('ascii',8,16),'WAVEfmt ');assert.equal(wav.readUInt32LE(16),16);
  assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),1);
  assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt16LE(34),16);
  assert.equal(wav.toString('ascii',36,40),'data');assert.equal(wav.readUInt32LE(40),wav.length-44);
  const count=(wav.length-44)/2;assert.ok(count>0 && count<=(asset.id===3?480000:160000));
  assert.ok(wav.length<1024*1024);let peak=0,sum=0;
  for(let i=44;i<wav.length;i+=2){const x=wav.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(x));sum+=x*x;}
  assert.ok(peak<=.451);assert.ok(Math.sqrt(sum/count)>.001,'Reject silent exports');
  if(asset.id===3)assert.ok(Math.abs(wav.readInt16LE(44)-wav.readInt16LE(wav.length-2))/32768<.01,'Continuous ambience seam');
  else{assert.equal(wav.readInt16LE(44),0);assert.equal(wav.readInt16LE(wav.length-2),0);}
  if(background){
   assert.equal(asset.id,3);assert.equal(record.provider,'user-provided');assert.equal(background.sources.length,2);
   for(const source of background.sources)assert.equal(createHash('sha256').update(readFileSync(new URL('../'+source.path,import.meta.url))).digest('hex'),source.sha256);
   assert.ok(count/16000>15 && count/16000<16,'Both supplied clips must be present in the loop');
  }else{assert.equal(record.provider,'elevenlabs');assert.equal(record.request.model_id,'eleven_text_to_sound_v2');}
 }
});
