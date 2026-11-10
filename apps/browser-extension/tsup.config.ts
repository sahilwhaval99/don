import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/background.ts', 'src/content.ts', 'src/popup.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension() {
    return {
      js: '.js',
    };
  },
  clean: true,
});
