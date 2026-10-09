export function previewBasePath(): string {
  if (process.env.PAGES_BASE_PATH) {
    const base = process.env.PAGES_BASE_PATH;
    if (base !== './' && ((!/^\/[a-zA-Z0-9._/-]*\/$/.test(base) && base !== '/') || base.split('/').some(part => part === '.' || part === '..'))) throw new Error('Invalid PAGES_BASE_PATH');
    return base;
  }
  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (!repository) return './';
  return repository.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '/' : `/${repository}/`;
}
