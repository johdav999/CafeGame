import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../vendor/webengine-simulator/', import.meta.url);
const lines = (await readFile(new URL('SHA256SUMS', root), 'utf8')).trim().split(/\r?\n/);
for (const line of lines) {
  const match = /^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$/.exec(line);
  if (!match || match[2].split('/').includes('..') || match[2].startsWith('/')) throw new Error('Invalid simulator manifest entry');
  const source = (await readFile(new URL(match[2], root), 'utf8')).replace(/\r\n/g, '\n');
  const actual = createHash('sha256').update(source).digest('hex');
  if (actual !== match[1]) throw new Error(`Simulator source drift: ${match[2]}`);
}
console.log(`Verified ${lines.length} bundled simulator source hashes`);
