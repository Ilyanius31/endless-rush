import { defineConfig } from 'vite';
import { previewBasePath } from './build.config.ts';

export default defineConfig(({ mode }) => {
  const target = mode === 'yandex' ? 'yandex' : 'preview';
  const base = mode === 'standalone' ? previewBasePath() : './';
  return {
    base,
    server: { watch: { ignored: ['**/dist/**', '**/artifacts/**', '**/.cache/**', '**/.npm-cache/**', '**/test-results/**'] } },
    build: { outDir: `dist/${target}`, chunkSizeWarningLimit: 1600 },
    plugins: [{
      name: 'build-info',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ target, base, milestone: 2, sdkIntegrated: false }) });
      },
    }],
  };
});
