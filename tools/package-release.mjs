import {mkdir,copyFile,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
// Explicit allowlist: never bundle provider drafts, SDKs, node_modules or secrets.
const site=resolve(process.env.CAFE_SITE_DIR||'build/browser/site');
if((await readFile(join(site,'cafe_game.js'),'utf8')).includes('cafeGardenDevelopmentFixture'))
  throw Error('Garden ownership development fixture builds cannot be packaged for release. Rebuild with CAFE_GARDEN_DEVELOPMENT_FIXTURE=OFF.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const root=resolve('build/releases'),destination=join(root,`cafe-game-rc-${stamp}`);
await mkdir(destination,{recursive:true});
const files=['index.html','style.css','host.js','presentation.js','service-ui.js','cafe_game.js','cafe_game.wasm','asset_decode.js','asset_decode.wasm','audio-system.js','assets/manifest.json','assets/provenance.md'];
for(const dir of ['assets/models','assets/audio','licenses'])for(const entry of await readdir(join(site,dir),{withFileTypes:true})){if(!entry.isFile())throw Error(`Unexpected nested release entry: ${dir}/${entry.name}`);files.push(`${dir}/${entry.name}`);}
const hashes=[];
for(const file of files){const source=join(site,file),data=await readFile(source);if(!data.length)throw Error(`Empty release file: ${file}`);await mkdir(resolve(destination,file,'..'),{recursive:true});await copyFile(source,join(destination,file));hashes.push({path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
for(const [source,file] of [['docs/game-release.md','RUN.md'],['docs/service-ui.md','service-ui.md']]){const data=await readFile(source);await writeFile(join(destination,file),data);hashes.push({path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
await writeFile(join(destination,'release-manifest.json'),JSON.stringify({created:new Date().toISOString(),status:'local release candidate; physical mobile acceptance outstanding; see RUN.md for dated device evidence',engine:'56080eca124c9a62e15b146799a8004bdad5a9b2',saveSchema:15,files:hashes},null,2)+'\n');
const archive=destination+'.zip';const result=spawnSync('cmake',['-E','tar','cf',archive,'--format=zip','.'],{cwd:destination,stdio:'inherit'});if(result.status!==0)throw Error('Archive creation failed');
console.log(JSON.stringify({directory:destination,archive,archiveBytes:(await stat(archive)).size,uncompressedBytes:hashes.reduce((n,f)=>n+f.bytes,0)},null,2));
