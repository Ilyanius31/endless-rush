import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewBasePath } from '../build.config';

afterEach(() => vi.unstubAllEnvs());

describe('базовый путь Pages', () => {
  it('учитывает обычный репозиторий, fork и сайт пользователя', () => {
    vi.stubEnv('PAGES_BASE_PATH', '');
    for (const [repository, base] of [
      ['Ilyanius31/endless-rush', '/endless-rush/'],
      ['AnotherOwner/fork', '/fork/'],
      ['Ilyanius31/ilyanius31.github.io', '/'],
    ]) {
      vi.stubEnv('GITHUB_REPOSITORY', repository);
      expect(previewBasePath()).toBe(base);
    }
  });

  it('по умолчанию работает локально и позволяет задать путь вручную', () => {
    vi.stubEnv('PAGES_BASE_PATH', '');
    vi.stubEnv('GITHUB_REPOSITORY', '');
    expect(previewBasePath()).toBe('./');
    vi.stubEnv('PAGES_BASE_PATH', '/preview/');
    expect(previewBasePath()).toBe('/preview/');
    vi.stubEnv('PAGES_BASE_PATH', '/');
    expect(previewBasePath()).toBe('/');
  });

  it('отклоняет внешний адрес и выход за корень сайта', () => {
    for (const base of ['https://example.com/', '../', '/../', '/foo/../bar/', '/with space/']) {
      vi.stubEnv('PAGES_BASE_PATH', base);
      expect(() => previewBasePath()).toThrow('Invalid PAGES_BASE_PATH');
    }
  });
});
