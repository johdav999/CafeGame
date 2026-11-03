// Original CafeGame assets. Deterministic offline authoring; no provider calls.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../assets');
for(const dir of ['models','audio'])fs.mkdirSync(path.join(root,dir),{recursive:true});
const palette=[[.14,.24,.20],[.95,.91,.82],[.84,.67,.36],[.19,.17,.15],[.77,.46,.34],[.56,.65,.54],[.72,.51,.31],[.67,.43,.29]];
function model(name,parts){
 const blobs=[],views=[],accessors=[],primitives=[];let size=0;
 const add=(values,type,componentType,min,max)=>{const data=componentType===5126?new Float32Array(values):new Uint16Array(values),b=Buffer.from(data.buffer);views.push({buffer:0,byteOffset:size,byteLength:b.length});blobs.push(b);size+=b.length;while(size%4){blobs.push(Buffer.alloc(1));size++;}accessors.push({bufferView:views.length-1,componentType,count:values.length/(type==='VEC3'?3:1),type,...(min?{min,max}:{})});return accessors.length-1;};
 for(const [pos,scale,mat,round=true] of parts){
  const vertices=[],normals=[],indices=[];const seg=12,rings=8;
  if(round){for(let r=0;r<=rings;r++)for(let s=0;s<=seg;s++){const t=Math.PI*r/rings,p=2*Math.PI*s/seg,n=[Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p)];vertices.push(...n.map((v,i)=>pos[i]+v*scale[i]));const norm=n.map((v,i)=>v/scale[i]),len=Math.hypot(...norm);normals.push(...norm.map(v=>v/len));}for(let r=0;r<rings;r++)for(let s=0;s<seg;s++){const a=r*(seg+1)+s,b=a+seg+1;indices.push(a,a+1,b,a+1,b+1,b);}}
  else {for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const a=(axis+1)%3,b=(axis+2)%3,start=vertices.length/3;for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const p=[...pos],n=[0,0,0];p[axis]+=sign*scale[axis];p[a]+=u*scale[a];p[b]+=v*scale[b];n[axis]=sign;vertices.push(...p);normals.push(...n);}indices.push(...(sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).map(i=>start+i));}}
  const min=pos.map((v,i)=>v-scale[i]),max=pos.map((v,i)=>v+scale[i]);primitives.push({attributes:{POSITION:add(vertices,'VEC3',5126,min,max),NORMAL:add(normals,'VEC3',5126)},indices:add(indices,'SCALAR',5123),material:mat});
 }
 const doc={asset:{version:'2.0',generator:'CafeGame original offline authoring'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives}],materials:palette.map(c=>({pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:0,roughnessFactor:.8}})),buffers:[{byteLength:size}],bufferViews:views,accessors};
 let json=Buffer.from(JSON.stringify(doc));while(json.length%4)json=Buffer.concat([json,Buffer.from(' ')]);const bin=Buffer.concat(blobs),header=Buffer.alloc(12),j=Buffer.alloc(8),b=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);j.writeUInt32LE(json.length);j.writeUInt32LE(0x4e4f534a,4);b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path.join(root,'models',name+'.glb'),Buffer.concat([header,j,json,b,bin]));
}
model('house-machine',[[[0,.35,0],[.64,.32,.32],0],[[0,.05,.05],[.7,.05,.4],2,false],[[0,.57,0],[.58,.06,.28],1,false],[[0,.32,.32],[.55,.04,.035],2,false],...[ -.3,.3].flatMap(x=>[[[x,.21,.3],[.09,.10,.07],3,false],[[x,.12,.36],[.15,.025,.1],2,false],[[x,.49,.3],[.06,.06,.025],1]])]);
for(const pose of ['standing','seated','working','staff']){
 const seated=pose==='seated',work=pose==='working',staff=work || pose==='staff';
 model('neighbor-'+pose,[[[0,.85,0],[.27,.39,.19],staff?0:4],[[0,1.43,0],[.23,.25,.22],7],[[0,1.60,.03],[.24,.12,.22],3],...(staff?[[[0,.84,-.18],[.21,.28,.035],1,false]]:[]),...[-1,1].flatMap(s=>[[[s*.13,seated?.37:.26,seated?-.16:0],[.10,seated?.22:.26,.11],3],[[s*.13,.06,seated?-.32:-.06],[.12,.06,.19],3],[[s*.32,work?1.02:.88,work?-.22:0],[.09,work?.12:.27,work?.24:.10],7]]),...[-1,1].map(s=>[[s*.08,1.46,-.207],[.022,.025,.022],3])]);
}
let seed=521;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const rate=16000;
for(const [name,seconds] of [['brew',1.5],['cup',.35],['door',.8],['ambience',4]]){
 const pcm=Buffer.alloc(Math.round(rate*seconds)*2);let peak=0,sum=0;
 for(let i=0;i<pcm.length/2;i++){const t=i/rate,fade=Math.min(1,t/.03,(seconds-t)/.08);let v;
 if(name==='brew')v=(noise()*.10+Math.sin(t*2*Math.PI*95)*.035)*(.7+.3*Math.sin(t*14));
 if(name==='cup')v=(Math.sin(t*2*Math.PI*1700)+.35*Math.sin(t*2*Math.PI*2450))*.19*Math.exp(-t*22);
 if(name==='door')v=(Math.sin(t*2*Math.PI*880)+.5*Math.sin(t*2*Math.PI*1320))*.13*Math.exp(-t*5);
 if(name==='ambience')v=noise()*.018+Math.sin(t*2*Math.PI*120)*.006;
 v*=fade;peak=Math.max(peak,Math.abs(v));sum+=v*v;pcm.writeInt16LE(Math.round(v*32767),i*2);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);fs.writeFileSync(path.join(root,'audio',name+'.wav'),Buffer.concat([h,pcm]));console.log(`${name}: peak ${peak.toFixed(3)}, RMS ${Math.sqrt(sum/(pcm.length/2)).toFixed(3)}`);
}
const manifest={version:2,models:['house-machine','neighbor-standing','neighbor-seated','neighbor-working','neighbor-staff'].map((name,id)=>({id,path:`models/${name}.glb`,approval:'original-local-2026-10-26',fallback:'engine primitives'})),audio:['brew','cup','door','ambience'].map((name,id)=>({id,path:`audio/${name}.wav`,sampleRate:rate,approval:'original-local-2026-10-26'})),provenance:'provenance.md'};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
