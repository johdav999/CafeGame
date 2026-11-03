import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('each lifetime achievement has a distinct compact ImageGen badge with alpha and provenance',()=>{
  const catalog=readFileSync(new URL('../src/journal.inc',import.meta.url),'utf8').split('lifetimeGoals{{')[1].split('}};')[0];
  const names=[...catalog.matchAll(/\{"([^"]+)",/g)].map(m=>m[1]);
  const art=JSON.parse(readFileSync(new URL('../assets/ui/achievements/provenance.json',import.meta.url)));
  assert.equal(art.provider,'OpenAI built-in ImageGen');assert.equal(art.files.length,names.length);
  assert.equal(new Set(art.files.map(a=>a.sha256)).size,names.length);
  for(const [id,name] of names.entries()){
    const entry=art.files.find(a=>a.id===id);assert.equal(entry.goalName,name);assert.ok(entry.prompt.includes(entry.motif));
    const bytes=readFileSync(new URL('../assets/'+entry.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(bytes.length,entry.bytes);assert.ok(bytes.length<=120000);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    let alpha=false;for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='ALPH')alpha=true;offset+=8+size+(size%2);}
    assert.ok(alpha,`Badge ${id} must retain generated transparency`);assert.ok(entry.dimensions.every(n=>n>0 && n<=384));
  }
});
