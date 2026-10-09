import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BuildTarget = 'preview' | 'yandex';
export const MAX_OUTPUT_BYTES = 100_000_000;
const allowedExtensions = new Set(['.html', '.js', '.css', '.json', '.svg', '.png', '.webp', '.ogg', '.mp3', '.woff2']);

export function validOutputName(name: string): boolean {
  return /^[a-zA-Z0-9._/-]+$/.test(name) && !name.startsWith('/') && name.split('/').every(part => part !== '..' && !part.startsWith('.'));
}

export function validateBuild(target: BuildTarget, directory = resolve(`dist/${target}`)): { files: string[]; bytes: number } {
  const files: string[] = [];
  let bytes = 0;
  function walk(relative = ''): void {
    for (const name of readdirSync(join(directory, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      if (!validOutputName(path)) throw new Error(`Unsafe output filename: ${path}`);
      const info = lstatSync(join(directory, path));
      if (info.isSymbolicLink()) throw new Error(`Symlink in output: ${path}`);
      if (info.isDirectory()) walk(path);
      else if (info.isFile()) {
        if (!allowedExtensions.has(extname(path))) throw new Error(`Unexpected output file: ${path}`);
        bytes += info.size;
        files.push(path);
      } else throw new Error(`Unsupported output entry: ${path}`);
    }
  }
  walk();
  if (bytes >= MAX_OUTPUT_BYTES) throw new Error('Output must be below 100 MB');
  if (!files.includes('index.html') || files.filter(file => file.endsWith('index.html')).length !== 1) throw new Error('Expected one index.html at archive root');
  const html = readFileSync(join(directory, 'index.html'), 'utf8');
  const info = JSON.parse(readFileSync(join(directory, 'build-info.json'), 'utf8')) as { target: string; base: string; milestone: number; sdkIntegrated: boolean };
  if (info.target !== target || info.milestone !== 2 || info.sdkIntegrated !== false) throw new Error('Invalid milestone 2 build metadata');
  if (typeof info.base !== 'string' || (info.base !== './' && !/^\/[a-zA-Z0-9._/-]*\/$/.test(info.base) && info.base !== '/')) throw new Error('Invalid asset base');
  if (target === 'yandex' && info.base !== './') throw new Error('Yandex assets must use relative paths');
  if (!/<script[^>]+type="module"/.test(html)) throw new Error('Missing application entry point');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (/^(?:https?:)?\/\//.test(reference)) throw new Error(`External runtime asset: ${reference}`);
    let local: string;
    if (info.base === './') {
      if (reference.startsWith('/')) throw new Error(`Absolute asset path: ${reference}`);
      local = reference.replace(/^\.\//, '');
    } else {
      if (!reference.startsWith(info.base)) throw new Error(`Asset outside base: ${reference}`);
      local = reference.slice(info.base.length);
    }
    if (!validOutputName(local) || !files.includes(local)) throw new Error(`Missing or invalid asset: ${reference}`);
  }
  for (const file of files.filter(file => file.endsWith('.css'))) {
    if (/(?:@import\s|url\()[^;}]*(?:https?:)?\/\//.test(readFileSync(join(directory, file), 'utf8'))) throw new Error(`External CSS asset: ${file}`);
  }
  return { files: files.sort(), bytes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for (const target of ['preview', 'yandex'] as const) {
    const result = validateBuild(target);
    console.log(`${target}: ${result.files.length} files, ${result.bytes} bytes, valid`);
  }
}
