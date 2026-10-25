export function elevenSpeech(text, voiceId) {
  if (!voiceId) throw new Error('Set ELEVENLABS_VOICE_ID for speech.');
  return { url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, body: { text, model_id: 'eleven_multilingual_v2' } };
}
export function elevenSound(text) {
  return { url: 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', body: { text, duration_seconds: 3, prompt_influence: 0.3 } };
}
export function tripoModel(prompt) {
  if (!prompt || prompt.length > 1024) throw new Error('Tripo prompt must contain 1–1024 characters.');
  return { url: 'https://api.tripo3d.ai/v2/openapi/task', body: { type: 'text_to_model', model_version: 'v2.5-20250123', prompt } };
}
export async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Provider request failed (HTTP ${response.status}).`);
  return response;
}
export function tripoData(result) {
  if (result.code !== 0 || !result.data) throw new Error(`Tripo rejected the request (code ${result.code}).`);
  return result.data;
}
