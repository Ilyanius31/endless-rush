import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateBuild } from '../scripts/validate-build';

const fixtures: string[] = [];

function fixture(target: 'preview' | 'yandex', base: string): string {
  const cache = resolve('.cache');
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, 'build-test-'));
  fixtures.push(root);
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), `<script type="module" src="${base}assets/game.js"></script>`);
  writeFileSync(join(root, 'assets/game.js'), 'export {};');
  writeFileSync(join(root, 'build-info.json'), JSON.stringify({ target, base, milestone: 1, sdkIntegrated: false }));
  return root;
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true });
});

describe('проверка статической сборки', () => {
  it('проверяет preview в подкаталоге и относительные пути Yandex', () => {
    expect(validateBuild('preview', fixture('preview', '/endless-rush/')).files).toHaveLength(3);
    expect(validateBuild('yandex', fixture('yandex', './')).files).toHaveLength(3);
  });

  it('отклоняет перепутанные цели сборки', () => {
    expect(() => validateBuild('yandex', fixture('preview', './'))).toThrow('metadata');
  });

  it('отклоняет отсутствующие ресурсы', () => {
    const root = fixture('yandex', './');
    writeFileSync(join(root, 'index.html'), '<script type="module" src="./missing.js"></script>');
    expect(() => validateBuild('yandex', root)).toThrow('Missing or invalid asset');
  });

  it('отклоняет внешние runtime CDN, пробелы, кириллицу и секреты', () => {
    const external = fixture('preview', './');
    writeFileSync(join(external, 'index.html'), '<script type="module" src="https://example.com/game.js"></script>');
    expect(() => validateBuild('preview', external)).toThrow('External runtime asset');
    for (const name of ['bad name.js', 'игра.js', '.env']) {
      const root = fixture('yandex', './');
      writeFileSync(join(root, name), 'invalid');
      expect(() => validateBuild('yandex', root)).toThrow('Unsafe output filename');
    }
  });
});
