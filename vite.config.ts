import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/ (normal multi-file build)
// `npm run build:single` → dist-single/index.html (one self-contained offline file; fonts and code inlined)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: single
      ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 100_000 }
      : { outDir: 'dist', chunkSizeWarningLimit: 4000 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
