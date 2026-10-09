import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_OUTPUT_BYTES, validOutputName, validateBuild } from './validate-build.ts';

export const YANDEX_ARCHIVE = resolve('artifacts/neon-rush-yandex.zip');

export function validateArchive(archive = YANDEX_ARCHIVE): void {
  const output = validateBuild('yandex');
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
  if (entries.some(entry => !validOutputName(entry))) throw new Error('Unsafe archive entry');
  const files = entries.filter(entry => !entry.endsWith('/')).sort();
  if (new Set(files).size !== files.length || JSON.stringify(files) !== JSON.stringify(output.files)) throw new Error('Archive entries differ from validated Yandex build');
  let total = 0;
  for (const file of files) {
    const archived = execFileSync('unzip', ['-p', archive, file], { maxBuffer: MAX_OUTPUT_BYTES });
    total += archived.byteLength;
    if (!archived.equals(readFileSync(join('dist/yandex', file)))) throw new Error(`Archive content mismatch: ${file}`);
  }
  if (total >= MAX_OUTPUT_BYTES) throw new Error('Archive content must be below 100 MB');
  console.log(`neon-rush-yandex.zip: root index.html, ${files.length} files, ${total} uncompressed bytes, valid`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) validateArchive();
