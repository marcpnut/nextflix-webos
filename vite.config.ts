import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'chrome79',
    cssTarget: 'chrome79',
    modulePreload: false,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js'
      }
    }
  }
});
