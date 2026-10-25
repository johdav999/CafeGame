import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { elevenSpeech, elevenSound, tripoModel, tripoData, request } from './providers.mjs';

// Explicit offline commands only; neither builds nor CI make paid API calls.
const [command, id, ...words] = process.argv.slice(2);
const text = words.filter(word => word !== '--execute').join(' ');
const execute = words.includes('--execute');
const output = resolve('assets/generated');
function key(name) {
  if (!process.env[name]) throw new Error(`Set ${name} in .env or your shell.`);
  return process.env[name];
}
function validateId(value) {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value ?? '')) throw new Error('Use a short asset ID containing letters, digits, underscores or hyphens.');
}
async function save(name, content) {
  await mkdir(output, { recursive: true });
  // Exclusive writes protect previous drafts and provider receipts.
  await writeFile(resolve(output, name), content, { flag: 'wx' });
}
async function main() {
  if (!['speech', 'sound', 'model', 'status'].includes(command)) {
    console.log('Usage: npm run assets -- <speech|sound|model> <asset-id> "prompt" [--execute]\n       npm run assets -- status <tripo-task-id>\nGeneration defaults to a dry run. --execute submits a paid provider request.');
    return;
  }
  validateId(id);
  if (command === 'status') {
    const response = await request(`https://api.tripo3d.ai/v2/openapi/task/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key('TRIPO_API_KEY')}` } });
    const data = tripoData(await response.json());
    console.log(JSON.stringify(data, null, 2));
    console.log('Download the successful GLB output promptly; provider URLs may expire.');
    return;
  }
  if (!text) throw new Error('Supply the asset prompt or speech text.');
  const plan = command === 'speech' ? elevenSpeech(text, process.env.ELEVENLABS_VOICE_ID || (!execute ? 'YOUR_VOICE_ID' : '')) : command === 'sound' ? elevenSound(text) : tripoModel(text);
  if (!execute) { console.log(JSON.stringify({ mode: 'dry-run', command, id, ...plan }, null, 2)); return; }
  for (const name of command === 'model' ? [`${id}.tripo.json`] : [`${id}.mp3`, `${id}.source.json`]) {
    let exists = true;
    try { await access(resolve(output, name)); } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
    if (exists) throw new Error(`Draft ${name} already exists. Choose a new asset ID before generating.`);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (command === 'model') headers.Authorization = `Bearer ${key('TRIPO_API_KEY')}`;
  else headers['xi-api-key'] = key('ELEVENLABS_API_KEY');
  const response = await request(plan.url, { method: 'POST', headers, body: JSON.stringify(plan.body) });
  if (command === 'model') {
    const data = tripoData(await response.json());
    if (!data.task_id) throw new Error('Tripo response did not include a task ID.');
    // Print first so a disk failure cannot lose the paid task reference.
    console.log(`Tripo task: ${data.task_id}\nCheck: npm run assets -- status ${data.task_id}`);
    await save(`${id}.tripo.json`, JSON.stringify({ ...data, prompt: text, model: plan.body.model_version, createdAt: new Date().toISOString() }, null, 2));
  } else {
    await save(`${id}.mp3`, new Uint8Array(await response.arrayBuffer()));
    await save(`${id}.source.json`, JSON.stringify({ provider: 'elevenlabs', kind: command, request: plan.body, createdAt: new Date().toISOString() }, null, 2));
    console.log(`Saved assets/generated/${id}.mp3`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
