import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgSrc = (name: string, entry = 'src/index.ts') =>
  resolve(here, '..', '..', 'packages', name, entry);

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/any_table/' : '/',
  plugins: [react()],
  resolve: {
    // Alias workspace packages to their TS source so `pnpm dev` doesn't
    // require a prior `pnpm build`. Vite's react plugin transpiles TSX/JSX
    // on the fly, so new exports from @any_table/react show up immediately.
    alias: {
      '@any_table/core': pkgSrc('core'),
      '@any_table/spec': pkgSrc('spec'),
      '@any_table/react': pkgSrc('react'),
    },
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
});
