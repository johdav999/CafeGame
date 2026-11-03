import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Count actual geometric boundaries after joining only coincident positions.
// Raw glTF vertex IDs split at UV/normal seams and cannot identify holes.
function exportedBoundaryEdges(bytes,gltf,strictManifold=false) {
  const binary=bytes.subarray(28+bytes.readUInt32LE(12));
  function accessor(index,width) {
    const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView];
    const size={5126:4,5125:4,5123:2}[a.componentType];
    const read={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE'}[a.componentType];
    assert.ok(read,'Supported uncompressed accessor');
    return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>binary[read]((view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||width*size)+k*size)));
  }
  const edges=new Map();
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
    const positions=accessor(p.attributes.POSITION,3).map(v=>v.map(x=>Math.round(x*1e6)).join(','));
    const indices=accessor(p.indices,1).flat();
    for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){
      const edge=[positions[indices[i+k]],positions[indices[i+(k+1)%3]]].sort().join(';');
      edges.set(edge,(edges.get(edge)||0)+1);
    }
  }
  return [...edges.values()].filter(count=>strictManifold?count!==2:count===1).length;
}

test('window wall retains closed glazing and its reviewed browser export',()=>{
  const asset=JSON.parse(readFileSync(new URL('../assets/models/cafe-window-wall-provenance.json',import.meta.url)));
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  assert.equal(manifest.models.find(m=>m.path===asset.path)?.id,24);
  const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.ok(bytes.length<=2*1024*1024);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(exportedBoundaryEdges(bytes,gltf,true),0,'Wall and restored glazing must stay closed and manifold');
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,asset.triangles);assert.ok(triangles<=24000);
  // A watertight ring can still contain an absent pane. Shoot through all six
  // glazing centers, independently of the positional edge-connectivity check.
  const binary=bytes.subarray(28+bytes.readUInt32LE(12));
  const read=(id,width)=>{
    const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],size=a.componentType===5123?2:4;
    const method=a.componentType===5126?'readFloatLE':a.componentType===5123?'readUInt16LE':'readUInt32LE';
    return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>binary[method]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*width)+k*size)));
  };
  const panes=gltf.meshes.flatMap(m=>m.primitives).filter(p=>gltf.materials[p.material].name.startsWith('Glazing')).map(p=>({positions:read(p.attributes.POSITION,3),indices:read(p.indices,1).flat()}));
  for(const x of [-.55,.55])for(const y of [1.8,2.5,3.2]){
    const hit=panes.some(({positions,indices})=>{
      for(let i=0;i<indices.length;i+=3){
        const [a,b,c]=indices.slice(i,i+3).map(j=>positions[j]);
        const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(det)<1e-10)continue;
        const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det;
        const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;
        if(u>=0 && v>=0 && u+v<=1)return true;
      }
      return false;
    });
    assert.ok(hit,`Missing glazing at ${x}, ${y}`);
  }
  const bounds=gltf.meshes.flatMap(m=>m.primitives).map(p=>gltf.accessors[p.attributes.POSITION]);
  for(let k=0;k<3;k++){
    const size=Math.max(...bounds.map(a=>a.max[k]))-Math.min(...bounds.map(a=>a.min[k]));
    assert.ok(Math.abs(size-[4,4,.42][k])<.001);
  }
  for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
  for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
  assert.ok(!gltf.skins?.length && !gltf.animations?.length);
});

test('storage shelves are closed, compact and match their reviewed export',()=>{
  const asset=JSON.parse(readFileSync(new URL('../assets/models/cafe-storage-shelves-provenance.json',import.meta.url)));
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  assert.equal(manifest.models.find(m=>m.path===asset.path)?.id,23);
  const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.ok(bytes.length<=1024*1024);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(exportedBoundaryEdges(bytes,gltf,true),0);
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,asset.triangles);assert.ok(triangles<=10000);
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
    const a=gltf.accessors[p.attributes.POSITION];
    assert.ok(a.max[0]-a.min[0]<=.851 && a.max[1]-a.min[1]<=1.601 && a.max[2]-a.min[2]<=.751);
  }
  for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
  for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
  assert.ok(!gltf.skins?.length && !gltf.animations?.length);
});

test('pastry display is closed, embedded and matches its reviewed export',()=>{
  const asset=JSON.parse(readFileSync(new URL('../assets/models/cafe-pastry-display-provenance.json',import.meta.url)));
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  assert.equal(manifest.models.find(m=>m.path===asset.path)?.id,22);
  const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.ok(bytes.length<=1024*1024);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(exportedBoundaryEdges(bytes,gltf,true),0);
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,asset.triangles);assert.ok(triangles<=6000);
  for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
  for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
  assert.ok(!gltf.skins?.length && !gltf.animations?.length);
});

test('plant and pot variants are closed, compact, embedded and match their provenance',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const assets=JSON.parse(readFileSync(new URL('../assets/models/cafe-plants-provenance.json',import.meta.url)));
  assert.equal(assets.length,7);
  for(const asset of assets){
    assert.equal(manifest.models.find(m=>m.path===asset.path)?.id,asset.id);
    const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.ok(bytes.length<=1024*1024);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.equal(exportedBoundaryEdges(bytes,gltf,true),0,asset.name+' has an open/non-manifold surface');
    const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
    assert.equal(triangles,asset.triangles);assert.ok(triangles<=3000);
    for(const mesh of gltf.meshes)for(const p of mesh.primitives){
      const a=gltf.accessors[p.attributes.POSITION];
      assert.ok(a.max[0]-a.min[0]<=.461 && a.max[1]-a.min[1]<=.601 && a.max[2]-a.min[2]<=.461);
    }
    for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
    for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
    assert.equal(gltf.skins,undefined);assert.equal(gltf.animations,undefined);
  }
});

test('architecture retains reviewed geometry with closed exported surfaces',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const assets=JSON.parse(readFileSync(new URL('../assets/models/cafe-architecture-provenance.json',import.meta.url)));
  assert.equal(assets.length,2);
  for(const asset of assets){
    assert.equal(manifest.models.find(m=>m.path===asset.path)?.id,asset.name==='wall'?10:11);
    const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
    assert.ok(bytes.length<=2*1024*1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.equal(exportedBoundaryEdges(bytes,gltf,true),0,`${asset.name}: surface must remain closed and manifold`);
    const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
    assert.equal(triangles,asset.name==='wall'?45744:3000,'Preserve visually reviewed geometry');
    assert.ok(gltf.images.length>0);
    for(const img of gltf.images){assert.equal(img.uri,undefined);assert.ok(Number.isInteger(img.bufferView));}
    for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
    assert.ok(!gltf.skins?.length && !gltf.animations?.length);
  }
});

test('barista manifest contains a bounded embedded skin and both locomotion clips',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const asset=manifest.models.find(m=>m.id===4);
  const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.ok(bytes.length<=8*1024*1024);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Idle','Walking']);
  assert.ok(gltf.skins[0].joints.length>0);
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
    assert.equal(gltf.accessors[p.attributes.JOINTS_0].count,gltf.accessors[p.attributes.POSITION].count);
    assert.equal(gltf.accessors[p.attributes.WEIGHTS_0].count,gltf.accessors[p.attributes.POSITION].count);
  }
  for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
  for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
});

for(const guestId of [1,12,13,14])test(`Guest ${guestId} is closed, skinned, bounded and retains all three gameplay poses`,()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const asset=manifest.models.find(m=>m.id===guestId);
  const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
  assert.ok(bytes.length<=8*1024*1024);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Idle','Seated','Walking']);
  assert.equal(exportedBoundaryEdges(bytes,gltf),0,'Guest must have no open geometric edges');
  assert.equal(gltf.skins.length,1);
  let triangles=0;
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
    triangles+=gltf.accessors[p.indices].count/3;
    assert.equal(gltf.accessors[p.attributes.JOINTS_0].count,gltf.accessors[p.attributes.POSITION].count);
    assert.equal(gltf.accessors[p.attributes.WEIGHTS_0].count,gltf.accessors[p.attributes.POSITION].count);
  }
  assert.ok(triangles<=15000);
  for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView));
  for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
});

test('integrated cafe models fit browser budgets and embed their textures',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
  const provenance=JSON.parse(readFileSync(new URL('../assets/models/cafe-provenance.json',import.meta.url)));
  assert.equal(new Set(manifest.models.map(m=>m.id)).size,25);
  for(const asset of provenance){
    assert.ok(manifest.models.some(m=>m.path===asset.path));
    const bytes=readFileSync(new URL('../assets/'+asset.path,import.meta.url));
    assert.ok(bytes.length<=1024*1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    // The source masters have these small existing boundaries. Unwelded
    // decimation previously introduced 1,764–8,286 open edges per asset.
    const boundaryBudget={'coffee-machine':0,'espresso-cup':0,'counter-straight':4,'counter-corner':15,table:0,chair:2};
    assert.ok(exportedBoundaryEdges(bytes,gltf)<=boundaryBudget[asset.name],`${asset.name}: optimization opened holes`);
    let triangles=0;
    for(const mesh of gltf.meshes)for(const p of mesh.primitives){
      assert.equal(p.mode??4,4);triangles+=gltf.accessors[p.indices].count/3;
      assert.ok(p.attributes.NORMAL!==undefined);assert.ok(p.attributes.TEXCOORD_0!==undefined);
    }
    assert.ok(triangles<=(asset.name==='coffee-machine'?9000:2800));
    assert.ok(gltf.images.length>0);
    for(const img of gltf.images){assert.equal(img.uri,undefined);assert.ok(Number.isInteger(img.bufferView));}
    for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined);
    assert.ok(!gltf.extensionsRequired?.includes('KHR_draco_mesh_compression'));
  }
});
