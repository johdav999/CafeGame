import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { elevenSpeech, elevenSound, tripoModel, tripoData } from '../tools/providers.mjs';
test('speech requires a voice and encodes the voice path', () => {
  assert.throws(() => elevenSpeech('Hello', ''));
  assert.match(elevenSpeech('Hello', 'a/b').url, /a%2Fb/);
});
test('sound requests and model prompts use the provider contracts', () => {
  assert.equal(elevenSound('Coffee').body.duration_seconds, 3);
  assert.equal(tripoModel('A cup').body.type, 'text_to_model');
  assert.throws(() => tripoModel('x'.repeat(1025)));
});
test('Tripo API failures cannot be mistaken for successful HTTP responses', () => {
  assert.throws(() => tripoData({ code: 2002, data: {} }));
  assert.deepEqual(tripoData({ code: 0, data: { task_id: 'test' } }), { task_id: 'test' });
});
test('dry runs need no credentials and never contact providers', () => {
  for (const kind of ['speech', 'sound', 'model']) {
    const result = spawnSync(process.execPath, ['tools/assets.mjs', kind, 'espresso', 'A small espresso'], { encoding: 'utf8', env: { ...process.env, ELEVENLABS_API_KEY: '', TRIPO_API_KEY: '' } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).mode, 'dry-run');
  }
});
