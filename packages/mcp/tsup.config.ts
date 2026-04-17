import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  external: ['@any_table/react', 'react', 'react-dom', '@uwdata/mosaic-core', '@uwdata/mosaic-sql'],
});
